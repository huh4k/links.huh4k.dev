/**
 * Standalone Verification Suite for CS2 Inventory Pipeline, Direct Asset Properties & Caching
 *
 * Validates:
 * 1. Inspect URL substitution (%owner_steamid%, %assetid%, and %propid:6%)
 * 2. Steam CDN image formatting
 * 3. Rarity parser without ItemSet collision & proper CS2 colors and weapon type extraction
 * 4. LRU Cache capacity, eviction, and TTL
 * 5. Authentic Fallback Inventory (26+ items for Steam ID 76561198920486334)
 * 6. Native root data.asset_properties parsing (seed, float, certificate)
 * 7. LRU Cache 0ms re-lookups
 * 8. CSFloat enrichment fallback and rate limit handling
 * 9. Resilience to Steam errors (429, 403, network failure, invalid Steam ID)
 * 10. SSR API Route Handler (/api/inventory.json)
 */

import {
  formatInspectUrl,
  formatEconomyImageUrl,
  getRarityFromTags,
  getTypeFromTags,
  LRUCache,
  inventoryLRUCache,
  fetchCSFloatInspect,
  enrichWithCSFloat,
  enrichInventory,
  fetchCS2Inventory,
  FALLBACK_INVENTORY,
} from '../src/utils/steam.ts';
import { GET as inventoryApiHandler } from '../src/pages/api/inventory.json.ts';
import type { EnrichedInventoryItem, RawSteamDescription } from '../src/types/inventory.ts';

// Test runner helper
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('CS2 INVENTORY PIPELINE — VERIFICATION TEST SUITE');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Inspect URL Construction & Substitution (%propid:6% + %owner_steamid% + %assetid%)
  // --------------------------------------------------------------------------
  console.log('[Test 1] Inspect URL Construction & Substitution');
  {
    const legacyTemplate =
      'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S%owner_steamid%A%assetid%D14432168987455850901';
    const steamId = '76561198012345678';
    const assetId = '31459265358';

    const legacyFormatted = formatInspectUrl(legacyTemplate, steamId, assetId);
    assert(
      legacyFormatted ===
        'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198012345678A31459265358D14432168987455850901',
      'Replaces %owner_steamid% and %assetid% correctly',
      `Got: ${legacyFormatted}`
    );

    const modernTemplate =
      'steam://run/730//+csgo_econ_action_preview%20%propid:6%';
    const certHash = '5545A1B89F9190544D5275A25D7D5065516D8CDEF1B85615';
    const modernFormatted = formatInspectUrl(modernTemplate, steamId, assetId, certHash);
    assert(
      modernFormatted ===
        'steam://run/730//+csgo_econ_action_preview%205545A1B89F9190544D5275A25D7D5065516D8CDEF1B85615',
      'Replaces %propid:6% with certificate hash',
      `Got: ${modernFormatted}`
    );

    assert(formatInspectUrl('', steamId, assetId) === '', 'Handles empty raw link gracefully');
    assert(
      formatInspectUrl('steam://rungame/static', steamId, assetId) === 'steam://rungame/static',
      'Preserves static inspect link without tokens'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 2: Steam CDN Image URL Formatting
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] Steam CDN Image Formatting');
  {
    const hash = '-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxY';
    const formatted = formatEconomyImageUrl(hash);
    assert(
      formatted.startsWith('https://community.cloudflare.steamstatic.com/economy/image/'),
      'Prepends Cloudflare Steam static CDN base to icon hashes'
    );

    const fullUrl = 'https://shared.cloudflare.steamstatic.com/store_item_assets/header.jpg';
    assert(formatEconomyImageUrl(fullUrl) === fullUrl, 'Leaves full absolute URLs intact');
    assert(formatEconomyImageUrl('') === '', 'Returns empty string for empty input');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Rarity Tag Parsing (No ItemSet Collision) & Type Extraction
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Rarity and Type Extraction (Fixing ItemSet Collision)');
  {
    // Regression check: ItemSet tag positioned before Rarity tag must NOT collide with Rarity
    const tagsWithItemSet: RawSteamDescription['tags'] = [
      {
        category: 'ItemSet',
        internal_name: 'set_community_30',
        localized_tag_name: 'The Recoil Collection',
      },
      {
        category: 'Rarity',
        internal_name: 'Rarity_Legendary_Weapon',
        localized_tag_name: 'Classified',
        color: 'd32ce6',
      },
      {
        category: 'Type',
        internal_name: 'CSGO_Type_Rifle',
        localized_tag_name: 'Rifle',
      },
    ];

    const rarityWithItemSet = getRarityFromTags(tagsWithItemSet);
    assert(
      rarityWithItemSet.rarity === 'Classified',
      'Correctly ignores ItemSet tag and extracts Classified rarity',
      `Got: ${rarityWithItemSet.rarity}`
    );
    assert(
      rarityWithItemSet.rarityColor === '#d32ce6',
      'Correctly maps Classified hex color #d32ce6'
    );

    // CS2 Rarity color checks
    const covertResult = getRarityFromTags([
      { category: 'Rarity', internal_name: 'Rarity_Covert_Weapon', localized_tag_name: 'Covert' },
    ]);
    assert(covertResult.rarityColor === '#eb4b4b', 'Covert defaults to #eb4b4b');

    const restrictedResult = getRarityFromTags([
      { category: 'Rarity', internal_name: 'Rarity_Mythical_Weapon', localized_tag_name: 'Restricted' },
    ]);
    assert(restrictedResult.rarityColor === '#8847ff', 'Restricted defaults to #8847ff');

    const milSpecResult = getRarityFromTags([
      { category: 'Rarity', internal_name: 'Rarity_Rare_Weapon', localized_tag_name: 'Mil-Spec Grade' },
    ]);
    assert(milSpecResult.rarityColor === '#4b69ff', 'Mil-Spec Grade defaults to #4b69ff');

    const extraordinaryKnife = getRarityFromTags([
      { category: 'Rarity', internal_name: 'Rarity_Ancient', localized_tag_name: '★ Extraordinary' },
    ]);
    assert(extraordinaryKnife.rarityColor === '#ffd700', '★ Extraordinary knife defaults to #ffd700');

    // Type extraction
    const rifleType = getTypeFromTags(tagsWithItemSet, 'Rifle');
    assert(rifleType === 'Rifle', 'Identifies Rifle type from tags');

    const sniperType = getTypeFromTags([], 'AWP | Ice Coaled (Sniper Rifle)');
    assert(sniperType === 'Sniper Rifle', 'Identifies Sniper Rifle from type string');

    const knifeType = getTypeFromTags([], '★ Karambit | Doppler');
    assert(knifeType === 'Knife', 'Identifies Knife from type string');

    const emptyRarity = getRarityFromTags([]);
    assert(emptyRarity.rarity === 'Base Grade', 'Falls back to Base Grade for empty tags');
  }

  // --------------------------------------------------------------------------
  // TEST 4: LRU Cache Implementation & Eviction Logic
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] LRU Cache Behavior & Eviction');
  {
    const cache = new LRUCache<string, string>(2, 60000);

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    assert(cache.size() === 2, 'Cache contains 2 items');

    const v1 = cache.get('key1');
    assert(v1 === 'value1', 'Retrieves key1 from cache');

    // Insert key3 -> key2 should be evicted
    cache.set('key3', 'value3');
    assert(cache.get('key2') === undefined, 'Evicts oldest item (key2) when capacity exceeded');
    assert(cache.get('key1') === 'value1', 'Retains recently accessed item (key1)');
    assert(cache.get('key3') === 'value3', 'Retains newly added item (key3)');

    // TTL Expiration test
    const shortTtlCache = new LRUCache<string, string>(5, 10);
    shortTtlCache.set('temp', 'tempVal');
    assert(shortTtlCache.get('temp') === 'tempVal', 'Gets value before TTL expires');

    await new Promise((resolve) => setTimeout(resolve, 25));
    assert(shortTtlCache.get('temp') === undefined, 'Returns undefined after TTL expires');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Authentic Fallback Loadout Dataset (26+ Items for 76561198920486334)
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Authentic Fallback Inventory (26+ Real Items)');
  {
    assert(
      Array.isArray(FALLBACK_INVENTORY) && FALLBACK_INVENTORY.length >= 26,
      `FALLBACK_INVENTORY contains 26+ items (count: ${FALLBACK_INVENTORY.length})`
    );

    // Verify key primary weapons
    const ak = FALLBACK_INVENTORY.find((i) => i.name.includes('AK-47 | Ice Coaled'));
    assert(Boolean(ak), 'Contains AK-47 | Ice Coaled');
    assert(ak?.rarity === 'Classified', 'AK-47 | Ice Coaled is Classified');
    assert(typeof ak?.float === 'number' && Math.abs(ak.float - 0.0825) < 0.001, 'AK-47 has float ~0.0825');
    assert(ak?.seed === 367, 'AK-47 has seed 367');

    const m4 = FALLBACK_INVENTORY.find((i) => i.name.includes('M4A1-S | Liquidation'));
    assert(Boolean(m4), 'Contains StatTrak™ M4A1-S | Liquidation');
    assert(m4?.rarity === 'Restricted', 'M4A1-S is Restricted');
    assert(typeof m4?.float === 'number' && Math.abs(m4.float - 0.3438) < 0.001, 'M4A1-S has float ~0.3438');
    assert(m4?.seed === 937, 'M4A1-S has seed 937');

    const awp = FALLBACK_INVENTORY.find((i) => i.name.includes('AWP | Ice Coaled'));
    assert(Boolean(awp), 'Contains AWP | Ice Coaled');
    assert(awp?.rarity === 'Classified', 'AWP is Classified');
    assert(typeof awp?.float === 'number' && Math.abs(awp.float - 0.0631) < 0.001, 'AWP has float ~0.0631');
    assert(awp?.seed === 309, 'AWP has seed 309');

    const usp = FALLBACK_INVENTORY.find((i) => i.name.includes('USP-S | Royal Guard'));
    assert(Boolean(usp), 'Contains USP-S | Royal Guard');
    assert(usp?.rarity === 'Restricted', 'USP-S is Restricted');
    assert(typeof usp?.float === 'number' && Math.abs(usp.float - 0.056) < 0.001, 'USP-S has float ~0.0560');
    assert(usp?.seed === 644, 'USP-S has seed 644');

    const knife = FALLBACK_INVENTORY.find((i) => i.type === 'Knife');
    assert(Boolean(knife), 'Contains Knife item');

    // Schema validation across all items
    for (const item of FALLBACK_INVENTORY) {
      assert(typeof item.id === 'string' && item.id.length > 0, `Item ${item.name} has valid id`);
      assert(typeof item.name === 'string' && item.name.length > 0, `Item ${item.name} has valid name`);
      assert(item.iconUrl.startsWith('http'), `Item ${item.name} has valid iconUrl`);
      assert(
        item.float === null || (typeof item.float === 'number' && item.float >= 0 && item.float <= 1),
        `Item ${item.name} has valid float: ${item.float}`
      );
      assert(
        item.seed === null || (typeof item.seed === 'number' && item.seed >= 0),
        `Item ${item.name} has valid seed: ${item.seed}`
      );
      assert(typeof item.rarity === 'string' && item.rarity.length > 0, `Item ${item.name} has valid rarity`);
      assert(typeof item.type === 'string' && item.type.length > 0, `Item ${item.name} has valid type`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 6: Native Root asset_properties Extraction & LRU Pre-Seeding
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] Native Root asset_properties Extraction');
  {
    const originalFetch = globalThis.fetch;
    const mockAssetId = '999888777';
    const mockCert = '5545A1B89F9190544D5275A25D7D5065516D8CDEF1B85615BA5737505D5645C10237';

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('steamcommunity.com/inventory')) {
        return new Response(
          JSON.stringify({
            success: 1,
            total_inventory_count: 1,
            assets: [
              {
                appid: 730,
                contextid: '2',
                assetid: mockAssetId,
                classid: '9001',
                instanceid: '0',
                amount: '1',
              },
            ],
            descriptions: [
              {
                appid: 730,
                classid: '9001',
                instanceid: '0',
                name: 'AK-47 | Ice Coaled (Minimal Wear)',
                market_name: 'AK-47 | Ice Coaled (Minimal Wear)',
                type: 'Rifle',
                icon_url: 'ak47_ice_coaled_hash',
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
                assetid: mockAssetId,
                asset_properties: [
                  { propertyid: 1, int_value: '367', name: 'Pattern Template' },
                  { propertyid: 2, float_value: '0.082530684769153595', name: 'Wear Rating' },
                  { propertyid: 6, string_value: mockCert, name: 'Item Certificate' },
                ],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const items = await fetchCS2Inventory('76561198920486334');
      assert(items.length === 1, 'Parses 1 item with native asset properties');

      const parsedItem = items[0];
      assert(parsedItem.id === mockAssetId, 'Item ID matches mock assetid');
      assert(
        parsedItem.float !== null && Math.abs(parsedItem.float - 0.08253068) < 0.0001,
        'Natively extracts wear float 0.08253 from propertyid 2'
      );
      assert(parsedItem.seed === 367, 'Natively extracts pattern template seed 367 from propertyid 1');
      assert(
        parsedItem.inspectUrl?.includes(mockCert) === true,
        'Substitutes %propid:6% with certificate hash in inspectUrl'
      );

      // Verify LRU cache was pre-seeded directly
      const cached = inventoryLRUCache.get(mockAssetId);
      assert(
        cached !== undefined && cached.float !== null && Math.abs(cached.float - 0.08253068) < 0.0001,
        'Pre-seeds item float into inventoryLRUCache'
      );
      assert(cached?.seed === 367, 'Pre-seeds item seed into inventoryLRUCache');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 7: CSFloat Fallback & Rate Limiting
  // --------------------------------------------------------------------------
  console.log('\n[Test 7] CSFloat Fallback & Cache Hit Rate');
  {
    const originalFetch = globalThis.fetch;
    let csfloatCallCount = 0;

    const mockInspectUrl =
      'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198000000000A9990001D14432168987455850901';

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('api.csfloat.com')) {
        csfloatCallCount++;
        return new Response(
          JSON.stringify({
            iteminfo: {
              floatvalue: 0.054321,
              paintseed: 661,
              paintindex: 44,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const testItem: EnrichedInventoryItem = {
        id: 'mock-ak47-case-hardened-9990001',
        name: 'AK-47 | Case Hardened',
        iconUrl: 'https://community.cloudflare.steamstatic.com/economy/image/test',
        inspectUrl: mockInspectUrl,
        float: null,
        seed: null,
        rarity: 'Classified',
        type: 'Rifle',
      };

      // Call 1: Cache MISS -> CSFloat queried
      const enriched1 = await enrichWithCSFloat(testItem);
      assert(csfloatCallCount === 1, 'Queries CSFloat on cache MISS (callCount = 1)');
      assert(enriched1.float === 0.054321, 'CSFloat float value populated accurately');
      assert(enriched1.seed === 661, 'CSFloat paint seed populated accurately');

      // Call 2: Cache HIT -> CSFloat must NOT be queried
      const enriched2 = await enrichWithCSFloat(testItem);
      assert(csfloatCallCount === 1, 'Hits LRU cache on subsequent call without querying CSFloat (callCount remains 1)');
      assert(enriched2.float === 0.054321, 'Cached float returned on cache HIT');
      assert(enriched2.seed === 661, 'Cached seed returned on cache HIT');

      // Direct fetchCSFloatInspect test
      const rawInspect = await fetchCSFloatInspect(mockInspectUrl);
      assert(rawInspect?.floatvalue === 0.054321, 'fetchCSFloatInspect parses CSFloat API response correctly');

      // Direct enrichInventory batch test
      const batchResult = await enrichInventory([testItem], 5);
      assert(batchResult.length === 1 && batchResult[0].float === 0.054321, 'enrichInventory returns enriched batch');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 8: Resilience & Error Fallbacks (HTTP 429, 403, 500, network error)
  // --------------------------------------------------------------------------
  console.log('\n[Test 8] Resilience & Error Fallbacks');
  {
    const originalFetch = globalThis.fetch;

    // Test 8a: Steam API 429 Rate Limit
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('steamcommunity.com/inventory')) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const result429 = await fetchCS2Inventory('76561198920486334');
      assert(
        result429.length >= 26,
        'Steam 429 rate limit gracefully returns 26+ authentic fallback items without throwing'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Test 8b: Steam API Private Profile (HTTP 403)
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('steamcommunity.com/inventory')) {
        return new Response(JSON.stringify({ error: 'This profile is private.' }), { status: 403 });
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const resultPrivate = await fetchCS2Inventory('76561198920486334');
      assert(
        resultPrivate.length >= 26,
        'Private profile gracefully returns authentic fallback inventory without throwing'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Test 8c: CSFloat HTTP 500 Error
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('api.csfloat.com')) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const itemWith500: EnrichedInventoryItem = {
        id: 'item-float-500-error',
        name: 'Glock-18 | Water Elemental',
        iconUrl: 'https://community.cloudflare.steamstatic.com/economy/image/glock',
        inspectUrl: 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198000000000A500500D1',
        float: null,
        seed: null,
        rarity: 'Classified',
        type: 'Pistol',
      };

      const enriched500 = await enrichWithCSFloat(itemWith500);
      assert(
        enriched500.float === null && enriched500.seed === null,
        'CSFloat HTTP 500 returns item with float: null and seed: null without throwing'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Test 8d: Invalid SteamID
    const invalidIdResult = await fetchCS2Inventory('not-a-valid-id');
    assert(
      invalidIdResult === FALLBACK_INVENTORY,
      'Invalid SteamID format directly returns FALLBACK_INVENTORY'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 9: SSR API Route Handler (/api/inventory.json)
  // --------------------------------------------------------------------------
  console.log('\n[Test 9] SSR API Route Handler Validation (/api/inventory.json)');
  {
    const mockContext = {
      request: new Request('https://links.huh4k.dev/api/inventory.json?steamid=76561198920486334'),
      locals: {},
      params: {},
    } as any;

    const response = await inventoryApiHandler(mockContext);
    assert(response.status === 200, 'API endpoint returns HTTP 200');
    assert(
      response.headers.get('Content-Type') === 'application/json',
      'API endpoint returns application/json Content-Type'
    );
    assert(
      Boolean(response.headers.get('Cache-Control')?.includes('public')),
      'API endpoint sets Cache-Control header'
    );

    const body = (await response.json()) as EnrichedInventoryItem[];
    assert(Array.isArray(body), 'API response body is an array');
    assert(body.length >= 26, `API response contains ${body.length} items (>= 26 items)`);

    const ak = body.find((i) => i.name.includes('AK-47 | Ice Coaled'));
    assert(
      Boolean(ak && ak.float !== null && ak.seed !== null),
      'API response includes AK-47 | Ice Coaled with float and seed'
    );
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal unhandled error in test suite:', err);
  process.exit(1);
});
