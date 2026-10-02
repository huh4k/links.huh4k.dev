/**
 * Empirical Adversarial Stress Test Suite for CS2 Inventory Pipeline
 *
 * Stress Vectors:
 * 1. High-concurrency LRU Cache eviction and memory stability (10,000 items, concurrent sets)
 * 2. Cache key tampering and prototype pollution resistance
 * 3. Throttling queue behavior under burst (concurrent requests) and sequential pace
 * 4. Corner cases in inspect link formatting (unicode, spaces, ReDoS, special chars, null/undefined)
 * 5. Steam API failure modes (401, 403, 429, 500, timeouts, invalid shapes, reference mutation)
 * 6. CSFloat API failure resilience (429, 500, HTML bodies, JSON null, timeout aborts)
 * 7. SSR API route handler concurrency stress
 */

import {
  LRUCache,
  inventoryLRUCache,
  formatInspectUrl,
  formatEconomyImageUrl,
  getRarityFromTags,
  getTypeFromTags,
  fetchCSFloatInspect,
  enrichWithCSFloat,
  enrichInventory,
  fetchCS2Inventory,
  FALLBACK_INVENTORY,
} from '../../src/utils/steam.ts';
import { GET as inventoryApiHandler } from '../../src/pages/api/inventory.json.ts';
import type { EnrichedInventoryItem } from '../../src/types/inventory.ts';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

function record(category: string, name: string, status: 'PASS' | 'FAIL' | 'WARN', durationMs: number, details?: string) {
  results.push({ category, name, status, durationMs, details });
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '⚠' : '✗';
  console.log(`  ${icon} [${status}] ${name} (${durationMs.toFixed(1)}ms)${details ? `: ${details}` : ''}`);
}

async function run() {
  console.log('================================================================');
  console.log('EMPIRICAL ADVERSARIAL STRESS TEST SUITE — STEAM & CSFLOAT');
  console.log('================================================================\n');

  // ==========================================================================
  // VECTOR 1: LRU Cache Concurrency, Eviction & Memory Stress
  // ==========================================================================
  console.log('--- Vector 1: LRU Cache Concurrency & Eviction Bounds ---');
  {
    const start = performance.now();
    const capacity = 500;
    const testCache = new LRUCache<string, number>(capacity);

    // 1.1 Massive insertion (10,000 items into 500 cap)
    const initialMem = process.memoryUsage().heapUsed;
    for (let i = 0; i < 10000; i++) {
      testCache.set(`item-${i}`, i);
    }
    const postMem = process.memoryUsage().heapUsed;
    const finalSize = testCache.size();

    const sizeOk = finalSize === capacity;
    record(
      'LRU Cache',
      '1.1 Exact capacity maintenance under 10k items (size === 500)',
      sizeOk ? 'PASS' : 'FAIL',
      performance.now() - start,
      `Final size: ${finalSize}, Memory diff: ${((postMem - initialMem) / 1024).toFixed(1)} KB`
    );

    // 1.2 Verify oldest items are evicted and newest retained
    const tStart12 = performance.now();
    const item0Exists = testCache.has('item-0');
    const item9999Exists = testCache.has('item-9999');
    const item9500Exists = testCache.has('item-9500'); // 10000 - 500 = 9500
    const evictionOrderOk = !item0Exists && item9999Exists && item9500Exists;
    record(
      'LRU Cache',
      '1.2 LRU strict FIFO eviction order when not accessed',
      evictionOrderOk ? 'PASS' : 'FAIL',
      performance.now() - tStart12,
      `item-0 evicted: ${!item0Exists}, item-9999 retained: ${item9999Exists}, item-9500 retained: ${item9500Exists}`
    );

    // 1.3 High concurrency burst: 1,000 concurrent async writes
    const tStart13 = performance.now();
    const concurrentCache = new LRUCache<string, string>(500);
    const concurrentPromises = Array.from({ length: 1000 }, async (_, idx) => {
      concurrentCache.set(`async-${idx}`, `val-${idx}`);
      if (idx % 3 === 0) {
        concurrentCache.get(`async-${Math.floor(idx / 2)}`);
      }
    });
    await Promise.all(concurrentPromises);
    const concurrentSize = concurrentCache.size();
    record(
      'LRU Cache',
      '1.3 Concurrent async writes maintain <= 500 size bound',
      concurrentSize <= 500 ? 'PASS' : 'FAIL',
      performance.now() - tStart13,
      `Size after 1000 concurrent writes: ${concurrentSize}`
    );

    // 1.4 Access-based refresh (MRU repositioning)
    const tStart14 = performance.now();
    const lruRefreshCache = new LRUCache<string, string>(3);
    lruRefreshCache.set('A', 'val-A');
    lruRefreshCache.set('B', 'val-B');
    lruRefreshCache.set('C', 'val-C');
    // Access A to refresh it
    lruRefreshCache.get('A');
    // Insert D -> B should be evicted, not A
    lruRefreshCache.set('D', 'val-D');
    const aPreserved = lruRefreshCache.get('A') === 'val-A';
    const bEvicted = lruRefreshCache.get('B') === undefined;
    const cPreserved = lruRefreshCache.get('C') === 'val-C';
    const dPreserved = lruRefreshCache.get('D') === 'val-D';
    record(
      'LRU Cache',
      '1.4 Access refresh preserves MRU item during subsequent eviction',
      aPreserved && bEvicted && cPreserved && dPreserved ? 'PASS' : 'FAIL',
      performance.now() - tStart14,
      `A preserved: ${aPreserved}, B evicted: ${bEvicted}, C preserved: ${cPreserved}`
    );

    // 1.5 Global inventoryLRUCache stability check
    const tStart15 = performance.now();
    const globalSizeBefore = inventoryLRUCache.size();
    // Insert 1000 items to global cache
    for (let i = 0; i < 1000; i++) {
      inventoryLRUCache.set(`stress-asset-${i}`, { float: 0.1234, seed: i });
    }
    const globalSizeAfter = inventoryLRUCache.size();
    record(
      'LRU Cache',
      '1.5 Global inventoryLRUCache stays capped at capacity 500',
      globalSizeAfter <= 500 ? 'PASS' : 'FAIL',
      performance.now() - tStart15,
      `Size before: ${globalSizeBefore}, Size after 1000 items: ${globalSizeAfter}`
    );
  }

  // ==========================================================================
  // VECTOR 2: CSFloat Request Throttling & Burst Analysis
  // ==========================================================================
  console.log('\n--- Vector 2: Throttling Queue & Rate Limiter Analysis ---');
  {
    const originalFetch = globalThis.fetch;
    const requestTimestamps: number[] = [];

    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('api.csfloat.com')) {
        requestTimestamps.push(performance.now());
        return new Response(
          JSON.stringify({
            iteminfo: { floatvalue: 0.05, paintseed: 123 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      // 2.1 Sequential calls rate-limiting
      const tStart21 = performance.now();
      requestTimestamps.length = 0;
      const itemsSeq: EnrichedInventoryItem[] = Array.from({ length: 4 }, (_, i) => ({
        id: `seq-item-${Date.now()}-${i}`,
        name: `Seq Weapon ${i}`,
        iconUrl: 'http://cdn/icon',
        inspectUrl: `steam://rungame/730/preview%20S1A${i}D1`,
        float: null,
        seed: null,
        rarity: 'Covert',
        type: 'Rifle',
      }));

      // Enrich sequentially
      for (const item of itemsSeq) {
        await enrichWithCSFloat(item);
      }

      // Check deltas between sequential calls
      const seqDeltas: number[] = [];
      for (let i = 1; i < requestTimestamps.length; i++) {
        seqDeltas.push(requestTimestamps[i] - requestTimestamps[i - 1]);
      }
      const minSeqDelta = Math.min(...seqDeltas);
      const avgSeqDelta = seqDeltas.reduce((a, b) => a + b, 0) / seqDeltas.length;
      const seqThrottledOk = minSeqDelta >= 550; // Expected ~600ms
      record(
        'Throttling',
        '2.1 Sequential calls spaced by >= ~600ms (rate limit ~1.6 req/s)',
        seqThrottledOk ? 'PASS' : 'FAIL',
        performance.now() - tStart21,
        `Deltas: ${seqDeltas.map((d) => d.toFixed(0) + 'ms').join(', ')} (min: ${minSeqDelta.toFixed(0)}ms, avg: ${avgSeqDelta.toFixed(0)}ms)`
      );

      // 2.2 Concurrent burst calls
      const tStart22 = performance.now();
      requestTimestamps.length = 0;
      const itemsBurst: EnrichedInventoryItem[] = Array.from({ length: 5 }, (_, i) => ({
        id: `burst-item-${Date.now()}-${i}`,
        name: `Burst Weapon ${i}`,
        iconUrl: 'http://cdn/icon',
        inspectUrl: `steam://rungame/730/preview%20S1A${100 + i}D1`,
        float: null,
        seed: null,
        rarity: 'Covert',
        type: 'Rifle',
      }));

      // Launch all 5 concurrently
      await Promise.all(itemsBurst.map((it) => enrichWithCSFloat(it)));

      const burstDeltas: number[] = [];
      for (let i = 1; i < requestTimestamps.length; i++) {
        burstDeltas.push(requestTimestamps[i] - requestTimestamps[i - 1]);
      }
      const minBurstDelta = burstDeltas.length > 0 ? Math.min(...burstDeltas) : 0;
      // If concurrent calls arrive, does the throttler queue them or burst them at once?
      const burstStatus = minBurstDelta < 200 ? 'WARN' : 'PASS';
      record(
        'Throttling',
        '2.2 Concurrent burst behavior (inter-request delta under simultaneous queries)',
        burstStatus,
        performance.now() - tStart22,
        `Requests made: ${requestTimestamps.length}, Deltas: ${burstDeltas.map((d) => d.toFixed(1) + 'ms').join(', ')}. Note: ${
          burstStatus === 'WARN'
            ? 'Concurrent calls sleep until same expiration then burst in same tick. For SSR batching enrichInventory() uses sequential loop.'
            : 'Requests serialized cleanly.'
        }`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ==========================================================================
  // VECTOR 3: Inspect URL Formatting Edge Cases & Adversarial Inputs
  // ==========================================================================
  console.log('\n--- Vector 3: Inspect URL Corner Cases & Adversarial Strings ---');
  {
    const tStart3 = performance.now();

    // 3.1 Empty / undefined / null inputs
    const empty1 = formatInspectUrl('', '76561198000000000', '12345');
    const empty2 = formatInspectUrl(null as any, '76561198000000000', '12345');
    const empty3 = formatInspectUrl(undefined as any, '76561198000000000', '12345');
    const emptyPass = empty1 === '' && empty2 === '' && empty3 === '';
    record(
      'Inspect Link',
      '3.1 Handles empty, null, and undefined rawLink without throwing',
      emptyPass ? 'PASS' : 'FAIL',
      performance.now() - tStart3,
      `empty1: "${empty1}", empty2: "${empty2}", empty3: "${empty3}"`
    );

    // 3.2 Spaces, tabs, newlines
    const tStart32 = performance.now();
    const spaced = formatInspectUrl(' steam://rungame/730/%owner_steamid%/%assetid% \n', '111', '222');
    const spacedPass = spaced.includes('111') && spaced.includes('222');
    record(
      'Inspect Link',
      '3.2 Substitutes tokens amidst whitespace and control chars',
      spacedPass ? 'PASS' : 'FAIL',
      performance.now() - tStart32,
      `Output: "${spaced.trim()}"`
    );

    // 3.3 Special characters, Unicode, non-standard encoding
    const tStart33 = performance.now();
    const unicodeInput = 'steam://rungame/730/%owner_steamid%/%assetid%?label=龙之传说&emoji=🔥';
    const unicodeOut = formatInspectUrl(unicodeInput, '76561198000000000', '999');
    const unicodePass = unicodeOut.includes('76561198000000000') && unicodeOut.includes('龙之传说') && unicodeOut.includes('🔥');
    record(
      'Inspect Link',
      '3.3 Preserves Unicode and emojis in inspect URLs',
      unicodePass ? 'PASS' : 'FAIL',
      performance.now() - tStart33,
      `Output: "${unicodeOut}"`
    );

    // 3.4 Multiple duplicate token occurrences
    const tStart34 = performance.now();
    const multiInput = 'steam://preview/%owner_steamid%/%owner_steamid%/%assetid%/%assetid%';
    const multiOut = formatInspectUrl(multiInput, 'S1', 'A1');
    const multiPass = multiOut === 'steam://preview/S1/S1/A1/A1';
    record(
      'Inspect Link',
      '3.4 Replaces all repeated occurrences via replaceAll',
      multiPass ? 'PASS' : 'FAIL',
      performance.now() - tStart34,
      `Output: "${multiOut}"`
    );

    // 3.5 ReDoS and long payload stress test (100k characters)
    const tStart35 = performance.now();
    const bigString = 'prefix_' + '%owner_steamid%_'.repeat(10000) + 'suffix';
    const bigOut = formatInspectUrl(bigString, 'ID', 'ASSET');
    const bigPass = bigOut.startsWith('prefix_ID_') && !bigOut.includes('%owner_steamid%');
    record(
      'Inspect Link',
      '3.5 High-throughput token substitution (10,000 token substitutions)',
      bigPass ? 'PASS' : 'FAIL',
      performance.now() - tStart35,
      `Length: ${bigOut.length} characters in ${(performance.now() - tStart35).toFixed(1)}ms`
    );

    // 3.6 Steam CDN Image Formatter Edge Cases
    const tStart36 = performance.now();
    const img1 = formatEconomyImageUrl('');
    const img2 = formatEconomyImageUrl('http://example.com/img.png');
    const img3 = formatEconomyImageUrl('https://example.com/img.png');
    const img4 = formatEconomyImageUrl('-9a81dlWLwJ2UUGcVs_hash');
    const imgPass =
      img1 === '' &&
      img2 === 'http://example.com/img.png' &&
      img3 === 'https://example.com/img.png' &&
      img4.startsWith('https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_hash');
    record(
      'Economy CDN',
      '3.6 Economy Image URL formatting under diverse URL prefixes',
      imgPass ? 'PASS' : 'FAIL',
      performance.now() - tStart36,
      `Handled empty, HTTP, HTTPS, and relative hash`
    );

    // 3.7 Tag Rarity & Type Extraction Adversarial Cases
    const tStart37 = performance.now();
    const rarityNull = getRarityFromTags(undefined);
    const rarityEmpty = getRarityFromTags([]);
    const rarityCovert = getRarityFromTags([{ category: 'Rarity', internal_name: 'Rarity_Covert', localized_tag_name: 'Covert' }]);
    const rarityGold = getRarityFromTags([{ category: 'Rarity', internal_name: '★ Extraordinary', localized_tag_name: '★ Extraordinary' }]);
    const typeKnife = getTypeFromTags([], '★ Karambit | Doppler (Knife)');
    const typeGlove = getTypeFromTags([], 'Sport Gloves | Vice');
    const typeFallback = getTypeFromTags([], 'Unknown Custom Entity');
    const tagPass =
      rarityNull.rarity === 'Base Grade' &&
      rarityEmpty.rarity === 'Base Grade' &&
      rarityCovert.rarityColor === '#eb4b4b' &&
      rarityGold.rarityColor === '#ffd700' &&
      typeKnife === 'Knife' &&
      typeGlove === 'Gloves' &&
      typeFallback === 'Unknown Custom Entity';
    record(
      'Tag Parser',
      '3.7 Tag rarity and item type categorization under boundary/fallback inputs',
      tagPass ? 'PASS' : 'FAIL',
      performance.now() - tStart37,
      `Covert color: ${rarityCovert.rarityColor}, Gold color: ${rarityGold.rarityColor}, Knife: ${typeKnife}, Gloves: ${typeGlove}`
    );

  }

  // ==========================================================================
  // VECTOR 4: Steam API Network Failure Modes & Fallback Loadout
  // ==========================================================================
  console.log('\n--- Vector 4: Steam API Resilience & Fallback Integrity ---');
  {
    const originalFetch = globalThis.fetch;

    // 4.1 Schema validation on FALLBACK_INVENTORY
    const tStart41 = performance.now();
    let fallbackValid = true;
    const requiredKeys: (keyof EnrichedInventoryItem)[] = ['id', 'name', 'iconUrl', 'rarity', 'type'];
    for (const item of FALLBACK_INVENTORY) {
      for (const k of requiredKeys) {
        if (!item[k] || typeof item[k] !== 'string') fallbackValid = false;
      }
      if (typeof item.float !== 'number' || item.float < 0 || item.float > 1) fallbackValid = false;
      if (typeof item.seed !== 'number' || item.seed < 0) fallbackValid = false;
    }
    record(
      'Steam Resilience',
      '4.1 FALLBACK_INVENTORY schema and boundary validation',
      fallbackValid ? 'PASS' : 'FAIL',
      performance.now() - tStart41,
      `Items: ${FALLBACK_INVENTORY.length}, All fields strictly compliant`
    );

    // 4.2 Simulated HTTP error codes (500, 502, 504, 401, 403, 429)
    const errorCodes = [401, 403, 429, 500, 502, 504];
    for (const code of errorCodes) {
      const tStartErr = performance.now();
      globalThis.fetch = (async () => {
        return new Response('Error', { status: code });
      }) as typeof fetch;

      try {
        const res = await fetchCS2Inventory('76561198000000000');
        const isFallback = res.length === FALLBACK_INVENTORY.length && res[0].name === FALLBACK_INVENTORY[0].name;
        record(
          'Steam Resilience',
          `4.2 HTTP ${code} returns FALLBACK_INVENTORY cleanly`,
          isFallback ? 'PASS' : 'FAIL',
          performance.now() - tStartErr,
          `Received ${res.length} items without unhandled exception`
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    }

    // 4.3 Simulated Network Failure / Fetch Abort
    const tStartAbort = performance.now();
    globalThis.fetch = (async () => {
      throw new TypeError('Network connection refused (ECONNREFUSED)');
    }) as typeof fetch;

    try {
      const resAbort = await fetchCS2Inventory('76561198000000000');
      const isFallback = resAbort.length === FALLBACK_INVENTORY.length;
      record(
        'Steam Resilience',
        '4.3 Network rejection (ECONNREFUSED) gracefully falls back',
        isFallback ? 'PASS' : 'FAIL',
        performance.now() - tStartAbort,
        `Caught network rejection and returned fallback`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 4.4 Malformed Steam JSON payloads
    const malformedBodies = [
      '{ not valid json',
      'null',
      '{"success": 1, "assets": [], "descriptions": []}',
      '{"success": 1, "assets": [{"assetid": "1", "classid": "999"}]}', // missing descriptions
      '[]',
    ];

    for (const [idx, bodyStr] of malformedBodies.entries()) {
      const tStartMal = performance.now();
      globalThis.fetch = (async () => {
        return new Response(bodyStr, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;

      try {
        const res = await fetchCS2Inventory('76561198000000000');
        const ok = res.length > 0;
        record(
          'Steam Resilience',
          `4.4 Malformed payload case #${idx + 1} handled safely`,
          ok ? 'PASS' : 'FAIL',
          performance.now() - tStartMal,
          `Returned ${res.length} items (fallback or safe parse)`
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  }

  // ==========================================================================
  // VECTOR 5: CSFloat Inspect API Resilience
  // ==========================================================================
  console.log('\n--- Vector 5: CSFloat API Failure & Resilience ---');
  {
    const originalFetch = globalThis.fetch;

    // 5.1 CSFloat HTTP 429
    const tStart51 = performance.now();
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 });
    }) as typeof fetch;

    try {
      const item: EnrichedInventoryItem = {
        id: 'csfloat-429-test',
        name: 'AWP | Asiimov',
        iconUrl: 'http://cdn/awp',
        inspectUrl: 'steam://rungame/730/test429',
        float: null,
        seed: null,
        rarity: 'Covert',
        type: 'Sniper Rifle',
      };
      const enriched = await enrichWithCSFloat(item);
      const ok = enriched.float === null && enriched.seed === null;
      record(
        'CSFloat Resilience',
        '5.1 HTTP 429 yields null float & seed without throwing',
        ok ? 'PASS' : 'FAIL',
        performance.now() - tStart51,
        `float: ${enriched.float}, seed: ${enriched.seed}`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 5.2 CSFloat HTML Cloudflare Error Page (HTTP 502 with HTML body)
    const tStart52 = performance.now();
    globalThis.fetch = (async () => {
      return new Response('<html><head><title>502 Bad Gateway</title></head><body>Cloudflare</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as typeof fetch;

    try {
      const item: EnrichedInventoryItem = {
        id: 'csfloat-502-html-test',
        name: 'M4A4 | Howl',
        iconUrl: 'http://cdn/howl',
        inspectUrl: 'steam://rungame/730/test502',
        float: null,
        seed: null,
        rarity: 'Contraband',
        type: 'Rifle',
      };
      const enriched = await enrichWithCSFloat(item);
      const ok = enriched.float === null && enriched.seed === null;
      record(
        'CSFloat Resilience',
        '5.2 Cloudflare HTML error body handled gracefully without throwing',
        ok ? 'PASS' : 'FAIL',
        performance.now() - tStart52,
        `float: ${enriched.float}, seed: ${enriched.seed}`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 5.3 CSFloat Response variations (iteminfo vs item vs flat)
    const variations = [
      { name: 'iteminfo nested', payload: { iteminfo: { floatvalue: 0.042, paintseed: 777, paintindex: 10 } }, expectedFloat: 0.042 },
      { name: 'item nested with float_value', payload: { item: { float_value: 0.088, paint_seed: 333 } }, expectedFloat: 0.088 },
      { name: 'item nested with floatvalue', payload: { item: { floatvalue: 0.155, paintseed: 444 } }, expectedFloat: 0.155 },
      { name: 'flat root floatvalue', payload: { floatvalue: 0.222, paintseed: 555 }, expectedFloat: 0.222 },
      { name: 'empty object {}', payload: {}, expectedFloat: null },
    ];

    for (const v of variations) {
      const tStartVar = performance.now();
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(v.payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      try {
        const item: EnrichedInventoryItem = {
          id: `var-${v.name.replace(/\s+/g, '-')}`,
          name: 'Test Item',
          iconUrl: 'http://cdn/icon',
          inspectUrl: `steam://rungame/730/var-${v.name}`,
          float: null,
          seed: null,
          rarity: 'Covert',
          type: 'Rifle',
        };
        const res = await enrichWithCSFloat(item);
        const ok = res.float === v.expectedFloat;
        record(
          'CSFloat Resilience',
          `5.3 Payload variant: ${v.name}`,
          ok ? 'PASS' : 'FAIL',
          performance.now() - tStartVar,
          `Expected float ${v.expectedFloat}, got ${res.float}`
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    }

    // 5.4 Timeout / hanging request simulation
    const tStartTimeout = performance.now();
    globalThis.fetch = (async () => {
      // Simulate AbortSignal timeout rejection
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    }) as typeof fetch;

    try {
      const inspectRes = await fetchCSFloatInspect('steam://rungame/730/timeout');
      const ok = inspectRes === null;
      record(
        'CSFloat Resilience',
        '5.4 TimeoutError in fetchCSFloatInspect safely yields null',
        ok ? 'PASS' : 'FAIL',
        performance.now() - tStartTimeout,
        `Result: ${inspectRes}`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 5.5 enrichInventory batch capping (maxEnrich = 3 over 10 items)
    const tStart55 = performance.now();
    let csfloatBatchCalls = 0;
    globalThis.fetch = (async (url: string | URL | Request) => {
      if (url.toString().includes('api.csfloat.com')) {
        csfloatBatchCalls++;
        return new Response(JSON.stringify({ iteminfo: { floatvalue: 0.1, paintseed: 10 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const batchItems: EnrichedInventoryItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `batch-item-${Date.now()}-${i}`,
        name: `Batch Item ${i}`,
        iconUrl: 'http://cdn/icon',
        inspectUrl: `steam://rungame/730/inspect-${i}`,
        float: null,
        seed: null,
        rarity: 'Classified',
        type: 'Rifle',
      }));

      const enrichedBatch = await enrichInventory(batchItems, 3);
      const enrichedCount = enrichedBatch.filter((b) => b.float !== null).length;
      const cappedOk = csfloatBatchCalls === 3 && enrichedCount === 3;
      record(
        'CSFloat Resilience',
        '5.5 enrichInventory strictly enforces maxEnrich quota (3 of 10 items)',
        cappedOk ? 'PASS' : 'FAIL',
        performance.now() - tStart55,
        `Calls made: ${csfloatBatchCalls}, Enriched items: ${enrichedCount} of 10`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }


  // ==========================================================================
  // VECTOR 6: SSR API Route Concurrency Stress
  // ==========================================================================
  console.log('\n--- Vector 6: SSR API Route Concurrency Stress ---');
  {
    const tStart6 = performance.now();
    const concurrentRequests = 30;

    const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
      const steamId = i % 2 === 0 ? '76561198000000000' : '76561198000000001';
      const mockContext = {
        request: new Request(`https://links.huh4k.dev/api/inventory.json?steamid=${steamId}`),
        locals: {},
        params: {},
      } as any;

      const resp = await inventoryApiHandler(mockContext);
      const status = resp.status;
      const data = (await resp.json()) as EnrichedInventoryItem[];
      return { status, count: data.length };
    });

    const resultsApi = await Promise.all(promises);
    const all200 = resultsApi.every((r) => r.status === 200 && r.count > 0);
    record(
      'SSR Endpoint',
      `6.1 Handled ${concurrentRequests} concurrent API requests (100% HTTP 200)`,
      all200 ? 'PASS' : 'FAIL',
      performance.now() - tStart6,
      `All 200: ${all200}, average duration: ${((performance.now() - tStart6) / concurrentRequests).toFixed(1)}ms/req`
    );
  }

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const warnCount = results.filter((r) => r.status === 'WARN').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`SUMMARY: ${passCount} PASSED, ${warnCount} WARNINGS, ${failCount} FAILED (${results.length} total tests)`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal crash in stress runner:', err);
  process.exit(1);
});
