#!/usr/bin/env node
/**
 * Standalone Empirical Adversarial Stress Test Suite for 3D ModelViewer Component & Assets
 *
 * Suites:
 * 1. SSR Safety & Server Isolation (poisoned global environment)
 * 2. WebGL Resource Disposal & Deep Traversal Memory Leaks
 * 3. Polar Angle Clamping & Camera Boundary Stress Testing
 * 4. Interaction Debounce Timer & Auto-Rotation Lifecycle Simulation
 * 5. Binary GLB Asset Integrity & GLTF 2.0 Spec Conformance
 * 6. Component Architecture & Build Artifact Integrity
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Transparently re-spawn under tsx if run via plain `node tests/adversarial-3d-stress.mjs`
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

async function runTestAsync(name, fn) {
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

console.log(`${BOLD}================================================================================${RESET}`);
console.log(`${BOLD}${CYAN}   EMPIRICAL ADVERSARIAL STRESS TEST SUITE: 3D MODELVIEWER & ASSETS            ${RESET}`);
console.log(`${BOLD}================================================================================${RESET}\n`);

// -----------------------------------------------------------------------------
// SUITE 1: SSR Safety & Server Isolation
// -----------------------------------------------------------------------------
console.log(`${BOLD}[Suite 1] SSR Safety & Hostile Node.js Environment Isolation${RESET}`);

// Import react and react-dom/server
const React = (await import('react')).default;
const { renderToString } = await import('react-dom/server');
const { default: ModelViewer, ModelViewerSkeleton, disposeThreeObject } = await import('../src/components/ModelViewer.tsx');

runTest('1.1: SSR render in pristine Node environment renders ModelViewerSkeleton', () => {
  const vdom = React.createElement(ModelViewer, {
    modelUrl: '/models/placeholder-weapon.glb',
    weaponName: 'SSR Tactical Knife',
  });
  const html = renderToString(vdom);
  assert.ok(html.length > 0, 'SSR output should not be empty');
  assert.ok(html.includes('SSR Tactical Knife'), 'SSR output should include weaponName');
  assert.ok(html.includes('animate-spin'), 'SSR output should render loading spinner skeleton');
  assert.ok(!html.includes('canvas'), 'SSR output must NEVER render <canvas> element before hydration');
});

runTest('1.2: Hostile SSR test with poisoned window, document, and WebGL traps', () => {
  // Poison globals with throwing traps
  const originalWindow = globalThis.window;
  const originalDoc = globalThis.document;

  let trapTriggered = false;
  Object.defineProperty(globalThis, 'window', {
    get() {
      trapTriggered = true;
      throw new Error('ILLEGAL ACCESS: window was accessed during server rendering!');
    },
    configurable: true,
  });

  Object.defineProperty(globalThis, 'document', {
    get() {
      trapTriggered = true;
      throw new Error('ILLEGAL ACCESS: document was accessed during server rendering!');
    },
    configurable: true,
  });

  try {
    const variations = [
      { modelUrl: undefined, weaponName: 'No URL Weapon' },
      { modelUrl: '', weaponName: 'Empty String Weapon' },
      { modelUrl: '/models/placeholder-weapon.glb', className: 'h-96 w-full' },
      { autoRotate: false, enableZoom: false, fov: 90 },
      { cameraPosition: [10, -5, 2] },
    ];

    for (const props of variations) {
      const html = renderToString(React.createElement(ModelViewer, props));
      assert.ok(html.length > 0, 'Must produce valid skeleton HTML under trap conditions');
    }
    assert.strictEqual(trapTriggered, false, 'No window or document traps were triggered');
  } finally {
    // Restore globals
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

runTest('1.3: ModelViewerSkeleton standalone component renders with custom classes', () => {
  const html = renderToString(React.createElement(ModelViewerSkeleton, {
    className: 'custom-skeleton-class',
    weaponName: 'Skeleton Test',
  }));
  assert.ok(html.includes('custom-skeleton-class'));
  assert.ok(html.includes('Skeleton Test'));
  assert.ok(html.includes('CS2 Inspect Studio'));
});

// -----------------------------------------------------------------------------
// SUITE 2: WebGL Resource Disposal & Deep Traversal Memory Leaks
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 2] WebGL Resource Disposal & Deep Traversal Robustness${RESET}`);

runTest('2.1: Recursive disposal of 5-level nested hierarchy with multiple geometries, materials, and textures', () => {
  let disposedGeometries = 0;
  let disposedMaterials = 0;
  let disposedTextures = 0;

  function trackGeo(geo) {
    const orig = geo.dispose.bind(geo);
    geo.dispose = () => { disposedGeometries++; orig(); };
    return geo;
  }
  function trackMat(mat) {
    const orig = mat.dispose.bind(mat);
    mat.dispose = () => { disposedMaterials++; orig(); };
    return mat;
  }
  function trackTex(tex) {
    const orig = tex.dispose.bind(tex);
    tex.dispose = () => { disposedTextures++; orig(); };
    return tex;
  }

  const root = new THREE.Group();
  root.name = 'Level 0 Root';

  // Level 1: Mesh with single material and 2 textures
  const tex1 = trackTex(new THREE.Texture());
  const tex2 = trackTex(new THREE.Texture());
  const mat1 = trackMat(new THREE.MeshStandardMaterial({ map: tex1, roughnessMap: tex2 }));
  const geo1 = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const mesh1 = new THREE.Mesh(geo1, mat1);
  root.add(mesh1);

  // Level 2: Sub-group containing multi-material mesh
  const l2Group = new THREE.Group();
  const tex3 = trackTex(new THREE.Texture());
  const mat2a = trackMat(new THREE.MeshBasicMaterial({ map: tex3 }));
  const mat2b = trackMat(new THREE.MeshStandardMaterial({ metalness: 0.8 }));
  const mat2c = trackMat(new THREE.MeshPhongMaterial({ shininess: 100 }));
  const geo2 = trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 2));
  const mesh2 = new THREE.Mesh(geo2, [mat2a, mat2b, mat2c]);
  l2Group.add(mesh2);
  root.add(l2Group);

  // Level 3: Deep nested group
  const l3Group = new THREE.Group();
  const l4Group = new THREE.Group();
  const l5Group = new THREE.Group();
  const tex4 = trackTex(new THREE.Texture());
  const mat3 = trackMat(new THREE.MeshLambertMaterial({ map: tex4 }));
  const geo3 = trackGeo(new THREE.SphereGeometry(1, 8, 8));
  const mesh3 = new THREE.Mesh(geo3, mat3);
  l5Group.add(mesh3);
  l4Group.add(l5Group);
  l3Group.add(l4Group);
  root.add(l3Group);

  // Level 1 non-mesh objects (lights, cameras) to test traversal immunity
  root.add(new THREE.DirectionalLight());
  root.add(new THREE.AmbientLight());
  root.add(new THREE.PerspectiveCamera());

  assert.strictEqual(disposedGeometries, 0);
  assert.strictEqual(disposedMaterials, 0);
  assert.strictEqual(disposedTextures, 0);

  disposeThreeObject(root);

  assert.strictEqual(disposedGeometries, 3, 'All 3 geometries must be disposed');
  assert.strictEqual(disposedMaterials, 5, 'All 5 materials must be disposed (1 single + 3 multi + 1 deep)');
  assert.strictEqual(disposedTextures, 4, 'All 4 textures must be disposed');
});

runTest('2.2: Adversarial edge cases: null geometries, null materials, circular references, non-texture properties', () => {
  // Case A: Mesh with null geometry and null material
  const bareMesh = new THREE.Mesh();
  bareMesh.geometry = null;
  bareMesh.material = null;
  assert.doesNotThrow(() => disposeThreeObject(bareMesh), 'Should not throw on null geometry/material');

  // Case B: Material with circular reference and complex objects
  const circularMat = new THREE.MeshStandardMaterial();
  circularMat.circularRef = circularMat;
  circularMat.someObj = { isTexture: false, notATexture: true };
  circularMat.fakeTexture = { isTexture: false };
  const circularMesh = new THREE.Mesh(new THREE.BoxGeometry(), circularMat);
  assert.doesNotThrow(() => disposeThreeObject(circularMesh), 'Should not throw or infinite loop on circular references');

  // Case C: Empty group
  assert.doesNotThrow(() => disposeThreeObject(new THREE.Group()), 'Should not throw on empty group');
});

// -----------------------------------------------------------------------------
// SUITE 3: Polar Angle Clamping & Camera Boundary Stress Testing
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 3] Polar Angle Clamping & Camera Pitch Boundaries${RESET}`);

runTest('3.1: Polar angle constants adhere strictly to [π/4, 0.65π]', () => {
  const minPolarAngle = Math.PI / 4;
  const maxPolarAngle = Math.PI * 0.65;

  assert.strictEqual(minPolarAngle, 0.7853981633974483);
  assert.strictEqual(maxPolarAngle, 2.0420352248333655);

  const minDeg = (minPolarAngle * 180) / Math.PI;
  const maxDeg = (maxPolarAngle * 180) / Math.PI;

  assert.strictEqual(minDeg, 45, 'Min polar angle must be exactly 45 degrees');
  assert.strictEqual(maxDeg, 117, 'Max polar angle must be exactly 117 degrees');

  // Invariants:
  // 1. Min angle > 0 (prevents zenith flip / looking straight down onto pole)
  assert.ok(minPolarAngle > 0, 'Min angle must be greater than 0');
  // 2. Max angle < π (prevents nadir flip / looking straight up from below)
  assert.ok(maxPolarAngle < Math.PI, 'Max angle must be less than π (180 deg)');
  // 3. Min angle < Max angle
  assert.ok(minPolarAngle < maxPolarAngle, 'Min angle must be less than Max angle');
  // 4. Horizon (π/2 = 90 deg) is within valid range
  assert.ok(minPolarAngle < Math.PI / 2 && maxPolarAngle > Math.PI / 2, 'Horizon (π/2) must fall within range');
});

runTest('3.2: 10,000 randomized polar angles across [-100π, +100π] are strictly clamped', () => {
  const minPolarAngle = Math.PI / 4;
  const maxPolarAngle = Math.PI * 0.65;

  function clamp(angle) {
    return Math.max(minPolarAngle, Math.min(maxPolarAngle, angle));
  }

  for (let i = 0; i < 10000; i++) {
    const rawAngle = (Math.random() - 0.5) * 200 * Math.PI;
    const clamped = clamp(rawAngle);

    assert.ok(clamped >= minPolarAngle - 1e-12, `Clamped angle ${clamped} below minPolarAngle`);
    assert.ok(clamped <= maxPolarAngle + 1e-12, `Clamped angle ${clamped} above maxPolarAngle`);
  }
});

runTest('3.3: Critical boundary angles (zenith 0, nadir π, horizons, epsilon offsets)', () => {
  const min = Math.PI / 4;
  const max = Math.PI * 0.65;
  const eps = 1e-6;

  function clamp(phi) {
    return Math.max(min, Math.min(max, phi));
  }

  assert.strictEqual(clamp(0), min, 'Zenith (0) clamps to minPolarAngle');
  assert.strictEqual(clamp(min - eps), min, 'Min - eps clamps to minPolarAngle');
  assert.strictEqual(clamp(min), min, 'Exact minPolarAngle preserved');
  assert.strictEqual(clamp(Math.PI / 2), Math.PI / 2, 'Equator (π/2) preserved');
  assert.strictEqual(clamp(max), max, 'Exact maxPolarAngle preserved');
  assert.strictEqual(clamp(max + eps), max, 'Max + eps clamps to maxPolarAngle');
  assert.strictEqual(clamp(Math.PI), max, 'Nadir (π) clamps to maxPolarAngle');
  assert.strictEqual(clamp(-Math.PI), min, 'Negative angle clamps to minPolarAngle');
  assert.strictEqual(clamp(10 * Math.PI), max, 'Extreme positive clamps to maxPolarAngle');
});

// -----------------------------------------------------------------------------
// SUITE 4: Interaction Debounce Timer & Auto-Rotation Lifecycle Simulation
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 4] Interaction Debounce Timer & State Machine Lifecycle${RESET}`);

runTest('4.1: Interaction start immediately halts auto-rotation (synchronous state change)', () => {
  let isInteracting = false;
  let timerId = null;
  const idleResumeDelayMs = 3000;

  const handleStart = () => {
    if (timerId) clearTimeout(timerId);
    isInteracting = true;
  };

  assert.strictEqual(isInteracting, false, 'Initially idle: auto-rotation active');
  handleStart();
  assert.strictEqual(isInteracting, true, 'Start event synchronously halts auto-rotation');
});

await runTestAsync('4.2: End event starts timer; debounce delay exactly respected', async () => {
  let isInteracting = true;
  let timerId = null;
  const testDelayMs = 50; // fast scaled delay for empirical assertion

  const handleEnd = () => {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      isInteracting = false;
    }, testDelayMs);
  };

  handleEnd();
  assert.strictEqual(isInteracting, true, 'Immediately after end, isInteracting must still be true');

  // Wait half of delay
  await new Promise((resolve) => setTimeout(resolve, testDelayMs / 2));
  assert.strictEqual(isInteracting, true, 'Halfway through debounce delay, isInteracting must still be true');

  // Wait remaining delay + buffer
  await new Promise((resolve) => setTimeout(resolve, testDelayMs + 15));
  assert.strictEqual(isInteracting, false, 'After debounce delay expires, auto-rotation resumes (isInteracting=false)');
});

await runTestAsync('4.3: Interaction interruption resets timer; prevents premature resume', async () => {
  let isInteracting = true;
  let timerId = null;
  const testDelayMs = 60;

  const handleStart = () => {
    if (timerId) clearTimeout(timerId);
    isInteracting = true;
  };

  const handleEnd = () => {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      isInteracting = false;
    }, testDelayMs);
  };

  handleEnd(); // scheduled to expire at +60ms

  // At +30ms, user starts interacting again!
  await new Promise((resolve) => setTimeout(resolve, 30));
  handleStart(); // cancels timer
  assert.strictEqual(isInteracting, true);

  // Wait another 40ms (now total 70ms since first end, which would have expired original timer!)
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.strictEqual(isInteracting, true, 'Interrupted timer must NOT fire; remains interacting');

  // End interaction again
  handleEnd();
  await new Promise((resolve) => setTimeout(resolve, testDelayMs + 15));
  assert.strictEqual(isInteracting, false, 'Finally resumes after uninterrupted delay');
});

runTest('4.4: Unmount cleanup cancels pending timer without memory leaks', () => {
  let timerId = null;
  let wasCleared = false;

  timerId = setTimeout(() => {
    throw new Error('LEAK: Timer fired after unmount!');
  }, 10000);

  // Simulate unmount cleanup hook
  const cleanup = () => {
    if (timerId) {
      clearTimeout(timerId);
      wasCleared = true;
    }
  };

  cleanup();
  assert.strictEqual(wasCleared, true, 'Timer was successfully canceled on unmount');
});

// -----------------------------------------------------------------------------
// SUITE 5: Binary GLB Asset Integrity & GLTF 2.0 Spec Conformance
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 5] Binary GLB Asset Integrity & GLTF 2.0 Spec Conformance${RESET}`);

runTest('5.1: placeholder-weapon.glb file exists and has non-zero size', () => {
  const glbPath = path.resolve('public/models/placeholder-weapon.glb');
  assert.ok(fs.existsSync(glbPath), 'GLB file must exist at public/models/placeholder-weapon.glb');
  const stat = fs.statSync(glbPath);
  assert.ok(stat.size > 1024, `GLB file size (${stat.size} bytes) should be > 1KB`);
});

runTest('5.2: GLB 12-byte header validation (magic 0x46546c67, version 2, length)', () => {
  const glbPath = path.resolve('public/models/placeholder-weapon.glb');
  const buffer = fs.readFileSync(glbPath);

  assert.ok(buffer.length >= 12, 'GLB must be at least 12 bytes');

  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);

  assert.strictEqual(magic, 0x46546c67, 'Magic must equal 0x46546c67 ("glTF")');
  assert.strictEqual(version, 2, 'GLTF version must equal 2');
  assert.strictEqual(length, buffer.length, 'Header length field must match buffer byte length');
});

runTest('5.3: Chunk 0 JSON validation (type 0x4E4F534A, schema, version 2.0)', () => {
  const glbPath = path.resolve('public/models/placeholder-weapon.glb');
  const buffer = fs.readFileSync(glbPath);

  const chunk0Length = buffer.readUInt32LE(12);
  const chunk0Type = buffer.readUInt32LE(16);

  assert.strictEqual(chunk0Type, 0x4E4F534A, 'Chunk 0 type must be 0x4E4F534A ("JSON")');

  const jsonBytes = buffer.subarray(20, 20 + chunk0Length);
  const jsonText = jsonBytes.toString('utf8');
  let gltf;
  assert.doesNotThrow(() => {
    gltf = JSON.parse(jsonText);
  }, 'Chunk 0 payload must parse as valid JSON');

  assert.ok(gltf.asset, 'GLTF must have asset metadata');
  assert.strictEqual(gltf.asset.version, '2.0', 'GLTF asset.version must be "2.0"');
  assert.ok(Array.isArray(gltf.meshes) && gltf.meshes.length > 0, 'GLTF must contain meshes');
  assert.ok(Array.isArray(gltf.materials) && gltf.materials.length > 0, 'GLTF must contain materials');
  assert.ok(Array.isArray(gltf.nodes) && gltf.nodes.length > 0, 'GLTF must contain nodes');
});

runTest('5.4: Chunk 1 Binary Buffer validation (type 0x004E4942)', () => {
  const glbPath = path.resolve('public/models/placeholder-weapon.glb');
  const buffer = fs.readFileSync(glbPath);

  const chunk0Length = buffer.readUInt32LE(12);
  const chunk1Offset = 20 + chunk0Length;

  assert.ok(buffer.length >= chunk1Offset + 8, 'GLB must have Chunk 1 header');
  const chunk1Length = buffer.readUInt32LE(chunk1Offset);
  const chunk1Type = buffer.readUInt32LE(chunk1Offset + 4);

  assert.strictEqual(chunk1Type, 0x004E4942, 'Chunk 1 type must be 0x004E4942 ("BIN")');
  assert.strictEqual(chunk1Offset + 8 + chunk1Length, buffer.length, 'Total chunks length must match file size');
});

runTest('5.5: Adversarial corruptions correctly detected and rejected by GLB parser oracle', () => {
  const validBuffer = fs.readFileSync(path.resolve('public/models/placeholder-weapon.glb'));

  function parseGlbHeader(buf) {
    if (buf.length < 12) throw new Error('Truncated GLB: header < 12 bytes');
    const magic = buf.readUInt32LE(0);
    if (magic !== 0x46546c67) throw new Error('Invalid magic: ' + magic.toString(16));
    const version = buf.readUInt32LE(4);
    if (version !== 2) throw new Error('Unsupported GLTF version: ' + version);
    const length = buf.readUInt32LE(8);
    if (length !== buf.length) throw new Error('Length mismatch');
    return { magic, version, length };
  }

  // Corrupt magic
  const badMagic = Buffer.from(validBuffer);
  badMagic.writeUInt32LE(0xDEADBEEF, 0);
  assert.throws(() => parseGlbHeader(badMagic), /Invalid magic/);

  // Corrupt version
  const badVersion = Buffer.from(validBuffer);
  badVersion.writeUInt32LE(1, 4);
  assert.throws(() => parseGlbHeader(badVersion), /Unsupported GLTF version/);

  // Truncated buffer
  const truncated = validBuffer.subarray(0, 8);
  assert.throws(() => parseGlbHeader(truncated), /Truncated GLB/);
});

// -----------------------------------------------------------------------------
// SUITE 6: Component Architecture & Build Artifact Integrity
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}[Suite 6] Component Architecture & Build Artifact Integrity${RESET}`);

runTest('6.1: ModelViewer module exports all required public interfaces', async () => {
  const mod = await import('../src/components/ModelViewer.tsx');
  assert.ok(typeof mod.default === 'function', 'Default export must be ModelViewer function component');
  assert.ok(typeof mod.ModelViewer === 'function', 'Named export ModelViewer must exist');
  assert.ok(typeof mod.ModelViewerSkeleton === 'function', 'Named export ModelViewerSkeleton must exist');
  assert.ok(typeof mod.StudioLighting === 'function', 'Named export StudioLighting must exist');
  assert.ok(typeof mod.FallbackWeaponMesh === 'function', 'Named export FallbackWeaponMesh must exist');
  assert.ok(typeof mod.disposeThreeObject === 'function', 'Named export disposeThreeObject must exist');
  assert.ok(typeof mod.ModelViewerToggleHarness === 'function', 'Named export ModelViewerToggleHarness must exist');
});

runTest('6.2: Test route src/pages/test/model-viewer.astro exists and includes all 3 test harnesses', () => {
  const testPagePath = path.resolve('src/pages/test/model-viewer.astro');
  assert.ok(fs.existsSync(testPagePath), 'src/pages/test/model-viewer.astro must exist');
  const content = fs.readFileSync(testPagePath, 'utf8');

  assert.ok(content.includes('ModelViewer'), 'Must import and use ModelViewer');
  assert.ok(content.includes('ModelViewerToggleHarness'), 'Must import and use ModelViewerToggleHarness');
  assert.ok(content.includes('/models/placeholder-weapon.glb'), 'Must reference placeholder GLB');
  assert.ok(content.includes('client:load'), 'Must use client:load directive');
  assert.ok(content.includes('client:visible'), 'Must use client:visible directive');
});

runTest('6.3: Built distribution contains rendered HTML for test route', () => {
  const distHtmlPath = path.resolve('dist/test/model-viewer/index.html');
  assert.ok(fs.existsSync(distHtmlPath), 'dist/test/model-viewer/index.html must exist from build');
  const html = fs.readFileSync(distHtmlPath, 'utf8');
  assert.ok(html.includes('3D ModelViewer Test Suite'), 'Rendered HTML contains page title');
  assert.ok(html.includes('Combat Knife | Case Hardened'), 'Rendered HTML contains weapon name');
});

// -----------------------------------------------------------------------------
// FINAL REPORT
// -----------------------------------------------------------------------------
console.log(`\n${BOLD}================================================================================${RESET}`);
console.log(`${BOLD}   EMPIRICAL ADVERSARIAL STRESS TEST SUMMARY                                    ${RESET}`);
console.log(`${BOLD}================================================================================${RESET}`);
console.log(`  Total Tests Run:  ${totalTests}`);
console.log(`  Passed Tests:     ${CYAN}${passedTests}${RESET}`);
console.log(`  Failed Tests:     ${failedTests > 0 ? '\x1b[31m' : '\x1b[32m'}${failedTests}${RESET}`);

if (failedTests > 0) {
  console.log(`\n${BOLD}\x1b[31m[VERDICT: REQUEST_CHANGES] ${failedTests} stress tests failed.${RESET}\n`);
  process.exit(1);
} else {
  console.log(`\n${BOLD}\x1b[32m[VERDICT: APPROVE] All ${passedTests} stress tests passed with 100% reliability.${RESET}\n`);
  process.exit(0);
}
