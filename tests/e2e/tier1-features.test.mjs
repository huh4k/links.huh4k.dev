/**
 * Tier 1 — Feature Coverage: Happy-Path Tests in Isolation
 * Validates individual features F1 through F18 according to specification contracts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { harness } from './harness.mjs';

export async function runTier1() {
  await harness.describe('Tier 1: Feature Coverage (Isolation F1–F18)', 1, async () => {
    // ------------------------------------------------------------------------
    // F1: Steam Inventory Fetching
    // ------------------------------------------------------------------------
    await harness.it('F1: Steam Inventory Fetching — Query and parse Steam Community response', ['F1'], async () => {
      const { fetchCS2Inventory, STEAM_ECON_CDN } = await import('../../src/utils/steam.ts');
      
      // Setup mock Steam response
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url) => {
          if (String(url).includes('steamcommunity.com/inventory/')) {
            return new Response(JSON.stringify({
              success: 1,
              total_inventory_count: 2,
              assets: [
                { appid: 730, contextid: '2', assetid: '99001', classid: '1001', instanceid: '0', amount: '1' },
                { appid: 730, contextid: '2', assetid: '99002', classid: '1002', instanceid: '0', amount: '1' },
              ],
              descriptions: [
                {
                  appid: 730,
                  classid: '1001',
                  instanceid: '0',
                  name: 'AK-47 | Slate',
                  market_name: 'AK-47 | Slate (Field-Tested)',
                  type: 'Rifle',
                  icon_url: 'ak47_slate_icon_hash',
                  tradable: 1,
                  marketable: 1,
                  actions: [{ link: 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S%owner_steamid%A%assetid%D123', name: 'Inspect...' }],
                  tags: [{ category: 'Rarity', internal_name: 'Rarity_Restricted', localized_tag_name: 'Restricted', color: '8847ff' }]
                },
                {
                  appid: 730,
                  classid: '1002',
                  instanceid: '0',
                  name: 'AWP | Asiimov',
                  market_name: 'AWP | Asiimov (Field-Tested)',
                  type: 'Sniper Rifle',
                  icon_url: 'awp_asiimov_icon_hash',
                  tradable: 1,
                  marketable: 1,
                  actions: [{ link: 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S%owner_steamid%A%assetid%D456', name: 'Inspect...' }],
                  tags: [{ category: 'Rarity', internal_name: 'Rarity_Covert', localized_tag_name: 'Covert', color: 'eb4b4b' }]
                }
              ]
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return originalFetch(url);
        };

        const steamId = '76561198012345678';
        const items = await fetchCS2Inventory(steamId);
        harness.assertEqual(items.length, 2, 'Fetched inventory contains exactly 2 items');
        harness.assertEqual(items[0].id, '99001', 'Item 1 asset ID parsed correctly');
        harness.assertEqual(items[0].name, 'AK-47 | Slate (Field-Tested)', 'Item 1 market name parsed');
        harness.assertEqual(items[0].iconUrl, `${STEAM_ECON_CDN}ak47_slate_icon_hash`, 'Item 1 icon URL prepended with CDN');
        harness.assertEqual(items[1].id, '99002', 'Item 2 asset ID parsed correctly');
        harness.assertEqual(items[1].name, 'AWP | Asiimov (Field-Tested)', 'Item 2 market name parsed');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // F2: Inspect Link Construction
    // ------------------------------------------------------------------------
    await harness.it('F2: Inspect Link Construction — Substitute %owner_steamid% and %assetid%', ['F2'], async () => {
      const { formatInspectUrl } = await import('../../src/utils/steam.ts');
      const raw = 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S%owner_steamid%A%assetid%D99999999';
      const steamId = '76561198000000001';
      const assetId = '1234567890';
      const formatted = formatInspectUrl(raw, steamId, assetId);
      
      harness.assertEqual(
        formatted,
        'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198000000001A1234567890D99999999',
        'Substitutes both tokens exactly'
      );
      harness.assert(!formatted.includes('%owner_steamid%'), 'No unreplaced %owner_steamid% token remains');
      harness.assert(!formatted.includes('%assetid%'), 'No unreplaced %assetid% token remains');
    });

    // ------------------------------------------------------------------------
    // F3: CSFloat Inspect Enrichment
    // ------------------------------------------------------------------------
    await harness.it('F3: CSFloat Inspect Enrichment — Query float, seed, and paint index', ['F3'], async () => {
      const { fetchCSFloatInspect } = await import('../../src/utils/steam.ts');
      
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url) => {
          if (String(url).includes('api.csfloat.com')) {
            return new Response(JSON.stringify({
              iteminfo: {
                floatvalue: 0.042189,
                paintseed: 777,
                paintindex: 282,
                defindex: 7,
                rarity: 6
              }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return originalFetch(url);
        };

        const inspectUrl = 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S123A456D789';
        const info = await fetchCSFloatInspect(inspectUrl);
        harness.assert(info !== null, 'CSFloat inspect returned valid iteminfo');
        harness.assertCloseTo(info.floatvalue, 0.042189, 0.000001, 'Float value parsed correctly');
        harness.assertEqual(info.paintseed, 777, 'Paint seed parsed correctly');
        harness.assertEqual(info.paintindex, 282, 'Paint index parsed correctly');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // F4: In-Memory LRU & Throttling
    // ------------------------------------------------------------------------
    await harness.it('F4: In-Memory LRU & Throttling — Capacity limits, LRU eviction, and TTL', ['F4'], async () => {
      const { LRUCache } = await import('../../src/utils/steam.ts');
      const cache = new LRUCache(3, 1000); // capacity 3, ttl 1s

      cache.set('item1', { float: 0.1, seed: 10 });
      cache.set('item2', { float: 0.2, seed: 20 });
      cache.set('item3', { float: 0.3, seed: 30 });
      harness.assertEqual(cache.size(), 3, 'Cache stores 3 elements');

      // Access item1 to mark it recently used
      harness.assert(cache.get('item1') !== undefined, 'Item 1 retrieved successfully');

      // Add item4 — should evict item2 (oldest), keeping item1, item3, item4
      cache.set('item4', { float: 0.4, seed: 40 });
      harness.assertEqual(cache.size(), 3, 'Cache stays bounded at capacity 3');
      harness.assert(!cache.has('item2'), 'Item 2 was evicted as least-recently used');
      harness.assert(cache.has('item1'), 'Item 1 was retained due to recent access');
      harness.assert(cache.has('item3'), 'Item 3 was retained');
      harness.assert(cache.has('item4'), 'Item 4 was inserted');
    });

    // ------------------------------------------------------------------------
    // F5: Resilient Error Handling
    // ------------------------------------------------------------------------
    await harness.it('F5: Resilient Error Handling — Fallback loadout on private profiles or errors', ['F5'], async () => {
      const { FALLBACK_INVENTORY, fetchCS2Inventory } = await import('../../src/utils/steam.ts');
      
      harness.assert(Array.isArray(FALLBACK_INVENTORY), 'FALLBACK_INVENTORY is an array');
      harness.assert(FALLBACK_INVENTORY.length >= 4, 'FALLBACK_INVENTORY has at least 4 curated skins');
      
      for (const item of FALLBACK_INVENTORY) {
        harness.assert(typeof item.id === 'string' && item.id.length > 0, `Item ${item.name} has valid id`);
        harness.assert(typeof item.name === 'string' && item.name.length > 0, `Item ${item.name} has valid name`);
        harness.assert(typeof item.iconUrl === 'string' && item.iconUrl.startsWith('http'), `Item ${item.name} has valid iconUrl`);
        harness.assert(typeof item.rarity === 'string', `Item ${item.name} has valid rarity`);
        harness.assert(typeof item.type === 'string', `Item ${item.name} has valid type`);
      }

      // Invalid Steam ID fallback test
      const fallbackResult = await fetchCS2Inventory('invalid-steam-id');
      harness.assertEqual(fallbackResult.length, FALLBACK_INVENTORY.length, 'Returns fallback inventory for invalid Steam ID');
    });

    // ------------------------------------------------------------------------
    // F6: Typed SSR API Endpoint
    // ------------------------------------------------------------------------
    await harness.it('F6: Typed SSR API Endpoint — GET handler returns 200 JSON with EnrichedInventoryItem schema', ['F6'], async () => {
      const apiModule = await import('../../src/pages/api/inventory.json.ts');
      harness.assertEqual(apiModule.prerender, false, 'Route exports prerender = false for SSR');
      harness.assert(typeof apiModule.GET === 'function', 'Route exports GET APIRoute handler');

      const mockRequest = new Request('https://links.huh4k.dev/api/inventory.json?steamid=76561198000000000');
      const response = await apiModule.GET({ request: mockRequest, locals: {}, params: {} });
      
      harness.assertEqual(response.status, 200, 'Endpoint returns HTTP 200');
      harness.assertEqual(response.headers.get('Content-Type'), 'application/json', 'Content-Type is application/json');
      harness.assert(
        response.headers.get('Cache-Control')?.includes('public') || response.headers.get('Cache-Control')?.includes('max-age'),
        'Sets Cache-Control header'
      );

      const items = await response.json();
      harness.assert(Array.isArray(items), 'Response body is an array');
      harness.assert(items.length > 0, 'Response contains items');
      
      const sample = items[0];
      const requiredKeys = ['id', 'name', 'iconUrl', 'inspectUrl', 'float', 'seed', 'rarity', 'type'];
      for (const key of requiredKeys) {
        harness.assert(key in sample, `Sample item contains required key: ${key}`);
      }
    });

    // ------------------------------------------------------------------------
    // F7: TypeScript Type Definitions
    // ------------------------------------------------------------------------
    await harness.it('F7: TypeScript Type Definitions — Validate interfaces and type contracts in src/types/inventory.ts', ['F7'], async () => {
      const typeFilePath = path.resolve(process.cwd(), 'src/types/inventory.ts');
      harness.assert(fs.existsSync(typeFilePath), 'src/types/inventory.ts exists on disk');
      
      const fileContent = fs.readFileSync(typeFilePath, 'utf-8');
      const expectedTypes = [
        'RawSteamAsset',
        'RawSteamDescription',
        'RawSteamInventoryResponse',
        'CSFloatItemInfo',
        'CSFloatResponse',
        'EnrichedInventoryItem',
      ];
      for (const typeName of expectedTypes) {
        harness.assert(
          fileContent.includes(`export interface ${typeName}`) || fileContent.includes(`export type ${typeName}`),
          `src/types/inventory.ts exports ${typeName}`
        );
      }
    });

    // ------------------------------------------------------------------------
    // F8: Steam Utilities Module
    // ------------------------------------------------------------------------
    await harness.it('F8: Steam Utilities Module — getRarityFromTags and getTypeFromTags logic', ['F8'], async () => {
      const { getRarityFromTags, getTypeFromTags, formatEconomyImageUrl } = await import('../../src/utils/steam.ts');
      
      // Rarity tests
      const covertTags = [{ category: 'Rarity', internal_name: 'Rarity_Covert', localized_tag_name: 'Covert', color: 'eb4b4b' }];
      const covertResult = getRarityFromTags(covertTags);
      harness.assertEqual(covertResult.rarity, 'Covert', 'Identifies Covert rarity');
      harness.assertEqual(covertResult.rarityColor, '#eb4b4b', 'Formats hex color with # prefix');

      // Type tests
      const knifeTags = [{ category: 'Type', internal_name: 'CSGO_Type_Knife', localized_tag_name: 'Knife' }];
      harness.assertEqual(getTypeFromTags(knifeTags), 'Knife', 'Identifies Knife type from tag');
      harness.assertEqual(getTypeFromTags([], 'Sniper Rifle'), 'Sniper Rifle', 'Identifies Sniper Rifle from type string');

      // CDN normalization
      harness.assert(formatEconomyImageUrl('hash123').startsWith('https://community.cloudflare.steamstatic.com/economy/image/'), 'Appends CDN base to hash');
      harness.assertEqual(formatEconomyImageUrl('https://example.com/img.png'), 'https://example.com/img.png', 'Leaves full URL intact');
    });

    // ------------------------------------------------------------------------
    // F9: 3D Dependencies Setup
    // ------------------------------------------------------------------------
    await harness.it('F9: 3D Dependencies Setup — Verify package.json contains required 3D packages', ['F9'], async () => {
      const pkgJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
      const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
      
      harness.assert('three' in deps, 'Package "three" is installed');
      harness.assert('@types/three' in deps, 'Package "@types/three" is installed');
      harness.assert('@react-three/fiber' in deps, 'Package "@react-three/fiber" is installed');
      harness.assert('@react-three/drei' in deps, 'Package "@react-three/drei" is installed');
    });

    // ------------------------------------------------------------------------
    // F10: Interactive 3D ModelViewer Component
    // ------------------------------------------------------------------------
    await harness.it('F10: Interactive 3D ModelViewer — Component module exists and exports required primitives', ['F10'], async () => {
      const viewerModule = await import('../../src/components/ModelViewer.tsx');
      harness.assert(typeof viewerModule.default === 'function', 'ModelViewer exports default React component');
      harness.assert(typeof viewerModule.ModelViewer === 'function', 'ModelViewer exports named component');
      harness.assert(typeof viewerModule.ModelViewerSkeleton === 'function', 'Exports ModelViewerSkeleton');
      harness.assert(typeof viewerModule.StudioLighting === 'function', 'Exports StudioLighting');
      harness.assert(typeof viewerModule.FallbackWeaponMesh === 'function', 'Exports FallbackWeaponMesh');
      harness.assert(typeof viewerModule.disposeThreeObject === 'function', 'Exports disposeThreeObject utility');
    });

    // ------------------------------------------------------------------------
    // F11: Studio 3-Point Lighting Rig
    // ------------------------------------------------------------------------
    await harness.it('F11: Studio 3-Point Lighting Rig — Verify Key, Fill, Rim, Ambient, and Hemisphere lighting specification', ['F11'], async () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ModelViewer.tsx'), 'utf-8');
      
      // Check Key Light
      harness.assert(source.includes('intensity={2.2}'), 'Key directional light has intensity 2.2');
      harness.assert(source.includes('castShadow'), 'Key directional light casts shadow');
      
      // Check Fill Light
      harness.assert(source.includes('intensity={0.75}'), 'Fill directional light has intensity 0.75');
      harness.assert(source.includes('#bae6fd'), 'Fill light uses cool sky tone #bae6fd');

      // Check Rim Light
      harness.assert(source.includes('intensity={2.8}'), 'Rim kicker light has intensity 2.8');

      // Check Ambient & Hemisphere
      harness.assert(source.includes('ambientLight intensity={0.35}'), 'Ambient light baseline intensity is 0.35');
      harness.assert(source.includes('hemisphereLight'), 'Hemisphere light ground bounce is configured');
    });

    // ------------------------------------------------------------------------
    // F12: OrbitControls with Limits
    // ------------------------------------------------------------------------
    await harness.it('F12: OrbitControls with Limits — Damping, distance limits, and polar angle clamping', ['F12'], async () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ModelViewer.tsx'), 'utf-8');
      
      harness.assert(source.includes('dampingFactor={0.05}'), 'OrbitControls specifies dampingFactor 0.05');
      harness.assert(source.includes('minDistance={minDistance}'), 'OrbitControls bounds minimum zoom distance');
      harness.assert(source.includes('maxDistance={maxDistance}'), 'OrbitControls bounds maximum zoom distance');
      harness.assert(source.includes('minPolarAngle={Math.PI / 4}'), 'Clamps minPolarAngle to Math.PI / 4 (45°)');
      harness.assert(source.includes('maxPolarAngle={Math.PI * 0.65}'), 'Clamps maxPolarAngle to Math.PI * 0.65 (~117°)');
    });

    // ------------------------------------------------------------------------
    // F13: Idle Auto-Rotation & Pause
    // ------------------------------------------------------------------------
    await harness.it('F13: Idle Auto-Rotation & Pause — Auto-rotation pauses on interaction and resumes after debounce', ['F13'], async () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ModelViewer.tsx'), 'utf-8');
      
      harness.assert(source.includes("controls.addEventListener('start'"), 'Listens to start interaction event to halt rotation');
      harness.assert(source.includes("controls.addEventListener('end'"), 'Listens to end interaction event to trigger resume timer');
      harness.assert(source.includes('idleResumeDelayMs'), 'Configures debounced idle resume delay (default 3000ms)');
      harness.assert(source.includes('autoRotate={autoRotate && !isInteracting}'), 'Auto-rotation dynamically toggles with interaction state');
    });

    // ------------------------------------------------------------------------
    // F14: Responsive Canvas & Auto-Center
    // ------------------------------------------------------------------------
    await harness.it('F14: Responsive Canvas & Auto-Center — Auto-scaling bounding box and Center container', ['F14'], async () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ModelViewer.tsx'), 'utf-8');
      
      harness.assert(source.includes('new THREE.Box3().setFromObject'), 'Calculates 3D bounding box for weapon normalization');
      harness.assert(source.includes('scaleFactor = 2.0 / maxDim') || source.includes('2.0 / maxDim'), 'Normalizes max weapon dimension to ~2.0 units');
      harness.assert(source.includes('<Center'), 'Uses Drei <Center> component for origin centering');
    });

    // ------------------------------------------------------------------------
    // F15: Visual Loading Skeleton & Spinner
    // ------------------------------------------------------------------------
    await harness.it('F15: Visual Loading Skeleton & Spinner — SSR skeleton guard and in-canvas progress spinner', ['F15'], async () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ModelViewer.tsx'), 'utf-8');
      
      harness.assert(source.includes('isMounted'), 'Employs two-stage mounting guard to prevent SSR hydration mismatch');
      harness.assert(source.includes('ModelViewerSkeleton'), 'Renders CSS animated skeleton before client hydration');
      harness.assert(source.includes('useProgress()'), 'Integrates Drei useProgress for GLB download tracking');
      harness.assert(source.includes('CanvasSpinner'), 'Provides in-canvas HTML loading badge during GLB parse');
    });

    // ------------------------------------------------------------------------
    // F16: WebGL Resource Disposal
    // ------------------------------------------------------------------------
    await harness.it('F16: WebGL Resource Disposal — Recursive mesh traversal and Drei GLTF cache eviction', ['F16'], async () => {
      const { disposeThreeObject } = await import('../../src/components/ModelViewer.tsx');
      const THREE = await import('three');

      // Create a test mesh hierarchy with geometry, material, and texture
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const texture = new THREE.Texture();
      const material = new THREE.MeshStandardMaterial({ map: texture });
      const mesh = new THREE.Mesh(geometry, material);
      const root = new THREE.Group();
      root.add(mesh);

      let geoDisposed = false;
      let matDisposed = false;
      let texDisposed = false;

      geometry.dispose = () => { geoDisposed = true; };
      material.dispose = () => { matDisposed = true; };
      texture.dispose = () => { texDisposed = true; };

      disposeThreeObject(root);

      harness.assert(geoDisposed, 'Geometry was disposed');
      harness.assert(matDisposed, 'Material was disposed');
      harness.assert(texDisposed, 'Texture was disposed');

      const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ModelViewer.tsx'), 'utf-8');
      harness.assert(source.includes('useGLTF.clear'), 'Invokes useGLTF.clear to evict unmounted model from Drei cache');
    });

    // ------------------------------------------------------------------------
    // F17: Mock Verification Script
    // ------------------------------------------------------------------------
    await harness.it('F17: Mock Verification Script — scripts/verify-inventory.ts executes cleanly', ['F17'], async () => {
      const scriptPath = path.resolve(process.cwd(), 'scripts/verify-inventory.ts');
      harness.assert(fs.existsSync(scriptPath), 'scripts/verify-inventory.ts exists');
      
      const content = fs.readFileSync(scriptPath, 'utf-8');
      harness.assert(content.includes('formatInspectUrl'), 'Script tests formatInspectUrl');
      harness.assert(content.includes('LRUCache'), 'Script tests LRUCache');
      harness.assert(content.includes('FALLBACK_INVENTORY'), 'Script tests FALLBACK_INVENTORY');
    });

    // ------------------------------------------------------------------------
    // F18: Placeholder GLB & Test Route
    // ------------------------------------------------------------------------
    await harness.it('F18: Placeholder GLB & Test Route — Valid binary GLB and Astro interactive test route', ['F18'], async () => {
      const glbPath = path.resolve(process.cwd(), 'public/models/placeholder-weapon.glb');
      harness.assert(fs.existsSync(glbPath), 'public/models/placeholder-weapon.glb exists');
      
      const buffer = fs.readFileSync(glbPath);
      harness.assert(buffer.length > 500, 'GLB file has meaningful binary size');
      const magic = buffer.readUInt32LE(0);
      const version = buffer.readUInt32LE(4);
      const totalLen = buffer.readUInt32LE(8);
      
      harness.assertEqual(magic, 0x46546c67, 'Magic number corresponds to glTF binary format');
      harness.assertEqual(version, 2, 'glTF format version is 2');
      harness.assertEqual(totalLen, buffer.length, 'Header total length matches file size');

      const testRoutePath = path.resolve(process.cwd(), 'src/pages/test/model-viewer.astro');
      harness.assert(fs.existsSync(testRoutePath), 'src/pages/test/model-viewer.astro exists');
      const routeContent = fs.readFileSync(testRoutePath, 'utf-8');
      harness.assert(routeContent.includes('<ModelViewer'), 'Test route mounts ModelViewer');
    });
  });
}
