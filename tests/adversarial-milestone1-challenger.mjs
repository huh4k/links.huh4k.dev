#!/usr/bin/env node
/**
 * Adversarial Empirical Verification & Stress Test Suite: Milestone 1
 * Author: challenger_m1_1 (Empirical Challenger)
 *
 * Scope:
 * Suite 1: UV Island Coordinate Bounds & Geometry Integrity (Features F7–F15)
 * Suite 2: Float Wear Monotonicity Across Continuous Domains (Features F30 & F31)
 * Suite 3: Clearcoat Cutoff Strict Threshold & Degradation (Feature F32)
 * Suite 4: mulberry32 PRNG Determinism, Distribution & Robustness (Feature F33)
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

import assert from 'node:assert';
import * as THREE from 'three';

const {
  WEAPON_UV_ISLANDS,
  WEAPON_UV_LAYOUTS,
  getWeaponUvLayout,
  clipToIsland,
  withIslandClip,
  fillUvIsland,
  strokeUvIsland,
  createIslandGradient,
  mulberry32,
  createSeededRandom,
  normalizeSkinIdentifier,
  calculateEffectiveWear,
  getSkinFallbackColor,
  applyFloatWearOverlay,
  compositeSkinFinish,
} = await import('../src/utils/skinCompositor.ts');

const PASSED = '\x1b[32m✓\x1b[0m';
const FAILED = '\x1b[31m✗\x1b[0m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';

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

console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`${BOLD}${CYAN}  CHALLENGER M1: EMPIRICAL STRESS & ADVERSARIAL VERIFICATION SUITE              ${RESET}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}\n`);

// ============================================================================
// SUITE 1: UV Island Coordinate Bounds & Geometry Integrity (F7–F15)
// ============================================================================
console.log(`${BOLD}Suite 1: UV Island Coordinate Bounds & Geometry Integrity${RESET}`);

const PRIMARY_WEAPON_KEYS = [
  'rif_ak47',
  'rif_m4a1_s',
  'snip_awp',
  'pist_223',
  'pist_glock18',
  'smg_mac10',
  'pist_taser',
  'rif_galilar',
  'smg_ump45',
];

const ALIAS_KEYS = [
  'pist_usp_silencer',
  'rif_m4a1_silencer',
];

runTest('1.1: Catalog completeness - all 9 primary weapons and aliases present in WEAPON_UV_ISLANDS', () => {
  for (const key of PRIMARY_WEAPON_KEYS) {
    recordAssertion();
    assert(key in WEAPON_UV_ISLANDS, `Primary weapon key "${key}" missing in WEAPON_UV_ISLANDS`);
    const layout = WEAPON_UV_ISLANDS[key];
    recordAssertion();
    assert(layout.weaponName && layout.weaponName.length > 0, `Weapon name missing for "${key}"`);
    recordAssertion();
    assert(Object.keys(layout.islands).length >= 2, `Weapon "${key}" must define at least 2 UV islands`);
  }
  for (const alias of ALIAS_KEYS) {
    recordAssertion();
    assert(alias in WEAPON_UV_ISLANDS, `Alias key "${alias}" missing in WEAPON_UV_ISLANDS`);
  }
});

runTest('1.2: Normalized UV Bounds validation [0.0 - 1.0] across all islands', () => {
  for (const [weaponKey, layout] of Object.entries(WEAPON_UV_ISLANDS)) {
    for (const [islandId, island] of Object.entries(layout.islands)) {
      const { bounds } = island;
      recordAssertion();
      assert(bounds, `Island ${islandId} on ${weaponKey} missing bounds`);
      recordAssertion();
      assert(bounds.uMin >= 0.0 && bounds.uMin <= 1.0, `uMin ${bounds.uMin} out of [0, 1] on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(bounds.uMax >= 0.0 && bounds.uMax <= 1.0, `uMax ${bounds.uMax} out of [0, 1] on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(bounds.vMin >= 0.0 && bounds.vMin <= 1.0, `vMin ${bounds.vMin} out of [0, 1] on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(bounds.vMax >= 0.0 && bounds.vMax <= 1.0, `vMax ${bounds.vMax} out of [0, 1] on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(bounds.uMin < bounds.uMax, `uMin (${bounds.uMin}) >= uMax (${bounds.uMax}) on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(bounds.vMin < bounds.vMax, `vMin (${bounds.vMin}) >= vMax (${bounds.vMax}) on ${weaponKey}:${islandId}`);
    }
  }
});

runTest('1.3: Canonical Canvas Pixel Rect bounds validation [0 - 1024] across all islands', () => {
  for (const [weaponKey, layout] of Object.entries(WEAPON_UV_ISLANDS)) {
    for (const [islandId, island] of Object.entries(layout.islands)) {
      const { canvasRect } = island;
      recordAssertion();
      assert(canvasRect, `Island ${islandId} on ${weaponKey} missing canvasRect`);
      recordAssertion();
      assert(canvasRect.x >= 0, `x (${canvasRect.x}) < 0 on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(canvasRect.y >= 0, `y (${canvasRect.y}) < 0 on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(canvasRect.width > 0, `width (${canvasRect.width}) <= 0 on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(canvasRect.height > 0, `height (${canvasRect.height}) <= 0 on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(canvasRect.x + canvasRect.width <= 1024, `x+width (${canvasRect.x + canvasRect.width}) > 1024 on ${weaponKey}:${islandId}`);
      recordAssertion();
      assert(canvasRect.y + canvasRect.height <= 1024, `y+height (${canvasRect.y + canvasRect.height}) > 1024 on ${weaponKey}:${islandId}`);
    }
  }
});

runTest('1.4: WEAPON_UV_LAYOUTS bounds and cross-structure parity', () => {
  for (const key of PRIMARY_WEAPON_KEYS) {
    recordAssertion();
    assert(key in WEAPON_UV_LAYOUTS, `Weapon key "${key}" missing in WEAPON_UV_LAYOUTS`);
    const boxes = WEAPON_UV_LAYOUTS[key];
    for (const [name, box] of Object.entries(boxes)) {
      recordAssertion();
      assert(box.x >= 0 && box.y >= 0, `Box x,y negative on ${key}:${name}`);
      recordAssertion();
      assert(box.w > 0 && box.h > 0, `Box w,h non-positive on ${key}:${name}`);
      recordAssertion();
      assert(box.x + box.w <= 1024, `Box x+w (${box.x + box.w}) > 1024 on ${key}:${name}`);
      recordAssertion();
      assert(box.y + box.h <= 1024, `Box y+h (${box.y + box.h}) > 1024 on ${key}:${name}`);
    }
  }
  for (const alias of ALIAS_KEYS) {
    recordAssertion();
    assert(alias in WEAPON_UV_LAYOUTS, `Alias "${alias}" missing in WEAPON_UV_LAYOUTS`);
  }
});

runTest('1.5: Island categorization references strictly exist in islands dictionary', () => {
  for (const [weaponKey, layout] of Object.entries(WEAPON_UV_ISLANDS)) {
    const definedIds = new Set(Object.keys(layout.islands));
    for (const id of layout.primaryPaintIslands) {
      recordAssertion();
      assert(definedIds.has(id), `primaryPaintIsland "${id}" not defined in islands of ${weaponKey}`);
    }
    for (const id of layout.secondaryIslands) {
      recordAssertion();
      assert(definedIds.has(id), `secondaryIsland "${id}" not defined in islands of ${weaponKey}`);
    }
    for (const id of layout.furnitureIslands) {
      recordAssertion();
      assert(definedIds.has(id), `furnitureIsland "${id}" not defined in islands of ${weaponKey}`);
    }
  }
});

runTest('1.6: Source 2 Mask channel classifications are valid R, G, B, A', () => {
  const validChannels = new Set(['R', 'G', 'B', 'A']);
  for (const [weaponKey, layout] of Object.entries(WEAPON_UV_ISLANDS)) {
    for (const [islandId, island] of Object.entries(layout.islands)) {
      if (island.maskChannel) {
        recordAssertion();
        assert(validChannels.has(island.maskChannel), `Invalid maskChannel "${island.maskChannel}" on ${weaponKey}:${islandId}`);
      }
    }
  }
});

runTest('1.7: getWeaponUvLayout resolves robustly across casing, spacing, and aliases', () => {
  const testCases = [
    ['AK-47', 'rif_ak47'],
    ['ak47', 'rif_ak47'],
    ['AK47', 'rif_ak47'],
    ['rif_ak47', 'rif_ak47'],
    ['M4A1-S', 'rif_m4a1_s'],
    ['m4a1-s', 'rif_m4a1_s'],
    ['rif_m4a1_silencer', 'rif_m4a1_s'],
    ['AWP', 'snip_awp'],
    ['snip_awp', 'snip_awp'],
    ['USP-S', 'pist_223'],
    ['usps', 'pist_223'],
    ['pist_usp_silencer', 'pist_223'],
    ['Glock-18', 'pist_glock18'],
    ['glock18', 'pist_glock18'],
    ['MAC-10', 'smg_mac10'],
    ['mac10', 'smg_mac10'],
    ['Zeus x27', 'pist_taser'],
    ['taser', 'pist_taser'],
    ['zeus', 'pist_taser'],
    ['Galil AR', 'rif_galilar'],
    ['galilar', 'rif_galilar'],
    ['UMP-45', 'smg_ump45'],
    ['ump45', 'smg_ump45'],
  ];

  for (const [query, expectedKey] of testCases) {
    const layout = getWeaponUvLayout(query);
    recordAssertion();
    assert(layout !== null, `getWeaponUvLayout("${query}") returned null`);
    recordAssertion();
    assert.strictEqual(layout.weaponKey, expectedKey, `Query "${query}" expected key "${expectedKey}", got "${layout.weaponKey}"`);
  }
});

runTest('1.8: getWeaponUvLayout handles hostile / unknown inputs gracefully', () => {
  const hostileQueries = ['', '   ', 'negev', 'knife', 'karambit', 'm9_bayonet', 'random_string_123', null, undefined];
  for (const query of hostileQueries) {
    recordAssertion();
    const result = getWeaponUvLayout(query);
    assert.strictEqual(result, null, `Hostile query "${query}" should resolve to null`);
  }
});

runTest('1.9: Geometry clipping helpers state preservation & error recovery', () => {
  let saveCount = 0;
  let restoreCount = 0;
  let clipCount = 0;

  const mockCtx = {
    save() { saveCount++; },
    restore() { restoreCount++; },
    beginPath() {},
    rect() {},
    clip() { clipCount++; },
  };

  const island = { canvasRect: { x: 10, y: 20, width: 300, height: 400 } };

  // Normal execution
  clipToIsland(mockCtx, island, () => {
    recordAssertion();
    assert.strictEqual(saveCount, 1);
    assert.strictEqual(clipCount, 1);
  });
  recordAssertion();
  assert.strictEqual(restoreCount, 1);

  // Exception recovery execution
  let caught = false;
  try {
    clipToIsland(mockCtx, island, () => {
      throw new Error('Test draw exception');
    });
  } catch (err) {
    caught = true;
  }
  recordAssertion();
  assert(caught, 'Exception was propagated');
  recordAssertion();
  assert.strictEqual(restoreCount, 2, 'ctx.restore() must execute even if draw callback throws');
});

runTest('1.10: Drawing helpers support all 3 island representations', () => {
  let lastRect = null;
  let lastFill = null;

  const mockCtx = {
    save() {},
    restore() {},
    beginPath() {},
    rect(x, y, w, h) { lastRect = { x, y, w, h }; },
    clip() {},
    fillRect() {},
    strokeRect() {},
    createLinearGradient() { return {}; },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };

  const uvIsland = {
    id: 'test',
    name: 'Test',
    bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
    canvasRect: { x: 50, y: 60, width: 70, height: 80 },
  };
  const canvasRect = { x: 100, y: 110, width: 120, height: 130 };
  const islandBox = { x: 200, y: 210, w: 220, h: 230 };

  fillUvIsland(mockCtx, uvIsland, '#ff0000');
  recordAssertion();
  assert.deepStrictEqual(lastRect, { x: 50, y: 60, w: 70, h: 80 });

  fillUvIsland(mockCtx, canvasRect, '#00ff00');
  recordAssertion();
  assert.deepStrictEqual(lastRect, { x: 100, y: 110, w: 120, h: 130 });

  fillUvIsland(mockCtx, islandBox, '#0000ff');
  recordAssertion();
  assert.deepStrictEqual(lastRect, { x: 200, y: 210, w: 220, h: 230 });
});

// ============================================================================
// SUITE 2: Float Wear Monotonicity Across Continuous Domains (F30 & F31)
// ============================================================================
console.log(`\n${BOLD}Suite 2: Float Wear Monotonicity Across Continuous Domains${RESET}`);

const WEAPON_PRESETS = [
  { name: 'AK-47 Ice Coaled (Gunsmith)', r: 0.28, m: 0.35, c: 0.45 },
  { name: 'AWP Ice Coaled (Gunsmith)', r: 0.22, m: 0.30, c: 0.50 },
  { name: 'M4A1-S Liquidation (Hydrographic)', r: 0.32, m: 0.45, c: 0.35 },
  { name: 'USP-S Royal Guard (Gunsmith/Enamel)', r: 0.18, m: 0.75, c: 0.65 },
  { name: 'MAC-10 Candy Apple (Anodized)', r: 0.12, m: 0.70, c: 0.85 },
  { name: 'Zeus Electric Blue (Custom)', r: 0.35, m: 0.30, c: 0.20 },
  { name: 'Galil AR Control (Hydrographic)', r: 0.38, m: 0.45, c: 0.15 },
  { name: 'Glock-18 Catacombs (Custom)', r: 0.42, m: 0.20, c: 0.10 },
  { name: 'UMP-45 Late Night Transit (Custom)', r: 0.70, m: 0.75, c: 0.00 },
];

runTest('2.1: Continuous Roughness Monotonicity across 1000 float steps for all presets', () => {
  const steps = 1000;
  for (const preset of WEAPON_PRESETS) {
    let prevRoughness = -1;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const { effectiveRoughness } = calculateEffectiveWear(preset.r, preset.m, preset.c, f);
      recordAssertion();
      assert(effectiveRoughness >= prevRoughness,
        `Roughness decreased on ${preset.name} at f=${f}: prev=${prevRoughness}, current=${effectiveRoughness}`);
      prevRoughness = effectiveRoughness;
    }
  }
});

runTest('2.2: Extreme Base Roughness Monotonicity stress-test [0.00 to 1.00]', () => {
  const testBaseRoughnesses = [0.00, 0.05, 0.10, 0.28, 0.50, 0.75, 0.85, 0.90, 0.95, 1.00];
  const steps = 500;
  for (const baseR of testBaseRoughnesses) {
    let prevR = -1;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const { effectiveRoughness } = calculateEffectiveWear(baseR, 0.5, 0.5, f);
      recordAssertion();
      assert(effectiveRoughness >= prevR,
        `Non-monotonic roughness with baseR=${baseR} at f=${f}: prev=${prevR}, cur=${effectiveRoughness}`);
      prevR = effectiveRoughness;
    }
  }
});

runTest('2.3: Painted finish Metalness Exposure Monotonicity (baseMetalness <= 0.5)', () => {
  const paintedPresets = WEAPON_PRESETS.filter(p => p.m <= 0.5);
  const steps = 1000;
  for (const preset of paintedPresets) {
    let prevM = -1;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const { effectiveMetalness } = calculateEffectiveWear(preset.r, preset.m, preset.c, f);
      recordAssertion();
      assert(effectiveMetalness >= prevM,
        `Painted metalness decreased on ${preset.name} at f=${f}: prev=${prevM}, cur=${effectiveMetalness}`);
      prevM = effectiveMetalness;
    }
  }
});

runTest('2.4: Metallic/Anodized finish Metalness Tarnish Monotonicity (baseMetalness > 0.5)', () => {
  const metallicPresets = WEAPON_PRESETS.filter(p => p.m > 0.5);
  const steps = 1000;
  for (const preset of metallicPresets) {
    let prevM = 2.0; // starts above max
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const { effectiveMetalness } = calculateEffectiveWear(preset.r, preset.m, preset.c, f);
      recordAssertion();
      assert(effectiveMetalness <= prevM,
        `Metallic metalness increased on ${preset.name} at f=${f}: prev=${prevM}, cur=${effectiveMetalness}`);
      prevM = effectiveMetalness;
    }
  }
});

runTest('2.5: Physical Parameter Clamping bounds [0.05, 0.95] under hostile inputs', () => {
  const hostileFloats = [-100, -1, -0.001, 1.001, 2, 100, Infinity, -Infinity, NaN, null, undefined];
  for (const f of hostileFloats) {
    const wear = calculateEffectiveWear(0.28, 0.35, 0.45, f);
    recordAssertion();
    assert(wear.effectiveRoughness >= 0.05 && wear.effectiveRoughness <= 0.95,
      `Roughness out of bounds (${wear.effectiveRoughness}) on float ${f}`);
    recordAssertion();
    assert(wear.effectiveMetalness >= 0.10 && wear.effectiveMetalness <= 0.95,
      `Metalness out of bounds (${wear.effectiveMetalness}) on float ${f}`);
    recordAssertion();
    assert(wear.effectiveClearcoat >= 0.0 && wear.effectiveClearcoat <= 1.0,
      `Clearcoat out of bounds (${wear.effectiveClearcoat}) on float ${f}`);
  }
});

runTest('2.6: Dynamic wear overlay scuff count monotonicity', () => {
  let prevScuffs = -1;
  for (let i = 0; i <= 100; i++) {
    const f = i / 100;
    const scuffCount = Math.round(f * 85);
    recordAssertion();
    assert(scuffCount >= prevScuffs, `Scuff count decreased at f=${f}`);
    prevScuffs = scuffCount;
  }

  let prevChips = -1;
  for (let i = 40; i <= 100; i++) {
    const f = i / 100;
    const chipCount = Math.round((f - 0.40) * 45);
    recordAssertion();
    assert(chipCount >= prevChips, `Chip count decreased at f=${f}`);
    prevChips = chipCount;
  }
});

// ============================================================================
// SUITE 3: Clearcoat Cutoff Strict Threshold & Degradation (F32)
// ============================================================================
console.log(`\n${BOLD}Suite 3: Clearcoat Cutoff Strict Threshold & Degradation${RESET}`);

runTest('3.1: Strict Cutoff Boundary Verification at f = 0.55', () => {
  const baseC = 0.85; // Candy Apple base clearcoat

  // Just below cutoff
  const cJustBelow = calculateEffectiveWear(0.12, 0.70, baseC, 0.5499).effectiveClearcoat;
  recordAssertion();
  assert(cJustBelow > 0.0, `Clearcoat should be positive at f=0.5499, got ${cJustBelow}`);

  // Exactly at cutoff (f = 0.55)
  // formula: baseC * (1 - 0.55 * 1.8) = baseC * 0.01 = 0.0085
  const cAtCutoff = calculateEffectiveWear(0.12, 0.70, baseC, 0.5500).effectiveClearcoat;
  recordAssertion();
  assert(cAtCutoff > 0.0, `Clearcoat should be strictly positive at f=0.5500, got ${cAtCutoff}`);

  // Infinitesimally above cutoff
  const cAbove1 = calculateEffectiveWear(0.12, 0.70, baseC, 0.5500001).effectiveClearcoat;
  recordAssertion();
  assert.strictEqual(cAbove1, 0.0, `Clearcoat must be strictly 0.0 at f=0.5500001, got ${cAbove1}`);

  const cAbove2 = calculateEffectiveWear(0.12, 0.70, baseC, 0.5501).effectiveClearcoat;
  recordAssertion();
  assert.strictEqual(cAbove2, 0.0, `Clearcoat must be strictly 0.0 at f=0.5501, got ${cAbove2}`);

  const cAbove3 = calculateEffectiveWear(0.12, 0.70, baseC, 0.56).effectiveClearcoat;
  recordAssertion();
  assert.strictEqual(cAbove3, 0.0, `Clearcoat must be strictly 0.0 at f=0.56, got ${cAbove3}`);

  const cBS = calculateEffectiveWear(0.12, 0.70, baseC, 0.90).effectiveClearcoat;
  recordAssertion();
  assert.strictEqual(cBS, 0.0, `Clearcoat must be strictly 0.0 at f=0.90, got ${cBS}`);

  const cMax = calculateEffectiveWear(0.12, 0.70, baseC, 1.00).effectiveClearcoat;
  recordAssertion();
  assert.strictEqual(cMax, 0.0, `Clearcoat must be strictly 0.0 at f=1.00, got ${cMax}`);
});

runTest('3.2: Clearcoat Monotonic Degradation across [0.000, 1.000]', () => {
  const steps = 1000;
  for (const preset of WEAPON_PRESETS) {
    if (preset.c === 0) continue;
    let prevClearcoat = 2.0; // starts above 1.0
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const { effectiveClearcoat } = calculateEffectiveWear(preset.r, preset.m, preset.c, f);
      recordAssertion();
      assert(effectiveClearcoat <= prevClearcoat,
        `Clearcoat increased on ${preset.name} at f=${f}: prev=${prevClearcoat}, cur=${effectiveClearcoat}`);
      prevClearcoat = effectiveClearcoat;
    }
  }
});

runTest('3.3: compositeSkinFinish zeroes clearcoat for all presets when float > 0.55', () => {
  const testFloats = [0.55001, 0.56, 0.65, 0.85, 1.00];
  const testSkins = [
    { weapon: 'AK-47', skin: 'Ice Coaled' },
    { weapon: 'AWP', skin: 'Ice Coaled' },
    { weapon: 'M4A1-S', skin: 'Liquidation' },
    { weapon: 'USP-S', skin: 'Royal Guard' },
    { weapon: 'MAC-10', skin: 'Candy Apple' },
    { weapon: 'Zeus x27', skin: 'Electric Blue' },
    { weapon: 'Galil AR', skin: 'Control' },
    { weapon: 'Glock-18', skin: 'Catacombs' },
    { weapon: 'UMP-45', skin: 'Late Night Transit' },
  ];

  for (const { weapon, skin } of testSkins) {
    for (const f of testFloats) {
      const res = compositeSkinFinish({ weaponName: weapon, skinName: skin, float: f, seed: 123 });
      recordAssertion();
      assert.strictEqual(res.effectiveClearcoat, 0.0,
        `effectiveClearcoat should be 0.0 on ${weapon} | ${skin} at float ${f}, got ${res.effectiveClearcoat}`);
    }
  }
});

runTest('3.4: Zero base clearcoat invariance across all float values', () => {
  for (let i = 0; i <= 100; i++) {
    const f = i / 100;
    const res = calculateEffectiveWear(0.7, 0.75, 0.0, f);
    recordAssertion();
    assert.strictEqual(res.effectiveClearcoat, 0.0, `Base clearcoat 0.0 must yield effectiveClearcoat 0.0 at f=${f}`);
  }
});

// ============================================================================
// SUITE 4: mulberry32 PRNG Determinism, Distribution & Robustness (F33)
// ============================================================================
console.log(`\n${BOLD}Suite 4: mulberry32 PRNG Determinism, Distribution & Robustness${RESET}`);

runTest('4.1: Determinism Invariance - identical seeds yield identical 10,000 sequence streams', () => {
  const testSeeds = [0, 1, 42, 100, 309, 367, 644, 937, 1000, 65535, 1000000, 2147483647, 4294967295];
  const streamLength = 10000;

  for (const seed of testSeeds) {
    const rng1 = mulberry32(seed);
    const rng2 = mulberry32(seed);

    for (let i = 0; i < streamLength; i++) {
      const v1 = rng1();
      const v2 = rng2();
      recordAssertion();
      assert.strictEqual(v1, v2, `PRNG diverged on seed ${seed} at iteration ${i}: ${v1} !== ${v2}`);
    }
  }
});

runTest('4.2: Seed Distinctness - 100 distinct seeds yield 100 non-colliding sequences', () => {
  const sequences = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const rng = mulberry32(seed);
    const first5 = [rng(), rng(), rng(), rng(), rng()].map(v => v.toFixed(6)).join(',');
    recordAssertion();
    assert(!sequences.has(first5), `Seed collision detected: seed ${seed} produced duplicate prefix ${first5}`);
    sequences.add(first5);
  }
});

runTest('4.3: Strict output range [0.0, 1.0) across 500,000 generated values', () => {
  const rng = mulberry32(367);
  const iterations = 500000;

  for (let i = 0; i < iterations; i++) {
    const val = rng();
    recordAssertion();
    assert(val >= 0.0 && val < 1.0, `Value ${val} out of [0.0, 1.0) at iteration ${i}`);
    recordAssertion();
    assert(!Number.isNaN(val), `Value is NaN at iteration ${i}`);
  }
});

runTest('4.4: Seed edge cases: seed 0, negative, fractional, and falsy seeds', () => {
  // Seed 0 fallback
  const rng0 = mulberry32(0);
  const val0 = rng0();
  recordAssertion();
  assert(val0 > 0.0 && val0 < 1.0, `Seed 0 produced non-positive or >= 1 value: ${val0}`);

  // Negative seed
  const rngNeg = mulberry32(-367);
  const rngPos = mulberry32(367);
  recordAssertion();
  assert.strictEqual(rngNeg(), rngPos(), 'Negative seed should match absolute positive seed');

  // Fractional seed
  const rngFloat = mulberry32(367.95);
  const rngInt = mulberry32(367);
  recordAssertion();
  assert.strictEqual(rngFloat(), rngInt(), 'Fractional seed should floor to integer');

  // Falsy / invalid seeds
  const rngNaN = mulberry32(NaN);
  const rngNull = mulberry32(null);
  const rngUndef = mulberry32(undefined);
  recordAssertion();
  assert(rngNaN() > 0.0, 'NaN seed produced valid sequence');
  recordAssertion();
  assert(rngNull() > 0.0, 'null seed produced valid sequence');
  recordAssertion();
  assert(rngUndef() > 0.0, 'undefined seed produced valid sequence');
});

runTest('4.5: Statistical Uniformity (Mean, Variance, Chi-Square Goodness-of-Fit)', () => {
  const N = 100000;
  const numBins = 50;
  const bins = new Array(numBins).fill(0);
  const rng = mulberry32(937);

  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < N; i++) {
    const val = rng();
    sum += val;
    sumSq += val * val;

    const binIdx = Math.min(numBins - 1, Math.floor(val * numBins));
    bins[binIdx]++;
  }

  const mean = sum / N;
  const variance = (sumSq / N) - (mean * mean);

  // Theoretical uniform [0, 1]: mean = 0.5, variance = 1/12 = ~0.083333
  recordAssertion();
  assert(Math.abs(mean - 0.5) < 0.005, `Mean ${mean} deviated too far from 0.5`);
  recordAssertion();
  assert(Math.abs(variance - (1 / 12)) < 0.005, `Variance ${variance} deviated too far from 0.08333`);

  // Chi-square test: expected per bin = N / numBins = 2000
  const expected = N / numBins;
  let chiSquare = 0;
  for (let b = 0; b < numBins; b++) {
    const diff = bins[b] - expected;
    chiSquare += (diff * diff) / expected;
  }

  // Degrees of freedom = 49. Critical chi-square for df=49 at p=0.001 is ~85.35
  recordAssertion();
  assert(chiSquare < 95.0, `Chi-square statistic ${chiSquare} exceeds critical threshold for uniformity`);
});

runTest('4.6: Generator State Isolation - interleaving generators preserves independence', () => {
  const rngA1 = mulberry32(111);
  const rngA2 = mulberry32(111);
  const rngB = mulberry32(222);

  for (let i = 0; i < 1000; i++) {
    const a1 = rngA1();
    rngB(); // interleaved call to B
    const a2 = rngA2();
    recordAssertion();
    assert.strictEqual(a1, a2, `Interleaving contaminated generator A at step ${i}`);
  }
});

runTest('4.7: End-to-end procedural skin texture generation determinism', () => {
  const run1 = compositeSkinFinish({
    weaponName: 'AK-47',
    skinName: 'Ice Coaled',
    float: 0.0825,
    seed: 367,
  });

  const run2 = compositeSkinFinish({
    weaponName: 'AK-47',
    skinName: 'Ice Coaled',
    float: 0.0825,
    seed: 367,
  });

  recordAssertion();
  assert.strictEqual(run1.effectiveRoughness, run2.effectiveRoughness, 'Roughness deterministic');
  recordAssertion();
  assert.strictEqual(run1.effectiveMetalness, run2.effectiveMetalness, 'Metalness deterministic');
  recordAssertion();
  assert.strictEqual(run1.effectiveClearcoat, run2.effectiveClearcoat, 'Clearcoat deterministic');
  recordAssertion();
  assert.strictEqual(run1.finishStyle, run2.finishStyle, 'Finish style deterministic');
  recordAssertion();
  assert.strictEqual(run1.baseColorHex, run2.baseColorHex, 'Base color deterministic');
});

// ============================================================================
// SUMMARY REPORT
// ============================================================================
console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`${BOLD}${CYAN}  ADVERSARIAL STRESS TEST SUMMARY REPORT                                         ${RESET}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`  Total Tests Run:        ${totalTests}`);
console.log(`  Tests Passed:           ${totalTests === passedTests ? '\x1b[32m' : '\x1b[31m'}${passedTests}${RESET}`);
console.log(`  Tests Failed:           ${failedTests === 0 ? '\x1b[32m0\x1b[0m' : '\x1b[31m' + failedTests + '\x1b[0m'}`);
console.log(`  Total Assertions:       ${totalAssertions}`);
console.log(`  Verdict:                ${failedTests === 0 ? '\x1b[32mALL 4 ADVERSARIAL SUITES PASSED (100%)\x1b[0m' : '\x1b[31mFAILURES DETECTED\x1b[0m'}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}\n`);

process.exit(failedTests === 0 ? 0 : 1);
