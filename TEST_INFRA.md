# TEST_INFRA — E2E Test Infrastructure & Coverage Specification

**Project**: CS2 R2 Texture Integration & PBR Shader Upgrade  
**Author**: `test_writer_e2e_r3`  
**Date**: 2026-10-03  
**Status**: COMPLETE (282/282 tests passing, 100% feature coverage F1–F26 across 4 tiers + full regression pass)  
**Integrity Mode**: Development / Non-Bypassing  

---

## 1. Executive Summary & Philosophy

The E2E test infrastructure implements an **opaque-box, requirement-driven testing methodology** structured across **4 progressive tiers** as mandated by the Project Pattern. It thoroughly exercises the CS2 Cloudflare R2 texture asset pipeline (`src/utils/r2Textures.ts`), the procedural weapon skin finish compositor and live wear simulation engine (`src/utils/skinCompositor.ts`), the Three.js studio PBR shader system (`src/components/ModelViewer.tsx`), the homepage bento loadout cards (`src/components/steam/CS2LoadoutCard.tsx`), and the full inventory 3D inspect stage with 3-way inspect view dock (`src/components/steam/InventoryExplorer.tsx`).

### Core Testing Tenets:
1. **Opaque-Box Verification**: Tests validate public interface contracts, mathematical invariants, observable behaviors, Three.js scene graph states, material parameters (`MeshPhysicalMaterial`), UV geometry bindings (`uv2`), and UI workflows rather than internal implementation details.
2. **Progressive Testability**: Features are verified first in complete isolation (Tier 1: >=5 tests per feature covering all 26 features F1–F26, 130 tests total), then under adversarial boundaries and corner cases (Tier 2: 25 tests), next in pairwise cross-feature combinations (Tier 3: 6 tests), and finally in multi-step real-world application workflows (Tier 4: 5 multi-step journeys).
3. **Resilient Non-Blocking Assertions**: Upstream network dependencies (Cloudflare R2 CDN, Steam Community API, CSFloat) are tested against simulated 404s, CORS restrictions, and network timeouts to guarantee zero unhandled rejections, smooth procedural canvas fallback, and instant synchronous base colors.
4. **Universal CLI Invocation**: The test runner is written in native ECMAScript Modules (`.mjs`) with transparent `tsx` bridging, executing cleanly via `node tests/e2e/runner.mjs` with exit code `0` on 100% pass and code `1` on failure.
5. **Zero Regression Guarantee**: Runs both the newly implemented 166-test R2 Texture & PBR Upgrade suite and the 116-test Steam pipeline & 3D model engine regression suite (282 tests total).

---

## 2. Directory Layout & Test Suite Architecture
```
links.huh4k.dev
├── tests/
│   ├── e2e/
│   │   ├── runner.mjs                         # Master CLI test runner (supports --tier and --suite)
│   │   ├── harness.mjs                        # Legacy pipeline test harness (F1–F19)
│   │   ├── tier1-features.test.mjs            # Pipeline Tier 1: Isolation tests (95 tests)
│   │   ├── tier2-boundary.test.mjs            # Pipeline Tier 2: Boundary & Corner Cases (10 tests)
│   │   ├── tier3-combinations.test.mjs        # Pipeline Tier 3: Cross-Feature Combinations (6 tests)
│   │   ├── tier4-scenarios.test.mjs           # Pipeline Tier 4: Real-World Scenarios (5 tests)
│   │   └── r2-texture-pbr/                    # CS2 R2 Texture & PBR Upgrade Test Suite
│   │       ├── harness.mjs                    # R2 PBR harness, assertions & F1–F26 tracker
│   │       ├── tier1-features.test.mjs        # Tier 1: Isolation tests for F1–F26 (130 tests)
│   │       ├── tier2-boundary.test.mjs        # Tier 2: Extreme float/seed & 404 tests (25 tests)
│   │       ├── tier3-combinations.test.mjs    # Tier 3: Pairwise cross-feature flows (6 tests)
│   │       └── tier4-scenarios.test.mjs       # Tier 4: Real-world user journeys (5 tests)
├── TEST_INFRA.md                              # This document
└── TEST_READY.md                              # Signoff and readiness publication report
```

---

## 3. How to Run the Tests

### Execute Full Test Suite (Both Suites, 282 tests):
```bash
node tests/e2e/runner.mjs
```

### Execute Only R2 Texture & PBR Upgrade Suite (166 tests):
```bash
node tests/e2e/runner.mjs --suite=r2
```

### Execute Only Pipeline Regression Suite (116 tests):
```bash
node tests/e2e/runner.mjs --suite=pipeline
```

### Execute Specific Tiers:
```bash
node tests/e2e/runner.mjs --tier=1             # Tier 1: Feature Coverage (225 tests)
node tests/e2e/runner.mjs --tier=2             # Tier 2: Boundary & Corner Cases (35 tests)
node tests/e2e/runner.mjs --tier=3             # Tier 3: Cross-Feature Interactions (12 tests)
node tests/e2e/runner.mjs --tier=4             # Tier 4: Real-World Scenarios (10 tests)
node tests/e2e/runner.mjs --tier=1 --suite=r2  # R2 Tier 1 only (130 tests, ~350ms)
```

All commands format clean terminal tables, print detailed failure diagnostics if assertions fail, and exit with code `0` on pass or code `1` on fail.

---

## 4. Multi-Tier Architecture & Coverage Breakdown (F1–F26)

### Tier 1 — Feature Coverage in Isolation (130 Tests, 5 per feature)
Validates each feature independently in isolation against documented requirements:

- **F1 (R2 Base Weapon Map Resolution)**:
  - F1.1: AK-47 resolves authentic AO, Surface, and Masks maps with Source 2 VRF asset hashes (`rif_ak47_ao_psd_3cdda94d.png`, `rif_ak47_surface_psd_1262e7bf.png`, `rif_ak47_masks_psd_cc08789a.png`).
  - F1.2: M4A1-S resolves canonical AO, Surface, and Masks maps (`rif_m4a1_s_ao.png`).
  - F1.3: AWP resolves canonical AO, Surface, and Masks maps (`snip_awp_ao.png`).
  - F1.4: USP-S resolves `pist_223` canonical texture maps.
  - F1.5: Handles secondary weapons and returns null for unrecognized items or knives.
- **F2 (R2 Paint Finish Map Resolution)**:
  - F2.1: Resolves `anodized_air` finish to `paints/anodized_air.png`.
  - F2.2: Resolves `gunsmith` finish to `paints/gunsmith.png`.
  - F2.3: Resolves `custom` finish to `paints/custom.png` with alias handling.
  - F2.4: Resolves `antiqued`, `anodized_multi`, and `hydrographic` finishes.
  - F2.5: Returns null for unknown finish or empty/whitespace input.
- **F3 (Asynchronous Cached Texture Loader)**:
  - F3.1: `loadR2Texture` handles SSR environment safely without throwing.
  - F3.2: `getTextureCache` and `setCachedTexture` allow manual injection and cache inspection.
  - F3.3: `clearTextureCache` purges cached textures cleanly.
  - F3.4: Invalid or empty URL returns null without throwing unhandled exceptions.
  - F3.5: Deduplicates cache hits, returning identical texture instance.
- **F4 (Weapon Key Normalizer)**:
  - F4.1: Normalizes "AK-47" and "AK-47 | Ice Coaled" to "rif_ak47".
  - F4.2: Normalizes "StatTrak™ M4A1-S | Liquidation" to "rif_m4a1_s".
  - F4.3: Normalizes "AWP | Ice Coaled" to "snip_awp" and "USP-S | Royal Guard" to "pist_223".
  - F4.4: Normalizes "Zeus x27", "MAC-10", "UMP-45", "Galil AR", "Glock-18".
  - F4.5: Returns null for knives, collectibles, or empty string.
- **F5 (AK-47 | Ice Coaled Composite)**:
  - F5.1: `getSkinFallbackColor` for AK-47 Ice Coaled returns radiant cyan `#00e5ff`.
  - F5.2: Base PBR values: metalness 0.35, roughness 0.28, clearcoat 0.45.
  - F5.3: `compositeSkinFinish` generates `CanvasTexture` with `sRGB` color space.
  - F5.4: RepeatWrapping configured on `wrapS` and `wrapT`.
  - F5.5: Minimal Wear float (0.0825) preserves clearcoat > 0.35.
- **F6 (M4A1-S | Liquidation Composite)**:
  - F6.1: `getSkinFallbackColor` for M4A1-S Liquidation returns crimson `#e11d48`.
  - F6.2: Base PBR values: metalness 0.45, roughness 0.32, clearcoat 0.35.
  - F6.3: `compositeSkinFinish` generates `CanvasTexture` with `sRGB` color space.
  - F6.4: Field-Tested float (0.3438) yields moderate roughness and attenuated clearcoat.
  - F6.5: Base color hex matches `#e11d48`.
- **F7 (AWP | Ice Coaled Composite)**:
  - F7.1: `getSkinFallbackColor` for AWP Ice Coaled returns `#00e5ff`.
  - F7.2: Base PBR values: metalness 0.30, roughness 0.22, clearcoat 0.50.
  - F7.3: Factory New float (0.0631) maintains clearcoat > 0.40 and roughness < 0.30.
  - F7.4: `compositeSkinFinish` generates `CanvasTexture` with `sRGB` color space.
  - F7.5: Base color hex matches `#00e5ff`.
- **F8 (USP-S | Royal Guard Composite)**:
  - F8.1: `getSkinFallbackColor` for USP-S Royal Guard returns deep imperial red `#991b1b`.
  - F8.2: Base PBR values: metalness 0.75, roughness 0.18, clearcoat 0.65.
  - F8.3: Factory New float (0.0560) retains high clearcoat > 0.50 and high metalness > 0.70.
  - F8.4: `compositeSkinFinish` generates `CanvasTexture` with `sRGB` color space.
  - F8.5: Base color hex matches `#991b1b`.
- **F9 (MAC-10 | Candy Apple Composite)**:
  - F9.1: `getSkinFallbackColor` for MAC-10 Candy Apple returns candy apple red `#dc2626`.
  - F9.2: Base PBR values: metalness 0.70, roughness 0.12, clearcoat 0.85.
  - F9.3: Factory New float (0.02) yields high clearcoat > 0.75 (high-gloss enamel).
  - F9.4: `compositeSkinFinish` generates `CanvasTexture` with `sRGB` color space.
  - F9.5: Base color hex matches `#dc2626`.
- **F10 (Zeus x27 | Electric Blue Composite)**:
  - F10.1: `getSkinFallbackColor` for Zeus x27 Electric Blue returns cobalt blue `#2563eb`.
  - F10.2: Base PBR values: metalness 0.30, roughness 0.35, clearcoat 0.20.
  - F10.3: `compositeSkinFinish` generates `CanvasTexture` with `sRGB` color space.
  - F10.4: Seed modulation generates deterministically.
  - F10.5: Base color hex matches `#2563eb`.
- **F11 (Galil AR | Control Composite)**:
  - F11.1: `getSkinFallbackColor` for Galil AR Control returns tactical slate blue `#3b82f6`.
  - F11.2: Base PBR values: metalness 0.45, roughness 0.38, clearcoat 0.15.
  - F11.3: `compositeSkinFinish` generates `CanvasTexture` with `sRGB` color space.
  - F11.4: Base color hex is non-empty hex.
  - F11.5: Seed variation adjusts tactical layout parameters.
- **F12 (Glock-18 | Catacombs Composite)**:
  - F12.1: `getSkinFallbackColor` for Glock-18 Catacombs returns dark slide hex `#18181b`.
  - F12.2: Base PBR values: metalness 0.20, roughness 0.42, clearcoat 0.10.
  - F12.3: `compositeSkinFinish` generates `CanvasTexture` with `sRGB` color space.
  - F12.4: Seed alters procedural skull coordinates.
  - F12.5: Returns valid `SkinCompositeResult`.
- **F13 (UMP-45 | Late Night Transit Composite)**:
  - F13.1: `getSkinFallbackColor` for UMP-45 Late Night Transit returns midnight chassis `#0f172a`.
  - F13.2: Base PBR values: metalness 0.75, roughness 0.70, clearcoat 0.0.
  - F13.3: Battle-Scarred float (0.8643) drives effective clearcoat strictly to 0.0.
  - F13.4: Battle-Scarred float drives effective roughness > 0.75 and effective metalness > 0.50.
  - F13.5: `compositeSkinFinish` generates `CanvasTexture` with `sRGB` color space.
- **F14 (Generic Procedural Fallback Compositor)**:
  - F14.1: Generates procedural texture for arbitrary unlisted skin.
  - F14.2: Respects `rarityColor` prop (`#eb4b4b` for Covert).
  - F14.3: Falls back to default color when `rarityColor` is omitted.
  - F14.4: Returns valid `SkinCompositeResult` with all 5 required properties.
  - F14.5: Produces `CanvasTexture` with `RepeatWrapping`.
- **F15 (Live Float Wear Simulation Mathematics)**:
  - F15.1: `calculateEffectiveWear` at float 0.00 preserves base pristine parameters.
  - F15.2: `calculateEffectiveWear` at float 1.00 increases roughness to maximum ~0.85 and sets clearcoat to 0.0.
  - F15.3: `calculateEffectiveWear` drops clearcoat strictly to 0.0 for any float > 0.55.
  - F15.4: `calculateEffectiveWear` gracefully handles null and undefined float (defaults to 0.0).
  - F15.5: `calculateEffectiveWear` clamps negative float (<0) and overflow float (>1).
- **F16 (Pattern Seed Modulation)**:
  - F16.1: Seed 0 evaluates to valid baseline deterministic pattern.
  - F16.2: Seed 1000 evaluates without overflow or NaN.
  - F16.3: Null or undefined seed defaults safely to 0.
  - F16.4: Seed variation does not alter calculated wear parameters.
  - F16.5: Negative seeds are safely handled without crash.
- **F17 (Extended ModelViewerProps)**:
  - F17.1: `ModelViewerProps` interface accepts `float: number | null`.
  - F17.2: `ModelViewerProps` interface accepts `seed: number | null`.
  - F17.3: `ModelViewerProps` interface accepts `rarityColor: string`.
  - F17.4: `ModelViewerProps` interface accepts `skinName: string`.
  - F17.5: `ModelViewerProps` handles omission of new props with backward compatibility.
- **F18 (MeshPhysicalMaterial Upgrade)**:
  - F18.1: CS2 weapon meshes configure `THREE.MeshPhysicalMaterial`.
  - F18.2: Material supports `clearcoat` property.
  - F18.3: Material supports `clearcoatRoughness` property.
  - F18.4: Material `metalness` and `roughness` values are bounded in `[0, 1]`.
  - F18.5: Material `side` is configured to `THREE.FrontSide`.
- **F19 (Three.js uv2 Attribute Binding)**:
  - F19.1: Assigns `geometry.attributes.uv2` from `geometry.attributes.uv` for `aoMap` shader.
  - F19.2: `geometry.attributes.uv2` has identical count and itemSize to `uv`.
  - F19.3: If `uv2` already exists, does not throw or corrupt geometry.
  - F19.4: Handles geometry without UVs without throwing unhandled exceptions.
  - F19.5: Cloned meshes maintain valid `uv2` buffer attributes.
- **F20 (AO & Surface & Diffuse Texture Binding)**:
  - F20.1: `MeshPhysicalMaterial` binds `aoMap` with `aoMapIntensity = 1.2`.
  - F20.2: `MeshPhysicalMaterial` binds `roughnessMap` to surface texture.
  - F20.3: `MeshPhysicalMaterial` binds `map` to composited skin diffuse texture.
  - F20.4: If `aoTexture` is null, `material.aoMap` remains null/undefined without throwing.
  - F20.5: If `surfaceTexture` is null, `material.roughnessMap` remains null/undefined without throwing.
- **F21 (Synchronous Fallback Colors)**:
  - F21.1: `getSkinFallbackColor` is synchronous (returns string immediately).
  - F21.2: Returns `#00e5ff` for "Ice Coaled".
  - F21.3: Returns `#e11d48` for "Liquidation".
  - F21.4: Returns `#dc2626` for "Candy Apple".
  - F21.5: Returns fallback color when skin name is unknown or empty.
- **F22 (WebGL Resource Disposal)**:
  - F22.1: `disposeThreeObject` cleans up `MeshPhysicalMaterial`.
  - F22.2: `disposeThreeObject` disposes attached textures (`map`, `aoMap`, `roughnessMap`).
  - F22.3: `CanvasTexture` disposal reclaims resources without error.
  - F22.4: `disposeThreeObject` handles null / empty groups safely.
  - F22.5: Repeated disposal calls are idempotent and do not throw.
- **F23 (CS2LoadoutCard Integration)**:
  - F23.1: `DEFAULT_LOADOUT_WEAPONS` contains AK-47 Ice Coaled with float 0.0825, seed 367.
  - F23.2: `DEFAULT_LOADOUT_WEAPONS` contains M4A1-S Liquidation with float 0.3438, seed 937.
  - F23.3: `DEFAULT_LOADOUT_WEAPONS` contains AWP Ice Coaled with float 0.0631, seed 309.
  - F23.4: `DEFAULT_LOADOUT_WEAPONS` contains USP-S Royal Guard with float 0.0560, seed 644.
  - F23.5: `CS2LoadoutCard` weapons provide `rarityColor` for PBR fallback styling.
- **F24 (InventoryExplorer 3D Stage Integration)**:
  - F24.1: `InventoryExplorer` provides wear tier mapping helper `getWearTier`.
  - F24.2: `getWearTier` handles null float safely without throwing.
  - F24.3: `InventoryExplorer` category filter taxonomy matches all 6 required classes.
  - F24.4: `matchesCategory` correctly classifies items.
  - F24.5: `normalizeSkinIdentifier` extracts `weaponBase` and `skinName` tokens.
- **F25 (Inspect View Dock Toggle)**:
  - F25.1: Inspect view dock supports 3-way toggle options: 3D Model, Steam 2D Artwork, Launch CS2 Inspect.
  - F25.2: Default inspect view mode is 3D Model.
  - F25.3: Switching to 2D artwork view toggles visible view container.
  - F25.4: Launch CS2 Inspect button provides valid `steam://` inspect link.
  - F25.5: View dock buttons are accessible and maintain state across items.
- **F26 (Privacy Invariant Enforcement)**:
  - F26.1: Zero personal surname ("cafici") in `src/`.
  - F26.2: Zero personal first name ("charlie") in `src/`.
  - F26.3: Zero personal email addresses in `src/`.
  - F26.4: Zero physical addresses or local user paths in client code.
  - F26.5: User identity strictly constrained to alias `huh4k` and Steam ID `76561198920486334`.

---

### Tier 2 — Boundary & Corner Cases (25 Tests)
- **Extreme Float Boundaries**: 0.00 Factory New pristine, 1.00 Battle-Scarred, wear bracket boundaries (0.07, 0.15, 0.38, 0.45), null/undefined defaults, and hostile NaN/negative/overflow clamping.
- **Extreme Pattern Seed Boundaries**: Seed 0 baseline coordinates, Seed 1000 max CS2 seed, null/undefined defaults, large seeds >1,000,000, and negative seeds.
- **Network Failure & 404 Simulation**: Non-blocking returns on missing AO, Surface, and Mask maps; invalid URL protocols; repeated sequential failed requests deduplicated without hammering; non-string inputs safely handled.
- **Rapid Tab Switching & Unmount Memory**: 10 rapid skin compositing cycles without context collision; idempotent double disposal of `CanvasTexture`; instantaneous PBR restoration when switching between BS and FN skins; `disposeThreeObject` recursive cleanup; empty group safety.
- **Collectibles & Non-Weapon Fallbacks**: Medals/Pins return null for weapon maps; non-weapon items return null weapon keys; fallback colors default to tactical hex; generic compositor handles collectibles safely; knives fallback to Doppler rarity styling.

---

### Tier 3 — Cross-Feature Interactions (6 Tests)
- **Pair 3.1**: Live float wear modulation with clearcoat (Candy Apple at float 0.05, 0.60, 0.90) verifying continuous clearcoat loss and strict zeroing past 0.55.
- **Pair 3.2**: R2 texture 404 fallback combined with procedural composite canvas texture and `MeshPhysicalMaterial` PBR setup (`aoMapIntensity: 1.2`).
- **Pair 3.3**: 2D/3D inspect view dock toggling with active loadout cards preserving weapon telemetry and state across 3D and 2D modes.
- **Pair 3.4**: Weapon key normalizer -> R2 Texture Resolver -> Procedural Compositor end-to-end pipeline.
- **Pair 3.5**: Geometry `uv2` attribute binding -> `MeshPhysicalMaterial` PBR shader initialization.
- **Pair 3.6**: Pattern seed modulation + float wear simulation on AK-47 Ice Coaled across seeds 367 and 937.

---

### Tier 4 — Real-World Application Scenarios (5 Scenarios)
- **Scenario 4.1**: Full primary loadout inspection journey (AK-47 -> M4A1-S -> AWP -> USP-S) verifying PBR parameters, clearcoat values, and memory reclamation.
- **Scenario 4.2**: Inventory Explorer search, category filtering, 3D inspect stage, 2D artwork viewing, and `steam://` in-game launch URL generation.
- **Scenario 4.3**: Low-wear vs high-wear side-by-side comparison (Factory New MAC-10 Candy Apple vs Battle-Scarred UMP-45 Late Night Transit).
- **Scenario 4.4**: Complete CDN outage & offline recovery simulating 100% remote R2 failure with immediate synchronous fallback colors and procedural generation.
- **Scenario 4.5**: Repository-wide privacy and anonymity verification invariant ensuring zero personal names, emails, or physical paths across the entire codebase.

---

## 5. Coverage Matrix & Results Summary

| Suite Name | Total Tests | Passed | Failed | Status |
|---|:---:|:---:|:---:|:---:|
| **CS2 R2 Texture & PBR Upgrade (F1–F26)** | **166** | **166** | **0** | **100% PASS** |
| - Tier 1: Isolation Tests (F1–F26) | 130 | 130 | 0 | PASS |
| - Tier 2: Boundary & Corner Cases | 25 | 25 | 0 | PASS |
| - Tier 3: Cross-Feature Interactions | 6 | 6 | 0 | PASS |
| - Tier 4: Real-World Scenarios | 5 | 5 | 0 | PASS |
| **CS2 Steam Pipeline & 3D Engine Regression** | **116** | **116** | **0** | **100% PASS** |
| - Tier 1: Isolation Tests (F1–F19) | 95 | 95 | 0 | PASS |
| - Tier 2: Boundary & Corner Cases | 10 | 10 | 0 | PASS |
| - Tier 3: Cross-Feature Interactions | 6 | 6 | 0 | PASS |
| - Tier 4: Real-World Scenarios | 5 | 5 | 0 | PASS |
| **TOTAL COMBINED SUITE** | **282** | **282** | **0** | **100% PASS** |
