import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Polyfill FileReader for Node.js runtime
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    async readAsArrayBuffer(blob) {
      this.result = await blob.arrayBuffer();
      if (typeof this.onloadend === 'function') {
        this.onloadend();
      }
    }
  };
}

const outputDir = path.resolve(process.cwd(), 'public/models');
const outputPath = path.join(outputDir, 'placeholder-weapon.glb');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Build a stylized CS2 combat knife geometry
const scene = new THREE.Scene();
const knifeGroup = new THREE.Group();

// 1. Blade
const bladeGeo = new THREE.BoxGeometry(0.08, 1.3, 0.28);
const bladeMat = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  metalness: 0.95,
  roughness: 0.15,
});
const blade = new THREE.Mesh(bladeGeo, bladeMat);
blade.position.y = 0.45;
knifeGroup.add(blade);

// 2. Guard
const guardGeo = new THREE.BoxGeometry(0.2, 0.08, 0.45);
const guardMat = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  metalness: 0.85,
  roughness: 0.25,
});
const guard = new THREE.Mesh(guardGeo, guardMat);
guard.position.y = -0.22;
knifeGroup.add(guard);

// 3. Grip
const gripGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.75, 16);
const gripMat = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  metalness: 0.2,
  roughness: 0.8,
});
const grip = new THREE.Mesh(gripGeo, gripMat);
grip.position.y = -0.65;
knifeGroup.add(grip);

scene.add(knifeGroup);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (gltf) => {
    fs.writeFileSync(outputPath, Buffer.from(gltf));
    console.log(`[GLTF Gen] Successfully created: ${outputPath} (${gltf.byteLength} bytes)`);
  },
  (error) => {
    console.error('[GLTF Gen] Error exporting GLTF:', error);
    process.exit(1);
  },
  { binary: true }
);
