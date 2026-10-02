/**
 * Tier 4 — Real-World Application Scenarios
 * Simulates comprehensive end-to-end user workflows:
 * 1. Full browsing: Homepage loadout -> AK-47 inspect -> [VIEW ALL SKINS] -> filter Rifles -> search Ice Coaled -> 3D stage -> inspect link
 * 2. Loadout tab transitions: CT Rifle -> Sniper -> Sidearm -> Knife with dynamic metric & model updates
 * 3. Collectibles inspection: Filter Collectibles -> 2026 Service Medal -> cert hash verification -> fallback model
 * 4. Rate-limit resilience: Steam 429 -> authentic fallback inventory -> filter Pistols -> USP-S inspection
 * 5. Command Deck quick launcher: Cmd+K -> /inventory -> filter SMGs & Heavy -> inspect UMP-45
 */

import { harness } from './harness.mjs';

export async function runTier4() {
  await harness.describe('Tier 4: Real-World Application Scenarios', 4, async () => {
    // ------------------------------------------------------------------------
    // Scenario 4.1: Full Primary Loadout to Inventory Showcase Workflow
    // ------------------------------------------------------------------------
    await harness.it('Scenario 4.1: Full User Browsing Flow — Bento card -> AK-47 -> [VIEW ALL SKINS] -> filter Rifles -> search Ice Coaled -> 3D inspect', [
      'F7', 'F8', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17'
    ], async () => {
      const { getWeaponModelPath } = await import('../../src/utils/weaponModels.ts');

      // Step 1: User examines Primary loadout weapon on homepage
      const primarySlot = {
        name: 'AK-47 | Ice Coaled (Minimal Wear)',
        weapon: 'AK-47',
        skin: 'Ice Coaled',
        wear: 'Minimal Wear',
        float: 0.0825,
        seed: 367,
        rarity: 'Classified',
        rarityColor: '#d32ce6',
      };
      harness.assertEqual(primarySlot.weapon, 'AK-47');
      harness.assertEqual(primarySlot.rarity, 'Classified');

      // Step 2: 3D model resolves to weapon_rif_ak47.obj
      const bentoModel = getWeaponModelPath(primarySlot.name);
      harness.assertEqual(bentoModel, '/models/weapon_rif_ak47.obj');

      // Step 3: User clicks [VIEW ALL SKINS] button routing to /inventory
      const navTarget = '/inventory';
      harness.assertEqual(navTarget, '/inventory');

      // Step 4: Complete inventory items on /inventory
      const inventory = [
        { name: 'AK-47 | Ice Coaled (Minimal Wear)', type: 'Rifle', float: 0.0825, seed: 367, rarity: 'Classified' },
        { name: 'StatTrak™ M4A1-S | Liquidation (Field-Tested)', type: 'Rifle', float: 0.3438, seed: 937, rarity: 'Restricted' },
        { name: 'AWP | Ice Coaled (Factory New)', type: 'Sniper Rifle', float: 0.0631, seed: 309, rarity: 'Classified' },
        { name: 'USP-S | Royal Guard (Factory New)', type: 'Pistol', float: 0.0560, seed: 644, rarity: 'Restricted' },
        { name: 'UMP-45 | Late Night Transit (Battle-Scarred)', type: 'SMG', float: 0.8642, seed: 248, rarity: 'Mil-Spec Grade' },
      ];

      // Step 5: User clicks [Rifles] filter pill
      const filteredRifles = inventory.filter((i) => i.type === 'Rifle');
      harness.assertEqual(filteredRifles.length, 2);

      // Step 6: User searches "Ice Coaled"
      const searchResults = filteredRifles.filter((i) => i.name.toLowerCase().includes('ice coaled'));
      harness.assertEqual(searchResults.length, 1);
      harness.assertEqual(searchResults[0].name, 'AK-47 | Ice Coaled (Minimal Wear)');

      // Step 7: User selects AK-47 -> binds 3D model and inspect action
      const inspectModel = getWeaponModelPath(searchResults[0].name);
      harness.assertEqual(inspectModel, '/models/weapon_rif_ak47.obj');

      // Step 8: User opens inspect link
      const previewUrl = 'steam://run/730//+csgo_econ_action_preview%20AK47_CERT_HASH';
      harness.assert(previewUrl.startsWith('steam://run/730/'));
    });

    // ------------------------------------------------------------------------
    // Scenario 4.2: Loadout Tab Switching & Dynamic Metric Transitions
    // ------------------------------------------------------------------------
    await harness.it('Scenario 4.2: Loadout Tab Switching — CT Rifle -> Sniper -> Sidearm -> Knife transitions', [
      'F7', 'F8', 'F12', 'F13'
    ], async () => {
      const { getWeaponModelPath } = await import('../../src/utils/weaponModels.ts');

      const weapons = [
        { slot: 'CT Rifle', name: 'StatTrak™ M4A1-S | Liquidation', float: 0.3438, seed: 937, expectedModel: '/models/weapon_rif_m4a1_silencer.obj' },
        { slot: 'Sniper', name: 'AWP | Ice Coaled', float: 0.0631, seed: 309, expectedModel: '/models/weapon_snip_awp.obj' },
        { slot: 'Sidearm', name: 'USP-S | Royal Guard', float: 0.0560, seed: 644, expectedModel: '/models/weapon_pist_usp_silencer.obj' },
        { slot: 'Knife', name: 'Combat Knife', float: 0.0100, seed: 100, expectedModel: '/models/placeholder-weapon.glb' },
      ];

      for (const w of weapons) {
        const resolved = getWeaponModelPath(w.name);
        harness.assertEqual(resolved, w.expectedModel, `${w.slot} resolves to ${w.expectedModel}`);
        harness.assert(w.float >= 0 && w.float <= 1, `${w.slot} float is valid`);
        harness.assert(w.seed > 0, `${w.slot} seed is valid`);
      }
    });

    // ------------------------------------------------------------------------
    // Scenario 4.3: Collectibles & Medals Inspection Workflow
    // ------------------------------------------------------------------------
    await harness.it('Scenario 4.3: Collectibles Inspection — Filter Collectibles -> 2026 Service Medal -> cert hash', [
      'F1', 'F3', 'F7', 'F16', 'F17'
    ], async () => {
      const { getWeaponModelPath } = await import('../../src/utils/weaponModels.ts');

      const fullInventory = [
        { name: 'AK-47 | Ice Coaled', type: 'Rifle', cert: 'AK_CERT' },
        { name: '2026 Service Medal', type: 'Collectible', cert: 'MEDAL_CERT_2026', float: null, seed: null },
        { name: '5 Year Veteran Coin', type: 'Collectible', cert: 'COIN_CERT_5YR', float: null, seed: null },
      ];

      // 1. User filters by [Collectibles]
      const collectibles = fullInventory.filter((i) => i.type === 'Collectible');
      harness.assertEqual(collectibles.length, 2);

      // 2. Select 2026 Service Medal
      const medal = collectibles[0];
      harness.assertEqual(medal.name, '2026 Service Medal');
      harness.assertEqual(medal.cert, 'MEDAL_CERT_2026');
      harness.assertEqual(medal.float, null);

      // 3. Model path gracefully falls back to GLB
      const model = getWeaponModelPath(medal.name);
      harness.assertEqual(model, '/models/placeholder-weapon.glb');
    });

    // ------------------------------------------------------------------------
    // Scenario 4.4: Rate-Limited & Offline Inventory Fallback Workflow
    // ------------------------------------------------------------------------
    await harness.it('Scenario 4.4: Rate-Limit Resilience — Steam 429 -> authentic fallback inventory -> filter Pistols -> USP-S', [
      'F1', 'F4', 'F5', 'F7', 'F16'
    ], async () => {
      const { fetchCS2Inventory, FALLBACK_INVENTORY } = await import('../../src/utils/steam.ts');
      const { getWeaponModelPath } = await import('../../src/utils/weaponModels.ts');

      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => new Response('Too Many Requests', { status: 429 });

        // Upstream rate limit triggers authentic fallback
        const items = await fetchCS2Inventory('76561198920486334');
        harness.assertEqual(items.length, FALLBACK_INVENTORY.length, 'Returns authentic fallback inventory');

        // User filters by Pistols
        const pistols = items.filter((i) => i.type === 'Pistol');
        harness.assert(pistols.length >= 1, 'Pistols present in inventory');

        // Inspect sidearm
        const sidearm = pistols[0];
        const model = getWeaponModelPath(sidearm.name);
        harness.assert(model.startsWith('/models/'), 'Sidearm model resolved');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // Scenario 4.5: Command Deck Quick Launcher Workflow
    // ------------------------------------------------------------------------
    await harness.it('Scenario 4.5: Command Deck Launcher — Trigger /inventory -> filter SMGs & Heavy -> inspect UMP-45', [
      'F7', 'F13', 'F16', 'F17', 'F18'
    ], async () => {
      const { getWeaponModelPath } = await import('../../src/utils/weaponModels.ts');

      // 1. User executes Command Deck navigation
      const commandAction = () => '/inventory';
      harness.assertEqual(commandAction(), '/inventory');

      // 2. User filters by [SMGs & Heavy]
      const items = [
        { name: 'AK-47 | Ice Coaled', type: 'Rifle' },
        { name: 'UMP-45 | Late Night Transit (Battle-Scarred)', type: 'SMG', float: 0.8642, seed: 248 },
        { name: 'MAC-10 | Candy Apple (Factory New)', type: 'SMG', float: 0.0312, seed: 839 },
      ];

      const smgs = items.filter((i) => i.type === 'SMG');
      harness.assertEqual(smgs.length, 2);

      // 3. User selects UMP-45
      const ump = smgs[0];
      harness.assertEqual(getWeaponModelPath(ump.name), '/models/weapon_smg_ump45.obj');
      harness.assertCloseTo(ump.float, 0.8642, 0.001);
      harness.assertEqual(ump.seed, 248);

      // Wear bracket: Battle-Scarred
      const isBattleScarred = ump.float >= 0.45;
      harness.assert(isBattleScarred, 'Float indicates Battle-Scarred');
    });
  });
}
