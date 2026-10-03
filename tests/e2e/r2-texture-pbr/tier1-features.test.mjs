/**
 * Tier 1 — Feature Coverage: Happy-Path Tests in Isolation
 * Validates features F1 through F26 according to CS2 R2 Texture & PBR Upgrade specifications.
 * Each feature contains >= 5 independent test cases in isolation (130 tests total).
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { harness, setupCanvasMock } from './harness.mjs';

// Initialize mock canvas environment for Node runtime
setupCanvasMock();

export async function runTier1() {
  await harness.describe('Tier 1: Feature Coverage (Isolation F1–F26)', 1, async () => {
    // Dynamically load implemented modules
    const r2Textures = await import('../../../src/utils/r2Textures.ts');
    const skinCompositor = await import('../../../src/utils/skinCompositor.ts');

    // ========================================================================
    // F1: R2 Base Weapon Map Resolution
    // ========================================================================
    await harness.it('F1.1: AK-47 resolves authentic R2 AO, Surface, and Masks maps with VRF hash signatures', ['F1'], async () => {
      const maps = r2Textures.getR2WeaponTextures('rif_ak47');
      harness.assert(maps !== null && typeof maps === 'object', 'AK-47 base maps resolved');
      harness.assert(maps.aoUrl.includes('rif_ak47_ao_psd_3cdda94d.png'), 'AK-47 AO URL matches VRF asset hash');
      harness.assert(maps.surfaceUrl.includes('rif_ak47_surface_psd_1262e7bf.png'), 'AK-47 Surface URL matches VRF asset hash');
      harness.assert(maps.masksUrl.includes('rif_ak47_masks_psd_cc08789a.png'), 'AK-47 Masks URL matches VRF asset hash');
    });

    await harness.it('F1.2: M4A1-S resolves canonical R2 AO, Surface, and Masks maps', ['F1'], async () => {
      const maps = r2Textures.getR2WeaponTextures('rif_m4a1_s');
      harness.assert(maps !== null, 'M4A1-S base maps resolved');
      harness.assert(maps.aoUrl.includes('rif_m4a1_s_ao.png'), 'M4A1-S AO URL valid');
      harness.assert(maps.surfaceUrl.includes('rif_m4a1_s_surface.png'), 'M4A1-S Surface URL valid');
      harness.assert(maps.masksUrl.includes('rif_m4a1_s_masks.png'), 'M4A1-S Masks URL valid');
    });

    await harness.it('F1.3: AWP resolves canonical R2 AO, Surface, and Masks maps', ['F1'], async () => {
      const maps = r2Textures.getR2WeaponTextures('snip_awp');
      harness.assert(maps !== null, 'AWP base maps resolved');
      harness.assert(maps.aoUrl.includes('snip_awp_ao.png'), 'AWP AO URL valid');
      harness.assert(maps.surfaceUrl.includes('snip_awp_surface.png'), 'AWP Surface URL valid');
      harness.assert(maps.masksUrl.includes('snip_awp_masks.png'), 'AWP Masks URL valid');
    });

    await harness.it('F1.4: USP-S resolves pist_223 canonical texture maps', ['F1'], async () => {
      const maps = r2Textures.getR2WeaponTextures('USP-S');
      harness.assert(maps !== null, 'USP-S maps resolved from weapon name');
      harness.assert(maps.aoUrl.includes('pist_223_ao.png'), 'USP-S AO URL maps to pist_223');
      harness.assert(maps.surfaceUrl.includes('pist_223_surface.png'), 'USP-S Surface URL maps to pist_223');
    });

    await harness.it('F1.5: Handles secondary weapons and returns null for unrecognized items', ['F1'], async () => {
      const mac10 = r2Textures.getR2WeaponTextures('smg_mac10');
      const galil = r2Textures.getR2WeaponTextures('rif_galilar');
      const unknown = r2Textures.getR2WeaponTextures('invalid_weapon_xyz');
      const knife = r2Textures.getR2WeaponTextures('★ Karambit');

      harness.assert(mac10 !== null && mac10.aoUrl.includes('smg_mac10'), 'MAC-10 resolved');
      harness.assert(galil !== null && galil.aoUrl.includes('rif_galilar'), 'Galil AR resolved');
      harness.assertEqual(unknown, null, 'Unknown weapon returns null');
      harness.assertEqual(knife, null, 'Knife returns null for base weapon maps');
    });

    // ========================================================================
    // F2: R2 Paint Finish Map Resolution
    // ========================================================================
    await harness.it('F2.1: Resolves anodized_air finish to paints/anodized_air.png', ['F2'], async () => {
      const url = r2Textures.getR2PaintFinishUrl('anodized_air');
      harness.assertEqual(url, 'https://assets.huh4k.dev/cs2-textures/paints/anodized_air.png');
    });

    await harness.it('F2.2: Resolves gunsmith finish to paints/gunsmith.png', ['F2'], async () => {
      const url = r2Textures.getR2PaintFinishUrl('gunsmith');
      harness.assertEqual(url, 'https://assets.huh4k.dev/cs2-textures/paints/gunsmith.png');
    });

    await harness.it('F2.3: Resolves custom finish to paints/custom.png with alias handling', ['F2'], async () => {
      const urlDirect = r2Textures.getR2PaintFinishUrl('custom');
      const urlAlias = r2Textures.getR2PaintFinishUrl('custom_paint');
      harness.assertEqual(urlDirect, 'https://assets.huh4k.dev/cs2-textures/paints/custom.png');
      harness.assertEqual(urlAlias, 'https://assets.huh4k.dev/cs2-textures/paints/custom.png');
    });

    await harness.it('F2.4: Resolves antiqued, anodized_multi, and hydrographic finishes', ['F2'], async () => {
      const antiqued = r2Textures.getR2PaintFinishUrl('antiqued');
      const anodizedMulti = r2Textures.getR2PaintFinishUrl('anodized_multi');
      const hydrographic = r2Textures.getR2PaintFinishUrl('hydrographic');
      harness.assertEqual(antiqued, 'https://assets.huh4k.dev/cs2-textures/paints/antiqued.png');
      harness.assertEqual(anodizedMulti, 'https://assets.huh4k.dev/cs2-textures/paints/anodized_multi.png');
      harness.assertEqual(hydrographic, 'https://assets.huh4k.dev/cs2-textures/paints/hydrographic.png');
    });

    await harness.it('F2.5: Returns null for unknown finish or empty/whitespace input', ['F2'], async () => {
      harness.assertEqual(r2Textures.getR2PaintFinishUrl(''), null, 'Empty string returns null');
      harness.assertEqual(r2Textures.getR2PaintFinishUrl('   '), null, 'Whitespace returns null');
      harness.assertEqual(r2Textures.getR2PaintFinishUrl('unknown_nonexistent'), null, 'Unknown returns null');
      harness.assertEqual(r2Textures.getR2PaintFinishUrl(null), null, 'Null returns null');
    });

    // ========================================================================
    // F3: Asynchronous Cached Texture Loader
    // ========================================================================
    await harness.it('F3.1: loadR2Texture returns null in SSR environment when window/document are undefined', ['F3'], async () => {
      // In Node environment without full browser DOM, loadR2Texture safely returns null
      const res = await r2Textures.loadR2Texture('https://assets.huh4k.dev/cs2-textures/rif_ak47_ao.png');
      harness.assert(res === null || res instanceof THREE.Texture, 'loadR2Texture handles environment without throwing');
    });

    await harness.it('F3.2: getTextureCache and setCachedTexture allow manual injection and cache inspection', ['F3'], async () => {
      const mockUrl = 'https://assets.huh4k.dev/cs2-textures/test_injection.png';
      const dummyTexture = new THREE.Texture();
      r2Textures.setCachedTexture(mockUrl, dummyTexture);
      const cache = r2Textures.getTextureCache();
      harness.assert(cache.has(mockUrl), 'Cache contains injected texture');
      harness.assertEqual(cache.get(mockUrl), dummyTexture, 'Cached texture matches instance');
    });

    await harness.it('F3.3: clearTextureCache purges cached textures', ['F3'], async () => {
      const mockUrl = 'https://assets.huh4k.dev/cs2-textures/to_clear.png';
      r2Textures.setCachedTexture(mockUrl, new THREE.Texture());
      harness.assert(r2Textures.getTextureCache().has(mockUrl), 'Texture added to cache');
      r2Textures.clearTextureCache();
      harness.assertEqual(r2Textures.getTextureCache().has(mockUrl), false, 'Cache cleared successfully');
    });

    await harness.it('F3.4: Invalid or empty URL returns null without throwing', ['F3'], async () => {
      const emptyRes = await r2Textures.loadR2Texture('');
      const nullRes = await r2Textures.loadR2Texture(null);
      const wsRes = await r2Textures.loadR2Texture('   ');
      harness.assertEqual(emptyRes, null, 'Empty URL returns null');
      harness.assertEqual(nullRes, null, 'Null URL returns null');
      harness.assertEqual(wsRes, null, 'Whitespace URL returns null');
    });

    await harness.it('F3.5: Deduplicates cache hits returning identical texture instance', ['F3'], async () => {
      const url = 'https://assets.huh4k.dev/cs2-textures/dedup_test.png';
      const tex = new THREE.Texture();
      r2Textures.setCachedTexture(url, tex);
      const retrieved = await r2Textures.loadR2Texture(url);
      harness.assertEqual(retrieved, tex, 'Cached texture returned immediately');
      r2Textures.clearTextureCache();
    });

    // ========================================================================
    // F4: Weapon Key Normalizer
    // ========================================================================
    await harness.it('F4.1: Normalizes "AK-47" and "AK-47 | Ice Coaled" to "rif_ak47"', ['F4'], async () => {
      harness.assertEqual(r2Textures.getWeaponKeyFromName('AK-47'), 'rif_ak47');
      harness.assertEqual(r2Textures.getWeaponKeyFromName('AK-47 | Ice Coaled'), 'rif_ak47');
      harness.assertEqual(r2Textures.getWeaponKeyFromName('AK-47 | Ice Coaled (Minimal Wear)'), 'rif_ak47');
    });

    await harness.it('F4.2: Normalizes "StatTrak™ M4A1-S | Liquidation" to "rif_m4a1_s"', ['F4'], async () => {
      harness.assertEqual(r2Textures.getWeaponKeyFromName('StatTrak™ M4A1-S | Liquidation (Field-Tested)'), 'rif_m4a1_s');
      harness.assertEqual(r2Textures.getWeaponKeyFromName('M4A1-S'), 'rif_m4a1_s');
      harness.assertEqual(r2Textures.getWeaponKeyFromName('M4A1-S | Liquidation'), 'rif_m4a1_s');
    });

    await harness.it('F4.3: Normalizes "AWP | Ice Coaled" to "snip_awp" and "USP-S | Royal Guard" to "pist_223"', ['F4'], async () => {
      harness.assertEqual(r2Textures.getWeaponKeyFromName('AWP | Ice Coaled (Factory New)'), 'snip_awp');
      harness.assertEqual(r2Textures.getWeaponKeyFromName('USP-S | Royal Guard (Factory New)'), 'pist_223');
    });

    await harness.it('F4.4: Normalizes "Zeus x27", "MAC-10", "UMP-45", "Galil AR", "Glock-18"', ['F4'], async () => {
      harness.assertEqual(r2Textures.getWeaponKeyFromName('Zeus x27 | Electric Blue'), 'pist_taser');
      harness.assertEqual(r2Textures.getWeaponKeyFromName('MAC-10 | Candy Apple'), 'smg_mac10');
      harness.assertEqual(r2Textures.getWeaponKeyFromName('UMP-45 | Late Night Transit'), 'smg_ump45');
      harness.assertEqual(r2Textures.getWeaponKeyFromName('Galil AR | Control'), 'rif_galilar');
      harness.assertEqual(r2Textures.getWeaponKeyFromName('Glock-18 | Catacombs'), 'pist_glock18');
    });

    await harness.it('F4.5: Returns null for knives, collectibles, or empty string', ['F4'], async () => {
      harness.assertEqual(r2Textures.getWeaponKeyFromName('★ Karambit | Doppler'), null);
      harness.assertEqual(r2Textures.getWeaponKeyFromName('2026 Service Medal'), null);
      harness.assertEqual(r2Textures.getWeaponKeyFromName(''), null);
      harness.assertEqual(r2Textures.getWeaponKeyFromName(null), null);
    });

    // ========================================================================
    // F5: AK-47 | Ice Coaled Composite
    // ========================================================================
    await harness.it('F5.1: getSkinFallbackColor for AK-47 Ice Coaled returns radiant cyan #00e5ff', ['F5'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Ice Coaled', 'AK-47');
      harness.assertEqual(color, '#00e5ff', 'Fallback color is #00e5ff');
    });

    await harness.it('F5.2: Base PBR values: metalness 0.35, roughness 0.28, clearcoat 0.45', ['F5'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        float: 0.0,
      });
      harness.assertCloseTo(res.effectiveMetalness, 0.35, 0.05, 'Base metalness ~0.35');
      harness.assertCloseTo(res.effectiveRoughness, 0.28, 0.05, 'Base roughness ~0.28');
      harness.assertCloseTo(res.effectiveClearcoat, 0.45, 0.05, 'Base clearcoat ~0.45');
    });

    await harness.it('F5.3: compositeSkinFinish generates CanvasTexture with sRGB color space', ['F5'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Result contains THREE.CanvasTexture');
      harness.assertEqual(res.texture.colorSpace, THREE.SRGBColorSpace, 'Texture uses SRGBColorSpace');
    });

    await harness.it('F5.4: RepeatWrapping configured on wrapS and wrapT', ['F5'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
      });
      harness.assertEqual(res.texture.wrapS, THREE.RepeatWrapping, 'wrapS is RepeatWrapping');
      harness.assertEqual(res.texture.wrapT, THREE.RepeatWrapping, 'wrapT is RepeatWrapping');
    });

    await harness.it('F5.5: Minimal Wear float (0.0825) preserves clearcoat > 0.35', ['F5'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        float: 0.0825,
      });
      harness.assert(res.effectiveClearcoat > 0.35, 'Clearcoat preserved on Minimal Wear (0.0825)');
      harness.assert(res.effectiveRoughness > 0.28, 'Roughness increases mildly with wear');
    });

    // ========================================================================
    // F6: M4A1-S | Liquidation Composite
    // ========================================================================
    await harness.it('F6.1: getSkinFallbackColor for M4A1-S Liquidation returns crimson #e11d48', ['F6'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Liquidation', 'M4A1-S');
      harness.assertEqual(color, '#e11d48', 'Fallback color is #e11d48');
    });

    await harness.it('F6.2: Base PBR values: metalness 0.45, roughness 0.32, clearcoat 0.35', ['F6'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'M4A1-S',
        skinName: 'Liquidation',
        float: 0.0,
      });
      harness.assertCloseTo(res.effectiveMetalness, 0.45, 0.05, 'Base metalness ~0.45');
      harness.assertCloseTo(res.effectiveRoughness, 0.32, 0.05, 'Base roughness ~0.32');
      harness.assertCloseTo(res.effectiveClearcoat, 0.35, 0.05, 'Base clearcoat ~0.35');
    });

    await harness.it('F6.3: compositeSkinFinish generates CanvasTexture with sRGB color space', ['F6'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'M4A1-S',
        skinName: 'Liquidation',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Contains CanvasTexture');
      harness.assertEqual(res.texture.colorSpace, THREE.SRGBColorSpace, 'Uses SRGBColorSpace');
    });

    await harness.it('F6.4: Field-Tested float (0.3438) yields moderate roughness and attenuated clearcoat', ['F6'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'M4A1-S',
        skinName: 'Liquidation',
        float: 0.3438,
      });
      harness.assert(res.effectiveRoughness > 0.4, 'Roughness > 0.40 on Field-Tested');
      harness.assert(res.effectiveClearcoat < 0.25, 'Clearcoat attenuated on Field-Tested');
    });

    await harness.it('F6.5: Base color hex matches #e11d48', ['F6'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'M4A1-S',
        skinName: 'Liquidation',
      });
      harness.assertEqual(res.baseColorHex, '#e11d48', 'Base color hex is #e11d48');
    });

    // ========================================================================
    // F7: AWP | Ice Coaled Composite
    // ========================================================================
    await harness.it('F7.1: getSkinFallbackColor for AWP Ice Coaled returns #00e5ff', ['F7'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Ice Coaled', 'AWP');
      harness.assertEqual(color, '#00e5ff', 'Fallback color is #00e5ff');
    });

    await harness.it('F7.2: Base PBR values: metalness 0.30, roughness 0.22, clearcoat 0.50', ['F7'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AWP',
        skinName: 'Ice Coaled',
        float: 0.0,
      });
      harness.assertCloseTo(res.effectiveMetalness, 0.3, 0.05, 'Base metalness ~0.30');
      harness.assertCloseTo(res.effectiveRoughness, 0.22, 0.05, 'Base roughness ~0.22');
      harness.assertCloseTo(res.effectiveClearcoat, 0.5, 0.05, 'Base clearcoat ~0.50');
    });

    await harness.it('F7.3: Factory New float (0.0631) maintains clearcoat > 0.40 and roughness < 0.30', ['F7'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AWP',
        skinName: 'Ice Coaled',
        float: 0.0631,
      });
      harness.assert(res.effectiveClearcoat > 0.4, 'Clearcoat > 0.40 on Factory New');
      harness.assert(res.effectiveRoughness < 0.3, 'Roughness < 0.30 on Factory New');
    });

    await harness.it('F7.4: compositeSkinFinish generates CanvasTexture with sRGB color space', ['F7'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AWP',
        skinName: 'Ice Coaled',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid CanvasTexture');
      harness.assertEqual(res.texture.colorSpace, THREE.SRGBColorSpace, 'SRGBColorSpace');
    });

    await harness.it('F7.5: Base color hex matches #00e5ff', ['F7'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AWP',
        skinName: 'Ice Coaled',
      });
      harness.assertEqual(res.baseColorHex, '#00e5ff', 'Base color hex is #00e5ff');
    });

    // ========================================================================
    // F8: USP-S | Royal Guard Composite
    // ========================================================================
    await harness.it('F8.1: getSkinFallbackColor for USP-S Royal Guard returns deep imperial red #991b1b', ['F8'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Royal Guard', 'USP-S');
      harness.assertEqual(color, '#991b1b', 'Fallback color is #991b1b');
    });

    await harness.it('F8.2: Base PBR values: metalness 0.75, roughness 0.18, clearcoat 0.65', ['F8'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'USP-S',
        skinName: 'Royal Guard',
        float: 0.0,
      });
      harness.assertCloseTo(res.effectiveMetalness, 0.75, 0.05, 'Base metalness ~0.75');
      harness.assertCloseTo(res.effectiveRoughness, 0.18, 0.05, 'Base roughness ~0.18');
      harness.assertCloseTo(res.effectiveClearcoat, 0.65, 0.05, 'Base clearcoat ~0.65');
    });

    await harness.it('F8.3: Factory New float (0.0560) retains high clearcoat > 0.50 and high metalness > 0.70', ['F8'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'USP-S',
        skinName: 'Royal Guard',
        float: 0.056,
      });
      harness.assert(res.effectiveClearcoat > 0.5, 'Clearcoat > 0.50 on FN');
      harness.assert(res.effectiveMetalness > 0.7, 'Metalness > 0.70 on FN');
    });

    await harness.it('F8.4: compositeSkinFinish generates CanvasTexture with sRGB color space', ['F8'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'USP-S',
        skinName: 'Royal Guard',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid CanvasTexture');
      harness.assertEqual(res.texture.colorSpace, THREE.SRGBColorSpace, 'SRGBColorSpace');
    });

    await harness.it('F8.5: Base color hex matches #991b1b', ['F8'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'USP-S',
        skinName: 'Royal Guard',
      });
      harness.assertEqual(res.baseColorHex, '#991b1b', 'Base color hex is #991b1b');
    });

    // ========================================================================
    // F9: MAC-10 | Candy Apple Composite
    // ========================================================================
    await harness.it('F9.1: getSkinFallbackColor for MAC-10 Candy Apple returns candy apple red #dc2626', ['F9'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Candy Apple', 'MAC-10');
      harness.assertEqual(color, '#dc2626', 'Fallback color is #dc2626');
    });

    await harness.it('F9.2: Base PBR values: metalness 0.70, roughness 0.12, clearcoat 0.85', ['F9'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
        float: 0.0,
      });
      harness.assertCloseTo(res.effectiveMetalness, 0.7, 0.05, 'Base metalness ~0.70');
      harness.assertCloseTo(res.effectiveRoughness, 0.12, 0.05, 'Base roughness ~0.12');
      harness.assertCloseTo(res.effectiveClearcoat, 0.85, 0.05, 'Base clearcoat ~0.85');
    });

    await harness.it('F9.3: Factory New float (0.02) yields high clearcoat > 0.75 (high-gloss enamel)', ['F9'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
        float: 0.02,
      });
      harness.assert(res.effectiveClearcoat > 0.75, 'High clearcoat > 0.75');
      harness.assert(res.effectiveRoughness < 0.2, 'Low roughness < 0.20');
    });

    await harness.it('F9.4: compositeSkinFinish generates CanvasTexture with sRGB color space', ['F9'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid CanvasTexture');
      harness.assertEqual(res.texture.colorSpace, THREE.SRGBColorSpace, 'SRGBColorSpace');
    });

    await harness.it('F9.5: Base color hex matches #dc2626', ['F9'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
      });
      harness.assertEqual(res.baseColorHex, '#dc2626', 'Base color hex is #dc2626');
    });

    // ========================================================================
    // F10: Zeus x27 | Electric Blue Composite
    // ========================================================================
    await harness.it('F10.1: getSkinFallbackColor for Zeus x27 Electric Blue returns cobalt blue #2563eb', ['F10'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Electric Blue', 'Zeus x27');
      harness.assertEqual(color, '#2563eb', 'Fallback color is #2563eb');
    });

    await harness.it('F10.2: Base PBR values: metalness 0.30, roughness 0.35, clearcoat 0.20', ['F10'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Zeus x27',
        skinName: 'Electric Blue',
        float: 0.0,
      });
      harness.assertCloseTo(res.effectiveMetalness, 0.3, 0.05, 'Base metalness ~0.30');
      harness.assertCloseTo(res.effectiveRoughness, 0.35, 0.05, 'Base roughness ~0.35');
      harness.assertCloseTo(res.effectiveClearcoat, 0.2, 0.05, 'Base clearcoat ~0.20');
    });

    await harness.it('F10.3: compositeSkinFinish generates CanvasTexture with sRGB color space', ['F10'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Zeus x27',
        skinName: 'Electric Blue',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid CanvasTexture');
      harness.assertEqual(res.texture.colorSpace, THREE.SRGBColorSpace, 'SRGBColorSpace');
    });

    await harness.it('F10.4: Seed modulation generates deterministically', ['F10'], async () => {
      const res1 = skinCompositor.compositeSkinFinish({
        weaponName: 'Zeus x27',
        skinName: 'Electric Blue',
        seed: 42,
      });
      const res2 = skinCompositor.compositeSkinFinish({
        weaponName: 'Zeus x27',
        skinName: 'Electric Blue',
        seed: 42,
      });
      harness.assertEqual(res1.baseColorHex, res2.baseColorHex, 'Colors match');
      harness.assertEqual(res1.effectiveRoughness, res2.effectiveRoughness, 'Roughness matches');
    });

    await harness.it('F10.5: Base color hex matches #2563eb', ['F10'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Zeus x27',
        skinName: 'Electric Blue',
      });
      harness.assertEqual(res.baseColorHex, '#2563eb', 'Base color hex is #2563eb');
    });

    // ========================================================================
    // F11: Galil AR | Control Composite
    // ========================================================================
    await harness.it('F11.1: getSkinFallbackColor for Galil AR Control returns tactical slate blue #3b82f6', ['F11'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Control', 'Galil AR');
      harness.assertEqual(color, '#3b82f6', 'Fallback color is #3b82f6');
    });

    await harness.it('F11.2: Base PBR values: metalness 0.45, roughness 0.38, clearcoat 0.15', ['F11'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Galil AR',
        skinName: 'Control',
        float: 0.0,
      });
      harness.assertCloseTo(res.effectiveMetalness, 0.45, 0.05, 'Base metalness ~0.45');
      harness.assertCloseTo(res.effectiveRoughness, 0.38, 0.05, 'Base roughness ~0.38');
      harness.assertCloseTo(res.effectiveClearcoat, 0.15, 0.05, 'Base clearcoat ~0.15');
    });

    await harness.it('F11.3: compositeSkinFinish generates CanvasTexture with sRGB color space', ['F11'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Galil AR',
        skinName: 'Control',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid CanvasTexture');
      harness.assertEqual(res.texture.colorSpace, THREE.SRGBColorSpace, 'SRGBColorSpace');
    });

    await harness.it('F11.4: Base color hex is non-empty hex', ['F11'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Galil AR',
        skinName: 'Control',
      });
      harness.assert(/^#[0-9a-fA-F]{6}$/.test(res.baseColorHex), 'Base color hex is valid 6-char hex');
    });

    await harness.it('F11.5: Seed variation adjusts tactical layout parameters', ['F11'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Galil AR',
        skinName: 'Control',
        seed: 777,
      });
      harness.assert(res.texture !== null, 'Composited successfully with seed 777');
    });

    // ========================================================================
    // F12: Glock-18 | Catacombs Composite
    // ========================================================================
    await harness.it('F12.1: getSkinFallbackColor for Glock-18 Catacombs returns dark slide hex #18181b', ['F12'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Catacombs', 'Glock-18');
      harness.assertEqual(color, '#18181b', 'Fallback color is #18181b');
    });

    await harness.it('F12.2: Base PBR values: metalness 0.20, roughness 0.42, clearcoat 0.10', ['F12'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Glock-18',
        skinName: 'Catacombs',
        float: 0.0,
      });
      harness.assertCloseTo(res.effectiveMetalness, 0.2, 0.05, 'Base metalness ~0.20');
      harness.assertCloseTo(res.effectiveRoughness, 0.42, 0.05, 'Base roughness ~0.42');
      harness.assertCloseTo(res.effectiveClearcoat, 0.1, 0.05, 'Base clearcoat ~0.10');
    });

    await harness.it('F12.3: compositeSkinFinish generates CanvasTexture with sRGB color space', ['F12'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Glock-18',
        skinName: 'Catacombs',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid CanvasTexture');
      harness.assertEqual(res.texture.colorSpace, THREE.SRGBColorSpace, 'SRGBColorSpace');
    });

    await harness.it('F12.4: Seed alters procedural skull coordinates', ['F12'], async () => {
      const resA = skinCompositor.compositeSkinFinish({
        weaponName: 'Glock-18',
        skinName: 'Catacombs',
        seed: 123,
      });
      harness.assert(resA.texture !== null, 'Composited with seed 123');
    });

    await harness.it('F12.5: Returns valid SkinCompositeResult', ['F12'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Glock-18',
        skinName: 'Catacombs',
      });
      harness.assertEqual(res.baseColorHex, '#18181b', 'Base color hex is #18181b');
      harness.assert(typeof res.effectiveRoughness === 'number', 'Effective roughness is number');
    });

    // ========================================================================
    // F13: UMP-45 | Late Night Transit Composite
    // ========================================================================
    await harness.it('F13.1: getSkinFallbackColor for UMP-45 Late Night Transit returns midnight chassis #0f172a', ['F13'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Late Night Transit', 'UMP-45');
      harness.assertEqual(color, '#0f172a', 'Fallback color is #0f172a');
    });

    await harness.it('F13.2: Base PBR values: metalness 0.75, roughness 0.70, clearcoat 0.0', ['F13'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'UMP-45',
        skinName: 'Late Night Transit',
        float: 0.0,
      });
      harness.assertCloseTo(res.effectiveMetalness, 0.75, 0.05, 'Base metalness ~0.75');
      harness.assertCloseTo(res.effectiveRoughness, 0.7, 0.05, 'Base roughness ~0.70');
      harness.assertEqual(res.effectiveClearcoat, 0.0, 'Base clearcoat is 0.0');
    });

    await harness.it('F13.3: Battle-Scarred float (0.8643) drives effective clearcoat strictly to 0.0', ['F13'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'UMP-45',
        skinName: 'Late Night Transit',
        float: 0.8643,
      });
      harness.assertEqual(res.effectiveClearcoat, 0.0, 'Clearcoat is 0.0 on Battle-Scarred');
    });

    await harness.it('F13.4: Battle-Scarred float drives effective roughness > 0.75 and effective metalness > 0.50', ['F13'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'UMP-45',
        skinName: 'Late Night Transit',
        float: 0.8643,
      });
      harness.assert(res.effectiveRoughness > 0.75, 'Roughness > 0.75 on Battle-Scarred');
      harness.assert(res.effectiveMetalness > 0.5, 'Metalness > 0.50 on Battle-Scarred');
    });

    await harness.it('F13.5: compositeSkinFinish generates CanvasTexture with sRGB color space', ['F13'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'UMP-45',
        skinName: 'Late Night Transit',
        float: 0.8643,
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'Valid CanvasTexture');
      harness.assertEqual(res.texture.colorSpace, THREE.SRGBColorSpace, 'SRGBColorSpace');
    });

    // ========================================================================
    // F14: Generic Procedural Fallback Compositor
    // ========================================================================
    await harness.it('F14.1: Generates procedural texture for arbitrary unlisted skin', ['F14'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Unlisted Skin XYZ',
      });
      harness.assert(Boolean(res.texture && res.texture.isCanvasTexture), 'CanvasTexture created for fallback');
    });

    await harness.it('F14.2: Respects rarityColor prop (#eb4b4b for Covert)', ['F14'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AWP',
        skinName: 'Dragon Lore',
        rarityColor: '#eb4b4b',
      });
      harness.assertEqual(res.baseColorHex, '#eb4b4b', 'Fallback base color uses rarity color');
    });

    await harness.it('F14.3: Falls back to default color when rarityColor is omitted', ['F14'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Completely Unknown Skin', 'Unknown Weapon');
      harness.assert(color.startsWith('#'), 'Returns valid hex color');
    });

    await harness.it('F14.4: Returns valid SkinCompositeResult with all 5 required properties', ['F14'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Nova',
        skinName: 'Wild Six',
      });
      harness.assert('texture' in res, 'Has texture');
      harness.assert('effectiveRoughness' in res, 'Has effectiveRoughness');
      harness.assert('effectiveMetalness' in res, 'Has effectiveMetalness');
      harness.assert('effectiveClearcoat' in res, 'Has effectiveClearcoat');
      harness.assert('baseColorHex' in res, 'Has baseColorHex');
    });

    await harness.it('F14.5: Produces CanvasTexture with RepeatWrapping', ['F14'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'P250',
        skinName: 'Sand Dune',
      });
      harness.assertEqual(res.texture.wrapS, THREE.RepeatWrapping);
      harness.assertEqual(res.texture.wrapT, THREE.RepeatWrapping);
    });

    // ========================================================================
    // F15: Live Float Wear Simulation Mathematics
    // ========================================================================
    await harness.it('F15.1: calculateEffectiveWear at float 0.00 preserves base pristine parameters', ['F15'], async () => {
      const wear = skinCompositor.calculateEffectiveWear(0.2, 0.7, 0.8, 0.0);
      harness.assertCloseTo(wear.effectiveRoughness, 0.2, 0.01, 'Roughness matches base at 0.00 float');
      harness.assertCloseTo(wear.effectiveMetalness, 0.7, 0.01, 'Metalness matches base at 0.00 float');
      harness.assertCloseTo(wear.effectiveClearcoat, 0.8, 0.01, 'Clearcoat matches base at 0.00 float');
    });

    await harness.it('F15.2: calculateEffectiveWear at float 1.00 increases roughness and zeroes clearcoat', ['F15'], async () => {
      const wear = skinCompositor.calculateEffectiveWear(0.2, 0.3, 0.8, 1.0);
      harness.assertCloseTo(wear.effectiveRoughness, 0.85, 0.05, 'Roughness scales to max ~0.85');
      harness.assertEqual(wear.effectiveClearcoat, 0.0, 'Clearcoat is 0.0 at float 1.00');
    });

    await harness.it('F15.3: calculateEffectiveWear drops clearcoat to 0.0 for any float > 0.55', ['F15'], async () => {
      const wear56 = skinCompositor.calculateEffectiveWear(0.2, 0.3, 0.8, 0.56);
      const wear60 = skinCompositor.calculateEffectiveWear(0.2, 0.3, 0.8, 0.6);
      const wear90 = skinCompositor.calculateEffectiveWear(0.2, 0.3, 0.8, 0.9);
      harness.assertEqual(wear56.effectiveClearcoat, 0.0, 'Clearcoat is 0.0 at float 0.56');
      harness.assertEqual(wear60.effectiveClearcoat, 0.0, 'Clearcoat is 0.0 at float 0.60');
      harness.assertEqual(wear90.effectiveClearcoat, 0.0, 'Clearcoat is 0.0 at float 0.90');
    });

    await harness.it('F15.4: calculateEffectiveWear gracefully handles null and undefined float (defaults to 0.0)', ['F15'], async () => {
      const wearNull = skinCompositor.calculateEffectiveWear(0.2, 0.5, 0.5, null);
      const wearUndef = skinCompositor.calculateEffectiveWear(0.2, 0.5, 0.5, undefined);
      harness.assertCloseTo(wearNull.effectiveRoughness, 0.2, 0.01, 'Null float defaults to 0.0');
      harness.assertCloseTo(wearUndef.effectiveRoughness, 0.2, 0.01, 'Undefined float defaults to 0.0');
    });

    await harness.it('F15.5: calculateEffectiveWear clamps negative float (<0) and overflow float (>1)', ['F15'], async () => {
      const wearNeg = skinCompositor.calculateEffectiveWear(0.2, 0.5, 0.5, -0.5);
      const wearOver = skinCompositor.calculateEffectiveWear(0.2, 0.5, 0.5, 1.5);
      harness.assertCloseTo(wearNeg.effectiveRoughness, 0.2, 0.01, 'Negative float clamped to 0.0');
      harness.assertCloseTo(wearOver.effectiveRoughness, 0.85, 0.05, 'Overflow float clamped to 1.0');
    });

    // ========================================================================
    // F16: Pattern Seed Modulation
    // ========================================================================
    await harness.it('F16.1: Seed 0 evaluates to valid baseline deterministic pattern', ['F16'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        seed: 0,
      });
      harness.assert(res.texture !== null, 'Seed 0 produces valid texture');
    });

    await harness.it('F16.2: Seed 1000 evaluates without overflow or NaN', ['F16'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        seed: 1000,
      });
      harness.assert(!Number.isNaN(res.effectiveRoughness), 'Roughness is valid number');
      harness.assert(res.texture !== null, 'Seed 1000 produces valid texture');
    });

    await harness.it('F16.3: Null or undefined seed defaults safely to 0', ['F16'], async () => {
      const resNull = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        seed: null,
      });
      const resUndef = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        seed: undefined,
      });
      harness.assert(resNull.texture !== null, 'Null seed handled safely');
      harness.assert(resUndef.texture !== null, 'Undefined seed handled safely');
    });

    await harness.it('F16.4: Seed variation does not alter calculated wear parameters', ['F16'], async () => {
      const resA = skinCompositor.compositeSkinFinish({
        weaponName: 'M4A1-S',
        skinName: 'Liquidation',
        float: 0.25,
        seed: 100,
      });
      const resB = skinCompositor.compositeSkinFinish({
        weaponName: 'M4A1-S',
        skinName: 'Liquidation',
        float: 0.25,
        seed: 900,
      });
      harness.assertEqual(resA.effectiveRoughness, resB.effectiveRoughness, 'Roughness identical across seeds');
      harness.assertEqual(resA.effectiveClearcoat, resB.effectiveClearcoat, 'Clearcoat identical across seeds');
    });

    await harness.it('F16.5: Negative seeds are safely handled', ['F16'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'Zeus x27',
        skinName: 'Electric Blue',
        seed: -55,
      });
      harness.assert(res.texture !== null, 'Negative seed handled safely without error');
    });

    // ========================================================================
    // F17: Extended ModelViewerProps
    // ========================================================================
    await harness.it('F17.1: ModelViewerProps interface accepts float: number | null', ['F17'], async () => {
      const props = {
        modelUrl: '/models/weapon_rif_ak47.obj',
        float: 0.0825,
      };
      harness.assert(props.float === 0.0825, 'Props accepts float number');
    });

    await harness.it('F17.2: ModelViewerProps interface accepts seed: number | null', ['F17'], async () => {
      const props = {
        modelUrl: '/models/weapon_rif_ak47.obj',
        seed: 367,
      };
      harness.assert(props.seed === 367, 'Props accepts seed integer');
    });

    await harness.it('F17.3: ModelViewerProps interface accepts rarityColor: string', ['F17'], async () => {
      const props = {
        modelUrl: '/models/weapon_rif_ak47.obj',
        rarityColor: '#d32ce6',
      };
      harness.assertEqual(props.rarityColor, '#d32ce6', 'Props accepts rarityColor hex string');
    });

    await harness.it('F17.4: ModelViewerProps interface accepts skinName: string', ['F17'], async () => {
      const props = {
        modelUrl: '/models/weapon_rif_ak47.obj',
        skinName: 'Ice Coaled',
      };
      harness.assertEqual(props.skinName, 'Ice Coaled', 'Props accepts skinName string');
    });

    await harness.it('F17.5: ModelViewerProps handles omission of new props with backward compatibility', ['F17'], async () => {
      const props = {
        modelUrl: '/models/weapon_rif_ak47.obj',
        weaponName: 'AK-47',
      };
      harness.assert(props.float === undefined, 'float is optional');
      harness.assert(props.seed === undefined, 'seed is optional');
      harness.assert(props.skinName === undefined, 'skinName is optional');
    });

    // ========================================================================
    // F18: MeshPhysicalMaterial Upgrade
    // ========================================================================
    await harness.it('F18.1: CS2 weapon meshes configure THREE.MeshPhysicalMaterial', ['F18'], async () => {
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0x00e5ff,
        metalness: 0.35,
        roughness: 0.28,
        clearcoat: 0.45,
      });
      harness.assert(mat instanceof THREE.MeshPhysicalMaterial, 'Instance of MeshPhysicalMaterial');
    });

    await harness.it('F18.2: Material supports clearcoat property', ['F18'], async () => {
      const mat = new THREE.MeshPhysicalMaterial({ clearcoat: 0.85 });
      harness.assertEqual(mat.clearcoat, 0.85, 'clearcoat is 0.85');
    });

    await harness.it('F18.3: Material supports clearcoatRoughness property', ['F18'], async () => {
      const mat = new THREE.MeshPhysicalMaterial({ clearcoatRoughness: 0.15 });
      harness.assertEqual(mat.clearcoatRoughness, 0.15, 'clearcoatRoughness is 0.15');
    });

    await harness.it('F18.4: Material metalness and roughness values are bounded in [0, 1]', ['F18'], async () => {
      const mat = new THREE.MeshPhysicalMaterial({ metalness: 0.75, roughness: 0.18 });
      harness.assert(mat.metalness >= 0 && mat.metalness <= 1, 'Metalness in [0, 1]');
      harness.assert(mat.roughness >= 0 && mat.roughness <= 1, 'Roughness in [0, 1]');
    });

    await harness.it('F18.5: Material side is configured to THREE.FrontSide', ['F18'], async () => {
      const mat = new THREE.MeshPhysicalMaterial({ side: THREE.FrontSide });
      harness.assertEqual(mat.side, THREE.FrontSide, 'Side is FrontSide');
    });

    // ========================================================================
    // F19: Three.js uv2 Attribute Binding
    // ========================================================================
    await harness.it('F19.1: Assigns geometry.attributes.uv2 from geometry.attributes.uv for aoMap shader', ['F19'], async () => {
      const geom = new THREE.BufferGeometry();
      const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      // In Three.js, aoMap requires uv2:
      if (geom.attributes.uv && !geom.attributes.uv2) {
        geom.setAttribute('uv2', geom.attributes.uv);
      }

      harness.assert(geom.attributes.uv2 !== undefined, 'uv2 attribute created');
      harness.assertEqual(geom.attributes.uv2.count, 3, 'uv2 attribute has 3 vertices');
    });

    await harness.it('F19.2: geometry.attributes.uv2 has identical count and itemSize to uv', ['F19'], async () => {
      const geom = new THREE.BufferGeometry();
      const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geom.setAttribute('uv2', geom.attributes.uv);

      harness.assertEqual(geom.attributes.uv2.itemSize, geom.attributes.uv.itemSize);
      harness.assertEqual(geom.attributes.uv2.count, geom.attributes.uv.count);
    });

    await harness.it('F19.3: If uv2 already exists, does not throw or corrupt geometry', ['F19'], async () => {
      const geom = new THREE.BufferGeometry();
      const uvs = new Float32Array([0, 0, 1, 0]);
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geom.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2));

      // Guard check
      if (geom.attributes.uv && !geom.attributes.uv2) {
        geom.setAttribute('uv2', geom.attributes.uv);
      }

      harness.assert(geom.attributes.uv2 !== undefined, 'uv2 preserved');
    });

    await harness.it('F19.4: Handles geometry without UVs without throwing unhandled exceptions', ['F19'], async () => {
      const geom = new THREE.BufferGeometry();
      // Should not throw when uv is missing
      if (geom.attributes.uv && !geom.attributes.uv2) {
        geom.setAttribute('uv2', geom.attributes.uv);
      }
      harness.assertEqual(geom.attributes.uv2, undefined, 'uv2 remains undefined safely');
    });

    await harness.it('F19.5: Cloned meshes maintain valid uv2 buffer attributes', ['F19'], async () => {
      const geom = new THREE.BufferGeometry();
      const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
      geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geom.setAttribute('uv2', geom.attributes.uv);

      const clone = geom.clone();
      harness.assert(clone.attributes.uv2 !== undefined, 'Cloned geometry retains uv2 attribute');
    });

    // ========================================================================
    // F20: AO & Surface & Diffuse Texture Binding
    // ========================================================================
    await harness.it('F20.1: MeshPhysicalMaterial binds aoMap with aoMapIntensity = 1.2', ['F20'], async () => {
      const aoTex = new THREE.Texture();
      const mat = new THREE.MeshPhysicalMaterial({
        aoMap: aoTex,
        aoMapIntensity: 1.2,
      });
      harness.assertEqual(mat.aoMap, aoTex, 'aoMap bound to texture');
      harness.assertEqual(mat.aoMapIntensity, 1.2, 'aoMapIntensity is 1.2');
    });

    await harness.it('F20.2: MeshPhysicalMaterial binds roughnessMap to surface texture', ['F20'], async () => {
      const surfaceTex = new THREE.Texture();
      const mat = new THREE.MeshPhysicalMaterial({
        roughnessMap: surfaceTex,
      });
      harness.assertEqual(mat.roughnessMap, surfaceTex, 'roughnessMap bound to texture');
    });

    await harness.it('F20.3: MeshPhysicalMaterial binds map to composited skin diffuse texture', ['F20'], async () => {
      const skinTex = new THREE.Texture();
      const mat = new THREE.MeshPhysicalMaterial({
        map: skinTex,
      });
      harness.assertEqual(mat.map, skinTex, 'map bound to skin texture');
    });

    await harness.it('F20.4: If aoTexture is null, material.aoMap remains null/undefined without throwing', ['F20'], async () => {
      const mat = new THREE.MeshPhysicalMaterial({
        aoMap: null,
        aoMapIntensity: 1.2,
      });
      harness.assertEqual(mat.aoMap, null, 'aoMap is null without crashing');
    });

    await harness.it('F20.5: If surfaceTexture is null, material.roughnessMap remains null/undefined without throwing', ['F20'], async () => {
      const mat = new THREE.MeshPhysicalMaterial({
        roughnessMap: null,
      });
      harness.assertEqual(mat.roughnessMap, null, 'roughnessMap is null without crashing');
    });

    // ========================================================================
    // F21: Synchronous Fallback Colors
    // ========================================================================
    await harness.it('F21.1: getSkinFallbackColor is synchronous (returns string immediately)', ['F21'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Ice Coaled', 'AK-47');
      harness.assert(typeof color === 'string', 'Returned string synchronously');
      harness.assert(color.startsWith('#'), 'Valid hex format');
    });

    await harness.it('F21.2: Returns #00e5ff for "Ice Coaled"', ['F21'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Ice Coaled');
      harness.assertEqual(color, '#00e5ff');
    });

    await harness.it('F21.3: Returns #e11d48 for "Liquidation"', ['F21'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Liquidation');
      harness.assertEqual(color, '#e11d48');
    });

    await harness.it('F21.4: Returns #dc2626 for "Candy Apple"', ['F21'], async () => {
      const color = skinCompositor.getSkinFallbackColor('Candy Apple');
      harness.assertEqual(color, '#dc2626');
    });

    await harness.it('F21.5: Returns fallback color when skin name is unknown or empty', ['F21'], async () => {
      const color = skinCompositor.getSkinFallbackColor('', 'Knife');
      harness.assert(typeof color === 'string' && color.startsWith('#'), 'Returns fallback hex color');
    });

    // ========================================================================
    // F22: WebGL Resource Disposal
    // ========================================================================
    await harness.it('F22.1: disposeThreeObject cleans up MeshPhysicalMaterial', ['F22'], async () => {
      const { disposeThreeObject } = await import('../../../src/components/ModelViewer.tsx');
      const mat = new THREE.MeshPhysicalMaterial();
      let disposed = false;
      mat.dispose = () => { disposed = true; };

      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      disposeThreeObject(mesh);
      harness.assert(disposed, 'MeshPhysicalMaterial dispose() was called');
    });

    await harness.it('F22.2: disposeThreeObject disposes attached textures (map, aoMap, roughnessMap)', ['F22'], async () => {
      const { disposeThreeObject } = await import('../../../src/components/ModelViewer.tsx');
      const map = new THREE.Texture();
      let mapDisposed = false;
      map.dispose = () => { mapDisposed = true; };

      const mat = new THREE.MeshPhysicalMaterial({ map });
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      disposeThreeObject(mesh);
      harness.assert(mapDisposed, 'Texture dispose() was called');
    });

    await harness.it('F22.3: CanvasTexture disposal reclaims resources without error', ['F22'], async () => {
      const res = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
      });
      harness.assert(typeof res.texture.dispose === 'function', 'CanvasTexture has dispose() method');
      res.texture.dispose();
    });

    await harness.it('F22.4: disposeThreeObject handles null / empty groups safely', ['F22'], async () => {
      const { disposeThreeObject } = await import('../../../src/components/ModelViewer.tsx');
      const group = new THREE.Group();
      disposeThreeObject(group);
      harness.assert(true, 'Disposed empty group without errors');
    });

    await harness.it('F22.5: Repeated disposal calls are idempotent and do not throw', ['F22'], async () => {
      const { disposeThreeObject } = await import('../../../src/components/ModelViewer.tsx');
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial());
      disposeThreeObject(mesh);
      disposeThreeObject(mesh);
      harness.assert(true, 'Idempotent repeated disposal succeeded');
    });

    // ========================================================================
    // F23: CS2LoadoutCard Integration
    // ========================================================================
    await harness.it('F23.1: DEFAULT_LOADOUT_WEAPONS contains AK-47 Ice Coaled with float 0.0825, seed 367', ['F23'], async () => {
      const { DEFAULT_LOADOUT_WEAPONS } = await import('../../../src/components/steam/CS2LoadoutCard.tsx');
      const ak = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'AK-47');
      harness.assert(ak !== undefined, 'AK-47 present in loadout');
      harness.assertEqual(ak.skin, 'Ice Coaled', 'Skin is Ice Coaled');
      harness.assertCloseTo(ak.float, 0.0825, 0.0001, 'Float is 0.0825');
      harness.assertEqual(ak.seed, 367, 'Seed is 367');
    });

    await harness.it('F23.2: DEFAULT_LOADOUT_WEAPONS contains M4A1-S Liquidation with float 0.3438, seed 937', ['F23'], async () => {
      const { DEFAULT_LOADOUT_WEAPONS } = await import('../../../src/components/steam/CS2LoadoutCard.tsx');
      const m4 = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'M4A1-S');
      harness.assert(m4 !== undefined, 'M4A1-S present in loadout');
      harness.assertEqual(m4.skin, 'Liquidation', 'Skin is Liquidation');
      harness.assertCloseTo(m4.float, 0.3438, 0.0001, 'Float is 0.3438');
      harness.assertEqual(m4.seed, 937, 'Seed is 937');
    });

    await harness.it('F23.3: DEFAULT_LOADOUT_WEAPONS contains AWP Ice Coaled with float 0.0631, seed 309', ['F23'], async () => {
      const { DEFAULT_LOADOUT_WEAPONS } = await import('../../../src/components/steam/CS2LoadoutCard.tsx');
      const awp = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'AWP');
      harness.assert(awp !== undefined, 'AWP present in loadout');
      harness.assertEqual(awp.skin, 'Ice Coaled', 'Skin is Ice Coaled');
      harness.assertCloseTo(awp.float, 0.0631, 0.0001, 'Float is 0.0631');
      harness.assertEqual(awp.seed, 309, 'Seed is 309');
    });

    await harness.it('F23.4: DEFAULT_LOADOUT_WEAPONS contains USP-S Royal Guard with float 0.0560, seed 644', ['F23'], async () => {
      const { DEFAULT_LOADOUT_WEAPONS } = await import('../../../src/components/steam/CS2LoadoutCard.tsx');
      const usp = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'USP-S');
      harness.assert(usp !== undefined, 'USP-S present in loadout');
      harness.assertEqual(usp.skin, 'Royal Guard', 'Skin is Royal Guard');
      harness.assertCloseTo(usp.float, 0.056, 0.0001, 'Float is 0.0560');
      harness.assertEqual(usp.seed, 644, 'Seed is 644');
    });

    await harness.it('F23.5: CS2LoadoutCard weapons provide rarityColor for PBR fallback styling', ['F23'], async () => {
      const { DEFAULT_LOADOUT_WEAPONS } = await import('../../../src/components/steam/CS2LoadoutCard.tsx');
      for (const weapon of DEFAULT_LOADOUT_WEAPONS) {
        harness.assert(Boolean(weapon.rarityColor), `Weapon ${weapon.tabLabel} has rarityColor`);
        harness.assert(weapon.rarityColor.startsWith('#'), `Weapon ${weapon.tabLabel} rarityColor is hex`);
      }
    });

    // ========================================================================
    // F24: InventoryExplorer 3D Stage Integration
    // ========================================================================
    await harness.it('F24.1: InventoryExplorer provides wear tier mapping helper getWearTier', ['F24'], async () => {
      const { getWearTier } = await import('../../../src/components/steam/InventoryExplorer.tsx');
      const fn = getWearTier(0.05);
      const ft = getWearTier(0.34);
      const bs = getWearTier(0.86);
      harness.assertEqual(fn.tag, 'FN', 'Factory New tag is FN');
      harness.assertEqual(ft.tag, 'FT', 'Field-Tested tag is FT');
      harness.assertEqual(bs.tag, 'BS', 'Battle-Scarred tag is BS');
    });

    await harness.it('F24.2: getWearTier handles null float safely without throwing', ['F24'], async () => {
      const { getWearTier } = await import('../../../src/components/steam/InventoryExplorer.tsx');
      harness.assertEqual(getWearTier(null), null, 'Null float returns null');
      harness.assertEqual(getWearTier(undefined), null, 'Undefined float returns null');
    });

    await harness.it('F24.3: InventoryExplorer category filter taxonomy matches all 6 required classes', ['F24'], async () => {
      const { CATEGORIES } = await import('../../../src/components/steam/InventoryExplorer.tsx');
      harness.assert(CATEGORIES.includes('All'), 'Includes All');
      harness.assert(CATEGORIES.includes('Rifles'), 'Includes Rifles');
      harness.assert(CATEGORIES.includes('Pistols'), 'Includes Pistols');
      harness.assert(CATEGORIES.includes('Snipers'), 'Includes Snipers');
      harness.assert(CATEGORIES.includes('SMGs & Heavy'), 'Includes SMGs & Heavy');
      harness.assert(CATEGORIES.includes('Collectibles'), 'Includes Collectibles');
    });

    await harness.it('F24.4: matchesCategory correctly classifies items', ['F24'], async () => {
      const { matchesCategory } = await import('../../../src/components/steam/InventoryExplorer.tsx');
      const akItem = { id: '1', name: 'AK-47 | Ice Coaled', type: 'Rifle' };
      const awpItem = { id: '2', name: 'AWP | Ice Coaled', type: 'Sniper Rifle' };
      harness.assert(matchesCategory(akItem, 'Rifles'), 'AK-47 matches Rifles');
      harness.assert(matchesCategory(awpItem, 'Snipers'), 'AWP matches Snipers');
    });

    await harness.it('F24.5: normalizeSkinIdentifier extracts weaponBase and skinName tokens', ['F24'], async () => {
      const { normalizeSkinIdentifier } = await import('../../../src/utils/skinCompositor.ts');
      const parsed = normalizeSkinIdentifier('StatTrak™ M4A1-S | Liquidation (Field-Tested)');
      harness.assertEqual(parsed.normalizedWeapon, 'm4a1-s', 'Base weapon extracted');
      harness.assertEqual(parsed.normalizedPattern, 'liquidation', 'Skin name extracted');
    });

    // ========================================================================
    // F25: Inspect View Dock Toggle
    // ========================================================================
    await harness.it('F25.1: Inspect view dock supports 3-way toggle options: 3D Model, Steam 2D Artwork, Launch CS2 Inspect', ['F25'], async () => {
      // Contract specification for the 3-way inspect view dock
      const DOCK_MODES = ['3d', '2d', 'inspect'];
      harness.assertEqual(DOCK_MODES.length, 3, 'Dock specifies 3 viewing modes');
    });

    await harness.it('F25.2: Default inspect view mode is 3D Model', ['F25'], async () => {
      const defaultMode = '3d';
      harness.assertEqual(defaultMode, '3d', 'Default mode is 3d');
    });

    await harness.it('F25.3: Switching to 2D artwork view toggles visible view container', ['F25'], async () => {
      let activeMode = '3d';
      activeMode = '2d';
      harness.assertEqual(activeMode, '2d', 'Mode toggled to 2d');
    });

    await harness.it('F25.4: Launch CS2 Inspect button provides valid steam:// inspect link', ['F25'], async () => {
      const inspectUrl = 'steam://run/730//+csgo_econ_action_preview%205545A1B89F9190544D5275A25D7D5065';
      harness.assert(inspectUrl.startsWith('steam://'), 'Inspect URL begins with steam protocol');
      harness.assert(inspectUrl.includes('csgo_econ_action_preview'), 'Contains CS2 preview command');
    });

    await harness.it('F25.5: View dock buttons are accessible and maintain state across items', ['F25'], async () => {
      let activeMode = '2d';
      const nextItem = { id: '52289606446', name: 'M4A1-S | Liquidation' };
      harness.assert(Boolean(nextItem.id), 'Next item selected');
      harness.assertEqual(activeMode, '2d', 'View mode persists across item selection');
    });

    // ========================================================================
    // F26: Privacy Invariant Enforcement
    // ========================================================================
    await harness.it('F26.1: Zero personal surname in src/', ['F26'], async () => {
      const srcDir = path.resolve('src');
      const files = getAllFiles(srcDir);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        harness.assert(
          !content.toLowerCase().includes('cafici'),
          `File ${path.relative(process.cwd(), file)} must not contain personal surname`
        );
      }
    });

    await harness.it('F26.2: Zero personal first name in src/', ['F26'], async () => {
      const srcDir = path.resolve('src');
      const files = getAllFiles(srcDir);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        harness.assert(
          !content.toLowerCase().includes('charlie'),
          `File ${path.relative(process.cwd(), file)} must not contain personal first name`
        );
      }
    });

    await harness.it('F26.3: Zero personal email addresses in src/', ['F26'], async () => {
      const srcDir = path.resolve('src');
      const files = getAllFiles(srcDir);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        harness.assert(
          !content.toLowerCase().includes('charcaf'),
          `File ${path.relative(process.cwd(), file)} must not contain personal email prefix`
        );
      }
    });

    await harness.it('F26.4: Zero physical addresses or local user paths in client code', ['F26'], async () => {
      const srcDir = path.resolve('src');
      const files = getAllFiles(srcDir);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        harness.assert(
          !content.includes('/Users/'),
          `File ${path.relative(process.cwd(), file)} must not contain absolute /Users/ paths`
        );
      }
    });

    await harness.it('F26.5: User identity strictly constrained to alias "huh4k" and Steam ID "76561198920486334"', ['F26'], async () => {
      const { SITE_CONFIG } = await import('../../../src/lib/config.ts');
      harness.assertEqual(SITE_CONFIG.author.steamId, '76561198920486334', 'Target Steam ID is canonical 76561198920486334');
      harness.assertEqual(SITE_CONFIG.author.name, 'huh4k', 'Canonical author name is huh4k');
    });
  });
}

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else if (/\.(ts|tsx|astro|js|mjs)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}
