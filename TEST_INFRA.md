# TEST_INFRA — E2E Test Infrastructure & Coverage Specification

**Project**: CS2 Inventory Pipeline & Interactive 3D Weapon Model Viewer  
**Author**: `test_writer_e2e`  
**Date**: 2026-10-02  
**Status**: COMPLETE (36/36 tests passing, 100% feature coverage F1–F18)  
**Integrity Mode**: Development / Non-Bypassing  

---

## 1. Executive Summary & Philosophy

The E2E test infrastructure implements an **opaque-box, requirement-driven testing methodology** structured across **4 progressive tiers** as mandated by the Project Pattern. It exercises the full server-side inventory pipeline and 3D weapon inspect presentation layer without modifying application source code under `src/`.

### Core Testing Tenets:
1. **Opaque-Box Verification**: Tests validate public interface contracts, observable behaviors, HTTP API responses, and Three.js runtime properties rather than private internal implementation details.
2. **Progressive Testability**: Features are verified first in complete isolation (Tier 1), then under adversarial boundaries (Tier 2), next in cross-feature integration flows (Tier 3), and finally in end-to-end real-world user scenarios (Tier 4).
3. **Deterministic Mocking**: All external network dependencies (Steam Community Inventory API and CSFloat Inspect API) are isolated using high-fidelity in-memory HTTP response mocks, eliminating external rate-limit exhaustion, network flakiness, and DNS dependency during testing.
4. **Universal Invocation**: The test runner is written in native ECMAScript Modules (`.mjs`) with transparent `tsx` bridging, executing seamlessly via both `node tests/e2e/runner.mjs` and `npx tsx tests/e2e/runner.mjs` with 0 manual compilation steps.

---

## 2. Directory Layout & Test Suite Architecture

```
links.huh4k.dev
├── tests/
│   └── e2e/
│       ├── harness.mjs                # Test harness, assertion library, and feature coverage tracker
│       ├── runner.mjs                 # CLI test runner with ANSI reporting and Tier/Feature summary tables
│       ├── tier1-features.test.mjs    # Tier 1: Isolation tests for all 18 features (F1–F18)
│       ├── tier2-boundary.test.mjs    # Tier 2: Boundary values, rate limiting, malformed links, and camera limits
│       ├── tier3-combinations.test.mjs# Tier 3: Cross-feature integrations, state machines, and mixed inventories
│       └── tier4-scenarios.test.mjs   # Tier 4: Real-world SSR pipeline, full 3D inspect workflow, and concurrency
├── TEST_INFRA.md                      # This document
└── TEST_READY.md                      # Orchestrator handoff signal file
```

---

## 3. How to Run the Tests

### Primary Command:
```bash
node tests/e2e/runner.mjs
```

### Alternative TSX Command:
```bash
npx tsx tests/e2e/runner.mjs
```

Both commands execute all 4 tiers sequentially, format clean summary tables with feature coverage checklists, and exit with code `0` on success or code `1` on failure.

---

## 4. Multi-Tier Architecture & Coverage Breakdown

### Tier 1 — Feature Coverage (Isolation: F1–F18)
Validates each feature independently against its documented interface contract:
- **F1 (Steam Fetch)**: Queries Steam Community endpoint, joins assets with descriptions, prepends CDN image base.
- **F2 (Inspect Link)**: Substitutes `%owner_steamid%` and `%assetid%` in `actions[0].link` to build valid `steam://` URL.
- **F3 (CSFloat Enrich)**: Queries CSFloat inspect endpoint, parsing `floatvalue`, `paintseed`, and `paintindex`.
- **F4 (LRU & Throttle)**: Validates LRU cache capacity bounds, recency promotion, TTL eviction, and request spacing.
- **F5 (Error Fallback)**: Confirms curated `FALLBACK_INVENTORY` dataset schema completeness (4 authentic showcase skins).
- **F6 (SSR Endpoint)**: Executes `/api/inventory.json.ts` GET handler, confirming HTTP 200, JSON Content-Type, and `Cache-Control`.
- **F7 (TypeScript Types)**: Confirms `src/types/inventory.ts` exports all required interfaces.
- **F8 (Steam Utils)**: Validates `getRarityFromTags`, `getTypeFromTags`, and `formatEconomyImageUrl`.
- **F9 (3D Dependencies)**: Confirms `three`, `@types/three`, `@react-three/fiber`, and `@react-three/drei` in `package.json`.
- **F10 (3D ModelViewer)**: Confirms exports of `ModelViewer`, `ModelViewerSkeleton`, `StudioLighting`, `FallbackWeaponMesh`, and `disposeThreeObject`.
- **F11 (Studio Lighting)**: Asserts Key (2.2), Fill (0.75, `#bae6fd`), Rim (2.8), Ambient (0.35), and Hemisphere (0.3) parameters.
- **F12 (OrbitControls Limits)**: Asserts damping (0.05), zoom limits (`[1.2, 5.5]`), and polar pitch limits (`[π/4, 0.65π]`).
- **F13 (Auto-Rotation & Pause)**: Validates auto-rotation toggle, interaction pause on start/wheel, and debounced resumption.
- **F14 (Auto-Centering)**: Asserts bounding box auto-scaling formula `2.0 / maxDim` and `<Center>` centering.
- **F15 (Loading Skeleton)**: Validates two-stage SSR `isMounted` guard, CSS pulse skeleton, and `<CanvasSpinner>` progress.
- **F16 (WebGL Resource Disposal)**: Traverses Three.js meshes, verifying recursive geometry, material, texture disposal and `useGLTF.clear`.
- **F17 (Mock Script)**: Verifies presence and integrity of standalone `scripts/verify-inventory.ts`.
- **F18 (GLB & Test Route)**: Validates `public/models/placeholder-weapon.glb` binary header (`0x46546c67`, v2) and `src/pages/test/model-viewer.astro`.

### Tier 2 — Boundary & Corner Cases
Tests edge and failure conditions across all subsystems:
- **Boundary 2.1**: Private profiles (HTTP 401 & 403) fall back to curated inventory without throwing.
- **Boundary 2.2**: External rate limits (HTTP 429) on Steam Community return fallback loadout; CSFloat 429 yields null float/seed.
- **Boundary 2.3**: Malformed inspect links (empty strings, missing tokens, unescaped characters) handled without exceptions.
- **Boundary 2.4**: Items without actions/tags (cases, stickers) return `inspectUrl: null` and `float: null`.
- **Boundary 2.5**: Empty inventories (`assets: []`, `total_inventory_count: 0`) gracefully handled.
- **Boundary 2.6**: Non-standard CSFloat payload formats (`iteminfo` vs `item` vs root-level fields) parsed reliably.
- **Boundary 2.7**: LRU stress test inserting 600 items into 500-capacity cache verifies strict capacity ceiling and oldest-item eviction.
- **Boundary 2.8**: Camera polar angle clamping strictly between `π/4` (45°) and `0.65π` (117°), preventing camera flips.
- **Boundary 2.9**: Camera zoom clamping strictly between `1.2` and `5.5`, preventing mesh penetration and disappearance.
- **Boundary 2.10**: Large inventory throttling with 40 weapons: batch enrichment strictly capped to 15 items.

### Tier 3 — Cross-Feature Combinations
Tests multi-module interaction contracts:
- **Combination 3.1**: Steam fetch + CSFloat enrichment + LRU cache: first query queries CSFloat (MISS); second query returns from LRU with 0 network calls (HIT).
- **Combination 3.2**: Private profile fallback + SSR endpoint 200: endpoint catches upstream 403, returns HTTP 200 with 4 fallback skins.
- **Combination 3.3**: 3D ModelViewer interaction state machine: `IDLE` -> `START` (pause) -> `END` (debounce start) -> `IDLE` (auto-rotate resume).
- **Combination 3.4**: Fallback mesh + studio lighting: validates stylized procedural tactical knife under studio 3-point lighting.
- **Combination 3.5**: Mixed inventory: processes batch of rifles, pistols, knives, and cases, correctly mapping rarities and inspect URLs.

### Tier 4 — Real-World Application Scenarios
Simulates realistic production workloads:
- **Scenario 4.1**: Full End-to-End SSR Request Pipeline:
  HTTP GET `/api/inventory.json?steamid=...` -> extract query -> fetch Steam -> relational join -> inspect format -> CSFloat enrichment -> LRU cache -> HTTP 200 response with Cache-Control headers and 100% schema compliance.
- **Scenario 4.2**: Complete 3D Inspect Workflow:
  Load binary GLB (`placeholder-weapon.glb`) -> verify buffer structure -> bounding box normalization -> studio lighting -> OrbitControls pitch clamping -> simulate user inspection -> unmount with full resource disposal.
- **Scenario 4.3**: High-Concurrency Burst Simulation:
  Simultaneous parallel requests to the SSR endpoint processed cleanly without race conditions or memory corruption.

---

## 5. Feature Coverage Matrix (F1–F18)

| Feature ID | Feature Name | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Total Tests | Status |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **F1** | Steam Inventory Fetching | ✓ | ✓ | ✓ | ✓ | 10 | **COVERED** |
| **F2** | Inspect Link Construction | ✓ | ✓ | ✓ | ✓ | 6 | **COVERED** |
| **F3** | CSFloat Inspect Enrichment | ✓ | ✓ | ✓ | ✓ | 6 | **COVERED** |
| **F4** | In-Memory LRU & Throttling | ✓ | ✓ | ✓ | ✓ | 6 | **COVERED** |
| **F5** | Resilient Error Handling | ✓ | ✓ | ✓ | - | 5 | **COVERED** |
| **F6** | Typed SSR API Endpoint | ✓ | - | ✓ | ✓ | 4 | **COVERED** |
| **F7** | TypeScript Type Definitions | ✓ | - | ✓ | ✓ | 3 | **COVERED** |
| **F8** | Steam Utilities Module | ✓ | ✓ | ✓ | ✓ | 4 | **COVERED** |
| **F9** | 3D Dependencies Setup | ✓ | - | - | ✓ | 2 | **COVERED** |
| **F10** | Interactive 3D ModelViewer | ✓ | - | ✓ | ✓ | 4 | **COVERED** |
| **F11** | Studio 3-Point Lighting Rig | ✓ | - | ✓ | ✓ | 3 | **COVERED** |
| **F12** | OrbitControls with Limits | ✓ | ✓ | ✓ | ✓ | 5 | **COVERED** |
| **F13** | Idle Auto-Rotation & Pause | ✓ | - | ✓ | - | 2 | **COVERED** |
| **F14** | Responsive Canvas & Auto-Center | ✓ | - | - | ✓ | 2 | **COVERED** |
| **F15** | Visual Loading Skeleton & Spinner | ✓ | - | - | - | 1 | **COVERED** |
| **F16** | WebGL Resource Disposal | ✓ | - | - | ✓ | 2 | **COVERED** |
| **F17** | Mock Verification Script | ✓ | - | - | - | 1 | **COVERED** |
| **F18** | Placeholder GLB & Test Route | ✓ | - | - | ✓ | 2 | **COVERED** |

**Summary**: 18 of 18 features covered (100%). Total tests: **36**. Passing: **36 (100%)**. Failing: **0**.
