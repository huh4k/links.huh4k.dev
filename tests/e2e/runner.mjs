#!/usr/bin/env node

/**
 * CS2 Inventory Pipeline & 3D ModelViewer E2E Test Runner
 * Executes requirement-driven opaque-box tests across Tiers 1-4 for features F1-F18.
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Check if running under tsx to resolve TypeScript imports cleanly.
// If run directly via `node tests/e2e/runner.mjs`, transparently re-spawn under `npx tsx`.
if (!process.env.TSX_RUNNER_ACTIVE && !process.execArgv.some(arg => arg.includes('tsx'))) {
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
  F1: 'Steam Inventory Fetching',
  F2: 'Inspect Link Construction',
  F3: 'CSFloat Inspect Enrichment',
  F4: 'In-Memory LRU & Throttling',
  F5: 'Resilient Error Handling',
  F6: 'Typed SSR API Endpoint',
  F7: 'TypeScript Type Definitions',
  F8: 'Steam Utilities Module',
  F9: '3D Dependencies Setup',
  F10: 'Interactive 3D ModelViewer',
  F11: 'Studio 3-Point Lighting Rig',
  F12: 'OrbitControls with Limits',
  F13: 'Idle Auto-Rotation & Pause',
  F14: 'Responsive Canvas & Auto-Center',
  F15: 'Visual Loading Skeleton & Spinner',
  F16: 'WebGL Resource Disposal',
  F17: 'Mock Verification Script',
  F18: 'Placeholder GLB & Test Route',
};

async function main() {
  const runnerStart = performance.now();

  console.log('\n' + BOLD + CYAN + '================================================================================' + RESET);
  console.log(BOLD + '  CS2 INVENTORY PIPELINE & 3D MODELVIEWER — E2E TEST SUITE (TIERS 1–4)' + RESET);
  console.log(BOLD + CYAN + '================================================================================' + RESET);
  console.log(GRAY + `  Runtime: Node ${process.version} | Timestamp: ${new Date().toISOString()}` + RESET + '\n');

  // Run all tiers sequentially
  try {
    await runTier1();
    await runTier2();
    await runTier3();
    await runTier4();
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
  // Feature Coverage Checklist (F1–F18)
  // --------------------------------------------------------------------------
  console.log('\n' + BOLD + '================================================================================' + RESET);
  console.log(BOLD + '  FEATURE COVERAGE MATRIX (F1–F18)' + RESET);
  console.log(BOLD + '================================================================================' + RESET);
  console.log(`  ${BOLD}${'ID'.padEnd(6)} ${'Feature Name'.padEnd(38)} ${'Status'.padEnd(16)} Test Count${RESET}`);
  console.log(GRAY + '  ' + '-'.repeat(76) + RESET);

  let allFeaturesCovered = true;
  for (let i = 1; i <= 18; i++) {
    const fId = `F${i}`;
    const name = FEATURE_NAMES[fId] || 'Feature';
    const info = harness.featureMap.get(fId);
    const isCovered = info && info.covered && info.tests.length > 0;
    if (!isCovered) allFeaturesCovered = false;

    const status = isCovered ? `${GREEN}✓ COVERED${RESET}` : `${RED}✗ MISSING${RESET}`;
    const count = info ? info.tests.length : 0;
    console.log(`  ${fId.padEnd(6)} ${name.padEnd(38)} ${status.padEnd(25)} ${count} tests`);
  }

  // --------------------------------------------------------------------------
  // Final Verdict Banner
  // --------------------------------------------------------------------------
  console.log('\n' + BOLD + '================================================================================' + RESET);
  if (totalFailed === 0 && allFeaturesCovered) {
    console.log(`  ${BG_GREEN} ALL E2E TEST TIERS PASSED (100%) ${RESET}`);
    console.log(`  ${GREEN}✓ Tests: ${totalPassed} passed, ${totalTests} total${RESET}`);
    console.log(`  ${GREEN}✓ Features: 18/18 covered${RESET}`);
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

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
