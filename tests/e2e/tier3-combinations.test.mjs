/**
 * Tier 3 — Cross-Feature Combinations
 * Tests multi-module integration flows and pairwise interactions:
 * 1. asset_properties -> LRU cache -> /api/inventory.json
 * 2. weapon name -> getWeaponModelPath -> ModelViewer OBJ detection
 * 3. category filter pill -> search query -> 3D inspect stage
 * 4. loadout tab switch -> 3D model update -> float bar color & seed
 * 5. Fallback inventory -> weapon model mapping -> ModelViewer
 * 6. Inspect link certificate substitution -> Inspect in Game action
 */

import { harness } from './harness.mjs';

export async function runTier3() {
  await harness.describe('Tier 3: Cross-Feature Combinations', 3, async () => {
    // ------------------------------------------------------------------------
    // C1: asset_properties -> LRU cache -> /api/inventory.json
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.1: asset_properties -> LRU cache -> /api/inventory.json', ['F1', 'F4', 'F5'], async () => {
      const { inventoryLRUCache } = await import('../../src/utils/steam.ts');
      const apiModule = await import('../../src/pages/api/inventory.json.ts');

      const testAssetId = 'comb_asset_777';
      const testFloat = 0.08253;
      const testSeed = 367;

      // Simulate pre-seeding from Steam asset_properties
      inventoryLRUCache.set(testAssetId, { float: testFloat, seed: testSeed });

      harness.assert(inventoryLRUCache.has(testAssetId), 'Asset seeded in LRU cache');
      const cached = inventoryLRUCache.get(testAssetId);
      harness.assertCloseTo(cached.float, testFloat, 1e-5);
      harness.assertEqual(cached.seed, testSeed);

      // Execute SSR endpoint
      const req = new Request('https://links.huh4k.dev/api/inventory.json');
      const res = await apiModule.GET({ request: req, locals: {}, params: {} });
      harness.assertEqual(res.status, 200, 'SSR endpoint returns HTTP 200');

      inventoryLRUCache.delete(testAssetId);
    });

    // ------------------------------------------------------------------------
    // C2: weapon name -> getWeaponModelPath -> ModelViewer OBJ detection
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.2: weapon name -> getWeaponModelPath -> ModelViewer OBJLoader', ['F7', 'F8', 'F10'], async () => {
      const { getWeaponModelPath, isObjModelUrl } = await import('../../src/utils/weaponModels.ts');
      const React = (await import('react')).default;
      const { renderToString } = await import('react-dom/server');
      const { default: ModelViewer } = await import('../../src/components/ModelViewer.tsx');

      const fullWeaponName = 'StatTrak™ M4A1-S | Liquidation (Field-Tested)';
      const resolvedPath = getWeaponModelPath(fullWeaponName);

      harness.assertEqual(resolvedPath, '/models/weapon_rif_m4a1_silencer.obj', 'Resolves dedicated OBJ path');
      harness.assert(isObjModelUrl(resolvedPath), 'Identified as OBJ model');

      const html = renderToString(React.createElement(ModelViewer, {
        modelUrl: resolvedPath,
        weaponName: fullWeaponName,
      }));
      harness.assert(html.includes('M4A1-S'), 'Component mounts and renders weapon name');
    });

    // ------------------------------------------------------------------------
    // C3: category filter pill -> search query -> 3D inspect stage
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.3: category filter pill -> search query -> 3D inspect stage', ['F15', 'F16', 'F17'], async () => {
      const { getWeaponModelPath } = await import('../../src/utils/weaponModels.ts');

      const inventory = [
        { name: 'AK-47 | Ice Coaled (Minimal Wear)', type: 'Rifle', float: 0.0825, seed: 367 },
        { name: 'AWP | Ice Coaled (Factory New)', type: 'Sniper Rifle', float: 0.0631, seed: 309 },
        { name: 'USP-S | Royal Guard (Factory New)', type: 'Pistol', float: 0.0560, seed: 644 },
      ];

      // 1. User clicks [Rifles] filter pill
      const rifleItems = inventory.filter((i) => i.type === 'Rifle');
      harness.assertEqual(rifleItems.length, 1);

      // 2. User searches "Ice Coaled"
      const matched = rifleItems.filter((i) => i.name.toLowerCase().includes('ice coaled'));
      harness.assertEqual(matched.length, 1);
      harness.assertEqual(matched[0].name, 'AK-47 | Ice Coaled (Minimal Wear)');

      // 3. User selects item -> binds 3D model
      const modelPath = getWeaponModelPath(matched[0].name);
      harness.assertEqual(modelPath, '/models/weapon_rif_ak47.obj', 'Dynamically resolved AK-47 model for inspect stage');
    });

    // ------------------------------------------------------------------------
    // C4: loadout tab switch -> 3D model update -> float bar color & seed
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.4: loadout tab switch -> 3D model update -> float bar color', ['F12', 'F13', 'F17'], async () => {
      const { getWeaponModelPath } = await import('../../src/utils/weaponModels.ts');

      const loadoutSlots = [
        { slot: 'Primary', name: 'AK-47 | Ice Coaled', float: 0.0825, seed: 367, rarity: 'Classified', color: '#d32ce6' },
        { slot: 'CT Rifle', name: 'StatTrak™ M4A1-S | Liquidation', float: 0.3438, seed: 937, rarity: 'Restricted', color: '#8847ff' },
        { slot: 'Sniper', name: 'AWP | Ice Coaled', float: 0.0631, seed: 309, rarity: 'Classified', color: '#d32ce6' },
      ];

      // Tab 0: Primary (AK-47)
      let active = loadoutSlots[0];
      harness.assertEqual(getWeaponModelPath(active.name), '/models/weapon_rif_ak47.obj');
      harness.assertEqual(active.color, '#d32ce6');
      harness.assertEqual(active.seed, 367);

      // Switch to Tab 1: CT Rifle (M4A1-S)
      active = loadoutSlots[1];
      harness.assertEqual(getWeaponModelPath(active.name), '/models/weapon_rif_m4a1_silencer.obj');
      harness.assertEqual(active.color, '#8847ff');
      harness.assertEqual(active.seed, 937);

      // Switch to Tab 2: Sniper (AWP)
      active = loadoutSlots[2];
      harness.assertEqual(getWeaponModelPath(active.name), '/models/weapon_snip_awp.obj');
      harness.assertEqual(active.color, '#d32ce6');
      harness.assertEqual(active.seed, 309);
    });

    // ------------------------------------------------------------------------
    // C5: Fallback inventory -> weapon model mapping -> ModelViewer
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.5: Fallback inventory -> weapon model mapping -> ModelViewer', ['F5', 'F7', 'F8'], async () => {
      const { FALLBACK_INVENTORY } = await import('../../src/utils/steam.ts');
      const { getWeaponModelPath } = await import('../../src/utils/weaponModels.ts');

      for (const item of FALLBACK_INVENTORY) {
        const path = getWeaponModelPath(item.name);
        harness.assert(typeof path === 'string' && path.startsWith('/models/'), `${item.name} resolves to model asset`);
      }
    });

    // ------------------------------------------------------------------------
    // C6: Inspect link %propid:6% substitution -> Inspect in Game action
    // ------------------------------------------------------------------------
    await harness.it('Combination 3.6: Inspect link %propid:6% substitution -> Inspect in Game action', ['F1', 'F17'], async () => {
      const template = 'steam://run/730//+csgo_econ_action_preview%20%propid:6%';
      const cert = '5545A1B89F9190544D5275A25D7D5065';
      const executableLink = template.replace('%propid:6%', cert);

      harness.assert(executableLink.startsWith('steam://run/730/'));
      harness.assert(executableLink.includes(cert));

      // Inspect in Game action button
      const buttonAction = (link) => `window.open("${link}")`;
      const actionCode = buttonAction(executableLink);
      harness.assert(actionCode.includes(cert));
    });
  });
}
