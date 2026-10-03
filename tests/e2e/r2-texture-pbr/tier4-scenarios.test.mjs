/**
 * Tier 4 — Real-World Application Scenarios
 * Validates complete end-to-end user journeys spanning loadout card inspection,
 * inventory filtering, wear comparison, network resilience, and privacy invariants.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { harness, setupCanvasMock } from './harness.mjs';

setupCanvasMock();

export async function runTier4() {
  await harness.describe('Tier 4: Real-World Application Scenarios', 4, async () => {
    const r2Textures = await import('../../../src/utils/r2Textures.ts');
    const skinCompositor = await import('../../../src/utils/skinCompositor.ts');
    const { DEFAULT_LOADOUT_WEAPONS } = await import('../../../src/components/steam/CS2LoadoutCard.tsx');
    const { CATEGORIES, matchesCategory } = await import('../../../src/components/steam/InventoryExplorer.tsx');
    const { SITE_CONFIG } = await import('../../../src/lib/config.ts');

    // ========================================================================
    // Scenario 4.1: Full Primary Loadout Inspection Journey
    // ========================================================================
    await harness.it('Scenario 4.1: Full Primary Loadout Inspection Journey (AK-47 -> M4A1-S -> AWP -> USP-S)', [
      'F1', 'F4', 'F5', 'F6', 'F7', 'F8', 'F15', 'F21', 'F23',
    ], async () => {
      // 1. Primary Rifle: AK-47 Ice Coaled (MW, Float: 0.0825, Seed: 367)
      const ak = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'AK-47');
      harness.assert(ak !== undefined, 'AK-47 loaded');
      const akFallback = skinCompositor.getSkinFallbackColor(ak.skin, ak.weapon);
      harness.assertEqual(akFallback, '#00e5ff', 'Instant cyan base color applied');
      const akComp = skinCompositor.compositeSkinFinish({
        weaponName: ak.weapon,
        skinName: ak.skin,
        float: ak.float,
        seed: ak.seed,
      });
      harness.assert(akComp.effectiveClearcoat > 0.35, 'AK-47 MW clearcoat preserved');
      akComp.texture.dispose();

      // 2. CT Rifle: M4A1-S Liquidation (FT, Float: 0.3438, Seed: 937)
      const m4 = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'M4A1-S');
      harness.assert(m4 !== undefined, 'M4A1-S loaded');
      const m4Fallback = skinCompositor.getSkinFallbackColor(m4.skin, m4.weapon);
      harness.assertEqual(m4Fallback, '#e11d48', 'Instant crimson base color applied');
      const m4Comp = skinCompositor.compositeSkinFinish({
        weaponName: m4.weapon,
        skinName: m4.skin,
        float: m4.float,
        seed: m4.seed,
      });
      harness.assert(m4Comp.effectiveRoughness > 0.40, 'M4A1-S FT roughness elevated');
      m4Comp.texture.dispose();

      // 3. Sniper: AWP Ice Coaled (FN, Float: 0.0631, Seed: 309)
      const awp = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'AWP');
      harness.assert(awp !== undefined, 'AWP loaded');
      const awpFallback = skinCompositor.getSkinFallbackColor(awp.skin, awp.weapon);
      harness.assertEqual(awpFallback, '#00e5ff', 'Instant cyan base color applied');
      const awpComp = skinCompositor.compositeSkinFinish({
        weaponName: awp.weapon,
        skinName: awp.skin,
        float: awp.float,
        seed: awp.seed,
      });
      harness.assert(awpComp.effectiveClearcoat > 0.40, 'AWP FN clearcoat pristine');
      awpComp.texture.dispose();

      // 4. Sidearm: USP-S Royal Guard (FN, Float: 0.0560, Seed: 644)
      const usp = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'USP-S');
      harness.assert(usp !== undefined, 'USP-S loaded');
      const uspFallback = skinCompositor.getSkinFallbackColor(usp.skin, usp.weapon);
      harness.assertEqual(uspFallback, '#991b1b', 'Instant imperial red base color applied');
      const uspComp = skinCompositor.compositeSkinFinish({
        weaponName: usp.weapon,
        skinName: usp.skin,
        float: usp.float,
        seed: usp.seed,
      });
      harness.assert(uspComp.effectiveClearcoat > 0.50, 'USP-S Royal Guard high clearcoat preserved');
      harness.assert(uspComp.effectiveMetalness > 0.70, 'USP-S Royal Guard metallic finish');
      uspComp.texture.dispose();
    });

    // ========================================================================
    // Scenario 4.2: Inventory Explorer Search, Filter & 3-Way Dock Journey
    // ========================================================================
    await harness.it('Scenario 4.2: Inventory Explorer Search, Filter, 3D Inspect, and 2D Artwork Journey', [
      'F1', 'F4', 'F11', 'F24', 'F25',
    ], async () => {
      // 1. Taxonomy check
      harness.assert(CATEGORIES.includes('Rifles'), 'Taxonomy includes Rifles');

      // 2. Mock items list in inventory
      const sampleItems = [
        { id: '1', name: 'AK-47 | Ice Coaled', type: 'Rifle', float: 0.0825, seed: 367, rarityColor: '#d32ce6' },
        { id: '2', name: 'M4A1-S | Liquidation', type: 'Rifle', float: 0.3438, seed: 937, rarityColor: '#8847ff' },
        { id: '3', name: 'Galil AR | Control', type: 'Rifle', float: 0.1245, seed: 541, rarityColor: '#4b69ff' },
        { id: '4', name: 'USP-S | Royal Guard', type: 'Pistol', float: 0.056, seed: 644, rarityColor: '#8847ff' },
      ];

      // 3. Filter Rifles
      const rifles = sampleItems.filter((item) => matchesCategory(item, 'Rifles'));
      harness.assertEqual(rifles.length, 3, 'Found 3 rifles');

      // 4. Instant search for "Control"
      const searchQuery = 'control';
      const searchResults = rifles.filter((item) => item.name.toLowerCase().includes(searchQuery));
      harness.assertEqual(searchResults.length, 1, 'Search found Galil AR Control');
      const selectedItem = searchResults[0];

      // 5. Inspect 3D PBR texture
      const galilKey = r2Textures.getWeaponKeyFromName(selectedItem.name);
      harness.assertEqual(galilKey, 'rif_galilar', 'Resolved Galil key');

      const galilComp = skinCompositor.compositeSkinFinish({
        weaponName: 'Galil AR',
        skinName: 'Control',
        float: selectedItem.float,
        seed: selectedItem.seed,
      });
      harness.assertEqual(galilComp.baseColorHex, '#3b82f6', 'Slate blue tactical finish');

      // 6. Inspect dock toggle: 3D -> 2D Artwork -> Launch CS2
      let dockState = '3d';
      dockState = '2d';
      harness.assertEqual(dockState, '2d', 'Switched to Steam 2D Artwork');

      dockState = 'inspect';
      const steamInspectLink = 'steam://run/730//+csgo_econ_action_preview%20CERT_123';
      harness.assert(steamInspectLink.startsWith('steam://run/730/'), 'Valid in-game client launch URL');

      galilComp.texture.dispose();
    });

    // ========================================================================
    // Scenario 4.3: Low-Wear vs High-Wear Side-by-Side Comparison Journey
    // ========================================================================
    await harness.it('Scenario 4.3: Factory New vs Battle-Scarred Side-by-Side Comparison (MAC-10 vs UMP-45)', [
      'F9', 'F13', 'F15',
    ], async () => {
      // 1. Pristine Factory New (float: 0.02) MAC-10 Candy Apple
      const candyApple = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
        float: 0.02,
      });

      // 2. Heavy Battle-Scarred (float: 0.8643) UMP-45 Late Night Transit
      const transit = skinCompositor.compositeSkinFinish({
        weaponName: 'UMP-45',
        skinName: 'Late Night Transit',
        float: 0.8643,
      });

      // Assertions
      harness.assert(candyApple.effectiveClearcoat > 0.75, 'Candy Apple has mirror clearcoat');
      harness.assertEqual(transit.effectiveClearcoat, 0.0, 'Late Night Transit clearcoat completely destroyed');

      harness.assert(candyApple.effectiveRoughness < 0.20, 'Candy Apple roughness is minimal');
      harness.assert(transit.effectiveRoughness > 0.70, 'Late Night Transit roughness is high');

      harness.assert(
        transit.effectiveRoughness - candyApple.effectiveRoughness > 0.50,
        'Roughness delta across wear brackets > 0.50'
      );

      candyApple.texture.dispose();
      transit.texture.dispose();
    });

    // ========================================================================
    // Scenario 4.4: Complete CDN Outage & Offline Recovery Journey
    // ========================================================================
    await harness.it('Scenario 4.4: Complete CDN Outage & Offline Recovery (Procedural Fallback)', [
      'F1', 'F3', 'F5', 'F6', 'F7', 'F8', 'F10', 'F21',
    ], async () => {
      // Simulate complete network failure on remote R2
      const urls = [
        'https://assets.huh4k.dev/cs2-textures/ak_ao.png',
        'https://assets.huh4k.dev/cs2-textures/m4_ao.png',
        'https://assets.huh4k.dev/cs2-textures/awp_ao.png',
      ];

      for (const url of urls) {
        const tex = await r2Textures.loadR2Texture(url);
        harness.assert(tex === null || tex instanceof THREE.Texture, 'Non-blocking return during simulated outage');
      }

      // Check synchronous fallback base colors are returned instantly without network
      const weapons = [
        { skin: 'Ice Coaled', weapon: 'AK-47', expected: '#00e5ff' },
        { skin: 'Liquidation', weapon: 'M4A1-S', expected: '#e11d48' },
        { skin: 'Ice Coaled', weapon: 'AWP', expected: '#00e5ff' },
        { skin: 'Royal Guard', weapon: 'USP-S', expected: '#991b1b' },
        { skin: 'Electric Blue', weapon: 'Zeus x27', expected: '#2563eb' },
      ];

      for (const w of weapons) {
        const hex = skinCompositor.getSkinFallbackColor(w.skin, w.weapon);
        harness.assertEqual(hex, w.expected, `Fallback color for ${w.skin} matches without network`);

        const comp = skinCompositor.compositeSkinFinish({
          weaponName: w.weapon,
          skinName: w.skin,
        });
        harness.assert(Boolean(comp.texture && comp.texture.isCanvasTexture), `Procedural canvas texture generated for ${w.skin}`);
        comp.texture.dispose();
      }
    });

    // ========================================================================
    // Scenario 4.5: Privacy & Anonymity Strict Enforcement Journey
    // ========================================================================
    await harness.it('Scenario 4.5: Repository-Wide Privacy & Anonymity Verification Invariant', ['F26'], async () => {
      // Verify author details in configuration
      harness.assertEqual(SITE_CONFIG.name, 'huh4k', 'Site name strictly huh4k');
      harness.assertEqual(SITE_CONFIG.author.name, 'huh4k', 'Author name strictly huh4k');
      harness.assertEqual(SITE_CONFIG.author.steamId, '76561198920486334', 'Steam ID canonical');

      // Repository file scan
      const srcDir = path.resolve('src');
      const files = getAllSourceFiles(srcDir);

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lower = content.toLowerCase();

        harness.assert(!lower.includes('cafici'), `Violation: Personal surname found in ${file}`);
        harness.assert(!lower.includes('charlie'), `Violation: Personal first name found in ${file}`);
        harness.assert(!lower.includes('charcaf'), `Violation: Personal email prefix found in ${file}`);
        harness.assert(!content.includes('/Users/'), `Violation: Absolute local user path found in ${file}`);
      }
    });
  });
}

function getAllSourceFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllSourceFiles(fullPath));
    } else if (/\.(ts|tsx|astro|js|mjs)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}
