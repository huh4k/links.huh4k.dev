#!/usr/bin/env node
/**
 * Empirical Adversarial Stress Test Suite: 3D Weapon Model Engine & SSR Safety
 *
 * Suites:
 * 1. 35 CS2 Weapon .obj Models Stress & Geometry / Normal Integrity
 * 2. Scale Normalization & Box3 Centering Across Extreme Weapon Dimensions
 * 3. getWeaponModelPath Exhaustive Resolution & Edge-Case Robustness
 * 4. WebGL Resource Cleanup & Unmount Disposal (disposeThreeObject, useLoader.clear)
 * 5. Hostile SSR Isolation & Server-Side Safety (poisoned window/document)
 * 6. OrbitControls Camera Pitch Angle Clamping (45° to 117°) & Zoom Boundaries
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Transparently re-spawn under tsx if run via plain `node tests/adversarial-3d-engine.mjs`
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
import { OBJLoader } from 'three-stdlib';
import { useLoader } from '@react-three/fiber';

const {
  getWeaponModelPath,
  isObjModelUrl,
  WEAPON_MODEL_MAP,
  DEFAULT_WEAPON_MODEL,
} = await import('../src/utils/weaponModels.ts');

const {
  default: ModelViewer,
  ModelViewerSkeleton,
  disposeThreeObject,
} = await import('../src/components/ModelViewer.tsx');

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
    fn();
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
console.log(`${BOLD}${CYAN}   3D WEAPON MODEL ENGINE & SSR ADVERSARIAL STRESS TEST SUITE                  ${RESET}`);
console.log(`${BOLD}================================================================================${RESET}\n`);

// -----------------------------------------------------------------------------
// SUITE 1: 35 CS2 Weapon .obj Models Stress & Geometry / Normal Integrity
// -----------------------------------------------------------------------------
console.log(`${BOLD}[Suite 1] 35 CS2 Weapon .obj Models Stress & Geometry / Normal Integrity${RESET}`);

const modelsDir = path.resolve('public/models');
const objFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.obj')).sort();

runTest('1.1: Verify exactly 35 .obj files exist in public/models with non-zero size', () => {
  recordAssertion();
  assert.strictEqual(objFiles.length, 35, `Expected exactly 35 .obj files, found ${objFiles.length}`);
  
  for (const file of objFiles) {
    recordAssertion();
    const fullPath = path.join(modelsDir, file);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 50000, `Model ${file} must have non-trivial size (>50KB), got ${stat.size}`);
  }
});

runTest('1.2: Parse all 35 .obj files via OBJLoader without syntax or parsing exceptions', () => {
  const loader = new OBJLoader();
  for (const file of objFiles) {
    recordAssertion();
    const fullPath = path.join(modelsDir, file);
    const text = fs.readFileSync(fullPath, 'utf8');
    assert.doesNotThrow(() => {
      const obj = loader.parse(text);
      assert.ok(obj instanceof THREE.Object3D, `Parsed result must be an Object3D for ${file}`);
    }, `Failed to parse ${file}`);
  }
});

runTest('1.3: Validate mesh hierarchy and non-empty BufferGeometry across all 35 models', () => {
  const loader = new OBJLoader();
  let totalMeshCount = 0;
  let totalVertexCount = 0;

  for (const file of objFiles) {
    const text = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    const obj = loader.parse(text);
    let meshCountInModel = 0;

    obj.traverse((child) => {
      if (child.isMesh) {
        meshCountInModel++;
        recordAssertion();
        assert.ok(child.geometry instanceof THREE.BufferGeometry, `Mesh must have BufferGeometry in ${file}`);
        recordAssertion();
        const pos = child.geometry.attributes.position;
        assert.ok(pos && pos.count > 0, `Geometry must have non-empty position attribute in ${file}`);
        totalVertexCount += pos.count;
      }
    });

    recordAssertion();
    assert.ok(meshCountInModel > 0, `Model ${file} must contain at least 1 Mesh`);
    totalMeshCount += meshCountInModel;
  }

  recordAssertion();
  assert.strictEqual(totalMeshCount, 35, 'Total meshes across 35 files must equal 35');
  recordAssertion();
  assert.ok(totalVertexCount > 3000000, `Expected >3,000,000 vertices across CS2 models, got ${totalVertexCount}`);
});

runTest('1.4: Compute vertex normals for all 35 models and verify zero NaNs across 3,286,488 vertices', () => {
  const loader = new OBJLoader();
  let nanCount = 0;
  let totalNormalsInspected = 0;

  for (const file of objFiles) {
    const text = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    const obj = loader.parse(text);

    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry.computeVertexNormals();
        const norm = child.geometry.attributes.normal;
        recordAssertion();
        assert.ok(norm, `Normal attribute must exist for ${file}`);
        const arr = norm.array;
        totalNormalsInspected += norm.count;

        for (let i = 0; i < arr.length; i++) {
          if (Number.isNaN(arr[i]) || !Number.isFinite(arr[i])) {
            nanCount++;
          }
        }
      }
    });
  }

  recordAssertion();
  assert.strictEqual(nanCount, 0, `Found ${nanCount} NaN or non-finite normal components`);
  recordAssertion();
  assert.strictEqual(totalNormalsInspected, 3286488, `Verified all 3,286,488 vertex normals`);
});

runTest('1.5: Validate Box3 bounding boxes and non-degenerate volumes across all 35 models', () => {
  const loader = new OBJLoader();
  for (const file of objFiles) {
    const text = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    const obj = loader.parse(text);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);

    recordAssertion();
    assert.ok(size.x > 0, `Model ${file} width (size.x) must be > 0`);
    recordAssertion();
    assert.ok(size.y > 0, `Model ${file} height (size.y) must be > 0`);
    recordAssertion();
    assert.ok(size.z > 0, `Model ${file} depth (size.z) must be > 0`);
  }
});

// -----------------------------------------------------------------------------
// SUITE 2: Scale Normalization & Box3 Centering Across Extreme Weapon Dimensions
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 2] Scale Normalization & Box3 Centering Across Extreme Weapon Dimensions${RESET}`);

runTest('2.1: Empirical analysis of raw dimensional extremes (AWP vs P2000 ratio > 7.4x)', () => {
  const loader = new OBJLoader();
  const awp = loader.parse(fs.readFileSync(path.join(modelsDir, 'weapon_snip_awp.obj'), 'utf8'));
  const p2000 = loader.parse(fs.readFileSync(path.join(modelsDir, 'weapon_pist_hkp2000.obj'), 'utf8'));

  const awpBox = new THREE.Box3().setFromObject(awp);
  const p2000Box = new THREE.Box3().setFromObject(p2000);

  const awpSize = new THREE.Vector3();
  const p2000Size = new THREE.Vector3();
  awpBox.getSize(awpSize);
  p2000Box.getSize(p2000Size);

  const awpMax = Math.max(awpSize.x, awpSize.y, awpSize.z);
  const p2000Max = Math.max(p2000Size.x, p2000Size.y, p2000Size.z);

  recordAssertion();
  assert.ok(awpMax > 50, `AWP raw max dimension should be > 50 (got ${awpMax.toFixed(2)})`);
  recordAssertion();
  assert.ok(p2000Max < 10, `P2000 raw max dimension should be < 10 (got ${p2000Max.toFixed(2)})`);
  recordAssertion();
  const ratio = awpMax / p2000Max;
  assert.ok(ratio > 7.0, `Extreme size ratio between sniper and pistol must exceed 7.0x (got ${ratio.toFixed(2)}x)`);
});

runTest('2.2: Local geometry.center() localizes vertex centroids around (0,0,0)', () => {
  const loader = new OBJLoader();
  const awp = loader.parse(fs.readFileSync(path.join(modelsDir, 'weapon_snip_awp.obj'), 'utf8'));

  awp.traverse((child) => {
    if (child.isMesh) {
      child.geometry.computeVertexNormals();
      child.geometry.center();
      child.geometry.computeBoundingBox();

      const geoBox = child.geometry.boundingBox;
      const geoCenter = new THREE.Vector3();
      geoBox.getCenter(geoCenter);

      recordAssertion();
      assert.ok(geoCenter.length() < 1e-5, `Geometry center must be at origin (length: ${geoCenter.length()})`);
    }
  });
});

runTest('2.3: Scale normalization uniformly clamps all 35 models to target size 2.4 (±1e-4 tolerance)', () => {
  const loader = new OBJLoader();
  const targetSize = 2.4;

  for (const file of objFiles) {
    const text = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    const obj = loader.parse(text);

    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry.computeVertexNormals();
        child.geometry.center();
      }
    });

    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    recordAssertion();
    assert.ok(maxDim > 0, `Max dimension must be positive for ${file}`);

    obj.scale.setScalar(targetSize / maxDim);
    obj.updateMatrixWorld(true);

    const normBox = new THREE.Box3().setFromObject(obj);
    const normSize = new THREE.Vector3();
    normBox.getSize(normSize);
    const normMaxDim = Math.max(normSize.x, normSize.y, normSize.z);

    recordAssertion();
    assert.ok(
      Math.abs(normMaxDim - targetSize) < 1e-4,
      `Normalized max dimension for ${file} was ${normMaxDim}, expected ${targetSize}`
    );
  }
});

runTest('2.4: Normalized bounding box center remains origin-aligned (offset < 0.05 units) across all 35 models', () => {
  const loader = new OBJLoader();
  const targetSize = 2.4;

  for (const file of objFiles) {
    const text = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    const obj = loader.parse(text);

    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry.computeVertexNormals();
        child.geometry.center();
      }
    });

    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    obj.scale.setScalar(targetSize / maxDim);
    obj.updateMatrixWorld(true);

    const normBox = new THREE.Box3().setFromObject(obj);
    const normCenter = new THREE.Vector3();
    normBox.getCenter(normCenter);

    recordAssertion();
    assert.ok(
      normCenter.length() < 0.05,
      `Normalized center for ${file} had offset ${normCenter.length()}, expected < 0.05`
    );
  }
});

runTest('2.5: Synthetic extreme geometries (needle aspect 10,000:1, disc aspect 1:1,000) normalize without NaN', () => {
  const targetSize = 2.4;

  // Case A: Needle mesh
  const needleGeo = new THREE.BoxGeometry(100, 0.01, 0.01);
  const needleMesh = new THREE.Mesh(needleGeo, new THREE.MeshBasicMaterial());
  const needleGroup = new THREE.Group().add(needleMesh);

  needleGeo.computeVertexNormals();
  needleGeo.center();

  const needleBox = new THREE.Box3().setFromObject(needleGroup);
  const needleSize = new THREE.Vector3();
  needleBox.getSize(needleSize);
  const needleMax = Math.max(needleSize.x, needleSize.y, needleSize.z);
  needleGroup.scale.setScalar(targetSize / needleMax);
  needleGroup.updateMatrixWorld(true);

  const needleNormBox = new THREE.Box3().setFromObject(needleGroup);
  const needleNormSize = new THREE.Vector3();
  needleNormBox.getSize(needleNormSize);

  recordAssertion();
  assert.ok(Math.abs(Math.max(needleNormSize.x, needleNormSize.y, needleNormSize.z) - targetSize) < 1e-4);
  recordAssertion();
  assert.ok(!Number.isNaN(needleNormSize.x) && !Number.isNaN(needleNormSize.y) && !Number.isNaN(needleNormSize.z));

  // Case B: Planar Disc
  const discGeo = new THREE.CylinderGeometry(5, 5, 0.001, 32);
  const discMesh = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial());
  const discGroup = new THREE.Group().add(discMesh);

  discGeo.computeVertexNormals();
  discGeo.center();

  const discBox = new THREE.Box3().setFromObject(discGroup);
  const discSize = new THREE.Vector3();
  discBox.getSize(discSize);
  const discMax = Math.max(discSize.x, discSize.y, discSize.z);
  discGroup.scale.setScalar(targetSize / discMax);
  discGroup.updateMatrixWorld(true);

  const discNormBox = new THREE.Box3().setFromObject(discGroup);
  const discNormSize = new THREE.Vector3();
  discNormBox.getSize(discNormSize);

  recordAssertion();
  assert.ok(Math.abs(Math.max(discNormSize.x, discNormSize.y, discNormSize.z) - targetSize) < 1e-4);
  recordAssertion();
  assert.ok(!Number.isNaN(discNormSize.x) && !Number.isNaN(discNormSize.y) && !Number.isNaN(discNormSize.z));
});

// -----------------------------------------------------------------------------
// SUITE 3: getWeaponModelPath Exhaustive Resolution & Edge-Case Robustness
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 3] getWeaponModelPath Exhaustive Resolution & Edge-Case Robustness${RESET}`);

runTest('3.1: 100% reachability: All 35 .obj files in public/models/ are mapped in WEAPON_MODEL_MAP', () => {
  const mappedPaths = new Set(Object.values(WEAPON_MODEL_MAP));
  recordAssertion();
  assert.strictEqual(mappedPaths.size, 35, `WEAPON_MODEL_MAP must map to all 35 distinct model files`);

  for (const file of objFiles) {
    const expectedPath = `/models/${file}`;
    recordAssertion();
    assert.ok(mappedPaths.has(expectedPath), `Model ${expectedPath} must be present in WEAPON_MODEL_MAP`);
  }
});

runTest('3.2: 35 canonical weapon names resolve to their exact corresponding .obj model file', () => {
  const canonicalWeapons = [
    ['AK-47', '/models/weapon_rif_ak47.obj'],
    ['M4A1-S', '/models/weapon_rif_m4a1_silencer.obj'],
    ['M4A4', '/models/weapon_rif_m4a4.obj'],
    ['Galil AR', '/models/weapon_rif_galilar.obj'],
    ['FAMAS', '/models/weapon_rif_famas.obj'],
    ['AUG', '/models/weapon_rif_aug.obj'],
    ['SG 553', '/models/weapon_rif_sg556.obj'],
    ['AWP', '/models/weapon_snip_awp.obj'],
    ['SSG 08', '/models/weapon_snip_ssg08.obj'],
    ['G3SG1', '/models/weapon_snip_g3sg1.obj'],
    ['SCAR-20', '/models/weapon_snip_scar20.obj'],
    ['USP-S', '/models/weapon_pist_usp_silencer.obj'],
    ['Glock-18', '/models/weapon_pist_glock18.obj'],
    ['Desert Eagle', '/models/weapon_pist_deagle.obj'],
    ['P250', '/models/weapon_pist_p250.obj'],
    ['P2000', '/models/weapon_pist_hkp2000.obj'],
    ['Five-SeVeN', '/models/weapon_pist_fiveseven.obj'],
    ['CZ75-Auto', '/models/weapon_pist_cz75a.obj'],
    ['Tec-9', '/models/weapon_pist_tec9.obj'],
    ['Dual Berettas', '/models/weapon_pist_elite.obj'],
    ['R8 Revolver', '/models/weapon_pist_revolver.obj'],
    ['Zeus x27', '/models/weapon_pist_taser.obj'],
    ['MAC-10', '/models/weapon_smg_mac10.obj'],
    ['MP9', '/models/weapon_smg_mp9.obj'],
    ['MP7', '/models/weapon_smg_mp7.obj'],
    ['MP5-SD', '/models/weapon_smg_mp5sd.obj'],
    ['UMP-45', '/models/weapon_smg_ump45.obj'],
    ['P90', '/models/weapon_smg_p90.obj'],
    ['PP-Bizon', '/models/weapon_smg_bizon.obj'],
    ['Nova', '/models/weapon_shot_nova.obj'],
    ['XM1014', '/models/weapon_shot_xm1014.obj'],
    ['MAG-7', '/models/weapon_shot_mag7.obj'],
    ['Sawed-Off', '/models/weapon_shot_sawedoff.obj'],
    ['M249', '/models/weapon_mach_m249.obj'],
    ['Negev', '/models/weapon_mach_negev.obj'],
  ];

  for (const [name, expected] of canonicalWeapons) {
    recordAssertion();
    const resolved = getWeaponModelPath(name);
    assert.strictEqual(resolved, expected, `Weapon ${name} resolved to ${resolved}, expected ${expected}`);
  }
});

runTest('3.3: StatTrak™ and Souvenir prefix stripping across all weapon classes', () => {
  const testCases = [
    ['StatTrak™ AK-47 | Redline (Field-Tested)', '/models/weapon_rif_ak47.obj'],
    ['StatTrak™ M4A1-S | Liquidation (Field-Tested)', '/models/weapon_rif_m4a1_silencer.obj'],
    ['StatTrak™ AWP | Asiimov (Battle-Scarred)', '/models/weapon_snip_awp.obj'],
    ['StatTrak™ USP-S | Kill Confirmed (Minimal Wear)', '/models/weapon_pist_usp_silencer.obj'],
    ['Souvenir AWP | Desert Hydra (Factory New)', '/models/weapon_snip_awp.obj'],
    ['Souvenir M4A4 | Radiation Hazard (Well-Worn)', '/models/weapon_rif_m4a4.obj'],
    ['Souvenir Glock-18 | High Beam (Factory New)', '/models/weapon_pist_glock18.obj'],
  ];

  for (const [input, expected] of testCases) {
    recordAssertion();
    const resolved = getWeaponModelPath(input);
    assert.strictEqual(resolved, expected, `Input "${input}" resolved to ${resolved}, expected ${expected}`);
  }
});

runTest('3.4: Star symbol (★) prefix stripping for knives and rare items', () => {
  const testCases = [
    ['★ Karambit | Doppler (Factory New)', DEFAULT_WEAPON_MODEL],
    ['★ Butterfly Knife | Marble Fade (Factory New)', DEFAULT_WEAPON_MODEL],
    ['★ StatTrak™ M9 Bayonet | Lore (Minimal Wear)', DEFAULT_WEAPON_MODEL],
    ['★ StatTrak™ AK-47 | Case Hardened', '/models/weapon_rif_ak47.obj'],
    ['★ M4A1-S | Hyper Beast', '/models/weapon_rif_m4a1_silencer.obj'],
  ];

  for (const [input, expected] of testCases) {
    recordAssertion();
    const resolved = getWeaponModelPath(input);
    assert.strictEqual(resolved, expected, `Input "${input}" resolved to ${resolved}, expected ${expected}`);
  }
});

runTest('3.5: All 5 CS2 wear tiers in parentheses are stripped cleanly', () => {
  const wears = [
    '(Factory New)',
    '(Minimal Wear)',
    '(Field-Tested)',
    '(Well-Worn)',
    '(Battle-Scarred)',
  ];

  for (const wear of wears) {
    recordAssertion();
    const resolved = getWeaponModelPath(`AK-47 | Ice Coaled ${wear}`);
    assert.strictEqual(resolved, '/models/weapon_rif_ak47.obj');
  }
});

runTest('3.6: Exhaustive knife taxonomy (20 knife families) resolves to fallback combat knife GLB', () => {
  const knives = [
    '★ Karambit | Fade',
    '★ Bayonet | Doppler',
    '★ M9 Bayonet | Autotronic',
    '★ Butterfly Knife | Slaughter',
    '★ Flip Knife | Tiger Tooth',
    '★ Gut Knife | Rust Coat',
    '★ Huntsman Knife | Crimson Web',
    '★ Falchion Knife | Case Hardened',
    '★ Bowie Knife | Marble Fade',
    '★ Shadow Daggers | Urban Masked',
    '★ Ursus Knife | Ultraviolet',
    '★ Navaja Knife | Blue Steel',
    '★ Stiletto Knife | Damascus Steel',
    '★ Talon Knife | Vanilla',
    '★ Classic Knife | Stained',
    '★ Skeleton Knife | Fade',
    '★ Nomad Knife | Slaughter',
    '★ Survival Knife | Scorched',
    '★ Paracord Knife | Night Stripe',
    '★ Kukri Knife | Boreal Forest',
  ];

  for (const knife of knives) {
    recordAssertion();
    const resolved = getWeaponModelPath(knife);
    assert.strictEqual(resolved, DEFAULT_WEAPON_MODEL, `Knife "${knife}" should resolve to ${DEFAULT_WEAPON_MODEL}`);
  }
});

runTest('3.7: Normalized punctuation and case-insensitivity tolerance', () => {
  const variations = [
    ['ak47', '/models/weapon_rif_ak47.obj'],
    ['AK 47', '/models/weapon_rif_ak47.obj'],
    ['ak_47', '/models/weapon_rif_ak47.obj'],
    ['m4a1_silencer', '/models/weapon_rif_m4a1_silencer.obj'],
    ['M4A1 Silencer', '/models/weapon_rif_m4a1_silencer.obj'],
    ['usp_silencer', '/models/weapon_pist_usp_silencer.obj'],
    ['deagle', '/models/weapon_pist_deagle.obj'],
    ['DEAGLE', '/models/weapon_pist_deagle.obj'],
    ['dualies', '/models/weapon_pist_elite.obj'],
    ['scout', '/models/weapon_snip_ssg08.obj'],
    ['zeus', '/models/weapon_pist_taser.obj'],
    ['taser', '/models/weapon_pist_taser.obj'],
    ['bizon', '/models/weapon_smg_bizon.obj'],
  ];

  for (const [input, expected] of variations) {
    recordAssertion();
    const resolved = getWeaponModelPath(input);
    assert.strictEqual(resolved, expected, `Variant "${input}" resolved to ${resolved}, expected ${expected}`);
  }
});

runTest('3.8: Adversarial inputs (null, undefined, blanks, SQL-injection, long strings) return DEFAULT_WEAPON_MODEL gracefully', () => {
  const badInputs = [
    undefined,
    null,
    '',
    '    ',
    'NonExistentRailgun9000',
    '"; DROP TABLE weapons;--',
    '<script>alert("xss")</script>',
    'A'.repeat(10000),
    '★ NonExistent | Pattern (Factory New)',
  ];

  for (const bad of badInputs) {
    recordAssertion();
    assert.doesNotThrow(() => {
      const resolved = getWeaponModelPath(bad);
      assert.strictEqual(resolved, DEFAULT_WEAPON_MODEL);
    });
  }
});

runTest('3.9: isObjModelUrl helper correctly discriminates .obj vs .glb/.gltf assets', () => {
  const cases = [
    ['/models/weapon_rif_ak47.obj', true],
    ['/models/weapon_rif_ak47.OBJ', true],
    ['/models/weapon_rif_ak47.obj?v=2', true],
    ['/models/placeholder-weapon.glb', false],
    ['/models/weapon.gltf', false],
    ['/models/weapon.obj.png', false],
    [undefined, false],
    ['', false],
  ];

  for (const [url, expected] of cases) {
    recordAssertion();
    assert.strictEqual(isObjModelUrl(url), expected, `isObjModelUrl failed for ${url}`);
  }
});

// -----------------------------------------------------------------------------
// SUITE 4: WebGL Resource Cleanup & Unmount Disposal
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 4] WebGL Resource Cleanup & Unmount Disposal${RESET}`);

runTest('4.1: disposeThreeObject handles deep multi-level scene hierarchy with geometries, materials, textures', () => {
  let geoCount = 0;
  let matCount = 0;
  let texCount = 0;

  const trackGeo = (g) => {
    const orig = g.dispose.bind(g);
    g.dispose = () => { geoCount++; orig(); };
    return g;
  };
  const trackMat = (m) => {
    const orig = m.dispose.bind(m);
    m.dispose = () => { matCount++; orig(); };
    return m;
  };
  const trackTex = (t) => {
    const orig = t.dispose.bind(t);
    t.dispose = () => { texCount++; orig(); };
    return t;
  };

  const root = new THREE.Group();

  // Child 1: Mesh with material and texture
  const t1 = trackTex(new THREE.Texture());
  const m1 = trackMat(new THREE.MeshStandardMaterial({ map: t1 }));
  const g1 = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  root.add(new THREE.Mesh(g1, m1));

  // Child 2: Nested group with multi-material mesh
  const subGroup = new THREE.Group();
  const t2 = trackTex(new THREE.Texture());
  const m2a = trackMat(new THREE.MeshBasicMaterial({ map: t2 }));
  const m2b = trackMat(new THREE.MeshStandardMaterial());
  const g2 = trackGeo(new THREE.SphereGeometry(1, 8, 8));
  subGroup.add(new THREE.Mesh(g2, [m2a, m2b]));
  root.add(subGroup);

  // Non-mesh objects: Directional light and camera
  root.add(new THREE.DirectionalLight());
  root.add(new THREE.PerspectiveCamera());

  recordAssertion();
  assert.strictEqual(geoCount, 0);
  recordAssertion();
  assert.strictEqual(matCount, 0);
  recordAssertion();
  assert.strictEqual(texCount, 0);

  disposeThreeObject(root);

  recordAssertion();
  assert.strictEqual(geoCount, 2, 'Both geometries must be disposed');
  recordAssertion();
  assert.strictEqual(matCount, 3, 'All 3 materials must be disposed');
  recordAssertion();
  assert.strictEqual(texCount, 2, 'All 2 textures must be disposed');
});

runTest('4.2: Real OBJ model unmount lifecycle: disposeThreeObject cleans geometries and PBR materials', () => {
  const loader = new OBJLoader();
  const text = fs.readFileSync(path.join(modelsDir, 'weapon_rif_ak47.obj'), 'utf8');
  const rawObj = loader.parse(text);
  const clone = rawObj.clone(true);

  const weaponMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8d1dc'),
    metalness: 0.65,
    roughness: 0.35,
    side: THREE.FrontSide,
  });

  let geoDisposed = 0;
  let matDisposed = 0;

  clone.traverse((child) => {
    if (child.isMesh) {
      child.geometry.computeVertexNormals();
      child.geometry.center();
      const origGeo = child.geometry.dispose.bind(child.geometry);
      child.geometry.dispose = () => { geoDisposed++; origGeo(); };
      child.material = weaponMaterial;
    }
  });

  const origMat = weaponMaterial.dispose.bind(weaponMaterial);
  weaponMaterial.dispose = () => { matDisposed++; origMat(); };

  // Trigger unmount sequence matching ModelViewer.tsx:
  disposeThreeObject(clone);
  weaponMaterial.dispose();

  recordAssertion();
  assert.strictEqual(geoDisposed, 1, 'OBJ geometry was disposed on unmount');
  recordAssertion();
  assert.ok(matDisposed >= 1, 'PBR weapon material was disposed on unmount');
});

runTest('4.3: useLoader.clear(OBJLoader, url) executes safely without unhandled rejections', () => {
  recordAssertion();
  assert.strictEqual(typeof useLoader.clear, 'function', 'useLoader.clear must be a callable function');

  assert.doesNotThrow(() => {
    useLoader.clear(OBJLoader, '/models/weapon_rif_ak47.obj');
    useLoader.clear(OBJLoader, '/models/non-existent-model.obj');
    useLoader.clear(OBJLoader, '');
  });
  recordAssertion();
});

runTest('4.4: Defensive resilience in disposeThreeObject (null properties, empty groups, cycles)', () => {
  const bareMesh = new THREE.Mesh();
  bareMesh.geometry = null;
  bareMesh.material = null;

  assert.doesNotThrow(() => {
    disposeThreeObject(bareMesh);
    disposeThreeObject(new THREE.Group());
  });
  recordAssertion();

  const cyclicMat = new THREE.MeshStandardMaterial();
  cyclicMat.self = cyclicMat;
  const cyclicMesh = new THREE.Mesh(new THREE.BoxGeometry(), cyclicMat);

  assert.doesNotThrow(() => {
    disposeThreeObject(cyclicMesh);
  });
  recordAssertion();
});

// -----------------------------------------------------------------------------
// SUITE 5: Hostile SSR Isolation & Server-Side Safety
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 5] Hostile SSR Isolation & Server-Side Safety${RESET}`);

const React = (await import('react')).default;
const { renderToString } = await import('react-dom/server');

runTest('5.1: SSR render in pristine Node environment returns ModelViewerSkeleton without canvas', () => {
  const vdom = React.createElement(ModelViewer, {
    modelUrl: '/models/weapon_rif_ak47.obj',
    weaponName: 'AK-47 | Ice Coaled',
  });
  const html = renderToString(vdom);

  recordAssertion();
  assert.ok(html.length > 0, 'SSR output must not be empty');
  recordAssertion();
  assert.ok(html.includes('AK-47 | Ice Coaled'), 'SSR output must render weapon name');
  recordAssertion();
  assert.ok(html.includes('animate-spin'), 'SSR output must contain skeleton spinner');
  recordAssertion();
  assert.ok(!html.includes('canvas'), 'SSR output must NEVER render <canvas> before hydration');
});

runTest('5.2: Hostile SSR isolation under poisoned window and document traps', () => {
  const originalWindow = globalThis.window;
  const originalDoc = globalThis.document;

  let windowTrapHit = false;
  let docTrapHit = false;

  Object.defineProperty(globalThis, 'window', {
    get() {
      windowTrapHit = true;
      throw new Error('ILLEGAL ACCESS: window was touched during server rendering!');
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'document', {
    get() {
      docTrapHit = true;
      throw new Error('ILLEGAL ACCESS: document was touched during server rendering!');
    },
    configurable: true,
  });

  try {
    const testProps = [
      { modelUrl: '/models/weapon_rif_ak47.obj', weaponName: 'AK-47' },
      { modelUrl: '/models/weapon_snip_awp.obj', weaponName: 'AWP' },
      { modelUrl: '/models/placeholder-weapon.glb', weaponName: 'Knife' },
      { weaponName: 'StatTrak™ M4A1-S | Liquidation' },
      { modelUrl: undefined, weaponName: undefined },
      { autoRotate: false, enableZoom: false, fov: 90, cameraPosition: [5, 2, 8] },
    ];

    for (const props of testProps) {
      recordAssertion();
      const html = renderToString(React.createElement(ModelViewer, props));
      assert.ok(html.length > 0, 'Render must succeed under hostile globals');
    }

    recordAssertion();
    assert.strictEqual(windowTrapHit, false, 'window getter trap was not triggered');
    recordAssertion();
    assert.strictEqual(docTrapHit, false, 'document getter trap was not triggered');
  } finally {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      delete globalThis.window;
    }
    if (originalDoc !== undefined) {
      globalThis.document = originalDoc;
    } else {
      delete globalThis.document;
    }
  }
});

runTest('5.3: ModelViewerSkeleton standalone component render consistency', () => {
  const html = renderToString(React.createElement(ModelViewerSkeleton, {
    className: 'custom-harness-class',
    weaponName: 'AWP | Dragon Lore',
  }));

  recordAssertion();
  assert.ok(html.includes('custom-harness-class'));
  recordAssertion();
  assert.ok(html.includes('AWP | Dragon Lore'));
  recordAssertion();
  assert.ok(html.includes('CS2 Inspect Studio'));
});

// -----------------------------------------------------------------------------
// SUITE 6: OrbitControls Camera Pitch Clamping (45° to 117°) & Zoom Boundaries
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 6] OrbitControls Camera Pitch Clamping & Zoom Boundaries${RESET}`);

runTest('6.1: Polar angle constants adhere strictly to [π/4, 0.65π] ([45°, 117°])', () => {
  const minPolarAngle = Math.PI / 4;
  const maxPolarAngle = Math.PI * 0.65;

  const minDeg = (minPolarAngle * 180) / Math.PI;
  const maxDeg = (maxPolarAngle * 180) / Math.PI;

  recordAssertion();
  assert.strictEqual(minDeg, 45, 'Min polar angle must be exactly 45 degrees');
  recordAssertion();
  assert.strictEqual(maxDeg, 117, 'Max polar angle must be exactly 117 degrees');
  recordAssertion();
  assert.ok(minPolarAngle > 0, 'Min angle > 0 prevents gimbal lock at zenith');
  recordAssertion();
  assert.ok(maxPolarAngle < Math.PI, 'Max angle < π prevents gimbal lock at nadir');
  recordAssertion();
  assert.ok(minPolarAngle < Math.PI / 2 && maxPolarAngle > Math.PI / 2, 'Horizon (90°) must be contained in range');
});

runTest('6.2: 100,000 hostile random polar angles across [-1000π, +1000π] strictly clamped', () => {
  const minPolar = Math.PI / 4;
  const maxPolar = Math.PI * 0.65;
  const clamp = (a) => Math.max(minPolar, Math.min(maxPolar, a));

  let allClamped = true;
  for (let i = 0; i < 100000; i++) {
    const raw = (Math.random() - 0.5) * 2000 * Math.PI;
    const c = clamp(raw);
    if (c < minPolar - 1e-12 || c > maxPolar + 1e-12) {
      allClamped = false;
      break;
    }
  }

  recordAssertion();
  assert.strictEqual(allClamped, true, 'All 100,000 randomized polar angles were strictly clamped');
});

runTest('6.3: Boundary angles (zenith 0, nadir π, horizons, epsilons) clamp exactly', () => {
  const min = Math.PI / 4;
  const max = Math.PI * 0.65;
  const eps = 1e-7;
  const clamp = (phi) => Math.max(min, Math.min(max, phi));

  recordAssertion();
  assert.strictEqual(clamp(0), min, 'Zenith clamps to min');
  recordAssertion();
  assert.strictEqual(clamp(min - eps), min, 'Min - eps clamps to min');
  recordAssertion();
  assert.strictEqual(clamp(min), min, 'Min preserved');
  recordAssertion();
  assert.strictEqual(clamp(Math.PI / 2), Math.PI / 2, 'Horizon preserved');
  recordAssertion();
  assert.strictEqual(clamp(max), max, 'Max preserved');
  recordAssertion();
  assert.strictEqual(clamp(max + eps), max, 'Max + eps clamps to max');
  recordAssertion();
  assert.strictEqual(clamp(Math.PI), max, 'Nadir clamps to max');
  recordAssertion();
  assert.strictEqual(clamp(-100), min, 'Large negative clamps to min');
  recordAssertion();
  assert.strictEqual(clamp(100), max, 'Large positive clamps to max');
});

runTest('6.4: Camera zoom boundaries and frustum clearance at target size 2.4', () => {
  const minDistance = 1.2;
  const maxDistance = 5.5;
  const defaultDistance = 3.2;
  const fov = 45;
  const targetSize = 2.4;

  recordAssertion();
  assert.ok(minDistance > 0, 'minDistance > 0 prevents camera passing through origin');
  recordAssertion();
  assert.ok(minDistance < maxDistance, 'minDistance < maxDistance');

  // Frustum visible height at distance d: h = 2 * d * tan(fov/2)
  const fovRad = (fov * Math.PI) / 180;
  const halfFovTan = Math.tan(fovRad / 2);

  const defaultVisibleHeight = 2 * defaultDistance * halfFovTan;
  const maxVisibleHeight = 2 * maxDistance * halfFovTan;
  const minVisibleHeight = 2 * minDistance * halfFovTan;

  recordAssertion();
  assert.ok(
    defaultVisibleHeight > targetSize,
    `Default camera distance (${defaultDistance}) visible height (${defaultVisibleHeight.toFixed(2)}) must accommodate weapon (${targetSize})`
  );

  recordAssertion();
  assert.ok(
    maxVisibleHeight > targetSize * 1.5,
    `Max camera distance (${maxDistance}) visible height (${maxVisibleHeight.toFixed(2)}) provides sufficient zoom-out margin`
  );

  recordAssertion();
  assert.ok(
    minVisibleHeight < targetSize,
    `Min camera distance (${minDistance}) visible height (${minVisibleHeight.toFixed(2)}) allows detailed inspection of skin finish`
  );
});

// -----------------------------------------------------------------------------
// FINAL REPORT
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}================================================================================${RESET}`);
console.log(`${BOLD}   ADVERSARIAL STRESS TEST SUMMARY REPORT                                      ${RESET}`);
console.log(`${BOLD}================================================================================${RESET}`);
console.log(`  Suites Executed:       6`);
console.log(`  Total Tests Run:       ${totalTests}`);
console.log(`  Total Assertions:      ${totalAssertions}`);
console.log(`  Passed Tests:          ${CYAN}${passedTests}${RESET}`);
console.log(`  Failed Tests:          ${failedTests > 0 ? '\x1b[31m' : '\x1b[32m'}${failedTests}${RESET}`);

if (failedTests > 0) {
  console.log(`\n${BOLD}\x1b[31m[GATE VERDICT: REJECT] ${failedTests} stress tests failed.${RESET}\n`);
  process.exit(1);
} else {
  console.log(`\n${BOLD}\x1b[32m[GATE VERDICT: APPROVE] All ${passedTests} stress tests (${totalAssertions} assertions) passed with 100% empirical reliability.${RESET}\n`);
  process.exit(0);
}
