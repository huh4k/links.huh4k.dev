/**
 * CS2 R2 Texture Integration & PBR Shader Upgrade — E2E Test Harness
 * Tracks feature coverage for all 26 features F1–F26 across Tiers 1–4.
 */

export const FEATURE_NAMES = {
  F1: 'R2 Base Weapon Map Resolution',
  F2: 'R2 Paint Finish Map Resolution',
  F3: 'Asynchronous Cached Texture Loader',
  F4: 'Weapon Key Normalizer',
  F5: 'AK-47 | Ice Coaled Composite',
  F6: 'M4A1-S | Liquidation Composite',
  F7: 'AWP | Ice Coaled Composite',
  F8: 'USP-S | Royal Guard Composite',
  F9: 'MAC-10 | Candy Apple Composite',
  F10: 'Zeus x27 | Electric Blue Composite',
  F11: 'Galil AR | Control Composite',
  F12: 'Glock-18 | Catacombs Composite',
  F13: 'UMP-45 | Late Night Transit Composite',
  F14: 'Generic Procedural Fallback Compositor',
  F15: 'Live Float Wear Simulation Mathematics',
  F16: 'Pattern Seed Modulation',
  F17: 'Extended ModelViewerProps',
  F18: 'MeshPhysicalMaterial Upgrade',
  F19: 'Three.js uv2 Attribute Binding',
  F20: 'AO & Surface & Diffuse Texture Binding',
  F21: 'Synchronous Fallback Colors',
  F22: 'WebGL Resource Disposal',
  F23: 'CS2LoadoutCard Integration',
  F24: 'InventoryExplorer 3D Stage Integration',
  F25: 'Inspect View Dock Toggle',
  F26: 'Privacy Invariant Enforcement',
};

/**
 * Polyfill complete canvas & document in Node for procedural texture testing
 */
export function setupCanvasMock() {
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
      createElement(tag) {
        if (tag === 'canvas') {
          return createMockCanvas();
        }
        return {
          style: {},
          setAttribute: () => {},
          getAttribute: () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
        };
      },
    };
  }
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
  }
}

export function createMockCanvas(width = 1024, height = 1024) {
  const calls = [];
  const gradient = {
    addColorStop: (stop, color) => { calls.push({ type: 'addColorStop', stop, color }); },
  };
  const ctx = {
    canvas: null,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowColor: 'rgba(0,0,0,0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    fillRect: (...args) => { calls.push({ type: 'fillRect', args }); },
    strokeRect: (...args) => { calls.push({ type: 'strokeRect', args }); },
    clearRect: (...args) => { calls.push({ type: 'clearRect', args }); },
    beginPath: () => { calls.push({ type: 'beginPath' }); },
    closePath: () => { calls.push({ type: 'closePath' }); },
    moveTo: (...args) => { calls.push({ type: 'moveTo', args }); },
    lineTo: (...args) => { calls.push({ type: 'lineTo', args }); },
    bezierCurveTo: (...args) => { calls.push({ type: 'bezierCurveTo', args }); },
    quadraticCurveTo: (...args) => { calls.push({ type: 'quadraticCurveTo', args }); },
    arc: (...args) => { calls.push({ type: 'arc', args }); },
    arcTo: (...args) => { calls.push({ type: 'arcTo', args }); },
    rect: (...args) => { calls.push({ type: 'rect', args }); },
    ellipse: (...args) => { calls.push({ type: 'ellipse', args }); },
    stroke: () => { calls.push({ type: 'stroke' }); },
    fill: () => { calls.push({ type: 'fill' }); },
    clip: () => { calls.push({ type: 'clip' }); },
    save: () => { calls.push({ type: 'save' }); },
    restore: () => { calls.push({ type: 'restore' }); },
    translate: (...args) => { calls.push({ type: 'translate', args }); },
    rotate: (...args) => { calls.push({ type: 'rotate', args }); },
    scale: (...args) => { calls.push({ type: 'scale', args }); },
    setTransform: (...args) => { calls.push({ type: 'setTransform', args }); },
    resetTransform: () => { calls.push({ type: 'resetTransform' }); },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    fillText: (...args) => { calls.push({ type: 'fillText', args }); },
    strokeText: (...args) => { calls.push({ type: 'strokeText', args }); },
    measureText: (text) => {
      const len = (text || '').length * 8;
      return {
        width: len,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: len,
        fontBoundingBoxAscent: 12,
        fontBoundingBoxDescent: 3,
        alphabeticBaseline: 0,
        emHeightAscent: 10,
        emHeightDescent: 2,
        hangingBaseline: 8,
        ideographicBaseline: -2,
      };
    },
    drawImage: (...args) => { calls.push({ type: 'drawImage', args }); },
    getImageData: (_x, _y, w, h) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
      colorSpace: 'srgb',
    }),
    putImageData: (...args) => { calls.push({ type: 'putImageData', args }); },
    setLineDash: (...args) => { calls.push({ type: 'setLineDash', args }); },
    getLineDash: () => [],
    _calls: calls,
  };
  const canvas = {
    width,
    height,
    style: {},
    getContext: (type) => (type === '2d' ? ctx : null),
    toDataURL: () => 'data:image/png;base64,mock',
    addEventListener: () => {},
    removeEventListener: () => {},
    _ctx: ctx,
  };
  ctx.canvas = canvas;
  return canvas;
}

export class TestHarness {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.featureMap = new Map();
    for (let i = 1; i <= 26; i++) {
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

  assertGreaterOrEqual(actual, expected, message = '') {
    if (actual < expected) {
      const detail = `expected >= ${expected}, got: ${actual}`;
      this.assert(false, message || 'Value must be greater than or equal', detail);
    }
  }

  assertLessOrEqual(actual, expected, message = '') {
    if (actual > expected) {
      const detail = `expected <= ${expected}, got: ${actual}`;
      this.assert(false, message || 'Value must be less than or equal', detail);
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
