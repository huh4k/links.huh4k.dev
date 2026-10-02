import React, { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Center, useGLTF, useProgress, Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';
import * as THREE from 'three';
import { getWeaponModelPath, isObjModelUrl, WEAPON_MODEL_MAP } from '../utils/weaponModels';

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
}

/**
 * Utility to recursively dispose Three.js meshes, geometries, materials, and textures.
 */
export function disposeThreeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(mesh.material);
        }
      }
    }
  });
}

function disposeMaterial(mat: THREE.Material): void {
  const record = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value && typeof value === 'object' && 'isTexture' in value && (value as { isTexture: boolean }).isTexture) {
      (value as THREE.Texture).dispose();
    }
  }
  mat.dispose();
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

/**
 * Wavefront OBJ Scene loader for CS2 weapon models.
 * Calculates pristine vertex normals, centers geometry, normalizes scale to targetSize 2.4,
 * applies studio CS2 PBR material (metalness 0.65, roughness 0.35, #c8d1dc),
 * renders with horizontal profile rotation [0, Math.PI / 2, 0],
 * and disposes GPU resources on unmount.
 */
export function ObjWeaponScene({
  modelUrl,
  onLoaded,
}: {
  modelUrl: string;
  onLoaded?: () => void;
}) {
  const rawObj = useLoader(OBJLoader, modelUrl);
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

  const processedScene = useMemo(() => {
    const clone = rawObj.clone(true);

    // Studio CS2 Weapon PBR Material
    const weaponMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c8d1dc'), // subtle slate finish tint
      metalness: 0.65,
      roughness: 0.35,
      side: THREE.FrontSide,
    });

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          // Compute pristine vertex normals for accurate specular highlights
          mesh.geometry.computeVertexNormals();
          // Center the geometry vertices locally around (0, 0, 0)
          mesh.geometry.center();
        }
        mesh.material = weaponMaterial;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    // Scale normalization via Box3
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const targetSize = 2.4; // Uniform presentation size
      clone.scale.setScalar(targetSize / maxDim);
    }

    return { group: clone, material: weaponMaterial };
  }, [rawObj]);

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
}: ModelViewerProps) {
  // Two-stage SSR Hydration Guard: Avoid WebGL execution during build / server rendering
  const [isMounted, setIsMounted] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveUrl = useMemo(() => {
    if (modelUrl) return modelUrl;
    if (weaponName) return getWeaponModelPath(weaponName);
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
                <ObjWeaponScene modelUrl={effectiveUrl} onLoaded={onLoaded} />
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

export { ModelViewer, getWeaponModelPath, isObjModelUrl, WEAPON_MODEL_MAP };

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
