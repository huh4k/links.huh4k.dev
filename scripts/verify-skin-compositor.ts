/**
 * Standalone Verification Suite for CS2 Weapon Skin Painter & Compositor
 *
 * Validates:
 * 1. Synchronous fallback base colors for all 9 signature CS2 weapon skins + unlisted fallbacks
 * 2. Live float wear simulation mathematics (roughness, metalness, clearcoat degradation)
 * 3. Procedural canvas texture generation (THREE.CanvasTexture with SRGBColorSpace)
 * 4. Skin resolution & weapon disambiguation (AK-47 Ice Coaled vs AWP Ice Coaled)
 * 5. Generic procedural fallback compositor
 * 6. Edge cases: null/undefined float & seed, extreme floats, custom dimensions
 */

import * as THREE from 'three';
import {
  compositeSkinFinish,
  getSkinFallbackColor,
  calculateEffectiveWear,
  normalizeSkinIdentifier,
  type SkinCompositeResult,
} from '../src/utils/skinCompositor.ts';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('CS2 WEAPON SKIN PAINTER & COMPOSITOR — VERIFICATION SUITE');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Synchronous Fallback Base Colors (getSkinFallbackColor)
  // --------------------------------------------------------------------------
  console.log('[Test 1] Immediate Synchronous Fallback Base Colors');
  {
    assert(
      getSkinFallbackColor('AK-47 | Ice Coaled') === '#00e5ff',
      'AK-47 | Ice Coaled returns radiant cyan (#00e5ff)'
    );
    assert(
      getSkinFallbackColor('StatTrak™ M4A1-S | Liquidation (Field-Tested)') === '#e11d48',
      'StatTrak™ M4A1-S | Liquidation (Field-Tested) returns crimson (#e11d48)'
    );
    assert(
      getSkinFallbackColor('AWP | Ice Coaled (Factory New)') === '#00e5ff',
      'AWP | Ice Coaled returns cyan (#00e5ff)'
    );
    assert(
      getSkinFallbackColor('USP-S | Royal Guard (Factory New)') === '#991b1b',
      'USP-S | Royal Guard returns imperial red (#991b1b)'
    );
    assert(
      getSkinFallbackColor('MAC-10 | Candy Apple') === '#dc2626',
      'MAC-10 | Candy Apple returns candy apple red (#dc2626)'
    );
    assert(
      getSkinFallbackColor('Zeus x27 | Electric Blue') === '#2563eb',
      'Zeus x27 | Electric Blue returns electric cobalt blue (#2563eb)'
    );
    assert(
      getSkinFallbackColor('Galil AR | Control') === '#3b82f6',
      'Galil AR | Control returns tactical slate blue (#3b82f6)'
    );
    assert(
      getSkinFallbackColor('Glock-18 | Catacombs') === '#18181b',
      'Glock-18 | Catacombs returns deep charcoal (#18181b)'
    );
    assert(
      getSkinFallbackColor('UMP-45 | Late Night Transit') === '#0f172a',
      'UMP-45 | Late Night Transit returns midnight slate (#0f172a)'
    );

    // Prefix & delimiter stripping
    assert(
      getSkinFallbackColor('★ Karambit | Doppler', undefined, '#8847ff') === '#8847ff',
      'Unlisted skin returns rarityColor if provided'
    );
    assert(
      getSkinFallbackColor('Desert Eagle | Printstream') === '#334155',
      'Unlisted skin without rarityColor returns gunmetal default (#334155)'
    );
    assert(
      getSkinFallbackColor(undefined, undefined, undefined) === '#334155',
      'Undefined skin/weapon/rarity returns fallback #334155'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 2: Skin Identifier Normalization
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] Skin Identifier Normalization');
  {
    const normAk = normalizeSkinIdentifier('AK-47 | Ice Coaled');
    assert(normAk.normalizedWeapon === 'ak-47', 'Normalized weapon is ak-47');
    assert(normAk.normalizedPattern === 'ice coaled', 'Normalized pattern is ice coaled');

    const normStatM4 = normalizeSkinIdentifier('StatTrak™ M4A1-S | Liquidation (Field-Tested)');
    assert(normStatM4.normalizedWeapon === 'm4a1-s', 'Strips StatTrak and extracts m4a1-s');
    assert(normStatM4.normalizedPattern === 'liquidation', 'Strips wear bracket and extracts liquidation');

    const normStarKnife = normalizeSkinIdentifier('★ Butterfly Knife | Fade (Factory New)');
    assert(normStarKnife.normalizedWeapon === 'butterfly knife', 'Strips star icon from melee weapon');
    assert(normStarKnife.normalizedPattern === 'fade', 'Extracts fade pattern');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Live Float Wear Simulation Mathematics
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Live Float Wear Simulation Mathematics');
  {
    const baseR = 0.28;
    const baseM = 0.35;
    const baseC = 0.45;

    // Factory New minimum boundary (float = 0.0)
    const fnWear = calculateEffectiveWear(baseR, baseM, baseC, 0.0);
    assert(fnWear.effectiveRoughness === baseR, 'Float 0.0: Roughness equals baseRoughness (0.28)');
    assert(fnWear.effectiveMetalness === baseM, 'Float 0.0: Metalness equals baseMetalness (0.35)');
    assert(fnWear.effectiveClearcoat === baseC, 'Float 0.0: Clearcoat equals baseClearcoat (0.45)');

    // Minimal Wear (user AK float: 0.0825)
    const mwWear = calculateEffectiveWear(baseR, baseM, baseC, 0.0825);
    assert(
      mwWear.effectiveRoughness > fnWear.effectiveRoughness,
      'MW float 0.0825: Roughness scales upward with wear'
    );
    assert(
      mwWear.effectiveClearcoat < fnWear.effectiveClearcoat && mwWear.effectiveClearcoat > 0,
      'MW float 0.0825: Clearcoat begins mild attenuation'
    );

    // Field-Tested (user M4A1-S float: 0.3438)
    const ftWear = calculateEffectiveWear(baseR, baseM, baseC, 0.3438);
    assert(
      ftWear.effectiveRoughness > mwWear.effectiveRoughness,
      'FT float 0.3438: Roughness increases further'
    );
    assert(
      ftWear.effectiveClearcoat < mwWear.effectiveClearcoat,
      'FT float 0.3438: Clearcoat substantially degraded'
    );

    // Clearcoat threshold cutoff (float > 0.55 drops strictly to 0.0)
    const cutoffWear = calculateEffectiveWear(baseR, baseM, baseC, 0.56);
    assert(cutoffWear.effectiveClearcoat === 0.0, 'Float 0.56 (> 0.55): Clearcoat drops strictly to 0.0');

    // Battle-Scarred (user UMP float: 0.8643)
    const bsWear = calculateEffectiveWear(baseR, baseM, baseC, 0.8643);
    assert(
      bsWear.effectiveRoughness >= 0.70,
      'BS float 0.8643: High roughness (> 0.70) simulating micro-abrasion'
    );
    assert(bsWear.effectiveClearcoat === 0.0, 'BS float 0.8643: Zero clearcoat remaining');
    assert(
      bsWear.effectiveMetalness > baseM,
      'BS float 0.8643: Metalness scales upward from exposed bare steel ridges'
    );

    // Anodized metalness reduction test (baseMetalness > 0.50)
    const anodizedWear = calculateEffectiveWear(0.12, 0.70, 0.85, 0.8);
    assert(
      anodizedWear.effectiveMetalness < 0.70,
      'Anodized metal (baseM 0.70) oxidizes/dulls slightly with wear'
    );

    // Clamping & edge-cases: null, negative, overflow, NaN
    const nullWear = calculateEffectiveWear(baseR, baseM, baseC, null);
    assert(nullWear.effectiveRoughness === baseR, 'Null float defaults to pristine 0.0');

    const undefWear = calculateEffectiveWear(baseR, baseM, baseC, undefined);
    assert(undefWear.effectiveRoughness === baseR, 'Undefined float defaults to pristine 0.0');

    const nanWear = calculateEffectiveWear(baseR, baseM, baseC, NaN);
    assert(nanWear.effectiveRoughness === baseR, 'NaN float defaults to pristine 0.0');

    const negWear = calculateEffectiveWear(baseR, baseM, baseC, -0.5);
    assert(negWear.effectiveRoughness === baseR, 'Negative float clamped to 0.0');

    const maxWear = calculateEffectiveWear(baseR, baseM, baseC, 2.5);
    assert(maxWear.effectiveRoughness <= 0.95, 'Overflow float clamped to 1.0 boundary');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Procedural Canvas Texture Compositing for All 9 Required Skins
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] Procedural Canvas Compositing for 9 Required Skins');
  {
    const requiredSkins = [
      {
        name: 'AK-47 | Ice Coaled',
        weapon: 'AK-47',
        float: 0.0825,
        expectedColor: '#00e5ff',
      },
      {
        name: 'StatTrak™ M4A1-S | Liquidation (Field-Tested)',
        weapon: 'M4A1-S',
        float: 0.3438,
        expectedColor: '#e11d48',
      },
      {
        name: 'AWP | Ice Coaled',
        weapon: 'AWP',
        float: 0.0631,
        expectedColor: '#00e5ff',
      },
      {
        name: 'USP-S | Royal Guard',
        weapon: 'USP-S',
        float: 0.056,
        expectedColor: '#991b1b',
      },
      {
        name: 'MAC-10 | Candy Apple',
        weapon: 'MAC-10',
        float: 0.02,
        expectedColor: '#dc2626',
      },
      {
        name: 'Zeus x27 | Electric Blue',
        weapon: 'Zeus x27',
        float: 0.04,
        expectedColor: '#2563eb',
      },
      {
        name: 'Galil AR | Control',
        weapon: 'Galil AR',
        float: 0.22,
        expectedColor: '#3b82f6',
      },
      {
        name: 'Glock-18 | Catacombs',
        weapon: 'Glock-18',
        float: 0.18,
        expectedColor: '#18181b',
      },
      {
        name: 'UMP-45 | Late Night Transit',
        weapon: 'UMP-45',
        float: 0.8643,
        expectedColor: '#0f172a',
      },
    ];

    for (const item of requiredSkins) {
      const res: SkinCompositeResult = compositeSkinFinish({
        skinName: item.name,
        weaponName: item.weapon,
        float: item.float,
        seed: 367,
      });

      assert(res.texture instanceof THREE.CanvasTexture, `${item.name}: Returns THREE.CanvasTexture`);
      assert(
        res.texture.colorSpace === THREE.SRGBColorSpace,
        `${item.name}: Texture colorSpace is THREE.SRGBColorSpace`
      );
      assert(
        res.texture.wrapS === THREE.RepeatWrapping && res.texture.wrapT === THREE.RepeatWrapping,
        `${item.name}: Texture wrap mode is RepeatWrapping`
      );
      assert(
        res.baseColorHex === item.expectedColor,
        `${item.name}: Base color is ${item.expectedColor}`
      );
      assert(
        res.effectiveRoughness >= 0.05 && res.effectiveRoughness <= 0.95,
        `${item.name}: Valid effectiveRoughness (${res.effectiveRoughness})`
      );
      assert(
        res.effectiveMetalness >= 0.1 && res.effectiveMetalness <= 0.95,
        `${item.name}: Valid effectiveMetalness (${res.effectiveMetalness})`
      );
      assert(
        res.effectiveClearcoat >= 0.0 && res.effectiveClearcoat <= 1.0,
        `${item.name}: Valid effectiveClearcoat (${res.effectiveClearcoat})`
      );
    }
  }

  // --------------------------------------------------------------------------
  // TEST 5: Weapon Disambiguation (AK-47 vs AWP Ice Coaled)
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Weapon Disambiguation (AK-47 vs AWP Ice Coaled)');
  {
    const akRes = compositeSkinFinish({
      skinName: 'Ice Coaled',
      weaponName: 'AK-47',
      float: 0.08,
    });
    const awpRes = compositeSkinFinish({
      skinName: 'Ice Coaled',
      weaponName: 'AWP',
      float: 0.06,
    });

    assert(akRes.texture instanceof THREE.CanvasTexture, 'AK-47 Ice Coaled resolves texture');
    assert(awpRes.texture instanceof THREE.CanvasTexture, 'AWP Ice Coaled resolves texture');
    assert(
      akRes.baseColorHex === '#00e5ff' && awpRes.baseColorHex === '#00e5ff',
      'Both Ice Coaled skins share cyan base hex'
    );
  }

  // --------------------------------------------------------------------------
  // TEST 6: Generic Procedural Fallback Compositor
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] Generic Procedural Fallback Compositor');
  {
    const unlistedRes = compositeSkinFinish({
      skinName: '★ Karambit | Doppler',
      weaponName: 'Karambit',
      rarityColor: '#eb4b4b',
      seed: 842,
      float: 0.015,
    });

    assert(unlistedRes.texture instanceof THREE.CanvasTexture, 'Fallback generates CanvasTexture');
    assert(unlistedRes.baseColorHex === '#eb4b4b', 'Fallback uses rarityColor (#eb4b4b)');
    assert(
      unlistedRes.effectiveClearcoat > 0,
      'Low float fallback preserves clearcoat reflection'
    );

    // Empty options fallback
    const emptyRes = compositeSkinFinish({});
    assert(emptyRes.texture instanceof THREE.CanvasTexture, 'Empty options generates valid texture');
    assert(typeof emptyRes.baseColorHex === 'string', 'Empty options provides fallback hex');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Custom Canvas Dimensions & Seed Modulation
  // --------------------------------------------------------------------------
  console.log('\n[Test 7] Custom Dimensions & Seed Modulation');
  {
    const highRes = compositeSkinFinish({
      skinName: 'MAC-10 | Candy Apple',
      width: 2048,
      height: 2048,
    });
    assert(highRes.texture.image.width === 2048, 'Custom resolution: width is 2048');
    assert(highRes.texture.image.height === 2048, 'Custom resolution: height is 2048');

    const seedA = compositeSkinFinish({
      skinName: 'M4A1-S | Liquidation',
      seed: 100,
    });
    const seedB = compositeSkinFinish({
      skinName: 'M4A1-S | Liquidation',
      seed: 999,
    });
    assert(
      seedA.texture instanceof THREE.CanvasTexture && seedB.texture instanceof THREE.CanvasTexture,
      'Different seeds generate valid textures cleanly'
    );
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
