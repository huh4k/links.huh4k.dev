import React, { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Center, useGLTF, useProgress, Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';
import * as THREE from 'three';
import { getWeaponModelPath, getObjsWeaponModelPath, getLegacyWeaponModelPath, isObjModelUrl, WEAPON_MODEL_MAP, OBJS_MODEL_MAP, CSGO_LEGACY_MODEL_MAP } from '../utils/weaponModels';
import { getR2WeaponTextures, loadR2Texture } from '../utils/r2Textures';
import { resolveSkinTextureUrl, resolveUVSheetTextureUrl, isDataMapUrl, isColorWrapUrl } from '../utils/weaponTextures';

export interface ModelViewerProps {
  /** Public URL or path to the .glb or .obj model file */
  modelUrl?: string;
  /** Fallback icon image URL */
  fallbackIconUrl?: string;
  /** Custom wrapper CSS classes for container sizing */
  className?: string;
  /** Whether idle auto-rotation is enabled by default (default: true) */
  autoRotate?: boolean;
  /** Auto-rotation speed multiplier (default: 1.5) */
  autoRotateSpeed?: number;
  /** Delay in milliseconds before auto-rotation resumes after user interaction (default: 3000ms) */
  idleResumeDelayMs?: number;
  /** Whether user can zoom via mouse wheel / pinch (default: true) */
  enableZoom?: boolean;
  /** Minimum camera zoom distance to prevent clipping into weapon (default: 1.2) */
  minDistance?: number;
  /** Maximum camera zoom distance to prevent weapon shrinking too small (default: 5.5) */
  maxDistance?: number;
  /** Field of View for perspective camera (default: 45) */
  fov?: number;
  /** Initial camera position vector [x, y, z] (default: [0, 0.4, 3.2]) */
  cameraPosition?: [number, number, number];
  /** Display title for weapon (used in loading state & accessibility) */
  weaponName?: string;
  /** Whether to show the bottom interaction hint pill (default: true) */
  showControlsHint?: boolean;
  /** Optional callback fired when model successfully finishes loading */
  onLoaded?: () => void;
  /** Optional callback fired if model loading or parsing fails */
  onError?: (err: Error) => void;
  /** Wear rating float value (0.0000 to 1.0000) from Steam inventory */
  float?: number | null;
  /** Paint seed / pattern template integer (0 to 1000) */
  seed?: number | null;
  /** Rarity hex color (e.g. #eb4b4b Covert, #d32ce6 Classified) */
  rarityColor?: string;
  /** Specific skin pattern name (e.g. "Ice Coaled", "Liquidation", "Royal Guard") */
  skinName?: string;
  /** Direct texture URL (e.g. R2 CDN AO/diffuse map or local UV sheet). Loaded with sRGB color space.
   *  When provided, bypasses the procedural canvas compositor and loads the real texture file. */
  textureUrl?: string;
  /** Vertical UV orientation control (default: false for direct WebGL mapping, can be set to true) */
  flipY?: boolean;
  /** Force loading the CS:GO Legacy UV OBJ model with authentic vt coordinates (default: auto) */
  useLegacyModel?: boolean;
}

/**
 * Utility to recursively dispose Three.js meshes, geometries, materials, and textures.
 */
export function disposeThreeObject(object: THREE.Object3D): void {
  if (!object || typeof object.traverse !== 'function') return;
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  object.traverse((child) => {
    if (!child) return;
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
        disposedGeometries.add(mesh.geometry);
        if (typeof mesh.geometry.dispose === 'function') {
          try {
            mesh.geometry.dispose();
          } catch {
            // Safe fallback
          }
        }
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => disposeMaterial(m, disposedMaterials, disposedTextures));
        } else {
          disposeMaterial(mesh.material, disposedMaterials, disposedTextures);
        }
      }
    }
  });
}

function disposeMaterial(
  mat: THREE.Material,
  disposedMaterials = new Set<THREE.Material>(),
  disposedTextures = new Set<THREE.Texture>()
): void {
  if (!mat || disposedMaterials.has(mat)) return;
  disposedMaterials.add(mat);

  const disposeTex = (tex: unknown) => {
    if (
      tex &&
      typeof tex === 'object' &&
      'isTexture' in tex &&
      (tex as { isTexture: boolean }).isTexture &&
      typeof (tex as { dispose?: unknown }).dispose === 'function'
    ) {
      const textureObj = tex as THREE.Texture;
      if (!disposedTextures.has(textureObj)) {
        disposedTextures.add(textureObj);
        try {
          textureObj.dispose();
        } catch {
          // Safe fallback
        }
      }
    }
  };

  const knownTextureKeys = [
    'map',
    'aoMap',
    'roughnessMap',
    'metalnessMap',
    'masksMap',
    'normalMap',
    'bumpMap',
    'displacementMap',
    'emissiveMap',
    'alphaMap',
    'clearcoatMap',
    'clearcoatRoughnessMap',
    'clearcoatNormalMap',
    'envMap',
    'lightMap',
  ];

  for (const key of knownTextureKeys) {
    disposeTex((mat as unknown as Record<string, unknown>)[key]);
  }

  if (mat.userData && typeof mat.userData === 'object') {
    for (const key of Object.keys(mat.userData)) {
      disposeTex((mat.userData as Record<string, unknown>)[key]);
    }
  }

  const record = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    disposeTex(record[key]);
  }

  if (typeof mat.dispose === 'function') {
    try {
      mat.dispose();
    } catch {
      // Safe fallback
    }
  }
}

/**
 * Studio 3-point lighting rig designed to accentuate weapon contours,
 * specular highlights, and metallic finishes.
 */
export function StudioLighting() {
  return (
    <>
      {/* 1. Base Ambient: Prevents pitch-black shadows without flattening depth */}
      <ambientLight intensity={0.35} color="#f8fafc" />

      {/* 2. Hemisphere Bounce: Simulates floor reflection on lower weapon edges */}
      <hemisphereLight
        args={['#ffffff', '#1e293b', 0.3]}
      />

      {/* 3. Key Light: Upper-right forward; high-intensity specular highlight */}
      <directionalLight
        position={[4.5, 5.0, 4.0]}
        intensity={2.2}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0001}
      />

      {/* 4. Fill Light: Lower-left forward; cool tone reveals details on dark side */}
      <directionalLight
        position={[-4.0, 1.5, 3.0]}
        intensity={0.75}
        color="#bae6fd"
      />

      {/* 5. Rim / Kicker Light: Upper-rear facing camera; cuts silhouette against dark background */}
      <directionalLight
        position={[0.0, 3.5, -5.0]}
        intensity={2.8}
        color="#e0f2fe"
      />
    </>
  );
}

/**
 * Procedural fallback weapon geometry (stylized CS2 tactical combat knife)
 * rendered when modelUrl is omitted or fails network fetch.
 */
export function FallbackWeaponMesh() {
  return (
    <group rotation={[0, -Math.PI / 4, 0]}>
      {/* Blade */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.08, 1.3, 0.28]} />
        <meshStandardMaterial
          metalness={0.92}
          roughness={0.18}
          color="#94a3b8"
          emissive="#0284c7"
          emissiveIntensity={0.08}
        />
      </mesh>
      {/* Blade Edge Accent */}
      <mesh position={[0, 0.55, 0.1]}>
        <coneGeometry args={[0.1, 0.6, 4]} />
        <meshStandardMaterial metalness={0.95} roughness={0.12} color="#e2e8f0" />
      </mesh>
      {/* Guard */}
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.2, 0.08, 0.45]} />
        <meshStandardMaterial metalness={0.8} roughness={0.3} color="#f59e0b" />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -0.65, 0]}>
        <cylinderGeometry args={[0.08, 0.09, 0.75, 16]} />
        <meshStandardMaterial metalness={0.15} roughness={0.85} color="#0f172a" />
      </mesh>
      {/* Pommel */}
      <mesh position={[0, -1.05, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial metalness={0.7} roughness={0.35} color="#475569" />
      </mesh>
    </group>
  );
}

/**
 * GLTF Scene loader with automatic bounding-box normalization and cleanup.
 */
export function WeaponScene({
  modelUrl,
  onLoaded,
}: {
  modelUrl: string;
  onLoaded?: () => void;
}) {
  const { scene } = useGLTF(modelUrl);
  const loadedNotified = useRef(false);

  useEffect(() => {
    loadedNotified.current = false;
  }, [modelUrl]);

  useEffect(() => {
    if (!loadedNotified.current && onLoaded) {
      loadedNotified.current = true;
      onLoaded();
    }
  }, [onLoaded, modelUrl]);

  const normalizedScene = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scaleFactor = 2.0 / maxDim;
      clone.scale.setScalar(scaleFactor);
    }

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return clone;
  }, [scene]);

  // Clean up cloned geometries, materials, and textures on unmount or URL switch
  useEffect(() => {
    return () => {
      disposeThreeObject(normalizedScene);
      try {
        useGLTF.clear(modelUrl);
      } catch {
        // Safe fallback if not in Drei cache
      }
    };
  }, [normalizedScene, modelUrl]);

  return (
    <Center>
      <primitive object={normalizedScene} />
    </Center>
  );
}

export interface ObjWeaponSceneProps {
  modelUrl: string;
  /** Direct texture URL (e.g. from R2 CDN or local UV sheet) — loaded with sRGB color space */
  textureUrl?: string;
  weaponName?: string;
  skinName?: string;
  float?: number | null;
  seed?: number | null;
  rarityColor?: string;
  onLoaded?: () => void;
  /** Vertical UV orientation control (default: false) */
  flipY?: boolean;
}

/**
 * Channel swizzling contract for Source 2 surface maps:
 * Red = Roughness, Green = Metalness.
 */
export const SOURCE2_SURFACE_SWIZZLE = {
  roughnessChannel: 'R',
  metalnessChannel: 'G',
  redRoughness: true,
  greenMetalness: true,
} as const;

/**
 * Injects custom GLSL swizzle operations into MeshPhysicalMaterial to route
 * Source 2 packed surface channels correctly:
 * - Red channel -> roughnessFactor (instead of Three.js default Green)
 * - Green channel -> metalnessFactor (instead of Three.js default Blue)
 */
export function applySource2SurfaceSwizzle(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
        // Source 2 surface swizzle: Red channel maps to roughness
        roughnessFactor *= texelRoughness.r;
      #endif
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `
      float metalnessFactor = metalness;
      #ifdef USE_METALNESSMAP
        vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
        // Source 2 surface swizzle: Green channel maps to metalness
        metalnessFactor *= texelMetalness.g;
      #endif
      `
    );
  };
  material.needsUpdate = true;
}

/**
 * Creates separate roughness and metalness textures from a Source 2 packed surface map
 * by swizzling channels (Red -> roughness, Green -> metalness).
 */
export function swizzleSurfaceMapChannels(surfaceTexture: THREE.Texture): {
  roughnessMap: THREE.Texture;
  metalnessMap: THREE.Texture;
} {
  if (
    typeof document !== 'undefined' &&
    surfaceTexture.image &&
    (surfaceTexture.image as HTMLImageElement).width > 0 &&
    (surfaceTexture.image as HTMLImageElement).height > 0
  ) {
    try {
      const img = surfaceTexture.image as HTMLImageElement;
      const w = img.width;
      const h = img.height;

      const rCanvas = document.createElement('canvas');
      rCanvas.width = w;
      rCanvas.height = h;
      const rCtx = rCanvas.getContext('2d');

      const mCanvas = document.createElement('canvas');
      mCanvas.width = w;
      mCanvas.height = h;
      const mCtx = mCanvas.getContext('2d');

      if (rCtx && mCtx) {
        rCtx.drawImage(img, 0, 0);
        const rImgData = rCtx.getImageData(0, 0, w, h);
        const rData = rImgData.data;

        mCtx.drawImage(img, 0, 0);
        const mImgData = mCtx.getImageData(0, 0, w, h);
        const mData = mImgData.data;

        for (let i = 0; i < rData.length; i += 4) {
          const redVal = rData[i];       // Red = Roughness
          const greenVal = rData[i + 1]; // Green = Metalness

          rData[i] = redVal;
          rData[i + 1] = redVal;
          rData[i + 2] = redVal;

          mData[i] = greenVal;
          mData[i + 1] = greenVal;
          mData[i + 2] = greenVal;
        }

        rCtx.putImageData(rImgData, 0, 0);
        mCtx.putImageData(mImgData, 0, 0);

        const roughnessTex = new THREE.CanvasTexture(rCanvas);
        roughnessTex.wrapS = THREE.RepeatWrapping;
        roughnessTex.wrapT = THREE.RepeatWrapping;
        roughnessTex.needsUpdate = true;

        const metalnessTex = new THREE.CanvasTexture(mCanvas);
        metalnessTex.wrapS = THREE.RepeatWrapping;
        metalnessTex.wrapT = THREE.RepeatWrapping;
        metalnessTex.needsUpdate = true;

        return { roughnessMap: roughnessTex, metalnessMap: metalnessTex };
      }
    } catch {
      // Fallback if canvas extraction fails
    }
  }

  surfaceTexture.wrapS = THREE.RepeatWrapping;
  surfaceTexture.wrapT = THREE.RepeatWrapping;
  return { roughnessMap: surfaceTexture, metalnessMap: surfaceTexture };
}

/**
 * Wavefront OBJ Scene loader for CS2 weapon models.
 * Calculates pristine vertex normals, centers geometry, normalizes scale to targetSize 2.4,
 * upgrades material to THREE.MeshPhysicalMaterial, binds dual UV mapping (uv2),
 * immediately initializes fallback skin base color, asynchronously applies R2 AO, surface (with channel swizzle),
 * and mask maps alongside diffuse skin composite textures, and cleanly disposes GPU resources on unmount.
 */
export function ObjWeaponScene({
  modelUrl,
  textureUrl,
  weaponName,
  skinName,
  float,
  seed,
  rarityColor,
  onLoaded,
  flipY = true,
}: ObjWeaponSceneProps) {
  const rawObj = useLoader(
    OBJLoader,
    modelUrl,
    (loader) => {
      loader.manager.onError = (url) => {
        console.error('[ModelViewer OBJLoader Error]', 'Failed to fetch/parse 3D model:', url, 'modelUrl prop was:', modelUrl);
      };
    }
  );
  const loadedNotified = useRef(false);

  useEffect(() => {
    loadedNotified.current = false;
  }, [modelUrl]);

  useEffect(() => {
    if (!loadedNotified.current && onLoaded) {
      loadedNotified.current = true;
      onLoaded();
    }
  }, [onLoaded, modelUrl]);

  const effectiveWeaponName = weaponName || modelUrl;

  const processedScene = useMemo(() => {
    const clone = rawObj.clone(true);

    // Default neutral weapon material: neutral dark gunmetal PBR finish (color: 0x334155, metalness: 0.7, roughness: 0.35)
    // Completely decouples skinCompositor.ts; no 2D canvas drawing primitives.
    const weaponMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x334155),
      metalness: 0.7,
      roughness: 0.35,
      clearcoat: 0.05,
      clearcoatRoughness: 0.15,
      side: THREE.FrontSide,
    });
    applySource2SurfaceSwizzle(weaponMaterial);
    weaponMaterial.needsUpdate = true;

    // Neutral dark metallic PBR material for non-painted subcomponents is intentionally
    // NOT used here — the .obj files are monolithic (single group "renderMesh1") with no
    // named submesh parts. Applying a regex-based material split would break everything.

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          // Clone geometry to prevent cached rawObj disposal corruption
          mesh.geometry = mesh.geometry.clone();
          // Compute pristine vertex normals for accurate specular highlights
          mesh.geometry.computeVertexNormals();
          // NOTE: Do NOT call mesh.geometry.center() here — it destroys the
          // relative positional offsets between weapon parts.
          // The root group is centered below via Box3.
          // Dual UV mapping: assign uv2 from uv for universal aoMap shader support
          if (mesh.geometry.attributes.uv && !mesh.geometry.attributes.uv2) {
            mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv);
          }
        }

        // Debug: log submesh name for UV layout inspection
        console.log(`[ModelViewer] Submesh: "${mesh.name || '(unnamed)'}" | original material:`, mesh.material);

        // Apply unified skin material to ALL submeshes
        mesh.material = weaponMaterial;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    // Center and scale the ENTIRE assembled weapon hierarchy on the root group only.
    // Using Box3 on the root preserves relative offsets between all parts.
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.sub(center);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const targetSize = 2.4;
      clone.scale.setScalar(targetSize / maxDim);
    }

    return { group: clone, material: weaponMaterial };
  }, [rawObj, modelUrl]);

  // Primary Texture Application Pipeline:
  // Loads direct skin color wrap (with flipY=false, SRGBColorSpace, RepeatWrapping).
  // Strictly separates color wrap from PBR data maps (surface, ao, normal, rough).
  useEffect(() => {
    let isCancelled = false;
    const material = processedScene.material;

    // ── Primary: Direct skin color wrap application ──────────────────────────
    // Guard against data maps (_surface, _masks, _rough, _ao, _normal) being bound to diffuse map
    const isValidColorWrap = textureUrl && isColorWrapUrl(textureUrl);

    if (isValidColorWrap && textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        textureUrl,
        (tex) => {
          if (isCancelled) return;
          // Diffuse map configuration:
          tex.flipY = flipY;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.needsUpdate = true;

          if (material.map && material.map !== tex) {
            try { material.map.dispose(); } catch { /* safe */ }
          }
          material.map = tex;
          material.color.set(0xffffff);
          material.needsUpdate = true;

          // Ensure all submeshes in cloned scene explicitly receive the textured material
          processedScene.group.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              (child as THREE.Mesh).material = material;
            }
          });
        },
        undefined,
        (err) => {
          console.warn('[ModelViewer] Color wrap load error for:', textureUrl, err);
          if (!isCancelled) {
            // Attempt fallback to local authentic UV sheet if textureUrl was an external R2 URL
            const uvSheet = resolveUVSheetTextureUrl(effectiveWeaponName);
            if (uvSheet && uvSheet !== textureUrl && isColorWrapUrl(uvSheet)) {
              loader.load(
                uvSheet,
                (fallbackTex) => {
                  if (isCancelled) return;
                  fallbackTex.flipY = flipY;
                  fallbackTex.colorSpace = THREE.SRGBColorSpace;
                  fallbackTex.wrapS = THREE.RepeatWrapping;
                  fallbackTex.wrapT = THREE.RepeatWrapping;
                  fallbackTex.needsUpdate = true;

                  if (material.map && material.map !== fallbackTex) {
                    try { material.map.dispose(); } catch { /* safe */ }
                  }
                  material.map = fallbackTex;
                  material.color.set(0xffffff);
                  material.needsUpdate = true;

                  processedScene.group.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                      (child as THREE.Mesh).material = material;
                    }
                  });
                },
                undefined,
                () => {
                  if (!isCancelled) {
                    material.map = null;
                    material.color.set(0x334155);
                    material.metalness = 0.7;
                    material.roughness = 0.35;
                    material.needsUpdate = true;
                  }
                }
              );
            } else {
              material.map = null;
              material.color.set(0x334155);
              material.metalness = 0.7;
              material.roughness = 0.35;
              material.needsUpdate = true;
            }
          }
        }
      );
    } else {
      // If no valid color wrap is found, attempt fallback to authentic UV sheet for the weapon
      const uvSheet = resolveUVSheetTextureUrl(effectiveWeaponName);
      if (uvSheet && isColorWrapUrl(uvSheet)) {
        const loader = new THREE.TextureLoader();
        loader.load(
          uvSheet,
          (fallbackTex) => {
            if (isCancelled) return;
            fallbackTex.flipY = flipY;
            fallbackTex.colorSpace = THREE.SRGBColorSpace;
            fallbackTex.wrapS = THREE.RepeatWrapping;
            fallbackTex.wrapT = THREE.RepeatWrapping;
            fallbackTex.needsUpdate = true;

            if (material.map && material.map !== fallbackTex) {
              try { material.map.dispose(); } catch { /* safe */ }
            }
            material.map = fallbackTex;
            material.color.set(0xffffff);
            material.needsUpdate = true;

            processedScene.group.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).material = material;
              }
            });
          },
          undefined,
          () => {
            if (!isCancelled) {
              if (material.map) {
                try { material.map.dispose(); } catch { /* safe */ }
                material.map = null;
              }
              material.color.set(0x334155);
              material.metalness = 0.7;
              material.roughness = 0.35;
              material.needsUpdate = true;
            }
          }
        );
      } else {
        if (material.map) {
          try { material.map.dispose(); } catch { /* safe */ }
          material.map = null;
        }
        material.color.set(0x334155);
        material.metalness = 0.7;
        material.roughness = 0.35;
        material.needsUpdate = true;
      }
    }

    // ── Secondary: Source 2 PBR Data Maps (Roughness, Metalness, AO) ─────────
    // Strictly routed to roughnessMap, metalnessMap, and aoMap — NEVER material.map.
    const r2Maps = getR2WeaponTextures(effectiveWeaponName);
    if (r2Maps) {
      Promise.all([
        r2Maps.aoUrl ? loadR2Texture(r2Maps.aoUrl) : Promise.resolve(null),
        r2Maps.surfaceUrl ? loadR2Texture(r2Maps.surfaceUrl) : Promise.resolve(null),
      ])
        .then(([aoTexture, surfaceTexture]) => {
          if (isCancelled) return;

          // 1. Ambient Occlusion Map (Data map: NoColorSpace, flipY=false, RepeatWrapping)
          if (aoTexture) {
            aoTexture.flipY = false;
            aoTexture.colorSpace = THREE.NoColorSpace;
            aoTexture.wrapS = THREE.RepeatWrapping;
            aoTexture.wrapT = THREE.RepeatWrapping;
            material.aoMap = aoTexture;
            material.aoMapIntensity = 1.0;
          }

          // 2. Source 2 Surface Map (Data map: NoColorSpace, flipY=false, RepeatWrapping)
          // Strictly assigned to roughnessMap & metalnessMap with custom GLSL swizzle
          if (surfaceTexture) {
            surfaceTexture.flipY = false;
            surfaceTexture.colorSpace = THREE.NoColorSpace;
            surfaceTexture.wrapS = THREE.RepeatWrapping;
            surfaceTexture.wrapT = THREE.RepeatWrapping;
            material.roughnessMap = surfaceTexture;
            material.metalnessMap = surfaceTexture;
            applySource2SurfaceSwizzle(material);
          }

          material.needsUpdate = true;
        })
        .catch(() => { /* non-blocking */ });
    }

    return () => {
      isCancelled = true;
    };
  }, [processedScene, textureUrl, effectiveWeaponName, flipY]);

  // Clean up cloned geometries, materials, and textures on unmount or URL transition
  useEffect(() => {
    return () => {
      disposeThreeObject(processedScene.group);
      processedScene.material.dispose();
      try {
        useLoader.clear(OBJLoader, modelUrl);
      } catch {
        // Safe fallback
      }
    };
  }, [processedScene, modelUrl]);

  // Render rotated 90 degrees around Y (horizontal profile view, muzzle pointing right)
  return (
    <Center>
      <group rotation={[0, Math.PI / 2, 0]}>
        <primitive object={processedScene.group} />
      </group>
    </Center>
  );
}

/**
 * In-canvas loading spinner badge with percentage progress.
 */
function CanvasSpinner({ weaponName }: { weaponName?: string }) {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/60 shadow-2xl text-center pointer-events-none select-none min-w-[180px]">
        <div className="w-8 h-8 mb-2 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
          {weaponName ? `Loading ${weaponName}` : 'Loading 3D Model'}
        </span>
        <span className="text-[11px] font-mono text-cyan-400 mt-1">
          {progress ? `${Math.round(progress)}%` : 'Processing...'}
        </span>
      </div>
    </Html>
  );
}

/**
 * Scene controls managing OrbitControls damping, polar angle clamping,
 * zoom boundaries, and debounced auto-rotation resumption.
 */
function SceneControls({
  autoRotate,
  autoRotateSpeed,
  idleResumeDelayMs,
  enableZoom,
  minDistance,
  maxDistance,
}: {
  autoRotate: boolean;
  autoRotateSpeed: number;
  idleResumeDelayMs: number;
  enableZoom: boolean;
  minDistance: number;
  maxDistance: number;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleStart = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setIsInteracting(true);
    };

    const handleEnd = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsInteracting(false);
      }, idleResumeDelayMs);
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    const domElement = controls.domElement;
    const handleWheel = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setIsInteracting(true);
      idleTimerRef.current = setTimeout(() => {
        setIsInteracting(false);
      }, idleResumeDelayMs);
    };

    if (domElement) {
      domElement.addEventListener('wheel', handleWheel, { passive: true });
    }

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
      if (domElement) {
        domElement.removeEventListener('wheel', handleWheel);
      }
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [idleResumeDelayMs]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      enableZoom={enableZoom}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI * 0.65}
      autoRotate={autoRotate && !isInteracting}
      autoRotateSpeed={autoRotateSpeed}
    />
  );
}

/**
 * Skeleton loader rendered during SSR and initial client hydration frame.
 */
export function ModelViewerSkeleton({
  className,
  weaponName,
}: {
  className?: string;
  weaponName?: string;
}) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900/95 to-slate-950 border border-slate-800/80 shadow-2xl ${
        className || 'w-full h-80 min-h-[340px]'
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(14,165,233,0.08),transparent_60%)] animate-pulse" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-12 h-12 mb-3 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          {weaponName ? `Loading ${weaponName}...` : 'Initializing 3D Viewer...'}
        </p>
        <span className="text-[10px] text-slate-500 mt-1 font-mono">CS2 Inspect Studio</span>
      </div>
    </div>
  );
}

/**
 * Error boundary catching model fetch / parse exceptions and falling back to procedural mesh.
 */
interface ModelErrorBoundaryProps {
  children: React.ReactNode;
  effectiveUrl?: string;
  onError?: (err: Error) => void;
  fallback: React.ReactNode;
}

interface ModelErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ModelErrorBoundary extends React.Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  constructor(props: ModelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ModelErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('[ModelViewer Error Caught]', error, 'URL was:', this.props.effectiveUrl);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Interactive 3D Weapon Model Viewer component using React Three Fiber.
 * Supports Wavefront .obj CS2 models and binary .glb/.gltf models.
 * Includes studio 3-point lighting rig, OrbitControls with clamping,
 * idle auto-rotation with pause/resume, responsive container fit, and
 * full WebGL resource disposal on unmount.
 */
export default function ModelViewer({
  modelUrl,
  fallbackIconUrl: _fallbackIconUrl,
  className = 'w-full h-80 min-h-[340px]',
  autoRotate = true,
  autoRotateSpeed = 1.5,
  idleResumeDelayMs = 3000,
  enableZoom = true,
  minDistance = 1.2,
  maxDistance = 5.5,
  fov = 45,
  cameraPosition = [0, 0.4, 3.2],
  weaponName,
  showControlsHint = true,
  onLoaded,
  onError,
  float,
  seed,
  rarityColor,
  skinName,
  textureUrl,
  flipY = true,
  useLegacyModel,
}: ModelViewerProps) {
  // Two-stage SSR Hydration Guard: Avoid WebGL execution during build / server rendering
  const [isMounted, setIsMounted] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveTextureUrl = useMemo(() => {
    // If a direct textureUrl prop is given, verify it is an actual color wrap (not a data map)
    if (textureUrl) {
      return isColorWrapUrl(textureUrl) ? textureUrl : undefined;
    }
    const resolved = resolveSkinTextureUrl(weaponName, skinName);
    return resolved && isColorWrapUrl(resolved) ? resolved : undefined;
  }, [textureUrl, weaponName, skinName]);

  const effectiveUrl = useMemo(() => {
    if (modelUrl) return modelUrl;
    // Prefer the authentic /models/objs/ OBJ model with matching vt coordinates
    if (weaponName) {
      const objsPath = getObjsWeaponModelPath(weaponName);
      if (objsPath) return objsPath;
      return getWeaponModelPath(weaponName);
    }
    return undefined;
  }, [modelUrl, weaponName]);

  const isObj = effectiveUrl ? isObjModelUrl(effectiveUrl) : false;

  if (!isMounted) {
    return <ModelViewerSkeleton className={className} weaponName={weaponName} />;
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-950 to-black border border-slate-800/80 shadow-2xl select-none group ${className}`}
      onPointerDown={() => setHintVisible(false)}
    >
      {/* Background Studio Ambience */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.06),transparent_70%)]" />

      {/* React Three Fiber Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: cameraPosition, fov, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <StudioLighting />

        <ModelErrorBoundary
          key={effectiveUrl || 'fallback'}
          effectiveUrl={effectiveUrl}
          onError={onError}
          fallback={
            <Center>
              <FallbackWeaponMesh />
            </Center>
          }
        >
          <Suspense fallback={<CanvasSpinner weaponName={weaponName} />}>
            {effectiveUrl ? (
              isObj ? (
                <ObjWeaponScene
                  modelUrl={effectiveUrl}
                  textureUrl={effectiveTextureUrl}
                  weaponName={weaponName}
                  skinName={skinName}
                  float={float}
                  seed={seed}
                  rarityColor={rarityColor}
                  onLoaded={onLoaded}
                  flipY={flipY}
                />
              ) : (
                <WeaponScene modelUrl={effectiveUrl} onLoaded={onLoaded} />
              )
            ) : (
              <Center>
                <FallbackWeaponMesh />
              </Center>
            )}
          </Suspense>
        </ModelErrorBoundary>

        <SceneControls
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
          idleResumeDelayMs={idleResumeDelayMs}
          enableZoom={enableZoom}
          minDistance={minDistance}
          maxDistance={maxDistance}
        />
      </Canvas>

      {/* Interaction Hint Badge */}
      {showControlsHint && hintVisible && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-500 opacity-80 group-hover:opacity-100">
          <span className="px-3 py-1 text-[11px] font-medium tracking-wide bg-slate-900/80 backdrop-blur-md text-slate-300 rounded-full border border-slate-700/60 shadow-lg">
            Drag to rotate • Scroll to zoom
          </span>
        </div>
      )}
    </div>
  );
}

export {
  ModelViewer,
  getWeaponModelPath,
  getObjsWeaponModelPath,
  getLegacyWeaponModelPath,
  isObjModelUrl,
  WEAPON_MODEL_MAP,
  OBJS_MODEL_MAP,
  CSGO_LEGACY_MODEL_MAP,
  resolveSkinTextureUrl,
  resolveUVSheetTextureUrl,
  isDataMapUrl,
  isColorWrapUrl,
};

/**
 * Interactive test harness component for testing mounting, unmounting,
 * and WebGL resource disposal stability.
 */
export function ModelViewerToggleHarness() {
  const [mounted, setMounted] = useState(true);
  const [toggleCount, setToggleCount] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            setMounted((prev) => !prev);
            setToggleCount((c) => c + 1);
          }}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors cursor-pointer"
        >
          {mounted ? 'Unmount Viewer (Trigger Disposal)' : 'Mount Viewer (Reinitialize)'}
        </button>
        <span className="text-xs text-slate-400 font-mono">
          Status: {mounted ? 'Mounted' : 'Unmounted'} | Cycle count: {toggleCount}
        </span>
      </div>
      <div className="h-80 w-full">
        {mounted ? (
          <ModelViewer
            modelUrl="/models/placeholder-weapon.glb"
            weaponName="Disposal Stress Test Knife"
            className="w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 text-xs text-slate-500">
            ModelViewer unmounted (WebGL context &amp; buffers disposed)
          </div>
        )}
      </div>
    </div>
  );
}
