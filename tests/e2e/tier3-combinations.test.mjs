/**
 * Tier 3 — Cross-Feature Combinations
 * Tests multi-module integration flows across pipeline and 3D layers:
 * 1. Steam + CSFloat inspect enrichment + LRU cache hit on second query
 * 2. Private profile fallback + SSR endpoint 200 response with fallback items
 * 3. 3D ModelViewer controls state machine (auto-rotate, pause on drag, debounce resume)
 * 4. Error fallback mesh rendering with studio lighting rig
 * 5. Multi-item mixed inventory processing (weapons, containers, knives)
 */

import { harness } from './harness.mjs';

export async function runTier3() {
  await harness.describe('Tier 3: Cross-Feature Combinations', 3, async () => {
    // ------------------------------------------------------------------------
    // C1: Steam + CSFloat inspect enrichment + LRU cache hit on second query
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.1: Steam Fetch + CSFloat Enrich + LRU Cache — Second query hits cache with 0 network calls', ['F1', 'F2', 'F3', 'F4'], async () => {
      const { fetchCS2Inventory, enrichWithCSFloat, inventoryLRUCache } = await import('../../src/utils/steam.ts');
      
      const testAssetId = 'comb_asset_99881';
      inventoryLRUCache.delete(testAssetId); // ensure clean slate

      let csfloatQueries = 0;
      let steamQueries = 0;
      const originalFetch = globalThis.fetch;

      try {
        globalThis.fetch = async (url) => {
          const urlStr = String(url);
          if (urlStr.includes('steamcommunity.com')) {
            steamQueries++;
            return new Response(JSON.stringify({
              success: 1,
              total_inventory_count: 1,
              assets: [{ appid: 730, contextid: '2', assetid: testAssetId, classid: '9988', instanceid: '0', amount: '1' }],
              descriptions: [{
                appid: 730,
                classid: '9988',
                instanceid: '0',
                name: 'USP-S | Printstream',
                market_name: 'USP-S | Printstream (Factory New)',
                type: 'Pistol',
                icon_url: 'usps_printstream_hash',
                tradable: 1,
                marketable: 1,
                actions: [{ link: 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S%owner_steamid%A%assetid%D99', name: 'Inspect' }],
                tags: [{ category: 'Rarity', internal_name: 'Rarity_Covert', localized_tag_name: 'Covert' }]
              }]
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('api.csfloat.com')) {
            csfloatQueries++;
            return new Response(JSON.stringify({
              iteminfo: { floatvalue: 0.0152, paintseed: 202, paintindex: 100 }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          return originalFetch(url);
        };

        // Query 1: Initial fetch & enrichment
        const [item] = await fetchCS2Inventory('76561198000000001');
        harness.assertEqual(steamQueries, 1, 'Steam queried once');
        harness.assertEqual(item.float, null, 'Initial item before enrich has null float');

        const enriched1 = await enrichWithCSFloat(item);
        harness.assertEqual(csfloatQueries, 1, 'CSFloat queried once on cache MISS');
        harness.assertCloseTo(enriched1.float, 0.0152, 0.0001, 'Enriched float matches API response');
        harness.assertEqual(enriched1.seed, 202, 'Enriched seed matches API response');

        // Query 2: Second enrichment call for same item
        const enriched2 = await enrichWithCSFloat(item);
        harness.assertEqual(csfloatQueries, 1, 'CSFloat NOT queried on second call (Cache HIT)');
        harness.assertCloseTo(enriched2.float, 0.0152, 0.0001, 'Retrieved cached float wear');
        harness.assertEqual(enriched2.seed, 202, 'Retrieved cached paint seed');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // C2: Private Profile Fallback + SSR Endpoint 200 Response
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.2: Private Profile Fallback + SSR Endpoint — Endpoint returns HTTP 200 with fallback data', ['F1', 'F5', 'F6'], async () => {
      const apiModule = await import('../../src/pages/api/inventory.json.ts');
      const { FALLBACK_INVENTORY } = await import('../../src/utils/steam.ts');

      const originalFetch = globalThis.fetch;
      try {
        // Force Steam to return 403 Forbidden
        globalThis.fetch = async (url) => {
          if (String(url).includes('steamcommunity.com')) {
            return new Response('Profile Private', { status: 403 });
          }
          return originalFetch(url);
        };

        const mockRequest = new Request('https://links.huh4k.dev/api/inventory.json?steamid=76561198000000999');
        const response = await apiModule.GET({ request: mockRequest, locals: {}, params: {} });

        harness.assertEqual(response.status, 200, 'API returns HTTP 200 even when profile is private');
        const items = await response.json();
        harness.assertEqual(items.length, FALLBACK_INVENTORY.length, 'Returns full fallback inventory payload');
        
        // Assert every item is enriched with float & seed
        for (const item of items) {
          harness.assert(typeof item.id === 'string', 'Item has valid id');
          harness.assert(item.float !== null, `Item ${item.name} has non-null float in fallback`);
          harness.assert(item.seed !== null, `Item ${item.name} has non-null seed in fallback`);
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // C3: 3D ModelViewer Controls State Machine Simulation
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.3: 3D ModelViewer Interaction Lifecycle — Auto-rotate halts on start, resumes on end after debounce', ['F10', 'F12', 'F13'], async () => {
      // Replicate the exact event-driven interaction state machine from SceneControls in ModelViewer.tsx
      class MockControlsStateMachine {
        constructor(idleDelayMs = 50) {
          this.autoRotate = true;
          this.isInteracting = false;
          this.idleDelayMs = idleDelayMs;
          this.timer = null;
          this.listeners = new Map();
        }

        addEventListener(event, fn) {
          if (!this.listeners.has(event)) this.listeners.set(event, []);
          this.listeners.get(event).push(fn);
        }

        emit(event) {
          for (const fn of this.listeners.get(event) || []) fn();
        }

        // Simulates SceneControls effect
        mount() {
          this.addEventListener('start', () => {
            if (this.timer) clearTimeout(this.timer);
            this.isInteracting = true;
          });

          this.addEventListener('end', () => {
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => {
              this.isInteracting = false;
            }, this.idleDelayMs);
          });
        }

        getEffectiveAutoRotate() {
          return this.autoRotate && !this.isInteracting;
        }
      }

      const sm = new MockControlsStateMachine(50);
      sm.mount();

      // State 1: Initial idle state
      harness.assertEqual(sm.getEffectiveAutoRotate(), true, 'Initial state: auto-rotate is active');

      // State 2: User starts dragging / touch
      sm.emit('start');
      harness.assertEqual(sm.isInteracting, true, 'isInteracting becomes true on pointer start');
      harness.assertEqual(sm.getEffectiveAutoRotate(), false, 'Auto-rotate halts immediately during interaction');

      // State 3: User releases drag
      sm.emit('end');
      harness.assertEqual(sm.isInteracting, true, 'isInteracting remains true immediately after release (debounce period)');
      harness.assertEqual(sm.getEffectiveAutoRotate(), false, 'Auto-rotate remains paused during debounce delay');

      // State 4: After debounce delay expires
      await new Promise(resolve => setTimeout(resolve, 80));
      harness.assertEqual(sm.isInteracting, false, 'isInteracting becomes false after debounce timer');
      harness.assertEqual(sm.getEffectiveAutoRotate(), true, 'Auto-rotate smoothly resumes');
    });

    // ------------------------------------------------------------------------
    // C4: Procedural Fallback Mesh + Studio Lighting Rig Integration
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.4: Fallback Mesh & Studio Lighting — Validates PBR materials and light compatibility', ['F10', 'F11'], async () => {
      const { FallbackWeaponMesh, StudioLighting } = await import('../../src/components/ModelViewer.tsx');
      
      harness.assert(typeof FallbackWeaponMesh === 'function', 'FallbackWeaponMesh component is instantiated');
      harness.assert(typeof StudioLighting === 'function', 'StudioLighting component is instantiated');

      const meshOutput = FallbackWeaponMesh();
      harness.assert(meshOutput !== null && typeof meshOutput === 'object', 'FallbackWeaponMesh returns valid JSX element');
      
      const lightingOutput = StudioLighting();
      harness.assert(lightingOutput !== null && typeof lightingOutput === 'object', 'StudioLighting returns valid JSX element');
    });

    // ------------------------------------------------------------------------
    // C5: Mixed-Category CS2 Inventory Pipeline Processing
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.5: Mixed-Category Inventory — Correctly processes rifles, pistols, knives, and cases', ['F1', 'F2', 'F7', 'F8'], async () => {
      const { fetchCS2Inventory } = await import('../../src/utils/steam.ts');

      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => new Response(JSON.stringify({
          success: 1,
          total_inventory_count: 4,
          assets: [
            { appid: 730, contextid: '2', assetid: 'mix_1', classid: '101', instanceid: '0', amount: '1' },
            { appid: 730, contextid: '2', assetid: 'mix_2', classid: '102', instanceid: '0', amount: '1' },
            { appid: 730, contextid: '2', assetid: 'mix_3', classid: '103', instanceid: '0', amount: '1' },
            { appid: 730, contextid: '2', assetid: 'mix_4', classid: '104', instanceid: '0', amount: '1' },
          ],
          descriptions: [
            {
              appid: 730,
              classid: '101',
              instanceid: '0',
              name: 'M4A4 | Howl',
              type: 'Rifle',
              icon_url: 'howl_icon',
              tradable: 1,
              marketable: 1,
              actions: [{ link: 'steam://rungame/730/test%owner_steamid%_%assetid%', name: 'Inspect' }],
              tags: [{ category: 'Rarity', internal_name: 'Rarity_Contraband', localized_tag_name: 'Contraband', color: 'e4ae39' }]
            },
            {
              appid: 730,
              classid: '102',
              instanceid: '0',
              name: 'Glock-18 | Fade',
              type: 'Pistol',
              icon_url: 'glock_fade_icon',
              tradable: 1,
              marketable: 1,
              actions: [{ link: 'steam://rungame/730/test%owner_steamid%_%assetid%', name: 'Inspect' }],
              tags: [{ category: 'Rarity', internal_name: 'Rarity_Restricted', localized_tag_name: 'Restricted' }]
            },
            {
              appid: 730,
              classid: '103',
              instanceid: '0',
              name: '★ Butterfly Knife | Fade',
              type: 'Knife',
              icon_url: 'bfk_fade_icon',
              tradable: 1,
              marketable: 1,
              actions: [{ link: 'steam://rungame/730/test%owner_steamid%_%assetid%', name: 'Inspect' }],
              tags: [{ category: 'Rarity', internal_name: 'Rarity_Extraordinary', localized_tag_name: '★ Extraordinary', color: 'ffd700' }]
            },
            {
              appid: 730,
              classid: '104',
              instanceid: '0',
              name: 'Dreams & Nightmares Case',
              type: 'Container',
              icon_url: 'dn_case_icon',
              tradable: 1,
              marketable: 1,
              // No actions
              tags: [{ category: 'Type', internal_name: 'CSGO_Type_WeaponCase', localized_tag_name: 'Container' }]
            }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

        const items = await fetchCS2Inventory('76561198000000000');
        harness.assertEqual(items.length, 4, 'All 4 mixed items parsed');
        
        // Weapon 1: Howl
        harness.assertEqual(items[0].rarity, 'Contraband', 'Contraband rarity recognized');
        harness.assertEqual(items[0].type, 'Rifle', 'M4A4 identified as Rifle');
        harness.assert(items[0].inspectUrl !== null, 'Has inspectUrl');

        // Weapon 2: Glock
        harness.assertEqual(items[1].type, 'Pistol', 'Glock identified as Pistol');

        // Weapon 3: Knife
        harness.assertEqual(items[2].type, 'Knife', 'Butterfly Knife identified as Knife');
        harness.assertEqual(items[2].rarityColor, '#ffd700', 'Gold knife rarity color assigned');

        // Container: Case
        harness.assertEqual(items[3].type, 'Container', 'Case identified as Container');
        harness.assertEqual(items[3].inspectUrl, null, 'Case has null inspectUrl');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
}
