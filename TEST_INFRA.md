# TEST_INFRA — E2E Test Infrastructure & Coverage Specification

**Project**: CS2 Steam Inventory Pipeline & 3D Weapon Model Engine Upgrade  
**Author**: `test_writer_e2e`  
**Date**: 2026-10-02  
**Status**: COMPLETE (116/116 tests passing, 100% feature coverage F1–F19 across 4 tiers)  
**Integrity Mode**: Development / Non-Bypassing  

---

## 1. Executive Summary & Philosophy

The E2E test infrastructure implements an **opaque-box, requirement-driven testing methodology** structured across **4 progressive tiers** as mandated by the Project Pattern. It validates the full CS2 server-side inventory pipeline, static 3D `.obj` and `.glb` weapon engine, homepage bottom-right loadout bento card, and dedicated `/inventory` showcase page without modifying application source code under `src/`.

### Core Testing Tenets:
1. **Opaque-Box Verification**: Tests validate public interface contracts, observable behaviors, HTTP API responses, Three.js scene graph properties, geometric transformations, and UI state logic rather than private implementation details.
2. **Progressive Testability**: Features are verified first in complete isolation (Tier 1: >=5 tests per feature covering F1–F19), then under adversarial boundaries and corner cases (Tier 2), next in pairwise cross-feature combinations (Tier 3), and finally in multi-step real-world application workflows (Tier 4). Verification mechanisms never require features more complex than what they verify.
3. **Deterministic Mocking**: Upstream network dependencies (Steam Community Inventory API and CSFloat Inspect API) are isolated using high-fidelity in-memory HTTP response mocks during testing, preventing external rate-limit exhaustion, network flakiness, or downtime.
4. **Universal CLI Invocation**: The test runner is written in native ECMAScript Modules (`.mjs`) with transparent `tsx` bridging, executing cleanly via `node tests/e2e/runner.mjs` with exit code `0` on 100% pass and code `1` on failure.

---

## 2. Directory Layout & Test Suite Architecture

```
links.huh4k.dev
├── tests/
│   └── e2e/
│       ├── harness.mjs                # Zero-dependency test harness, assertion library, and F1–F19 coverage tracker
│       ├── runner.mjs                 # CLI test runner with tier filtering, ANSI reporting, and summary tables
│       ├── tier1-features.test.mjs    # Tier 1: Isolation tests for F1–F19 (95 tests total, 5 per feature)
│       ├── tier2-boundary.test.mjs    # Tier 2: Boundary values, extreme floats/seeds, rate limits, and mesh limits (10 tests)
│       ├── tier3-combinations.test.mjs# Tier 3: Pairwise cross-feature integration flows (6 tests)
│       └── tier4-scenarios.test.mjs   # Tier 4: Real-world end-to-end user application workflows (5 scenarios)
├── TEST_INFRA.md                      # This document
└── TEST_READY.md                      # Orchestrator handoff signal file
```

---

## 3. How to Run the Tests

### Execute Full Suite (All 4 Tiers, 116 tests):
```bash
node tests/e2e/runner.mjs
```

### Execute Individual Tiers (CLI Tier Filtering):
```bash
node tests/e2e/runner.mjs --tier=1    # Tier 1: Isolation (95 tests, ~330ms)
node tests/e2e/runner.mjs --tier=2    # Tier 2: Boundary & Corner Cases (10 tests, ~10ms)
node tests/e2e/runner.mjs --tier=3    # Tier 3: Cross-Feature Combinations (6 tests, ~8.7s)
node tests/e2e/runner.mjs --tier=4    # Tier 4: Real-World Scenarios (5 tests, ~10ms)
```

All commands format clean terminal tables, print detailed failure diagnostics if assertions fail, and exit with code `0` on pass or code `1` on fail.

---

## 4. Multi-Tier Architecture & Coverage Breakdown

### Tier 1 — Feature Coverage (Isolation: F1–F19, 95 Tests)
Validates each feature independently in isolation against documented requirements (>=5 tests per feature):

- **F1 (Direct asset_properties parsing)**:
  - F1.1: Extracts `propertyid === 2` (`Wear Rating`) as exact 64-bit float.
  - F1.2: Extracts `propertyid === 1` (`Pattern Template`) as exact integer seed.
  - F1.3: Extracts `propertyid === 6` (`Item Certificate`) as hex inspect hash string.
  - F1.4: Inspect link token substitution replaces `%propid:6%` with certificate hash.
  - F1.5: Root `data.asset_properties` array maps assetid directly to wear and seed.
- **F2 (Rarity tag parsing fix)**:
  - F2.1: `getRarityFromTags` extracts `Covert` tier with `#eb4b4b`.
  - F2.2: `getRarityFromTags` extracts `Classified` tier with `#d32ce6`.
  - F2.3: `getRarityFromTags` extracts `Restricted` tier with `#8847ff`.
  - F2.4: `getRarityFromTags` extracts `Mil-Spec Grade` tier with `#4b69ff`.
  - F2.5: `getRarityFromTags` falls back cleanly to `Base Grade` with `#b0c3d9` on empty/missing tags.
- **F3 (Item category classification)**:
  - F3.1: Extracts `Rifle` category.
  - F3.2: Extracts `Pistol` category.
  - F3.3: Extracts `Sniper Rifle` category.
  - F3.4: Extracts `SMG` and `Shotgun` categories.
  - F3.5: Extracts `Collectible`, `Tool`, and non-weapon types.
- **F4 (LRU Cache Pre-Seeding)**:
  - F4.1: Pre-seeding LRU cache enables $O(1)$ zero-latency cache hits.
  - F4.2: Enforces capacity ceiling with oldest-item eviction.
  - F4.3: Cache read promotes entry to most-recently-used position.
  - F4.4: TTL expiration purges stale items.
  - F4.5: Operations (`has`, `get`, `set`, `delete`, `clear`, `size`) maintain invariant state.
- **F5 (Live Steam ID Resolution)**:
  - F5.1: Live Steam ID `76561198920486334` is a valid 17-digit SteamID64.
  - F5.2: Fallback inventory dataset contains authentic primary weapons.
  - F5.3: Fallback items have valid non-null floats, seeds, and inspect URLs.
  - F5.4: Private profile (HTTP 401/403) gracefully returns fallback loadout.
  - F5.5: Invalid Steam ID format gracefully returns fallback inventory without throwing.
- **F6 (35 .obj Model Migration)**:
  - F6.1: `public/models/` contains all 35 CS2 weapon `.obj` files.
  - F6.2: All 35 `.obj` files have non-zero size and valid Wavefront headers.
  - F6.3: Models are within Cloudflare Pages 25MB asset limit.
  - F6.4: `placeholder-weapon.glb` binary fallback exists alongside `.obj` models.
  - F6.5: `public/models/` covers all 6 CS2 weapon classes.
- **F7 (Weapon Model Mapping)**:
  - F7.1: Maps base CS2 weapons to dedicated `.obj` paths (`AK-47`, `AWP`, `M4A1-S`, `Desert Eagle`).
  - F7.2: Strips `StatTrak™`, `★`, and `Souvenir` prefixes accurately.
  - F7.3: Handles weapon skin pipes and wear suffixes.
  - F7.4: Resolves weapon aliases (`SG 553`, `Dual Berettas`, `Zeus x27`).
  - F7.5: Falls back to placeholder GLB for knives and unknown inputs.
- **F8 (ModelViewer Dual-Format Support)**:
  - F8.1: `isObjModelUrl` correctly identifies OBJ format URLs.
  - F8.2: `ModelViewer` exports all required interfaces and components.
  - F8.3: SSR mounting guard renders `ModelViewerSkeleton` without `<canvas>`.
  - F8.4: Hostile SSR traps on `window`/`document` do not throw.
  - F8.5: `ModelViewer` accepts `weaponName` and resolves model automatically.
- **F9 (OBJ Geometry Normalization)**:
  - F9.1: `computeVertexNormals` produces smooth normal vectors on BufferGeometry.
  - F9.2: `geometry.center()` translates vertices so bounding center is `(0, 0, 0)`.
  - F9.3: Scale factor normalization $targetSize / maxDim$ ($targetSize = 2.4$) scales large weapons (AWP).
  - F9.4: Scale factor normalization scales small weapons (HKP2000).
  - F9.5: Zero dimension guard prevents division by zero.
- **F10 (CS2 Weapon PBR Material)**:
  - F10.1: MeshStandardMaterial metalness is configured to `0.65`.
  - F10.2: MeshStandardMaterial roughness is configured to `0.35`.
  - F10.3: MeshStandardMaterial color hex is slate finish `#c8d1dc`.
  - F10.4: Horizontal profile rotation is $90^\circ$ around Y axis (`[0, Math.PI / 2, 0]`).
  - F10.5: Studio lighting specification verifies 5-light rig parameters.
- **F11 (WebGL Memory Cleanup)**:
  - F11.1: `disposeThreeObject` cleans up mesh geometry and material.
  - F11.2: `disposeThreeObject` cleans up multi-material arrays.
  - F11.3: `disposeThreeObject` cleans textures referenced on material properties.
  - F11.4: `disposeThreeObject` safely handles circular references without infinite loops.
  - F11.5: `disposeThreeObject` traversal does not crash on empty group or null meshes.
- **F12 (Real User Primary Loadout)**:
  - F12.1: Primary Rifle: AK-47 | Ice Coaled (Minimal Wear, float: 0.0825, seed: 367, Classified `#d32ce6`).
  - F12.2: CT Rifle: StatTrak™ M4A1-S | Liquidation (Field-Tested, float: 0.3438, seed: 937, Restricted `#8847ff`).
  - F12.3: Sniper: AWP | Ice Coaled (Factory New, float: 0.0631, seed: 309, Classified `#d32ce6`).
  - F12.4: Sidearm: USP-S | Royal Guard (Factory New, float: 0.0560, seed: 644, Restricted `#8847ff`).
  - F12.5: Knife slot maps to Combat Knife / Karambit placeholder GLB.
- **F13 (Interactive Loadout Bento Card)**:
  - F13.1: Loadout card tab switching state supports 5 weapon slots (0 to 4).
  - F13.2: Float wear bar percentage calculation maps float to percentage.
  - F13.3: Wear bracket segmentation thresholds partition `[0.0, 1.0]`.
  - F13.4: Dynamic rarity styling matches weapon tier colors.
  - F13.5: Pattern seed badge formatting displays `Seed #<seed>`.
- **F14 ([VIEW ALL SKINS] Link)**:
  - F14.1: Target route is `/inventory`.
  - F14.2: Button label contains `VIEW ALL SKINS` and directional arrow `→`.
  - F14.3: Navigation link uses same-tab routing (no `target="_blank"`).
  - F14.4: Disambiguates internal showcase link from external Steam Community link.
  - F14.5: Homepage bento card markup integrates `/inventory` button.
- **F15 (Dedicated /inventory Route)**:
  - F15.1: `/inventory` page layout structure extends BaseLayout.
  - F15.2: SSR data pre-fetching calls `fetchCS2Inventory`.
  - F15.3: Inventory page provides breadcrumb navigation back to root.
  - F15.4: Inventory telemetry header presents item count and edge status.
  - F15.5: Responsive grid specification supports 26+ items without overflow.
- **F16 (Inventory Category Filtering & Search)**:
  - F16.1: Category filter taxonomy contains all 6 required filter pills.
  - F16.2: Rifles category filter matches AK-47, M4A1-S, and Galil AR.
  - F16.3: Snipers category filter matches AWP and SSG 08.
  - F16.4: Client-side instant search matches item name case-insensitively.
  - F16.5: Empty search query returns all items; non-matching query returns 0.
- **F17 (Interactive 3D Inspect Stage)**:
  - F17.1: Clicking an item dynamically resolves its 3D model path.
  - F17.2: Selecting weapon binds accurate `.obj` path for M4A1-S.
  - F17.3: Inspect stage displays float wear and pattern seed telemetry.
  - F17.4: Direct in-game inspect URL uses `steam://` protocol.
  - F17.5: Non-weapon items (medals, stickers) fall back to thumbnail preview or placeholder.
- **F18 (Global Navigation & Command Deck)**:
  - F18.1: `BaseLayout.astro` defines navigation shell and route contract.
  - F18.2: BaseLayout displays active state indicator on `currentPath="/inventory"`.
  - F18.3: BaseLayout displays `CS2` badge for inventory navigation item.
  - F18.4: `CommandDeck.tsx` registers command with `/inventory` badge.
  - F18.5: CommandDeck action triggers navigation to `/inventory`.
- **F19 (Privacy Invariant Enforcement)**:
  - F19.1: Zero instances of personal surname in `src/` or `public/`.
  - F19.2: Zero instances of personal first name in `src/` or `public/`.
  - F19.3: Zero instances of personal email addresses in `src/` or `public/`.
  - F19.4: Zero physical address or personal location data in `src/`.
  - F19.5: Identity strictly restricted to alias `huh4k` and Steam ID `76561198920486334`.

---

### Tier 2 — Boundary & Corner Cases (10 Tests)
Tests edge conditions, network error codes, pathological inputs, and extreme camera limits:
- **Boundary 2.1**: Extreme float boundaries: exact `0.00000000` (Factory New, 0.00%) and `1.00000000` (Battle-Scarred, 100.00%).
- **Boundary 2.2**: Wear rating bracket transitions: exact boundaries `0.07` (FN/MW), `0.15` (MW/FT), `0.38` (FT/WW), `0.45` (WW/BS).
- **Boundary 2.3**: Extreme pattern seed boundaries: seed `0` and seed `1000` integer parsing and `#0` / `#1000` formatting.
- **Boundary 2.4**: External rate limiting: Steam HTTP 429 returns fallback loadout; CSFloat 429 returns null float/seed without crashing.
- **Boundary 2.5**: Missing `asset_properties`: non-weapon items without wear ratings default cleanly to `float: null`, `seed: null`.
- **Boundary 2.6**: Malformed inspect URLs: handles empty strings, null values, lone tokens, and URI-encoded query params.
- **Boundary 2.7**: Empty inventory: zero assets or `total_inventory_count: 0` triggers fallback inventory cleanly.
- **Boundary 2.8**: Huge `.obj` meshes vs small meshes: AWP (53.66 units) vs Negev (39.67 units) vs HKP2000 (7.22 units) normalized to identical scale envelope 2.4.
- **Boundary 2.9**: Camera polar angle clamping: strictly between `[π/4, 0.65π]` clamped across zenith (0), nadir (π), -100, and +100.
- **Boundary 2.10**: Search input edge cases: regex special characters (`[`, `]`, `*`, `+`, `?`, `\`, `^`, `$`), unicode characters, leading/trailing whitespace, and case insensitivity.

---

### Tier 3 — Cross-Feature Combinations (6 Tests)
Tests pairwise multi-module integration flows:
- **Combination 3.1**: `asset_properties` $\rightarrow$ `LRU cache` $\rightarrow$ `/api/inventory.json`: Seeded properties retrieved in 0ms and served via SSR endpoint HTTP 200.
- **Combination 3.2**: Weapon name $\rightarrow$ `getWeaponModelPath` $\rightarrow$ `ModelViewer OBJLoader`: Skin market name resolves dedicated `.obj` path and mounts via `ModelViewer`.
- **Combination 3.3**: Category filter pill $\rightarrow$ search query $\rightarrow$ 3D inspect stage: Clicking `[Rifles]`, querying "Ice Coaled", selects AK-47 and binds `/models/weapon_rif_ak47.obj`.
- **Combination 3.4**: Loadout tab switch $\rightarrow$ 3D model update $\rightarrow$ float bar color & seed: Switching between AK-47, M4A1-S, and AWP updates model path, rarity border, and seed badge.
- **Combination 3.5**: Fallback inventory $\rightarrow$ weapon model mapping $\rightarrow$ ModelViewer: All fallback skins resolve to valid 3D assets.
- **Combination 3.6**: Inspect link `%propid:6%` substitution $\rightarrow$ Inspect in Game action: Certificate hash replaces `%propid:6%` and formats executable in-game inspect action.

---

### Tier 4 — Real-World Application Scenarios (5 Workflows)
Simulates end-to-end user application workflows:
- **Scenario 4.1**: Full user browsing flow: Homepage loadout card $\rightarrow$ inspecting AK-47 $\rightarrow$ clicking `[VIEW ALL SKINS]` $\rightarrow$ navigating to `/inventory` $\rightarrow$ filtering by `[Rifles]` $\rightarrow$ searching "Ice Coaled" $\rightarrow$ inspecting 3D model $\rightarrow$ opening inspect link.
- **Scenario 4.2**: Loadout tab switching: CT Rifle (M4A1-S FT 0.3438) $\rightarrow$ Sniper (AWP FN 0.0631) $\rightarrow$ Sidearm (USP-S FN 0.0560) $\rightarrow$ Knife (Combat Knife) with dynamic metric & model updates.
- **Scenario 4.3**: Collectibles inspection: Filter `[Collectibles]` $\rightarrow$ select 2026 Service Medal $\rightarrow$ verify certificate hash $\rightarrow$ verify null float/seed and GLB placeholder.
- **Scenario 4.4**: Rate-limit resilience: Steam Community 429 rate limit triggers authentic fallback $\rightarrow$ filter `[Pistols]` $\rightarrow$ inspect USP-S Royal Guard.
- **Scenario 4.5**: Command Deck quick launcher: Trigger Command Deck $\rightarrow$ invoke `/inventory` action $\rightarrow$ filter `[SMGs & Heavy]` $\rightarrow$ inspect UMP-45 Late Night Transit (Battle-Scarred, float 0.8642, seed 248).

---

## 5. Summary Matrix & Thresholds

| Tier | Suite Name | Test Count | Pass Rate | Target Time | Observed Time | Status |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| **Tier 1** | Feature Coverage (Isolation F1–F19) | 95 | 100% (95/95) | < 2000ms | ~327ms | **PASS** |
| **Tier 2** | Boundary & Corner Cases | 10 | 100% (10/10) | < 1000ms | ~1ms | **PASS** |
| **Tier 3** | Cross-Feature Combinations | 6 | 100% (6/6) | < 10000ms | ~8762ms | **PASS** |
| **Tier 4** | Real-World Application Scenarios | 5 | 100% (5/5) | < 1000ms | ~1ms | **PASS** |
| **TOTAL** | **All 4 Tiers** | **116** | **100% (116/116)** | **< 15000ms** | **~9106ms** | **PASS** |
