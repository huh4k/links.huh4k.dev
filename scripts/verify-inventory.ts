/**
 * Standalone Verification Suite for CS2 Inventory Pipeline & CSFloat Enrichment
 *
 * Validates:
 * 1. Schema Validation for Raw Steam & Enriched Items
 * 2. Inspect URL substitution (%owner_steamid% and %assetid%)
 * 3. LRU Cache behavior and eviction
 * 4. CSFloat inspect enrichment and caching (hit rate verification)
 * 5. Rate limiting / throttling observation
 * 6. Error handling and resilience (429, 500, network error, private profiles, missing links)
 * 7. SSR API route handler (/api/inventory.json)
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
  // TEST 1: Inspect URL Substitution
  // --------------------------------------------------------------------------
  console.log('[Test 1] Inspect URL Construction & Substitution');
  {
    const rawTemplate =
      'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S%owner_steamid%A%assetid%D14432168987455850901';
    const steamId = '76561198012345678';
    const assetId = '31459265358';

    const formatted = formatInspectUrl(rawTemplate, steamId, assetId);
    assert(
      formatted ===
        'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198012345678A31459265358D14432168987455850901',
      'Replaces %owner_steamid% and %assetid% correctly',
      `Got: ${formatted}`
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
  // TEST 3: Metadata Tag Categorization
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Rarity and Type Extraction from Steam Tags');
  {
    const tags: RawSteamDescription['tags'] = [
      {
        category: 'Rarity',
        internal_name: 'Rarity_Covert_Weapon',
        localized_tag_name: 'Covert',
        color: 'eb4b4b',
      },
      {
        category: 'Type',
        internal_name: 'CSGO_Type_Rifle',
        localized_tag_name: 'Rifle',
      },
    ];

    const { rarity, rarityColor } = getRarityFromTags(tags);
    assert(rarity === 'Covert', 'Extracts correct rarity name from tags');
    assert(rarityColor === '#eb4b4b', 'Extracts and formats rarity color with # prefix');

    const type = getTypeFromTags(tags, 'Rifle');
    assert(type === 'Rifle', 'Extracts correct item type from tags');

    const emptyRarity = getRarityFromTags([]);
    assert(emptyRarity.rarity === 'Base Grade', 'Falls back to Base Grade for empty tags');

    const deducedType = getTypeFromTags([], 'StatTrak™ AWP | Dragon Lore (Sniper Rifle)');
    assert(deducedType === 'Sniper Rifle', 'Deduced type from type string when tags missing');
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

    // Access key1 so key2 becomes the least recently used
    const v1 = cache.get('key1');
    assert(v1 === 'value1', 'Retrieves key1 from cache');

    // Insert key3 -> key2 should be evicted
    cache.set('key3', 'value3');
    assert(cache.get('key2') === undefined, 'Evicts oldest item (key2) when capacity exceeded');
    assert(cache.get('key1') === 'value1', 'Retains recently accessed item (key1)');
    assert(cache.get('key3') === 'value3', 'Retains newly added item (key3)');

    // TTL Expiration test
    const shortTtlCache = new LRUCache<string, string>(5, 10); // 10ms TTL
    shortTtlCache.set('temp', 'tempVal');
    assert(shortTtlCache.get('temp') === 'tempVal', 'Gets value before TTL expires');

    await new Promise((resolve) => setTimeout(resolve, 25));
    assert(shortTtlCache.get('temp') === undefined, 'Returns undefined after TTL expires');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Fallback Loadout Dataset Integrity
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Fallback Loadout Schema & Consistency');
  {
    assert(Array.isArray(FALLBACK_INVENTORY) && FALLBACK_INVENTORY.length >= 4, 'FALLBACK_INVENTORY has >= 4 curated items');

    for (const item of FALLBACK_INVENTORY) {
      assert(typeof item.id === 'string' && item.id.length > 0, `Item ${item.name} has valid id`);
      assert(typeof item.name === 'string' && item.name.length > 0, `Item ${item.name} has valid name`);
      assert(item.iconUrl.startsWith('http'), `Item ${item.name} has valid iconUrl`);
      assert(item.inspectUrl !== null && item.inspectUrl.startsWith('steam://rungame/730/'), `Item ${item.name} has valid inspectUrl`);
      assert(typeof item.float === 'number' && item.float >= 0 && item.float <= 1, `Item ${item.name} has valid float: ${item.float}`);
      assert(typeof item.seed === 'number' && item.seed >= 0, `Item ${item.name} has valid seed: ${item.seed}`);
      assert(typeof item.rarity === 'string' && item.rarity.length > 0, `Item ${item.name} has valid rarity`);
      assert(typeof item.type === 'string' && item.type.length > 0, `Item ${item.name} has valid type`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 6: CSFloat Enricher & Cache Hit Verification
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] CSFloat Enricher & Cache Hit Rate');
  {
    const originalFetch = globalThis.fetch;
    let csfloatCallCount = 0;

    const mockInspectUrl =
      'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198000000000A9990001D14432168987455850901';

    // Mock CSFloat API
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

      // Global inventoryLRUCache validation
      assert(inventoryLRUCache.size() >= 4, 'Global inventoryLRUCache contains initialized fallback items');

      // Non-inspect item test: Should never call CSFloat
      const containerItem: EnrichedInventoryItem = {
        id: 'mock-case-888',
        name: 'Revolution Case',
        iconUrl: 'https://community.cloudflare.steamstatic.com/economy/image/case',
        inspectUrl: null,
        float: null,
        seed: null,
        rarity: 'Base Grade',
        type: 'Container',
      };
      const containerEnriched = await enrichWithCSFloat(containerItem);
      assert(csfloatCallCount === 2, 'Does not query CSFloat for items without inspectUrl');
      assert(containerEnriched.float === null && containerEnriched.seed === null, 'Sets float and seed to null for items without inspectUrl');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 7: Resilience & Error Handling (HTTP 429, 500, network error)
  // --------------------------------------------------------------------------
  console.log('\n[Test 7] Resilience & Error Fallbacks');
  {
    const originalFetch = globalThis.fetch;

    // Test 7a: Steam API 429 Rate Limit
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('steamcommunity.com/inventory')) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const result429 = await fetchCS2Inventory('76561198000000000');
      assert(
        result429 === FALLBACK_INVENTORY || result429.length === FALLBACK_INVENTORY.length,
        'Steam 429 rate limit gracefully returns fallback inventory without throwing'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Test 7b: Steam API Private Profile (HTTP 403)
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('steamcommunity.com/inventory')) {
        return new Response(JSON.stringify({ error: 'This profile is private.' }), { status: 403 });
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const resultPrivate = await fetchCS2Inventory('76561198000000000');
      assert(
        resultPrivate === FALLBACK_INVENTORY || resultPrivate.length === FALLBACK_INVENTORY.length,
        'Private profile gracefully returns fallback inventory without throwing'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // Test 7c: CSFloat HTTP 500 Error
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

    // Test 7d: Invalid SteamID
    const invalidIdResult = await fetchCS2Inventory('not-a-valid-id');
    assert(
      invalidIdResult === FALLBACK_INVENTORY,
      'Invalid SteamID format directly returns FALLBACK_INVENTORY'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 8: SSR API Route Handler (/api/inventory.json)
  // --------------------------------------------------------------------------
  console.log('\n[Test 8] SSR API Route Handler Validation (/api/inventory.json)');
  {
    // Simulate Astro APIContext
    const mockContext = {
      request: new Request('https://links.huh4k.dev/api/inventory.json?steamid=76561198000000000'),
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
    assert(body.length > 0, `API response contains ${body.length} items`);

    const firstItem = body[0];
    assert(
      firstItem &&
        typeof firstItem.id === 'string' &&
        typeof firstItem.name === 'string' &&
        typeof firstItem.iconUrl === 'string' &&
        typeof firstItem.rarity === 'string' &&
        typeof firstItem.type === 'string',
      'API item conforms strictly to EnrichedInventoryItem schema'
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
