#!/usr/bin/env node

/**
 * CS2 Inventory Pipeline & 3D Weapon Model Engine — Comprehensive E2E Test Runner
 * Executes requirement-driven opaque-box tests across Tiers 1-4 for features F1-F19.
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Check if running under tsx to resolve TypeScript imports cleanly.
// If run directly via `node tests/e2e/runner.mjs`, transparently re-spawn under `npx tsx`.
if (!process.env.TSX_RUNNER_ACTIVE && !process.execArgv.some((arg) => arg.includes('tsx'))) {
  const result = spawnSync('npx', ['-y', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, TSX_RUNNER_ACTIVE: '1' },
  });
  process.exit(result.status ?? 0);
}

import { harness } from './harness.mjs';
import { runTier1 } from './tier1-features.test.mjs';
import { runTier2 } from './tier2-boundary.test.mjs';
import { runTier3 } from './tier3-combinations.test.mjs';
import { runTier4 } from './tier4-scenarios.test.mjs';

// ANSI colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';
const BG_GREEN = '\x1b[42m\x1b[30m\x1b[1m';
const BG_RED = '\x1b[41m\x1b[37m\x1b[1m';

const FEATURE_NAMES = {
  F1: 'Direct asset_properties parsing',
  F2: 'Rarity tag parsing fix',
  F3: 'Item category classification',
  F4: 'LRU Cache Pre-Seeding',
  F5: 'Live Steam ID Resolution',
  F6: '35 .obj Model Migration',
  F7: 'Weapon Model Mapping',
  F8: 'ModelViewer Dual-Format Support',
  F9: 'OBJ Geometry Normalization',
  F10: 'CS2 Weapon PBR Material',
  F11: 'WebGL Memory Cleanup',
  F12: 'Real User Primary Loadout',
  F13: 'Interactive Loadout Bento Card',
  F14: '[VIEW ALL SKINS] Link',
  F15: 'Dedicated /inventory Route',
  F16: 'Inventory Category Filtering & Search',
  F17: 'Interactive 3D Inspect Stage',
  F18: 'Global Navigation & Command Deck',
  F19: 'Privacy Invariant Enforcement',
};

async function main() {
  const runnerStart = performance.now();

  // Parse CLI flags for tier selection (e.g. --tier=1)
  const tierArg = process.argv.find((a) => a.startsWith('--tier='));
  const selectedTier = tierArg ? parseInt(tierArg.split('=')[1], 10) : null;

  console.log('\n' + BOLD + CYAN + '================================================================================' + RESET);
  console.log(BOLD + '  CS2 INVENTORY & 3D WEAPON ENGINE — E2E TEST SUITE (TIERS 1–4, F1–F19)' + RESET);
  console.log(BOLD + CYAN + '================================================================================' + RESET);
  console.log(GRAY + `  Runtime: Node ${process.version} | Timestamp: ${new Date().toISOString()}` + RESET);
  if (selectedTier) {
    console.log(YELLOW + `  Filtering: Running only Tier ${selectedTier}` + RESET);
  }
  console.log('');

  // Run tiers
  try {
    if (!selectedTier || selectedTier === 1) await runTier1();
    if (!selectedTier || selectedTier === 2) await runTier2();
    if (!selectedTier || selectedTier === 3) await runTier3();
    if (!selectedTier || selectedTier === 4) await runTier4();
  } catch (error) {
    console.error(RED + 'Fatal error during test suite execution:' + RESET, error);
    process.exit(1);
  }

  // Print execution details for each suite
  for (const suite of harness.suites) {
    console.log(BOLD + `\n--- [Tier ${suite.tier}] ${suite.name} ---` + RESET);
    for (const test of suite.tests) {
      const featStr = test.features.length ? GRAY + ` [${test.features.join(',')}]` + RESET : '';
      if (test.status === 'passed') {
        console.log(`  ${GREEN}✓${RESET} ${test.name}${featStr} ${GRAY}(${test.durationMs}ms)${RESET}`);
      } else {
        console.log(`  ${RED}✗${RESET} ${test.name}${featStr} ${GRAY}(${test.durationMs}ms)${RESET}`);
        if (test.error) {
          console.log(`    ${RED}Error:${RESET} ${test.error.message}`);
          if (!test.error.isAssertion && test.error.stack) {
            console.log(GRAY + test.error.stack.split('\n').slice(1, 4).join('\n') + RESET);
          }
        }
      }
    }
  }

  const totalDuration = Math.round((performance.now() - runnerStart) * 10) / 10;
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  // --------------------------------------------------------------------------
  // Summary Table: Tiers Breakdown
  // --------------------------------------------------------------------------
  console.log('\n' + BOLD + '================================================================================' + RESET);
  console.log(BOLD + '  TIER BREAKDOWN' + RESET);
  console.log(BOLD + '================================================================================' + RESET);
  console.log(`  ${BOLD}${'Tier'.padEnd(8)} ${'Suite Name'.padEnd(42)} ${'Total'.padEnd(8)} ${'Passed'.padEnd(8)} ${'Failed'.padEnd(8)} Duration${RESET}`);
  console.log(GRAY + '  ' + '-'.repeat(76) + RESET);

  for (const suite of harness.suites) {
    totalTests += suite.tests.length;
    totalPassed += suite.passed;
    totalFailed += suite.failed;
    const durStr = `${suite.tests.reduce((acc, t) => acc + t.durationMs, 0).toFixed(1)}ms`;
    const passColor = suite.failed === 0 ? GREEN : RED;
    console.log(
      `  ${`Tier ${suite.tier}`.padEnd(8)} ${suite.name.slice(0, 40).padEnd(42)} ${String(suite.tests.length).padEnd(8)} ${passColor}${String(suite.passed).padEnd(8)}${RESET} ${suite.failed > 0 ? RED : GRAY}${String(suite.failed).padEnd(8)}${RESET} ${durStr}`
    );
  }

  // --------------------------------------------------------------------------
  // Feature Coverage Checklist (F1–F19)
  // --------------------------------------------------------------------------
  console.log('\n' + BOLD + '================================================================================' + RESET);
  console.log(BOLD + '  FEATURE COVERAGE MATRIX (F1–F19)' + RESET);
  console.log(BOLD + '================================================================================' + RESET);
  console.log(`  ${BOLD}${'ID'.padEnd(6)} ${'Feature Name'.padEnd(42)} ${'Status'.padEnd(16)} Test Count${RESET}`);
  console.log(GRAY + '  ' + '-'.repeat(76) + RESET);

  let allFeaturesCovered = true;
  for (let i = 1; i <= 19; i++) {
    const fId = `F${i}`;
    const name = FEATURE_NAMES[fId] || 'Feature';
    const info = harness.featureMap.get(fId);
    const isCovered = info && info.covered && info.tests.length > 0;
    if (!selectedTier && !isCovered) allFeaturesCovered = false;

    const status = isCovered ? `${GREEN}✓ COVERED${RESET}` : `${RED}✗ MISSING${RESET}`;
    const count = info ? info.tests.length : 0;
    console.log(`  ${fId.padEnd(6)} ${name.padEnd(42)} ${status.padEnd(25)} ${count} tests`);
  }

  // --------------------------------------------------------------------------
  // Final Verdict Banner
  // --------------------------------------------------------------------------
  console.log('\n' + BOLD + '================================================================================' + RESET);
  if (totalFailed === 0 && (selectedTier || allFeaturesCovered)) {
    console.log(`  ${BG_GREEN} ALL E2E TEST TIERS PASSED (100%) ${RESET}`);
    console.log(`  ${GREEN}✓ Tests: ${totalPassed} passed, ${totalTests} total${RESET}`);
    console.log(`  ${GREEN}✓ Features: ${selectedTier ? 'Filtered Tier' : '19/19 covered'}${RESET}`);
    console.log(`  ${GRAY}  Total Time: ${totalDuration}ms${RESET}`);
    console.log(BOLD + '================================================================================\n' + RESET);
    process.exit(0);
  } else {
    console.log(`  ${BG_RED} E2E TEST SUITE FAILED ${RESET}`);
    console.log(`  ${RED}✗ Passed: ${totalPassed}/${totalTests} | Failed: ${totalFailed}${RESET}`);
    console.log(`  ${GRAY}  Total Time: ${totalDuration}ms${RESET}`);
    console.log(BOLD + '================================================================================\n' + RESET);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
