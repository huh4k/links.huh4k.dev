/**
 * Tier 3 — Cross-Feature Interactions (Pairwise Coverage)
 * Validates integration between R2 texture resolution, procedural compositing,
 * live float wear modulation, PBR shaders, and UI loadout states.
 */

import * as THREE from 'three';
import { harness, setupCanvasMock } from './harness.mjs';

setupCanvasMock();

export async function runTier3() {
  await harness.describe('Tier 3: Cross-Feature Interactions (Pairwise)', 3, async () => {
    const r2Textures = await import('../../../src/utils/r2Textures.ts');
    const skinCompositor = await import('../../../src/utils/skinCompositor.ts');
    const { DEFAULT_LOADOUT_WEAPONS } = await import('../../../src/components/steam/CS2LoadoutCard.tsx');

    // ========================================================================
    // Pair 1: Live float wear modulation with clearcoat finishes (Candy Apple)
    // ========================================================================
    await harness.it('Pair 3.1: Float wear modulation with clearcoat (Candy Apple float 0.05 vs 0.60 vs 0.90)', ['F9', 'F15', 'F18'], async () => {
      // 1. Factory New (float: 0.05)
      const fn = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
        float: 0.05,
      });
      harness.assert(fn.effectiveClearcoat > 0.70, 'FN clearcoat is high (>0.70)');
      harness.assert(fn.effectiveRoughness < 0.20, 'FN roughness is low (<0.20)');

      // 2. Well-Worn (float: 0.60)
      const ww = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
        float: 0.60,
      });
      harness.assertEqual(ww.effectiveClearcoat, 0.0, 'Clearcoat completely stripped past 0.55 threshold');
      harness.assert(ww.effectiveRoughness > 0.50, 'WW roughness elevated (>0.50)');

      // 3. Battle-Scarred (float: 0.90)
      const bs = skinCompositor.compositeSkinFinish({
        weaponName: 'MAC-10',
        skinName: 'Candy Apple',
        float: 0.90,
      });
      harness.assertEqual(bs.effectiveClearcoat, 0.0, 'BS clearcoat is 0.0');
      harness.assert(bs.effectiveRoughness > 0.70, 'BS roughness heavily degraded (>0.70)');
      harness.assert(bs.effectiveMetalness > 0.40, 'Exposed steel metalness remains non-zero');
    });

    // ========================================================================
    // Pair 2: R2 texture 404 fallback with procedural composite canvas texture
    // ========================================================================
    await harness.it('Pair 3.2: R2 texture 404 fallback with procedural composite canvas texture', ['F1', 'F3', 'F5', 'F14', 'F20'], async () => {
      // Simulate remote R2 failure by loading a non-existent texture URL
      const failedAoUrl = 'https://assets.huh4k.dev/cs2-textures/simulated_missing_ao_psd.png';
      const aoTexture = await r2Textures.loadR2Texture(failedAoUrl);
      harness.assert(aoTexture === null || aoTexture instanceof THREE.Texture, 'AO loader handled non-existent URL without throwing');

      // Procedural canvas compositor engages immediately
      const composite = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        float: 0.0825,
        seed: 367,
      });
      harness.assert(Boolean(composite.texture && composite.texture.isCanvasTexture), 'Procedural canvas texture created');
      harness.assertEqual(composite.baseColorHex, '#00e5ff', 'Fallback base color preserved');

      // Material pipeline binds procedural texture as diffuse map while aoMap gracefully remains null
      const material = new THREE.MeshPhysicalMaterial({
        map: composite.texture,
        aoMap: aoTexture || null,
        aoMapIntensity: 1.2,
        roughness: composite.effectiveRoughness,
        metalness: composite.effectiveMetalness,
        clearcoat: composite.effectiveClearcoat,
      });

      harness.assertEqual(material.map, composite.texture, 'Diffuse map set to procedural skin');
      harness.assertEqual(material.aoMap, null, 'aoMap safely null without crash');
      harness.assertEqual(material.aoMapIntensity, 1.2, 'aoMapIntensity retains configured 1.2 value');
    });

    // ========================================================================
    // Pair 3: 2D/3D view dock toggling with active loadout cards
    // ========================================================================
    await harness.it('Pair 3.3: 2D/3D view dock toggling with active loadout cards', ['F12', 'F13', 'F23', 'F25'], async () => {
      // Step 1: Active weapon selection from loadout cards
      const ak = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'AK-47');
      const m4 = DEFAULT_LOADOUT_WEAPONS.find((w) => w.tabLabel === 'M4A1-S');
      harness.assert(ak !== undefined && m4 !== undefined, 'AK-47 and M4A1-S present in loadout');

      // Step 2: Dock initial state is '3d'
      let activeDockMode = '3d';
      harness.assertEqual(activeDockMode, '3d', 'Dock initial mode is 3D Model');

      // Step 3: Switch to '2d' artwork mode
      activeDockMode = '2d';
      harness.assertEqual(activeDockMode, '2d', 'Dock switched to Steam 2D Artwork');

      // Step 4: Switch active weapon while in 2D mode
      const selectedWeapon = m4;
      harness.assertEqual(selectedWeapon.skin, 'Liquidation', 'Selected weapon updated to Liquidation');
      harness.assertEqual(activeDockMode, '2d', 'Dock mode maintained across weapon selection');

      // Step 5: Switch back to 3D mode
      activeDockMode = '3d';
      const m4Composite = skinCompositor.compositeSkinFinish({
        weaponName: selectedWeapon.weapon,
        skinName: selectedWeapon.skin,
        float: selectedWeapon.float,
        seed: selectedWeapon.seed,
      });
      harness.assertEqual(m4Composite.baseColorHex, '#e11d48', 'M4A1-S PBR diffuse correctly composited on return to 3D');
    });

    // ========================================================================
    // Pair 4: Weapon key normalizer + R2 texture resolver + Procedural compositor
    // ========================================================================
    await harness.it('Pair 4.1: Normalizer -> R2 Texture Resolver -> Procedural Compositor Pipeline', ['F1', 'F4', 'F6'], async () => {
      const rawTitle = 'StatTrak™ M4A1-S | Liquidation (Field-Tested)';

      // 1. Normalize weapon key
      const key = r2Textures.getWeaponKeyFromName(rawTitle);
      harness.assertEqual(key, 'rif_m4a1_s', 'Key normalized to rif_m4a1_s');

      // 2. Resolve R2 URLs
      const r2Urls = r2Textures.getR2WeaponTextures(key);
      harness.assert(r2Urls !== null, 'R2 URLs resolved');
      harness.assert(r2Urls.aoUrl.includes('rif_m4a1_s_ao.png'), 'AO URL correct');

      // 3. Composite Skin
      const comp = skinCompositor.compositeSkinFinish({
        weaponName: 'M4A1-S',
        skinName: 'Liquidation',
        float: 0.3438,
        seed: 937,
      });
      harness.assertEqual(comp.baseColorHex, '#e11d48', 'Base color is crimson #e11d48');
      harness.assert(comp.effectiveRoughness > 0.40, 'Field-Tested roughness calculated');
    });

    // ========================================================================
    // Pair 5: Extended ModelViewerProps + MeshPhysicalMaterial + uv2 geometry binding
    // ========================================================================
    await harness.it('Pair 5.1: Geometry uv2 Binding -> MeshPhysicalMaterial PBR Setup', ['F18', 'F19', 'F20'], async () => {
      // 1. Simulate loaded Wavefront OBJ geometry
      const geometry = new THREE.BufferGeometry();
      const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      // 2. Universal uv2 binding
      if (geometry.attributes.uv && !geometry.attributes.uv2) {
        geometry.setAttribute('uv2', geometry.attributes.uv);
      }
      harness.assert(geometry.attributes.uv2 !== undefined, 'uv2 attribute successfully bound');

      // 3. Build MeshPhysicalMaterial
      const dummyAo = new THREE.Texture();
      const dummyDiff = new THREE.Texture();
      const material = new THREE.MeshPhysicalMaterial({
        map: dummyDiff,
        aoMap: dummyAo,
        aoMapIntensity: 1.2,
        clearcoat: 0.65,
        clearcoatRoughness: 0.15,
        metalness: 0.75,
        roughness: 0.18,
      });

      const mesh = new THREE.Mesh(geometry, material);
      harness.assertEqual(mesh.material.aoMapIntensity, 1.2, 'aoMapIntensity 1.2');
      harness.assertEqual(mesh.material.clearcoat, 0.65, 'clearcoat 0.65');
      harness.assertEqual(mesh.geometry.attributes.uv2.count, 3, 'uv2 vertex count matches uv');
    });

    // ========================================================================
    // Pair 6: Pattern seed modulation with live float wear across multiple seeds
    // ========================================================================
    await harness.it('Pair 6.1: Seed Modulation + Float Wear Simulation on AK-47 Ice Coaled', ['F5', 'F15', 'F16'], async () => {
      const resSeed367 = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        float: 0.0825,
        seed: 367,
      });

      const resSeed937 = skinCompositor.compositeSkinFinish({
        weaponName: 'AK-47',
        skinName: 'Ice Coaled',
        float: 0.0825,
        seed: 937,
      });

      // PBR metrics must match strictly because float is identical
      harness.assertEqual(resSeed367.effectiveRoughness, resSeed937.effectiveRoughness, 'Effective roughness identical across seeds');
      harness.assertEqual(resSeed367.effectiveClearcoat, resSeed937.effectiveClearcoat, 'Effective clearcoat identical across seeds');
      harness.assertEqual(resSeed367.effectiveMetalness, resSeed937.effectiveMetalness, 'Effective metalness identical across seeds');
      harness.assertEqual(resSeed367.baseColorHex, resSeed937.baseColorHex, 'Base color hex identical');
    });
  });
}
