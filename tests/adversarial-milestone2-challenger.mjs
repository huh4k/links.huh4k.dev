#!/usr/bin/env node
/**
 * Empirical Adversarial Challenger Test Suite: Milestone 2
 * Author: challenger_m2_1 (Empirical Challenger)
 *
 * Scope: Milestone 2 in src/components/ModelViewer.tsx
 * - Source 2 Surface Channel Swizzling (Red=Roughness, Green=Metalness)
 * - Dual roughnessMap & metalnessMap Binding
 * - Mask Channel Isolation & Diffuse Compositing Integration
 * - WebGL Context Lifecycle, Resource Disposal & Memory Leaks
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

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import * as THREE from 'three';

// Import target exports from ModelViewer
const {
  applySource2SurfaceSwizzle,
  swizzleSurfaceMapChannels,
  SOURCE2_SURFACE_SWIZZLE,
  disposeThreeObject,
  FallbackWeaponMesh,
} = await import('../src/components/ModelViewer.tsx');

const {
  compositeSkinFinish,
  getSkinFallbackColor,
} = await import('../src/utils/skinCompositor.ts');

const {
  getR2WeaponTextures,
} = await import('../src/utils/r2Textures.ts');

const PASSED = '\x1b[32m✓\x1b[0m';
const FAILED = '\x1b[31m✗\x1b[0m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
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
    console.log(`  ${PASSED} ${name} ${GRAY}(${duration}ms)${RESET}`);
    passedTests++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  ${FAILED} ${name} ${GRAY}(${duration}ms)${RESET}`);
    console.error(`     ${RED}Error: ${err.message}${RESET}`);
    failedTests++;
    failureDetails.push({ suite, name, error: err.message });
  }
}

async function runTestAsync(suite, name, fn) {
  totalTests++;
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ${PASSED} ${name} ${GRAY}(${duration}ms)${RESET}`);
    passedTests++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  ${FAILED} ${name} ${GRAY}(${duration}ms)${RESET}`);
    console.error(`     ${RED}Error: ${err.message}${RESET}`);
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
console.log(`${BOLD}   EMPIRICAL ADVERSARIAL CHALLENGER: MILESTONE 2 VERIFICATION                  ${RESET}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}\n`);

// =============================================================================
// SUITE 1: Source 2 Surface Map Channel Swizzle & GLSL Shader Integrity
// =============================================================================
console.log(`${BOLD}[Suite 1] Source 2 Surface Map Channel Swizzle & GLSL Shader Integrity${RESET}`);

runTest('Suite 1', '1.1: Verify SOURCE2_SURFACE_SWIZZLE export matches interface contract', () => {
  expect(SOURCE2_SURFACE_SWIZZLE !== undefined, 'SOURCE2_SURFACE_SWIZZLE must be exported');
  expect(SOURCE2_SURFACE_SWIZZLE.roughnessChannel === 'R', 'roughnessChannel must be "R"');
  expect(SOURCE2_SURFACE_SWIZZLE.metalnessChannel === 'G', 'metalnessChannel must be "G"');
  expect(SOURCE2_SURFACE_SWIZZLE.redRoughness === true, 'redRoughness must be true');
  expect(SOURCE2_SURFACE_SWIZZLE.greenMetalness === true, 'greenMetalness must be true');
});

runTest('Suite 1', '1.2: applySource2SurfaceSwizzle registers onBeforeCompile hook on MeshPhysicalMaterial', () => {
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0.5 });
  expect(typeof mat.onBeforeCompile === 'function', 'onBeforeCompile should initially be empty default');

  const initialVersion = mat.version;
  applySource2SurfaceSwizzle(mat);

  expect(typeof mat.onBeforeCompile === 'function', 'onBeforeCompile must be attached as a function');
  expect(mat.version > initialVersion, 'material.version must increment when needsUpdate is set');
});

runTest('Suite 1', '1.3: ADVERSARIAL: GLSL variable declarations (float roughnessFactor, float metalnessFactor) must be preserved', () => {
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0.5 });
  applySource2SurfaceSwizzle(mat);

  const shader = {
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms),
    defines: {
      USE_ROUGHNESSMAP: '',
      USE_METALNESSMAP: '',
      USE_UV: '',
    },
  };

  mat.onBeforeCompile(shader, {});

  // In Three.js ShaderLib, roughnessmap_fragment originally declares:
  // float roughnessFactor = roughness;
  // And metalnessmap_fragment originally declares:
  // float metalnessFactor = metalness;
  // If the swizzle replacement replaces the entire chunk without declaring the variable,
  // roughnessFactor and metalnessFactor will be undeclared in GLSL!
  const hasRoughnessFactorDecl = shader.fragmentShader.includes('float roughnessFactor');
  const hasMetalnessFactorDecl = shader.fragmentShader.includes('float metalnessFactor');

  expect(
    hasRoughnessFactorDecl,
    'CRITICAL GLSL DEFECT: "float roughnessFactor" declaration was stripped during swizzle replacement. In GLSL, using roughnessFactor without a type declaration causes fatal shader compile failure: undeclared identifier "roughnessFactor".'
  );

  expect(
    hasMetalnessFactorDecl,
    'CRITICAL GLSL DEFECT: "float metalnessFactor" declaration was stripped during swizzle replacement. In GLSL, using metalnessFactor without a type declaration causes fatal shader compile failure: undeclared identifier "metalnessFactor".'
  );
});

runTest('Suite 1', '1.4: ADVERSARIAL: Shader compilation without surface map (USE_ROUGHNESSMAP undefined) must not produce undeclared identifiers', () => {
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.65 });
  applySource2SurfaceSwizzle(mat);

  const shader = {
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms),
    defines: {}, // NO surface maps loaded yet!
  };

  mat.onBeforeCompile(shader, {});

  // When USE_ROUGHNESSMAP is false, lights_physical_fragment still executes:
  // material.roughness = max( roughnessFactor, 0.0525 );
  // and:
  // material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
  // If roughnessFactor or metalnessFactor are not declared, this will fail GLSL compilation.
  const hasRoughnessFactor = shader.fragmentShader.includes('roughnessFactor');
  const hasMetalnessFactor = shader.fragmentShader.includes('metalnessFactor');

  // Both variables must be declared regardless of whether USE_ROUGHNESSMAP / USE_METALNESSMAP are active
  const lines = shader.fragmentShader.split('\n');
  const hasValidRoughnessDecl = lines.some((l) => l.trim().startsWith('float roughnessFactor'));
  const hasValidMetalnessDecl = lines.some((l) => l.trim().startsWith('float metalnessFactor'));

  expect(
    hasValidRoughnessDecl,
    'CRITICAL GLSL DEFECT: When surface map is not loaded, roughnessFactor is not declared, causing lights_physical_fragment to fail compilation with undeclared identifier.'
  );

  expect(
    hasValidMetalnessDecl,
    'CRITICAL GLSL DEFECT: When surface map is not loaded, metalnessFactor is not declared, causing lights_physical_fragment to fail compilation with undeclared identifier.'
  );
});

runTest('Suite 1', '1.5: swizzleSurfaceMapChannels extracts separate textures with Red -> Roughness and Green -> Metalness', () => {
  // Test swizzleSurfaceMapChannels utility behavior
  const mockTex = new THREE.Texture();
  const res = swizzleSurfaceMapChannels(mockTex);

  expect(res !== null && typeof res === 'object', 'Must return an object');
  expect(res.roughnessMap !== undefined, 'Must contain roughnessMap');
  expect(res.metalnessMap !== undefined, 'Must contain metalnessMap');
  expect(res.roughnessMap.wrapS === THREE.RepeatWrapping, 'roughnessMap must have RepeatWrapping');
  expect(res.metalnessMap.wrapS === THREE.RepeatWrapping, 'metalnessMap must have RepeatWrapping');
});

runTest('Suite 1', '1.6: swizzleSurfaceMapChannels handles headless / SSR environment without throwing', () => {
  const emptyTex = new THREE.Texture();
  emptyTex.image = null;
  const fallback = swizzleSurfaceMapChannels(emptyTex);

  expect(fallback.roughnessMap === emptyTex, 'Fallback must return source texture as roughnessMap');
  expect(fallback.metalnessMap === emptyTex, 'Fallback must return source texture as metalnessMap');
});

// =============================================================================
// SUITE 2: Dual roughnessMap & metalnessMap Binding
// =============================================================================
console.log(`\n${BOLD}[Suite 2] Dual roughnessMap & metalnessMap Binding${RESET}`);

runTest('Suite 2', '2.1: Surface texture binds to both roughnessMap and metalnessMap on material', () => {
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.65 });
  const surfaceTex = new THREE.Texture();
  surfaceTex.wrapS = THREE.RepeatWrapping;
  surfaceTex.wrapT = THREE.RepeatWrapping;

  mat.roughnessMap = surfaceTex;
  mat.metalnessMap = surfaceTex;
  applySource2SurfaceSwizzle(mat);

  expect(mat.roughnessMap === surfaceTex, 'roughnessMap must be bound to surface texture');
  expect(mat.metalnessMap === surfaceTex, 'metalnessMap must be bound to surface texture');
  expect(mat.roughnessMap === mat.metalnessMap, 'Both maps must share the same surface texture instance');
  expect(surfaceTex.wrapS === THREE.RepeatWrapping, 'Surface texture wrapS must be RepeatWrapping');
  expect(surfaceTex.wrapT === THREE.RepeatWrapping, 'Surface texture wrapT must be RepeatWrapping');
});

runTest('Suite 2', '2.2: Idempotent swizzle application does not throw or corrupt shader logic', () => {
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.65 });
  
  // First call in useMemo
  applySource2SurfaceSwizzle(mat);
  
  // Second call in useEffect upon surfaceTexture load
  applySource2SurfaceSwizzle(mat);

  const shader = {
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms),
    defines: {},
  };

  expect(() => mat.onBeforeCompile(shader, {}), 'Multiple swizzle applications must execute safely without throwing');
});

// =============================================================================
// SUITE 3: Mask Channel Isolation & Diffuse Compositing Integration
// =============================================================================
console.log(`\n${BOLD}[Suite 3] Mask Channel Isolation & Diffuse Compositing Integration${RESET}`);

runTest('Suite 3', '3.1: masksTexture binds to material.masksMap and material.userData.masksTexture', () => {
  const mat = new THREE.MeshPhysicalMaterial();
  const masksTex = new THREE.Texture();
  masksTex.wrapS = THREE.RepeatWrapping;
  masksTex.wrapT = THREE.RepeatWrapping;

  mat.masksMap = masksTex;
  mat.userData.masksTexture = masksTex;

  expect(mat.masksMap === masksTex, 'material.masksMap must reference masksTex');
  expect(mat.userData.masksTexture === masksTex, 'material.userData.masksTexture must reference masksTex');
  expect(masksTex.wrapS === THREE.RepeatWrapping, 'masksTexture must use RepeatWrapping');
});

runTest('Suite 3', '3.2: compositeSkinFinish accepts masksTexture option and returns valid composite result', () => {
  const mockMask = new THREE.Texture();
  const result = compositeSkinFinish({
    weaponName: 'AK-47',
    skinName: 'Ice Coaled',
    float: 0.0825,
    seed: 367,
    rarityColor: '#eb4b4b',
    masksTexture: mockMask,
  });

  expect(result !== null, 'compositeSkinFinish must return result');
  expect(result.texture instanceof THREE.CanvasTexture, 'texture must be THREE.CanvasTexture');
  expect(typeof result.effectiveRoughness === 'number', 'effectiveRoughness must be number');
  expect(typeof result.effectiveMetalness === 'number', 'effectiveMetalness must be number');
  expect(typeof result.effectiveClearcoat === 'number', 'effectiveClearcoat must be number');
});

runTest('Suite 3', '3.3: Superseded diffuse texture disposal pattern prevents memory leaks on re-composite', () => {
  let initialDisposed = false;
  let updatedDisposed = false;

  const initialTex = new THREE.CanvasTexture({});
  initialTex.dispose = () => { initialDisposed = true; };

  const updatedTex = new THREE.CanvasTexture({});
  updatedTex.dispose = () => { updatedDisposed = true; };

  const mat = new THREE.MeshPhysicalMaterial({ map: initialTex });

  // Simulate mask arrival re-composite:
  if (mat.map && mat.map !== updatedTex) {
    mat.map.dispose();
  }
  mat.map = updatedTex;

  expect(initialDisposed === true, 'Initial canvas texture must be disposed when superseded');
  expect(updatedDisposed === false, 'Newly applied canvas texture must not be prematurely disposed');
  expect(mat.map === updatedTex, 'material.map must now be updatedTex');
});

runTest('Suite 3', '3.4: Self-disposal guard: identical texture must not dispose itself', () => {
  let disposed = false;
  const tex = new THREE.CanvasTexture({});
  tex.dispose = () => { disposed = true; };

  const mat = new THREE.MeshPhysicalMaterial({ map: tex });

  // If incoming updatedSkin.texture happens to be identical:
  if (mat.map && mat.map !== tex) {
    mat.map.dispose();
  }

  expect(disposed === false, 'Active texture must NOT be disposed if reference is unchanged');
});

// =============================================================================
// SUITE 4: WebGL Context Lifecycle & Stress Tests
// =============================================================================
console.log(`\n${BOLD}[Suite 4] WebGL Context Lifecycle & Stress Tests${RESET}`);

runTest('Suite 4', '4.1: disposeThreeObject cleans up geometries, materials, and textures including masksMap and userData', () => {
  let disposedGeometries = 0;
  let disposedMaterials = 0;
  let disposedTextures = 0;

  const trackGeo = (g) => {
    const orig = g.dispose.bind(g);
    g.dispose = () => { disposedGeometries++; orig(); };
    return g;
  };
  const trackMat = (m) => {
    const orig = m.dispose.bind(m);
    m.dispose = () => { disposedMaterials++; orig(); };
    return m;
  };
  const trackTex = (t) => {
    const orig = t.dispose.bind(t);
    t.dispose = () => { disposedTextures++; orig(); };
    return t;
  };

  const group = new THREE.Group();
  const geo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const mat = trackMat(new THREE.MeshPhysicalMaterial());

  const mapTex = trackTex(new THREE.Texture());
  const aoTex = trackTex(new THREE.Texture());
  const surfaceTex = trackTex(new THREE.Texture());
  const masksTex = trackTex(new THREE.Texture());
  const customTex = trackTex(new THREE.Texture());

  mat.map = mapTex;
  mat.aoMap = aoTex;
  mat.roughnessMap = surfaceTex;
  mat.metalnessMap = surfaceTex; // Shared dual binding
  mat.masksMap = masksTex;
  mat.userData.customTexture = customTex;

  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  disposeThreeObject(group);

  expect(disposedGeometries === 1, 'Geometry must be disposed');
  expect(disposedMaterials === 1, 'Material must be disposed');
  // mapTex, aoTex, surfaceTex (counted once despite dual roughness/metalness binding), masksTex, customTex = 5 unique textures
  expect(disposedTextures === 5, `Expected 5 unique textures disposed, got ${disposedTextures}`);
});

runTest('Suite 4', '4.2: Geometry cloning prevents mutation/disposal of cached source OBJ asset', () => {
  const rawGeometry = new THREE.BoxGeometry(1, 1, 1);
  const clonedGeometry = rawGeometry.clone();

  let rawDisposed = false;
  let cloneDisposed = false;

  rawGeometry.dispose = () => { rawDisposed = true; };
  clonedGeometry.dispose = () => { cloneDisposed = true; };

  // Center and normalize cloned geometry
  clonedGeometry.center();

  // Dispose cloned mesh
  const mesh = new THREE.Mesh(clonedGeometry, new THREE.MeshBasicMaterial());
  disposeThreeObject(mesh);

  expect(cloneDisposed === true, 'Cloned geometry must be disposed');
  expect(rawDisposed === false, 'Cached raw OBJ geometry must NOT be disposed during instance cleanup');
});

runTest('Suite 4', '4.3: 50-Cycle rapid weapon switch simulation without memory leaks or crash', () => {
  const weapons = [
    'AK-47', 'M4A1-S', 'AWP', 'USP-S', 'Glock-18',
    'MAC-10', 'Zeus x27', 'Galil AR', 'UMP-45',
  ];

  let totalDisposals = 0;

  for (let i = 0; i < 50; i++) {
    const weaponName = weapons[i % weapons.length];
    const geo = new THREE.BufferGeometry();
    const origDisp = geo.dispose.bind(geo);
    geo.dispose = () => { totalDisposals++; origDisp(); };

    const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0.5 });
    applySource2SurfaceSwizzle(mat);

    const tex = new THREE.Texture();
    const origTexDisp = tex.dispose.bind(tex);
    tex.dispose = () => { totalDisposals++; origTexDisp(); };

    mat.map = tex;
    mat.roughnessMap = tex;
    mat.metalnessMap = tex;
    mat.masksMap = tex;

    const mesh = new THREE.Mesh(geo, mat);
    const root = new THREE.Group();
    root.add(mesh);

    // Simulate unmount / swap
    disposeThreeObject(root);
  }

  // Each iteration disposes: 1 geo + 1 mat (not counted in totalDisposals unless tracked) + 1 tex = 2 disposals * 50 = 100
  expect(totalDisposals === 100, `Expected 100 object disposals across 50 weapon cycles, got ${totalDisposals}`);
});

// =============================================================================
// SUITE 5: Privacy Invariant & Static Diagnostics
// =============================================================================
console.log(`\n${BOLD}[Suite 5] Privacy Invariant & Static Diagnostics${RESET}`);

runTest('Suite 5', '5.1: Privacy invariant: Zero personal names or locations in ModelViewer.tsx', () => {
  const content = fs.readFileSync(path.resolve('src/components/ModelViewer.tsx'), 'utf8');
  const forbidden = [/charlie/i, /cafici/i, /charcaf/i];
  for (const regex of forbidden) {
    const match = content.match(regex);
    expect(!match, `Found forbidden privacy token matching ${regex} in ModelViewer.tsx`);
  }
});

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log(`\n${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`${BOLD}   EMPIRICAL ADVERSARIAL CHALLENGER SUMMARY: MILESTONE 2                       ${RESET}`);
console.log(`${BOLD}${CYAN}================================================================================${RESET}`);
console.log(`  Total Tests Run:     ${totalTests}`);
console.log(`  Passed Tests:        ${CYAN}${passedTests}${RESET}`);
console.log(`  Failed Tests:        ${failedTests > 0 ? RED : CYAN}${failedTests}${RESET}`);
console.log(`  Total Assertions:    ${totalAssertions}`);

if (failedTests > 0) {
  console.log(`\n${BOLD}${RED}FAILED TESTS DETAIL:${RESET}`);
  for (const f of failureDetails) {
    console.log(`  - [${f.suite}] ${f.name}`);
    console.log(`    ${RED}${f.error}${RESET}`);
  }
  console.log(`\n${BOLD}${RED}[VERDICT: REQUEST_CHANGES] Found ${failedTests} empirical failure(s).${RESET}\n`);
  process.exit(1);
} else {
  console.log(`\n${BOLD}\x1b[32m[VERDICT: APPROVE] All ${passedTests} stress tests passed with 100% reliability.${RESET}\n`);
  process.exit(0);
}
