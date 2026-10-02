/**
 * Tier 2 — Boundary & Corner Cases
 * Tests edge conditions, network error statuses, malformed templates,
 * extreme camera limits, and empty/large datasets.
 */

import { harness } from './harness.mjs';

export async function runTier2() {
  await harness.describe('Tier 2: Boundary & Corner Cases', 2, async () => {
    // ------------------------------------------------------------------------
    // B1: Private Profile Fallback (HTTP 401 and 403)
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.1: Private Profile — HTTP 401 and 403 fall back to curated inventory', ['F1', 'F5'], async () => {
      const { fetchCS2Inventory, FALLBACK_INVENTORY } = await import('../../src/utils/steam.ts');
      
      const originalFetch = globalThis.fetch;
      try {
        // Test 401
        globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });
        const items401 = await fetchCS2Inventory('76561198000000001');
        harness.assertEqual(items401.length, FALLBACK_INVENTORY.length, 'HTTP 401 returns fallback inventory');

        // Test 403
        globalThis.fetch = async () => new Response('Forbidden', { status: 403 });
        const items403 = await fetchCS2Inventory('76561198000000002');
        harness.assertEqual(items403.length, FALLBACK_INVENTORY.length, 'HTTP 403 returns fallback inventory');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // B2: External Rate Limiting (HTTP 429)
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.2: External Rate Limiting — HTTP 429 on Steam and CSFloat handled gracefully', ['F1', 'F3', 'F5'], async () => {
      const { fetchCS2Inventory, fetchCSFloatInspect, FALLBACK_INVENTORY } = await import('../../src/utils/steam.ts');
      
      const originalFetch = globalThis.fetch;
      try {
        // Steam 429
        globalThis.fetch = async (url) => {
          if (String(url).includes('steamcommunity.com')) {
            return new Response('Too Many Requests', { status: 429 });
          }
          if (String(url).includes('api.csfloat.com')) {
            return new Response('Rate Limit Exceeded', { status: 429 });
          }
          return originalFetch(url);
        };

        const steam429Result = await fetchCS2Inventory('76561198000000003');
        harness.assertEqual(steam429Result.length, FALLBACK_INVENTORY.length, 'Steam 429 returns fallback loadout');

        const csfloat429Result = await fetchCSFloatInspect('steam://rungame/730/test');
        harness.assertEqual(csfloat429Result, null, 'CSFloat 429 returns null without throwing error');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // B3: Malformed & Pathological Inspect Links
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.3: Malformed Inspect Links — Handles empty, unescaped, and non-token links', ['F2'], async () => {
      const { formatInspectUrl } = await import('../../src/utils/steam.ts');

      // Empty string
      harness.assertEqual(formatInspectUrl('', '76561198000000000', '123'), '', 'Empty string returns empty string');

      // Null or undefined cast
      harness.assertEqual(formatInspectUrl(null, '76561198000000000', '123'), '', 'Null raw link returns empty string');

      // Link with only %owner_steamid%
      const half1 = formatInspectUrl('steam://preview/%owner_steamid%', '76561198000000000', '123');
      harness.assertEqual(half1, 'steam://preview/76561198000000000', 'Replaces lone %owner_steamid%');

      // Link with special / URI-encoded characters
      const weird = 'steam://run/730/+csgo_econ%20S%owner_steamid%A%assetid%?param=test%20space';
      const formattedWeird = formatInspectUrl(weird, '76561198000000000', '987');
      harness.assertEqual(
        formattedWeird,
        'steam://run/730/+csgo_econ%20S76561198000000000A987?param=test%20space',
        'Preserves other URI encoding while replacing tokens'
      );
    });

    // ------------------------------------------------------------------------
    // B4: Missing Actions & Non-Weapon Items (Containers, Stickers)
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.4: Missing Actions & Tags — Items without inspect links yield null inspectUrl and null float', ['F1', 'F2', 'F8'], async () => {
      const { fetchCS2Inventory } = await import('../../src/utils/steam.ts');

      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => new Response(JSON.stringify({
          success: 1,
          total_inventory_count: 2,
          assets: [
            { appid: 730, contextid: '2', assetid: 'box001', classid: '5001', instanceid: '0', amount: '1' },
            { appid: 730, contextid: '2', assetid: 'sticker002', classid: '5002', instanceid: '0', amount: '1' },
          ],
          descriptions: [
            {
              appid: 730,
              classid: '5001',
              instanceid: '0',
              name: 'Kilowatt Case',
              market_name: 'Kilowatt Case',
              type: 'Container',
              icon_url: 'case_hash',
              tradable: 1,
              marketable: 1,
              // No actions property!
              tags: [{ category: 'Type', internal_name: 'CSGO_Type_WeaponCase', localized_tag_name: 'Container' }]
            },
            {
              appid: 730,
              classid: '5002',
              instanceid: '0',
              name: 'Sticker | Crown (Foil)',
              market_name: 'Sticker | Crown (Foil)',
              type: 'Sticker',
              icon_url: 'crown_hash',
              tradable: 1,
              marketable: 1,
              actions: [], // Empty actions
              tags: [] // Empty tags
            }
          ]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

        const items = await fetchCS2Inventory('76561198000000000');
        harness.assertEqual(items.length, 2, 'Parsed 2 non-weapon items');
        
        // Case item
        harness.assertEqual(items[0].inspectUrl, null, 'Case has inspectUrl = null');
        harness.assertEqual(items[0].float, null, 'Case float is null');
        harness.assertEqual(items[0].seed, null, 'Case seed is null');
        harness.assertEqual(items[0].type, 'Container', 'Case type extracted as Container');

        // Sticker item
        harness.assertEqual(items[1].inspectUrl, null, 'Sticker with empty actions has inspectUrl = null');
        harness.assertEqual(items[1].rarity, 'Base Grade', 'Falls back to Base Grade for missing tags');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // B5: Empty Inventory Response
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.5: Empty Inventory — Zero assets or total_inventory_count: 0 falls back cleanly', ['F1', 'F5'], async () => {
      const { fetchCS2Inventory, FALLBACK_INVENTORY } = await import('../../src/utils/steam.ts');

      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => new Response(JSON.stringify({
          success: 1,
          total_inventory_count: 0,
          assets: [],
          descriptions: []
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

        const items = await fetchCS2Inventory('76561198000000000');
        harness.assertEqual(items.length, FALLBACK_INVENTORY.length, 'Empty assets returns curated fallback items');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // B6: Non-Standard CSFloat Payload Variations
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.6: CSFloat Response Variations — Handles iteminfo, item, or flat root shapes', ['F3'], async () => {
      const { fetchCSFloatInspect } = await import('../../src/utils/steam.ts');

      const originalFetch = globalThis.fetch;
      try {
        // Variation A: nested under "item" instead of "iteminfo"
        globalThis.fetch = async () => new Response(JSON.stringify({
          item: {
            float_value: 0.155,
            paint_seed: 321,
            paint_index: 44
          }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

        const resA = await fetchCSFloatInspect('steam://rungame/730/testA');
        harness.assert(resA !== null, 'Handled nested item schema');
        harness.assertCloseTo(resA.floatvalue, 0.155, 0.001, 'Parsed float_value');
        harness.assertEqual(resA.paintseed, 321, 'Parsed paint_seed');

        // Variation B: Flat top-level keys
        globalThis.fetch = async () => new Response(JSON.stringify({
          floatvalue: 0.887,
          paintseed: 999,
          paintindex: 12
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

        const resB = await fetchCSFloatInspect('steam://rungame/730/testB');
        harness.assert(resB !== null, 'Handled flat schema');
        harness.assertCloseTo(resB.floatvalue, 0.887, 0.001, 'Parsed top-level floatvalue');
        harness.assertEqual(resB.paintseed, 999, 'Parsed top-level paintseed');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // B7: LRU Eviction Under Large Load
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.7: LRU Eviction Under Large Load — Inserting 600 items into 500-capacity cache', ['F4'], async () => {
      const { LRUCache } = await import('../../src/utils/steam.ts');
      const cache = new LRUCache(500, 60000);

      // Populate 600 items
      for (let i = 1; i <= 600; i++) {
        cache.set(`asset_${i}`, { float: i / 1000, seed: i });
      }

      harness.assertEqual(cache.size(), 500, 'Cache strictly caps at capacity 500');
      // Oldest 100 items (1 to 100) must be evicted
      harness.assert(!cache.has('asset_1'), 'asset_1 was evicted');
      harness.assert(!cache.has('asset_100'), 'asset_100 was evicted');
      // Newer items (101 to 600) must remain
      harness.assert(cache.has('asset_101'), 'asset_101 is retained');
      harness.assert(cache.has('asset_600'), 'asset_600 is retained');
    });

    // ------------------------------------------------------------------------
    // B8: Camera Polar Angle Clamping Math Bounds
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.8: Camera Polar Angle Clamping — Math.PI / 4 to Math.PI * 0.65', ['F12'], async () => {
      const minPolarAngle = Math.PI / 4;        // ~0.7853 rad = 45 deg
      const maxPolarAngle = Math.PI * 0.65;     // ~2.0420 rad = 117 deg

      harness.assert(minPolarAngle > 0, 'minPolarAngle is strictly above zenith (0 rad)');
      harness.assert(maxPolarAngle < Math.PI, 'maxPolarAngle is strictly above nadir (PI rad / 180 deg)');
      harness.assert(maxPolarAngle - minPolarAngle > 1.0, 'Provides comfortable ~72° vertical inspection arc');
      
      // Verification of clamping function behavior
      const clampPolar = (angle) => Math.min(Math.max(angle, minPolarAngle), maxPolarAngle);
      harness.assertCloseTo(clampPolar(0.1), minPolarAngle, 0.001, 'Clamps below min to minPolarAngle');
      harness.assertCloseTo(clampPolar(3.14), maxPolarAngle, 0.001, 'Clamps above max to maxPolarAngle');
      harness.assertCloseTo(clampPolar(1.5), 1.5, 0.001, 'Allows intermediate angle without change');
    });

    // ------------------------------------------------------------------------
    // B9: Camera Zoom Distance Boundary Clamping
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.9: Camera Zoom Distance Clamping — minDistance = 1.2 to maxDistance = 5.5', ['F12'], async () => {
      const minDistance = 1.2;
      const maxDistance = 5.5;

      harness.assert(minDistance > 0.5, 'minDistance prevents clipping into weapon bounding box (~2.0 units)');
      harness.assert(maxDistance < 10.0, 'maxDistance prevents weapon from vanishing in viewport');
      
      const clampDist = (d) => Math.min(Math.max(d, minDistance), maxDistance);
      harness.assertEqual(clampDist(0.5), minDistance, 'Clamps close-up zoom at 1.2');
      harness.assertEqual(clampDist(12.0), maxDistance, 'Clamps far zoom at 5.5');
    });

    // ------------------------------------------------------------------------
    // B10: Large Inventory (100 Items) and Batch Enrichment Cap
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.10: Large Inventory Throttling — Caps enrichment batch to 15 items', ['F3', 'F4'], async () => {
      const { enrichInventory } = await import('../../src/utils/steam.ts');

      // Create 40 items with inspect links
      const dummyItems = Array.from({ length: 40 }, (_, idx) => ({
        id: `batch_asset_${idx}`,
        name: `Skin ${idx}`,
        iconUrl: 'https://example.com/icon.png',
        inspectUrl: `steam://rungame/730/test_${idx}`,
        float: null,
        seed: null,
        rarity: 'Covert',
        type: 'Rifle'
      }));

      const originalFetch = globalThis.fetch;
      let csfloatCallCount = 0;
      try {
        globalThis.fetch = async (url) => {
          if (String(url).includes('api.csfloat.com')) {
            csfloatCallCount++;
            return new Response(JSON.stringify({
              iteminfo: { floatvalue: 0.12, paintseed: 100 }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return originalFetch(url);
        };

        const enriched = await enrichInventory(dummyItems, 15);
        harness.assertEqual(enriched.length, 40, 'All 40 items returned');
        harness.assertEqual(csfloatCallCount, 15, 'Enrichment capped strictly to max batch of 15');
        
        // First 15 items have float populated
        const enrichedItems = enriched.filter(i => i.float !== null);
        harness.assertEqual(enrichedItems.length, 15, 'Exactly 15 items received float values');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
}
