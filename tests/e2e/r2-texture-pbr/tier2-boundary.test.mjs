/**
 * Tier 2 — Boundary & Corner Cases
 * Validates edge cases, hostile inputs, extreme float/seed boundaries,
 * network failure simulations, rapid switching, and fallback mechanics.
 */

import * as THREE from 'three';
import { harness, setupCanvasMock } from './harness.mjs';

setupCanvasMock();

export async function runTier2() {
  await harness.describe('Tier 2: Boundary & Corner Cases', 2, async () => {
    const r2Textures = await import('../../../src/utils/r2Textures.ts');
    const skinCompositor = await import('../../../src/utils/skinCompositor.ts');

    // ========================================================================
    // Category 1: Extreme Float Boundaries (0.00, 1.00, null, neg, overflow)
    // ========================================================================
    await harness.it('Boundary 1.1: Pristine Factory New Minimum — Float 0.00000000', ['F15', 'F5', 'F9'], async () => {
      const wear = skinCompositor.calculateEffectiveWear(0.12, 0.70, 0.85, 0.0);
      harness.assertCloseTo(wear.effectiveRoughness, 0.12, 0.001, 'Roughness matches pristine base');
      harness.assertCloseTo(wear.effectiveClearcoat, 0.85, 0.001, 'Clearcoat matches pristine base');
      harness.assertCloseTo(wear.effectiveMetalness, 0.70, 0.001, 'Metalness matches pristine base');
    });

    await harness.it('Boundary 1.2: Maximum Battle-Scarred Boundary — Float 1.00000000', ['F15', 'F13'], async () => {
      const wear = skinCompositor.calculateEffectiveWear(0.20, 0.35, 0.50, 1.0);
      harness.assertCloseTo(wear.effectiveRoughness, 0.85, 0.05, 'Roughness reaches maximum ~0.85');
      harness.assertEqual(wear.effectiveClearcoat, 0.0, 'Clearcoat is completely destroyed at float 1.00');
      harness.assert(wear.effectiveMetalness > 0.70, 'Exposed bare metal high at float 1.00');
    });

    await harness.it('Boundary 1.3: Bracket Transition Thresholds (0.07, 0.15, 0.38, 0.45)', ['F15', 'F24'], async () => {
      const fnBoundary = skinCompositor.calculateEffectiveWear(0.2, 0.3, 0.5, 0.07);
      const mwBoundary = skinCompositor.calculateEffectiveWear(0.2, 0.3, 0.5, 0.15);
      const ftBoundary = skinCompositor.calculateEffectiveWear(0.2, 0.3, 0.5, 0.38);
      const wwBoundary = skinCompositor.calculateEffectiveWear(0.2, 0.3, 0.5, 0.45);

      harness.assert(fnBoundary.effectiveRoughness < mwBoundary.effectiveRoughness, 'Roughness monotonically increases (FN -> MW)');
      harness.assert(mwBoundary.effectiveRoughness < ftBoundary.effectiveRoughness, 'Roughness monotonically increases (MW -> FT)');
      harness.assert(ftBoundary.effectiveRoughness < wwBoundary.effectiveRoughness, 'Roughness monotonically increases (FT -> WW)');
      harness.assert(fnBoundary.effectiveClearcoat > mwBoundary.effectiveClearcoat, 'Clearcoat monotonically drops');
    });

    await harness.it('Boundary 1.4: Null and Undefined Float Defaults Safely to 0.0', ['F15'], async () => {
      const wearNull = skinCompositor.calculateEffectiveWear(0.25, 0.4, 0.5, null);
      const wearUndef = skinCompositor.calculateEffectiveWear(0.25, 0.4, 0.5, undefined);
      harness.assertCloseTo(wearNull.effectiveRoughness, 0.25, 0.001);
      harness.assertCloseTo(wearUndef.effectiveRoughness, 0.25, 0.001);
      harness.assertCloseTo(wearNull.effectiveClearcoat, 0.5, 0.001);
    });

    await harness.it('Boundary 1.5: Hostile Float Values (NaN, -0.99, +999.9) are Clamped Cleanly', ['F15'], async () => {
      const wearNaN = skinCompositor.calculateEffectiveWear(0.2, 0.4, 0.5, NaN);
      const wearNeg = skinCompositor.calculateEffectiveWear(0.2, 0.4, 0.5, -0.99);
      const wearOver = skinCompositor.calculateEffectiveWear(0.2, 0.4, 0.5, 999.9);

      harness.assertCloseTo(wearNaN.effectiveRoughness, 0.2, 0.01, 'NaN clamped to 0.0');
      harness.assertCloseTo(wearNeg.effectiveRoughness, 0.2, 0.01, 'Negative clamped to 0.0');
      harness.assertCloseTo(wearOver.effectiveRoughness, 0.85, 0.05, 'Large positive clamped to 1.0');
    });

    // ========================================================================
    // Category 2: Extreme Pattern Seed Boundaries (0, 1000, null, overflow)
    // ========================================================================
    await harness.it('Boundary 2.1: Seed 0 Minimum Boundary Yields Valid Composite', ['F16', 'F5'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        seed: 0,
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid canvas texture generated with seed 0');
    });

    await harness.it('Boundary 2.2: Seed 1000 Maximum CS2 Boundary Computes Without Overflow', ['F16', 'F6'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'M4A1-S',
        skinName: 'Liquidation',
        seed: 1000,
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid canvas texture with seed 1000');
    });

    await harness.it('Boundary 2.3: Null and Undefined Seeds Default Safely to 0', ['F16', 'F8'], async () => {
      const resNull = skinCompositor.compositeSkinFinish({
        weaponName: 'USP-S',
        skinName: 'Royal Guard',
        seed: null,
      });
      const resUndef = skinCompositor.compositeSkinFinish({
        weaponName: 'USP-S',
        skinName: 'Royal Guard',
        seed: undefined,
      });
      harness.assert(resNull.texture !== null, 'Null seed handles safely');
      harness.assert(resUndef.texture !== null, 'Undefined seed handles safely');
    });

    await harness.it('Boundary 2.4: Extreme Large Seeds (>1000000) Processed Safely', ['F16'], async () => {
      const resLarge = skinCompositor.compositeSkinFinish({
        weaponName: 'Galil AR',
        skinName: 'Control',
        seed: 999999999,
      });
      harness.assert(Boolean(resLarge.texture && resLarge.texture.isCanvasTexture), 'High seed handled without memory or arithmetic error');
    });

    await harness.it('Boundary 2.5: Negative Seed Values Handled Safely', ['F16'], async () => {
      const resNeg = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
        seed: -999,
      });
      harness.assert(Boolean(resNeg.texture && resNeg.texture.isCanvasTexture), 'Negative seed handled without crash');
    });

    // ========================================================================
    // Category 3: Network Failure & 404 Simulation for R2 Textures
    // ========================================================================
    await harness.it('Boundary 3.1: 404 Simulation on AO Map Returns Null Without Unhandled Rejection', ['F3', 'F1'], async () => {
      const url = 'https://assets.huh4k.dev/cs2-textures/nonexistent_weapon_ao_404.png';
      const result = await r2Textures.loadR2Texture(url);
      harness.assert(result === null || result instanceof THREE.Texture, 'Non-blocking return for 404 texture');
    });

    await harness.it('Boundary 3.2: 404 Simulation on Surface Map Allows Graceful Fallback', ['F3', 'F1'], async () => {
      const url = 'https://assets.huh4k.dev/cs2-textures/nonexistent_surface_404.png';
      const result = await r2Textures.loadR2Texture(url);
      harness.assert(result === null || result instanceof THREE.Texture, 'Surface 404 handled gracefully');
    });

    await harness.it('Boundary 3.3: Invalid Schemes and Malformed URLs Return Null Without Crashing', ['F3'], async () => {
      const ftpResult = await r2Textures.loadR2Texture('ftp://invalid.host/texture.png');
      const malformedResult = await r2Textures.loadR2Texture('invalid-url-string-not-http');
      harness.assert(ftpResult === null || ftpResult instanceof THREE.Texture, 'FTP url handled safely');
      harness.assert(malformedResult === null || malformedResult instanceof THREE.Texture, 'Malformed url handled safely');
    });

    await harness.it('Boundary 3.4: Rapid Sequential Repeated Requests for Nonexistent Texture Do Not Crash', ['F3'], async () => {
      const url = 'https://assets.huh4k.dev/cs2-textures/repeated_404.png';
      const p1 = r2Textures.loadR2Texture(url);
      const p2 = r2Textures.loadR2Texture(url);
      const p3 = r2Textures.loadR2Texture(url);
      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      harness.assert(r1 === r2 && r2 === r3, 'Concurrent requests for same 404 URL resolve to identical result');
    });

    await harness.it('Boundary 3.5: Empty and Non-String Inputs Return Null Immediately', ['F3'], async () => {
      harness.assertEqual(await r2Textures.loadR2Texture(''), null);
      harness.assertEqual(await r2Textures.loadR2Texture(null), null);
      harness.assertEqual(await r2Textures.loadR2Texture(undefined), null);
      harness.assertEqual(await r2Textures.loadR2Texture(12345), null);
    });

    // ========================================================================
    // Category 4: Rapid Tab Switching & Unmount Memory Safety
    // ========================================================================
    await harness.it('Boundary 4.1: Rapid Successive Skin Compositing (10 cycles) Executes Cleanly', ['F5', 'F6', 'F7', 'F8', 'F9', 'F22'], async () => {
      const skins = ['Ice Coaled', 'Liquidation', 'Royal Guard', 'Candy Apple', 'Electric Blue'];
      const weapons = ['AK-47', 'M4A1-S', 'USP-S', 'MAC-10', 'Zeus x27'];

      for (let i = 0; i < 10; i++) {
        const idx = i % skins.length;
        const res = skinCompositor.compositeSkinFinish({
          weaponName: weapons[idx],
          skinName: skins[idx],
          float: i * 0.08,
          seed: i * 50,
        });
        harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), `Cycle ${i} generated valid texture`);
        res.texture.dispose();
      }
    });

    await harness.it('Boundary 4.2: Repeated Disposal of CanvasTexture Instances Reclaims Resources', ['F22'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
      });
      // First disposal
      res.texture.dispose();
      // Second disposal should be safe and idempotent
      res.texture.dispose();
      harness.assert(true, 'Repeated texture dispose() calls did not throw');
    });

    await harness.it('Boundary 4.3: Switching from Battle-Scarred (0.86) to Factory New (0.02) Restores Pristine PBR', ['F15', 'F9', 'F13'], async () => {
      const bs = skinCompositor.compositeSkinFinish({
        weaponName: 'UMP-45',
        skinName: 'Late Night Transit',
        float: 0.86,
      });
      harness.assertEqual(bs.effectiveClearcoat, 0.0, 'Clearcoat is 0.0 on Battle-Scarred');

      const fn = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
        float: 0.02,
      });
      harness.assert(fn.effectiveClearcoat > 0.75, 'Clearcoat immediately restored to > 0.75 on Factory New');
      harness.assert(fn.effectiveRoughness < 0.20, 'Roughness immediately restored to low value');
    });

    await harness.it('Boundary 4.4: MeshPhysicalMaterial Disposal Cleans Attached Textures', ['F18', 'F20', 'F22'], async () => {
      const { disposeThreeObject } = await import('../../../src/components/ModelViewer.tsx');
      const map = new THREE.Texture();
      const aoMap = new THREE.Texture();
      let mapDisposed = false;
      let aoDisposed = false;

      map.dispose = () => { mapDisposed = true; };
      aoMap.dispose = () => { aoDisposed = true; };

      const mat = new THREE.MeshPhysicalMaterial({ map, aoMap, aoMapIntensity: 1.2 });
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);

      disposeThreeObject(mesh);
      harness.assert(mapDisposed, 'Diffuse map disposed on mesh unmount');
      harness.assert(aoDisposed, 'aoMap disposed on mesh unmount');
    });

    await harness.it('Boundary 4.5: Unmounting Empty Scene Graph Node Does Not Throw', ['F22'], async () => {
      const { disposeThreeObject } = await import('../../../src/components/ModelViewer.tsx');
      const emptyNode = new THREE.Object3D();
      disposeThreeObject(emptyNode);
      harness.assert(true, 'Disposed empty Object3D without error');
    });

    // ========================================================================
    // Category 5: Collectibles & Non-Weapon Fallback Handling
    // ========================================================================
    await harness.it('Boundary 5.1: Non-Weapon Items (Medals, Pins) Return Null for R2 Weapon Maps', ['F1', 'F4'], async () => {
      const medalMaps = r2Textures.getR2WeaponTextures('2026 Service Medal');
      const pinMaps = r2Textures.getR2WeaponTextures('Aspirant Pin');
      harness.assertEqual(medalMaps, null, 'Service Medal has no R2 weapon maps');
      harness.assertEqual(pinMaps, null, 'Pin has no R2 weapon maps');
    });

    await harness.it('Boundary 5.2: Non-Weapon Items Return Null from Weapon Key Normalizer', ['F4'], async () => {
      harness.assertEqual(r2Textures.getWeaponKeyFromName('2026 Service Medal'), null);
      harness.assertEqual(r2Textures.getWeaponKeyFromName('Sticker | Liquid Fire'), null);
      harness.assertEqual(r2Textures.getWeaponKeyFromName('Music Kit | Scarlxrd: King, Scar'), null);
    });

    await harness.it('Boundary 5.3: getSkinFallbackColor for Collectibles Defaults Cleanly to Tactical Hex', ['F21'], async () => {
      const medalColor = skinCompositor.getSkinFallbackColor('', '2026 Service Medal');
      const pinColor = skinCompositor.getSkinFallbackColor('', 'Aspirant Pin');
      harness.assert(medalColor.startsWith('#'), 'Medal returns hex fallback');
      harness.assert(pinColor.startsWith('#'), 'Pin returns hex fallback');
    });

    await harness.it('Boundary 5.4: compositeSkinFinish for Unlisted Collectible Engages Generic Fallback Safely', ['F14'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Collectible',
        skinName: '2026 Service Medal',
        rarityColor: '#eb4b4b',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid composite generated for collectible');
      harness.assertEqual(res.baseColorHex, '#eb4b4b', 'Inherits rarity color');
    });

    await harness.it('Boundary 5.5: Knives ("★ Karambit | Doppler") Fallback Cleanly', ['F1', 'F4', 'F14'], async () => {
      const knifeMaps = r2Textures.getR2WeaponTextures('★ Karambit | Doppler');
      harness.assertEqual(knifeMaps, null, 'Karambit returns null for standard gun maps');

      const knifeKey = r2Textures.getWeaponKeyFromName('★ Karambit | Doppler');
      harness.assertEqual(knifeKey, null, 'Knife returns null key');

      const fallbackColor = skinCompositor.getSkinFallbackColor('Doppler', '★ Karambit', '#d32ce6');
      harness.assertEqual(fallbackColor, '#d32ce6', 'Uses rarity color for Doppler');
    });
  });
}
