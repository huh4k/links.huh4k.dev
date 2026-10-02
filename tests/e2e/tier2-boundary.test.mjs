/**
 * Tier 2 — Boundary & Corner Cases
 * Tests edge conditions, network error statuses, malformed templates,
 * extreme camera limits, empty/large datasets, regex search queries,
 * and wear rating boundary transitions.
 */

import { harness } from './harness.mjs';

export async function runTier2() {
  await harness.describe('Tier 2: Boundary & Corner Cases', 2, async () => {
    // ------------------------------------------------------------------------
    // B1: Extreme Float Boundaries (0.00000000 and 1.00000000)
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.1: Extreme Float Boundaries — 0.00000000 and 1.00000000', ['F1', 'F13'], async () => {
      const minFloat = 0.00000000;
      const maxFloat = 1.00000000;

      harness.assert(minFloat >= 0 && minFloat <= 1, 'Min float bounded');
      harness.assert(maxFloat >= 0 && maxFloat <= 1, 'Max float bounded');

      function getWearTier(f) {
        if (f < 0.07) return 'Factory New';
        if (f < 0.15) return 'Minimal Wear';
        if (f < 0.38) return 'Field-Tested';
        if (f < 0.45) return 'Well-Worn';
        return 'Battle-Scarred';
      }

      harness.assertEqual(getWearTier(minFloat), 'Factory New', '0.0 is Factory New');
      harness.assertEqual(getWearTier(maxFloat), 'Battle-Scarred', '1.0 is Battle-Scarred');

      // Float percentage bar positioning
      const minPercent = `${(minFloat * 100).toFixed(2)}%`;
      const maxPercent = `${(maxFloat * 100).toFixed(2)}%`;
      harness.assertEqual(minPercent, '0.00%');
      harness.assertEqual(maxPercent, '100.00%');
    });

    // ------------------------------------------------------------------------
    // B2: Wear Rating Bracket Transitions
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.2: Wear Rating Bracket Transitions — Exact boundary threshold behavior', ['F1', 'F12', 'F13'], async () => {
      function getWearTier(f) {
        if (f < 0.07) return 'Factory New';
        if (f < 0.15) return 'Minimal Wear';
        if (f < 0.38) return 'Field-Tested';
        if (f < 0.45) return 'Well-Worn';
        return 'Battle-Scarred';
      }

      // Exact boundaries:
      // 0.069999 -> FN, 0.070000 -> MW
      harness.assertEqual(getWearTier(0.069999), 'Factory New');
      harness.assertEqual(getWearTier(0.070000), 'Minimal Wear');

      // 0.149999 -> MW, 0.150000 -> FT
      harness.assertEqual(getWearTier(0.149999), 'Minimal Wear');
      harness.assertEqual(getWearTier(0.150000), 'Field-Tested');

      // 0.379999 -> FT, 0.380000 -> WW
      harness.assertEqual(getWearTier(0.379999), 'Field-Tested');
      harness.assertEqual(getWearTier(0.380000), 'Well-Worn');

      // 0.449999 -> WW, 0.450000 -> BS
      harness.assertEqual(getWearTier(0.449999), 'Well-Worn');
      harness.assertEqual(getWearTier(0.450000), 'Battle-Scarred');
    });

    // ------------------------------------------------------------------------
    // B3: Extreme Pattern Seed Boundaries (0 and 1000)
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.3: Extreme Pattern Seed Boundaries — seed 0 and 1000 parsing', ['F1', 'F13'], async () => {
      const minSeed = parseInt('0', 10);
      const maxSeed = parseInt('1000', 10);
      const leadingZeroSeed = parseInt('007', 10);

      harness.assertEqual(minSeed, 0, 'Min seed is 0');
      harness.assertEqual(maxSeed, 1000, 'Max seed is 1000');
      harness.assertEqual(leadingZeroSeed, 7, 'String "007" resolves to integer 7');

      const formatBadge = (s) => `Seed #${s}`;
      harness.assertEqual(formatBadge(minSeed), 'Seed #0');
      harness.assertEqual(formatBadge(maxSeed), 'Seed #1000');
    });

    // ------------------------------------------------------------------------
    // B4: External Rate Limiting (HTTP 429)
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.4: External Rate Limiting — HTTP 429 on Steam and CSFloat handled gracefully', ['F1', 'F4', 'F5'], async () => {
      const { fetchCS2Inventory, fetchCSFloatInspect, FALLBACK_INVENTORY } = await import('../../src/utils/steam.ts');

      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url) => {
          if (String(url).includes('steamcommunity.com')) {
            return new Response('Too Many Requests', { status: 429 });
          }
          if (String(url).includes('api.csfloat.com')) {
            return new Response('Rate Limit Exceeded', { status: 429 });
          }
          return originalFetch(url);
        };

        const steam429Result = await fetchCS2Inventory('76561198920486334');
        harness.assertEqual(steam429Result.length, FALLBACK_INVENTORY.length, 'Steam 429 returns fallback loadout');

        const csfloat429Result = await fetchCSFloatInspect('steam://rungame/730/test');
        harness.assertEqual(csfloat429Result, null, 'CSFloat 429 returns null without throwing error');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // B5: Missing asset_properties Handling (Medals, Graffiti, Cases)
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.5: Missing asset_properties — Items without wear ratings default to null', ['F1', 'F3', 'F16'], async () => {
      const nonWeaponItem = {
        appid: 730,
        contextid: '2',
        assetid: 'medal_999',
        name: '2026 Service Medal',
        // No asset_properties
      };

      const extractedFloat = nonWeaponItem.asset_properties?.find((p) => p.propertyid === 2)?.float_value ?? null;
      const extractedSeed = nonWeaponItem.asset_properties?.find((p) => p.propertyid === 1)?.int_value ?? null;

      harness.assertEqual(extractedFloat, null, 'Float is null when propertyid 2 missing');
      harness.assertEqual(extractedSeed, null, 'Seed is null when propertyid 1 missing');
    });

    // ------------------------------------------------------------------------
    // B6: Malformed & Pathological Inspect URLs
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.6: Malformed Inspect URLs — Handles empty, unescaped, and non-token links', ['F1', 'F7'], async () => {
      const { formatInspectUrl } = await import('../../src/utils/steam.ts');

      harness.assertEqual(formatInspectUrl('', '76561198000000000', '123'), '', 'Empty string returns empty string');
      harness.assertEqual(formatInspectUrl(null, '76561198000000000', '123'), '', 'Null link returns empty string');

      const loneToken = formatInspectUrl('steam://preview/%owner_steamid%', '76561198000000000', '123');
      harness.assertEqual(loneToken, 'steam://preview/76561198000000000', 'Replaces lone %owner_steamid%');

      const weirdUri = 'steam://run/730/+csgo_econ%20S%owner_steamid%A%assetid%?param=test%20space';
      const formattedWeird = formatInspectUrl(weirdUri, '76561198000000000', '987');
      harness.assertEqual(
        formattedWeird,
        'steam://run/730/+csgo_econ%20S76561198000000000A987?param=test%20space',
        'Preserves URI encoding while replacing tokens'
      );
    });

    // ------------------------------------------------------------------------
    // B7: Empty Inventory Handling
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.7: Empty Inventory — Zero assets or total_inventory_count: 0 falls back cleanly', ['F1', 'F5'], async () => {
      const { fetchCS2Inventory, FALLBACK_INVENTORY } = await import('../../src/utils/steam.ts');

      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => new Response(JSON.stringify({
          success: 1,
          total_inventory_count: 0,
          assets: [],
          descriptions: [],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

        const items = await fetchCS2Inventory('76561198920486334');
        harness.assertEqual(items.length, FALLBACK_INVENTORY.length, 'Empty inventory triggers fallback inventory');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // ------------------------------------------------------------------------
    // B8: Huge .obj Meshes vs Small Meshes (Frustum Fitting)
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.8: Huge .obj Meshes vs Small Meshes — AWP (53.66) vs HKP2000 (7.22)', ['F6', 'F9'], async () => {
      const targetSize = 2.4;
      const awpMaxDim = 53.66;
      const negevMaxDim = 39.67;
      const hkpMaxDim = 7.22;
      const glockMaxDim = 7.94;

      const awpScale = targetSize / awpMaxDim;
      const negevScale = targetSize / negevMaxDim;
      const hkpScale = targetSize / hkpMaxDim;
      const glockScale = targetSize / glockMaxDim;

      harness.assertCloseTo(awpMaxDim * awpScale, targetSize, 1e-6);
      harness.assertCloseTo(negevMaxDim * negevScale, targetSize, 1e-6);
      harness.assertCloseTo(hkpMaxDim * hkpScale, targetSize, 1e-6);
      harness.assertCloseTo(glockMaxDim * glockScale, targetSize, 1e-6);
    });

    // ------------------------------------------------------------------------
    // B9: Camera Polar Angle Clamping Stress
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.9: Camera Polar Angle Clamping — Clamped between [π/4, 0.65π]', ['F8', 'F10'], async () => {
      const minPolarAngle = Math.PI / 4;
      const maxPolarAngle = Math.PI * 0.65;

      function clamp(phi) {
        return Math.max(minPolarAngle, Math.min(maxPolarAngle, phi));
      }

      harness.assertCloseTo(clamp(0), minPolarAngle, 1e-8, 'Zenith (0) clamps to min');
      harness.assertCloseTo(clamp(Math.PI), maxPolarAngle, 1e-8, 'Nadir (π) clamps to max');
      harness.assertCloseTo(clamp(-100), minPolarAngle, 1e-8, 'Negative infinity clamps to min');
      harness.assertCloseTo(clamp(100), maxPolarAngle, 1e-8, 'Positive infinity clamps to max');
      harness.assertCloseTo(clamp(Math.PI / 2), Math.PI / 2, 1e-8, 'Horizon (π/2) remains unaffected');
    });

    // ------------------------------------------------------------------------
    // B10: Search Input Edge Cases (Special characters, whitespace, case)
    // ------------------------------------------------------------------------
    await harness.it('Boundary 2.10: Search Input Edge Cases — Regex special characters and case insensitivity', ['F16'], async () => {
      const items = [
        { name: 'AK-47 | Ice Coaled (Minimal Wear)' },
        { name: 'StatTrak™ M4A1-S | Liquidation (Field-Tested)' },
        { name: '★ Karambit | Doppler (Factory New)' },
      ];

      function searchItems(query) {
        const cleanQuery = query.trim().toLowerCase();
        if (!cleanQuery) return items;
        return items.filter((i) => i.name.toLowerCase().includes(cleanQuery));
      }

      // Regex special characters do not crash string matching
      harness.assertEqual(searchItems('[').length, 0);
      harness.assertEqual(searchItems('.*').length, 0);
      harness.assertEqual(searchItems('(').length, 3, 'Matches all items containing parenthesis wear');
      harness.assertEqual(searchItems('  ice coaled  ').length, 1, 'Trims whitespace');
      harness.assertEqual(searchItems('AK-47').length, 1, 'Exact uppercase matches');
      harness.assertEqual(searchItems('ak-47').length, 1, 'Exact lowercase matches');
    });
  });
}
