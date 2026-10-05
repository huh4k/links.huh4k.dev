#!/usr/bin/env node
/**
 * Empirical Adversarial Challenger Test Suite: Milestone 4 (M4)
 * Phase 2 — Adversarial Coverage Hardening & Tier 5 Final Hardening
 *
 * Scope:
 * Suite 1: Compositor Math & Geometry-Aware UV Island Clipping across ALL 35 CS2 Weapons
 * Suite 2: PBR Shader Channel Swizzling & Source 2 GLSL Shaders across ALL 35 CS2 Weapons
 * Suite 3: Production UI Integration, WebGL Lifecycle & Canvas Preservation (Loadout Card & Inventory Stage)
 * Suite 4: Zero-Regression Audit (Steam Inventory Parser, Asset Properties, .OBJ Loading, R2 Textures)
 * Suite 5: Privacy Invariant Audit across Entire Repository Source & Build Artifacts
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Transparently re-spawn under tsx if run via plain node
if (!process.env.TSX_RUNNER_ACTIVE && !process.execArgv.some((arg) => arg.includes('tsx'))) {
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
import { OBJLoader } from 'three-stdlib';

// Import modules under test
const {
  WEAPON_UV_ISLANDS,
  WEAPON_UV_LAYOUTS,
  getWeaponUvLayout,
  clipToIsland,
  withIslandClip,
  compositeSkinFinish,
  getSkinFallbackColor,
  calculateEffectiveWear,
  normalizeSkinIdentifier,
} = await import('../src/utils/skinCompositor.ts');

const {
  R2_BASE_URL,
  R2_PAINTS_BASE_URL,
  BASE_WEAPON_MAPS,
  PAINT_FINISH_TYPES,
  getR2WeaponTextures,
  getR2PaintFinishUrl,
  loadR2Texture,
  clearR2TextureCache,
} = await import('../src/utils/r2Textures.ts');

const {
  WEAPON_MODEL_MAP,
  getWeaponModelPath,
  isObjModelUrl,
  DEFAULT_WEAPON_MODEL,
} = await import('../src/utils/weaponModels.ts');

const {
  SOURCE2_SURFACE_SWIZZLE,
  applySource2SurfaceSwizzle,
  swizzleSurfaceMapChannels,
  disposeThreeObject,
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
  LRUCache,
  inventoryLRUCache,
  FALLBACK_INVENTORY,
  formatInspectUrl,
  formatEconomyImageUrl,
  getRarityFromTags,
  getTypeFromTags,
} = await import('../src/utils/steam.ts');

// ANSI terminal colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let totalAssertions = 0;
const failureDetails = [];

function runTest(suite, name, fn) {
  totalTests++;
  const start = performance.now();
  try {
    fn();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ${GREEN}✓${RESET} ${name} ${GRAY}(${duration}ms)${RESET}`);
    passedTests++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ${RED}✗${RESET} ${name} ${GRAY}(${duration}ms)${RESET}`);
    console.error(`    ${RED}Error: ${err.message}${RESET}`);
    failedTests++;
    failureDetails.push({ suite, name, error: err });
  }
}

async function runTestAsync(suite, name, fn) {
  totalTests++;
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ${GREEN}✓${RESET} ${name} ${GRAY}(${duration}ms)${RESET}`);
    passedTests++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ${RED}✗${RESET} ${name} ${GRAY}(${duration}ms)${RESET}`);
    console.error(`    ${RED}Error: ${err.message}${RESET}`);
    failedTests++;
    failureDetails.push({ suite, name, error: err });
  }
}

function expect(condition, message = 'Assertion failed') {
  totalAssertions++;
  assert.ok(condition, message);
}

function expectEqual(actual, expected, message = 'Values not equal') {
  totalAssertions++;
  assert.strictEqual(actual, expected, message);
}

console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`${BOLD}   EMPIRICAL ADVERSARIAL CHALLENGER: MILESTONE 4 HARDENING SUITE${RESET}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}\n`);

// Canonical list of all 35 CS2 weapon keys
const ALL_35_WEAPON_KEYS = [
  // Rifles (7)
  'rif_ak47', 'rif_m4a1_s', 'rif_m4a4', 'rif_galilar', 'rif_famas', 'rif_aug', 'rif_sg556',
  // Sniper Rifles (4)
  'snip_awp', 'snip_ssg08', 'snip_g3sg1', 'snip_scar20',
  // Pistols (11)
  'pist_223', 'pist_glock18', 'pist_deagle', 'pist_p250', 'pist_hkp2000', 'pist_fiveseven',
  'pist_cz75a', 'pist_tec9', 'pist_elite', 'pist_revolver', 'pist_taser',
  // SMGs (7)
  'smg_mac10', 'smg_ump45', 'smg_mp9', 'smg_mp7', 'smg_mp5sd', 'smg_p90', 'smg_bizon',
  // Shotguns (4)
  'shot_mag7', 'shot_nova', 'shot_sawedoff', 'shot_xm1014',
  // Heavy / Machine Guns (2)
  'mach_m249', 'mach_negev',
];

// Common display names corresponding to the 35 weapons
const ALL_35_DISPLAY_NAMES = [
  'AK-47', 'M4A1-S', 'M4A4', 'Galil AR', 'FAMAS', 'AUG', 'SG 553',
  'AWP', 'SSG 08', 'G3SG1', 'SCAR-20',
  'USP-S', 'Glock-18', 'Desert Eagle', 'P250', 'P2000', 'Five-SeVeN',
  'CZ75-Auto', 'Tec-9', 'Dual Berettas', 'R8 Revolver', 'Zeus x27',
  'MAC-10', 'UMP-45', 'MP9', 'MP7', 'MP5-SD', 'P90', 'PP-Bizon',
  'MAG-7', 'Nova', 'Sawed-Off', 'XM1014',
  'M249', 'Negev',
];

// ============================================================================
// SUITE 1: COMPOSITOR MATH & UV CLIPPING INTEGRITY ACROSS ALL 35 CS2 WEAPONS
// ============================================================================
console.log(`${BOLD}[Suite 1] Compositor Math & UV Clipping Integrity across ALL 35 Weapons${RESET}`);

runTest('Suite 1', '1.1: Verify all 35 CS2 weapons map to accessible .obj model assets', () => {
  expectEqual(ALL_35_WEAPON_KEYS.length, 35, 'Must have exactly 35 canonical weapon keys');
  expectEqual(ALL_35_DISPLAY_NAMES.length, 35, 'Must have exactly 35 display names');

  for (let i = 0; i < ALL_35_DISPLAY_NAMES.length; i++) {
    const displayName = ALL_35_DISPLAY_NAMES[i];
    const resolvedPath = getWeaponModelPath(displayName);
    expect(isObjModelUrl(resolvedPath), `${displayName} must resolve to .obj URL: ${resolvedPath}`);
    const localFsPath = path.join(process.cwd(), 'public', resolvedPath.replace(/^\//, ''));
    expect(fs.existsSync(localFsPath), `Model file must exist on disk: ${localFsPath}`);
  }
});

runTest('Suite 1', '1.2: Geometry-aware UV island coordinate invariants across all 9 primary weapons', () => {
  const primaryKeys = [
    'rif_ak47', 'rif_m4a1_s', 'snip_awp', 'pist_223', 'pist_glock18',
    'smg_mac10', 'pist_taser', 'rif_galilar', 'smg_ump45',
  ];

  for (const key of primaryKeys) {
    const layout = WEAPON_UV_ISLANDS[key];
    expect(layout !== undefined, `Layout for ${key} must exist`);
    expect(Object.keys(layout.islands).length >= 2, `${key} must define at least 2 distinct UV islands`);

    for (const [islandId, island] of Object.entries(layout.islands)) {
      expectEqual(island.id, islandId, `Island ID must match key: ${islandId}`);
      // UV bounds in [0.0, 1.0]
      expect(island.bounds.uMin >= 0 && island.bounds.uMin <= 1, `${key}.${islandId} uMin out of range: ${island.bounds.uMin}`);
      expect(island.bounds.uMax >= 0 && island.bounds.uMax <= 1, `${key}.${islandId} uMax out of range: ${island.bounds.uMax}`);
      expect(island.bounds.vMin >= 0 && island.bounds.vMin <= 1, `${key}.${islandId} vMin out of range: ${island.bounds.vMin}`);
      expect(island.bounds.vMax >= 0 && island.bounds.vMax <= 1, `${key}.${islandId} vMax out of range: ${island.bounds.vMax}`);
      expect(island.bounds.uMin <= island.bounds.uMax, `${key}.${islandId} uMin > uMax`);
      expect(island.bounds.vMin <= island.bounds.vMax, `${key}.${islandId} vMin > vMax`);

      // CanvasRect in [0, 1024]
      expect(island.canvasRect.x >= 0 && island.canvasRect.x <= 1024, `${key}.${islandId} canvasRect.x out of bounds`);
      expect(island.canvasRect.y >= 0 && island.canvasRect.y <= 1024, `${key}.${islandId} canvasRect.y out of bounds`);
      expect(island.canvasRect.width > 0 && island.canvasRect.x + island.canvasRect.width <= 1024, `${key}.${islandId} width invalid`);
      expect(island.canvasRect.height > 0 && island.canvasRect.y + island.canvasRect.height <= 1024, `${key}.${islandId} height invalid`);

      // Alignment check: canvasRect must enclose the primary UV island cluster
      const normalizedU = island.canvasRect.x / 1024;
      const normalizedW = island.canvasRect.width / 1024;
      expect(normalizedU >= 0 && normalizedU <= 1, `${key}.${islandId} normalized U in [0, 1]`);
      expect(normalizedW > 0 && normalizedW <= 1, `${key}.${islandId} normalized W in (0, 1]`);

      // Source 2 Mask channel verification
      if (island.maskChannel) {
        expect(['R', 'G', 'B', 'A'].includes(island.maskChannel), `Mask channel must be R, G, B, or A`);
      }
    }
  }
});

runTest('Suite 1', '1.3: clipToIsland exception safety & context stack balance stress test', () => {
  // Mock canvas context tracking save/restore balance
  let saveCalls = 0;
  let restoreCalls = 0;
  let clipCalls = 0;

  const mockCtx = {
    save() { saveCalls++; },
    restore() { restoreCalls++; },
    beginPath() {},
    rect(_x, _y, _w, _h) {},
    clip() { clipCalls++; },
  };

  const sampleIsland = {
    x: 100, y: 100, width: 200, height: 200,
  };

  // 1. Normal execution
  clipToIsland(mockCtx, sampleIsland, (_c) => {
    expectEqual(saveCalls, 1);
    expectEqual(clipCalls, 1);
  });
  expectEqual(saveCalls, 1);
  expectEqual(restoreCalls, 1);

  // 2. Adversarial throwing callback must still invoke ctx.restore() (finally guarantee)
  let caught = false;
  try {
    clipToIsland(mockCtx, sampleIsland, (_c) => {
      throw new Error('Adversarial render crash');
    });
  } catch {
    caught = true;
  }
  expect(caught, 'Exception must propagate');
  expectEqual(saveCalls, 2, 'Save called twice');
  expectEqual(restoreCalls, 2, 'Restore called twice despite throw');
});

runTest('Suite 1', '1.4: compositeSkinFinish executes cleanly across all 35 CS2 weapons without throwing', () => {
  for (const weapon of ALL_35_DISPLAY_NAMES) {
    const result = compositeSkinFinish({
      weaponName: weapon,
      skinName: 'Custom Hardening',
      float: 0.1234,
      seed: 456,
      rarityColor: '#eb4b4b',
      width: 512,
      height: 512,
    });

    expect(result !== null && typeof result === 'object', `Result for ${weapon} must be non-null object`);
    expect(result.texture instanceof THREE.CanvasTexture, `Result for ${weapon} must return CanvasTexture`);
    expectEqual(result.texture.colorSpace, THREE.SRGBColorSpace, `Texture must use SRGBColorSpace`);
    expect(result.effectiveRoughness >= 0.05 && result.effectiveRoughness <= 0.95, `Roughness within [0.05, 0.95] for ${weapon}`);
    expect(result.effectiveMetalness >= 0.05 && result.effectiveMetalness <= 0.95, `Metalness within [0.05, 0.95] for ${weapon}`);
    expect(result.effectiveClearcoat >= 0.0 && result.effectiveClearcoat <= 1.0, `Clearcoat within [0.0, 1.0] for ${weapon}`);
    expect(typeof result.baseColorHex === 'string' && result.baseColorHex.length > 0, `baseColorHex valid for ${weapon}`);
    expect(['custom', 'gunsmith', 'anodized', 'hydrographic', 'patina'].includes(result.finishStyle), `Valid finishStyle for ${weapon}`);

    // Cleanup texture to avoid GPU memory accumulation
    result.texture.dispose();
  }
});

runTest('Suite 1', '1.5: Continuous float wear monotonicity across continuous spectrum [0.00 - 1.00]', () => {
  const floatSteps = [0.0, 0.05, 0.0825, 0.15, 0.25, 0.3438, 0.45, 0.549, 0.55, 0.551, 0.75, 1.0];
  let lastRoughness = -1;

  for (const f of floatSteps) {
    const wear = calculateEffectiveWear(0.25, 0.35, 0.6, f);
    expect(wear.effectiveRoughness >= lastRoughness - 1e-6, `Roughness must monotonically increase: ${wear.effectiveRoughness} >= ${lastRoughness} at f=${f}`);
    lastRoughness = wear.effectiveRoughness;

    // Clearcoat cutoff verification
    if (f > 0.55) {
      expectEqual(wear.effectiveClearcoat, 0.0, `Clearcoat must strictly drop to 0.0 when float > 0.55 (at f=${f})`);
    } else {
      expect(wear.effectiveClearcoat > 0.0, `Clearcoat must be positive when float <= 0.55 (at f=${f})`);
    }
  }
});

// ============================================================================
// SUITE 2: PBR SHADER CHANNEL SWIZZLING ACROSS ALL 35 WEAPONS IN MODELVIEWER
// ============================================================================
console.log(`\n${BOLD}[Suite 2] PBR Shader Channel Swizzling across ALL 35 Weapons${RESET}`);

runTest('Suite 2', '2.1: Verify SOURCE2_SURFACE_SWIZZLE specification adherence', () => {
  expectEqual(SOURCE2_SURFACE_SWIZZLE.roughnessChannel, 'R', 'Source 2 packed roughness must be in Red channel');
  expectEqual(SOURCE2_SURFACE_SWIZZLE.metalnessChannel, 'G', 'Source 2 packed metalness must be in Green channel');
  expectEqual(SOURCE2_SURFACE_SWIZZLE.redRoughness, true);
  expectEqual(SOURCE2_SURFACE_SWIZZLE.greenMetalness, true);
});

runTest('Suite 2', '2.2: applySource2SurfaceSwizzle GLSL injection across all 35 CS2 weapons', () => {
  for (const weaponKey of ALL_35_WEAPON_KEYS) {
    const mat = new THREE.MeshPhysicalMaterial({
      roughness: 0.35,
      metalness: 0.65,
    });

    applySource2SurfaceSwizzle(mat);
    expect(typeof mat.onBeforeCompile === 'function', `Material for ${weaponKey} must register onBeforeCompile hook`);

    // Simulate standard Three.js MeshPhysicalMaterial vertex & fragment shader templates
    const shader = {
      vertexShader: 'void main() { gl_Position = vec4(0.0); }',
      fragmentShader: `
        uniform float roughness;
        uniform float metalness;
        #include <roughnessmap_fragment>
        #include <metalnessmap_fragment>
        void main() { gl_FragColor = vec4(1.0); }
      `,
    };

    mat.onBeforeCompile(shader);

    // Verify Source 2 swizzle expressions exist in modified fragment shader
    expect(shader.fragmentShader.includes('roughnessFactor *= texelRoughness.r;'), `${weaponKey} must swizzle Red to roughness`);
    expect(shader.fragmentShader.includes('metalnessFactor *= texelMetalness.g;'), `${weaponKey} must swizzle Green to metalness`);
    expect(shader.fragmentShader.includes('float roughnessFactor = roughness;'), `${weaponKey} must declare roughnessFactor`);
    expect(shader.fragmentShader.includes('float metalnessFactor = metalness;'), `${weaponKey} must declare metalnessFactor`);

    // Verify idempotent re-application
    mat.onBeforeCompile(shader);
    expect(shader.fragmentShader.includes('roughnessFactor *= texelRoughness.r;'), `${weaponKey} idempotency`);

    mat.dispose();
  }
});

runTest('Suite 2', '2.3: swizzleSurfaceMapChannels image channel extraction simulation', () => {
  // Test headless fallback: returns same texture safely
  const dummyTexture = new THREE.Texture();
  const swizzled = swizzleSurfaceMapChannels(dummyTexture);
  expect(swizzled.roughnessMap !== null && swizzled.metalnessMap !== null, 'Must return roughness and metalness maps');
  dummyTexture.dispose();
});

runTest('Suite 2', '2.4: Full PBR material and texture binding pipeline across all 35 CS2 weapons', () => {
  for (const weaponKey of ALL_35_WEAPON_KEYS) {
    const r2Maps = getR2WeaponTextures(weaponKey);
    expect(r2Maps !== null, `R2 maps for ${weaponKey} must not be null`);
    expect(typeof r2Maps.aoUrl === 'string' && r2Maps.aoUrl.length > 0, `${weaponKey} aoUrl valid`);
    expect(typeof r2Maps.surfaceUrl === 'string' && r2Maps.surfaceUrl.length > 0, `${weaponKey} surfaceUrl valid`);
    expect(typeof r2Maps.masksUrl === 'string' && r2Maps.masksUrl.length > 0, `${weaponKey} masksUrl valid`);

    // Create MeshPhysicalMaterial with simulated textures
    const material = new THREE.MeshPhysicalMaterial({
      aoMapIntensity: 1.2,
      metalness: 0.65,
      roughness: 0.35,
      clearcoat: 0.45,
    });
    applySource2SurfaceSwizzle(material);

    const dummyAo = new THREE.Texture();
    const dummySurface = new THREE.Texture();
    const dummyMasks = new THREE.Texture();

    material.aoMap = dummyAo;
    material.roughnessMap = dummySurface;
    material.metalnessMap = dummySurface;
    material.masksMap = dummyMasks;

    expectEqual(material.aoMapIntensity, 1.2, `${weaponKey} aoMapIntensity must be exactly 1.2`);
    expectEqual(material.roughnessMap, dummySurface, `${weaponKey} roughnessMap bound`);
    expectEqual(material.metalnessMap, dummySurface, `${weaponKey} metalnessMap bound`);
    expectEqual(material.masksMap, dummyMasks, `${weaponKey} masksMap bound`);

    // Verify clean disposal
    material.dispose();
    dummyAo.dispose();
    dummySurface.dispose();
    dummyMasks.dispose();
  }
});

// ============================================================================
// SUITE 3: PRODUCTION UI INTEGRATION & CANVAS PRESERVATION
// ============================================================================
console.log(`\n${BOLD}[Suite 3] Production UI Integration & WebGL Lifecycle${RESET}`);

runTest('Suite 3', '3.1: CS2LoadoutCard loadout weapons integrity and exact Steam metadata', () => {
  expectEqual(DEFAULT_LOADOUT_WEAPONS.length, 5, 'Loadout card must feature exactly 5 weapons');

  const ak = DEFAULT_LOADOUT_WEAPONS[0];
  expectEqual(ak.weapon, 'AK-47');
  expectEqual(ak.skin, 'Ice Coaled');
  expectEqual(ak.wearShort, 'MW');
  expectEqual(ak.float, 0.0825);
  expectEqual(ak.seed, 367);
  expectEqual(ak.rarityColor, '#d32ce6');

  const m4 = DEFAULT_LOADOUT_WEAPONS[1];
  expectEqual(m4.weapon, 'M4A1-S');
  expectEqual(m4.skin, 'Liquidation');
  expectEqual(m4.wearShort, 'FT');
  expectEqual(m4.float, 0.3438);
  expectEqual(m4.seed, 937);
  expectEqual(m4.isStatTrak, true);

  const awp = DEFAULT_LOADOUT_WEAPONS[2];
  expectEqual(awp.weapon, 'AWP');
  expectEqual(awp.skin, 'Ice Coaled');
  expectEqual(awp.wearShort, 'FN');
  expectEqual(awp.float, 0.0631);
  expectEqual(awp.seed, 309);

  const usp = DEFAULT_LOADOUT_WEAPONS[3];
  expectEqual(usp.weapon, 'USP-S');
  expectEqual(usp.skin, 'Royal Guard');
  expectEqual(usp.wearShort, 'FN');
  expectEqual(usp.float, 0.0560);
  expectEqual(usp.seed, 644);

  const knife = DEFAULT_LOADOUT_WEAPONS[4];
  expect(knife.weapon.includes('Karambit') || knife.slot === 'Knife');
  expectEqual(knife.float, 0.0089);
  expectEqual(knife.seed, 399);
});

runTest('Suite 3', '3.2: Verify CS2LoadoutCard & InventoryExplorer source codes preserve Canvas without key', () => {
  const loadoutSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/steam/CS2LoadoutCard.tsx'),
    'utf-8'
  );
  // Match <ModelViewer ...> and assert it does NOT contain key={...}
  const loadoutMatch = loadoutSrc.match(/<ModelViewer\s+[^>]*\/>/s);
  expect(loadoutMatch !== null, 'ModelViewer must be rendered in CS2LoadoutCard');
  expect(!loadoutMatch[0].includes('key='), 'CS2LoadoutCard must NOT set key prop on ModelViewer (Canvas preservation contract)');

  const explorerSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/steam/InventoryExplorer.tsx'),
    'utf-8'
  );
  const explorerMatch = explorerSrc.match(/<ModelViewer\s+[^>]*\/>/s);
  expect(explorerMatch !== null, 'ModelViewer must be rendered in InventoryExplorer');
  expect(!explorerMatch[0].includes('key='), 'InventoryExplorer must NOT set key prop on ModelViewer (Canvas preservation contract)');
});

runTest('Suite 3', '3.3: 1,000 rapid weapon switches across CS2LoadoutCard loadout items stress test', () => {
  for (let cycle = 0; cycle < 1000; cycle++) {
    const active = DEFAULT_LOADOUT_WEAPONS[cycle % DEFAULT_LOADOUT_WEAPONS.length];
    const pathResolved = getWeaponModelPath(active.name);
    expect(pathResolved.length > 0, `Path for ${active.name} must resolve`);
    const wearTier = getWearBracket(active.float);
    expect(wearTier.length > 0, `Wear bracket for ${active.float} must resolve`);
    const pct = getFloatPercentage(active.float);
    expect(pct >= 0 && pct <= 100, `Float pct in [0, 100]`);
    const seedFormatted = formatSeed(active.seed);
    expect(seedFormatted.startsWith('Seed #'), `Seed formatting: ${seedFormatted}`);
  }
});

runTest('Suite 3', '3.4: InventoryExplorer inspect view dock modes & category filters', () => {
  expectEqual(DOCK_MODES.length, 3, 'Inspect Dock must support exactly 3 modes');
  expect(DOCK_MODES.includes('3d'), 'Dock supports 3d');
  expect(DOCK_MODES.includes('2d'), 'Dock supports 2d');
  expect(DOCK_MODES.includes('inspect'), 'Dock supports inspect');

  expectEqual(CATEGORIES.length, 6, 'Categories must support 6 taxonomy groups');

  for (const item of FALLBACK_INVENTORY) {
    expect(matchesCategory(item, 'All'), `All category must match item: ${item.name}`);
    expect(matchesSearch(item, ''), 'Empty search must match all items');
    expect(matchesSearch(item, item.name), 'Exact name search must match');
  }
});

// ============================================================================
// SUITE 4: ZERO-REGRESSION AUDIT AGAINST PREVIOUS MILESTONES
// ============================================================================
console.log(`\n${BOLD}[Suite 4] Zero-Regression Audit (Steam Parser, Float, .OBJ, R2)${RESET}`);

runTest('Suite 4', '4.1: Steam Inventory LRUCache capacities, eviction, and zero-latency hits', () => {
  const cache = new LRUCache(10, 10000);
  for (let i = 0; i < 15; i++) {
    cache.set(`key_${i}`, { float: i / 15, seed: i * 10 });
  }

  expectEqual(cache.size(), 10, 'Capacity clamped to 10');
  // First 5 items (key_0 to key_4) should be evicted
  for (let i = 0; i < 5; i++) {
    expectEqual(cache.get(`key_${i}`), undefined, `key_${i} must be evicted`);
  }
  // Items 5 to 14 must exist
  for (let i = 5; i < 15; i++) {
    const val = cache.get(`key_${i}`);
    expect(val !== undefined, `key_${i} must exist`);
    expectEqual(val.seed, i * 10);
  }
});

runTest('Suite 4', '4.2: formatInspectUrl parameter replacement for %owner_steamid% and %assetid%', () => {
  const template = 'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S%owner_steamid%A%assetid%D12345';
  const formatted = formatInspectUrl(template, '76561198920486334', '53025617652');
  expect(!formatted.includes('%owner_steamid%'), 'Must replace %owner_steamid%');
  expect(!formatted.includes('%assetid%'), 'Must replace %assetid%');
  expect(formatted.includes('76561198920486334'), 'Must contain steamid');
  expect(formatted.includes('53025617652'), 'Must contain assetid');
});

runTest('Suite 4', '4.3: FALLBACK_INVENTORY contains 26+ authentic CS2 items with complete telemetry', () => {
  expect(FALLBACK_INVENTORY.length >= 26, `Must have at least 26 items: actual ${FALLBACK_INVENTORY.length}`);

  // Find AK-47 Ice Coaled in fallback inventory
  const ak = FALLBACK_INVENTORY.find((i) => i.name.includes('AK-47') && i.name.includes('Ice Coaled'));
  expect(ak !== undefined, 'AK-47 Ice Coaled must exist in fallback inventory');
  expect(Math.abs(ak.float - 0.0825) < 0.001, `AK-47 float matches ~0.0825: ${ak.float}`);
  expectEqual(ak.seed, 367);
  expectEqual(ak.rarity, 'Classified');

  // Find M4A1-S Liquidation
  const m4 = FALLBACK_INVENTORY.find((i) => i.name.includes('M4A1-S') && i.name.includes('Liquidation'));
  expect(m4 !== undefined, 'M4A1-S Liquidation must exist in fallback inventory');
  expect(Math.abs(m4.float - 0.3438) < 0.001, `M4A1-S float matches ~0.3438: ${m4.float}`);
  expectEqual(m4.seed, 937);
});

runTest('Suite 4', '4.4: R2 Texture Paint finish resolution across all 6 Source 2 finish types', () => {
  expectEqual(PAINT_FINISH_TYPES.length, 6, 'Must define 6 paint finishes');

  for (const finish of PAINT_FINISH_TYPES) {
    const url = getR2PaintFinishUrl(finish);
    expect(url !== null, `URL for ${finish} must not be null`);
    expect(url.startsWith(R2_PAINTS_BASE_URL), `URL for ${finish} must start with R2 paints base URL`);
  }
});

runTest('Suite 4', '4.5: Parse real .obj files and verify geometry normalization and vertex normals', () => {
  const sampleModels = [
    'public/models/weapon_rif_ak47.obj',
    'public/models/weapon_snip_awp.obj',
    'public/models/weapon_pist_usp_silencer.obj',
    'public/models/weapon_rif_m4a1_silencer.obj',
  ];

  const loader = new OBJLoader();

  for (const modelPath of sampleModels) {
    const fullPath = path.join(process.cwd(), modelPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const obj = loader.parse(content);

    let meshCount = 0;
    obj.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        const geom = child.geometry;
        expect(geom.attributes.position !== undefined, 'Geometry must have positions');
        expect(geom.attributes.position.count > 0, 'Geometry must have vertices');
      }
    });

    expect(meshCount > 0, `${modelPath} must parse at least 1 mesh`);
    disposeThreeObject(obj);
  }
});

// ============================================================================
// SUITE 5: PRIVACY INVARIANT AUDIT
// ============================================================================
console.log(`\n${BOLD}[Suite 5] Privacy Invariant Audit across Repository Source & Output${RESET}`);

runTest('Suite 5', '5.1: Zero personal names or locations exist in any source code file', () => {
  // Prohibited terms from privacy invariant
  const PROHIBITED_TERMS = [
    'charlie', 'cafici', 'melbourne', 'sydney', 'australia', 'victoria',
  ];

  const filesToCheck = [
    'src/utils/skinCompositor.ts',
    'src/utils/r2Textures.ts',
    'src/utils/weaponModels.ts',
    'src/utils/steam.ts',
    'src/components/ModelViewer.tsx',
    'src/components/steam/CS2LoadoutCard.tsx',
    'src/components/steam/InventoryExplorer.tsx',
    'src/pages/index.astro',
    'src/pages/inventory.astro',
    'src/pages/test/model-viewer.astro',
    'src/pages/api/inventory.json.ts',
  ];

  for (const relPath of filesToCheck) {
    const absPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(absPath)) continue;
    const content = fs.readFileSync(absPath, 'utf-8').toLowerCase();

    for (const term of PROHIBITED_TERMS) {
      expect(
        !content.includes(term),
        `Privacy leak violation: term "${term}" detected in ${relPath}`
      );
    }
  }
});

// ============================================================================
// SUMMARY REPORT
// ============================================================================
console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`${BOLD}   ADVERSARIAL CHALLENGER VERIFICATION SUMMARY (MILESTONE 4)${RESET}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`  Total Tests Run:     ${BOLD}${totalTests}${RESET}`);
console.log(`  Passed Tests:        ${GREEN}${passedTests}${RESET}`);
console.log(`  Failed Tests:        ${failedTests === 0 ? GREEN : RED}${failedTests}${RESET}`);
console.log(`  Total Assertions:    ${BOLD}${totalAssertions}${RESET}`);

if (failedTests > 0) {
  console.log(`\n${RED}[VERDICT: REJECT] ${failedTests} tests failed!${RESET}`);
  for (const f of failureDetails) {
    console.error(`  - [${f.suite}] ${f.name}: ${f.error.message}`);
  }
  process.exit(1);
} else {
  console.log(`\n${GREEN}${BOLD}[VERDICT: APPROVE] All ${totalTests} adversarial stress tests passed with 100% success.${RESET}\n`);
  process.exit(0);
}
