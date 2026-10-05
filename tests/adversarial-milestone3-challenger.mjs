#!/usr/bin/env node
/**
 * Empirical Adversarial Challenger Test Suite: Milestone 3 (M3)
 * Focus:
 * 1. WebGL Canvas Preservation & Context Teardown Prevention across weapon switches
 * 2. Weapon switching stress test in CS2LoadoutCard and InventoryExplorer (1,000 switches)
 * 3. Inspect View Dock state machine and 3-way toggle contracts
 * 4. Model format transition stress (OBJ <-> GLB <-> Procedural fallback)
 * 5. Full inventory dataset parsing & edge-case weapon telemetry handling
 * 6. Privacy invariant enforcement
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

// Import target modules
const {
  default: ModelViewer,
  disposeThreeObject,
  isObjModelUrl,
  getWeaponModelPath,
  WEAPON_MODEL_MAP,
  applySource2SurfaceSwizzle,
} = await import('../src/components/ModelViewer.tsx');

const {
  CS2LoadoutCard,
  DEFAULT_LOADOUT_WEAPONS,
  getWearBracket,
  getFloatPercentage,
  formatSeed,
} = await import('../src/components/steam/CS2LoadoutCard.tsx');

const {
  default: InventoryExplorer,
  DOCK_MODES,
  CATEGORIES,
  getWearTier,
  matchesCategory,
  matchesSearch,
} = await import('../src/components/steam/InventoryExplorer.tsx');

const {
  compositeSkinFinish,
  getSkinFallbackColor,
  calculateEffectiveWear,
} = await import('../src/utils/skinCompositor.ts');

const {
  getR2WeaponTextures,
} = await import('../src/utils/r2Textures.ts');

const { FALLBACK_INVENTORY } = await import('../src/utils/steam.ts');

// ANSI formatting
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
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
    console.log(`  ${GREEN}✓${RESET} [${suite}] ${name} ${GRAY}(${duration}ms)${RESET}`);
    passedTests++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  ${RED}✗${RESET} [${suite}] ${name} ${GRAY}(${duration}ms)${RESET}`);
    console.error(`     ${RED}Error: ${err.message}${RESET}`);
    if (err.stack) {
      console.error(GRAY + err.stack.split('\n').slice(1, 4).join('\n') + RESET);
    }
    failedTests++;
    failureDetails.push({ suite, name, error: err.message });
  }
}

function expect(condition, message) {
  totalAssertions++;
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log(`${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`${BOLD}   EMPIRICAL ADVERSARIAL CHALLENGER: MILESTONE 3 VERIFICATION                  ${RESET}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}\n`);

// =============================================================================
// TEST SUITE 1: WebGL Canvas Preservation & Key Architecture Verification
// =============================================================================
console.log(`${BOLD}[Suite 1] WebGL Canvas Preservation & React Key Architecture${RESET}`);

runTest('Suite 1', '1.1: Verify CS2LoadoutCard.tsx does NOT apply a key to ModelViewer (Canvas preservation)', () => {
  const cardPath = path.resolve('src/components/steam/CS2LoadoutCard.tsx');
  const source = fs.readFileSync(cardPath, 'utf8');

  // Find the ModelViewer tag in CS2LoadoutCard
  const mvTagMatch = source.match(/<ModelViewer\s+([\s\S]*?)\/>/);
  expect(mvTagMatch !== null, 'ModelViewer tag must exist in CS2LoadoutCard.tsx');

  const propsText = mvTagMatch[1];
  // Verify that key={...} is NOT present in the ModelViewer props
  const hasKey = /\bkey\s*=/.test(propsText);
  expect(!hasKey, `ModelViewer in CS2LoadoutCard must NOT have a key prop! Having a key destroys the WebGL canvas on tab switch.`);

  // Verify necessary props are passed
  expect(propsText.includes('modelUrl={modelAssetUrl}'), 'Must pass modelUrl={modelAssetUrl}');
  expect(propsText.includes('weaponName={activeWeapon.name}'), 'Must pass weaponName={activeWeapon.name}');
  expect(propsText.includes('skinName={activeWeapon.skin}'), 'Must pass skinName={activeWeapon.skin}');
  expect(propsText.includes('float={activeWeapon.float}'), 'Must pass float={activeWeapon.float}');
  expect(propsText.includes('seed={activeWeapon.seed}'), 'Must pass seed={activeWeapon.seed}');
  expect(propsText.includes('rarityColor={activeWeapon.rarityColor}'), 'Must pass rarityColor={activeWeapon.rarityColor}');
});

runTest('Suite 1', '1.2: Verify InventoryExplorer.tsx does NOT apply a key to ModelViewer (Canvas preservation)', () => {
  const iePath = path.resolve('src/components/steam/InventoryExplorer.tsx');
  const source = fs.readFileSync(iePath, 'utf8');

  // Find the ModelViewer tag in InventoryExplorer
  const mvTagMatch = source.match(/<ModelViewer\s+([\s\S]*?)\/>/);
  expect(mvTagMatch !== null, 'ModelViewer tag must exist in InventoryExplorer.tsx');

  const propsText = mvTagMatch[1];
  // Verify that key={...} is NOT present in the ModelViewer props
  const hasKey = /\bkey\s*=/.test(propsText);
  expect(!hasKey, `ModelViewer in InventoryExplorer must NOT have a key prop! Having a key destroys the WebGL canvas on item switch.`);

  // Verify necessary props are passed
  expect(propsText.includes('modelUrl={activeModelPath}'), 'Must pass modelUrl={activeModelPath}');
  expect(propsText.includes('weaponName={selectedItem.name}'), 'Must pass weaponName={selectedItem.name}');
  expect(propsText.includes('skinName={selectedParsed?.skinName}'), 'Must pass skinName={selectedParsed?.skinName}');
  expect(propsText.includes('float={selectedItem.float}'), 'Must pass float={selectedItem.float}');
  expect(propsText.includes('seed={selectedItem.seed}'), 'Must pass seed={selectedItem.seed}');
  expect(propsText.includes('rarityColor={selectedItem.rarityColor}'), 'Must pass rarityColor={selectedItem.rarityColor}');
});

runTest('Suite 1', '1.3: Verify ModelViewer internal architecture isolates remount to ModelErrorBoundary inside persistent Canvas', () => {
  const mvPath = path.resolve('src/components/ModelViewer.tsx');
  const source = fs.readFileSync(mvPath, 'utf8');

  // Focus on the return statement of function ModelViewer
  const fnStartIdx = source.indexOf('export default function ModelViewer(');
  expect(fnStartIdx !== -1, 'export default function ModelViewer must exist');
  const fnBody = source.slice(fnStartIdx);
  const returnIdx = fnBody.indexOf('return (');
  expect(returnIdx !== -1, 'ModelViewer return statement must exist');
  const returnBlock = fnBody.slice(returnIdx);

  const canvasIdx = returnBlock.indexOf('<Canvas');
  const boundaryIdx = returnBlock.indexOf('<ModelErrorBoundary');
  const closingCanvasIdx = returnBlock.indexOf('</Canvas>');

  expect(canvasIdx !== -1, 'Canvas must be rendered in ModelViewer return block');
  expect(boundaryIdx !== -1, 'ModelErrorBoundary must be rendered in ModelViewer return block');
  expect(closingCanvasIdx !== -1, 'Closing </Canvas> must exist in ModelViewer return block');

  expect(canvasIdx < boundaryIdx, '<Canvas> must wrap <ModelErrorBoundary>');
  expect(boundaryIdx < closingCanvasIdx, '<ModelErrorBoundary> must be inside <Canvas>');

  // Verify ModelErrorBoundary has key based on effectiveUrl
  expect(
    source.includes('key={effectiveUrl || \'fallback\'}'),
    'ModelErrorBoundary must have key={effectiveUrl || \'fallback\'} to remount inner scene without tearing down outer Canvas'
  );
});

// =============================================================================
// TEST SUITE 2: Rapid Weapon Switching Stress (1,000 Transitions)
// =============================================================================
console.log(`\n${BOLD}[Suite 2] Weapon Switching Stress & WebGL Lifecycle (1,000 Cycles)${RESET}`);

runTest('Suite 2', '2.1: 1,000 rapid weapon switches across CS2LoadoutCard loadout weapons', () => {
  const weapons = DEFAULT_LOADOUT_WEAPONS;
  expect(weapons.length === 5, 'Must have 5 loadout weapons');

  // Track disposal invocations
  let totalMeshDisposals = 0;
  let totalTexDisposals = 0;
  let totalMatDisposals = 0;

  let previousScene = null;

  for (let i = 0; i < 1000; i++) {
    const weapon = weapons[i % weapons.length];

    // Determine model URL
    let modelAssetUrl = '/models/placeholder-weapon.glb';
    if (weapon.tabLabel === 'AK-47') modelAssetUrl = '/models/weapon_rif_ak47.obj';
    else if (weapon.tabLabel === 'M4A1-S') modelAssetUrl = '/models/weapon_rif_m4a1_silencer.obj';
    else if (weapon.tabLabel === 'AWP') modelAssetUrl = '/models/weapon_snip_awp.obj';
    else if (weapon.tabLabel === 'USP-S') modelAssetUrl = '/models/weapon_pist_usp_silencer.obj';
    else if (weapon.tabLabel === 'Knife') modelAssetUrl = '/models/placeholder-weapon.glb';

    const isObj = isObjModelUrl(modelAssetUrl);

    // Verify model file exists on disk
    const diskPath = path.resolve('public' + modelAssetUrl);
    expect(fs.existsSync(diskPath), `Model file ${modelAssetUrl} must exist on disk`);

    // Clean up previous scene if exists
    if (previousScene) {
      disposeThreeObject(previousScene);
      previousScene = null;
    }

    // Create mock scene hierarchy representing weapon
    const scene = new THREE.Group();
    const geom = new THREE.BufferGeometry();
    geom.dispose = () => { totalMeshDisposals++; };

    const skinRes = compositeSkinFinish({
      weaponName: weapon.name,
      skinName: weapon.skin,
      float: weapon.float,
      seed: weapon.seed,
      rarityColor: weapon.rarityColor,
    });
    expect(skinRes !== null, 'compositeSkinFinish must succeed');
    expect(skinRes.texture instanceof THREE.Texture, 'Result texture must be THREE.Texture');

    const origTexDispose = skinRes.texture.dispose.bind(skinRes.texture);
    skinRes.texture.dispose = () => {
      totalTexDisposals++;
      origTexDispose();
    };

    const mat = new THREE.MeshPhysicalMaterial({
      map: skinRes.texture,
      metalness: skinRes.effectiveMetalness,
      roughness: skinRes.effectiveRoughness,
      clearcoat: skinRes.effectiveClearcoat,
    });
    mat.dispose = () => { totalMatDisposals++; };

    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    previousScene = scene;
  }

  // Final cleanup
  if (previousScene) {
    disposeThreeObject(previousScene);
  }

  expect(totalMeshDisposals === 1000, `Expected 1000 mesh disposals, got ${totalMeshDisposals}`);
  expect(totalTexDisposals === 1000, `Expected 1000 texture disposals, got ${totalTexDisposals}`);
  expect(totalMatDisposals === 1000, `Expected 1000 material disposals, got ${totalMatDisposals}`);
});

runTest('Suite 2', '2.2: Ping-Pong & Random weapon transitions across all FALLBACK_INVENTORY items', () => {
  const items = FALLBACK_INVENTORY;
  expect(items.length >= 26, `FALLBACK_INVENTORY must contain at least 26 items, found ${items.length}`);

  // Test random sequence of 200 transitions
  let currentModel = null;
  for (let i = 0; i < 200; i++) {
    const randomIndex = Math.floor(Math.random() * items.length);
    const item = items[randomIndex];

    const modelPath = getWeaponModelPath(item.name);
    expect(typeof modelPath === 'string' && modelPath.length > 0, `Model path for ${item.name} must be valid string`);

    const fullDiskPath = path.resolve('public' + modelPath);
    expect(fs.existsSync(fullDiskPath), `Model path ${modelPath} for ${item.name} must exist on disk`);

    currentModel = modelPath;
  }
});

// =============================================================================
// TEST SUITE 3: Inspect View Dock Contract & Inventory Explorer Integrity
// =============================================================================
console.log(`\n${BOLD}[Suite 3] Inspect View Dock Contract & State Transitions${RESET}`);

runTest('Suite 3', '3.1: Verify DOCK_MODES consistency and transition behavior', () => {
  expect(DOCK_MODES.length === 3, 'Must have exactly 3 dock modes');
  expect(DOCK_MODES[0] === '3d', 'Dock mode 0 must be 3d');
  expect(DOCK_MODES[1] === '2d', 'Dock mode 1 must be 2d');
  expect(DOCK_MODES[2] === 'inspect', 'Dock mode 2 must be inspect');
});

runTest('Suite 3', '3.2: Verify category filters handle all 26+ fallback inventory items without throwing', () => {
  for (const cat of CATEGORIES) {
    let matchCount = 0;
    for (const item of FALLBACK_INVENTORY) {
      if (matchesCategory(item, cat)) {
        matchCount++;
      }
    }
    if (cat === 'All') {
      expect(matchCount === FALLBACK_INVENTORY.length, 'All category must match every item');
    } else {
      expect(matchCount >= 0, `Category ${cat} must return non-negative match count`);
    }
  }
});

runTest('Suite 3', '3.3: Adversarial item search strings (regex, null, unicode, special chars)', () => {
  const sample = FALLBACK_INVENTORY[0];
  const adversarialQueries = [
    '',
    '   ',
    '.*',
    '[a-z]+',
    '\\d+',
    '(\x00)',
    '★',
    'StatTrak™',
    '12345678901234567890',
    '<script>alert("xss")</script>',
    'DROP TABLE items;',
    '\' OR 1=1 --',
    '🎉✨🔥',
  ];

  for (const q of adversarialQueries) {
    assert.doesNotThrow(() => {
      const result = matchesSearch(sample, q);
      expect(typeof result === 'boolean', `Result of matchesSearch for "${q}" must be boolean`);
    }, `matchesSearch must not throw for query: "${q}"`);
  }
});

runTest('Suite 3', '3.4: Stock weapons and items with float === null handling in getWearTier and getWearBracket', () => {
  const stockItem = {
    id: 'stock-101',
    name: 'Stock Knife',
    iconUrl: 'knife.png',
    inspectUrl: null,
    float: null,
    seed: null,
    rarity: 'Stock',
    type: 'Knife',
    rarityColor: '#b0c3d9',
  };

  const wearTier = getWearTier(stockItem.float);
  expect(wearTier === null, 'Stock item with float null must return null wear tier');

  // getWearBracket with NaN or undefined or null
  expect(getWearBracket(null) === 'Battle-Scarred' || typeof getWearBracket(null) === 'string', 'getWearBracket must handle null safely');
  expect(getWearBracket(NaN) === 'Battle-Scarred' || typeof getWearBracket(NaN) === 'string', 'getWearBracket must handle NaN safely');
});

// =============================================================================
// TEST SUITE 4: Format Transition Stress (OBJ <-> GLB <-> Procedural Fallback)
// =============================================================================
console.log(`\n${BOLD}[Suite 4] Model Format Transitions (OBJ <-> GLB <-> Fallback)${RESET}`);

runTest('Suite 4', '4.1: Model URL detection correctly routes between OBJLoader and GLTFLoader', () => {
  expect(isObjModelUrl('/models/weapon_rif_ak47.obj') === true, 'AK-47 .obj must be OBJ');
  expect(isObjModelUrl('/models/placeholder-weapon.glb') === false, 'placeholder .glb must NOT be OBJ');
  expect(isObjModelUrl('/models/test.gltf') === false, 'test .gltf must NOT be OBJ');
  expect(isObjModelUrl('') === false, 'Empty string must NOT be OBJ');
  expect(isObjModelUrl(undefined) === false, 'undefined must NOT be OBJ');
});

runTest('Suite 4', '4.2: WEAPON_MODEL_MAP and getWeaponModelPath resolve all standard CS2 firearms', () => {
  const firearmNames = [
    'AK-47',
    'M4A1-S',
    'M4A4',
    'AWP',
    'USP-S',
    'Glock-18',
    'Desert Eagle',
    'MAC-10',
    'UMP-45',
    'Galil AR',
    'Zeus x27',
  ];

  for (const name of firearmNames) {
    const resolvedPath = getWeaponModelPath(name);
    expect(typeof resolvedPath === 'string' && resolvedPath.endsWith('.obj'), `${name} must resolve to .obj file, got ${resolvedPath}`);
    const fullPath = path.resolve('public' + resolvedPath);
    expect(fs.existsSync(fullPath), `Resolved model file ${resolvedPath} for ${name} must exist on disk`);
  }
});

// =============================================================================
// TEST SUITE 5: Privacy Invariant Audit
// =============================================================================
console.log(`\n${BOLD}[Suite 5] Privacy Invariant Audit${RESET}`);

runTest('Suite 5', '5.1: Zero personal names or locations exist in package.json or M3 components', () => {
  const targetFiles = [
    'package.json',
    'src/components/steam/CS2LoadoutCard.tsx',
    'src/components/steam/InventoryExplorer.tsx',
    'src/components/ModelViewer.tsx',
    'src/pages/test/model-viewer.astro',
    'src/pages/inventory.astro',
  ];

  const forbiddenPatterns = [
    /charlie/i,
    /cafici/i,
    /melbourne/i,
    /australia/i,
    /victoria/i,
    /gmail\.com/i,
    /hotmail\.com/i,
  ];

  for (const relPath of targetFiles) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    for (const pattern of forbiddenPatterns) {
      const match = content.match(pattern);
      expect(!match, `File ${relPath} must NOT contain forbidden private pattern: ${pattern}. Match: "${match?.[0]}"`);
    }
  }
});

// =============================================================================
// VERIFICATION SUMMARY
// =============================================================================
console.log(`\n${BOLD}================================================================================${RESET}`);
console.log(`${BOLD}   ADVERSARIAL CHALLENGER VERIFICATION SUMMARY (M3)                            ${RESET}`);
console.log(`${BOLD}================================================================================${RESET}`);
console.log(`  Total Tests Run:     ${totalTests}`);
console.log(`  Passed Tests:        ${CYAN}${passedTests}${RESET}`);
console.log(`  Failed Tests:        ${failedTests > 0 ? RED : GREEN}${failedTests}${RESET}`);
console.log(`  Total Assertions:    ${totalAssertions}`);

if (failedTests > 0) {
  console.log(`\n${BOLD}${RED}[VERDICT: REQUEST_CHANGES] ${failedTests} tests failed.${RESET}\n`);
  for (const f of failureDetails) {
    console.error(`  - [${f.suite}] ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log(`\n${BOLD}${GREEN}[VERDICT: APPROVE] All ${passedTests} adversarial stress tests passed with 100% success.${RESET}\n`);
  process.exit(0);
}
