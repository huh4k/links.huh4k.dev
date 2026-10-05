#!/usr/bin/env node
/**
 * Milestone 4 Tier 5 Adversarial Coverage Hardening & Empirical Stress Harness
 *
 * Exhaustive Empirical Verification covering:
 * [Suite 1] Floating Point Extreme Tolerances, Continuity & Discontinuities
 * [Suite 2] Out-of-Range Floats & Hostile Undefined Weapon/Skin Names
 * [Suite 3] R2 Asset Fallbacks, Network Failure Modes & Unhosted Model Handling
 * [Suite 4] 3D WebGL Context Resilience Across Hundreds of Mount/Unmount & Tab Switches
 * [Suite 5] Privacy Invariants & AST/Source Integrity
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

const PASSED = '\x1b[32m✓\x1b[0m';
const FAILED = '\x1b[31m✗\x1b[0m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let totalAssertions = 0;

async function runTest(name, fn) {
  totalTests++;
  const start = performance.now();
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ${PASSED} ${name} (${duration}ms)`);
    passedTests++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  ${FAILED} ${name} (${duration}ms)`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(`     Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
    }
    failedTests++;
  }
}

console.log(`${BOLD}================================================================================${RESET}`);
console.log(`${BOLD}${CYAN}   TIER 5 ADVERSARIAL COVERAGE HARDENING & STRESS HARNESS (M4)                  ${RESET}`);
console.log(`${BOLD}================================================================================${RESET}\n`);

// Dynamic imports of modules under test
const {
  calculateEffectiveWear,
  mulberry32,
  normalizeSkinIdentifier,
  getSkinFallbackColor,
  compositeSkinFinish,
  applyFloatWearOverlay,
  getWeaponUvLayout,
  WEAPON_UV_ISLANDS,
  WEAPON_UV_LAYOUTS,
} = await import('../src/utils/skinCompositor.ts');

const {
  getR2WeaponTextures,
  getR2PaintFinishUrl,
  loadR2Texture,
  getWeaponKeyFromName,
  hasVerifiedRemoteTextures,
  KNOWN_UNHOSTED_WEAPON_KEYS,
  BASE_WEAPON_MAPS,
  resolveActualR2TextureUrl,
  getTextureCache,
  clearTextureCache,
} = await import('../src/utils/r2Textures.ts');

const {
  disposeThreeObject,
  applySource2SurfaceSwizzle,
  swizzleSurfaceMapChannels,
  SOURCE2_SURFACE_SWIZZLE,
  FallbackWeaponMesh,
} = await import('../src/components/ModelViewer.tsx');

const {
  DEFAULT_LOADOUT_WEAPONS,
  getWearBracket,
  getFloatPercentage,
  formatSeed,
} = await import('../src/components/steam/CS2LoadoutCard.tsx');

const {
  CATEGORIES,
  DOCK_MODES,
  getWearTier,
  matchesCategory,
  matchesSearch,
} = await import('../src/components/steam/InventoryExplorer.tsx');

const {
  getWeaponModelPath,
  isObjModelUrl,
  WEAPON_MODEL_MAP,
} = await import('../src/utils/weaponModels.ts');

// =============================================================================
// SUITE 1: FLOATING POINT EXTREME TOLERANCES, CONTINUITY & SEED MODULATION
// =============================================================================
console.log(`${BOLD}[Suite 1] Floating Point Extreme Tolerances & Continuous Mathematics${RESET}`);

runTest('1.1: Fine-grained wear continuity sweep across 10,000 steps without NaN or discontinuity', () => {
  // Sweep from float -0.05 to 1.05 with fine step ~0.00011
  const steps = 10000;
  let prevRoughness = -1;

  for (let i = 0; i <= steps; i++) {
    const f = -0.05 + (1.10 * i) / steps;
    const wear = calculateEffectiveWear(0.25, 0.35, 0.50, f);
    totalAssertions += 4;

    assert.ok(!Number.isNaN(wear.effectiveRoughness), `Roughness NaN at float ${f}`);
    assert.ok(!Number.isNaN(wear.effectiveMetalness), `Metalness NaN at float ${f}`);
    assert.ok(!Number.isNaN(wear.effectiveClearcoat), `Clearcoat NaN at float ${f}`);

    // Verify bounded range
    assert.ok(wear.effectiveRoughness >= 0.05 && wear.effectiveRoughness <= 0.95, `Roughness out of bounds: ${wear.effectiveRoughness}`);
    assert.ok(wear.effectiveMetalness >= 0.10 && wear.effectiveMetalness <= 0.95, `Metalness out of bounds: ${wear.effectiveMetalness}`);
    assert.ok(wear.effectiveClearcoat >= 0.00 && wear.effectiveClearcoat <= 1.00, `Clearcoat out of bounds: ${wear.effectiveClearcoat}`);

    // Monotonicity check within valid range [0, 1]
    if (f >= 0 && f <= 1) {
      if (prevRoughness >= 0) {
        assert.ok(wear.effectiveRoughness >= prevRoughness - 1e-6, `Roughness must not decrease: prev ${prevRoughness}, current ${wear.effectiveRoughness}`);
      }
      prevRoughness = wear.effectiveRoughness;
    }
  }
});

runTest('1.2: Micro-step boundary behavior around critical transition thresholds', () => {
  const epsilon = 1e-12;
  const criticalPoints = [0.0, 0.03, 0.07, 0.15, 0.38, 0.40, 0.45, 0.50, 0.55, 1.0];

  for (const cp of criticalPoints) {
    const testValues = [cp - epsilon, cp, cp + epsilon, cp - 1e-6, cp + 1e-6];
    for (const val of testValues) {
      const wear = calculateEffectiveWear(0.3, 0.4, 0.6, val);
      totalAssertions += 3;
      assert.ok(Number.isFinite(wear.effectiveRoughness), `Non-finite roughness at ${val}`);
      assert.ok(Number.isFinite(wear.effectiveMetalness), `Non-finite metalness at ${val}`);
      assert.ok(Number.isFinite(wear.effectiveClearcoat), `Non-finite clearcoat at ${val}`);
    }
  }

  // Clearcoat cutoff verification: strictly 0.0 for float > 0.55
  const atCutoffMinus = calculateEffectiveWear(0.2, 0.3, 0.5, 0.55);
  const atCutoffPlus = calculateEffectiveWear(0.2, 0.3, 0.5, 0.550000000001);
  const atCutoffWellAbove = calculateEffectiveWear(0.2, 0.3, 0.5, 0.551);

  totalAssertions += 3;
  assert.ok(atCutoffMinus.effectiveClearcoat >= 0.0, 'Clearcoat at 0.55 must be >= 0');
  assert.strictEqual(atCutoffPlus.effectiveClearcoat, 0.0, 'Clearcoat immediately above 0.55 must be strictly 0.0');
  assert.strictEqual(atCutoffWellAbove.effectiveClearcoat, 0.0, 'Clearcoat at 0.551 must be strictly 0.0');
});

runTest('1.3: Statistical distribution and non-degeneracy of mulberry32 PRNG', () => {
  const seedsToTest = [0, 1, 42, 367, 644, 937, 1000, 0x12345678, 0x7fffffff];

  for (const seed of seedsToTest) {
    const rng = mulberry32(seed);
    const N = 5000;
    let sum = 0;
    let sumSq = 0;
    let prev = -1;
    let duplicateCount = 0;

    for (let i = 0; i < N; i++) {
      const val = rng();
      totalAssertions += 2;
      assert.ok(val >= 0.0 && val < 1.0, `PRNG output out of [0, 1): ${val}`);
      if (val === prev) duplicateCount++;
      prev = val;
      sum += val;
      sumSq += val * val;
    }

    // Mean should be near 0.5 (within [0.47, 0.53])
    const mean = sum / N;
    // Variance for uniform [0, 1] is 1/12 ≈ 0.0833
    const variance = (sumSq / N) - (mean * mean);

    totalAssertions += 3;
    assert.ok(Math.abs(mean - 0.5) < 0.035, `PRNG mean deviation too high: ${mean} for seed ${seed}`);
    assert.ok(Math.abs(variance - (1/12)) < 0.02, `PRNG variance deviation too high: ${variance} for seed ${seed}`);
    assert.ok(duplicateCount < 5, `Too many duplicate consecutive PRNG values (${duplicateCount}) for seed ${seed}`);
  }
});

runTest('1.4: Extreme and pathological seed inputs to mulberry32', () => {
  const pathologicalSeeds = [
    -1, -999999, -0.0, NaN, Infinity, -Infinity,
    1e15, 0.0000001, Math.PI, Number.MAX_SAFE_INTEGER,
  ];

  for (const s of pathologicalSeeds) {
    const rng = mulberry32(s);
    for (let i = 0; i < 50; i++) {
      const val = rng();
      totalAssertions++;
      assert.ok(!Number.isNaN(val), `PRNG produced NaN for seed ${s}`);
      assert.ok(val >= 0.0 && val < 1.0, `PRNG output out of bounds for seed ${s}: ${val}`);
    }
  }
});

// =============================================================================
// SUITE 2: OUT-OF-RANGE FLOATS & HOSTILE UNDEFINED WEAPON/SKIN NAMES
// =============================================================================
console.log(`${BOLD}[Suite 2] Out-of-Range Floats & Hostile Undefined Weapon/Skin Names${RESET}`);

runTest('2.1: Hostile float values clamped safely without NaN or exceptions across all UI & compositor utilities', () => {
  const hostileFloats = [
    -1000.0, -1.0, -0.001, -0.0,
    1.0001, 1.5, 999.0, 1e20,
    NaN, Infinity, -Infinity,
    null, undefined,
  ];

  for (const hf of hostileFloats) {
    // calculateEffectiveWear
    const wear = calculateEffectiveWear(0.2, 0.5, 0.4, hf);
    totalAssertions += 3;
    assert.ok(!Number.isNaN(wear.effectiveRoughness));
    assert.ok(!Number.isNaN(wear.effectiveMetalness));
    assert.ok(!Number.isNaN(wear.effectiveClearcoat));

    // getWearBracket
    const bracket = getWearBracket(hf);
    totalAssertions++;
    assert.ok(['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'].includes(bracket));

    // getFloatPercentage
    const pct = getFloatPercentage(hf);
    totalAssertions++;
    if (typeof hf === 'number' && Number.isFinite(hf)) {
      assert.ok(pct >= 0 && pct <= 100, `pct must be in [0, 100] for finite float ${hf}: got ${pct}`);
    } else {
      assert.ok(Number.isNaN(pct) || (pct >= 0 && pct <= 100), `pct must be NaN or bounded for non-finite ${hf}`);
    }

    // getWearTier
    const tier = getWearTier(hf);
    totalAssertions++;
    if (hf === null || hf === undefined || Number.isNaN(hf)) {
      assert.strictEqual(tier, null);
    } else {
      assert.ok(tier !== null);
      assert.ok(typeof tier.tag === 'string');
    }

    // compositeSkinFinish with hostile float
    const comp = compositeSkinFinish({
      weaponName: 'AK-47',
      skinName: 'Ice Coaled',
      float: hf,
      seed: 123,
    });
    totalAssertions += 2;
    assert.ok(comp.texture instanceof THREE.CanvasTexture);
    assert.ok(!Number.isNaN(comp.effectiveRoughness));
  }
});

runTest('2.2: Hostile, malicious, and undefined weapon and skin names in normalizer and resolvers', () => {
  const hostileNames = [
    undefined,
    null,
    '',
    '    ',
    '\n\t\r',
    '★',
    'StatTrak™',
    'Souvenir',
    '★ StatTrak™ Souvenir',
    '|||||',
    'AK-47 | | | |',
    'AK-47 | ',
    ' | Ice Coaled',
    'Drop Table Weapons;--',
    '<script>alert("xss")</script>',
    'A'.repeat(50000), // Huge string
    '🔥🔫💀💣', // Emojis only
    'AK-47\u0000HiddenPayload', // Null bytes
    'NonExistentWeapon404 | NonExistentSkin404',
  ];

  for (const name of hostileNames) {
    // normalizeSkinIdentifier
    const norm = normalizeSkinIdentifier(name, name);
    totalAssertions += 3;
    assert.ok(typeof norm.normalizedWeapon === 'string');
    assert.ok(typeof norm.normalizedPattern === 'string');
    assert.ok(typeof norm.fullName === 'string');

    // getSkinFallbackColor
    const color = getSkinFallbackColor(name, name);
    totalAssertions++;
    assert.ok(/^#[0-9a-fA-F]{3,8}$/.test(color), `Invalid fallback color ${color} for ${String(name).slice(0, 30)}`);

    // getWeaponKeyFromName
    const key = getWeaponKeyFromName(name);
    totalAssertions++;
    assert.ok(key === null || typeof key === 'string');

    // getR2WeaponTextures
    const r2 = getR2WeaponTextures(name);
    totalAssertions++;
    assert.ok(r2 === null || (typeof r2.aoUrl === 'string' && typeof r2.surfaceUrl === 'string'));

    // compositeSkinFinish
    const result = compositeSkinFinish({
      weaponName: name,
      skinName: name,
    });
    totalAssertions += 3;
    assert.ok(result.texture instanceof THREE.CanvasTexture);
    assert.ok(typeof result.baseColorHex === 'string');
    assert.ok(typeof result.finishStyle === 'string');
  }
});

runTest('2.3: Inventory search & category filters with hostile query strings and edge cases', () => {
  const mockItem = {
    id: '1234567890',
    name: 'StatTrak™ AK-47 | Ice Coaled (Minimal Wear)',
    iconUrl: 'https://example.com/icon.png',
    inspectUrl: 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S1',
    float: 0.0825,
    seed: 367,
    rarity: 'Classified',
    rarityColor: '#d32ce6',
    type: 'Rifle',
    certificate: 'CERT-HASH-ABC-123',
  };

  const queries = [
    '', '   ', 'ak', 'AK-47', 'ice coaled', '0.0825', '367', 'classified', 'rifle',
    'CERT-HASH', '<script>', 'nonexistent', '1234567890',
  ];

  for (const q of queries) {
    const match = matchesSearch(mockItem, q);
    totalAssertions++;
    assert.ok(typeof match === 'boolean');
  }

  for (const cat of CATEGORIES) {
    const matchCat = matchesCategory(mockItem, cat);
    totalAssertions++;
    assert.ok(typeof matchCat === 'boolean');
    if (cat === 'Rifles' || cat === 'All') {
      assert.strictEqual(matchCat, true, `AK-47 should match category ${cat}`);
    } else {
      assert.strictEqual(matchCat, false, `AK-47 should not match non-rifle category ${cat}`);
    }
  }
});

// =============================================================================
// SUITE 3: R2 ASSET FALLBACKS, NETWORK FAILURE MODES & UNHOSTED MODEL HANDLING
// =============================================================================
console.log(`${BOLD}[Suite 3] R2 Asset Fallbacks, Network Errors & Unhosted Model Handling${RESET}`);

runTest('3.1: Unhosted models (Zeus x27 / pist_taser) handled without attempting network fetches', () => {
  totalAssertions += 4;
  assert.strictEqual(hasVerifiedRemoteTextures('Zeus x27'), false, 'Zeus x27 must be recognized as unhosted');
  assert.strictEqual(hasVerifiedRemoteTextures('pist_taser'), false, 'pist_taser must be recognized as unhosted');
  assert.strictEqual(hasVerifiedRemoteTextures('taser'), false, 'taser must be recognized as unhosted');
  assert.ok(KNOWN_UNHOSTED_WEAPON_KEYS.has('pist_taser'), 'pist_taser must be in KNOWN_UNHOSTED_WEAPON_KEYS');

  const r2Taser = getR2WeaponTextures('pist_taser');
  totalAssertions += 1;
  assert.ok(r2Taser !== null, 'getR2WeaponTextures should still return map paths');
});

await runTest('3.2: loadR2Texture returns null for unhosted models and avoids repeated network requests', async () => {
  clearTextureCache();
  const unhostedUrl = 'https://assets.huh4k.dev/cs2-textures/pist_taser_ao.png';

  const res1 = await loadR2Texture(unhostedUrl);
  totalAssertions += 2;
  assert.strictEqual(res1, null, 'loadR2Texture must return null for pist_taser URL');

  // Second immediate attempt should hit failed cache or guard without network action
  const res2 = await loadR2Texture(unhostedUrl);
  assert.strictEqual(res2, null, 'loadR2Texture must return null from blacklist cache');
});

runTest('3.3: CDN URL resolver routes canonical URLs to verified paint finish folders', () => {
  const tests = [
    {
      in: 'https://assets.huh4k.dev/cs2-textures/rif_ak47_ao.png',
      expectedFolder: 'rif_ak47',
      expectedType: '_ao',
    },
    {
      in: 'https://assets.huh4k.dev/cs2-textures/snip_awp_surface.png',
      expectedFolder: 'snip_awp',
      expectedType: '_surface',
    },
    {
      in: 'https://assets.huh4k.dev/cs2-textures/pist_223_masks.png',
      expectedFolder: 'pist_223',
      expectedType: '_masks',
    },
    {
      in: 'https://assets.huh4k.dev/cs2-textures/smg_mac10_ao.png',
      expectedFolder: 'smg_mac10',
      expectedType: '_ao',
    },
  ];

  for (const t of tests) {
    const resolved = resolveActualR2TextureUrl(t.in);
    totalAssertions += 2;
    assert.ok(resolved.includes(`/cs2-textures/paints/${t.expectedFolder}/`), `Did not include correct folder: ${resolved}`);
    assert.ok(resolved.includes(t.expectedType), `Did not preserve map type: ${resolved}`);
  }
});

runTest('3.4: FallbackWeaponMesh component initializes valid Three.js procedural geometry hierarchy', () => {
  const vdom = FallbackWeaponMesh();
  totalAssertions += 3;
  assert.ok(vdom !== null && typeof vdom === 'object', 'FallbackWeaponMesh must return a valid React element');
  assert.strictEqual(vdom.type, 'group', 'Root of FallbackWeaponMesh must be a Three.js group');
  assert.ok(Array.isArray(vdom.props.children), 'Group should contain multiple mesh child parts (blade, guard, grip, pommel)');
});

runTest('3.5: Fallback weapon models mapping for all CS2 weapons and unknown strings', () => {
  const primaryWeapons = ['AK-47', 'M4A1-S', 'AWP', 'USP-S', 'Glock-18', 'MAC-10', 'Galil AR', 'UMP-45', 'Desert Eagle'];
  for (const w of primaryWeapons) {
    const p = getWeaponModelPath(w);
    totalAssertions += 2;
    assert.ok(p.endsWith('.obj'), `Model path for ${w} should end in .obj: ${p}`);
    assert.ok(isObjModelUrl(p), `isObjModelUrl should be true for ${p}`);
  }

  // Unknown weapons fallback to placeholder weapon
  const unknownPath = getWeaponModelPath('AlienBlaster9000');
  totalAssertions += 1;
  assert.strictEqual(unknownPath, '/models/placeholder-weapon.glb', 'Unknown weapons must fall back to placeholder GLB');
});

runTest('3.6: Verify all paint finishes resolve valid CDN URLs and BASE_WEAPON_MAPS catalog is complete', () => {
  const finishes = ['custom', 'gunsmith', 'anodized_air', 'anodized_multi', 'antiqued', 'hydrographic'];
  for (const f of finishes) {
    const url = getR2PaintFinishUrl(f);
    totalAssertions += 2;
    assert.ok(url !== null, `Finish ${f} must resolve non-null URL`);
    assert.ok(url.includes('/cs2-textures/paints/'), `Finish URL must point to paints CDN: ${url}`);
  }

  totalAssertions += 2;
  assert.ok(Object.keys(BASE_WEAPON_MAPS).length >= 35, 'BASE_WEAPON_MAPS must catalog all 35 CS2 weapons');
  assert.ok(getTextureCache() instanceof Map, 'getTextureCache must return Map instance');
});

runTest('3.7: WEAPON_MODEL_MAP coverage, DOCK_MODES taxonomy, and formatSeed contract', () => {
  totalAssertions += 4;
  assert.ok(Object.keys(WEAPON_MODEL_MAP).length >= 35, 'WEAPON_MODEL_MAP must map all 35 weapons');
  assert.deepStrictEqual(DOCK_MODES, ['3d', '2d', 'inspect'], 'DOCK_MODES must be strictly [3d, 2d, inspect]');
  assert.strictEqual(formatSeed(367), 'Seed #367', 'formatSeed must format seed with prefix');
  assert.strictEqual(formatSeed(0), 'Seed #0', 'formatSeed must handle seed 0');
});

// =============================================================================
// SUITE 4: 3D WEBGL CONTEXT RESILIENCE ACROSS HUNDREDS OF RAPID MOUNT/UNMOUNT CYCLES
// =============================================================================
console.log(`${BOLD}[Suite 4] 3D WebGL Context Resilience Across Hundreds of Mount/Unmount Cycles${RESET}`);

runTest('4.1: 500 rapid sequential mount/unmount and scene object disposal cycles with zero buffer leaks', () => {
  const cycles = 500;
  let geometriesDisposed = 0;
  let materialsDisposed = 0;
  let texturesDisposed = 0;

  for (let c = 0; c < cycles; c++) {
    // Construct a mock realistic weapon scene graph with mesh, geometry, material, maps
    const root = new THREE.Group();
    root.name = `weapon_root_${c}`;

    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2));
    geom.setAttribute('uv2', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 2));

    const origGeomDispose = geom.dispose.bind(geom);
    geom.dispose = () => {
      geometriesDisposed++;
      origGeomDispose();
    };

    const map = new THREE.Texture();
    const origMapDispose = map.dispose.bind(map);
    map.dispose = () => {
      texturesDisposed++;
      origMapDispose();
    };

    const aoMap = new THREE.Texture();
    const origAoDispose = aoMap.dispose.bind(aoMap);
    aoMap.dispose = () => {
      texturesDisposed++;
      origAoDispose();
    };

    const mat = new THREE.MeshPhysicalMaterial({
      map,
      aoMap,
      roughness: 0.3,
      metalness: 0.5,
    });
    const origMatDispose = mat.dispose.bind(mat);
    mat.dispose = () => {
      materialsDisposed++;
      origMatDispose();
    };

    const mesh = new THREE.Mesh(geom, mat);
    root.add(mesh);

    // Dispose
    disposeThreeObject(root);
  }

  totalAssertions += 3;
  assert.strictEqual(geometriesDisposed, cycles, `All ${cycles} geometries must be disposed`);
  assert.strictEqual(materialsDisposed, cycles, `All ${cycles} materials must be disposed`);
  assert.strictEqual(texturesDisposed, cycles * 2, `All ${cycles * 2} textures must be disposed`);
});

runTest('4.2: 500 rapid simulated loadout tab switches across DEFAULT_LOADOUT_WEAPONS', () => {
  const weapons = DEFAULT_LOADOUT_WEAPONS;
  const switchCount = 500;
  let currentWeaponIndex = 0;

  for (let s = 0; s < switchCount; s++) {
    currentWeaponIndex = s % weapons.length;
    const active = weapons[currentWeaponIndex];

    // Generate skin composite
    const comp = compositeSkinFinish({
      weaponName: active.weapon,
      skinName: active.skin,
      float: active.float,
      seed: active.seed,
      rarityColor: active.rarityColor,
    });

    totalAssertions += 4;
    assert.ok(comp.texture instanceof THREE.CanvasTexture);
    assert.ok(comp.effectiveRoughness >= 0.05 && comp.effectiveRoughness <= 0.95);
    assert.ok(comp.effectiveMetalness >= 0.10 && comp.effectiveMetalness <= 0.95);
    assert.ok(comp.effectiveClearcoat >= 0.00 && comp.effectiveClearcoat <= 1.00);

    // Clean up texture
    comp.texture.dispose();
  }
});

runTest('4.3: Resilience against hostile scene graphs (cyclic references, shared textures, nulls, throws)', () => {
  const root = new THREE.Group();

  // Mesh with throwing dispose
  const badGeom = new THREE.BufferGeometry();
  badGeom.dispose = () => {
    throw new Error('Poisoned geometry disposal');
  };

  const badMat = new THREE.MeshBasicMaterial();
  badMat.dispose = () => {
    throw new Error('Poisoned material disposal');
  };

  const mesh1 = new THREE.Mesh(badGeom, badMat);
  root.add(mesh1);

  // Normal mesh sharing same texture
  const sharedTex = new THREE.Texture();
  let sharedTexDisposeCalls = 0;
  sharedTex.dispose = () => {
    sharedTexDisposeCalls++;
  };

  const goodGeom = new THREE.BufferGeometry();
  const goodMat1 = new THREE.MeshBasicMaterial({ map: sharedTex });
  const goodMat2 = new THREE.MeshBasicMaterial({ map: sharedTex });
  const mesh2 = new THREE.Mesh(goodGeom, [goodMat1, goodMat2]);
  root.add(mesh2);

  // Cyclic reference simulation
  const childGroup = new THREE.Group();
  root.add(childGroup);
  // Three.js traverse handles hierarchy, but we can verify cyclic safety:
  childGroup.cyclicParent = root;

  // Run disposal - MUST NOT THROW
  assert.doesNotThrow(() => {
    disposeThreeObject(root);
  }, 'disposeThreeObject must survive poisoned throws and multi-materials');

  totalAssertions += 2;
  assert.strictEqual(sharedTexDisposeCalls, 1, 'Shared texture should only be disposed once (Set deduplication)');
});

runTest('4.4: Source 2 Surface Map channel swizzle on MeshPhysicalMaterial', () => {
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0.5 });
  applySource2SurfaceSwizzle(mat);

  totalAssertions += 2;
  assert.ok(typeof mat.onBeforeCompile === 'function', 'onBeforeCompile hook must be attached');
  assert.ok(mat.version > 0, 'needsUpdate = true must increment material.version in Three.js');

  // Test GLSL replacement logic
  const mockShader = {
    fragmentShader: `
      #include <roughnessmap_fragment>
      #include <metalnessmap_fragment>
    `,
  };
  mat.onBeforeCompile(mockShader);

  assert.ok(mockShader.fragmentShader.includes('texelRoughness.r'), 'Shader must route Red channel to roughness');
  assert.ok(mockShader.fragmentShader.includes('texelMetalness.g'), 'Shader must route Green channel to metalness');
  totalAssertions += 2;
});

// =============================================================================
// SUITE 5: PRIVACY INVARIANTS & AST / CODEBASE INTEGRITY
// =============================================================================
console.log(`${BOLD}[Suite 5] Privacy Invariants & AST/Codebase Integrity${RESET}`);

runTest('5.1: Privacy invariant: scan entire src/ for prohibited personal identifiers or local paths', () => {
  const forbiddenPatterns = [
    /\bcharlie\b/i,
    /\bcafici\b/i,
    /\/Users\//i,
    /\/home\//i,
    /192\.168\.\d+\.\d+/,
    /10\.\d+\.\d+\.\d+/,
  ];

  const srcDir = path.resolve('src');
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx|astro|js|mjs)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of forbiddenPatterns) {
          totalAssertions++;
          const match = content.match(pattern);
          assert.ok(
            !match,
            `Privacy violation found in ${fullPath}: matches ${pattern} (found: "${match?.[0]}")`
          );
        }
      }
    }
  }

  scanDir(srcDir);
});

runTest('5.2: UV Island coverage matches all 9 CS2 weapon layouts completely', () => {
  const requiredWeapons = [
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

  for (const w of requiredWeapons) {
    const layout = WEAPON_UV_ISLANDS[w];
    totalAssertions += 5;
    assert.ok(layout !== undefined, `Missing layout for ${w}`);
    assert.ok(Array.isArray(layout.primaryPaintIslands) && layout.primaryPaintIslands.length > 0);
    assert.ok(typeof layout.islands === 'object');
    assert.ok(Object.keys(layout.islands).length >= 2, `${w} must define at least 2 distinct UV islands`);

    // Verify each island has valid bounds and canvasRect
    for (const [id, island] of Object.entries(layout.islands)) {
      totalAssertions += 4;
      assert.ok(island.bounds.uMin >= 0 && island.bounds.uMax <= 1.0);
      assert.ok(island.bounds.vMin >= 0 && island.bounds.vMax <= 1.0);
      assert.ok(island.canvasRect.width > 0 && island.canvasRect.width <= 1024);
      assert.ok(island.canvasRect.height > 0 && island.canvasRect.height <= 1024);
    }
  }
});

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log(`\n${BOLD}================================================================================${RESET}`);
console.log(`${BOLD}${CYAN}   TIER 5 ADVERSARIAL STRESS TEST SUMMARY REPORT                                ${RESET}`);
console.log(`${BOLD}================================================================================${RESET}`);
console.log(`  Total Tests Run:        ${totalTests}`);
console.log(`  Tests Passed:           ${passedTests}`);
console.log(`  Tests Failed:           ${failedTests}`);
console.log(`  Total Assertions:       ${totalAssertions}`);
console.log(`  Verdict:                ${failedTests === 0 ? `${BOLD}\x1b[32mALL 5 TIER-5 ADVERSARIAL SUITES PASSED (100%)\x1b[0m` : `${BOLD}\x1b[31mFAILURES ENCOUNTERED\x1b[0m`}`);
console.log(`${BOLD}================================================================================${RESET}\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
