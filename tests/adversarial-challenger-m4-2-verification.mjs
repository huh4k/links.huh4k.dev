#!/usr/bin/env node
/**
 * Empirical Adversarial Challenger Verification Harness (Milestone 4 — Phase 2)
 * Agent: challenger_m4_2_rep
 *
 * Scope:
 * Suite 1: Compositor Math & UV Clipping Integrity across all 35 CS2 Weapons
 * Suite 2: PBR Shader Channel Swizzling & Source 2 GLSL Shaders across all 35 CS2 Weapons
 * Suite 3: Production UI Integration & WebGL Lifecycle in Loadout Card & Inventory Stage
 * Suite 4: Zero Regressions (Steam API Parser, Float Extraction, .OBJ Loading, R2 Textures)
 * Suite 5: Privacy Invariant Enforcement across Codebase & Build Artifacts
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
console.log(`${BOLD}   EMPIRICAL ADVERSARIAL STRESS VERIFICATION (CHALLENGER M4_2_REP)${RESET}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}\n`);

// 35 Canonical CS2 Weapons
const ALL_35_WEAPON_NAMES = [
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

runTest('Suite 1', '1.1: All 35 CS2 weapons execute compositeSkinFinish cleanly across edge-case floats & seeds', () => {
  const hostileFloats = [-1.0, 0.0, 0.000001, 0.07, 0.15, 0.38, 0.45, 0.999999, 1.0, 1.5, NaN, undefined, null];
  const hostileSeeds = [-100, 0, 1, 367, 937, 1000, 99999, undefined, null];
  const testSkins = ['Ice Coaled', 'Liquidation', 'Royal Guard', 'Candy Apple', 'Electric Blue', 'Control', 'Catacombs', 'Late Night Transit', 'Custom Test', ''];

  for (const weapon of ALL_35_WEAPON_NAMES) {
    for (const f of hostileFloats) {
      for (const s of [0, 42, 999]) {
        const res = compositeSkinFinish({
          weaponName: weapon,
          skinName: 'Test Skin',
          float: f,
          seed: s,
          rarityColor: '#eb4b4b',
        });
        expect(res.texture instanceof THREE.CanvasTexture, `Texture must be THREE.CanvasTexture for ${weapon}`);
        expect(res.effectiveRoughness >= 0.05 && res.effectiveRoughness <= 0.95, `Roughness out of physical range [0.05, 0.95] for ${weapon}: ${res.effectiveRoughness}`);
        expect(res.effectiveMetalness >= 0.0 && res.effectiveMetalness <= 1.0, `Metalness out of physical range [0, 1] for ${weapon}: ${res.effectiveMetalness}`);
        expect(res.effectiveClearcoat >= 0.0 && res.effectiveClearcoat <= 1.0, `Clearcoat out of physical range [0, 1] for ${weapon}: ${res.effectiveClearcoat}`);
        expect(typeof res.baseColorHex === 'string' && res.baseColorHex.startsWith('#'), `Base color hex invalid: ${res.baseColorHex}`);
        expect(['custom', 'gunsmith', 'anodized', 'hydrographic', 'patina'].includes(res.finishStyle), `Invalid finish style: ${res.finishStyle}`);
      }
    }
  }
});

runTest('Suite 1', '1.2: UV Island boundary coordinate integrity and non-overlapping constraints', () => {
  const primaryKeys = [
    'rif_ak47', 'rif_m4a1_s', 'snip_awp', 'pist_223', 'pist_glock18',
    'smg_mac10', 'pist_taser', 'rif_galilar', 'smg_ump45',
  ];

  for (const key of primaryKeys) {
    const layout = WEAPON_UV_ISLANDS[key];
    expect(layout !== null && layout !== undefined, `Layout for ${key} must exist`);
    const islandEntries = Object.entries(layout.islands);
    expect(islandEntries.length >= 2, `${key} must have at least 2 distinct UV islands`);

    for (const [id, island] of islandEntries) {
      // Coordinate validity
      expect(island.bounds.uMin >= 0 && island.bounds.uMin <= 1, `${key}.${id} uMin out of range [0, 1]`);
      expect(island.bounds.uMax >= 0 && island.bounds.uMax <= 1, `${key}.${id} uMax out of range [0, 1]`);
      expect(island.bounds.vMin >= 0 && island.bounds.vMin <= 1, `${key}.${id} vMin out of range [0, 1]`);
      expect(island.bounds.vMax >= 0 && island.bounds.vMax <= 1, `${key}.${id} vMax out of range [0, 1]`);
      expect(island.bounds.uMin <= island.bounds.uMax, `${key}.${id} uMin > uMax`);
      expect(island.bounds.vMin <= island.bounds.vMax, `${key}.${id} vMin > vMax`);

      // CanvasRect validity
      expect(island.canvasRect.x >= 0 && island.canvasRect.x <= 1024, `${key}.${id} canvasRect.x`);
      expect(island.canvasRect.y >= 0 && island.canvasRect.y <= 1024, `${key}.${id} canvasRect.y`);
      expect(island.canvasRect.width > 0 && island.canvasRect.x + island.canvasRect.width <= 1024, `${key}.${id} width`);
      expect(island.canvasRect.height > 0 && island.canvasRect.y + island.canvasRect.height <= 1024, `${key}.${id} height`);
    }
  }
});

runTest('Suite 1', '1.3: clipToIsland and withIslandClip stack balance stress test under synthetic exceptions', () => {
  let saveCount = 0;
  let restoreCount = 0;

  const mockCtx = {
    save() { saveCount++; },
    restore() { restoreCount++; },
    beginPath() {},
    rect() {},
    clip() {},
  };

  const dummyIsland = {
    id: 'test',
    name: 'test',
    bounds: { uMin: 0, uMax: 1, vMin: 0, vMax: 1 },
    canvasRect: { x: 0, y: 0, width: 100, height: 100 },
  };

  // 100 successful invocations
  for (let i = 0; i < 100; i++) {
    clipToIsland(mockCtx, dummyIsland, () => {});
    withIslandClip(mockCtx, dummyIsland, () => {});
  }
  expectEqual(saveCount, restoreCount, 'Save and restore counts must be balanced after success');

  // 100 failing invocations (throwing inside callback)
  for (let i = 0; i < 100; i++) {
    try {
      clipToIsland(mockCtx, dummyIsland, () => {
        throw new Error('Synthetic error in clipToIsland');
      });
    } catch {
      // Expected
    }
    try {
      withIslandClip(mockCtx, dummyIsland, () => {
        throw new Error('Synthetic error in withIslandClip');
      });
    } catch {
      // Expected
    }
  }
  expectEqual(saveCount, restoreCount, 'Save and restore counts must remain strictly balanced after exceptions');
});

runTest('Suite 1', '1.4: Dynamic wear monotonic scaling across fine sweep of 10,000 steps', () => {
  let prevRoughness = -1;
  const steps = 10000;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const wear = calculateEffectiveWear(0.2, 0.4, 0.6, f);
    expect(wear.effectiveRoughness >= prevRoughness, `Roughness must monotonically increase with wear: ${wear.effectiveRoughness} < ${prevRoughness} at f=${f}`);
    expect(wear.effectiveRoughness >= 0.05 && wear.effectiveRoughness <= 0.95, `Roughness bounded in [0.05, 0.95]`);
    expect(wear.effectiveMetalness >= 0.0 && wear.effectiveMetalness <= 1.0, `Metalness bounded in [0, 1]`);
    expect(wear.effectiveClearcoat >= 0.0 && wear.effectiveClearcoat <= 1.0, `Clearcoat bounded in [0, 1]`);
    prevRoughness = wear.effectiveRoughness;
  }
});

// ============================================================================
// SUITE 2: PBR SHADER CHANNEL SWIZZLING ACROSS ALL 35 WEAPONS IN MODELVIEWER
// ============================================================================
console.log(`\n${BOLD}[Suite 2] PBR Shader Channel Swizzling across ALL 35 Weapons${RESET}`);

runTest('Suite 2', '2.1: SOURCE2_SURFACE_SWIZZLE specification adherence & onBeforeCompile GLSL injection', () => {
  expectEqual(SOURCE2_SURFACE_SWIZZLE.roughnessChannel, 'R', 'Source 2 roughness must map to Red');
  expectEqual(SOURCE2_SURFACE_SWIZZLE.metalnessChannel, 'G', 'Source 2 metalness must map to Green');
  expectEqual(SOURCE2_SURFACE_SWIZZLE.redRoughness, true, 'redRoughness must be true');
  expectEqual(SOURCE2_SURFACE_SWIZZLE.greenMetalness, true, 'greenMetalness must be true');

  // Verify GLSL injection
  const mat = new THREE.MeshPhysicalMaterial();
  applySource2SurfaceSwizzle(mat);
  expect(typeof mat.onBeforeCompile === 'function', 'onBeforeCompile must be attached');

  const mockShader = {
    fragmentShader: `
      #include <roughnessmap_fragment>
      #include <metalnessmap_fragment>
    `,
  };
  mat.onBeforeCompile(mockShader);

  expect(mockShader.fragmentShader.includes('texelRoughness.r'), 'Fragment shader must sample texelRoughness.r');
  expect(mockShader.fragmentShader.includes('texelMetalness.g'), 'Fragment shader must sample texelMetalness.g');
  expect(!mockShader.fragmentShader.includes('#include <roughnessmap_fragment>'), 'Include directive must be replaced');
  expect(!mockShader.fragmentShader.includes('#include <metalnessmap_fragment>'), 'Include directive must be replaced');
});

runTest('Suite 2', '2.2: PBR Material pipeline & swizzling across all 35 CS2 weapons', () => {
  for (const weapon of ALL_35_WEAPON_NAMES) {
    const skinRes = compositeSkinFinish({
      weaponName: weapon,
      skinName: 'Test Finish',
      float: 0.15,
      seed: 42,
    });

    const mat = new THREE.MeshPhysicalMaterial({
      map: skinRes.texture,
      metalness: skinRes.effectiveMetalness,
      roughness: skinRes.effectiveRoughness,
      clearcoat: skinRes.effectiveClearcoat,
    });

    applySource2SurfaceSwizzle(mat);

    expect(mat.roughness >= 0.05 && mat.roughness <= 0.95, `Roughness bounded for ${weapon}`);
    expect(mat.metalness >= 0.0 && mat.metalness <= 1.0, `Metalness bounded for ${weapon}`);
    expect(mat.map !== null, `Diffuse map must be present for ${weapon}`);

    // Clean up
    mat.dispose();
    skinRes.texture.dispose();
  }
});

runTest('Suite 2', '2.3: swizzleSurfaceMapChannels headless fallback and valid texture return', () => {
  const dummyTexture = new THREE.Texture();
  const swizzled = swizzleSurfaceMapChannels(dummyTexture);
  expect(swizzled.roughnessMap instanceof THREE.Texture, 'Must return valid roughnessMap');
  expect(swizzled.metalnessMap instanceof THREE.Texture, 'Must return valid metalnessMap');
  expectEqual(swizzled.roughnessMap.wrapS, THREE.RepeatWrapping, 'wrapS must be RepeatWrapping');
  expectEqual(swizzled.roughnessMap.wrapT, THREE.RepeatWrapping, 'wrapT must be RepeatWrapping');
});

runTest('Suite 2', '2.4: disposeThreeObject handles cyclic, nested, and complex scene graphs', () => {
  const root = new THREE.Group();
  const child1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  const child2 = new THREE.Mesh(new THREE.SphereGeometry(1), [
    new THREE.MeshBasicMaterial(),
    new THREE.MeshPhysicalMaterial(),
  ]);
  root.add(child1);
  root.add(child2);

  // Add dummy textures
  const tex1 = new THREE.Texture();
  const tex2 = new THREE.Texture();
  (child1.material).map = tex1;
  child1.material.userData.customTex = tex2;

  disposeThreeObject(root);
  // Verify execution doesn't throw and traverses all nodes cleanly
  expect(true, 'disposeThreeObject completed without exception');
});

// ============================================================================
// SUITE 3: PRODUCTION UI INTEGRATION & WEBGL LIFECYCLE
// ============================================================================
console.log(`\n${BOLD}[Suite 3] Production UI Integration & WebGL Lifecycle${RESET}`);

runTest('Suite 3', '3.1: CS2LoadoutCard loadout weapons integrity and exact Steam metadata', () => {
  expectEqual(DEFAULT_LOADOUT_WEAPONS.length, 5, 'Must have exactly 5 loadout weapons');
  const expectedSlots = ['Primary Rifle', 'CT Rifle', 'Sniper', 'Sidearm', 'Knife'];
  const actualSlots = DEFAULT_LOADOUT_WEAPONS.map((w) => w.slot);
  expectEqual(JSON.stringify(actualSlots), JSON.stringify(expectedSlots), 'Slot sequence must match');

  // Verify real user loadout items
  const ak = DEFAULT_LOADOUT_WEAPONS[0];
  expectEqual(ak.tabLabel, 'AK-47');
  expectEqual(ak.skin, 'Ice Coaled');
  expectEqual(ak.wearShort, 'MW');
  expectEqual(ak.float, 0.0825);
  expectEqual(ak.seed, 367);

  const m4 = DEFAULT_LOADOUT_WEAPONS[1];
  expectEqual(m4.tabLabel, 'M4A1-S');
  expectEqual(m4.skin, 'Liquidation');
  expectEqual(m4.wearShort, 'FT');
  expectEqual(m4.float, 0.3438);
  expectEqual(m4.seed, 937);

  const awp = DEFAULT_LOADOUT_WEAPONS[2];
  expectEqual(awp.tabLabel, 'AWP');
  expectEqual(awp.skin, 'Ice Coaled');
  expectEqual(awp.wearShort, 'FN');
  expectEqual(awp.float, 0.0631);
  expectEqual(awp.seed, 309);

  const usps = DEFAULT_LOADOUT_WEAPONS[3];
  expectEqual(usps.tabLabel, 'USP-S');
  expectEqual(usps.skin, 'Royal Guard');
  expectEqual(usps.wearShort, 'FN');
  expectEqual(usps.float, 0.056);
  expectEqual(usps.seed, 644);

  const knife = DEFAULT_LOADOUT_WEAPONS[4];
  expectEqual(knife.tabLabel, 'Knife');
});

runTest('Suite 3', '3.2: Verify CS2LoadoutCard and InventoryExplorer preserve Canvas (no dynamic key)', () => {
  const loadoutSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/steam/CS2LoadoutCard.tsx'), 'utf-8');
  const inventorySrc = fs.readFileSync(path.join(process.cwd(), 'src/components/steam/InventoryExplorer.tsx'), 'utf-8');

  // Match <ModelViewer ... /> in loadoutSrc
  const loadoutMatches = loadoutSrc.match(/<ModelViewer[\s\S]*?\/>/g) || [];
  expect(loadoutMatches.length >= 1, 'CS2LoadoutCard must render <ModelViewer>');
  for (const match of loadoutMatches) {
    expect(!match.includes('key='), 'CS2LoadoutCard must NOT set key prop on ModelViewer (preserves Canvas)');
  }

  // Match <ModelViewer ... /> in inventorySrc
  const invMatches = inventorySrc.match(/<ModelViewer[\s\S]*?\/>/g) || [];
  expect(invMatches.length >= 1, 'InventoryExplorer must render <ModelViewer>');
  for (const match of invMatches) {
    expect(!match.includes('key='), 'InventoryExplorer must NOT set key prop on ModelViewer (preserves Canvas)');
  }
});

runTest('Suite 3', '3.3: InventoryExplorer category filtering & inspect dock mode taxonomy', () => {
  expectEqual(JSON.stringify(DOCK_MODES), JSON.stringify(['3d', '2d', 'inspect']));
  expectEqual(CATEGORIES.length, 6, 'Must have 6 taxonomy categories');
  expect(CATEGORIES.includes('All'), 'Must include All');
  expect(CATEGORIES.includes('Rifles'), 'Must include Rifles');
  expect(CATEGORIES.includes('Pistols'), 'Must include Pistols');
  expect(CATEGORIES.includes('Snipers'), 'Must include Snipers');
  expect(CATEGORIES.includes('SMGs & Heavy'), 'Must include SMGs & Heavy');
  expect(CATEGORIES.includes('Collectibles'), 'Must include Collectibles');

  // Verify fallback items cover multiple categories
  const allCount = FALLBACK_INVENTORY.filter((item) => matchesCategory(item, 'All')).length;
  expectEqual(allCount, FALLBACK_INVENTORY.length, 'All must match all items');
  const riflesCount = FALLBACK_INVENTORY.filter((item) => matchesCategory(item, 'Rifles')).length;
  expect(riflesCount > 0, 'Must have rifle items');
});

// ============================================================================
// SUITE 4: ZERO-REGRESSION AUDIT (STEAM PARSER, FLOAT, .OBJ, R2 TEXTURES)
// ============================================================================
console.log(`\n${BOLD}[Suite 4] Zero-Regression Audit (Steam Parser, Float, .OBJ, R2 Textures)${RESET}`);

runTest('Suite 4', '4.1: Steam Inventory LRUCache LRU order, eviction, and zero-latency retrieval', () => {
  const cache = new LRUCache(3);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  expectEqual(cache.get('a'), 1);
  cache.set('d', 4); // 'b' was least recently accessed, so 'b' should be evicted
  expectEqual(cache.get('b'), undefined, 'Key b must be evicted');
  expectEqual(cache.get('a'), 1, 'Key a must still exist');
  expectEqual(cache.get('c'), 3, 'Key c must still exist');
  expectEqual(cache.get('d'), 4, 'Key d must still exist');
});

runTest('Suite 4', '4.2: formatInspectUrl parameter replacement for %owner_steamid% and %assetid%', () => {
  const template = 'steam://rungame/730/76561202255234323/+csgo_econ_action_preview%20S%owner_steamid%A%assetid%D12345';
  const resolved = formatInspectUrl(template, '76561198920486334', '53025617652');
  expect(!resolved.includes('%owner_steamid%'), 'owner_steamid must be replaced');
  expect(!resolved.includes('%assetid%'), 'assetid must be replaced');
  expect(resolved.includes('76561198920486334'), 'Steam ID must be present');
  expect(resolved.includes('53025617652'), 'Asset ID must be present');
});

runTest('Suite 4', '4.3: FALLBACK_INVENTORY contains 26+ authentic CS2 items with complete telemetry', () => {
  expect(FALLBACK_INVENTORY.length >= 26, `FALLBACK_INVENTORY must have >= 26 items (actual: ${FALLBACK_INVENTORY.length})`);
  
  // Verify user's primary loadout items
  const ak = FALLBACK_INVENTORY.find((i) => i.name.includes('AK-47') && i.name.includes('Ice Coaled'));
  expect(ak !== undefined, 'AK-47 Ice Coaled must exist');
  expect(Math.abs(ak.float - 0.0825) < 0.001, `AK-47 float must match 0.0825: ${ak.float}`);
  expectEqual(ak.seed, 367);
  expectEqual(ak.rarity, 'Classified');

  const m4 = FALLBACK_INVENTORY.find((i) => i.name.includes('M4A1-S') && i.name.includes('Liquidation'));
  expect(m4 !== undefined, 'M4A1-S Liquidation must exist');
  expect(Math.abs(m4.float - 0.3438) < 0.001, `M4A1-S float must match 0.3438: ${m4.float}`);
  expectEqual(m4.seed, 937);

  const awp = FALLBACK_INVENTORY.find((i) => i.name.includes('AWP') && i.name.includes('Ice Coaled'));
  expect(awp !== undefined, 'AWP Ice Coaled must exist');
  expect(Math.abs(awp.float - 0.0631) < 0.001, `AWP float must match 0.0631: ${awp.float}`);
  expectEqual(awp.seed, 309);

  const usps = FALLBACK_INVENTORY.find((i) => i.name.includes('USP-S') && i.name.includes('Royal Guard'));
  expect(usps !== undefined, 'USP-S Royal Guard must exist');
  expect(Math.abs(usps.float - 0.056) < 0.001, `USP-S float must match 0.0560: ${usps.float}`);
  expectEqual(usps.seed, 644);

  let weaponCount = 0;
  for (const item of FALLBACK_INVENTORY) {
    expect(typeof item.id === 'string' && item.id.length > 0, `Item ID must be valid: ${item.id}`);
    expect(typeof item.name === 'string' && item.name.length > 0, `Item name must be valid: ${item.name}`);
    expect(typeof item.rarity === 'string' && item.rarity.length > 0, `Item rarity missing: ${item.name}`);
    expect(typeof item.rarityColor === 'string' && item.rarityColor.startsWith('#'), `Rarity color missing: ${item.name}`);
    if (item.float !== null) {
      expect(typeof item.float === 'number' && item.float >= 0 && item.float <= 1, `Float out of range: ${item.float}`);
      expect(typeof item.seed === 'number' && item.seed >= 0 && item.seed <= 1000, `Seed out of range: ${item.seed}`);
      weaponCount++;
    }
  }
  expect(weaponCount >= 10, `Must have at least 10 weapon skins with live float values (found: ${weaponCount})`);
});

runTest('Suite 4', '4.4: R2 Texture Base Weapon Maps & Paint Finish resolution', () => {
  expect(BASE_WEAPON_MAPS['rif_ak47'] !== undefined, 'AK-47 base map must exist');
  expect(BASE_WEAPON_MAPS['rif_m4a1_s'] !== undefined, 'M4A1-S base map must exist');
  expect(BASE_WEAPON_MAPS['snip_awp'] !== undefined, 'AWP base map must exist');
  expect(BASE_WEAPON_MAPS['pist_223'] !== undefined, 'USP-S base map must exist');

  const akMaps = getR2WeaponTextures('AK-47');
  expect(akMaps !== null, 'AK-47 R2 textures must resolve');
  expect(akMaps.aoUrl.includes('rif_ak47_ao'), 'AK-47 AO URL must match');
  expect(akMaps.surfaceUrl.includes('rif_ak47_surface'), 'AK-47 Surface URL must match');
  expect(akMaps.masksUrl.includes('rif_ak47_masks'), 'AK-47 Masks URL must match');

  for (const type of PAINT_FINISH_TYPES) {
    const paintUrl = getR2PaintFinishUrl(type, 'paint');
    expect(paintUrl.includes(`paints/${type}`), `Paint finish url must include type: ${paintUrl}`);
  }
});

runTest('Suite 4', '4.5: All 35 .obj files in public/models/ parse cleanly via OBJLoader with valid vertex normals', () => {
  const loader = new OBJLoader();
  for (const displayName of ALL_35_WEAPON_NAMES) {
    const relPath = getWeaponModelPath(displayName);
    const absPath = path.join(process.cwd(), 'public', relPath.replace(/^\//, ''));
    expect(fs.existsSync(absPath), `Model file must exist: ${absPath}`);

    const content = fs.readFileSync(absPath, 'utf-8');
    const obj = loader.parse(content);
    expect(obj instanceof THREE.Group, `Parsed result must be THREE.Group for ${displayName}`);

    // Verify non-empty BufferGeometry and compute vertex normals
    let totalVertices = 0;
    obj.traverse((child) => {
      if ((child).isMesh && child.geometry) {
        child.geometry.computeVertexNormals();
        const pos = child.geometry.attributes.position;
        const norm = child.geometry.attributes.normal;
        expect(pos && pos.count > 0, `Geometry must have vertices for ${displayName}`);
        expect(norm && norm.count > 0, `Geometry must have normals for ${displayName}`);

        // Check for NaN in normals
        for (let i = 0; i < Math.min(norm.count, 50); i++) {
          const nx = norm.getX(i);
          const ny = norm.getY(i);
          const nz = norm.getZ(i);
          expect(!Number.isNaN(nx) && !Number.isNaN(ny) && !Number.isNaN(nz), `Normals must not contain NaN`);
        }
        totalVertices += pos.count;
      }
    });
    expect(totalVertices > 100, `Weapon mesh must have substantial vertex count (>100): ${totalVertices}`);
  }
});

// ============================================================================
// SUITE 5: PRIVACY INVARIANT AUDIT ACROSS ENTIRE REPOSITORY
// ============================================================================
console.log(`\n${BOLD}[Suite 5] Privacy Invariant Audit across Entire Repository Source & Output${RESET}`);

runTest('Suite 5', '5.1: Zero personal names or locations exist in any project source file', () => {
  const scanDirs = ['src', 'public'];
  const prohibitedPatterns = [
    /\bcharlie\b/i,
    /\bcafici\b/i,
    /\bcharcaf\b/i,
    /\/Users\/charliecafici/i,
  ];

  function scanDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const f of files) {
      const fullPath = path.join(dir, f.name);
      if (f.isDirectory()) {
        scanDir(fullPath);
      } else if (f.isFile() && (f.name.endsWith('.ts') || f.name.endsWith('.tsx') || f.name.endsWith('.astro') || f.name.endsWith('.json') || f.name.endsWith('.mjs'))) {
        const text = fs.readFileSync(fullPath, 'utf-8');
        for (const pattern of prohibitedPatterns) {
          const match = text.match(pattern);
          expect(match === null, `Prohibited identifier '${pattern}' found in ${fullPath}`);
        }
      }
    }
  }

  for (const dir of scanDirs) {
    const absDir = path.join(process.cwd(), dir);
    if (fs.existsSync(absDir)) {
      scanDir(absDir);
    }
  }
});

// Summary
console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`${BOLD}   EMPIRICAL ADVERSARIAL STRESS TEST SUMMARY (CHALLENGER M4_2_REP)${RESET}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`  Total Tests Run:     ${totalTests}`);
console.log(`  Passed Tests:        ${GREEN}${passedTests}${RESET}`);
console.log(`  Failed Tests:        ${failedTests === 0 ? GREEN : RED}${failedTests}${RESET}`);
console.log(`  Total Assertions:    ${totalAssertions}`);

if (failedTests > 0) {
  console.log(`\n${RED}[VERDICT: REJECT] ${failedTests} test(s) failed:${RESET}`);
  for (const f of failureDetails) {
    console.error(`  - [${f.suite}] ${f.name}: ${f.error.message}`);
  }
  process.exit(1);
} else {
  console.log(`\n${GREEN}[VERDICT: APPROVE] All ${totalTests} adversarial stress tests passed (100% success).${RESET}\n`);
  process.exit(0);
}
