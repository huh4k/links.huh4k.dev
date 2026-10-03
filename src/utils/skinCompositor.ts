import * as THREE from 'three';

/**
 * CS2 Weapon Skin Finish Painter & Compositor
 *
 * Procedurally generates authentic CS2 weapon skin diffuse textures
 * (THREE.CanvasTexture with SRGBColorSpace) for signature skins,
 * simulates live float wear (0.00 - 1.00) across PBR properties,
 * and provides instant synchronous fallback base colors.
 */

export interface SkinCompositeOptions {
  weaponName?: string;
  skinName?: string;
  float?: number | null;
  seed?: number | null;
  rarityColor?: string;
  width?: number;
  height?: number;
}

export interface SkinCompositeResult {
  texture: THREE.CanvasTexture;
  effectiveRoughness: number;
  effectiveMetalness: number;
  effectiveClearcoat: number;
  baseColorHex: string;
}

/**
 * Headless 2D Context & Canvas shim for Node.js / SSR environments.
 * Allows compositeSkinFinish to execute safely without DOM dependencies.
 */
class HeadlessGradient {
  addColorStop(_offset: number, _color: string): void {}
}

class HeadlessContext2D {
  canvas: HeadlessCanvas;
  fillStyle: string | HeadlessGradient = '#000000';
  strokeStyle: string | HeadlessGradient = '#000000';
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  lineJoin: CanvasLineJoin = 'miter';
  miterLimit = 10;
  font = '10px sans-serif';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  shadowColor = 'rgba(0,0,0,0)';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;

  constructor(canvas: HeadlessCanvas) {
    this.canvas = canvas;
  }

  fillRect(_x: number, _y: number, _w: number, _h: number): void {}
  strokeRect(_x: number, _y: number, _w: number, _h: number): void {}
  clearRect(_x: number, _y: number, _w: number, _h: number): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(_x: number, _y: number): void {}
  lineTo(_x: number, _y: number): void {}
  bezierCurveTo(_cp1x: number, _cp1y: number, _cp2x: number, _cp2y: number, _x: number, _y: number): void {}
  quadraticCurveTo(_cpx: number, _cpy: number, _x: number, _y: number): void {}
  arc(_x: number, _y: number, _radius: number, _startAngle: number, _endAngle: number, _counterclockwise?: boolean): void {}
  arcTo(_x1: number, _y1: number, _x2: number, _y2: number, _radius: number): void {}
  rect(_x: number, _y: number, _w: number, _h: number): void {}
  ellipse(_x: number, _y: number, _rx: number, _ry: number, _rot: number, _sa: number, _ea: number, _ccw?: boolean): void {}
  stroke(): void {}
  fill(_fillRule?: CanvasFillRule): void {}
  clip(_fillRule?: CanvasFillRule): void {}
  save(): void {}
  restore(): void {}
  translate(_x: number, _y: number): void {}
  rotate(_angle: number): void {}
  scale(_x: number, _y: number): void {}
  setTransform(_a?: number, _b?: number, _c?: number, _d?: number, _e?: number, _f?: number): void {}
  resetTransform(): void {}
  createLinearGradient(_x0: number, _y0: number, _x1: number, _y1: number): HeadlessGradient {
    return new HeadlessGradient();
  }
  createRadialGradient(_x0: number, _y0: number, _r0: number, _x1: number, _y1: number, _r1: number): HeadlessGradient {
    return new HeadlessGradient();
  }
  fillText(_text: string, _x: number, _y: number, _maxWidth?: number): void {}
  strokeText(_text: string, _x: number, _y: number, _maxWidth?: number): void {}
  measureText(text: string): TextMetrics {
    const width = (text || '').length * 8;
    return {
      width,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: width,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 3,
      alphabeticBaseline: 0,
      emHeightAscent: 10,
      emHeightDescent: 2,
      hangingBaseline: 8,
      ideographicBaseline: -2,
    } as TextMetrics;
  }
  drawImage(_image: CanvasImageSource, _dx: number, _dy: number): void {}
  getImageData(_sx: number, _sy: number, sw: number, sh: number): ImageData {
    return {
      data: new Uint8ClampedArray(sw * sh * 4),
      width: sw,
      height: sh,
      colorSpace: 'srgb',
    } as ImageData;
  }
  putImageData(_imagedata: ImageData, _dx: number, _dy: number): void {}
  setLineDash(_segments: number[]): void {}
  getLineDash(): number[] {
    return [];
  }
}

class HeadlessCanvas {
  width: number;
  height: number;
  style: Record<string, string> = {};
  private ctx: HeadlessContext2D;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ctx = new HeadlessContext2D(this);
  }

  getContext(contextId: string): HeadlessContext2D | null {
    if (contextId === '2d') return this.ctx;
    return null;
  }

  toDataURL(_type?: string, _quality?: unknown): string {
    return 'data:image/png;base64,';
  }

  addEventListener(): void {}
  removeEventListener(): void {}
}

/**
 * Creates an in-memory Canvas element (browser HTMLCanvasElement, OffscreenCanvas, or HeadlessCanvas).
 */
function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas | HeadlessCanvas {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  return new HeadlessCanvas(width, height);
}

/**
 * Fast deterministic pseudo-random number generator (Park-Miller LCG).
 */
function createSeededRandom(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) || 1) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Normalizes skin and weapon names into canonical matching tokens.
 */
export function normalizeSkinIdentifier(
  skinName?: string,
  weaponName?: string
): {
  normalizedWeapon: string;
  normalizedPattern: string;
  fullName: string;
} {
  const rawSkin = (skinName || '').trim();
  const rawWeapon = (weaponName || '').trim();
  const full = rawSkin || rawWeapon;

  let clean = full
    .replace(/^[★\s]+/, '')
    .replace(/^StatTrak™\s+/i, '')
    .replace(/^Souvenir\s+/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase();

  let extractedWeapon = '';
  let extractedPattern = '';

  if (clean.includes('|')) {
    const parts = clean.split('|');
    extractedWeapon = parts[0].trim();
    extractedPattern = parts[1].trim();
  } else {
    extractedPattern = clean;
    if (rawWeapon) {
      extractedWeapon = rawWeapon
        .replace(/^[★\s]+/, '')
        .replace(/^StatTrak™\s+/i, '')
        .replace(/^Souvenir\s+/i, '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .split('|')[0]
        .trim()
        .toLowerCase();
    }
  }

  return {
    normalizedWeapon: extractedWeapon,
    normalizedPattern: extractedPattern,
    fullName: clean,
  };
}

/**
 * Live Float Wear Simulation Mathematics.
 *
 * Dynamically calculates effective PBR parameters based on live Steam float wear (0.00 - 1.00):
 * - Effective Roughness: scales upward to simulate micro-abrasion, pitting, and dust.
 * - Effective Metalness: scales upward on painted finishes exposing raw steel, or decreases slightly on anodized metal.
 * - Effective Clearcoat: degrades continuously, dropping to strictly 0.0 for float > 0.55.
 */
export function calculateEffectiveWear(
  baseRoughness: number,
  baseMetalness: number,
  baseClearcoat: number,
  float?: number | null
): {
  effectiveRoughness: number;
  effectiveMetalness: number;
  effectiveClearcoat: number;
} {
  const f =
    typeof float === 'number' && !Number.isNaN(float)
      ? Math.min(1.0, Math.max(0.0, float))
      : 0.0;

  // 1. Effective Roughness
  const effectiveRoughness = Math.min(
    0.95,
    Math.max(0.05, baseRoughness + f * (0.85 - baseRoughness))
  );

  // 2. Effective Metalness
  let effectiveMetalness: number;
  if (baseMetalness <= 0.5) {
    effectiveMetalness = Math.min(
      0.95,
      Math.max(0.1, baseMetalness + Math.pow(f, 1.5) * (0.88 - baseMetalness))
    );
  } else {
    effectiveMetalness = Math.min(
      0.95,
      Math.max(0.4, baseMetalness - f * 0.25)
    );
  }

  // 3. Effective Clearcoat (strictly 0.0 for float > 0.55)
  let effectiveClearcoat = 0.0;
  if (f <= 0.55 && baseClearcoat > 0) {
    effectiveClearcoat = Math.min(
      1.0,
      Math.max(0.0, baseClearcoat * Math.max(0, 1.0 - f * 1.8))
    );
  }

  return {
    effectiveRoughness: Number(effectiveRoughness.toFixed(4)),
    effectiveMetalness: Number(effectiveMetalness.toFixed(4)),
    effectiveClearcoat: Number(effectiveClearcoat.toFixed(4)),
  };
}

/**
 * Returns immediate synchronous fallback base color hex for a given skin/weapon.
 * Prevents unstyled grey flashes during 3D scene initialization.
 */
export function getSkinFallbackColor(
  skinName?: string,
  weaponName?: string,
  rarityColor?: string
): string {
  const { normalizedPattern } = normalizeSkinIdentifier(skinName, weaponName);

  if (normalizedPattern.includes('ice coaled')) {
    return '#00e5ff'; // Radiant Cyan
  }
  if (normalizedPattern.includes('liquidation')) {
    return '#e11d48'; // Crimson
  }
  if (normalizedPattern.includes('royal guard')) {
    return '#991b1b'; // Deep Imperial Red
  }
  if (normalizedPattern.includes('candy apple')) {
    return '#dc2626'; // Candy Apple Red
  }
  if (normalizedPattern.includes('electric blue')) {
    return '#2563eb'; // Electric Cobalt Blue
  }
  if (normalizedPattern.includes('control')) {
    return '#3b82f6'; // Tactical Slate Blue
  }
  if (normalizedPattern.includes('catacombs')) {
    return '#18181b'; // Deep Charcoal
  }
  if (normalizedPattern.includes('late night transit')) {
    return '#0f172a'; // Midnight Slate
  }

  // Rarity color fallback if valid hex
  if (rarityColor && /^#?[0-9a-fA-F]{3,8}$/.test(rarityColor)) {
    return rarityColor.startsWith('#') ? rarityColor : `#${rarityColor}`;
  }

  // CS2 tactical gunmetal default
  return '#334155';
}

// ============================================================================
// PROCEDURAL CANVAS SKIN PAINTERS (1024 x 1024 Canonical Space)
// ============================================================================

type Canvas2D = CanvasRenderingContext2D | HeadlessContext2D;

/**
 * AK-47 | Ice Coaled
 * Radiant cyan to neon mint gradient, carbon fiber crosshatch magazine and stock,
 * technical typography decals ("ICE COALED", speed ticks).
 */
function paintAk47IceCoaled(ctx: Canvas2D, _seed: number): void {
  // 1. Dark matte chassis base
  ctx.fillStyle = '#0f131a';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Receiver & barrel shroud radiant gradient (y: 60 - 580)
  const grad = ctx.createLinearGradient(80, 120, 960, 480);
  grad.addColorStop(0.0, '#00e5ff'); // Radiant Cyan
  grad.addColorStop(0.35, '#06b6d4');
  grad.addColorStop(0.75, '#10b981'); // Neon Mint
  grad.addColorStop(1.0, '#34d399');

  ctx.fillStyle = grad;
  ctx.fillRect(60, 120, 904, 460);

  // Geometric accent panelling and bevel highlights
  ctx.fillStyle = '#090d16';
  ctx.fillRect(60, 120, 904, 30);
  ctx.fillRect(60, 550, 904, 30);

  // Diagonal speed racing stripes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(340, 150);
  ctx.lineTo(440, 320);
  ctx.moveTo(370, 150);
  ctx.lineTo(470, 320);
  ctx.stroke();

  // Technical Decals
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('ICE COALED', 180, 340);

  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('>> >> >> SPEED // TACTICAL SPEC', 180, 385);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '14px monospace';
  ctx.fillText('SER: 730-AK-IC-2026 // TEMP: -40°C', 180, 420);

  // Speed chevrons
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const cx = 720 + i * 36;
    ctx.beginPath();
    ctx.moveTo(cx, 320);
    ctx.lineTo(cx + 18, 340);
    ctx.lineTo(cx, 360);
    ctx.stroke();
  }

  // 3. Magazine & Stock: Carbon fiber diagonal crosshatch weave (y: 600 - 1024)
  ctx.fillStyle = '#11141a';
  ctx.fillRect(40, 600, 944, 400);

  // Diagonal weave +45°
  ctx.strokeStyle = '#1e2430';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = -400; x < 1500; x += 14) {
    ctx.moveTo(x, 600);
    ctx.lineTo(x + 450, 1024);
  }
  ctx.stroke();

  // Diagonal weave -45°
  ctx.strokeStyle = '#283040';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -400; x < 1500; x += 14) {
    ctx.moveTo(x, 1024);
    ctx.lineTo(x + 450, 600);
  }
  ctx.stroke();

  // Magazine structural rib indentations
  ctx.fillStyle = '#090d16';
  for (let ry = 640; ry < 980; ry += 50) {
    ctx.fillRect(80, ry, 360, 16);
  }

  // Stock telemetry stamp
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('COMPOSITE CARBON // MOD.47', 560, 780);
}

/**
 * M4A1-S | Liquidation
 * Crimson and royal violet fluid wave marbling ribbons over dark navy chassis.
 */
function paintM4a1sLiquidation(ctx: Canvas2D, seed: number): void {
  // 1. Dark navy chassis
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Multi-frequency sinuous fluid marbling waves
  const rng = createSeededRandom(seed);
  const waveCount = 18;

  for (let i = 0; i < waveCount; i++) {
    const phase = rng() * Math.PI * 2;
    const freq1 = 0.005 + rng() * 0.006;
    const freq2 = 0.012 + rng() * 0.01;
    const amp1 = 35 + rng() * 45;
    const amp2 = 18 + rng() * 25;
    const baseY = 40 + i * 52;

    // Gradient between Crimson (#e11d48), Royal Violet (#8b5cf6), and Fluid Magenta (#d946ef)
    const waveGrad = ctx.createLinearGradient(0, baseY - 60, 1024, baseY + 60);
    if (i % 3 === 0) {
      waveGrad.addColorStop(0.0, '#e11d48');
      waveGrad.addColorStop(0.5, '#d946ef');
      waveGrad.addColorStop(1.0, '#8b5cf6');
    } else if (i % 3 === 1) {
      waveGrad.addColorStop(0.0, '#8b5cf6');
      waveGrad.addColorStop(0.5, '#be123c');
      waveGrad.addColorStop(1.0, '#e11d48');
    } else {
      waveGrad.addColorStop(0.0, '#7c3aed');
      waveGrad.addColorStop(0.5, '#e11d48');
      waveGrad.addColorStop(1.0, '#a855f7');
    }

    ctx.fillStyle = waveGrad;
    ctx.globalAlpha = 0.85;

    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= 1024; x += 16) {
      const y =
        baseY +
        Math.sin(x * freq1 + phase) * amp1 +
        Math.cos(x * freq2 + phase * 1.5) * amp2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(1024, baseY + 45);
    ctx.lineTo(0, baseY + 45);
    ctx.closePath();
    ctx.fill();

    // Sinuous marbling vein highlight
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(244, 63, 94, 0.7)' : 'rgba(192, 132, 252, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x <= 1024; x += 16) {
      const y =
        baseY +
        Math.sin(x * freq1 + phase) * amp1 +
        Math.cos(x * freq2 + phase * 1.5) * amp2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1.0;

  // Hydrographic swirl vortex accents
  for (let s = 0; s < 4; s++) {
    const sx = 200 + rng() * 624;
    const sy = 200 + rng() * 500;
    const sRadius = 40 + rng() * 60;
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, sRadius, 0, Math.PI * 1.7);
    ctx.stroke();
  }

  // Silencer section dark collar & telemetry stamp
  ctx.fillStyle = '#060911';
  ctx.fillRect(0, 840, 1024, 184);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('LIQUIDATION // 5.56-HYDRO-SPEC', 80, 920);
}

/**
 * AWP | Ice Coaled
 * Long-barrel cyan-to-lime gradient with matte black scope and bipod, reticle telemetry marks.
 */
function paintAwpIceCoaled(ctx: Canvas2D, _seed: number): void {
  // 1. Dark chassis backdrop
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Long chassis rifle gradient (y: 280 - 740)
  const chassisGrad = ctx.createLinearGradient(40, 480, 980, 480);
  chassisGrad.addColorStop(0.0, '#00e5ff'); // Radiant Cyan (stock)
  chassisGrad.addColorStop(0.4, '#06b6d4');
  chassisGrad.addColorStop(0.75, '#10b981'); // Lime / Mint (barrel root)
  chassisGrad.addColorStop(1.0, '#22c55e');

  ctx.fillStyle = chassisGrad;
  ctx.fillRect(40, 280, 944, 460);

  // Slate bevel inset cuts
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(40, 280, 944, 32);
  ctx.fillRect(40, 708, 944, 32);

  // 3. Scope & Bipod matte black assemblies
  // Scope tube section (y: 40 - 250)
  ctx.fillStyle = '#090a0f';
  ctx.fillRect(100, 40, 824, 210);

  // Scope adjustment dials
  ctx.fillStyle = '#18181b';
  ctx.fillRect(440, 20, 140, 40);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;

  // Scope reticle telemetry tick marks
  for (let tx = 140; tx < 880; tx += 28) {
    ctx.beginPath();
    ctx.moveTo(tx, 140);
    ctx.lineTo(tx, 155);
    ctx.stroke();
  }

  // Bipod lower mount (y: 770 - 1000)
  ctx.fillStyle = '#090a0f';
  ctx.fillRect(60, 770, 904, 220);

  // 4. Telemetry Reticle Typography
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px monospace';
  ctx.fillText('AWP // ICE COALED', 120, 460);

  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('TELEMETRY: RNG 1500M // ELEV +2.4 // WIND -0.3', 120, 505);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '13px monospace';
  ctx.fillText('SNIPER SYS-730 // ZERO: 800M // S/N: AWP-992', 120, 540);

  // Reticle crosshair icon
  const rx = 820;
  const ry = 480;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(rx, ry, 36, 0, Math.PI * 2);
  ctx.moveTo(rx - 50, ry);
  ctx.lineTo(rx - 10, ry);
  ctx.moveTo(rx + 10, ry);
  ctx.lineTo(rx + 50, ry);
  ctx.moveTo(rx, ry - 50);
  ctx.lineTo(rx, ry - 10);
  ctx.moveTo(rx, ry + 10);
  ctx.lineTo(rx, ry + 50);
  ctx.stroke();

  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.arc(rx, ry, 4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * USP-S | Royal Guard
 * Deep imperial red slide, metallic gold filigree trim, dark charcoal silencer.
 */
function paintUspsRoyalGuard(ctx: Canvas2D, _seed: number): void {
  // 1. Charcoal frame & silencer backdrop
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Upper Slide: Deep imperial red enamel (y: 60 - 520)
  const redGrad = ctx.createLinearGradient(0, 60, 0, 520);
  redGrad.addColorStop(0.0, '#7f1d1d');
  redGrad.addColorStop(0.3, '#991b1b'); // Imperial Red
  redGrad.addColorStop(0.65, '#b91c1c'); // Specular highlight
  redGrad.addColorStop(1.0, '#7f1d1d');

  ctx.fillStyle = redGrad;
  ctx.fillRect(50, 60, 924, 460);

  // 3. Ornate Metallic Gold Filigree Trim (#f59e0b / #fbbf24)
  // Double-line perimeter border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 5;
  ctx.strokeRect(70, 80, 884, 420);

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.strokeRect(82, 92, 860, 396);

  // Baroque corner scroll flourishes
  const drawCornerScroll = (cx: number, cy: number, flipX: number, flipY: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(flipX, flipY);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(40, 40, 24, 0, Math.PI * 1.5);
    ctx.bezierCurveTo(40, 15, 20, 10, 5, 5);
    ctx.stroke();
    ctx.restore();
  };

  drawCornerScroll(90, 100, 1, 1);
  drawCornerScroll(934, 100, -1, 1);
  drawCornerScroll(90, 480, 1, -1);
  drawCornerScroll(934, 480, -1, -1);

  // Center royal star crest & filigree acanthus leaves
  const mx = 512;
  const my = 290;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#fbbf24';

  // 8-pointed star medallion
  ctx.beginPath();
  for (let a = 0; a < 8; a++) {
    const angle = (a * Math.PI) / 4;
    const rOuter = 45;
    const rInner = 20;
    const ox = mx + Math.cos(angle) * rOuter;
    const oy = my + Math.sin(angle) * rOuter;
    const ix = mx + Math.cos(angle + Math.PI / 8) * rInner;
    const iy = my + Math.sin(angle + Math.PI / 8) * rInner;
    if (a === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Lateral filigree scroll branching
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(mx - 60, my);
  ctx.bezierCurveTo(mx - 150, my - 30, mx - 220, my + 30, mx - 320, my);
  ctx.moveTo(mx + 60, my);
  ctx.bezierCurveTo(mx + 150, my - 30, mx + 220, my + 30, mx + 320, my);
  ctx.stroke();

  // 4. Silencer section: Concentric polished gold collar rings (y: 560 - 1000)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(50, 560, 924, 420);

  // Gold rings
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(80, 620, 864, 14);
  ctx.fillRect(80, 650, 864, 8);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px serif';
  ctx.fillText('ROYAL GUARD // IMPERIAL EDITION', 100, 720);
}

/**
 * MAC-10 | Candy Apple
 * High-gloss candy apple red anodized enamel on upper receiver, matte black lower frame.
 */
function paintMac10CandyApple(ctx: Canvas2D, _seed: number): void {
  // 1. Lower receiver: Matte black (y: 520 - 1024)
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 520, 1024, 504);

  // Matte gunmetal pins and grip texture
  ctx.fillStyle = '#262626';
  ctx.fillRect(80, 560, 864, 30);
  ctx.fillRect(140, 660, 320, 260); // Grip frame

  // 2. Upper receiver: Mirror-gloss candy apple red anodized enamel (y: 0 - 520)
  const candyGrad = ctx.createLinearGradient(0, 0, 1024, 520);
  candyGrad.addColorStop(0.0, '#b91c1c');
  candyGrad.addColorStop(0.25, '#ef4444'); // Specular highlight streak
  candyGrad.addColorStop(0.55, '#dc2626'); // Rich candy apple red
  candyGrad.addColorStop(1.0, '#991b1b');

  ctx.fillStyle = candyGrad;
  ctx.fillRect(0, 0, 1024, 520);

  // Mirror sheen clearcoat glare band
  const glareGrad = ctx.createLinearGradient(0, 120, 1024, 280);
  glareGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
  glareGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.28)');
  glareGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.35)');
  glareGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = glareGrad;
  ctx.fillRect(0, 80, 1024, 240);

  // 3. Demarcation seam between upper and lower
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 514, 1024, 12);
}

/**
 * Zeus x27 | Electric Blue
 * Electric cobalt blue housing with hazard yellow accents and lightning glyphs.
 */
function paintZeusElectricBlue(ctx: Canvas2D, _seed: number): void {
  // 1. Dark polymer chassis background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Electric cobalt blue housing (y: 80 - 640)
  const blueGrad = ctx.createLinearGradient(60, 100, 960, 600);
  blueGrad.addColorStop(0.0, '#1d4ed8');
  blueGrad.addColorStop(0.4, '#2563eb'); // Cobalt Blue
  blueGrad.addColorStop(0.85, '#3b82f6');
  blueGrad.addColorStop(1.0, '#1e40af');

  ctx.fillStyle = blueGrad;
  ctx.fillRect(60, 80, 904, 560);

  // Cyan electrical contour bevels
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(80, 100, 864, 520);

  // 3. Hazard Yellow Caution Stripes (Rear cartridge block: x: 640 - 920, y: 120 - 460)
  ctx.save();
  ctx.beginPath();
  ctx.rect(640, 120, 280, 340);
  ctx.clip();

  ctx.fillStyle = '#eab308'; // Hazard Yellow
  ctx.fillRect(640, 120, 280, 340);

  // Dark 45° stripes
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 26;
  ctx.beginPath();
  for (let d = 400; d < 1200; d += 52) {
    ctx.moveTo(d, 0);
    ctx.lineTo(d - 500, 600);
  }
  ctx.stroke();
  ctx.restore();

  // Black border around hazard zone
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 6;
  ctx.strokeRect(640, 120, 280, 340);

  // 4. Lightning Bolt Glyph
  const lx = 340;
  const ly = 320;
  ctx.fillStyle = '#fef08a';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(lx, ly - 90);
  ctx.lineTo(lx - 45, ly + 10);
  ctx.lineTo(lx - 10, ly + 10);
  ctx.lineTo(lx - 35, ly + 90);
  ctx.lineTo(lx + 50, ly - 10);
  ctx.lineTo(lx + 15, ly - 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 5. Stencil Danger Decals
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px monospace';
  ctx.fillText('HIGH VOLTAGE // 25KV', 120, 220);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('CAUTION: TASER DISCHARGE', 120, 260);

  // Grip texture lower block
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(60, 680, 904, 300);
  ctx.fillStyle = '#1e293b';
  for (let gx = 100; gx < 920; gx += 40) {
    ctx.fillRect(gx, 720, 20, 220);
  }
}

/**
 * Galil AR | Control
 * Slate blue radar scanline grid with tactical crosshairs and index markers.
 */
function paintGalilArControl(ctx: Canvas2D, _seed: number): void {
  // 1. Dark tactical chassis
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Slate blue tactical receiver (y: 60 - 720)
  const slateGrad = ctx.createLinearGradient(0, 80, 1024, 700);
  slateGrad.addColorStop(0.0, '#1e3a8a');
  slateGrad.addColorStop(0.5, '#2563eb'); // Slate Blue
  slateGrad.addColorStop(1.0, '#1e40af');

  ctx.fillStyle = slateGrad;
  ctx.fillRect(40, 60, 944, 660);

  // 3. Precision Radar Scanline Grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)'; // Cyan Grid
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 60; x <= 960; x += 36) {
    ctx.moveTo(x, 80);
    ctx.lineTo(x, 700);
  }
  for (let y = 80; y <= 700; y += 36) {
    ctx.moveTo(60, y);
    ctx.lineTo(960, y);
  }
  ctx.stroke();

  // Radar Concentric Range Rings centered at (480, 390)
  const rcx = 480;
  const rcy = 390;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;

  const radii = [70, 140, 220, 300];
  for (const r of radii) {
    ctx.beginPath();
    ctx.arc(rcx, rcy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Tactical Crosshairs
  ctx.strokeStyle = '#f59e0b'; // Hazard Amber Crosshairs
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(rcx - 340, rcy);
  ctx.lineTo(rcx - 40, rcy);
  ctx.moveTo(rcx + 40, rcy);
  ctx.lineTo(rcx + 340, rcy);
  ctx.moveTo(rcx, rcy - 240);
  ctx.lineTo(rcx, rcy - 40);
  ctx.moveTo(rcx, rcy + 40);
  ctx.lineTo(rcx, rcy + 240);
  ctx.stroke();

  // Center targeting dot
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(rcx, rcy, 6, 0, Math.PI * 2);
  ctx.fill();

  // 4. Telemetry Index Decals
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('CONTROL // RADAR SYS', 80, 160);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('SECTOR: 07-BRAVO // GRID 42.8N', 80, 200);

  ctx.fillStyle = '#f59e0b';
  ctx.font = '14px monospace';
  ctx.fillText('[ RADAR SWEEP ACTIVE // FREQ: 9.4 GHz ]', 80, 230);
}

/**
 * Glock-18 | Catacombs
 * Skull graphic fading into charcoal slide smoke.
 */
function paintGlock18Catacombs(ctx: Canvas2D, seed: number): void {
  // 1. Lower frame: Glock polymer matte black (y: 520 - 1024)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 520, 1024, 504);

  // Stippled grip texture
  ctx.fillStyle = '#09090b';
  ctx.fillRect(120, 560, 340, 420);

  // 2. Upper Slide: Deep charcoal (y: 60 - 520)
  ctx.fillStyle = '#09090b';
  ctx.fillRect(40, 60, 944, 460);

  // 3. Smoke wisps & particulate fading towards rear slide (x: 480 - 960)
  const rng = createSeededRandom(seed);
  const smokeGrad = ctx.createLinearGradient(400, 280, 960, 280);
  smokeGrad.addColorStop(0.0, 'rgba(63, 63, 70, 0.8)');
  smokeGrad.addColorStop(0.6, 'rgba(39, 39, 42, 0.6)');
  smokeGrad.addColorStop(1.0, 'rgba(9, 9, 11, 0.95)');

  ctx.fillStyle = smokeGrad;
  for (let s = 0; s < 10; s++) {
    const sy = 120 + s * 38;
    ctx.beginPath();
    ctx.moveTo(420, sy);
    ctx.bezierCurveTo(600 + rng() * 100, sy - 30, 750 + rng() * 100, sy + 40, 960, sy);
    ctx.lineTo(960, sy + 30);
    ctx.bezierCurveTo(750, sy + 60, 600, sy, 420, sy + 25);
    ctx.closePath();
    ctx.fill();
  }

  // 4. Stylized Bone-White Skulls (Front Slide: x: 80 - 520)
  const drawSkull = (sx: number, sy: number, scale: number) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);

    // Cranium
    ctx.fillStyle = '#f1f5f9'; // Bone White
    ctx.beginPath();
    ctx.arc(0, 0, 55, Math.PI, 0, false);
    ctx.bezierCurveTo(55, 30, 35, 65, 25, 75);
    ctx.lineTo(-25, 75);
    ctx.bezierCurveTo(-35, 65, -55, 30, -55, 0);
    ctx.closePath();
    ctx.fill();

    // Jaw teeth block
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-22, 75, 44, 25);

    // Hollow eye sockets
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.ellipse(-20, 15, 14, 18, 0.1, 0, Math.PI * 2);
    ctx.ellipse(20, 15, 14, 18, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Nasal cavity
    ctx.beginPath();
    ctx.moveTo(0, 35);
    ctx.lineTo(-7, 52);
    ctx.lineTo(7, 52);
    ctx.closePath();
    ctx.fill();

    // Teeth lines
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let t = -15; t <= 15; t += 10) {
      ctx.moveTo(t, 75);
      ctx.lineTo(t, 100);
    }
    ctx.stroke();

    ctx.restore();
  };

  // Multiple clustered skulls
  drawSkull(200, 270, 1.15);
  drawSkull(330, 310, 0.95);
  drawSkull(440, 260, 0.8);
}

/**
 * UMP-45 | Late Night Transit
 * Metro transit schematic lines (cyan, magenta, green, yellow) with heavy battle scuffs.
 */
function paintUmp45LateNightTransit(ctx: Canvas2D, _seed: number): void {
  // 1. Midnight chassis base
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 1024);

  // Tactical sub-panels
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, 60, 944, 620);

  // 2. Transit Schematic Route Lines
  // Line 1: Transit Cyan (#06b6d4)
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(60, 180);
  ctx.lineTo(380, 180);
  ctx.lineTo(520, 320);
  ctx.lineTo(960, 320);
  ctx.stroke();

  // Line 2: Transit Magenta (#ec4899)
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(60, 480);
  ctx.lineTo(320, 480);
  ctx.lineTo(460, 340);
  ctx.lineTo(720, 340);
  ctx.lineTo(840, 220);
  ctx.lineTo(960, 220);
  ctx.stroke();

  // Line 3: Transit Green (#22c55e)
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(140, 600);
  ctx.lineTo(480, 260);
  ctx.lineTo(960, 260);
  ctx.stroke();

  // Line 4: Transit Yellow (#eab308)
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(60, 360);
  ctx.lineTo(960, 360);
  ctx.stroke();

  // Station Node Transfer Interchange circles
  const drawStation = (x: number, y: number, isTransfer = false) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, isTransfer ? 14 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isTransfer) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawStation(200, 180);
  drawStation(380, 180);
  drawStation(460, 340, true);
  drawStation(520, 320, true);
  drawStation(720, 340);
  drawStation(840, 220);
  drawStation(480, 360, true);

  // Transit Decals
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('METRO TRANSIT MAP', 80, 120);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('NIGHT LINE NETWORK // S-LINE 4', 80, 640);
}

/**
 * Generic Procedural Fallback Compositor
 * Generates authentic tactical finishes for unlisted skins based on rarityColor, weapon key, and seed.
 */
function paintGenericFallback(
  ctx: Canvas2D,
  seed: number,
  rarityColor?: string,
  weaponName?: string
): void {
  const baseColor = rarityColor && /^#?[0-9a-fA-F]{3,8}$/.test(rarityColor)
    ? (rarityColor.startsWith('#') ? rarityColor : `#${rarityColor}`)
    : '#3b82f6';

  // 1. Base coat tinted with rarity color
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Primary finish band
  const grad = ctx.createLinearGradient(0, 0, 1024, 700);
  grad.addColorStop(0.0, baseColor);
  grad.addColorStop(1.0, '#1e293b');

  ctx.fillStyle = grad;
  ctx.fillRect(40, 60, 944, 620);

  // 3. Seed-modulated geometric digital camo
  const rng = createSeededRandom(seed);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  for (let b = 0; b < 24; b++) {
    const bx = 60 + rng() * 800;
    const by = 80 + rng() * 500;
    const bw = 40 + rng() * 90;
    const bh = 25 + rng() * 60;
    ctx.fillRect(bx, by, bw, bh);
  }

  // 4. Stenciled technical identification
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px monospace';
  const label = (weaponName || 'CS2 WEAPON').toUpperCase();
  ctx.fillText(`TACTICAL SPEC // ${label}`, 80, 160);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`PATTERN SEED: ${seed} // FINISH: CUSTOM`, 80, 205);
}

/**
 * Procedural edge wear scuffs & scratch clusters overlaid onto canvas based on float rating.
 */
function applyFloatWearOverlay(
  ctx: Canvas2D,
  width: number,
  height: number,
  float: number,
  seed: number
): void {
  if (float <= 0.03) return;

  const rng = createSeededRandom(seed + 999);
  const scuffCount = Math.round(float * 80);

  ctx.save();
  ctx.scale(width / 1024, height / 1024);

  // 1. Bare oxidized steel scratch clusters (#555f6d)
  for (let i = 0; i < scuffCount; i++) {
    const x = rng() * 1024;
    const y = rng() * 1024;
    const len = 12 + rng() * 32 * (1 + float);
    const angle = rng() * Math.PI;

    // Primer dark pit shadow
    ctx.strokeStyle = '#2a323d';
    ctx.lineWidth = 2 + float * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();

    // Bare steel abraded line
    ctx.strokeStyle = '#555f6d';
    ctx.lineWidth = 1.5 + float * 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 1);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();

    // Highlighted edge metal lip
    ctx.strokeStyle = 'rgba(140, 150, 164, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 1);
    ctx.lineTo(x + Math.cos(angle) * (len * 0.7), y + Math.sin(angle) * (len * 0.7));
    ctx.stroke();
  }

  // 2. High float paint chips & scraped edges (float > 0.40)
  if (float > 0.4) {
    const chipCount = Math.round((float - 0.4) * 40);
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;

    for (let c = 0; c < chipCount; c++) {
      const cx = rng() * 1024;
      const cy = rng() * 1024;
      const cr = 6 + rng() * 18 * float;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ============================================================================
// MAIN COMPOSITOR PIPELINE
// ============================================================================

interface SkinPresetDefinition {
  baseColorHex: string;
  baseRoughness: number;
  baseMetalness: number;
  baseClearcoat: number;
  paint: (ctx: Canvas2D, seed: number) => void;
}

/**
 * Procedural canvas skin compositor generating authentic CS2 weapon skin diffuse textures.
 */
export function compositeSkinFinish(options: SkinCompositeOptions): SkinCompositeResult {
  const {
    weaponName,
    skinName,
    float = 0.0,
    seed = 0,
    rarityColor,
    width = 1024,
    height = 1024,
  } = options;

  const { normalizedPattern, normalizedWeapon, fullName } = normalizeSkinIdentifier(
    skinName,
    weaponName
  );

  let preset: SkinPresetDefinition;

  // Resolve matching signature skin preset
  if (
    normalizedPattern.includes('ice coaled') ||
    fullName.includes('ice coaled')
  ) {
    // Disambiguate between AK-47 and AWP
    if (
      normalizedWeapon.includes('awp') ||
      normalizedWeapon.includes('snip_awp') ||
      fullName.includes('awp')
    ) {
      preset = {
        baseColorHex: '#00e5ff',
        baseRoughness: 0.22,
        baseMetalness: 0.3,
        baseClearcoat: 0.5,
        paint: (ctx, s) => paintAwpIceCoaled(ctx, s),
      };
    } else {
      preset = {
        baseColorHex: '#00e5ff',
        baseRoughness: 0.28,
        baseMetalness: 0.35,
        baseClearcoat: 0.45,
        paint: (ctx, s) => paintAk47IceCoaled(ctx, s),
      };
    }
  } else if (normalizedPattern.includes('liquidation') || fullName.includes('liquidation')) {
    preset = {
      baseColorHex: '#e11d48',
      baseRoughness: 0.32,
      baseMetalness: 0.45,
      baseClearcoat: 0.35,
      paint: (ctx, s) => paintM4a1sLiquidation(ctx, s),
    };
  } else if (normalizedPattern.includes('royal guard') || fullName.includes('royal guard')) {
    preset = {
      baseColorHex: '#991b1b',
      baseRoughness: 0.18,
      baseMetalness: 0.75,
      baseClearcoat: 0.65,
      paint: (ctx, s) => paintUspsRoyalGuard(ctx, s),
    };
  } else if (normalizedPattern.includes('candy apple') || fullName.includes('candy apple')) {
    preset = {
      baseColorHex: '#dc2626',
      baseRoughness: 0.12,
      baseMetalness: 0.7,
      baseClearcoat: 0.85,
      paint: (ctx, s) => paintMac10CandyApple(ctx, s),
    };
  } else if (normalizedPattern.includes('electric blue') || fullName.includes('electric blue')) {
    preset = {
      baseColorHex: '#2563eb',
      baseRoughness: 0.35,
      baseMetalness: 0.3,
      baseClearcoat: 0.2,
      paint: (ctx, s) => paintZeusElectricBlue(ctx, s),
    };
  } else if (normalizedPattern.includes('control') || fullName.includes('control')) {
    preset = {
      baseColorHex: '#3b82f6',
      baseRoughness: 0.38,
      baseMetalness: 0.45,
      baseClearcoat: 0.15,
      paint: (ctx, s) => paintGalilArControl(ctx, s),
    };
  } else if (normalizedPattern.includes('catacombs') || fullName.includes('catacombs')) {
    preset = {
      baseColorHex: '#18181b',
      baseRoughness: 0.42,
      baseMetalness: 0.2,
      baseClearcoat: 0.1,
      paint: (ctx, s) => paintGlock18Catacombs(ctx, s),
    };
  } else if (
    normalizedPattern.includes('late night transit') ||
    fullName.includes('late night transit')
  ) {
    preset = {
      baseColorHex: '#0f172a',
      baseRoughness: 0.7,
      baseMetalness: 0.75,
      baseClearcoat: 0.0,
      paint: (ctx, s) => paintUmp45LateNightTransit(ctx, s),
    };
  } else {
    // Generic procedural fallback
    preset = {
      baseColorHex: getSkinFallbackColor(skinName, weaponName, rarityColor),
      baseRoughness: 0.35,
      baseMetalness: 0.5,
      baseClearcoat: 0.2,
      paint: (ctx, s) => paintGenericFallback(ctx, s, rarityColor, weaponName),
    };
  }

  // Calculate live float wear
  const wear = calculateEffectiveWear(
    preset.baseRoughness,
    preset.baseMetalness,
    preset.baseClearcoat,
    float
  );

  // Initialize Canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as Canvas2D | null;

  if (ctx) {
    ctx.save();
    ctx.scale(width / 1024, height / 1024);
    preset.paint(ctx, seed ?? 0);
    ctx.restore();

    // Overlay live float wear abrasion and scratches
    const validFloat =
      typeof float === 'number' && !Number.isNaN(float) ? Math.min(1.0, Math.max(0.0, float)) : 0.0;
    applyFloatWearOverlay(ctx, width, height, validFloat, seed ?? 0);
  }

  // Create THREE.CanvasTexture with SRGBColorSpace
  const texture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return {
    texture,
    effectiveRoughness: wear.effectiveRoughness,
    effectiveMetalness: wear.effectiveMetalness,
    effectiveClearcoat: wear.effectiveClearcoat,
    baseColorHex: preset.baseColorHex,
  };
}
