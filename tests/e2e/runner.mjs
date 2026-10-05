#!/usr/bin/env node

/**
 * CS2 Web Showcase & 3D Model Engine — Comprehensive E2E Master Test Runner
 *
 * Runs requirement-driven opaque-box test suites:
 * 1. CS2 Source 2 Weapon Finish Pipeline Suite (F1–F44 across Tiers 1–4)
 * 2. CS2 R2 Texture Integration & PBR Shader Upgrade Suite (F1–F26 across Tiers 1–4)
 * 3. CS2 Inventory Pipeline & 3D Weapon Engine Regression Suite (F1–F19 across Tiers 1–4)
 *
 * CLI Options:
 *   --tier=<1|2|3|4>                     Filter execution by tier
 *   --suite=<source2|r2|pipeline|all>    Select suite to execute (default: all)
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

// Import Source 2 Finish Pipeline Suite (F1–F44)
import {
  source2Harness,
  SOURCE2_FEATURE_NAMES,
  runTier1 as runSource2Tier1,
  runTier2 as runSource2Tier2,
  runTier3 as runSource2Tier3,
  runTier4 as runSource2Tier4,
} from './source2-finishes.test.mjs';

// Import R2 Texture PBR Suite
import { harness as r2Harness, FEATURE_NAMES as R2_FEATURE_NAMES } from './r2-texture-pbr/harness.mjs';
import { runTier1 as runR2Tier1 } from './r2-texture-pbr/tier1-features.test.mjs';
import { runTier2 as runR2Tier2 } from './r2-texture-pbr/tier2-boundary.test.mjs';
import { runTier3 as runR2Tier3 } from './r2-texture-pbr/tier3-combinations.test.mjs';
import { runTier4 as runR2Tier4 } from './r2-texture-pbr/tier4-scenarios.test.mjs';

// Import Pipeline Regression Suite
import { harness as pipelineHarness } from './harness.mjs';
import { runTier1 as runPipelineTier1 } from './tier1-features.test.mjs';
import { runTier2 as runPipelineTier2 } from './tier2-boundary.test.mjs';
import { runTier3 as runPipelineTier3 } from './tier3-combinations.test.mjs';
import { runTier4 as runPipelineTier4 } from './tier4-scenarios.test.mjs';

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

async function main() {
  const runnerStart = performance.now();

  // CLI Arguments
  const tierArg = process.argv.find((a) => a.startsWith('--tier='));
  const selectedTier = tierArg ? parseInt(tierArg.split('=')[1], 10) : null;

  const suiteArg = process.argv.find((a) => a.startsWith('--suite='));
  const selectedSuite = suiteArg ? suiteArg.split('=')[1].toLowerCase() : 'all';

  console.log('\n' + BOLD + CYAN + '================================================================================' + RESET);
  console.log(BOLD + '  CS2 WEB ENGINE & SOURCE 2 FINISH PIPELINE — E2E MASTER TEST RUNNER' + RESET);
  console.log(BOLD + CYAN + '================================================================================' + RESET);
  console.log(GRAY + `  Runtime: Node ${process.version} | Timestamp: ${new Date().toISOString()}` + RESET);
  if (selectedTier) {
    console.log(YELLOW + `  Filtering: Running only Tier ${selectedTier}` + RESET);
  }
  if (selectedSuite !== 'all') {
    console.log(YELLOW + `  Filtering: Running only Suite "${selectedSuite}"` + RESET);
  }
  console.log('');

  // 1. Run CS2 Source 2 Weapon Finish Pipeline Suite (F1–F44)
  const shouldRunSource2 =
    selectedSuite === 'all' ||
    selectedSuite === 'source2' ||
    selectedSuite === 'finishes' ||
    selectedSuite === 'finish';
  if (shouldRunSource2) {
    try {
      if (!selectedTier || selectedTier === 1) await runSource2Tier1();
      if (!selectedTier || selectedTier === 2) await runSource2Tier2();
      if (!selectedTier || selectedTier === 3) await runSource2Tier3();
      if (!selectedTier || selectedTier === 4) await runSource2Tier4();
    } catch (err) {
      console.error(RED + 'Fatal error in Source 2 Finish Pipeline suite:' + RESET, err);
      process.exit(1);
    }
  }

  // 2. Run R2 Texture Integration & PBR Upgrade Suite (F1–F26)
  const shouldRunR2 =
    selectedSuite === 'all' ||
    selectedSuite === 'r2' ||
    selectedSuite === 'texture' ||
    selectedSuite === 'texture-pbr';
  if (shouldRunR2) {
    try {
      if (!selectedTier || selectedTier === 1) await runR2Tier1();
      if (!selectedTier || selectedTier === 2) await runR2Tier2();
      if (!selectedTier || selectedTier === 3) await runR2Tier3();
      if (!selectedTier || selectedTier === 4) await runR2Tier4();
    } catch (err) {
      console.error(RED + 'Fatal error in R2 Texture PBR suite:' + RESET, err);
      process.exit(1);
    }
  }

  // 3. Run Pipeline Regression Suite (F1–F19)
  const shouldRunPipeline =
    selectedSuite === 'all' ||
    selectedSuite === 'pipeline' ||
    selectedSuite === 'regression';
  if (shouldRunPipeline) {
    try {
      if (!selectedTier || selectedTier === 1) await runPipelineTier1();
      if (!selectedTier || selectedTier === 2) await runPipelineTier2();
      if (!selectedTier || selectedTier === 3) await runPipelineTier3();
      if (!selectedTier || selectedTier === 4) await runPipelineTier4();
    } catch (err) {
      console.error(RED + 'Fatal error in Pipeline Regression suite:' + RESET, err);
      process.exit(1);
    }
  }

  // Print execution details for Source 2 Finish Pipeline suite
  if (shouldRunSource2) {
    console.log(BOLD + '\n[SUITE 1: CS2 Source 2 Weapon Finish Pipeline (F1–F44)]' + RESET);
    for (const suite of source2Harness.suites) {
      console.log(BOLD + `\n--- [Tier ${suite.tier}] ${suite.name} ---` + RESET);
      for (const test of suite.tests) {
        const featStr = test.features.length ? GRAY + ` [${test.features.join(',')}]` + RESET : '';
        if (test.status === 'passed') {
          console.log(`  ${GREEN}✓${RESET} ${test.name}${featStr} ${GRAY}(${test.durationMs}ms)${RESET}`);
        } else {
          console.log(`  ${RED}✗${RESET} ${test.name}${featStr} ${GRAY}(${test.durationMs}ms)${RESET}`);
          if (test.error) {
            console.log(`    ${RED}Error:${RESET} ${test.error.message}`);
          }
        }
      }
    }
  }

  // Print execution details for R2 Texture PBR suite
  if (shouldRunR2) {
    console.log(BOLD + '\n[SUITE 2: CS2 R2 Texture Integration & PBR Upgrade (F1–F26)]' + RESET);
    for (const suite of r2Harness.suites) {
      console.log(BOLD + `\n--- [Tier ${suite.tier}] ${suite.name} ---` + RESET);
      for (const test of suite.tests) {
        const featStr = test.features.length ? GRAY + ` [${test.features.join(',')}]` + RESET : '';
        if (test.status === 'passed') {
          console.log(`  ${GREEN}✓${RESET} ${test.name}${featStr} ${GRAY}(${test.durationMs}ms)${RESET}`);
        } else {
          console.log(`  ${RED}✗${RESET} ${test.name}${featStr} ${GRAY}(${test.durationMs}ms)${RESET}`);
          if (test.error) {
            console.log(`    ${RED}Error:${RESET} ${test.error.message}`);
          }
        }
      }
    }
  }

  // Print execution details for Pipeline Regression suite
  if (shouldRunPipeline) {
    console.log(BOLD + '\n[SUITE 3: CS2 Steam Pipeline & 3D Model Engine Regression]' + RESET);
    for (const suite of pipelineHarness.suites) {
      console.log(BOLD + `\n--- [Tier ${suite.tier}] ${suite.name} ---` + RESET);
      for (const test of suite.tests) {
        const featStr = test.features.length ? GRAY + ` [${test.features.join(',')}]` + RESET : '';
        if (test.status === 'passed') {
          console.log(`  ${GREEN}✓${RESET} ${test.name}${featStr} ${GRAY}(${test.durationMs}ms)${RESET}`);
        } else {
          console.log(`  ${RED}✗${RESET} ${test.name}${featStr} ${GRAY}(${test.durationMs}ms)${RESET}`);
          if (test.error) {
            console.log(`    ${RED}Error:${RESET} ${test.error.message}`);
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
  console.log(`  ${BOLD}${'Tier'.padEnd(8)} ${'Suite Name'.padEnd(46)} ${'Total'.padEnd(8)} ${'Passed'.padEnd(8)} ${'Failed'.padEnd(8)} Duration${RESET}`);
  console.log(GRAY + '  ' + '-'.repeat(78) + RESET);

  const allSuites = [
    ...(shouldRunSource2 ? source2Harness.suites : []),
    ...(shouldRunR2 ? r2Harness.suites : []),
    ...(shouldRunPipeline ? pipelineHarness.suites : []),
  ];

  for (const suite of allSuites) {
    totalTests += suite.tests.length;
    totalPassed += suite.passed;
    totalFailed += suite.failed;
    const durStr = `${suite.tests.reduce((acc, t) => acc + t.durationMs, 0).toFixed(1)}ms`;
    const passColor = suite.failed === 0 ? GREEN : RED;
    console.log(
      `  ${`Tier ${suite.tier}`.padEnd(8)} ${suite.name.slice(0, 44).padEnd(46)} ${String(suite.tests.length).padEnd(8)} ${passColor}${String(suite.passed).padEnd(8)}${RESET} ${suite.failed > 0 ? RED : GRAY}${String(suite.failed).padEnd(8)}${RESET} ${durStr}`
    );
  }

  // --------------------------------------------------------------------------
  // Feature Coverage Checklist: Source 2 Finish Pipeline (F1–F44)
  // --------------------------------------------------------------------------
  let allSource2FeaturesCovered = true;
  if (shouldRunSource2) {
    console.log('\n' + BOLD + '================================================================================' + RESET);
    console.log(BOLD + '  FEATURE COVERAGE MATRIX: CS2 SOURCE 2 FINISH PIPELINE (F1–F44)' + RESET);
    console.log(BOLD + '================================================================================' + RESET);
    console.log(`  ${BOLD}${'ID'.padEnd(6)} ${'Feature Name'.padEnd(44)} ${'Status'.padEnd(16)} Test Count${RESET}`);
    console.log(GRAY + '  ' + '-'.repeat(78) + RESET);

    for (let i = 1; i <= 44; i++) {
      const fId = `F${i}`;
      const name = SOURCE2_FEATURE_NAMES[fId] || 'Feature';
      const info = source2Harness.featureMap.get(fId);
      const isCovered = info && info.covered && info.tests.length > 0;
      if (!selectedTier && !isCovered) allSource2FeaturesCovered = false;

      const status = isCovered ? `${GREEN}✓ COVERED${RESET}` : `${RED}✗ MISSING${RESET}`;
      const count = info ? info.tests.length : 0;
      console.log(`  ${fId.padEnd(6)} ${name.padEnd(44)} ${status.padEnd(25)} ${count} tests`);
    }
  }

  // --------------------------------------------------------------------------
  // Feature Coverage Checklist: R2 Texture & PBR Upgrade (F1–F26)
  // --------------------------------------------------------------------------
  let allR2FeaturesCovered = true;
  if (shouldRunR2) {
    console.log('\n' + BOLD + '================================================================================' + RESET);
    console.log(BOLD + '  FEATURE COVERAGE MATRIX: CS2 R2 TEXTURES & PBR SHADERS (F1–F26)' + RESET);
    console.log(BOLD + '================================================================================' + RESET);
    console.log(`  ${BOLD}${'ID'.padEnd(6)} ${'Feature Name'.padEnd(44)} ${'Status'.padEnd(16)} Test Count${RESET}`);
    console.log(GRAY + '  ' + '-'.repeat(78) + RESET);

    for (let i = 1; i <= 26; i++) {
      const fId = `F${i}`;
      const name = R2_FEATURE_NAMES[fId] || 'Feature';
      const info = r2Harness.featureMap.get(fId);
      const isCovered = info && info.covered && info.tests.length > 0;
      if (!selectedTier && !isCovered) allR2FeaturesCovered = false;

      const status = isCovered ? `${GREEN}✓ COVERED${RESET}` : `${RED}✗ MISSING${RESET}`;
      const count = info ? info.tests.length : 0;
      console.log(`  ${fId.padEnd(6)} ${name.padEnd(44)} ${status.padEnd(25)} ${count} tests`);
    }
  }

  // --------------------------------------------------------------------------
  // Final Verdict Banner
  // --------------------------------------------------------------------------
  console.log('\n' + BOLD + '================================================================================' + RESET);
  const coveragePassed =
    selectedTier ||
    ((!shouldRunSource2 || allSource2FeaturesCovered) && (!shouldRunR2 || allR2FeaturesCovered));

  if (totalFailed === 0 && coveragePassed) {
    console.log(`  ${BG_GREEN} ALL E2E TEST TIERS PASSED (100%) ${RESET}`);
    console.log(`  ${GREEN}✓ Tests: ${totalPassed} passed, ${totalTests} total${RESET}`);
    if (shouldRunSource2) {
      console.log(`  ${GREEN}✓ Features (Source 2): 44/44 covered across F1–F44${RESET}`);
    }
    if (shouldRunR2) {
      console.log(`  ${GREEN}✓ Features (R2 PBR): 26/26 covered across F1–F26${RESET}`);
    }
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
