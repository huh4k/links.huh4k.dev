/**
 * Empirical Stress & Verification Test Suite for CS2 Pipeline & Inventory
 * Author: Challenger 1 (Pipeline & Inventory Stress Verifier)
 *
 * Scope:
 * 1. Root data.asset_properties extraction under extreme, malformed, or missing payloads
 * 2. Exact wear float & pattern seed integrity across all items for Steam ID 76561198920486334
 * 3. CS2 Rarity tag parser against all categories & edge-case orderings (ItemSet collisions)
 * 4. In-memory LRU cache capacity bounds, key isolation, prototype pollution, 0ms hits
 * 5. HTTP 429 rate limiting resilience & authentic fallback inventory fidelity
 * 6. Taxonomy categorization logic across all 6 filter groups & search in InventoryExplorer
 */

import {
  LRUCache,
  inventoryLRUCache,
  getRarityFromTags,
  fetchCS2Inventory,
  FALLBACK_INVENTORY,
  enrichWithCSFloat,
} from '../../src/utils/steam.ts';
import {
  CATEGORIES,
  matchesCategory,
  matchesSearch,
  getWearTier,
} from '../../src/components/steam/InventoryExplorer.tsx';
import { GET as inventoryApiHandler } from '../../src/pages/api/inventory.json.ts';
import type { EnrichedInventoryItem, RawSteamInventoryResponse } from '../../src/types/inventory.ts';

interface AssertionResult {
  section: string;
  name: string;
  status: 'PASS' | 'FAIL';
  detail?: string;
  durationMs: number;
}

const assertions: AssertionResult[] = [];
let passCount = 0;
let failCount = 0;

function assert(
  section: string,
  name: string,
  condition: boolean,
  durationMs = 0,
  detail?: string
): void {
  if (condition) {
    passCount++;
    assertions.push({ section, name, status: 'PASS', durationMs, detail });
    console.log(`  ✓ [PASS] [${section}] ${name} (${durationMs.toFixed(2)}ms)`);
  } else {
    failCount++;
    assertions.push({ section, name, status: 'FAIL', durationMs, detail });
    console.error(`  ✗ [FAIL] [${section}] ${name}${detail ? ` — Details: ${detail}` : ''}`);
  }
}

async function runChallengerHarness() {
  console.log('======================================================================');
  console.log('CHALLENGER 1 — PIPELINE & INVENTORY EMPIRICAL STRESS TEST SUITE');
  console.log('======================================================================\n');

  const suiteStartTime = performance.now();

  // =========================================================================
  // SECTION 1: Direct Extraction of root data.asset_properties
  // =========================================================================
  console.log('=== SECTION 1: Root data.asset_properties Direct Extraction ===');
  {
    const originalFetch = globalThis.fetch;

    // Helper to generate a mock Steam inventory response
    function createMockSteamResponse(overrides: Partial<RawSteamInventoryResponse>): RawSteamInventoryResponse {
      return {
        success: 1,
        total_inventory_count: 1,
        assets: [
          {
            appid: 730,
            contextid: '2',
            assetid: 'mock-asset-101',
            classid: '5001',
            instanceid: '0',
            amount: '1',
          },
        ],
        descriptions: [
          {
            appid: 730,
            classid: '5001',
            instanceid: '0',
            name: 'AK-47 | Ice Coaled (Minimal Wear)',
            market_name: 'AK-47 | Ice Coaled (Minimal Wear)',
            type: 'Rifle',
            icon_url: 'ak47_hash',
            tradable: 1,
            marketable: 1,
            actions: [
              {
                name: 'Inspect in Game...',
                link: 'steam://run/730//+csgo_econ_action_preview%20%propid:6%',
              },
            ],
            tags: [
              { category: 'Type', internal_name: 'CSGO_Type_Rifle', localized_tag_name: 'Rifle' },
              { category: 'Rarity', internal_name: 'Rarity_Legendary_Weapon', localized_tag_name: 'Classified', color: 'd32ce6' },
            ],
          },
        ],
        asset_properties: [
          {
            appid: 730,
            contextid: '2',
            assetid: 'mock-asset-101',
            asset_properties: [
              { propertyid: 1, int_value: '367', name: 'Pattern Template' },
              { propertyid: 2, float_value: '0.082530684769153595', name: 'Wear Rating' },
              { propertyid: 6, string_value: '5545A1B89F9190544D5275A25D7D5065516D8CDEF1B85615', name: 'Item Certificate' },
            ],
          },
        ],
        ...overrides,
      };
    }

    // 1.1 Baseline extraction of propertyid 1, 2, 6
    {
      const tStart = performance.now();
      const mockPayload = createMockSteamResponse({});
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      const item = items.find((i) => i.id === 'mock-asset-101');
      assert(
        'asset_properties',
        '1.1 Baseline extraction of propertyid 1, 2, 6 from valid payload',
        Boolean(
          item &&
          item.seed === 367 &&
          item.float !== null &&
          Math.abs(item.float - 0.08253068) < 0.00001 &&
          item.certificate === '5545A1B89F9190544D5275A25D7D5065516D8CDEF1B85615' &&
          item.inspectUrl?.includes('5545A1B89F9190544D5275A25D7D5065516D8CDEF1B85615')
        ),
        performance.now() - tStart,
        `seed=${item?.seed}, float=${item?.float}, cert=${item?.certificate}`
      );
    }

    // 1.2 Extreme values: seed = 0, boundary float = 0.00000001, seed as integer number instead of string
    {
      const tStart = performance.now();
      const mockPayload = createMockSteamResponse({
        assets: [{ appid: 730, contextid: '2', assetid: 'bound-asset', classid: '5002', instanceid: '0', amount: '1' }],
        descriptions: [{
          appid: 730,
          classid: '5002',
          instanceid: '0',
          name: 'Factory New Pristine Weapon',
          type: 'Rifle',
          icon_url: 'pristine_hash',
          tradable: 1,
          marketable: 1,
        }],
        asset_properties: [
          {
            appid: 730,
            contextid: '2',
            assetid: 'bound-asset',
            asset_properties: [
              { propertyid: 1, int_value: 0, name: 'Pattern Template' },
              { propertyid: 2, float_value: 0.00000001, name: 'Wear Rating' },
            ],
          },
        ],
      });

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      const item = items.find((i) => i.id === 'bound-asset');
      assert(
        'asset_properties',
        '1.2 Boundary extraction: seed === 0 (numeric) and ultra-low float 0.00000001',
        Boolean(item && item.seed === 0 && item.float === 0.00000001),
        performance.now() - tStart,
        `seed=${item?.seed}, float=${item?.float}`
      );
    }

    // 1.3 Boundary values: seed = 1000, float = 1.0 (maximum battle-scarred)
    {
      const tStart = performance.now();
      const mockPayload = createMockSteamResponse({
        assets: [{ appid: 730, contextid: '2', assetid: 'max-asset', classid: '5003', instanceid: '0', amount: '1' }],
        descriptions: [{
          appid: 730,
          classid: '5003',
          instanceid: '0',
          name: 'Battle Scarred Max Weapon',
          type: 'Rifle',
          icon_url: 'bs_hash',
          tradable: 1,
          marketable: 1,
        }],
        asset_properties: [
          {
            appid: 730,
            contextid: '2',
            assetid: 'max-asset',
            asset_properties: [
              { propertyid: 1, int_value: '1000', name: 'Pattern Template' },
              { propertyid: 2, float_value: '1.0', name: 'Wear Rating' },
            ],
          },
        ],
      });

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      const item = items.find((i) => i.id === 'max-asset');
      assert(
        'asset_properties',
        '1.3 Boundary extraction: seed === 1000 and float === 1.0',
        Boolean(item && item.seed === 1000 && item.float === 1.0),
        performance.now() - tStart,
        `seed=${item?.seed}, float=${item?.float}`
      );
    }

    // 1.4 Malformed values in properties: NaN, unparseable strings, empty strings
    {
      const tStart = performance.now();
      const mockPayload = createMockSteamResponse({
        assets: [{ appid: 730, contextid: '2', assetid: 'nan-asset', classid: '5004', instanceid: '0', amount: '1' }],
        descriptions: [{
          appid: 730,
          classid: '5004',
          instanceid: '0',
          name: 'Malformed Property Weapon',
          type: 'Rifle',
          icon_url: 'mal_hash',
          tradable: 1,
          marketable: 1,
        }],
        asset_properties: [
          {
            appid: 730,
            contextid: '2',
            assetid: 'nan-asset',
            asset_properties: [
              { propertyid: 1, int_value: 'NOT_A_NUMBER' },
              { propertyid: 2, float_value: 'CORRUPTED_FLOAT' },
              { propertyid: 6, string_value: '' },
            ],
          },
        ],
      });

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      const item = items.find((i) => i.id === 'nan-asset');
      assert(
        'asset_properties',
        '1.4 Malformed values (NaN/corrupt string) gracefully resolve to null without crashing',
        Boolean(item && item.seed === null && item.float === null && item.certificate === undefined),
        performance.now() - tStart,
        `seed=${item?.seed}, float=${item?.float}, cert=${item?.certificate}`
      );
    }

    // 1.5 Missing / non-array root asset_properties (e.g. asset_properties: null or omitted)
    {
      const tStart = performance.now();
      const mockPayload = createMockSteamResponse({
        assets: [{ appid: 730, contextid: '2', assetid: 'no-props-asset', classid: '5005', instanceid: '0', amount: '1' }],
        descriptions: [{
          appid: 730,
          classid: '5005',
          instanceid: '0',
          name: 'Weapon Without Props',
          type: 'Rifle',
          icon_url: 'hash',
          tradable: 1,
          marketable: 1,
        }],
        asset_properties: undefined,
      });

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      const item = items.find((i) => i.id === 'no-props-asset');
      assert(
        'asset_properties',
        '1.5 Root asset_properties undefined or missing resolves safely without exception',
        Boolean(item && item.float === null && item.seed === null),
        performance.now() - tStart,
        `items count=${items.length}`
      );
    }

    // 1.6 Malformed asset_properties entry (empty object, null entry, missing asset_properties array)
    {
      const tStart = performance.now();
      const mockPayload = createMockSteamResponse({
        assets: [{ appid: 730, contextid: '2', assetid: 'corrupt-entry-asset', classid: '5006', instanceid: '0', amount: '1' }],
        descriptions: [{
          appid: 730,
          classid: '5006',
          instanceid: '0',
          name: 'Corrupt Entry Weapon',
          type: 'Rifle',
          icon_url: 'hash',
          tradable: 1,
          marketable: 1,
        }],
        asset_properties: [
          {} as any,
          { appid: 730, contextid: '2', assetid: 'corrupt-entry-asset', asset_properties: null as any },
          { appid: 730, contextid: '2', assetid: '' } as any,
        ],
      });

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      const item = items.find((i) => i.id === 'corrupt-entry-asset');
      assert(
        'asset_properties',
        '1.6 Malformed asset_properties array entries (null, empty, missing assetid) handled cleanly',
        Boolean(item && item.id === 'corrupt-entry-asset'),
        performance.now() - tStart,
        `item retrieved successfully`
      );
    }

    // 1.7 Unknown propertyids (e.g. propertyid: 999, propertyid: -1) ignored safely
    {
      const tStart = performance.now();
      const mockPayload = createMockSteamResponse({
        assets: [{ appid: 730, contextid: '2', assetid: 'unknown-props-asset', classid: '5007', instanceid: '0', amount: '1' }],
        descriptions: [{
          appid: 730,
          classid: '5007',
          instanceid: '0',
          name: 'Unknown Property IDs Weapon',
          type: 'Rifle',
          icon_url: 'hash',
          tradable: 1,
          marketable: 1,
        }],
        asset_properties: [
          {
            appid: 730,
            contextid: '2',
            assetid: 'unknown-props-asset',
            asset_properties: [
              { propertyid: 999, int_value: 12345 } as any,
              { propertyid: -1, float_value: 0.555 } as any,
              { propertyid: 1, int_value: '500' },
            ],
          },
        ],
      });

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      const item = items.find((i) => i.id === 'unknown-props-asset');
      assert(
        'asset_properties',
        '1.7 Unknown propertyids (999, -1) ignored while valid propertyid 1 is extracted',
        Boolean(item && item.seed === 500 && item.float === null),
        performance.now() - tStart,
        `seed=${item?.seed}, float=${item?.float}`
      );
    }

    // 1.8 Duplicate asset_properties entries for the same assetid
    {
      const tStart = performance.now();
      const mockPayload = createMockSteamResponse({
        assets: [{ appid: 730, contextid: '2', assetid: 'dup-props-asset', classid: '5008', instanceid: '0', amount: '1' }],
        descriptions: [{
          appid: 730,
          classid: '5008',
          instanceid: '0',
          name: 'Duplicate Props Weapon',
          type: 'Rifle',
          icon_url: 'hash',
          tradable: 1,
          marketable: 1,
        }],
        asset_properties: [
          {
            appid: 730,
            contextid: '2',
            assetid: 'dup-props-asset',
            asset_properties: [
              { propertyid: 1, int_value: '111' },
              { propertyid: 2, float_value: '0.111' },
            ],
          },
          {
            appid: 730,
            contextid: '2',
            assetid: 'dup-props-asset',
            asset_properties: [
              { propertyid: 1, int_value: '222' },
              { propertyid: 2, float_value: '0.222' },
            ],
          },
        ],
      });

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(mockPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      const item = items.find((i) => i.id === 'dup-props-asset');
      assert(
        'asset_properties',
        '1.8 Duplicate asset_properties entries for same assetid overwrite cleanly without error',
        Boolean(item && (item.seed === 111 || item.seed === 222)),
        performance.now() - tStart,
        `seed=${item?.seed}, float=${item?.float}`
      );
    }

    // Restore fetch
    globalThis.fetch = originalFetch;
  }

  // =========================================================================
  // SECTION 2: Exact Wear Float & Pattern Seed Integrity across all 26+ items
  // =========================================================================
  console.log('\n=== SECTION 2: Exact Wear Float & Seed Integrity for 76561198920486334 ===');
  {
    const tStart = performance.now();
    // 2.1 Total count check (26+ items)
    assert(
      'inventory_integrity',
      '2.1 Inventory contains at least 26 items for 76561198920486334',
      FALLBACK_INVENTORY.length >= 26,
      performance.now() - tStart,
      `Total items count: ${FALLBACK_INVENTORY.length}`
    );

    // 2.2 AK-47 | Ice Coaled (Minimal Wear, float ~0.08253, seed 367, Classified, Rifle)
    {
      const ak = FALLBACK_INVENTORY.find((i) => i.name.includes('AK-47 | Ice Coaled'));
      assert(
        'inventory_integrity',
        '2.2 AK-47 | Ice Coaled has exact float ~0.08253, seed 367, Classified, Rifle',
        Boolean(
          ak &&
          ak.rarity === 'Classified' &&
          ak.type === 'Rifle' &&
          ak.seed === 367 &&
          typeof ak.float === 'number' &&
          Math.abs(ak.float - 0.08253068) < 0.0001
        ),
        0,
        `Got float=${ak?.float}, seed=${ak?.seed}, rarity=${ak?.rarity}`
      );
    }

    // 2.3 StatTrak™ M4A1-S | Liquidation (Field-Tested, float ~0.3438, seed 937, Restricted, Rifle)
    {
      const m4 = FALLBACK_INVENTORY.find((i) => i.name.includes('M4A1-S | Liquidation'));
      assert(
        'inventory_integrity',
        '2.3 StatTrak™ M4A1-S | Liquidation has float ~0.3438, seed 937, Restricted, Rifle',
        Boolean(
          m4 &&
          m4.rarity === 'Restricted' &&
          m4.type === 'Rifle' &&
          m4.seed === 937 &&
          typeof m4.float === 'number' &&
          Math.abs(m4.float - 0.343797) < 0.001
        ),
        0,
        `Got float=${m4?.float}, seed=${m4?.seed}, rarity=${m4?.rarity}`
      );
    }

    // 2.4 AWP | Ice Coaled (Factory New, float ~0.0631, seed 309, Classified, Sniper Rifle)
    {
      const awp = FALLBACK_INVENTORY.find((i) => i.name.includes('AWP | Ice Coaled'));
      assert(
        'inventory_integrity',
        '2.4 AWP | Ice Coaled has float ~0.0631, seed 309, Classified, Sniper Rifle',
        Boolean(
          awp &&
          awp.rarity === 'Classified' &&
          awp.type === 'Sniper Rifle' &&
          awp.seed === 309 &&
          typeof awp.float === 'number' &&
          Math.abs(awp.float - 0.06312) < 0.001
        ),
        0,
        `Got float=${awp?.float}, seed=${awp?.seed}, rarity=${awp?.rarity}`
      );
    }

    // 2.5 USP-S | Royal Guard (Factory New, float ~0.0560, seed 644, Restricted, Pistol)
    {
      const usp = FALLBACK_INVENTORY.find((i) => i.name.includes('USP-S | Royal Guard'));
      assert(
        'inventory_integrity',
        '2.5 USP-S | Royal Guard has float ~0.0560, seed 644, Restricted, Pistol',
        Boolean(
          usp &&
          usp.rarity === 'Restricted' &&
          usp.type === 'Pistol' &&
          usp.seed === 644 &&
          typeof usp.float === 'number' &&
          Math.abs(usp.float - 0.05598) < 0.001
        ),
        0,
        `Got float=${usp?.float}, seed=${usp?.seed}, rarity=${usp?.rarity}`
      );
    }

    // 2.6 ★ Karambit | Doppler (Factory New knife, float ~0.0089, seed 399, ★ Extraordinary, Knife)
    {
      const knife = FALLBACK_INVENTORY.find((i) => i.type === 'Knife');
      assert(
        'inventory_integrity',
        '2.6 ★ Karambit | Doppler has float ~0.0089, seed 399, ★ Extraordinary, Knife',
        Boolean(
          knife &&
          knife.type === 'Knife' &&
          knife.rarity.includes('Extraordinary') &&
          knife.seed === 399 &&
          typeof knife.float === 'number' &&
          Math.abs(knife.float - 0.00891) < 0.001
        ),
        0,
        `Got name=${knife?.name}, float=${knife?.float}, seed=${knife?.seed}`
      );
    }

    // 2.7 Secondary loadout weapons integrity
    {
      const secondaryChecks = [
        { name: 'Galil AR | Control', float: 0.28078881, seed: 260, rarity: 'Restricted', type: 'Rifle' },
        { name: 'Zeus x27 | Electric Blue', float: 0.08211711, seed: 254, rarity: 'Industrial Grade', type: 'Equipment' },
        { name: 'SSG 08 | Rapid Transit', float: 0.07974057, seed: 521, rarity: 'Restricted', type: 'Sniper Rifle' },
        { name: 'Souvenir MAG-7 | Irradiated Alert', float: 0.30554953, seed: 751, rarity: 'Consumer Grade', type: 'Shotgun' },
        { name: 'StatTrak™ Glock-18 | Catacombs', float: 0.21532707, seed: 912, rarity: 'Mil-Spec Grade', type: 'Pistol' },
        { name: 'MAC-10 | Candy Apple', float: 0.03125664, seed: 839, rarity: 'Industrial Grade', type: 'SMG' },
        { name: 'UMP-45 | Late Night Transit', float: 0.86427438, seed: 248, rarity: 'Mil-Spec Grade', type: 'SMG' },
      ];

      for (const expected of secondaryChecks) {
        const found = FALLBACK_INVENTORY.find((i) => i.name.includes(expected.name));
        const ok = Boolean(
          found &&
          found.rarity === expected.rarity &&
          found.type === expected.type &&
          found.seed === expected.seed &&
          typeof found.float === 'number' &&
          Math.abs(found.float - expected.float) < 0.001
        );
        assert(
          'inventory_integrity',
          `2.7 Secondary item "${expected.name}" integrity verified`,
          ok,
          0,
          `Got float=${found?.float}, seed=${found?.seed}, rarity=${found?.rarity}, type=${found?.type}`
        );
      }
    }

    // 2.8 Universal schema validity across all 26+ items
    {
      let allValid = true;
      let failureReason = '';
      for (const item of FALLBACK_INVENTORY) {
        if (!item.id || typeof item.id !== 'string') {
          allValid = false;
          failureReason = `Invalid id in ${item.name}`;
          break;
        }
        if (!item.name || typeof item.name !== 'string') {
          allValid = false;
          failureReason = `Invalid name in ${item.id}`;
          break;
        }
        if (!item.iconUrl || !item.iconUrl.startsWith('http')) {
          allValid = false;
          failureReason = `Invalid iconUrl in ${item.name}`;
          break;
        }
        if (item.float !== null && (typeof item.float !== 'number' || item.float < 0 || item.float > 1)) {
          allValid = false;
          failureReason = `Invalid float (${item.float}) in ${item.name}`;
          break;
        }
        if (item.seed !== null && (typeof item.seed !== 'number' || item.seed < 0 || !Number.isInteger(item.seed))) {
          allValid = false;
          failureReason = `Invalid seed (${item.seed}) in ${item.name}`;
          break;
        }
        if (!item.rarity || typeof item.rarity !== 'string') {
          allValid = false;
          failureReason = `Invalid rarity in ${item.name}`;
          break;
        }
        if (!item.type || typeof item.type !== 'string') {
          allValid = false;
          failureReason = `Invalid type in ${item.name}`;
          break;
        }
      }

      assert(
        'inventory_integrity',
        '2.8 Complete schema validation across all 26+ inventory items',
        allValid,
        0,
        failureReason || 'All items conform strictly to EnrichedInventoryItem interface'
      );
    }
  }

  // =========================================================================
  // SECTION 3: CS2 Rarity Tag Parser & Edge-Case Tag Orderings
  // =========================================================================
  console.log('\n=== SECTION 3: CS2 Rarity Tag Parser & Tag Orderings ===');
  {
    // 3.1 ItemSet collision prevention (ItemSet tag appearing first in tags array)
    {
      const tagsWithItemSetFirst = [
        { category: 'ItemSet', internal_name: 'set_community_30', localized_tag_name: 'The Recoil Collection' },
        { category: 'Type', internal_name: 'CSGO_Type_Rifle', localized_tag_name: 'Rifle' },
        { category: 'Rarity', internal_name: 'Rarity_Legendary_Weapon', localized_tag_name: 'Classified', color: 'd32ce6' },
      ];
      const parsed = getRarityFromTags(tagsWithItemSetFirst);
      assert(
        'rarity_parser',
        '3.1 ItemSet preceding Rarity tag does not collide with rarity',
        parsed.rarity === 'Classified' && parsed.rarityColor === '#d32ce6',
        0,
        `Got rarity="${parsed.rarity}", color="${parsed.rarityColor}"`
      );
    }

    // 3.2 All standard CS2 Rarity Categories with correct hex color mappings
    const rarityCategories = [
      { internal: 'Rarity_Covert_Weapon', localized: 'Covert', expectedColor: '#eb4b4b' },
      { internal: 'Rarity_Legendary_Weapon', localized: 'Classified', expectedColor: '#d32ce6' },
      { internal: 'Rarity_Mythical_Weapon', localized: 'Restricted', expectedColor: '#8847ff' },
      { internal: 'Rarity_Rare_Weapon', localized: 'Mil-Spec Grade', expectedColor: '#4b69ff' },
      { internal: 'Rarity_Uncommon_Weapon', localized: 'Industrial Grade', expectedColor: '#5e98d9' },
      { internal: 'Rarity_Common_Weapon', localized: 'Consumer Grade', expectedColor: '#b0c3d9' },
      { internal: 'Rarity_Ancient', localized: '★ Extraordinary', expectedColor: '#ffd700' },
      { internal: 'Rarity_Contraband', localized: 'Contraband', expectedColor: '#e4ae39' },
      { internal: 'Rarity_Default', localized: 'Stock', expectedColor: '#ded6cc' },
      { internal: 'Rarity_Rare', localized: 'High Grade', expectedColor: '#4b69ff' },
      { internal: 'Rarity_Common', localized: 'Base Grade', expectedColor: '#b0c3d9' },
    ];

    for (const cat of rarityCategories) {
      const parsed = getRarityFromTags([
        { category: 'Rarity', internal_name: cat.internal, localized_tag_name: cat.localized },
      ]);
      assert(
        'rarity_parser',
        `3.2 Categorizes "${cat.localized}" to default color ${cat.expectedColor}`,
        parsed.rarity === cat.localized && parsed.rarityColor?.toLowerCase() === cat.expectedColor.toLowerCase(),
        0,
        `Got color: ${parsed.rarityColor}`
      );
    }

    // 3.3 Explicit hex color tag property (with and without leading #)
    {
      const withLeadingHash = getRarityFromTags([
        { category: 'Rarity', internal_name: 'Rarity_Custom', localized_tag_name: 'Custom', color: '#123456' },
      ]);
      const withoutLeadingHash = getRarityFromTags([
        { category: 'Rarity', internal_name: 'Rarity_Custom', localized_tag_name: 'Custom', color: 'abcdef' },
      ]);
      assert(
        'rarity_parser',
        '3.3 Normalizes tag hex color both with and without leading #',
        withLeadingHash.rarityColor === '#123456' && withoutLeadingHash.rarityColor === '#abcdef',
        0,
        `with: ${withLeadingHash.rarityColor}, without: ${withoutLeadingHash.rarityColor}`
      );
    }

    // 3.4 Tag array edge cases: undefined, null, empty array, non-array
    {
      const rUndefined = getRarityFromTags(undefined);
      const rNull = getRarityFromTags(null as any);
      const rEmpty = getRarityFromTags([]);
      const rString = getRarityFromTags('invalid' as any);
      assert(
        'rarity_parser',
        '3.4 Handles undefined, null, empty array, and non-array safely (defaults to Base Grade)',
        rUndefined.rarity === 'Base Grade' &&
        rNull.rarity === 'Base Grade' &&
        rEmpty.rarity === 'Base Grade' &&
        rString.rarity === 'Base Grade',
        0
      );
    }

    // 3.5 Rarity identified by internal_name prefix when category is absent
    {
      const parsed = getRarityFromTags([
        { category: '', internal_name: 'Rarity_Covert_Weapon', localized_tag_name: 'Covert' },
      ]);
      assert(
        'rarity_parser',
        '3.5 Identifies rarity via internal_name "Rarity_" prefix even if category is empty',
        parsed.rarity === 'Covert' && parsed.rarityColor === '#eb4b4b',
        0,
        `Got rarity=${parsed.rarity}`
      );
    }
  }

  // =========================================================================
  // SECTION 4: In-Memory LRU Cache Limits, Key Isolation & Zero-Latency Hits
  // =========================================================================
  console.log('\n=== SECTION 4: In-Memory LRU Cache Bounds & Zero-Latency Hits ===');
  {
    // 4.1 Capacity bound enforcement under extreme load (5,000 items into 100 capacity)
    {
      const tStart = performance.now();
      const cap = 100;
      const testCache = new LRUCache<string, string>(cap);
      for (let i = 0; i < 5000; i++) {
        testCache.set(`key-${i}`, `val-${i}`);
      }
      assert(
        'lru_cache',
        '4.1 Strict capacity maintenance under 5,000 writes (size === 100)',
        testCache.size() === cap,
        performance.now() - tStart,
        `Final size: ${testCache.size()}`
      );
    }

    // 4.2 LRU Eviction order & MRU preservation
    {
      const testCache = new LRUCache<string, number>(3);
      testCache.set('item-1', 1);
      testCache.set('item-2', 2);
      testCache.set('item-3', 3);

      // Access item-1 (makes it MRU: 2, 3, 1)
      testCache.get('item-1');

      // Add item-4 (should evict item-2, since item-2 is now LRU)
      testCache.set('item-4', 4);

      const has1 = testCache.has('item-1');
      const has2 = testCache.has('item-2');
      const has3 = testCache.has('item-3');
      const has4 = testCache.has('item-4');

      assert(
        'lru_cache',
        '4.2 Access refresh preserves accessed item and evicts least recently used',
        has1 && !has2 && has3 && has4,
        0,
        `has1=${has1}, has2=${has2}, has3=${has3}, has4=${has4}`
      );
    }

    // 4.3 Key isolation & Prototype Pollution immunity
    {
      const testCache = new LRUCache<string, any>(10);
      const evilKeys = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];
      for (const k of evilKeys) {
        testCache.set(k, { polluted: true });
      }

      // Check Object prototype is completely unpolluted
      const rawObj: any = {};
      const prototypeUntouched = rawObj.polluted === undefined && typeof ({}).toString === 'function';

      // Check cache returns stored values properly for each key
      let keysIsolated = true;
      for (const k of evilKeys) {
        if (!testCache.has(k) || testCache.get(k)?.polluted !== true) {
          keysIsolated = false;
        }
      }

      assert(
        'lru_cache',
        '4.3 Key isolation and prototype pollution resistance (__proto__, constructor, etc.)',
        prototypeUntouched && keysIsolated,
        0,
        `prototypeUntouched=${prototypeUntouched}, keysIsolated=${keysIsolated}`
      );
    }

    // 4.4 Zero-latency hits (< 0.1ms per lookup on pre-seeded global cache)
    {
      // Verify global inventoryLRUCache has pre-seeded items
      const preSeededAssetId = '53025617652'; // AK-47 Ice Coaled
      const tStartLookup = performance.now();
      const lookupsCount = 1000;
      let allMatch = true;

      for (let i = 0; i < lookupsCount; i++) {
        const entry = inventoryLRUCache.get(preSeededAssetId);
        if (!entry || entry.seed !== 367) {
          allMatch = false;
          break;
        }
      }

      const totalLookupDuration = performance.now() - tStartLookup;
      const avgDurationPerLookupMs = totalLookupDuration / lookupsCount;

      assert(
        'lru_cache',
        `4.4 Zero-latency hits: 1,000 lookups completed in ${totalLookupDuration.toFixed(2)}ms (avg ${avgDurationPerLookupMs.toFixed(4)}ms/op < 0.05ms)`,
        allMatch && avgDurationPerLookupMs < 0.05,
        totalLookupDuration,
        `avg duration per lookup: ${avgDurationPerLookupMs.toFixed(5)}ms`
      );
    }

    // 4.5 Cache TTL expiration
    {
      const tStart = performance.now();
      const ttlCache = new LRUCache<string, string>(5, 15); // 15ms TTL
      ttlCache.set('tempKey', 'tempVal');
      const immediateGet = ttlCache.get('tempKey');

      await new Promise((resolve) => setTimeout(resolve, 30));
      const expiredGet = ttlCache.get('tempKey');

      assert(
        'lru_cache',
        '4.5 TTL expiration: value returned before expiry, undefined after expiry',
        immediateGet === 'tempVal' && expiredGet === undefined,
        performance.now() - tStart,
        `immediate=${immediateGet}, expired=${expiredGet}`
      );
    }
  }

  // =========================================================================
  // SECTION 5: HTTP 429 Rate Limiting Resilience & Fallback Fidelity
  // =========================================================================
  console.log('\n=== SECTION 5: HTTP 429 Resilience & Fallback Inventory Fidelity ===');
  {
    const originalFetch = globalThis.fetch;

    // 5.1 Steam API HTTP 429 Rate Limiting returns authentic fallback inventory
    {
      const tStart = performance.now();
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      assert(
        'resilience_fallback',
        '5.1 Steam Community HTTP 429 yields authentic 26+ item fallback without throwing',
        items.length >= 26 && items[1].name.includes('AK-47 | Ice Coaled'),
        performance.now() - tStart,
        `Returned ${items.length} items`
      );
    }

    // 5.2 Steam API Private Profile (HTTP 401 & 403)
    {
      for (const status of [401, 403]) {
        const tStart = performance.now();
        globalThis.fetch = (async () => {
          return new Response(JSON.stringify({ error: 'Private profile' }), { status });
        }) as typeof fetch;

        const items = await fetchCS2Inventory('76561198920486334');
        assert(
          'resilience_fallback',
          `5.2 HTTP ${status} private profile returns authentic fallback inventory cleanly`,
          items.length >= 26,
          performance.now() - tStart,
          `Returned ${items.length} items`
        );
      }
    }

    // 5.3 Steam API 5xx Server Errors (500, 502, 503, 504)
    {
      for (const status of [500, 502, 503, 504]) {
        const tStart = performance.now();
        globalThis.fetch = (async () => {
          return new Response('<html>5xx Server Error</html>', { status });
        }) as typeof fetch;

        const items = await fetchCS2Inventory('76561198920486334');
        assert(
          'resilience_fallback',
          `5.3 HTTP ${status} server error returns authentic fallback inventory`,
          items.length >= 26,
          performance.now() - tStart,
          `Returned ${items.length} items`
        );
      }
    }

    // 5.4 Network Rejection / Timeout
    {
      const tStart = performance.now();
      globalThis.fetch = (async () => {
        throw new TypeError('Failed to fetch: Connection refused (ECONNREFUSED)');
      }) as typeof fetch;

      const items = await fetchCS2Inventory('76561198920486334');
      assert(
        'resilience_fallback',
        '5.4 Network fetch rejection (ECONNREFUSED) returns fallback inventory gracefully',
        items.length >= 26,
        performance.now() - tStart,
        `Returned ${items.length} items`
      );
    }

    // 5.5 Invalid Steam ID formatting bypasses fetch and returns fallback directly
    {
      let fetchCalled = false;
      globalThis.fetch = (async () => {
        fetchCalled = true;
        return new Response('{}', { status: 200 });
      }) as typeof fetch;

      const items = await fetchCS2Inventory('invalid-alphanumeric-steamid');
      assert(
        'resilience_fallback',
        '5.5 Invalid SteamID string immediately returns fallback inventory without network call',
        !fetchCalled && items.length >= 26,
        0,
        `fetchCalled=${fetchCalled}, items=${items.length}`
      );
    }

    // 5.6 CSFloat HTTP 429 rate limit during enrichWithCSFloat returns item with null float
    {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ error: 'Too Many Requests' }), { status: 429 });
      }) as typeof fetch;

      const testItem: EnrichedInventoryItem = {
        id: 'new-unseen-asset-429',
        name: 'Glock-18 | Water Elemental',
        iconUrl: 'http://cdn/glock',
        inspectUrl: 'steam://rungame/730/test-429',
        float: null,
        seed: null,
        rarity: 'Classified',
        type: 'Pistol',
      };

      const enriched = await enrichWithCSFloat(testItem);
      assert(
        'resilience_fallback',
        '5.6 CSFloat HTTP 429 yields item with float: null and seed: null without crashing',
        enriched.float === null && enriched.seed === null,
        0,
        `float=${enriched.float}, seed=${enriched.seed}`
      );
    }

    // 5.7 SSR API endpoint /api/inventory.json returns HTTP 200 with fallback under error
    {
      globalThis.fetch = (async () => {
        return new Response('Steam Down', { status: 503 });
      }) as typeof fetch;

      const mockContext = {
        request: new Request('https://links.huh4k.dev/api/inventory.json?steamid=76561198920486334'),
        locals: {},
        params: {},
      } as any;

      const res = await inventoryApiHandler(mockContext);
      const data = (await res.json()) as EnrichedInventoryItem[];
      assert(
        'resilience_fallback',
        '5.7 SSR API handler (/api/inventory.json) returns HTTP 200 and 26+ items even when Steam returns 503',
        res.status === 200 && data.length >= 26,
        0,
        `status=${res.status}, items count=${data.length}`
      );
    }

    // Restore fetch
    globalThis.fetch = originalFetch;
  }

  // =========================================================================
  // SECTION 6: Taxonomy Categorization Logic across all 6 Filter Groups
  // =========================================================================
  console.log('\n=== SECTION 6: Taxonomy Categorization Logic in InventoryExplorer ===');
  {
    // 6.1 Check CATEGORIES array has exact 6 filter groups
    assert(
      'taxonomy_categorization',
      '6.1 CATEGORIES contains exactly 6 filter groups: All, Rifles, Pistols, Snipers, SMGs & Heavy, Collectibles',
      CATEGORIES.length === 6 &&
      CATEGORIES[0] === 'All' &&
      CATEGORIES[1] === 'Rifles' &&
      CATEGORIES[2] === 'Pistols' &&
      CATEGORIES[3] === 'Snipers' &&
      CATEGORIES[4] === 'SMGs & Heavy' &&
      CATEGORIES[5] === 'Collectibles',
      0,
      `Categories: ${CATEGORIES.join(', ')}`
    );

    // 6.2 Filter Group 'All': Matches 100% of items in FALLBACK_INVENTORY
    {
      const allMatches = FALLBACK_INVENTORY.every((item) => matchesCategory(item, 'All'));
      assert(
        'taxonomy_categorization',
        '6.2 Filter Group "All" matches 100% of inventory items (27/27)',
        allMatches,
        0,
        `Matched all: ${allMatches}`
      );
    }

    // 6.3 Filter Group 'Rifles': Matches AK-47, M4A1-S, Galil AR, and excludes other weapons
    {
      const rifleMatches = FALLBACK_INVENTORY.filter((item) => matchesCategory(item, 'Rifles'));
      const hasAk = rifleMatches.some((i) => i.name.includes('AK-47'));
      const hasM4 = rifleMatches.some((i) => i.name.includes('M4A1-S'));
      const hasGalil = rifleMatches.some((i) => i.name.includes('Galil AR'));
      const hasNoPistol = !rifleMatches.some((i) => i.type === 'Pistol');
      const hasNoSniper = !rifleMatches.some((i) => i.type === 'Sniper Rifle');
      const hasNoKnife = !rifleMatches.some((i) => i.type === 'Knife');
      assert(
        'taxonomy_categorization',
        '6.3 Filter Group "Rifles" matches AK-47, M4A1-S, Galil AR and excludes Pistols/Snipers/Knives',
        hasAk && hasM4 && hasGalil && hasNoPistol && hasNoSniper && hasNoKnife,
        0,
        `Rifles matched: ${rifleMatches.length}`
      );
    }

    // 6.4 Filter Group 'Pistols': Matches USP-S, Glock-18, Desert Eagle, CZ75-Auto and excludes others
    {
      const pistolMatches = FALLBACK_INVENTORY.filter((item) => matchesCategory(item, 'Pistols'));
      const hasUsp = pistolMatches.some((i) => i.name.includes('USP-S'));
      const hasGlock = pistolMatches.some((i) => i.name.includes('Glock-18'));
      const hasDeagle = pistolMatches.some((i) => i.name.includes('Desert Eagle'));
      const hasCz = pistolMatches.some((i) => i.name.includes('CZ75-Auto'));
      const hasNoRifle = !pistolMatches.some((i) => i.type === 'Rifle');
      const hasNoSmg = !pistolMatches.some((i) => i.type === 'SMG');
      assert(
        'taxonomy_categorization',
        '6.4 Filter Group "Pistols" matches USP-S, Glock-18, Desert Eagle, CZ75-Auto',
        hasUsp && hasGlock && hasDeagle && hasCz && hasNoRifle && hasNoSmg,
        0,
        `Pistols matched: ${pistolMatches.length}`
      );
    }

    // 6.5 Filter Group 'Snipers': Matches AWP, SSG 08 and excludes others
    {
      const sniperMatches = FALLBACK_INVENTORY.filter((item) => matchesCategory(item, 'Snipers'));
      const hasAwp = sniperMatches.some((i) => i.name.includes('AWP'));
      const hasSsg = sniperMatches.some((i) => i.name.includes('SSG 08'));
      const hasNoAk = !sniperMatches.some((i) => i.name.includes('AK-47'));
      const hasNoPistol = !sniperMatches.some((i) => i.type === 'Pistol');
      assert(
        'taxonomy_categorization',
        '6.5 Filter Group "Snipers" matches AWP and SSG 08 and excludes Rifles/Pistols',
        hasAwp && hasSsg && hasNoAk && hasNoPistol,
        0,
        `Snipers matched: ${sniperMatches.length}`
      );
    }

    // 6.6 Filter Group 'SMGs & Heavy': Matches UMP-45, MAC-10, MAG-7, Zeus x27
    {
      const smgMatches = FALLBACK_INVENTORY.filter((item) => matchesCategory(item, 'SMGs & Heavy'));
      const hasUmp = smgMatches.some((i) => i.name.includes('UMP-45'));
      const hasMac = smgMatches.some((i) => i.name.includes('MAC-10'));
      const hasMag = smgMatches.some((i) => i.name.includes('MAG-7'));
      const hasZeus = smgMatches.some((i) => i.name.includes('Zeus x27'));
      const hasNoRifle = !smgMatches.some((i) => i.name.includes('AK-47'));
      assert(
        'taxonomy_categorization',
        '6.6 Filter Group "SMGs & Heavy" matches UMP-45, MAC-10, MAG-7, Zeus x27',
        hasUmp && hasMac && hasMag && hasZeus && hasNoRifle,
        0,
        `SMGs & Heavy matched: ${smgMatches.length}`
      );
    }

    // 6.7 Filter Group 'Collectibles': Matches Medals, Coins, Badges, Graffiti, Music Kit, Detachment Pack
    {
      const collectibleMatches = FALLBACK_INVENTORY.filter((item) => matchesCategory(item, 'Collectibles'));
      const hasMedal2026 = collectibleMatches.some((i) => i.name.includes('2026 Service Medal'));
      const hasMedal2025 = collectibleMatches.some((i) => i.name.includes('2025 Service Medal'));
      const hasCoin5Year = collectibleMatches.some((i) => i.name.includes('5 Year Veteran Coin'));
      const hasPremier = collectibleMatches.some((i) => i.name.includes('Premier Season'));
      const hasMusic = collectibleMatches.some((i) => i.name.includes('Music Kit'));
      const hasGraffiti = collectibleMatches.some((i) => i.name.includes('Graffiti'));
      const hasCharmPack = collectibleMatches.some((i) => i.name.includes('Charm Detachment Pack'));
      const hasNoWeapon = !collectibleMatches.some((i) => i.type === 'Rifle' || i.type === 'Sniper Rifle');
      assert(
        'taxonomy_categorization',
        '6.7 Filter Group "Collectibles" matches Medals, Coins, Badges, Graffiti, Music Kits, Tools',
        hasMedal2026 && hasMedal2025 && hasCoin5Year && hasPremier && hasMusic && hasGraffiti && hasCharmPack && hasNoWeapon,
        0,
        `Collectibles matched: ${collectibleMatches.length}`
      );
    }

    // 6.8 Search function matchesSearch tests: by name, pattern seed, float substring, cert, rarity
    {
      const akItem = FALLBACK_INVENTORY.find((i) => i.name.includes('AK-47 | Ice Coaled'))!;
      const matchByName = matchesSearch(akItem, 'ice coaled');
      const matchBySeed = matchesSearch(akItem, '367');
      const matchByFloat = matchesSearch(akItem, '0.0825');
      const matchByRarity = matchesSearch(akItem, 'classified');
      const matchByCert = matchesSearch(akItem, '5545A1B8');
      const emptySearchMatches = matchesSearch(akItem, '   ');
      const nonMatch = matchesSearch(akItem, 'nonexistent_term_xyz');

      assert(
        'taxonomy_categorization',
        '6.8 matchesSearch accurately filters by skin name, seed, float, rarity, cert, and handles empty query',
        matchByName && matchBySeed && matchByFloat && matchByRarity && matchByCert && emptySearchMatches && !nonMatch,
        0
      );
    }

    // 6.9 Wear tier classifier getWearTier accuracy across all standard CS2 float boundaries
    {
      const fnLow = getWearTier(0.0001);
      const fnBoundary = getWearTier(0.0699);
      const mwBoundary = getWearTier(0.0700);
      const mwMid = getWearTier(0.1499);
      const ftBoundary = getWearTier(0.1500);
      const ftMid = getWearTier(0.3799);
      const wwBoundary = getWearTier(0.3800);
      const wwMid = getWearTier(0.4499);
      const bsBoundary = getWearTier(0.4500);
      const bsMax = getWearTier(0.9999);
      const nullTier = getWearTier(null);
      const nanTier = getWearTier(NaN);

      const wearTiersCorrect = Boolean(
        fnLow?.tag === 'FN' &&
        fnBoundary?.tag === 'FN' &&
        mwBoundary?.tag === 'MW' &&
        mwMid?.tag === 'MW' &&
        ftBoundary?.tag === 'FT' &&
        ftMid?.tag === 'FT' &&
        wwBoundary?.tag === 'WW' &&
        wwMid?.tag === 'WW' &&
        bsBoundary?.tag === 'BS' &&
        bsMax?.tag === 'BS' &&
        nullTier === null &&
        nanTier === null
      );

      assert(
        'taxonomy_categorization',
        '6.9 getWearTier classifies FN, MW, FT, WW, BS across exact boundaries (<0.07, <0.15, <0.38, <0.45, >=0.45)',
        wearTiersCorrect,
        0,
        `FN=${fnLow?.tag}, MW=${mwBoundary?.tag}, FT=${ftBoundary?.tag}, WW=${wwBoundary?.tag}, BS=${bsBoundary?.tag}`
      );
    }
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  const totalDuration = performance.now() - suiteStartTime;
  console.log('\n======================================================================');
  console.log(`CHALLENGER 1 STRESS HARNESS COMPLETE in ${totalDuration.toFixed(1)}ms`);
  console.log(`TOTAL ASSERTIONS: ${assertions.length}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log(`SUCCESS RATE: ${((passCount / assertions.length) * 100).toFixed(1)}%`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runChallengerHarness().catch((err) => {
  console.error('Fatal crash in Challenger 1 test harness:', err);
  process.exit(1);
});
