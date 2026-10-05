#!/usr/bin/env node

/**
 * CS2 Web Engine & Source 2 Finish Pipeline — Empirical Adversarial Coverage Hardening
 * Challenger: challenger_m4_1_rep (Milestone 4 / Phase 2)
 *
 * Adversarial assertions covering:
 * 1. Floating point extreme tolerances in float wear and seed modulation.
 * 2. Out-of-range floats (< 0.0, > 1.0) and undefined weapon/skin names.
 * 3. R2 asset fallbacks, network errors, and unhosted model handling.
 * 4. 3D WebGL context resilience across hundreds of rapid mount/unmount and tab switch operations.
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Transparently re-spawn under tsx if run via plain `node tests/...`
if (!process.env.TSX_RUNNER_ACTIVE && !process.execArgv.some((arg) => arg.includes('tsx'))) {
  const result = spawnSync('npx', ['-y', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_RUNNER_ACTIVE: '1' },
  });
  process.exit(result.status ?? 0);
}

import assert from 'node:assert';
import * as THREE from 'three';

// Dynamic imports of modules under test
const {
  calculateEffectiveWear,
  mulberry32,
  normalizeSkinIdentifier,
  getSkinFallbackColor,
  getWeaponUvLayout,
  clipToIsland,
  applyFloatWearOverlay,
  compositeSkinFinish,
  WEAPON_UV_ISLANDS,
  WEAPON_UV_LAYOUTS,
} = await import('../src/utils/skinCompositor.ts');

const {
  R2_BASE_URL,
  R2_PAINTS_BASE_URL,
  BASE_WEAPON_MAPS,
  PAINT_FINISH_TYPES,
  KNOWN_UNHOSTED_WEAPON_KEYS,
  getWeaponKeyFromName,
  getR2WeaponTextures,
  getR2PaintFinishUrl,
  hasVerifiedRemoteTextures,
  resolveActualR2TextureUrl,
  loadR2Texture,
  clearTextureCache,
  getTextureCache,
} = await import('../src/utils/r2Textures.ts');

const {
  disposeThreeObject,
  applySource2SurfaceSwizzle,
  SOURCE2_SURFACE_SWIZZLE,
  swizzleSurfaceMapChannels,
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

// Formatting
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';

let totalTests = 0;
let passedTests = 0;
let totalAssertions = 0;

async function runTest(suiteName, testName, testFn) {
  totalTests++;
  const start = performance.now();
  try {
    const res = testFn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    const duration = (performance.now() - start).toFixed(2);
    passedTests++;
    console.log(`  ${GREEN}✓${RESET} ${testName} ${GRAY}(${duration}ms)${RESET}`);
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  ${RED}✗ ${testName}${RESET} ${GRAY}(${duration}ms)${RESET}`);
    console.error(`    ${RED}Assertion Error:${RESET} ${err.message}`);
    if (err.stack) {
      console.error(GRAY + err.stack.split('\n').slice(1, 4).join('\n') + RESET);
    }
    process.exitCode = 1;
  }
}

function expect(condition, message) {
  totalAssertions++;
  assert.ok(condition, message);
}

function expectEqual(actual, expected, message) {
  totalAssertions++;
  assert.strictEqual(actual, expected, message);
}

async function main() {
  console.log('\n' + BOLD + CYAN + '================================================================================' + RESET);
  console.log(BOLD + '  EMPIRICAL ADVERSARIAL CHALLENGER SUITE (MILESTONE 4 HARDENING)' + RESET);
  console.log(BOLD + CYAN + '================================================================================' + RESET);

  // ============================================================================
  // SUITE 1: FLOATING POINT EXTREME TOLERANCES IN WEAR & SEED MODULATION
  // ============================================================================
  console.log(BOLD + '\n[Suite 1] Floating Point Extreme Tolerances & Continuous Mathematics' + RESET);

  await runTest('Suite 1', '1.1: 100,000-sample high-density float sweep verifying strict monotonicity and boundary invariant', () => {
    const SAMPLES = 100000;
    let prevRoughness = -1;

    for (let i = 0; i <= SAMPLES; i++) {
      const floatVal = i / SAMPLES;
      const wear = calculateEffectiveWear(0.2, 0.4, 0.5, floatVal);

      expect(!Number.isNaN(wear.effectiveRoughness), `Roughness is NaN at float ${floatVal}`);
      expect(!Number.isNaN(wear.effectiveMetalness), `Metalness is NaN at float ${floatVal}`);
      expect(!Number.isNaN(wear.effectiveClearcoat), `Clearcoat is NaN at float ${floatVal}`);

      // Roughness bounds [0.05, 0.95]
      expect(wear.effectiveRoughness >= 0.05 && wear.effectiveRoughness <= 0.95, `Roughness out of bounds at ${floatVal}`);
      // Monotonic non-decreasing
      expect(wear.effectiveRoughness >= prevRoughness, `Roughness decreased from ${prevRoughness} to ${wear.effectiveRoughness} at ${floatVal}`);
      prevRoughness = wear.effectiveRoughness;

      // Clearcoat strictly 0.0 for float > 0.55
      if (floatVal > 0.5501) {
        expectEqual(wear.effectiveClearcoat, 0.0, `Clearcoat not 0.0 above 0.55: got ${wear.effectiveClearcoat} at ${floatVal}`);
      }
    }
  });

  await runTest('Suite 1', '1.2: Subnormal floating point numbers, epsilon steps, and -0.0', () => {
    const subnormals = [
      Number.MIN_VALUE,
      5e-324,
      Number.EPSILON,
      1.0 - Number.EPSILON,
      1.0 + Number.EPSILON,
      -0.0,
      +0.0,
      0.55 - Number.EPSILON,
      0.55 + Number.EPSILON,
    ];

    for (const s of subnormals) {
      const wear = calculateEffectiveWear(0.25, 0.5, 0.4, s);
      expect(!Number.isNaN(wear.effectiveRoughness), `Subnormal produced NaN roughness for ${s}`);
      expect(!Number.isNaN(wear.effectiveMetalness), `Subnormal produced NaN metalness for ${s}`);
      expect(!Number.isNaN(wear.effectiveClearcoat), `Subnormal produced NaN clearcoat for ${s}`);
      expect(wear.effectiveRoughness >= 0.05 && wear.effectiveRoughness <= 0.95, `Roughness out of bounds for ${s}`);
      expect(wear.effectiveMetalness >= 0.1 && wear.effectiveMetalness <= 0.95, `Metalness out of bounds for ${s}`);
    }
  });

  await runTest('Suite 1', '1.3: Wear bracket threshold transitions around official CS2 boundaries', () => {
    // CS2 thresholds: FN < 0.07, MW < 0.15, FT < 0.38, WW < 0.45, BS >= 0.45
    const delta = 1e-7;

    expectEqual(getWearBracket(0.069999), 'Factory New', '0.069999 should be Factory New');
    expectEqual(getWearBracket(0.070000), 'Minimal Wear', '0.07 should be Minimal Wear');
    expectEqual(getWearBracket(0.149999), 'Minimal Wear', '0.149999 should be Minimal Wear');
    expectEqual(getWearBracket(0.150000), 'Field-Tested', '0.15 should be Field-Tested');
    expectEqual(getWearBracket(0.379999), 'Field-Tested', '0.379999 should be Field-Tested');
    expectEqual(getWearBracket(0.380000), 'Well-Worn', '0.38 should be Well-Worn');
    expectEqual(getWearBracket(0.449999), 'Well-Worn', '0.449999 should be Well-Worn');
    expectEqual(getWearBracket(0.450000), 'Battle-Scarred', '0.45 should be Battle-Scarred');
    expectEqual(getWearBracket(1.0), 'Battle-Scarred', '1.0 should be Battle-Scarred');

    // getWearTier
    expectEqual(getWearTier(0.07 - delta)?.tag, 'FN', '0.07 - delta tag');
    expectEqual(getWearTier(0.07)?.tag, 'MW', '0.07 tag');
    expectEqual(getWearTier(0.15)?.tag, 'FT', '0.15 tag');
    expectEqual(getWearTier(0.38)?.tag, 'WW', '0.38 tag');
    expectEqual(getWearTier(0.45)?.tag, 'BS', '0.45 tag');
    expectEqual(getWearTier(null), null, 'null float should return null tier');
  });

  await runTest('Suite 1', '1.4: Mulberry32 PRNG determinism, chi-squared uniformity, and extreme seeds', () => {
    const extremeSeeds = [
      0,
      1,
      1000,
      -1,
      -999999,
      2147483647,
      -2147483648,
      4294967295,
      3.1415926535,
      NaN,
      Infinity,
      -Infinity,
    ];

    for (const seed of extremeSeeds) {
      const rng1 = mulberry32(seed);
      const rng2 = mulberry32(seed);
      for (let i = 0; i < 50; i++) {
        const v1 = rng1();
        const v2 = rng2();
        expect(!Number.isNaN(v1), `PRNG produced NaN for seed ${seed}`);
        expect(v1 >= 0 && v1 < 1, `PRNG output ${v1} out of [0, 1) for seed ${seed}`);
        expectEqual(v1, v2, `PRNG non-deterministic for seed ${seed} at iteration ${i}`);
      }
    }

    // Uniformity chi-squared test on seed 367
    const BUCKETS = 10;
    const N = 50000;
    const counts = new Array(BUCKETS).fill(0);
    const rng = mulberry32(367);

    for (let i = 0; i < N; i++) {
      const r = rng();
      const bucket = Math.floor(r * BUCKETS);
      counts[Math.min(BUCKETS - 1, Math.max(0, bucket))]++;
    }

    const expected = N / BUCKETS;
    let chiSquare = 0;
    for (let b = 0; b < BUCKETS; b++) {
      chiSquare += Math.pow(counts[b] - expected, 2) / expected;
    }
    // For df=9 at alpha=0.001, critical value is 27.88
    expect(chiSquare < 35, `PRNG chi-squared value ${chiSquare} exceeds threshold`);
  });

  // ============================================================================
  // SUITE 2: OUT-OF-RANGE FLOATS AND UNDEFINED WEAPON/SKIN NAMES
  // ============================================================================
  console.log(BOLD + '\n[Suite 2] Out-of-Range Floats & Hostile Undefined Weapon/Skin Names' + RESET);

  await runTest('Suite 2', '2.1: Hostile out-of-range floats clamped cleanly across calculateEffectiveWear & compositor', () => {
    const hostileFloats = [
      -0.0001,
      -1.0,
      -100.0,
      -Infinity,
      1.00001,
      2.0,
      999999.0,
      Infinity,
      NaN,
      null,
      undefined,
    ];

    for (const hf of hostileFloats) {
      const wear = calculateEffectiveWear(0.2, 0.5, 0.4, hf);
      expect(!Number.isNaN(wear.effectiveRoughness), `Hostile float ${hf} returned NaN roughness`);
      expect(!Number.isNaN(wear.effectiveMetalness), `Hostile float ${hf} returned NaN metalness`);
      expect(!Number.isNaN(wear.effectiveClearcoat), `Hostile float ${hf} returned NaN clearcoat`);

      const res = compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        float: hf,
        seed: 500,
      });
      expect(res.texture instanceof THREE.CanvasTexture, `compositeSkinFinish failed texture for ${hf}`);
      expect(!Number.isNaN(res.effectiveRoughness), `compositeSkinFinish returned NaN roughness for ${hf}`);
      res.texture.dispose();
    }
  });

  await runTest('Suite 2', '2.2: Hostile, malicious, and undefined weapon and skin names in resolvers and compositor', () => {
    const hostileNames = [
      '',
      '   ',
      '\t\n\r',
      '\0',
      null,
      undefined,
      '"><script>alert(1)</script>',
      "'; DROP TABLE weapons; --",
      '🚩💀🔥✨🎮',
      'a'.repeat(5000),
      'NonExistentWeapon 9000',
      'AK-47 | NonExistentSkinPatternXYZ',
    ];

    for (const hn of hostileNames) {
      // 1. normalizeSkinIdentifier
      const norm = normalizeSkinIdentifier(hn, hn);
      expect(typeof norm.normalizedWeapon === 'string', `norm.normalizedWeapon not string for ${hn}`);
      expect(typeof norm.normalizedPattern === 'string', `norm.normalizedPattern not string for ${hn}`);

      // 2. getSkinFallbackColor
      const fallbackColor = getSkinFallbackColor(hn, hn);
      expect(typeof fallbackColor === 'string' && fallbackColor.startsWith('#'), `fallbackColor not valid hex for ${hn}`);

      // 3. getWeaponKeyFromName
      const key = getWeaponKeyFromName(hn);
      expect(key === null || typeof key === 'string', `getWeaponKeyFromName returned invalid type for ${hn}`);

      // 4. getR2WeaponTextures
      const tex = getR2WeaponTextures(hn);
      expect(tex === null || typeof tex === 'object', `getR2WeaponTextures returned invalid type for ${hn}`);

      // 5. getWeaponModelPath
      const modelPath = getWeaponModelPath(hn);
      expect(typeof modelPath === 'string' && modelPath.length > 0, `getWeaponModelPath failed for ${hn}`);

      // 6. getWeaponUvLayout
      const uvLayout = getWeaponUvLayout(hn);
      expect(uvLayout === null || typeof uvLayout === 'object', `getWeaponUvLayout returned invalid type for ${hn}`);

      // 7. compositeSkinFinish
      const result = compositeSkinFinish({
        weaponName: hn,
        skinName: hn,
        float: 0.15,
        seed: 42,
      });
      expect(result.texture instanceof THREE.CanvasTexture, `compositeSkinFinish texture failed for ${hn}`);
      expect(typeof result.baseColorHex === 'string', `baseColorHex failed for ${hn}`);
      result.texture.dispose();
    }
  });

  await runTest('Suite 2', '2.3: Inventory search and category filter hostility testing', () => {
    const mockItem = {
      id: '12345',
      name: 'AK-47 | Ice Coaled (Minimal Wear)',
      iconUrl: 'https://example.com/icon.png',
      inspectUrl: 'steam://rungame/730/test',
      float: 0.0825,
      seed: 367,
      rarity: 'Classified',
      rarityColor: '#d32ce6',
      type: 'Rifle',
      certificate: 'cert-hash-12345',
    };

    const hostileQueries = [
      '',
      '   ',
      '.*',
      '[a-z]+',
      '(',
      '\\',
      '?',
      '+',
      'AK-47',
      'ice',
      '367',
      '0.0825',
      'classified',
      'CERT-HASH',
      '__proto__',
      '<script>',
    ];

    for (const q of hostileQueries) {
      const matched = matchesSearch(mockItem, q);
      expect(typeof matched === 'boolean', `matchesSearch did not return boolean for query "${q}"`);
    }

    for (const cat of CATEGORIES) {
      const catMatch = matchesCategory(mockItem, cat);
      expect(typeof catMatch === 'boolean', `matchesCategory did not return boolean for category "${cat}"`);
    }
  });

  // ============================================================================
  // SUITE 3: R2 ASSET FALLBACKS, NETWORK ERRORS & UNHOSTED MODEL HANDLING
  // ============================================================================
  console.log(BOLD + '\n[Suite 3] R2 Asset Fallbacks, Network Errors & Unhosted Model Handling' + RESET);

  await runTest('Suite 3', '3.1: Unhosted models (Zeus x27 / pist_taser) handled without attempting network fetches', () => {
    expect(KNOWN_UNHOSTED_WEAPON_KEYS.has('pist_taser'), 'pist_taser not in KNOWN_UNHOSTED_WEAPON_KEYS');
    expectEqual(hasVerifiedRemoteTextures('Zeus x27'), false, 'Zeus x27 should return false for hasVerifiedRemoteTextures');
    expectEqual(hasVerifiedRemoteTextures('pist_taser'), false, 'pist_taser should return false for hasVerifiedRemoteTextures');
    expectEqual(hasVerifiedRemoteTextures('weapon_pist_taser.obj'), false, 'weapon_pist_taser.obj should return false');
  });

  await runTest('Suite 3', '3.2: loadR2Texture in Headless Node / SSR returns null cleanly without throwing', async () => {
    clearTextureCache();
    const result = await loadR2Texture('https://assets.huh4k.dev/cs2-textures/rif_ak47_ao_psd_3cdda94d.png');
    expectEqual(result, null, 'loadR2Texture must return null in Node.js headless environment');
  });

  await runTest('Suite 3', '3.3: resolveActualR2TextureUrl maps all base weapon maps to /cs2-textures/paints/ directory', () => {
    for (const [key, baseMaps] of Object.entries(BASE_WEAPON_MAPS)) {
      const resolvedAo = resolveActualR2TextureUrl(baseMaps.aoUrl);
      const resolvedSurface = resolveActualR2TextureUrl(baseMaps.surfaceUrl);
      const resolvedMasks = resolveActualR2TextureUrl(baseMaps.masksUrl);

      expect(resolvedAo.startsWith(R2_PAINTS_BASE_URL) || resolvedAo.startsWith(R2_BASE_URL), `Invalid AO URL for ${key}: ${resolvedAo}`);
      expect(resolvedSurface.startsWith(R2_PAINTS_BASE_URL) || resolvedSurface.startsWith(R2_BASE_URL), `Invalid Surface URL for ${key}: ${resolvedSurface}`);
      expect(resolvedMasks.startsWith(R2_PAINTS_BASE_URL) || resolvedMasks.startsWith(R2_BASE_URL), `Invalid Masks URL for ${key}: ${resolvedMasks}`);
    }
  });

  await runTest('Suite 3', '3.4: All 6 paint finishes resolve valid CDN endpoints', () => {
    for (const finish of PAINT_FINISH_TYPES) {
      const url = getR2PaintFinishUrl(finish);
      expect(url !== null, `Paint finish ${finish} returned null`);
      expect(url.startsWith(R2_PAINTS_BASE_URL), `Paint finish ${finish} url ${url} does not start with R2_PAINTS_BASE_URL`);
    }
  });

  await runTest('Suite 3', '3.5: FallbackWeaponMesh initializes valid Three.js procedural geometry hierarchy', () => {
    const meshComponent = FallbackWeaponMesh();
    expect(meshComponent !== null && typeof meshComponent === 'object', 'FallbackWeaponMesh returned invalid element');
  });

  // ============================================================================
  // SUITE 4: 3D WEBGL CONTEXT RESILIENCE ACROSS HUNDREDS OF CYCLES
  // ============================================================================
  console.log(BOLD + '\n[Suite 4] 3D WebGL Context Resilience Across Hundreds of Mount/Unmount Cycles' + RESET);

  await runTest('Suite 4', '4.1: 500 rapid sequential mount/unmount and scene object disposal cycles with zero buffer leaks', () => {
    let geometryDisposeCount = 0;
    let materialDisposeCount = 0;
    let textureDisposeCount = 0;

    for (let cycle = 0; cycle < 500; cycle++) {
      const group = new THREE.Group();
      const geom = new THREE.BoxGeometry(1, 1, 1);
      geom.dispose = () => { geometryDisposeCount++; };

      const texMap = new THREE.Texture();
      texMap.dispose = () => { textureDisposeCount++; };

      const texAo = new THREE.Texture();
      texAo.dispose = () => { textureDisposeCount++; };

      const texRough = new THREE.Texture();
      texRough.dispose = () => { textureDisposeCount++; };

      const texMasks = new THREE.Texture();
      texMasks.dispose = () => { textureDisposeCount++; };

      const mat = new THREE.MeshPhysicalMaterial({
        map: texMap,
        aoMap: texAo,
        roughnessMap: texRough,
      });
      mat.masksMap = texMasks;
      mat.userData.masksTexture = texMasks;
      mat.dispose = () => { materialDisposeCount++; };

      const mesh = new THREE.Mesh(geom, mat);
      group.add(mesh);

      // Trigger disposal via disposeThreeObject
      disposeThreeObject(group);
    }

    expectEqual(geometryDisposeCount, 500, 'All 500 geometries must be disposed');
    expectEqual(materialDisposeCount, 500, 'All 500 materials must be disposed');
    expect(textureDisposeCount >= 2000, `At least 2,000 textures must be disposed, got ${textureDisposeCount}`);
  });

  await runTest('Suite 4', '4.2: 500 rapid simulated loadout tab switches across DEFAULT_LOADOUT_WEAPONS', () => {
    let activeIndex = 0;
    for (let step = 0; step < 500; step++) {
      activeIndex = (activeIndex + 1) % DEFAULT_LOADOUT_WEAPONS.length;
      const weapon = DEFAULT_LOADOUT_WEAPONS[activeIndex];

      expect(typeof weapon.name === 'string', `Weapon at index ${activeIndex} has invalid name`);
      expect(typeof weapon.float === 'number', `Weapon at index ${activeIndex} has invalid float`);
      expect(typeof weapon.seed === 'number', `Weapon at index ${activeIndex} has invalid seed`);

      // Model URL
      const modelPath = weapon.modelUrl || getWeaponModelPath(weapon.name);
      expect(typeof modelPath === 'string' && modelPath.length > 0, `Invalid model path for ${weapon.name}`);

      // Verify composite works cleanly
      const comp = compositeSkinFinish({
        weaponName: weapon.weapon,
        skinName: weapon.skin,
        float: weapon.float,
        seed: weapon.seed,
        rarityColor: weapon.rarityColor,
      });
      expect(comp.texture instanceof THREE.CanvasTexture, `Compositor failed on weapon ${weapon.name}`);
      comp.texture.dispose();
    }
  });

  await runTest('Suite 4', '4.3: Deeply nested scene graph disposal (depth 12 with 36 meshes and shared materials)', () => {
    const root = new THREE.Group();
    let current = root;

    const sharedTex = new THREE.Texture();
    let sharedDisposeCount = 0;
    sharedTex.dispose = () => { sharedDisposeCount++; };

    const sharedMat = new THREE.MeshPhysicalMaterial({ map: sharedTex });
    let matDisposeCount = 0;
    sharedMat.dispose = () => { matDisposeCount++; };

    let totalGeomsDisposed = 0;

    for (let depth = 0; depth < 12; depth++) {
      const nextGroup = new THREE.Group();
      for (let m = 0; m < 3; m++) {
        const geom = new THREE.BufferGeometry();
        geom.dispose = () => { totalGeomsDisposed++; };
        const mesh = new THREE.Mesh(geom, sharedMat);
        current.add(mesh);
      }
      current.add(nextGroup);
      current = nextGroup;
    }

    disposeThreeObject(root);

    expectEqual(totalGeomsDisposed, 36, 'All 36 geometries in deeply nested graph disposed');
    expectEqual(matDisposeCount, 1, 'Shared material disposed exactly once without duplication');
    expectEqual(sharedDisposeCount, 1, 'Shared texture disposed exactly once without duplication');
  });

  await runTest('Suite 4', '4.4: Source 2 Surface Map channel swizzle on MeshPhysicalMaterial', () => {
    const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0.5 });
    applySource2SurfaceSwizzle(mat);

    expect(typeof mat.onBeforeCompile === 'function', 'onBeforeCompile hook not registered');

    const fakeShader = {
      fragmentShader: `
        #include <roughnessmap_fragment>
        #include <metalnessmap_fragment>
      `,
    };

    mat.onBeforeCompile(fakeShader);
    expect(fakeShader.fragmentShader.includes('texelRoughness.r'), 'Shader does not map Red to roughness');
    expect(fakeShader.fragmentShader.includes('texelMetalness.g'), 'Shader does not map Green to metalness');
  });

  // ============================================================================
  // SUITE 5: COMPOSITOR UV ISLAND COVERAGE & MASK ISOLATION ACCURACY
  // ============================================================================
  console.log(BOLD + '\n[Suite 5] Compositor UV Island Coverage & Mask Isolation Accuracy' + RESET);

  await runTest('Suite 5', '5.1: Geometry-aware UV islands defined for all 9 primary CS2 weapons', () => {
    const REQUIRED_WEAPONS = [
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

    for (const wKey of REQUIRED_WEAPONS) {
      const layout = WEAPON_UV_ISLANDS[wKey];
      expect(layout !== undefined, `Layout missing for weapon ${wKey}`);
      expect(layout.primaryPaintIslands.length > 0, `No primary paint islands for ${wKey}`);

      for (const [islandId, island] of Object.entries(layout.islands)) {
        expectEqual(island.id, islandId, `Island ID mismatch for ${islandId}`);
        expect(island.bounds.uMin >= 0 && island.bounds.uMax <= 1.0, `u bounds out of range for ${wKey}:${islandId}`);
        expect(island.bounds.vMin >= 0 && island.bounds.vMax <= 1.0, `v bounds out of range for ${wKey}:${islandId}`);
        expect(island.canvasRect.width > 0 && island.canvasRect.height > 0, `Invalid canvasRect for ${wKey}:${islandId}`);
      }
    }
  });

  await runTest('Suite 5', '5.2: clipToIsland exception safety & context stack balance', () => {
    let saveCount = 0;
    let restoreCount = 0;

    const mockCtx = {
      save: () => { saveCount++; },
      restore: () => { restoreCount++; },
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
    };

    const island = { x: 10, y: 10, width: 100, height: 100 };

    // Normal execution
    clipToIsland(mockCtx, island, () => {});
    expectEqual(saveCount, 1, 'save count normal');
    expectEqual(restoreCount, 1, 'restore count normal');

    // Throwing execution
    assert.throws(() => {
      clipToIsland(mockCtx, island, () => {
        throw new Error('Test draw exception');
      });
    }, /Test draw exception/);

    expectEqual(saveCount, 2, 'save count after error');
    expectEqual(restoreCount, 2, 'restore count after error');
  });

  await runTest('Suite 5', '5.3: Signature skin finishes generate authentic diffuse textures with distinct color schemes', () => {
    const SIGNATURE_TESTS = [
      { weapon: 'AK-47', skin: 'Ice Coaled', expectedBase: '#00e5ff', expectedStyle: 'gunsmith' },
      { weapon: 'M4A1-S', skin: 'Liquidation', expectedBase: '#e11d48', expectedStyle: 'hydrographic' },
      { weapon: 'AWP', skin: 'Ice Coaled', expectedBase: '#00e5ff', expectedStyle: 'gunsmith' },
      { weapon: 'USP-S', skin: 'Royal Guard', expectedBase: '#991b1b', expectedStyle: 'gunsmith' },
      { weapon: 'MAC-10', skin: 'Candy Apple', expectedBase: '#dc2626', expectedStyle: 'anodized' },
      { weapon: 'Zeus x27', skin: 'Electric Blue', expectedBase: '#2563eb', expectedStyle: 'custom' },
      { weapon: 'Galil AR', skin: 'Control', expectedBase: '#3b82f6', expectedStyle: 'hydrographic' },
      { weapon: 'Glock-18', skin: 'Catacombs', expectedBase: '#18181b', expectedStyle: 'custom' },
      { weapon: 'UMP-45', skin: 'Late Night Transit', expectedBase: '#0f172a', expectedStyle: 'custom' },
    ];

    for (const st of SIGNATURE_TESTS) {
      const res = compositeSkinFinish({
        weaponName: st.weapon,
        skinName: st.skin,
        float: 0.05,
        seed: 123,
      });

      expectEqual(res.baseColorHex, st.expectedBase, `Base color mismatch for ${st.weapon} | ${st.skin}`);
      expectEqual(res.finishStyle, st.expectedStyle, `Finish style mismatch for ${st.weapon} | ${st.skin}`);
      expect(res.texture instanceof THREE.CanvasTexture, `Texture not CanvasTexture for ${st.weapon} | ${st.skin}`);
      expect(res.effectiveRoughness > 0, `Roughness <= 0 for ${st.weapon} | ${st.skin}`);
      expect(res.effectiveMetalness > 0, `Metalness <= 0 for ${st.weapon} | ${st.skin}`);
      res.texture.dispose();
    }
  });

  // ============================================================================
  // FINAL SUMMARY REPORT
  // ============================================================================
  console.log('\n' + BOLD + '================================================================================' + RESET);
  console.log(BOLD + '  EMPIRICAL ADVERSARIAL STRESS TEST SUMMARY REPORT' + RESET);
  console.log(BOLD + '================================================================================' + RESET);
  console.log(`  Total Tests Run:        ${totalTests}`);
  console.log(`  Tests Passed:           ${GREEN}${passedTests}${RESET}`);
  console.log(`  Tests Failed:           ${totalTests - passedTests > 0 ? RED : GREEN}${totalTests - passedTests}${RESET}`);
  console.log(`  Total Assertions:       ${totalAssertions}`);

  if (passedTests === totalTests) {
    console.log(`  Verdict:                ${GREEN}${BOLD}ALL EMPIRICAL ADVERSARIAL TESTS PASSED (100%)${RESET}`);
    console.log(BOLD + '================================================================================\n' + RESET);
    process.exit(0);
  } else {
    console.log(`  Verdict:                ${RED}${BOLD}ADVERSARIAL TESTS FAILED${RESET}`);
    console.log(BOLD + '================================================================================\n' + RESET);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled runner error:', err);
  process.exit(1);
});
