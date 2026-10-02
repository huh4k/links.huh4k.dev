/**
 * Lightweight E2E Test Harness and Assertion Utilities
 * Provides suite execution, assertions, timing, and feature coverage tracking.
 */

export class TestHarness {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.featureMap = new Map();
    // Initialize F1 to F18
    for (let i = 1; i <= 18; i++) {
      this.featureMap.set(`F${i}`, { covered: false, tests: [] });
    }
  }

  describe(suiteName, tier, fn) {
    const suite = {
      name: suiteName,
      tier: tier,
      tests: [],
      passed: 0,
      failed: 0,
      durationMs: 0,
    };
    this.suites.push(suite);
    this.currentSuite = suite;
    return fn();
  }

  async it(testName, features = [], fn) {
    if (!this.currentSuite) {
      throw new Error(`Test "${testName}" must be inside a describe block`);
    }

    const test = {
      name: testName,
      features: Array.isArray(features) ? features : [features],
      status: 'pending',
      error: null,
      durationMs: 0,
    };
    this.currentSuite.tests.push(test);

    // Track features
    for (const f of test.features) {
      if (this.featureMap.has(f)) {
        this.featureMap.get(f).covered = true;
        this.featureMap.get(f).tests.push(testName);
      }
    }

    const start = performance.now();
    try {
      await fn();
      test.status = 'passed';
      this.currentSuite.passed++;
    } catch (err) {
      test.status = 'failed';
      test.error = err;
      this.currentSuite.failed++;
    } finally {
      test.durationMs = Math.round((performance.now() - start) * 100) / 100;
    }
  }

  assert(condition, message, details = '') {
    if (!condition) {
      const err = new Error(`Assertion failed: ${message}${details ? ` (${details})` : ''}`);
      err.isAssertion = true;
      throw err;
    }
  }

  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      const detail = `expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`;
      this.assert(false, message || 'Values must be strictly equal', detail);
    }
  }

  assertDeepEqual(actual, expected, message = '') {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      const detail = `expected: ${expStr}, got: ${actStr}`;
      this.assert(false, message || 'Objects must be deeply equal', detail);
    }
  }

  assertCloseTo(actual, expected, epsilon = 0.001, message = '') {
    const diff = Math.abs(actual - expected);
    if (diff > epsilon) {
      const detail = `expected: ${expected} ± ${epsilon}, got: ${actual} (diff: ${diff})`;
      this.assert(false, message || 'Number must be within tolerance', detail);
    }
  }

  async assertThrows(fn, expectedErrorSubstring = '', message = '') {
    let threw = false;
    let actualError = null;
    try {
      await fn();
    } catch (err) {
      threw = true;
      actualError = err;
    }
    if (!threw) {
      this.assert(false, message || 'Expected function to throw, but it succeeded');
    }
    if (expectedErrorSubstring && actualError) {
      const errStr = actualError.message || String(actualError);
      this.assert(
        errStr.includes(expectedErrorSubstring),
        message || `Error message did not match expected substring "${expectedErrorSubstring}"`,
        `got: "${errStr}"`
      );
    }
  }
}

export const harness = new TestHarness();
