/**
 * Verification Script for Milestone 1: R2 Texture Resolver & Weapon Mapping
 *
 * Runs comprehensive unit, boundary, and regression tests validating:
 * 1. Base weapon map resolution for all 35 CS2 models.
 * 2. Canonical weapon key normalizer with prefixes, skins, and edge cases.
 * 3. Paint finish URL resolution and aliases.
 * 4. Asynchronous Three.js texture loader caching, deduplication, and SSR safety.
 */

import * as THREE from 'three';
import {
  R2_BASE_URL,
  R2_PAINTS_BASE_URL,
  PAINT_FINISH_TYPES,
  BASE_WEAPON_MAPS,
  getR2WeaponTextures,
  getR2PaintFinishUrl,
  getWeaponKeyFromName,
  loadR2Texture,
  getTextureCache,
  setCachedTexture,
  clearTextureCache,
} from '../src/utils/r2Textures';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
  }
}

async function runTests() {
  console.log('\n=== Starting R2 Texture Resolver Verification Suite ===\n');

  // ============================================================================
  // Suite 1: Constants & Base URLs
  // ============================================================================
  console.log('[Suite 1: Constants & Base URLs]');
  assert(
    R2_BASE_URL === 'https://assets.huh4k.dev/cs2-textures/',
    'R2_BASE_URL matches authoritative endpoint'
  );
  assert(
    R2_PAINTS_BASE_URL === 'https://assets.huh4k.dev/cs2-textures/paints/',
    'R2_PAINTS_BASE_URL matches paints CDN endpoint'
  );
  assert(
    PAINT_FINISH_TYPES.length === 6,
    'All 6 CS2 paint finish types are defined'
  );

  // ============================================================================
  // Suite 2: AK-47 Specific Hash Signatures
  // ============================================================================
  console.log('\n[Suite 2: AK-47 VRF Hash Signatures]');
  const akTextures = getR2WeaponTextures('rif_ak47');
  assert(akTextures !== null, 'rif_ak47 returns non-null textures');
  if (akTextures) {
    assert(
      akTextures.aoUrl === `${R2_BASE_URL}rif_ak47_ao_psd_3cdda94d.png`,
      'AK-47 AO map uses exact VRF hash: rif_ak47_ao_psd_3cdda94d.png'
    );
    assert(
      akTextures.surfaceUrl === `${R2_BASE_URL}rif_ak47_surface_psd_1262e7bf.png`,
      'AK-47 Surface map uses exact VRF hash: rif_ak47_surface_psd_1262e7bf.png'
    );
    assert(
      akTextures.masksUrl === `${R2_BASE_URL}rif_ak47_masks_psd_cc08789a.png`,
      'AK-47 Masks map uses exact VRF hash: rif_ak47_masks_psd_cc08789a.png'
    );
  }

  // ============================================================================
  // Suite 3: Primary Weapon Texture Mappings
  // ============================================================================
  console.log('\n[Suite 3: Primary Weapons Resolution]');
  const primaryKeys = [
    { key: 'rif_m4a1_s', name: 'M4A1-S' },
    { key: 'snip_awp', name: 'AWP' },
    { key: 'pist_223', name: 'USP-S' },
    { key: 'pist_glock18', name: 'Glock-18' },
    { key: 'pist_deagle', name: 'Desert Eagle' },
    { key: 'smg_mac10', name: 'MAC-10' },
    { key: 'smg_ump45', name: 'UMP-45' },
    { key: 'shot_mag7', name: 'MAG-7' },
    { key: 'rif_galilar', name: 'Galil AR' },
    { key: 'snip_ssg08', name: 'SSG 08' },
    { key: 'pist_taser', name: 'Zeus x27' },
  ];

  for (const item of primaryKeys) {
    const fromKey = getR2WeaponTextures(item.key);
    assert(fromKey !== null, `${item.name} (${item.key}) resolves directly`);
    if (fromKey) {
      assert(
        fromKey.aoUrl.startsWith(R2_BASE_URL) && fromKey.aoUrl.endsWith('.png'),
        `${item.name} AO map URL is valid`
      );
      assert(
        fromKey.surfaceUrl.startsWith(R2_BASE_URL) && fromKey.surfaceUrl.endsWith('.png'),
        `${item.name} Surface map URL is valid`
      );
      assert(
        fromKey.masksUrl.startsWith(R2_BASE_URL) && fromKey.masksUrl.endsWith('.png'),
        `${item.name} Masks map URL is valid`
      );
    }

    const fromName = getR2WeaponTextures(item.name);
    assert(fromName !== null, `${item.name} resolves via display name`);
    if (fromKey && fromName) {
      assert(
        fromKey.aoUrl === fromName.aoUrl &&
        fromKey.surfaceUrl === fromName.surfaceUrl &&
        fromKey.masksUrl === fromName.masksUrl,
        `${item.name} name resolution matches key resolution`
      );
    }
  }

  // ============================================================================
  // Suite 4: Complete 35 Weapon Models Catalog Coverage
  // ============================================================================
  console.log('\n[Suite 4: 35 Weapon Model Catalog Coverage]');
  const expectedCatalogKeys = [
    'rif_ak47', 'rif_m4a1_s', 'rif_m4a4', 'rif_galilar', 'rif_famas', 'rif_aug', 'rif_sg556',
    'snip_awp', 'snip_ssg08', 'snip_g3sg1', 'snip_scar20',
    'pist_223', 'pist_glock18', 'pist_deagle', 'pist_p250', 'pist_hkp2000', 'pist_fiveseven',
    'pist_cz75a', 'pist_tec9', 'pist_elite', 'pist_revolver', 'pist_taser',
    'smg_mac10', 'smg_ump45', 'smg_mp9', 'smg_mp7', 'smg_mp5sd', 'smg_p90', 'smg_bizon',
    'shot_mag7', 'shot_nova', 'shot_sawedoff', 'shot_xm1014',
    'mach_m249', 'mach_negev',
  ];

  assert(
    expectedCatalogKeys.length === 35,
    'Expected catalog covers all 35 CS2 weapon models'
  );

  let all35Mapped = true;
  for (const modelKey of expectedCatalogKeys) {
    const textures = BASE_WEAPON_MAPS[modelKey];
    if (!textures || !textures.aoUrl || !textures.surfaceUrl || !textures.masksUrl) {
      all35Mapped = false;
      console.error(`Missing base textures for model: ${modelKey}`);
    }
  }
  assert(all35Mapped, 'Every one of the 35 CS2 models has AO, Surface, and Mask maps configured');

  // ============================================================================
  // Suite 5: Weapon Key Normalization
  // ============================================================================
  console.log('\n[Suite 5: Weapon Key Normalization]');
  const testCases: [string, string | null][] = [
    ['AK-47', 'rif_ak47'],
    ['ak47', 'rif_ak47'],
    ['AK', 'rif_ak47'],
    ['StatTrak™ AK-47 | Ice Coaled (Factory New)', 'rif_ak47'],
    ['M4A1-S', 'rif_m4a1_s'],
    ['StatTrak™ M4A1-S | Liquidation (Field-Tested)', 'rif_m4a1_s'],
    ['Souvenir M4A1-S | Welcome to the Jungle', 'rif_m4a1_s'],
    ['AWP', 'snip_awp'],
    ['AWP | Ice Coaled (Factory New)', 'snip_awp'],
    ['USP-S', 'pist_223'],
    ['USP-S | Royal Guard', 'pist_223'],
    ['Desert Eagle', 'pist_deagle'],
    ['Desert Eagle | Printstream', 'pist_deagle'],
    ['Glock-18', 'pist_glock18'],
    ['Glock-18 | Catacombs', 'pist_glock18'],
    ['MAC-10 | Candy Apple', 'smg_mac10'],
    ['UMP-45 | Late Night Transit', 'smg_ump45'],
    ['Galil AR | Control', 'rif_galilar'],
    ['Zeus x27 | Electric Blue', 'pist_taser'],
    ['MAG-7', 'shot_mag7'],
    ['weapon_rif_ak47.obj', 'rif_ak47'],
    ['/models/weapon_rif_ak47.obj', 'rif_ak47'],
    ['public/models/weapon_snip_awp.obj', 'snip_awp'],
    ['rif_ak47', 'rif_ak47'],
    ['pist_223', 'pist_223'],
    ['★ Karambit | Doppler', null],
    ['★ Butterfly Knife | Fade', null],
    ['★ Specialist Gloves | Crimson Web', null],
    ['', null],
  ];

  for (const [input, expected] of testCases) {
    const result = getWeaponKeyFromName(input);
    assert(
      result === expected,
      `Normalize "${input}" -> expected "${expected}", got "${result}"`
    );
  }

  // ============================================================================
  // Suite 6: Paint Finish Map Resolution
  // ============================================================================
  console.log('\n[Suite 6: Paint Finish Map Resolution]');
  const expectedPaints = [
    { type: 'anodized_air', expected: `${R2_PAINTS_BASE_URL}anodized_air.png` },
    { type: 'anodized_multi', expected: `${R2_PAINTS_BASE_URL}anodized_multi.png` },
    { type: 'antiqued', expected: `${R2_PAINTS_BASE_URL}antiqued.png` },
    { type: 'custom', expected: `${R2_PAINTS_BASE_URL}custom.png` },
    { type: 'gunsmith', expected: `${R2_PAINTS_BASE_URL}gunsmith.png` },
    { type: 'hydrographic', expected: `${R2_PAINTS_BASE_URL}hydrographic.png` },
  ];

  for (const paint of expectedPaints) {
    const url = getR2PaintFinishUrl(paint.type);
    assert(url === paint.expected, `Paint finish "${paint.type}" resolves to ${paint.expected}`);
  }

  // Test aliases and case normalization
  assert(
    getR2PaintFinishUrl('Gunsmith') === `${R2_PAINTS_BASE_URL}gunsmith.png`,
    'Resolves case-insensitive "Gunsmith"'
  );
  assert(
    getR2PaintFinishUrl('anodized-air') === `${R2_PAINTS_BASE_URL}anodized_air.png`,
    'Resolves hyphenated "anodized-air"'
  );
  assert(
    getR2PaintFinishUrl('custom_paint') === `${R2_PAINTS_BASE_URL}custom.png`,
    'Resolves alias "custom_paint" to custom'
  );
  assert(
    getR2PaintFinishUrl('non_existent_finish') === null,
    'Returns null for unknown paint finish'
  );
  assert(
    getR2PaintFinishUrl('') === null,
    'Returns null for empty string'
  );

  // ============================================================================
  // Suite 7: Texture Loader Resilience & In-Memory Caching
  // ============================================================================
  console.log('\n[Suite 7: Texture Loader Resilience & Caching]');

  // Test 7.1: SSR Safety Guard
  clearTextureCache();
  const testUrl = `${R2_BASE_URL}rif_ak47_ao_psd_3cdda94d.png`;
  const ssrResult = await loadR2Texture(testUrl);
  assert(
    ssrResult === null,
    'In Node.js SSR environment (window undefined), loadR2Texture returns null cleanly without throwing'
  );

  // Test 7.2: In-Memory Cache Retrieval
  const dummyTexture = new THREE.Texture();
  dummyTexture.name = 'TestCachedTexture';
  setCachedTexture(testUrl, dummyTexture);

  const cacheHit = await loadR2Texture(testUrl);
  assert(
    cacheHit === dummyTexture,
    'loadR2Texture immediately returns cached texture when present in memory'
  );

  const currentCache = getTextureCache();
  assert(
    currentCache.get(testUrl) === dummyTexture,
    'getTextureCache() reflects active in-memory cache'
  );

  // Test 7.3: Cache Clearing
  clearTextureCache();
  assert(
    getTextureCache().size === 0,
    'clearTextureCache() cleanly empties the texture cache'
  );

  // Test 7.4: Empty & Invalid Inputs
  const nullInput = await loadR2Texture('');
  assert(nullInput === null, 'Empty string URL returns null');

  // @ts-expect-error test invalid parameter type resilience
  const undefinedInput = await loadR2Texture(undefined);
  assert(undefinedInput === null, 'Undefined URL returns null');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n======================================================');
  console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
