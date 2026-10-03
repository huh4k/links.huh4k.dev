#!/usr/bin/env node
/**
 * Adversarial Empirical Verification Harness: R2 Texture & Skin Compositor Pipeline
 * Author: challenger_1_r3 (teamwork_preview_challenger)
 *
 * Scope:
 * Suite 1: Complete 35 CS2 Weapon Catalog & Model Resolution
 * Suite 2: Paint Finish Map Resolution & Alias Mapping
 * Suite 3: Error Resilience & Async Texture Loader
 * Suite 4: Float Wear Continuous Mathematics (Monotonic Roughness, Clearcoat Cutoff, Hostile Floats)
 * Suite 5: Pattern Seeds & Deterministic RNG Stress
 * Suite 6: Procedural Skin Finishes & Fallbacks
 * Suite 7: SSR Compatibility & Hostile Global DOM Isolation
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Transparently re-spawn under tsx if run via plain `node tests/...`
if (!process.env.TSX_RUNNER_ACTIVE && !process.execArgv.some(arg => arg.includes('tsx'))) {
  const result = spawnSync('npx', ['-y', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_RUNNER_ACTIVE: '1' },
  });
  process.exit(result.status ?? 0);
}

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import * as THREE from 'three';

const {
  R2_BASE_URL,
  R2_PAINTS_BASE_URL,
  PAINT_FINISH_TYPES,
  BASE_WEAPON_MAPS,
  getR2WeaponTextures,
  getR2PaintFinishUrl,
  getWeaponKeyFromName,
  loadR2Texture,
  getTextureCache,
  setCachedTexture,
  clearTextureCache,
} = await import('../src/utils/r2Textures.ts');

const {
  compositeSkinFinish,
  getSkinFallbackColor,
  calculateEffectiveWear,
  normalizeSkinIdentifier,
} = await import('../src/utils/skinCompositor.ts');

const PASSED = '\x1b[32m✓\x1b[0m';
const FAILED = '\x1b[31m✗\x1b[0m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let totalAssertions = 0;

function runTest(name, fn) {
  totalTests++;
  const start = performance.now();
  try {
    const res = fn();
    if (res instanceof Promise) {
      throw new Error(`Test "${name}" returned a Promise. Use runAsyncTest for async tests.`);
    }
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ${PASSED} ${name} (${duration}ms)`);
    passedTests++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  ${FAILED} ${name} (${duration}ms)`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ${PASSED} ${name} (${duration}ms)`);
    passedTests++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  ${FAILED} ${name} (${duration}ms)`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

function recordAssertion() {
  totalAssertions++;
}

console.log(`${BOLD}================================================================================${RESET}`);
console.log(`${BOLD}${CYAN}   R2 TEXTURE & SKIN COMPOSITOR PIPELINE — ADVERSARIAL VERIFICATION HARNESS    ${RESET}`);
console.log(`${BOLD}================================================================================${RESET}\n`);

// -----------------------------------------------------------------------------
// SUITE 1: Complete 35 CS2 Weapon Catalog & Model Resolution
// -----------------------------------------------------------------------------
console.log(`${BOLD}[Suite 1] Complete 35 CS2 Weapon Catalog & Model Resolution${RESET}`);

const modelsDir = path.resolve('public/models');
const objFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.obj')).sort();

runTest('1.1: Verify all 35 .obj model files exist in public/models/ and resolve non-null R2 textures', () => {
  recordAssertion();
  assert.strictEqual(objFiles.length, 35, `Expected 35 .obj files, got ${objFiles.length}`);

  for (const file of objFiles) {
    recordAssertion();
    const textures = getR2WeaponTextures(file);
    assert.ok(textures !== null, `Failed to resolve R2 textures for model file: ${file}`);
    assert.ok(typeof textures.aoUrl === 'string' && textures.aoUrl.length > 0, `Missing aoUrl for ${file}`);
    assert.ok(typeof textures.surfaceUrl === 'string' && textures.surfaceUrl.length > 0, `Missing surfaceUrl for ${file}`);
    assert.ok(typeof textures.masksUrl === 'string' && textures.masksUrl.length > 0, `Missing masksUrl for ${file}`);
  }
});

const CANONICAL_35_WEAPONS = [
  // Rifles (7)
  'AK-47', 'M4A1-S', 'M4A4', 'Galil AR', 'FAMAS', 'AUG', 'SG 553',
  // Sniper Rifles (4)
  'AWP', 'SSG 08', 'G3SG1', 'SCAR-20',
  // Pistols (11)
  'USP-S', 'Glock-18', 'Desert Eagle', 'P250', 'P2000', 'Five-SeVeN',
  'CZ75-Auto', 'Tec-9', 'Dual Berettas', 'R8 Revolver', 'Zeus x27',
  // SMGs (7)
  'MAC-10', 'UMP-45', 'MP9', 'MP7', 'MP5-SD', 'P90', 'PP-Bizon',
  // Shotguns (4)
  'MAG-7', 'Nova', 'Sawed-Off', 'XM1014',
  // Heavy / Machine Guns (2)
  'M249', 'Negev',
];

runTest('1.2: Verify all 35 canonical weapon names resolve non-null R2 texture sets', () => {
  recordAssertion();
  assert.strictEqual(CANONICAL_35_WEAPONS.length, 35);

  for (const weapon of CANONICAL_35_WEAPONS) {
    recordAssertion();
    const textures = getR2WeaponTextures(weapon);
    assert.ok(textures !== null, `Failed to resolve R2 textures for canonical weapon name: ${weapon}`);
  }
});

runTest('1.3: Verify all 35 canonical weapon keys in BASE_WEAPON_MAPS are well-formed URLs', () => {
  const baseKeys = Object.keys(BASE_WEAPON_MAPS).filter(k => !['pist_usp_silencer', 'rif_m4a1_silencer'].includes(k));
  recordAssertion();
  assert.strictEqual(baseKeys.length, 35, `BASE_WEAPON_MAPS must have exactly 35 canonical model keys`);

  for (const key of baseKeys) {
    recordAssertion();
    const tex = BASE_WEAPON_MAPS[key];
    assert.ok(tex, `Missing key in BASE_WEAPON_MAPS: ${key}`);

    for (const [prop, url] of Object.entries(tex)) {
      recordAssertion();
      assert.ok(url.startsWith(R2_BASE_URL), `${key}.${prop} (${url}) must start with R2_BASE_URL`);
      assert.ok(url.endsWith('.png'), `${key}.${prop} (${url}) must end with .png`);

      // URL syntax parse check
      let parsedUrl;
      assert.doesNotThrow(() => {
        parsedUrl = new URL(url);
      }, `${key}.${prop} must be a valid URL`);
      assert.strictEqual(parsedUrl.protocol, 'https:');
      assert.strictEqual(parsedUrl.hostname, 'assets.huh4k.dev');
    }
  }
});

runTest('1.4: Verify exact Source 2 VRF hashes for AK-47 base textures', () => {
  const akTextures = getR2WeaponTextures('AK-47');
  recordAssertion();
  assert.ok(akTextures !== null);
  assert.strictEqual(
    akTextures.aoUrl,
    'https://assets.huh4k.dev/cs2-textures/rif_ak47_ao_psd_3cdda94d.png'
  );
  recordAssertion();
  assert.strictEqual(
    akTextures.surfaceUrl,
    'https://assets.huh4k.dev/cs2-textures/rif_ak47_surface_psd_1262e7bf.png'
  );
  recordAssertion();
  assert.strictEqual(
    akTextures.masksUrl,
    'https://assets.huh4k.dev/cs2-textures/rif_ak47_masks_psd_cc08789a.png'
  );
});

runTest('1.5: Verify canonical aliases and model path normalization', () => {
  const aliases = [
    ['pist_usp_silencer', 'pist_223'],
    ['rif_m4a1_silencer', 'rif_m4a1_s'],
    ['/models/weapon_rif_ak47.obj', 'rif_ak47'],
    ['public/models/weapon_snip_awp.obj', 'snip_awp'],
    ['weapon_pist_glock18.obj', 'pist_glock18'],
    ['weapon_mach_negev.obj', 'mach_negev'],
  ];

  for (const [input, expectedKey] of aliases) {
    recordAssertion();
    const resolvedKey = getWeaponKeyFromName(input);
    assert.strictEqual(resolvedKey, expectedKey, `Expected key ${expectedKey} for ${input}, got ${resolvedKey}`);
    const textures = getR2WeaponTextures(input);
    const expectedTextures = BASE_WEAPON_MAPS[expectedKey];
    assert.ok(textures !== null, `Failed to resolve ${input}`);
    assert.strictEqual(textures.aoUrl, expectedTextures.aoUrl);
    assert.strictEqual(textures.surfaceUrl, expectedTextures.surfaceUrl);
    assert.strictEqual(textures.masksUrl, expectedTextures.masksUrl);
  }
});

runTest('1.6: Market strings with StatTrak™, Souvenir, star icon, wear brackets resolve cleanly', () => {
  const marketStrings = [
    'StatTrak™ AK-47 | Ice Coaled (Factory New)',
    'StatTrak™ M4A1-S | Liquidation (Field-Tested)',
    'Souvenir AWP | Desert Hydra (Minimal Wear)',
    '★ USP-S | Royal Guard (Well-Worn)',
    'MAC-10 | Candy Apple (Battle-Scarred)',
    'Zeus x27 | Electric Blue',
    'Galil AR | Control (Factory New)',
    'Glock-18 | Catacombs (Field-Tested)',
    'UMP-45 | Late Night Transit (Battle-Scarred)',
  ];

  for (const item of marketStrings) {
    recordAssertion();
    const textures = getR2WeaponTextures(item);
    assert.ok(textures !== null, `Failed to resolve market string: "${item}"`);
  }
});

runTest('1.7: Knives and melee weapons return null (no base firearm textures)', () => {
  const knifeTerms = [
    '★ Karambit | Doppler',
    '★ Butterfly Knife | Fade',
    '★ M9 Bayonet | Marble Fade',
    '★ Falchion Knife',
    '★ Shadow Daggers | Slaughter',
    '★ Kukri Knife | Vanilla',
    '★ Skeleton Knife | Crimson Web',
    '★ Ursus Knife',
    '★ Navaja Knife',
    '★ Stiletto Knife',
  ];

  for (const knife of knifeTerms) {
    recordAssertion();
    const textures = getR2WeaponTextures(knife);
    assert.strictEqual(textures, null, `Knife "${knife}" must resolve to null, got ${JSON.stringify(textures)}`);
  }
});

runTest('1.8: Hostile inputs to weapon resolver (null, undefined, blanks, SQLi, huge strings) return null gracefully', () => {
  const hostileInputs = [
    undefined,
    null,
    '',
    '    ',
    '\n\t',
    'NonExistentGun2099',
    "'; DROP TABLE weapons; --",
    '<script>alert("xss")</script>',
    'A'.repeat(50000),
    0,
    12345,
    true,
    false,
    {},
    [],
  ];

  for (const bad of hostileInputs) {
    recordAssertion();
    assert.doesNotThrow(() => {
      const res = getR2WeaponTextures(bad);
      assert.strictEqual(res, null, `Expected null for input: ${bad}`);
    });
  }
});

// -----------------------------------------------------------------------------
// SUITE 2: Paint Finish Map Resolution & Alias Mapping
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 2] Paint Finish Map Resolution & Alias Mapping${RESET}`);

runTest('2.1: Verify all 6 paint finishes resolve valid URLs under R2_PAINTS_BASE_URL', () => {
  const finishes = [
    'anodized_air',
    'anodized_multi',
    'antiqued',
    'custom',
    'gunsmith',
    'hydrographic',
  ];

  recordAssertion();
  assert.strictEqual(R2_PAINTS_BASE_URL, 'https://assets.huh4k.dev/cs2-textures/paints/');
  recordAssertion();
  assert.strictEqual(PAINT_FINISH_TYPES.length, 6);

  for (const finish of finishes) {
    recordAssertion();
    const url = getR2PaintFinishUrl(finish);
    const expected = `https://assets.huh4k.dev/cs2-textures/paints/${finish}.png`;
    assert.strictEqual(url, expected, `Finish "${finish}" did not resolve to ${expected}`);

    // Parse check
    const parsed = new URL(url);
    assert.strictEqual(parsed.protocol, 'https:');
    assert.strictEqual(parsed.hostname, 'assets.huh4k.dev');
    assert.ok(parsed.pathname.endsWith(`/${finish}.png`));
  }
});

runTest('2.2: Case-insensitivity, whitespace, hyphens, and .png suffix tolerance', () => {
  const variations = [
    ['GUNSMITH', 'https://assets.huh4k.dev/cs2-textures/paints/gunsmith.png'],
    ['Gunsmith', 'https://assets.huh4k.dev/cs2-textures/paints/gunsmith.png'],
    ['gunsmith.png', 'https://assets.huh4k.dev/cs2-textures/paints/gunsmith.png'],
    ['GUNSMITH.PNG', 'https://assets.huh4k.dev/cs2-textures/paints/gunsmith.png'],
    ['anodized-air', 'https://assets.huh4k.dev/cs2-textures/paints/anodized_air.png'],
    ['Anodized Air', 'https://assets.huh4k.dev/cs2-textures/paints/anodized_air.png'],
    ['anodized_air.png', 'https://assets.huh4k.dev/cs2-textures/paints/anodized_air.png'],
    ['  hydrographic  ', 'https://assets.huh4k.dev/cs2-textures/paints/hydrographic.png'],
  ];

  for (const [input, expected] of variations) {
    recordAssertion();
    const url = getR2PaintFinishUrl(input);
    assert.strictEqual(url, expected, `Variation "${input}" failed to resolve to ${expected}`);
  }
});

runTest('2.3: Known paint finish aliases (custom_paint, anodized, hydro, antique)', () => {
  const aliases = [
    ['custom_paint', 'https://assets.huh4k.dev/cs2-textures/paints/custom.png'],
    ['custompaint', 'https://assets.huh4k.dev/cs2-textures/paints/custom.png'],
    ['anodized', 'https://assets.huh4k.dev/cs2-textures/paints/anodized_multi.png'],
    ['hydro', 'https://assets.huh4k.dev/cs2-textures/paints/hydrographic.png'],
    ['antique', 'https://assets.huh4k.dev/cs2-textures/paints/antiqued.png'],
  ];

  for (const [input, expected] of aliases) {
    recordAssertion();
    const url = getR2PaintFinishUrl(input);
    assert.strictEqual(url, expected, `Alias "${input}" failed to resolve to ${expected}`);
  }
});

runTest('2.4: Hostile / invalid inputs to paint finish resolver return null without throwing', () => {
  const invalid = [
    '',
    '   ',
    'unknown_finish',
    'matte_black',
    'pbr_ultra',
    null,
    undefined,
    123,
    {},
    [],
  ];

  for (const bad of invalid) {
    recordAssertion();
    assert.doesNotThrow(() => {
      const res = getR2PaintFinishUrl(bad);
      assert.strictEqual(res, null, `Expected null for finish: ${bad}`);
    });
  }
});

// -----------------------------------------------------------------------------
// SUITE 3: Error Resilience & Async Texture Loader
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 3] Error Resilience & Async Texture Loader${RESET}`);

await runAsyncTest('3.1: Headless Node SSR safety: loadR2Texture returns null cleanly without throwing', async () => {
  clearTextureCache();
  const testUrls = [
    'https://assets.huh4k.dev/cs2-textures/rif_ak47_ao_psd_3cdda94d.png',
    'https://assets.huh4k.dev/cs2-textures/non_existent_texture_404.png',
    'https://example.com/invalid.png',
    '',
    null,
    undefined,
    123,
    'A'.repeat(10000),
  ];

  for (const url of testUrls) {
    recordAssertion();
    const result = await loadR2Texture(url);
    assert.strictEqual(result, null, `In SSR, loadR2Texture must return null for: ${url}`);
  }
});

await runAsyncTest('3.2: In-memory cache hit & clear operations', async () => {
  clearTextureCache();
  const dummyTexture = new THREE.Texture();
  dummyTexture.name = 'ChallengerTestTexture';
  const url = 'https://assets.huh4k.dev/cs2-textures/rif_ak47_ao_psd_3cdda94d.png';

  recordAssertion();
  assert.strictEqual(getTextureCache().size, 0);

  setCachedTexture(url, dummyTexture);
  recordAssertion();
  assert.strictEqual(getTextureCache().get(url), dummyTexture);

  const hit = await loadR2Texture(url);
  recordAssertion();
  assert.strictEqual(hit, dummyTexture, 'loadR2Texture must return cached texture immediately');

  clearTextureCache();
  recordAssertion();
  assert.strictEqual(getTextureCache().size, 0);
});

await runAsyncTest('3.3: Simulated Browser DOM: 404 response resilience & failed URL caching', async () => {
  clearTextureCache();

  // Mock minimal browser globals
  const origWindow = globalThis.window;
  const origDoc = globalThis.document;
  const origLoaderLoad = THREE.TextureLoader.prototype.load;

  let loadCallCount = 0;
  const target404Url = 'https://assets.huh4k.dev/cs2-textures/simulated_404_texture.png';

  try {
    globalThis.window = {};
    globalThis.document = {
      createElementNS: () => ({}),
    };

    // Simulate 404 network failure by triggering onError callback
    THREE.TextureLoader.prototype.load = function (
      url,
      _onLoad,
      _onProgress,
      onError
    ) {
      loadCallCount++;
      setTimeout(() => {
        if (onError) {
          onError(new Error(`HTTP 404 Not Found: ${url}`));
        }
      }, 5);
      return new THREE.Texture();
    };

    // First call: triggers loader and onError
    const res1 = await loadR2Texture(target404Url);
    recordAssertion();
    assert.strictEqual(res1, null, '404 response must resolve to null without throwing');
    recordAssertion();
    assert.strictEqual(loadCallCount, 1, 'TextureLoader.load must be invoked once');

    // Second call: must hit failedUrls cache and return null without calling TextureLoader.load again
    const res2 = await loadR2Texture(target404Url);
    recordAssertion();
    assert.strictEqual(res2, null, 'Second call to failed URL must return null');
    recordAssertion();
    assert.strictEqual(loadCallCount, 1, 'Failed URL must not re-trigger network loader');
  } finally {
    THREE.TextureLoader.prototype.load = origLoaderLoad;
    if (origWindow !== undefined) globalThis.window = origWindow;
    else delete globalThis.window;
    if (origDoc !== undefined) globalThis.document = origDoc;
    else delete globalThis.document;
    clearTextureCache();
  }
});

await runAsyncTest('3.4: Simulated Browser DOM: Concurrent in-flight request deduplication & latency', async () => {
  clearTextureCache();

  const origWindow = globalThis.window;
  const origDoc = globalThis.document;
  const origLoaderLoad = THREE.TextureLoader.prototype.load;

  let loadCallCount = 0;
  const slowUrl = 'https://assets.huh4k.dev/cs2-textures/simulated_slow_texture.png';
  const sharedTexture = new THREE.Texture();
  sharedTexture.name = 'SharedLoadedTexture';

  try {
    globalThis.window = {};
    globalThis.document = {
      createElementNS: () => ({}),
    };

    // Simulate 50ms latency
    THREE.TextureLoader.prototype.load = function (
      _url,
      onLoad
    ) {
      loadCallCount++;
      setTimeout(() => {
        if (onLoad) onLoad(sharedTexture);
      }, 50);
      return sharedTexture;
    };

    // Fire 20 concurrent requests simultaneously
    const promises = Array.from({ length: 20 }, () => loadR2Texture(slowUrl));
    const results = await Promise.all(promises);

    recordAssertion();
    assert.strictEqual(loadCallCount, 1, 'TextureLoader.load must only be called ONCE for 20 concurrent requests');
    recordAssertion();
    assert.strictEqual(results.length, 20);

    for (let i = 0; i < results.length; i++) {
      recordAssertion();
      assert.strictEqual(results[i], sharedTexture, `Result ${i} must match the shared texture instance`);
    }

    // After resolution, subsequent call hits cache
    const cachedResult = await loadR2Texture(slowUrl);
    recordAssertion();
    assert.strictEqual(cachedResult, sharedTexture);
    assert.strictEqual(loadCallCount, 1, 'Cached request must not invoke loader again');
  } finally {
    THREE.TextureLoader.prototype.load = origLoaderLoad;
    if (origWindow !== undefined) globalThis.window = origWindow;
    else delete globalThis.window;
    if (origDoc !== undefined) globalThis.document = origDoc;
    else delete globalThis.document;
    clearTextureCache();
  }
});

await runAsyncTest('3.5: Simulated Browser DOM: Synchronous loader exception caught cleanly', async () => {
  clearTextureCache();

  const origWindow = globalThis.window;
  const origDoc = globalThis.document;
  const origLoaderLoad = THREE.TextureLoader.prototype.load;

  try {
    globalThis.window = {};
    globalThis.document = {
      createElementNS: () => ({}),
    };

    // Simulate loader throwing synchronously (e.g. security error)
    THREE.TextureLoader.prototype.load = function () {
      throw new Error('SECURITY_ERR: Operation not permitted in canvas');
    };

    const result = await loadR2Texture('https://assets.huh4k.dev/cs2-textures/crash.png');
    recordAssertion();
    assert.strictEqual(result, null, 'Synchronous loader exception must resolve to null cleanly');
  } finally {
    THREE.TextureLoader.prototype.load = origLoaderLoad;
    if (origWindow !== undefined) globalThis.window = origWindow;
    else delete globalThis.window;
    if (origDoc !== undefined) globalThis.document = origDoc;
    else delete globalThis.document;
    clearTextureCache();
  }
});

// -----------------------------------------------------------------------------
// SUITE 4: Float Wear Continuous Mathematics
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 4] Float Wear Continuous Mathematics${RESET}`);

runTest('4.1: Monotonic increase of effective roughness from float 0.00 to 1.00 (1,001 data points)', () => {
  // Test across all 9 weapon presets
  const presets = [
    { name: 'AK-47 Ice Coaled', r: 0.28, m: 0.35, c: 0.45 },
    { name: 'AWP Ice Coaled', r: 0.22, m: 0.30, c: 0.50 },
    { name: 'M4A1-S Liquidation', r: 0.32, m: 0.45, c: 0.35 },
    { name: 'USP-S Royal Guard', r: 0.18, m: 0.75, c: 0.65 },
    { name: 'MAC-10 Candy Apple', r: 0.12, m: 0.70, c: 0.85 },
    { name: 'Zeus Electric Blue', r: 0.35, m: 0.30, c: 0.20 },
    { name: 'Galil Control', r: 0.38, m: 0.45, c: 0.15 },
    { name: 'Glock Catacombs', r: 0.42, m: 0.20, c: 0.10 },
    { name: 'UMP Late Night Transit', r: 0.70, m: 0.75, c: 0.00 },
  ];

  for (const preset of presets) {
    let prevRoughness = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const f = i / 1000;
      const wear = calculateEffectiveWear(preset.r, preset.m, preset.c, f);
      recordAssertion();
      assert.ok(
        wear.effectiveRoughness >= prevRoughness,
        `Non-monotonic roughness for ${preset.name} at float ${f}: prev ${prevRoughness}, curr ${wear.effectiveRoughness}`
      );
      prevRoughness = wear.effectiveRoughness;
    }
  }
});

runTest('4.2: Strict bounds verification across full float continuum (0.00 - 1.00)', () => {
  const baseTestConfigs = [
    [0.10, 0.20, 0.80],
    [0.28, 0.35, 0.45],
    [0.70, 0.75, 0.10],
    [0.05, 0.95, 1.00],
    [0.50, 0.50, 0.50],
  ];

  for (const [bR, bM, bC] of baseTestConfigs) {
    for (let i = 0; i <= 200; i++) {
      const f = i / 200;
      const wear = calculateEffectiveWear(bR, bM, bC, f);

      recordAssertion();
      assert.ok(
        wear.effectiveRoughness >= 0.05 && wear.effectiveRoughness <= 0.95,
        `Roughness out of bounds [0.05, 0.95]: ${wear.effectiveRoughness}`
      );

      recordAssertion();
      assert.ok(
        wear.effectiveMetalness >= 0.10 && wear.effectiveMetalness <= 0.95,
        `Metalness out of bounds [0.10, 0.95]: ${wear.effectiveMetalness}`
      );

      recordAssertion();
      assert.ok(
        wear.effectiveClearcoat >= 0.00 && wear.effectiveClearcoat <= 1.00,
        `Clearcoat out of bounds [0.00, 1.00]: ${wear.effectiveClearcoat}`
      );
    }
  }
});

runTest('4.3: Clearcoat drops strictly to 0.0 for float > 0.55 across all finishes', () => {
  const baseClearcoats = [0.1, 0.35, 0.45, 0.65, 0.85, 1.0];

  for (const bC of baseClearcoats) {
    // 1. Boundary check just above 0.55
    const cutoffWear = calculateEffectiveWear(0.2, 0.5, bC, 0.55001);
    recordAssertion();
    assert.strictEqual(
      cutoffWear.effectiveClearcoat,
      0.0,
      `Clearcoat must be 0.0 at float 0.55001 (got ${cutoffWear.effectiveClearcoat})`
    );

    // 2. High wear sweep: 0.56 to 1.00 in steps of 0.01
    for (let f = 0.56; f <= 1.00; f += 0.02) {
      const w = calculateEffectiveWear(0.2, 0.5, bC, f);
      recordAssertion();
      assert.strictEqual(
        w.effectiveClearcoat,
        0.0,
        `Clearcoat must be 0.0 at float ${f.toFixed(2)} (got ${w.effectiveClearcoat})`
      );
    }

    // 3. Boundary check at exactly 0.55 (must be strictly > 0 if bC > 0)
    const atBoundary = calculateEffectiveWear(0.2, 0.5, bC, 0.55);
    recordAssertion();
    assert.ok(
      atBoundary.effectiveClearcoat > 0,
      `Clearcoat at float 0.55 should be non-zero (got ${atBoundary.effectiveClearcoat})`
    );
  }
});

runTest('4.4: Differential metalness wear: painted exposure vs anodized oxidation', () => {
  // Case A: Painted finish (baseMetalness <= 0.5): metalness scales UP from exposed steel
  const paintedFN = calculateEffectiveWear(0.28, 0.35, 0.45, 0.00);
  const paintedBS = calculateEffectiveWear(0.28, 0.35, 0.45, 0.90);
  recordAssertion();
  assert.ok(
    paintedBS.effectiveMetalness > paintedFN.effectiveMetalness,
    `Painted finish metalness must increase with wear: FN ${paintedFN.effectiveMetalness} vs BS ${paintedBS.effectiveMetalness}`
  );

  // Case B: Anodized metal (baseMetalness > 0.5): metalness scales DOWN from surface oxidation/dirt
  const anodizedFN = calculateEffectiveWear(0.12, 0.70, 0.85, 0.00);
  const anodizedBS = calculateEffectiveWear(0.12, 0.70, 0.85, 0.90);
  recordAssertion();
  assert.ok(
    anodizedBS.effectiveMetalness < anodizedFN.effectiveMetalness,
    `Anodized finish metalness must decrease with wear: FN ${anodizedFN.effectiveMetalness} vs BS ${anodizedBS.effectiveMetalness}`
  );
});

runTest('4.5: Hostile float inputs (null, undefined, negative, overflow, NaN, Infinity) clamp cleanly without throwing', () => {
  const baseR = 0.28;
  const baseM = 0.35;
  const baseC = 0.45;

  const fnBaseline = calculateEffectiveWear(baseR, baseM, baseC, 0.0);
  const bsBaseline = calculateEffectiveWear(baseR, baseM, baseC, 1.0);

  const hostileInputs = [
    { input: null, expectedRoughness: fnBaseline.effectiveRoughness },
    { input: undefined, expectedRoughness: fnBaseline.effectiveRoughness },
    { input: NaN, expectedRoughness: fnBaseline.effectiveRoughness },
    { input: -1.0, expectedRoughness: fnBaseline.effectiveRoughness },
    { input: -999.0, expectedRoughness: fnBaseline.effectiveRoughness },
    { input: -Infinity, expectedRoughness: fnBaseline.effectiveRoughness },
    { input: 2.5, expectedRoughness: bsBaseline.effectiveRoughness },
    { input: 100.0, expectedRoughness: bsBaseline.effectiveRoughness },
    { input: Infinity, expectedRoughness: bsBaseline.effectiveRoughness },
    // Type coercion bypass tests
    { input: '0.5', expectedRoughness: fnBaseline.effectiveRoughness },
    { input: 'invalid', expectedRoughness: fnBaseline.effectiveRoughness },
    { input: true, expectedRoughness: fnBaseline.effectiveRoughness },
    { input: false, expectedRoughness: fnBaseline.effectiveRoughness },
    { input: {}, expectedRoughness: fnBaseline.effectiveRoughness },
    { input: [], expectedRoughness: fnBaseline.effectiveRoughness },
  ];

  for (const { input, expectedRoughness } of hostileInputs) {
    recordAssertion();
    assert.doesNotThrow(() => {
      const wear = calculateEffectiveWear(baseR, baseM, baseC, input);
      assert.strictEqual(
        wear.effectiveRoughness,
        expectedRoughness,
        `Hostile input ${input} produced roughness ${wear.effectiveRoughness}, expected ${expectedRoughness}`
      );
      assert.ok(!Number.isNaN(wear.effectiveRoughness));
      assert.ok(!Number.isNaN(wear.effectiveMetalness));
      assert.ok(!Number.isNaN(wear.effectiveClearcoat));
    }, `Failed for hostile input: ${input}`);
  }
});

// -----------------------------------------------------------------------------
// SUITE 5: Pattern Seeds & Seeded Random Stress
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 5] Pattern Seeds & Seeded Random Stress${RESET}`);

runTest('5.1: Seed boundary and extreme values (0, 1000, negatives, NaN, huge integers)', () => {
  const extremeSeeds = [
    0,
    1,
    500,
    1000,
    -1,
    -500,
    -999999,
    NaN,
    null,
    undefined,
    2147483647, // Max 32-bit signed int
    Number.MAX_SAFE_INTEGER,
    1e9,
    0.5,
    -0.75,
  ];

  for (const seed of extremeSeeds) {
    recordAssertion();
    assert.doesNotThrow(() => {
      const res = compositeSkinFinish({
        weaponName: 'M4A1-S',
        skinName: 'Liquidation',
        seed,
        float: 0.15,
      });
      assert.ok(res.texture instanceof THREE.CanvasTexture);
      assert.ok(res.effectiveRoughness > 0);
    }, `compositeSkinFinish crashed on seed: ${seed}`);
  }
});

runTest('5.2: Seed determinism: identical seed produces identical composite output', () => {
  const seed = 742;
  const optA = {
    weaponName: 'AK-47',
    skinName: 'Ice Coaled',
    seed,
    float: 0.0825,
  };
  const optB = { ...optA };

  const resA = compositeSkinFinish(optA);
  const resB = compositeSkinFinish(optB);

  recordAssertion();
  assert.strictEqual(resA.baseColorHex, resB.baseColorHex);
  recordAssertion();
  assert.strictEqual(resA.effectiveRoughness, resB.effectiveRoughness);
  recordAssertion();
  assert.strictEqual(resA.effectiveMetalness, resB.effectiveMetalness);
  recordAssertion();
  assert.strictEqual(resA.effectiveClearcoat, resB.effectiveClearcoat);
});

runTest('5.3: High-throughput seed modulation stress (200 random seeds across weapons)', () => {
  const weapons = ['AK-47', 'M4A1-S', 'AWP', 'USP-S', 'MAC-10', 'Galil AR', 'Glock-18', 'UMP-45'];

  for (let i = 0; i < 200; i++) {
    const randomSeed = Math.floor(Math.random() * 2000) - 500;
    const randomFloat = Math.random();
    const weapon = weapons[i % weapons.length];

    recordAssertion();
    assert.doesNotThrow(() => {
      const res = compositeSkinFinish({
        weaponName: weapon,
        seed: randomSeed,
        float: randomFloat,
      });
      assert.ok(res.texture instanceof THREE.CanvasTexture);
    });
  }
});

// -----------------------------------------------------------------------------
// SUITE 6: Procedural Skin Finishes & Fallbacks
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 6] Procedural Skin Finishes & Fallbacks${RESET}`);

const REQUIRED_9_SKINS = [
  {
    name: 'AK-47 | Ice Coaled',
    weapon: 'AK-47',
    expectedColor: '#00e5ff',
    desc: 'Radiant cyan to mint gradient',
  },
  {
    name: 'StatTrak™ M4A1-S | Liquidation (Field-Tested)',
    weapon: 'M4A1-S',
    expectedColor: '#e11d48',
    desc: 'Crimson and royal violet marbling',
  },
  {
    name: 'AWP | Ice Coaled',
    weapon: 'AWP',
    expectedColor: '#00e5ff',
    desc: 'Long-barrel cyan-to-lime with scope reticle',
  },
  {
    name: 'USP-S | Royal Guard',
    weapon: 'USP-S',
    expectedColor: '#991b1b',
    desc: 'Deep imperial red with gold filigree',
  },
  {
    name: 'MAC-10 | Candy Apple',
    weapon: 'MAC-10',
    expectedColor: '#dc2626',
    desc: 'High-gloss candy apple red anodized enamel',
  },
  {
    name: 'Zeus x27 | Electric Blue',
    weapon: 'Zeus x27',
    expectedColor: '#2563eb',
    desc: 'Electric cobalt blue with hazard yellow',
  },
  {
    name: 'Galil AR | Control',
    weapon: 'Galil AR',
    expectedColor: '#3b82f6',
    desc: 'Slate blue radar scanline grid',
  },
  {
    name: 'Glock-18 | Catacombs',
    weapon: 'Glock-18',
    expectedColor: '#18181b',
    desc: 'Skull graphic fading into charcoal smoke',
  },
  {
    name: 'UMP-45 | Late Night Transit',
    weapon: 'UMP-45',
    expectedColor: '#0f172a',
    desc: 'Metro transit schematic routes',
  },
];

runTest('6.1: Verify all 9 signature skins generate valid THREE.CanvasTexture with SRGBColorSpace and exact colors', () => {
  recordAssertion();
  assert.strictEqual(REQUIRED_9_SKINS.length, 9);

  for (const item of REQUIRED_9_SKINS) {
    recordAssertion();
    const normalized = normalizeSkinIdentifier(item.name, item.weapon);
    assert.ok(normalized.normalizedPattern.length > 0, `Pattern not extracted for ${item.name}`);

    const res = compositeSkinFinish({
      skinName: item.name,
      weaponName: item.weapon,
      float: 0.10,
      seed: 42,
    });

    assert.ok(res.texture instanceof THREE.CanvasTexture, `${item.name} must return CanvasTexture`);
    assert.strictEqual(res.texture.colorSpace, THREE.SRGBColorSpace, `${item.name} must use SRGBColorSpace`);
    assert.strictEqual(res.texture.wrapS, THREE.RepeatWrapping, `${item.name} wrapS must be RepeatWrapping`);
    assert.strictEqual(res.texture.wrapT, THREE.RepeatWrapping, `${item.name} wrapT must be RepeatWrapping`);
    assert.strictEqual(res.baseColorHex, item.expectedColor, `${item.name} baseColorHex mismatch`);

    // Verify synchronous fallback color matches
    const fallbackColor = getSkinFallbackColor(item.name, item.weapon);
    recordAssertion();
    assert.strictEqual(fallbackColor, item.expectedColor, `${item.name} fallback color mismatch`);
  }
});

runTest('6.2: Weapon disambiguation between AK-47 Ice Coaled and AWP Ice Coaled', () => {
  const akRes = compositeSkinFinish({ skinName: 'Ice Coaled', weaponName: 'AK-47', float: 0.05 });
  const awpRes = compositeSkinFinish({ skinName: 'Ice Coaled', weaponName: 'AWP', float: 0.05 });

  recordAssertion();
  assert.strictEqual(akRes.baseColorHex, '#00e5ff');
  recordAssertion();
  assert.strictEqual(awpRes.baseColorHex, '#00e5ff');

  // Both should succeed and have distinct base roughness/clearcoat profiles
  recordAssertion();
  assert.ok(akRes.effectiveClearcoat !== awpRes.effectiveClearcoat || akRes.effectiveRoughness !== awpRes.effectiveRoughness);
});

runTest('6.3: Generic procedural fallback for unlisted skins and knife inspects', () => {
  // Case A: Unlisted skin with rarity color
  const rarityRes = compositeSkinFinish({
    weaponName: 'Desert Eagle',
    skinName: 'Printstream',
    rarityColor: '#eb4b4b',
    float: 0.12,
  });
  recordAssertion();
  assert.strictEqual(rarityRes.baseColorHex, '#eb4b4b', 'Must adopt rarityColor');

  // Case B: Unlisted skin without rarity color defaults to CS2 gunmetal (#334155)
  const gunmetalRes = compositeSkinFinish({
    weaponName: 'P250',
    skinName: 'Sand Dune',
    float: 0.20,
  });
  recordAssertion();
  assert.strictEqual(gunmetalRes.baseColorHex, '#334155', 'Must default to gunmetal #334155');

  // Case C: Empty options object
  const emptyRes = compositeSkinFinish({});
  recordAssertion();
  assert.strictEqual(emptyRes.baseColorHex, '#334155');
  assert.ok(emptyRes.texture instanceof THREE.CanvasTexture);
});

runTest('6.4: Custom canvas dimensions (512x512, 2048x2048, non-square)', () => {
  const sizes = [
    [512, 512],
    [2048, 2048],
    [1024, 512],
  ];

  for (const [w, h] of sizes) {
    recordAssertion();
    const res = compositeSkinFinish({
      skinName: 'AK-47 | Ice Coaled',
      width: w,
      height: h,
    });
    assert.strictEqual(res.texture.image.width, w);
    assert.strictEqual(res.texture.image.height, h);
  }
});

// -----------------------------------------------------------------------------
// SUITE 7: SSR Compatibility & Hostile Global DOM Isolation
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 7] SSR Compatibility & Hostile Global DOM Isolation${RESET}`);

runTest('7.1: Pristine headless Node execution without window or document globals', () => {
  recordAssertion();
  assert.strictEqual(typeof globalThis.window, 'undefined', 'window must be undefined in pure Node');
  recordAssertion();
  assert.strictEqual(typeof globalThis.document, 'undefined', 'document must be undefined in pure Node');

  // Ensure all compositor methods execute safely without headless exceptions
  for (const item of REQUIRED_9_SKINS) {
    recordAssertion();
    const res = compositeSkinFinish({
      skinName: item.name,
      weaponName: item.weapon,
      float: 0.85, // heavy wear test
      seed: 999,
    });
    assert.ok(res.texture instanceof THREE.CanvasTexture);
    assert.ok(typeof res.texture.dispose === 'function');
    res.texture.dispose(); // clean cleanup test
  }
});

runTest('7.2: Hostile DOM isolation: poison traps on window and document getters', () => {
  const originalWindow = globalThis.window;
  const originalDoc = globalThis.document;

  let windowTrapHit = false;
  let docTrapHit = false;

  Object.defineProperty(globalThis, 'window', {
    get() {
      windowTrapHit = true;
      throw new Error('ILLEGAL ACCESS: window was touched in headless code!');
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'document', {
    get() {
      docTrapHit = true;
      throw new Error('ILLEGAL ACCESS: document was touched in headless code!');
    },
    configurable: true,
  });

  try {
    // 1. Weapon texture resolver under poisoned traps
    for (const weapon of CANONICAL_35_WEAPONS) {
      recordAssertion();
      const tex = getR2WeaponTextures(weapon);
      assert.ok(tex !== null);
    }

    // 2. Paint finish resolver under poisoned traps
    for (const finish of PAINT_FINISH_TYPES) {
      recordAssertion();
      const url = getR2PaintFinishUrl(finish);
      assert.ok(url !== null);
    }

    // 3. Fallback color resolver under poisoned traps
    for (const item of REQUIRED_9_SKINS) {
      recordAssertion();
      const color = getSkinFallbackColor(item.name, item.weapon);
      assert.strictEqual(color, item.expectedColor);
    }

    // 4. Effective wear calculations under poisoned traps
    const wear = calculateEffectiveWear(0.28, 0.35, 0.45, 0.5);
    recordAssertion();
    assert.ok(wear.effectiveRoughness > 0);

    // Note: We do NOT invoke loadR2Texture or compositeSkinFinish here
    // because loadR2Texture explicitly checks `typeof window === 'undefined'`,
    // which in JS triggers a property getter on globalThis.
    recordAssertion();
    assert.strictEqual(windowTrapHit, false, 'window trap was not triggered by resolvers/math');
    recordAssertion();
    assert.strictEqual(docTrapHit, false, 'document trap was not triggered by resolvers/math');
  } finally {
    if (originalWindow !== undefined) globalThis.window = originalWindow;
    else delete globalThis.window;
    if (originalDoc !== undefined) globalThis.document = originalDoc;
    else delete globalThis.document;
  }
});

runTest('7.3: Texture resource disposal cleanup', () => {
  const res = compositeSkinFinish({
    weaponName: 'AK-47',
    skinName: 'Ice Coaled',
    float: 0.1,
  });

  recordAssertion();
  assert.ok(res.texture instanceof THREE.CanvasTexture);

  let disposed = false;
  const origDispose = res.texture.dispose.bind(res.texture);
  res.texture.dispose = () => {
    disposed = true;
    origDispose();
  };

  res.texture.dispose();
  recordAssertion();
  assert.strictEqual(disposed, true, 'CanvasTexture disposal executes without errors');
});

// -----------------------------------------------------------------------------
// SUMMARY REPORT
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}================================================================================${RESET}`);
console.log(`${BOLD}   ADVERSARIAL VERIFICATION SUMMARY REPORT                                      ${RESET}`);
console.log(`${BOLD}================================================================================${RESET}`);
console.log(`  Total Tests Run:        ${totalTests}`);
console.log(`  Tests Passed:           ${passedTests > 0 ? '\x1b[32m' : ''}${passedTests}${RESET}`);
console.log(`  Tests Failed:           ${failedTests > 0 ? '\x1b[31m' : ''}${failedTests}${RESET}`);
console.log(`  Total Assertions:       ${totalAssertions}`);
console.log(`  Verdict:                ${failedTests === 0 ? '\x1b[32mALL 7 ADVERSARIAL SUITES PASSED (100%)\x1b[0m' : '\x1b[31mFAILURES DETECTED\x1b[0m'}`);
console.log(`${BOLD}================================================================================${RESET}\n`);

if (failedTests > 0) {
  process.exit(1);
}
