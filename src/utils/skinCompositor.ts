import * as THREE from 'three';

/**
 * CS2 Weapon Skin Finish Painter & Compositor
 *
 * Procedurally generates authentic CS2 weapon skin diffuse textures
 * (THREE.CanvasTexture with SRGBColorSpace) for signature skins,
 * isolates geometry-aware Source 2 UV island clusters,
 * supports 5 Valve Source 2 finish styles (Custom, Gunsmith, Anodized, Hydrographic, Patina),
 * simulates live float wear (0.00 - 1.00) across PBR properties,
 * and provides instant synchronous fallback base colors.
 */

/** Supported Valve Source 2 weapon finish styles */
export type FinishStyle = 'custom' | 'gunsmith' | 'anodized' | 'hydrographic' | 'patina';

export interface SkinCompositeOptions {
  weaponName?: string;
  skinName?: string;
  float?: number | null;
  seed?: number | null;
  rarityColor?: string;
  width?: number;
  height?: number;
  masksTexture?: THREE.Texture | HTMLImageElement | null;
}

export interface SkinCompositeResult {
  texture: THREE.CanvasTexture;
  effectiveRoughness: number;
  effectiveMetalness: number;
  effectiveClearcoat: number;
  baseColorHex: string;
  finishStyle: FinishStyle;
}

/** Normalized UV coordinate bounding box [0.0 - 1.0] */
export interface UvBounds {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

/** Pixel bounding rectangle in canonical 1024 x 1024 canvas space */
export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 2D Bounding box defining a weapon UV island cluster on the 1024x1024 texture canvas */
export interface UvIslandBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Definition of a distinct Source 2 UV island component */
export interface UvIsland {
  id: string;
  name: string;
  bounds: UvBounds;
  canvasRect: CanvasRect;
  maskChannel?: 'R' | 'G' | 'B' | 'A';
  description?: string;
}

/** Comprehensive UV layout for a CS2 weapon model */
export interface WeaponUvLayout {
  weaponKey: string;
  weaponName: string;
  primaryPaintIslands: string[];
  secondaryIslands: string[];
  furnitureIslands: string[];
  islands: Record<string, UvIsland>;
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

// ============================================================================
// AUTHORITATIVE UV ISLANDS DICTIONARY (All 9 CS2 Weapon Models)
// ============================================================================

export const WEAPON_UV_ISLANDS: Record<string, WeaponUvLayout> = {
  // 1. AK-47
  rif_ak47: {
    weaponKey: 'rif_ak47',
    weaponName: 'AK-47',
    primaryPaintIslands: ['receiver', 'handguard'],
    secondaryIslands: ['barrel'],
    furnitureIslands: ['magazine', 'stock', 'grip'],
    islands: {
      receiver: {
        id: 'receiver',
        name: 'Receiver & Dust Cover',
        bounds: { uMin: 0.0899, uMax: 0.9709, vMin: 0.0613, vMax: 0.9807 },
        canvasRect: { x: 80, y: 120, width: 880, height: 440 },
        maskChannel: 'R',
      },
      handguard: {
        id: 'handguard',
        name: 'Forearm Handguard',
        bounds: { uMin: 0.1661, uMax: 0.9807, vMin: 0.0421, vMax: 0.9710 },
        canvasRect: { x: 170, y: 120, width: 810, height: 260 },
        maskChannel: 'R',
      },
      magazine: {
        id: 'magazine',
        name: '30-Round Curved Magazine',
        bounds: { uMin: 0.3690, uMax: 0.5960, vMin: 0.1000, vMax: 0.4370 },
        canvasRect: { x: 375, y: 575, width: 240, height: 350 },
        maskChannel: 'G',
      },
      stock: {
        id: 'stock',
        name: 'Wooden/Composite Buttstock',
        bounds: { uMin: 0.0030, uMax: 0.3530, vMin: 0.0060, vMax: 0.3640 },
        canvasRect: { x: 0, y: 650, width: 365, height: 370 },
        maskChannel: 'G',
      },
      barrel: {
        id: 'barrel',
        name: 'Barrel & Gas Tube',
        bounds: { uMin: 0.1907, uMax: 0.9471, vMin: 0.0610, vMax: 0.8748 },
        canvasRect: { x: 195, y: 128, width: 775, height: 280 },
        maskChannel: 'B',
      },
      grip: {
        id: 'grip',
        name: 'Pistol Grip',
        bounds: { uMin: 0.7272, uMax: 0.8409, vMin: 0.4999, vMax: 0.6914 },
        canvasRect: { x: 740, y: 315, width: 125, height: 200 },
        maskChannel: 'G',
      },
    },
  },

  // 2. M4A1-S
  rif_m4a1_s: {
    weaponKey: 'rif_m4a1_s',
    weaponName: 'M4A1-S',
    primaryPaintIslands: ['receiver', 'handguard', 'silencer'],
    secondaryIslands: ['stock'],
    furnitureIslands: ['magazine', 'grip'],
    islands: {
      receiver: {
        id: 'receiver',
        name: 'Upper & Lower Receiver',
        bounds: { uMin: 0.0030, uMax: 0.8060, vMin: 0.0030, vMax: 0.3030 },
        canvasRect: { x: 0, y: 710, width: 820, height: 310 },
        maskChannel: 'R',
      },
      handguard: {
        id: 'handguard',
        name: 'Quad-Rail Handguard',
        bounds: { uMin: 0.0030, uMax: 0.7760, vMin: 0.0030, vMax: 0.2710 },
        canvasRect: { x: 0, y: 740, width: 790, height: 280 },
        maskChannel: 'R',
      },
      silencer: {
        id: 'silencer',
        name: 'Detachable Suppressor Cylinder',
        bounds: { uMin: 0.1070, uMax: 0.9680, vMin: 0.1110, vMax: 0.9260 },
        canvasRect: { x: 0, y: 840, width: 1024, height: 184 },
        maskChannel: 'R',
      },
      stock: {
        id: 'stock',
        name: 'Telescoping Carbine Stock',
        bounds: { uMin: 0.0230, uMax: 0.9630, vMin: 0.1570, vMax: 0.9560 },
        canvasRect: { x: 24, y: 45, width: 962, height: 500 },
        maskChannel: 'G',
      },
      magazine: {
        id: 'magazine',
        name: '20-Round STANAG Magazine',
        bounds: { uMin: 0.2730, uMax: 0.9470, vMin: 0.1390, vMax: 0.8390 },
        canvasRect: { x: 280, y: 165, width: 690, height: 550 },
        maskChannel: 'B',
      },
      grip: {
        id: 'grip',
        name: 'Pistol Grip',
        bounds: { uMin: 0.0210, uMax: 0.9660, vMin: 0.2270, vMax: 0.9110 },
        canvasRect: { x: 22, y: 91, width: 968, height: 500 },
        maskChannel: 'G',
      },
    },
  },

  // 3. AWP
  snip_awp: {
    weaponKey: 'snip_awp',
    weaponName: 'AWP',
    primaryPaintIslands: ['body', 'barrel'],
    secondaryIslands: ['scope'],
    furnitureIslands: ['bipod_muzzle', 'magazine'],
    islands: {
      body: {
        id: 'body',
        name: 'Sniper Chassis Body & Stock',
        bounds: { uMin: 0.0680, uMax: 0.9530, vMin: 0.0730, vMax: 0.9820 },
        canvasRect: { x: 40, y: 280, width: 944, height: 460 },
        maskChannel: 'R',
      },
      scope: {
        id: 'scope',
        name: 'Telescopic Scope Assembly',
        bounds: { uMin: 0.0270, uMax: 0.9760, vMin: 0.0870, vMax: 0.9680 },
        canvasRect: { x: 100, y: 40, width: 824, height: 210 },
        maskChannel: 'B',
      },
      barrel: {
        id: 'barrel',
        name: 'Heavy Match Barrel',
        bounds: { uMin: 0.1580, uMax: 0.9840, vMin: 0.0660, vMax: 0.9730 },
        canvasRect: { x: 160, y: 280, width: 840, height: 350 },
        maskChannel: 'R',
      },
      bipod_muzzle: {
        id: 'bipod_muzzle',
        name: 'Bipod Mount & Muzzle Brake',
        bounds: { uMin: 0.1810, uMax: 0.9900, vMin: 0.0660, vMax: 0.9540 },
        canvasRect: { x: 60, y: 770, width: 904, height: 220 },
        maskChannel: 'B',
      },
      magazine: {
        id: 'magazine',
        name: '10-Round Box Magazine',
        bounds: { uMin: 0.1350, uMax: 0.8120, vMin: 0.2320, vMax: 0.9820 },
        canvasRect: { x: 138, y: 400, width: 690, height: 350 },
        maskChannel: 'G',
      },
    },
  },

  // 4. USP-S
  pist_223: {
    weaponKey: 'pist_223',
    weaponName: 'USP-S',
    primaryPaintIslands: ['slide'],
    secondaryIslands: ['silencer'],
    furnitureIslands: ['frame_grip'],
    islands: {
      slide: {
        id: 'slide',
        name: 'Steel Slide & Serrations',
        bounds: { uMin: 0.0040, uMax: 0.6020, vMin: 0.3050, vMax: 0.4920 },
        canvasRect: { x: 50, y: 60, width: 924, height: 460 },
        maskChannel: 'R',
      },
      silencer: {
        id: 'silencer',
        name: 'Tactical Silencer Tube & Rings',
        bounds: { uMin: 0.0030, uMax: 0.4300, vMin: 0.1230, vMax: 0.2630 },
        canvasRect: { x: 50, y: 560, width: 924, height: 420 },
        maskChannel: 'G',
      },
      frame_grip: {
        id: 'frame_grip',
        name: 'Polymer Frame & Stippled Grip',
        bounds: { uMin: 0.1730, uMax: 0.7930, vMin: 0.2840, vMax: 0.8340 },
        canvasRect: { x: 170, y: 170, width: 640, height: 560 },
        maskChannel: 'B',
      },
    },
  },

  // 5. Glock-18
  pist_glock18: {
    weaponKey: 'pist_glock18',
    weaponName: 'Glock-18',
    primaryPaintIslands: ['slide'],
    secondaryIslands: [],
    furnitureIslands: ['frame_grip'],
    islands: {
      slide: {
        id: 'slide',
        name: 'Steel Slide',
        bounds: { uMin: 0.0020, uMax: 0.5870, vMin: 0.3570, vMax: 0.4860 },
        canvasRect: { x: 40, y: 60, width: 944, height: 460 },
        maskChannel: 'R',
      },
      frame_grip: {
        id: 'frame_grip',
        name: 'Polymer Frame & Grip',
        bounds: { uMin: 0.0030, uMax: 0.8500, vMin: 0.0070, vMax: 0.7690 },
        canvasRect: { x: 0, y: 520, width: 1024, height: 504 },
        maskChannel: 'G',
      },
    },
  },

  // 6. MAC-10
  smg_mac10: {
    weaponKey: 'smg_mac10',
    weaponName: 'MAC-10',
    primaryPaintIslands: ['upper_receiver'],
    secondaryIslands: ['wire_stock'],
    furnitureIslands: ['lower_frame', 'grip_mag'],
    islands: {
      upper_receiver: {
        id: 'upper_receiver',
        name: 'Stamped Upper Receiver',
        bounds: { uMin: 0.0030, uMax: 0.7950, vMin: 0.5580, vMax: 0.6110 },
        canvasRect: { x: 0, y: 0, width: 1024, height: 520 },
        maskChannel: 'R',
      },
      lower_frame: {
        id: 'lower_frame',
        name: 'Lower Frame Chassis',
        bounds: { uMin: 0.0760, uMax: 0.9670, vMin: 0.0150, vMax: 0.6950 },
        canvasRect: { x: 0, y: 520, width: 1024, height: 504 },
        maskChannel: 'G',
      },
      grip_mag: {
        id: 'grip_mag',
        name: 'Vertical Grip & Stick Magazine',
        bounds: { uMin: 0.0970, uMax: 0.9590, vMin: 0.0040, vMax: 0.9710 },
        canvasRect: { x: 140, y: 660, width: 320, height: 260 },
        maskChannel: 'B',
      },
      wire_stock: {
        id: 'wire_stock',
        name: 'Retractable Wire Stock',
        bounds: { uMin: 0.7830, uMax: 0.8620, vMin: 0.9200, vMax: 0.9710 },
        canvasRect: { x: 800, y: 30, width: 85, height: 55 },
        maskChannel: 'G',
      },
    },
  },

  // 7. Zeus x27
  pist_taser: {
    weaponKey: 'pist_taser',
    weaponName: 'Zeus x27',
    primaryPaintIslands: ['housing'],
    secondaryIslands: ['cartridge'],
    furnitureIslands: ['grip'],
    islands: {
      housing: {
        id: 'housing',
        name: 'High-Voltage Housing Chassis',
        bounds: { uMin: 0.2110, uMax: 0.7600, vMin: 0.3690, vMax: 0.8070 },
        canvasRect: { x: 60, y: 80, width: 904, height: 560 },
        maskChannel: 'R',
      },
      cartridge: {
        id: 'cartridge',
        name: 'Front Cartridge & Prongs',
        bounds: { uMin: 0.6250, uMax: 0.6980, vMin: 0.9170, vMax: 0.9900 },
        canvasRect: { x: 640, y: 120, width: 280, height: 340 },
        maskChannel: 'B',
      },
      grip: {
        id: 'grip',
        name: 'Pistol Grip',
        bounds: { uMin: 0.0200, uMax: 0.9460, vMin: 0.0390, vMax: 0.9650 },
        canvasRect: { x: 60, y: 680, width: 904, height: 300 },
        maskChannel: 'G',
      },
    },
  },

  // 8. Galil AR
  rif_galilar: {
    weaponKey: 'rif_galilar',
    weaponName: 'Galil AR',
    primaryPaintIslands: ['receiver', 'handguard'],
    secondaryIslands: ['barrel'],
    furnitureIslands: ['stock', 'magazine'],
    islands: {
      receiver: {
        id: 'receiver',
        name: 'Receiver & Dust Cover',
        bounds: { uMin: 0.2410, uMax: 0.7370, vMin: 0.0030, vMax: 0.3750 },
        canvasRect: { x: 40, y: 60, width: 944, height: 660 },
        maskChannel: 'R',
      },
      handguard: {
        id: 'handguard',
        name: 'Handguard Forearm',
        bounds: { uMin: 0.0030, uMax: 0.6920, vMin: 0.5660, vMax: 0.7510 },
        canvasRect: { x: 0, y: 250, width: 710, height: 190 },
        maskChannel: 'R',
      },
      stock: {
        id: 'stock',
        name: 'Tubular Folding Stock',
        bounds: { uMin: 0.0270, uMax: 0.9360, vMin: 0.0560, vMax: 0.9380 },
        canvasRect: { x: 28, y: 63, width: 931, height: 903 },
        maskChannel: 'G',
      },
      magazine: {
        id: 'magazine',
        name: '35-Round Steel Magazine',
        bounds: { uMin: 0.2500, uMax: 0.8870, vMin: 0.0370, vMax: 0.8430 },
        canvasRect: { x: 250, y: 640, width: 500, height: 380 },
        maskChannel: 'B',
      },
      barrel: {
        id: 'barrel',
        name: 'Barrel & Gas Block',
        bounds: { uMin: 0.0910, uMax: 0.9470, vMin: 0.0620, vMax: 0.9830 },
        canvasRect: { x: 93, y: 17, width: 877, height: 943 },
        maskChannel: 'B',
      },
    },
  },

  // 9. UMP-45
  smg_ump45: {
    weaponKey: 'smg_ump45',
    weaponName: 'UMP-45',
    primaryPaintIslands: ['upper_receiver'],
    secondaryIslands: ['barrel_handguard'],
    furnitureIslands: ['lower_grip', 'stock'],
    islands: {
      upper_receiver: {
        id: 'upper_receiver',
        name: 'Upper Receiver & Top Rail',
        bounds: { uMin: 0.0030, uMax: 0.5810, vMin: 0.0030, vMax: 0.4170 },
        canvasRect: { x: 40, y: 60, width: 944, height: 620 },
        maskChannel: 'R',
      },
      barrel_handguard: {
        id: 'barrel_handguard',
        name: 'Forward Barrel & Handguard Rail',
        bounds: { uMin: 0.6030, uMax: 0.7280, vMin: 0.5690, vMax: 0.6780 },
        canvasRect: { x: 615, y: 330, width: 130, height: 110 },
        maskChannel: 'B',
      },
      lower_grip: {
        id: 'lower_grip',
        name: 'Lower Frame & Pistol Grip',
        bounds: { uMin: 0.0920, uMax: 0.7720, vMin: 0.3600, vMax: 0.9410 },
        canvasRect: { x: 94, y: 60, width: 696, height: 595 },
        maskChannel: 'G',
      },
      stock: {
        id: 'stock',
        name: 'Folding Skeleton Stock',
        bounds: { uMin: 0.0020, uMax: 0.5940, vMin: 0.4530, vMax: 0.6440 },
        canvasRect: { x: 0, y: 360, width: 610, height: 200 },
        maskChannel: 'G',
      },
    },
  },
};

// Canonical model key aliases
WEAPON_UV_ISLANDS['pist_usp_silencer'] = WEAPON_UV_ISLANDS['pist_223'];
WEAPON_UV_ISLANDS['rif_m4a1_silencer'] = WEAPON_UV_ISLANDS['rif_m4a1_s'];

/**
 * 2D Island coordinate bounds dictionary in { x, y, w, h } format.
 */
export const WEAPON_UV_LAYOUTS: Record<string, Record<string, UvIslandBox>> = {
  rif_ak47: {
    receiver: { x: 80, y: 120, w: 880, h: 440 },
    handguard: { x: 170, y: 120, w: 810, h: 260 },
    magazine: { x: 375, y: 575, w: 240, h: 350 },
    stock: { x: 0, y: 650, w: 365, h: 370 },
    barrel: { x: 195, y: 128, w: 775, h: 280 },
    grip: { x: 740, y: 315, w: 125, h: 200 },
  },
  rif_m4a1_s: {
    receiver: { x: 0, y: 710, w: 820, h: 310 },
    handguard: { x: 0, y: 740, w: 790, h: 280 },
    silencer: { x: 0, y: 840, w: 1024, h: 184 },
    stock: { x: 24, y: 45, w: 962, h: 500 },
    magazine: { x: 280, y: 165, w: 690, h: 550 },
    grip: { x: 22, y: 91, w: 968, h: 500 },
  },
  snip_awp: {
    body: { x: 40, y: 280, w: 944, h: 460 },
    receiver: { x: 40, y: 280, w: 944, h: 460 },
    scope: { x: 100, y: 40, w: 824, h: 210 },
    barrel: { x: 160, y: 280, w: 840, h: 350 },
    bipod: { x: 60, y: 770, w: 904, h: 220 },
    bipod_muzzle: { x: 60, y: 770, w: 904, h: 220 },
    magazine: { x: 138, y: 400, w: 690, h: 350 },
  },
  pist_223: {
    slide: { x: 50, y: 60, w: 924, h: 460 },
    receiver: { x: 50, y: 60, w: 924, h: 460 },
    silencer: { x: 50, y: 560, w: 924, h: 420 },
    frame_grip: { x: 170, y: 170, w: 640, h: 560 },
    grip: { x: 170, y: 170, w: 640, h: 560 },
  },
  pist_glock18: {
    slide: { x: 40, y: 60, w: 944, h: 460 },
    receiver: { x: 40, y: 60, w: 944, h: 460 },
    frame_grip: { x: 0, y: 520, w: 1024, h: 504 },
    grip: { x: 0, y: 520, w: 1024, h: 504 },
  },
  smg_mac10: {
    upper_receiver: { x: 0, y: 0, w: 1024, h: 520 },
    receiver: { x: 0, y: 0, w: 1024, h: 520 },
    lower_frame: { x: 0, y: 520, w: 1024, h: 504 },
    grip_mag: { x: 140, y: 660, w: 320, h: 260 },
    wire_stock: { x: 800, y: 30, w: 85, h: 55 },
    stock: { x: 800, y: 30, w: 85, h: 55 },
  },
  pist_taser: {
    housing: { x: 60, y: 80, w: 904, h: 560 },
    receiver: { x: 60, y: 80, w: 904, h: 560 },
    cartridge: { x: 640, y: 120, w: 280, h: 340 },
    grip: { x: 60, y: 680, w: 904, h: 300 },
  },
  rif_galilar: {
    receiver: { x: 40, y: 60, w: 944, h: 660 },
    handguard: { x: 0, y: 250, w: 710, h: 190 },
    stock: { x: 28, y: 63, w: 931, h: 903 },
    magazine: { x: 250, y: 640, w: 500, h: 380 },
    barrel: { x: 93, y: 17, w: 877, h: 943 },
  },
  smg_ump45: {
    upper_receiver: { x: 40, y: 60, w: 944, h: 620 },
    receiver: { x: 40, y: 60, w: 944, h: 620 },
    barrel_handguard: { x: 615, y: 330, w: 130, h: 110 },
    handguard: { x: 615, y: 330, w: 130, h: 110 },
    lower_grip: { x: 94, y: 60, w: 696, h: 595 },
    grip: { x: 94, y: 60, w: 696, h: 595 },
    stock: { x: 0, y: 360, w: 610, h: 200 },
  },
};
WEAPON_UV_LAYOUTS['pist_usp_silencer'] = WEAPON_UV_LAYOUTS['pist_223'];
WEAPON_UV_LAYOUTS['rif_m4a1_silencer'] = WEAPON_UV_LAYOUTS['rif_m4a1_s'];

// ============================================================================
// GEOMETRY-AWARE ISLAND CLIPPING & GRADIENT UTILITIES
// ============================================================================

type Canvas2D = CanvasRenderingContext2D | HeadlessContext2D;

function getRect(target: UvIsland | CanvasRect | UvIslandBox): CanvasRect {
  if ('canvasRect' in target) {
    return target.canvasRect;
  }
  if ('width' in target && 'height' in target) {
    return target as CanvasRect;
  }
  const box = target as UvIslandBox;
  return { x: box.x, y: box.y, width: box.w, height: box.h };
}

/**
 * Resolves a weapon display name, path, or canonical key to its WeaponUvLayout.
 */
export function getWeaponUvLayout(weaponIdentifier?: string): WeaponUvLayout | null {
  if (!weaponIdentifier) return null;
  const lower = weaponIdentifier.toLowerCase().replace(/[\s\-_]/g, '');

  if (lower.includes('ak47') || lower.includes('rifak47')) return WEAPON_UV_ISLANDS['rif_ak47'];
  if (lower.includes('m4a1s') || lower.includes('m4a1silencer')) return WEAPON_UV_ISLANDS['rif_m4a1_s'];
  if (lower.includes('awp') || lower.includes('snipawp')) return WEAPON_UV_ISLANDS['snip_awp'];
  if (lower.includes('usps') || lower.includes('pist223') || lower.includes('uspsilencer')) return WEAPON_UV_ISLANDS['pist_223'];
  if (lower.includes('glock') || lower.includes('glock18')) return WEAPON_UV_ISLANDS['pist_glock18'];
  if (lower.includes('mac10')) return WEAPON_UV_ISLANDS['smg_mac10'];
  if (lower.includes('zeus') || lower.includes('taser')) return WEAPON_UV_ISLANDS['pist_taser'];
  if (lower.includes('galil')) return WEAPON_UV_ISLANDS['rif_galilar'];
  if (lower.includes('ump') || lower.includes('ump45')) return WEAPON_UV_ISLANDS['smg_ump45'];

  return null;
}

/**
 * Scoped island clipping helper.
 * Enforces canvas clipping to the exact boundaries of the island, executes the draw callback,
 * and cleanly restores canvas context state without cross-island state contamination.
 */
export function clipToIsland(
  ctx: Canvas2D,
  island: UvIsland | CanvasRect | UvIslandBox,
  drawFn: (ctx: Canvas2D) => void
): void {
  const rect = getRect(island);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  try {
    drawFn(ctx);
  } finally {
    ctx.restore();
  }
}

/**
 * Scoped island clipping helper alias supporting both callback signatures.
 */
export function withIslandClip(
  ctx: Canvas2D,
  island: UvIsland | CanvasRect | UvIslandBox,
  drawFn: ((ctx: Canvas2D) => void) | (() => void)
): void {
  const rect = getRect(island);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  try {
    drawFn(ctx);
  } finally {
    ctx.restore();
  }
}

/**
 * Fills an island's rectangular region with a fillStyle, clipped strictly to its boundary.
 */
export function fillUvIsland(
  ctx: Canvas2D,
  island: UvIsland | CanvasRect | UvIslandBox,
  fillStyle: string | CanvasGradient | HeadlessGradient
): void {
  const rect = getRect(island);
  clipToIsland(ctx, island, (c) => {
    c.fillStyle = fillStyle;
    c.fillRect(rect.x, rect.y, rect.width, rect.height);
  });
}

/**
 * Strokes the perimeter of an island with an optional stroke width.
 */
export function strokeUvIsland(
  ctx: Canvas2D,
  island: UvIsland | CanvasRect | UvIslandBox,
  strokeStyle: string | CanvasGradient | HeadlessGradient,
  lineWidth = 2
): void {
  const rect = getRect(island);
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

/**
 * Creates a linear gradient calibrated specifically to the island's geometry bounds
 * rather than arbitrary canvas dimensions.
 */
export function createIslandGradient(
  ctx: Canvas2D,
  island: UvIsland | CanvasRect | UvIslandBox,
  direction: 'horizontal' | 'vertical' | 'diagonal' = 'horizontal'
): CanvasGradient | HeadlessGradient {
  const { x, y, width, height } = getRect(island);
  switch (direction) {
    case 'horizontal':
      return ctx.createLinearGradient(x, y, x + width, y);
    case 'vertical':
      return ctx.createLinearGradient(x, y, x, y + height);
    case 'diagonal':
      return ctx.createLinearGradient(x, y, x + width, y + height);
  }
}

// ============================================================================
// HIGH-QUALITY DETERMINISTIC PRNG: MULBERRY32
// ============================================================================

/**
 * High-performance 32-bit deterministic pseudo-random number generator (mulberry32).
 * Produces uniform distribution over [0, 1) without hyperplane lattice clustering.
 *
 * @param seed CS2 weapon pattern seed (0 - 1000)
 */
export function mulberry32(seed: number): () => number {
  let s = Math.floor(Math.abs(seed || 0)) >>> 0;
  if (s === 0) s = 0x12345678;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Backward compatibility alias
export const createSeededRandom = mulberry32;

// ============================================================================
// IDENTIFIER NORMALIZATION & MATHEMATICAL WEAR SCALING
// ============================================================================

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

  // 1. Effective Roughness: Scales monotonically toward abraded substrate (~0.85)
  const targetRoughness = Math.max(0.85, baseRoughness);
  const effectiveRoughness = Math.min(
    0.95,
    Math.max(0.05, baseRoughness + f * (targetRoughness - baseRoughness))
  );

  // 2. Effective Metalness: Convex exposure for paint; linear tarnish for metal
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
// GEOMETRY-AWARE EDGE-WEIGHTED WEAR OVERLAY
// ============================================================================

interface EdgeSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  weight: number;
}

const WEAPON_WEAR_EDGES: Record<string, EdgeSegment[]> = {
  'ak-47': [
    { x1: 120, y1: 140, x2: 900, y2: 140, weight: 1.0 },
    { x1: 480, y1: 220, x2: 680, y2: 220, weight: 1.2 },
    { x1: 420, y1: 560, x2: 560, y2: 560, weight: 0.9 },
    { x1: 180, y1: 340, x2: 920, y2: 340, weight: 0.8 },
  ],
  'm4a1-s': [
    { x1: 100, y1: 140, x2: 300, y2: 140, weight: 1.2 },
    { x1: 220, y1: 100, x2: 700, y2: 100, weight: 1.0 },
    { x1: 450, y1: 240, x2: 550, y2: 240, weight: 1.1 },
  ],
  'awp': [
    { x1: 350, y1: 320, x2: 550, y2: 320, weight: 1.3 },
    { x1: 160, y1: 260, x2: 920, y2: 260, weight: 0.8 },
    { x1: 700, y1: 300, x2: 880, y2: 300, weight: 0.9 },
  ],
  'usp-s': [
    { x1: 160, y1: 200, x2: 960, y2: 200, weight: 1.1 },
    { x1: 160, y1: 440, x2: 960, y2: 440, weight: 1.1 },
    { x1: 400, y1: 210, x2: 580, y2: 210, weight: 1.3 },
  ],
  'pist_taser': [
    { x1: 140, y1: 120, x2: 920, y2: 120, weight: 1.2 },
    { x1: 640, y1: 140, x2: 920, y2: 140, weight: 1.0 },
    { x1: 120, y1: 600, x2: 860, y2: 600, weight: 0.8 },
  ],
  'galil': [
    { x1: 140, y1: 160, x2: 900, y2: 160, weight: 1.0 },
    { x1: 240, y1: 300, x2: 800, y2: 300, weight: 0.9 },
  ],
  'glock': [
    { x1: 140, y1: 120, x2: 920, y2: 120, weight: 1.1 },
    { x1: 140, y1: 480, x2: 920, y2: 480, weight: 1.1 },
  ],
  'mac10': [
    { x1: 100, y1: 120, x2: 920, y2: 120, weight: 1.1 },
    { x1: 100, y1: 480, x2: 920, y2: 480, weight: 1.0 },
  ],
  'ump': [
    { x1: 100, y1: 140, x2: 920, y2: 140, weight: 1.0 },
    { x1: 200, y1: 400, x2: 800, y2: 400, weight: 0.9 },
  ],
};

function getWeaponEdges(weaponName?: string): EdgeSegment[] {
  const clean = (weaponName || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  for (const [key, edges] of Object.entries(WEAPON_WEAR_EDGES)) {
    if (clean.includes(key)) return edges;
  }
  return [
    { x1: 100, y1: 150, x2: 920, y2: 150, weight: 1.0 },
    { x1: 100, y1: 550, x2: 920, y2: 550, weight: 1.0 },
    { x1: 512, y1: 150, x2: 512, y2: 550, weight: 0.8 },
  ];
}

/**
 * Mask- and geometry-weighted wear overlay using mulberry32 PRNG.
 */
export function applyFloatWearOverlay(
  ctx: Canvas2D,
  width: number,
  height: number,
  float: number,
  seed: number,
  weaponName?: string
): void {
  if (float <= 0.03) return;

  const rng = mulberry32(seed + 999);
  const scuffCount = Math.round(float * 85);
  const edges = getWeaponEdges(weaponName);

  ctx.save();
  ctx.scale(width / 1024, height / 1024);

  for (let i = 0; i < scuffCount; i++) {
    const edge = edges[Math.floor(rng() * edges.length)];
    const t = rng();
    const basePathX = edge.x1 + t * (edge.x2 - edge.x1);
    const basePathY = edge.y1 + t * (edge.y2 - edge.y1);

    const jitterSigma = 4 + float * 28;
    const angle = rng() * Math.PI;
    const jitter = (rng() - 0.5) * jitterSigma * 2;
    const x = Math.min(1020, Math.max(4, basePathX + jitter));
    const y = Math.min(1020, Math.max(4, basePathY + (rng() - 0.5) * jitterSigma));

    const len = 10 + rng() * 30 * (1 + float);

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

    // Highlighted edge metal specular highlight
    ctx.strokeStyle = 'rgba(140, 150, 164, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 1);
    ctx.lineTo(x + Math.cos(angle) * (len * 0.7), y + Math.sin(angle) * (len * 0.7));
    ctx.stroke();
  }

  // High-wear paint flaking gouges (float > 0.40)
  if (float > 0.40) {
    const chipCount = Math.round((float - 0.40) * 45);
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;

    for (let c = 0; c < chipCount; c++) {
      const edge = edges[Math.floor(rng() * edges.length)];
      const t = rng();
      const cx = edge.x1 + t * (edge.x2 - edge.x1) + (rng() - 0.5) * 30;
      const cy = edge.y1 + t * (edge.y2 - edge.y1) + (rng() - 0.5) * 20;
      const cr = 4 + rng() * 16 * float;

      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ============================================================================
// GEOMETRY-AWARE PROCEDURAL CANVAS SKIN PAINTERS
// ============================================================================

/**
 * AK-47 | Ice Coaled (Gunsmith Finish)
 * Radiant cyan to neon mint gradient on receiver and handguard,
 * carbon fiber crosshatch on magazine and stock, technical typography decals.
 */
function paintAk47IceCoaled(ctx: Canvas2D, _seed: number): void {
  const layout = WEAPON_UV_ISLANDS['rif_ak47'];

  // 1. Dark matte chassis base
  ctx.fillStyle = '#0f131a';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Receiver & Dust Cover
  clipToIsland(ctx, layout.islands.receiver, (c) => {
    const grad = c.createLinearGradient(80, 120, 960, 480);
    grad.addColorStop(0.0, '#00e5ff'); // Radiant Cyan
    grad.addColorStop(0.35, '#06b6d4');
    grad.addColorStop(0.75, '#10b981'); // Neon Mint
    grad.addColorStop(1.0, '#34d399');

    c.fillStyle = grad;
    c.fillRect(60, 120, 904, 460);

    // Geometric accent panelling and bevel highlights
    c.fillStyle = '#090d16';
    c.fillRect(60, 120, 904, 30);
    c.fillRect(60, 550, 904, 30);

    // Diagonal speed racing stripes
    c.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(340, 150);
    c.lineTo(440, 320);
    c.moveTo(370, 150);
    c.lineTo(470, 320);
    c.stroke();

    // Technical Decals
    c.fillStyle = '#ffffff';
    c.font = 'bold 44px monospace';
    c.fillText('ICE COALED', 180, 340);

    c.fillStyle = '#00e5ff';
    c.font = 'bold 20px monospace';
    c.fillText('>> >> >> SPEED // TACTICAL SPEC', 180, 385);

    c.fillStyle = '#f8fafc';
    c.font = '14px monospace';
    c.fillText('SER: 730-AK-IC-2026 // TEMP: -40°C', 180, 420);

    // Speed chevrons
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const cx = 720 + i * 36;
      c.beginPath();
      c.moveTo(cx, 320);
      c.lineTo(cx + 18, 340);
      c.lineTo(cx, 360);
      c.stroke();
    }
  });

  // 3. Forearm Handguard
  clipToIsland(ctx, layout.islands.handguard, (c) => {
    const grad = c.createLinearGradient(170, 120, 980, 380);
    grad.addColorStop(0.0, '#06b6d4');
    grad.addColorStop(0.6, '#10b981');
    grad.addColorStop(1.0, '#34d399');
    c.fillStyle = grad;
    c.fillRect(170, 120, 810, 260);

    c.fillStyle = '#090d16';
    c.fillRect(170, 120, 810, 24);
    c.fillRect(170, 356, 810, 24);
  });

  // 4. Magazine: Carbon fiber diagonal crosshatch weave
  clipToIsland(ctx, layout.islands.magazine, (c) => {
    c.fillStyle = '#11141a';
    c.fillRect(0, 0, 1024, 1024);

    c.strokeStyle = '#1e2430';
    c.lineWidth = 2.5;
    c.beginPath();
    for (let x = -400; x < 1500; x += 14) {
      c.moveTo(x, 500);
      c.lineTo(x + 450, 1024);
    }
    c.stroke();

    c.strokeStyle = '#283040';
    c.lineWidth = 2;
    c.beginPath();
    for (let x = -400; x < 1500; x += 14) {
      c.moveTo(x, 1024);
      c.lineTo(x + 450, 500);
    }
    c.stroke();

    // Magazine structural rib indentations
    c.fillStyle = '#090d16';
    for (let ry = 600; ry < 950; ry += 45) {
      c.fillRect(380, ry, 230, 16);
    }
  });

  // 5. Stock: Carbon fiber weave with telemetry stamp
  clipToIsland(ctx, layout.islands.stock, (c) => {
    c.fillStyle = '#11141a';
    c.fillRect(0, 0, 1024, 1024);

    c.strokeStyle = '#1e2430';
    c.lineWidth = 2.5;
    c.beginPath();
    for (let x = -400; x < 1500; x += 14) {
      c.moveTo(x, 600);
      c.lineTo(x + 450, 1024);
    }
    c.stroke();

    c.strokeStyle = '#283040';
    c.lineWidth = 2;
    c.beginPath();
    for (let x = -400; x < 1500; x += 14) {
      c.moveTo(x, 1024);
      c.lineTo(x + 450, 600);
    }
    c.stroke();

    c.fillStyle = '#94a3b8';
    c.font = 'bold 15px monospace';
    c.fillText('COMPOSITE CARBON // MOD.47', 40, 780);
  });

  // 6. Barrel & Gas Block
  clipToIsland(ctx, layout.islands.barrel, (c) => {
    c.fillStyle = '#1e232d';
    c.fillRect(195, 128, 775, 280);
  });

  // 7. Pistol Grip
  clipToIsland(ctx, layout.islands.grip, (c) => {
    c.fillStyle = '#11141a';
    c.fillRect(740, 315, 125, 200);
    c.fillStyle = '#090d16';
    c.fillRect(750, 330, 105, 170);
  });
}

/**
 * M4A1-S | Liquidation (Hydrographic Finish)
 * Crimson and royal violet fluid wave marbling ribbons over dark navy chassis.
 */
function paintM4a1sLiquidation(ctx: Canvas2D, seed: number): void {
  const layout = WEAPON_UV_ISLANDS['rif_m4a1_s'];
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 1024, 1024);

  const drawMarbling = (c: Canvas2D) => {
    const rng = mulberry32(seed);
    const waveCount = 18;
    for (let i = 0; i < waveCount; i++) {
      const phase = rng() * Math.PI * 2;
      const freq1 = 0.005 + rng() * 0.006;
      const freq2 = 0.012 + rng() * 0.01;
      const amp1 = 35 + rng() * 45;
      const amp2 = 18 + rng() * 25;
      const yBase = (i / waveCount) * 1024;

      const palette = [
        '#e11d48',
        '#be123c',
        '#9f1239',
        '#8b5cf6',
        '#7c3aed',
        '#6d28d9',
        '#d946ef',
        '#c026d3',
        '#090d16',
      ];
      c.fillStyle = palette[i % palette.length];

      c.beginPath();
      c.moveTo(0, yBase);
      for (let x = 0; x <= 1024; x += 16) {
        const yWave =
          yBase +
          Math.sin(x * freq1 + phase) * amp1 +
          Math.cos(x * freq2 + phase * 1.5) * amp2;
        c.lineTo(x, yWave);
      }
      c.lineTo(1024, 1024);
      c.lineTo(0, 1024);
      c.closePath();
      c.fill();
    }
  };

  // Receiver
  clipToIsland(ctx, layout.islands.receiver, (c) => {
    drawMarbling(c);
    c.fillStyle = '#060911';
    c.fillRect(0, 710, 820, 20);
  });

  // Handguard
  clipToIsland(ctx, layout.islands.handguard, (c) => {
    drawMarbling(c);
  });

  // Silencer
  clipToIsland(ctx, layout.islands.silencer, (c) => {
    drawMarbling(c);
    // Dark navy collar band
    c.fillStyle = '#070a12';
    c.fillRect(0, 840, 1024, 40);
    c.fillStyle = '#38bdf8';
    c.font = 'bold 15px monospace';
    c.fillText('LIQUIDATION // 5.56-HYDRO-SPEC', 80, 920);
  });

  // Stock
  clipToIsland(ctx, layout.islands.stock, (c) => {
    c.fillStyle = '#0e1320';
    c.fillRect(24, 45, 962, 500);
  });
}

/**
 * AWP | Ice Coaled (Gunsmith Finish)
 * Long-barrel cyan-to-lime gradient with matte black scope and bipod, reticle telemetry marks.
 */
function paintAwpIceCoaled(ctx: Canvas2D, _seed: number): void {
  const layout = WEAPON_UV_ISLANDS['snip_awp'];
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, 1024, 1024);

  // Body chassis
  clipToIsland(ctx, layout.islands.body, (c) => {
    const chassisGrad = c.createLinearGradient(40, 480, 980, 480);
    chassisGrad.addColorStop(0.0, '#00e5ff'); // Radiant Cyan (stock)
    chassisGrad.addColorStop(0.4, '#06b6d4');
    chassisGrad.addColorStop(0.75, '#10b981'); // Lime / Mint (barrel root)
    chassisGrad.addColorStop(1.0, '#22c55e');

    c.fillStyle = chassisGrad;
    c.fillRect(40, 280, 944, 460);

    // Slate bevel inset cuts
    c.fillStyle = '#0f172a';
    c.fillRect(40, 280, 944, 32);
    c.fillRect(40, 708, 944, 32);

    // Telemetry Reticle Typography
    c.fillStyle = '#ffffff';
    c.font = 'bold 36px monospace';
    c.fillText('AWP // ICE COALED', 120, 460);

    c.fillStyle = '#00e5ff';
    c.font = 'bold 16px monospace';
    c.fillText('TELEMETRY: RNG 1500M // ELEV +2.4 // WIND -0.3', 120, 505);

    c.fillStyle = '#f8fafc';
    c.font = '13px monospace';
    c.fillText('SNIPER SYS-730 // ZERO: 800M // S/N: AWP-992', 120, 540);

    // Reticle crosshair icon
    const rx = 820;
    const ry = 480;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(rx, ry, 36, 0, Math.PI * 2);
    c.moveTo(rx - 50, ry);
    c.lineTo(rx - 10, ry);
    c.moveTo(rx + 10, ry);
    c.lineTo(rx + 50, ry);
    c.moveTo(rx, ry - 50);
    c.lineTo(rx, ry - 10);
    c.moveTo(rx, ry + 10);
    c.lineTo(rx, ry + 50);
    c.stroke();

    c.fillStyle = '#00e5ff';
    c.beginPath();
    c.arc(rx, ry, 4, 0, Math.PI * 2);
    c.fill();
  });

  // Barrel
  clipToIsland(ctx, layout.islands.barrel, (c) => {
    const barrelGrad = c.createLinearGradient(160, 280, 1000, 280);
    barrelGrad.addColorStop(0.0, '#10b981');
    barrelGrad.addColorStop(1.0, '#22c55e');
    c.fillStyle = barrelGrad;
    c.fillRect(160, 280, 840, 350);
  });

  // Scope assembly (strictly isolated matte black)
  clipToIsland(ctx, layout.islands.scope, (c) => {
    c.fillStyle = '#090a0f';
    c.fillRect(100, 40, 824, 210);

    c.fillStyle = '#18181b';
    c.fillRect(440, 20, 140, 40);
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 1.5;

    for (let tx = 140; tx < 880; tx += 28) {
      c.beginPath();
      c.moveTo(tx, 140);
      c.lineTo(tx, 155);
      c.stroke();
    }
  });

  // Bipod & Muzzle (strictly isolated matte steel)
  clipToIsland(ctx, layout.islands.bipod_muzzle, (c) => {
    c.fillStyle = '#090a0f';
    c.fillRect(60, 770, 904, 220);
  });

  // Magazine
  clipToIsland(ctx, layout.islands.magazine, (c) => {
    c.fillStyle = '#121620';
    c.fillRect(138, 400, 690, 350);
  });
}

/**
 * USP-S | Royal Guard (Gunsmith / Antiqued Enamel Finish)
 * Deep imperial red slide, metallic gold filigree trim, dark charcoal silencer with gold rings.
 */
function paintUspsRoyalGuard(ctx: Canvas2D, _seed: number): void {
  const layout = WEAPON_UV_ISLANDS['pist_223'];
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 1024, 1024);

  // Slide
  clipToIsland(ctx, layout.islands.slide, (c) => {
    const redGrad = c.createLinearGradient(0, 60, 0, 520);
    redGrad.addColorStop(0.0, '#7f1d1d');
    redGrad.addColorStop(0.3, '#991b1b'); // Imperial Red
    redGrad.addColorStop(0.65, '#b91c1c'); // Specular highlight
    redGrad.addColorStop(1.0, '#7f1d1d');

    c.fillStyle = redGrad;
    c.fillRect(50, 60, 924, 460);

    // Ornate Metallic Gold Filigree Trim
    c.strokeStyle = '#f59e0b';
    c.lineWidth = 5;
    c.strokeRect(70, 80, 884, 420);

    c.strokeStyle = '#fbbf24';
    c.lineWidth = 2;
    c.strokeRect(82, 92, 860, 396);

    const drawCornerScroll = (cx: number, cy: number, flipX: number, flipY: number) => {
      c.save();
      c.translate(cx, cy);
      c.scale(flipX, flipY);
      c.strokeStyle = '#fbbf24';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(40, 40, 24, 0, Math.PI * 1.5);
      c.bezierCurveTo(40, 15, 20, 10, 5, 5);
      c.stroke();
      c.restore();
    };

    drawCornerScroll(90, 100, 1, 1);
    drawCornerScroll(934, 100, -1, 1);
    drawCornerScroll(90, 480, 1, -1);
    drawCornerScroll(934, 480, -1, -1);

    const mx = 512;
    const my = 290;
    c.strokeStyle = '#f59e0b';
    c.lineWidth = 4;
    c.fillStyle = '#fbbf24';

    // 8-pointed star medallion
    c.beginPath();
    for (let a = 0; a < 8; a++) {
      const angle = (a * Math.PI) / 4;
      const rOuter = 45;
      const rInner = 20;
      const ox = mx + Math.cos(angle) * rOuter;
      const oy = my + Math.sin(angle) * rOuter;
      const ix = mx + Math.cos(angle + Math.PI / 8) * rInner;
      const iy = my + Math.sin(angle + Math.PI / 8) * rInner;
      if (a === 0) c.moveTo(ox, oy);
      else c.lineTo(ox, oy);
      c.lineTo(ix, iy);
    }
    c.closePath();
    c.fill();
    c.stroke();

    c.strokeStyle = '#fbbf24';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(mx - 60, my);
    c.bezierCurveTo(mx - 150, my - 30, mx - 220, my + 30, mx - 320, my);
    c.moveTo(mx + 60, my);
    c.bezierCurveTo(mx + 150, my - 30, mx + 220, my + 30, mx + 320, my);
    c.stroke();
  });

  // Silencer
  clipToIsland(ctx, layout.islands.silencer, (c) => {
    c.fillStyle = '#18181b';
    c.fillRect(50, 560, 924, 420);

    c.fillStyle = '#f59e0b';
    c.fillRect(80, 620, 864, 14);
    c.fillRect(80, 650, 864, 8);

    c.fillStyle = '#fbbf24';
    c.font = 'bold 16px serif';
    c.fillText('ROYAL GUARD // IMPERIAL EDITION', 100, 720);
  });

  // Frame & Grip
  clipToIsland(ctx, layout.islands.frame_grip, (c) => {
    c.fillStyle = '#1a1a1f';
    c.fillRect(170, 170, 640, 560);
    c.fillStyle = '#111115';
    c.fillRect(190, 200, 600, 500);
  });
}

/**
 * MAC-10 | Candy Apple (Anodized Finish)
 * High-gloss candy apple red anodized enamel on upper receiver, matte black lower frame.
 */
function paintMac10CandyApple(ctx: Canvas2D, _seed: number): void {
  const layout = WEAPON_UV_ISLANDS['smg_mac10'];
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, 1024, 1024);

  // Upper receiver: Mirror-gloss candy apple red anodized enamel
  clipToIsland(ctx, layout.islands.upper_receiver, (c) => {
    const candyGrad = c.createLinearGradient(0, 0, 1024, 520);
    candyGrad.addColorStop(0.0, '#b91c1c');
    candyGrad.addColorStop(0.25, '#ef4444'); // Specular highlight streak
    candyGrad.addColorStop(0.55, '#dc2626'); // Rich candy apple red
    candyGrad.addColorStop(1.0, '#991b1b');

    c.fillStyle = candyGrad;
    c.fillRect(0, 0, 1024, 520);

    // Mirror sheen clearcoat glare band
    const glareGrad = c.createLinearGradient(0, 120, 1024, 280);
    glareGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    glareGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.28)');
    glareGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.35)');
    glareGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    c.fillStyle = glareGrad;
    c.fillRect(0, 80, 1024, 240);
  });

  // Lower frame: Matte black
  clipToIsland(ctx, layout.islands.lower_frame, (c) => {
    c.fillStyle = '#0a0a0c';
    c.fillRect(0, 520, 1024, 504);
    c.fillStyle = '#262626';
    c.fillRect(80, 560, 864, 30);
  });

  // Grip & Magazine
  clipToIsland(ctx, layout.islands.grip_mag, (c) => {
    c.fillStyle = '#141416';
    c.fillRect(140, 660, 320, 260);
  });

  // Wire Stock
  clipToIsland(ctx, layout.islands.wire_stock, (c) => {
    c.fillStyle = '#26262b';
    c.fillRect(800, 30, 85, 55);
  });
}

/**
 * Zeus x27 | Electric Blue (Custom Paint Job)
 * Electric cobalt blue housing with hazard yellow accents and lightning glyphs.
 */
function paintZeusElectricBlue(ctx: Canvas2D, _seed: number): void {
  const layout = WEAPON_UV_ISLANDS['pist_taser'];
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 1024);

  // Housing: Electric cobalt blue
  clipToIsland(ctx, layout.islands.housing, (c) => {
    const blueGrad = c.createLinearGradient(60, 100, 960, 600);
    blueGrad.addColorStop(0.0, '#1d4ed8');
    blueGrad.addColorStop(0.4, '#2563eb'); // Cobalt Blue
    blueGrad.addColorStop(0.85, '#3b82f6');
    blueGrad.addColorStop(1.0, '#1e40af');

    c.fillStyle = blueGrad;
    c.fillRect(60, 80, 904, 560);

    // Cyan electrical contour bevels
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 4;
    c.strokeRect(80, 100, 864, 520);

    // Lightning Bolt Glyph
    const lx = 340;
    const ly = 320;
    c.fillStyle = '#fef08a';
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;

    c.beginPath();
    c.moveTo(lx, ly - 90);
    c.lineTo(lx - 45, ly + 10);
    c.lineTo(lx - 10, ly + 10);
    c.lineTo(lx - 35, ly + 90);
    c.lineTo(lx + 50, ly - 10);
    c.lineTo(lx + 15, ly - 10);
    c.closePath();
    c.fill();
    c.stroke();

    // Stencil Danger Decals
    c.fillStyle = '#ffffff';
    c.font = 'bold 30px monospace';
    c.fillText('HIGH VOLTAGE // 25KV', 120, 220);

    c.fillStyle = '#fef08a';
    c.font = 'bold 18px monospace';
    c.fillText('CAUTION: TASER DISCHARGE', 120, 260);
  });

  // Cartridge block: Hazard yellow caution stripes
  clipToIsland(ctx, layout.islands.cartridge, (c) => {
    c.fillStyle = '#eab308'; // Hazard Yellow
    c.fillRect(640, 120, 280, 340);

    c.strokeStyle = '#0f172a';
    c.lineWidth = 26;
    c.beginPath();
    for (let d = 400; d < 1200; d += 52) {
      c.moveTo(d, 0);
      c.lineTo(d - 500, 600);
    }
    c.stroke();

    c.strokeStyle = '#0f172a';
    c.lineWidth = 6;
    c.strokeRect(640, 120, 280, 340);
  });

  // Grip
  clipToIsland(ctx, layout.islands.grip, (c) => {
    c.fillStyle = '#0a0f1d';
    c.fillRect(60, 680, 904, 300);
    c.fillStyle = '#1e293b';
    for (let gx = 100; gx < 920; gx += 40) {
      c.fillRect(gx, 720, 20, 220);
    }
  });
}

/**
 * Galil AR | Control (Hydrographic Tactical Finish)
 * Slate blue radar scanline grid with tactical crosshairs and index markers.
 */
function paintGalilArControl(ctx: Canvas2D, _seed: number): void {
  const layout = WEAPON_UV_ISLANDS['rif_galilar'];
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 1024);

  // Receiver
  clipToIsland(ctx, layout.islands.receiver, (c) => {
    const slateGrad = c.createLinearGradient(0, 80, 1024, 700);
    slateGrad.addColorStop(0.0, '#1e3a8a');
    slateGrad.addColorStop(0.5, '#2563eb'); // Slate Blue
    slateGrad.addColorStop(1.0, '#1e40af');

    c.fillStyle = slateGrad;
    c.fillRect(40, 60, 944, 660);

    // Precision Radar Scanline Grid
    c.strokeStyle = 'rgba(56, 189, 248, 0.35)'; // Cyan Grid
    c.lineWidth = 1.5;
    c.beginPath();
    for (let x = 60; x <= 960; x += 36) {
      c.moveTo(x, 80);
      c.lineTo(x, 700);
    }
    for (let y = 80; y <= 700; y += 36) {
      c.moveTo(60, y);
      c.lineTo(960, y);
    }
    c.stroke();

    // Radar Concentric Range Rings centered at (480, 390)
    const rcx = 480;
    const rcy = 390;
    c.strokeStyle = '#38bdf8';
    c.lineWidth = 2.5;

    const radii = [70, 140, 220, 300];
    for (const r of radii) {
      c.beginPath();
      c.arc(rcx, rcy, r, 0, Math.PI * 2);
      c.stroke();
    }

    // Tactical Crosshairs
    c.strokeStyle = '#f59e0b';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(rcx - 340, rcy);
    c.lineTo(rcx - 40, rcy);
    c.moveTo(rcx + 40, rcy);
    c.lineTo(rcx + 340, rcy);
    c.moveTo(rcx, rcy - 240);
    c.lineTo(rcx, rcy - 40);
    c.moveTo(rcx, rcy + 40);
    c.lineTo(rcx, rcy + 240);
    c.stroke();

    // Center targeting dot
    c.fillStyle = '#f59e0b';
    c.beginPath();
    c.arc(rcx, rcy, 6, 0, Math.PI * 2);
    c.fill();

    // Telemetry Index Decals
    c.fillStyle = '#ffffff';
    c.font = 'bold 32px monospace';
    c.fillText('CONTROL // RADAR SYS', 80, 160);

    c.fillStyle = '#38bdf8';
    c.font = 'bold 18px monospace';
    c.fillText('SECTOR: 07-BRAVO // GRID 42.8N', 80, 200);

    c.fillStyle = '#f59e0b';
    c.font = '14px monospace';
    c.fillText('[ RADAR SWEEP ACTIVE // FREQ: 9.4 GHz ]', 80, 230);
  });

  // Handguard
  clipToIsland(ctx, layout.islands.handguard, (c) => {
    c.fillStyle = '#1e3a8a';
    c.fillRect(0, 250, 710, 190);
  });

  // Stock
  clipToIsland(ctx, layout.islands.stock, (c) => {
    c.fillStyle = '#172033';
    c.fillRect(28, 63, 931, 903);
  });

  // Magazine
  clipToIsland(ctx, layout.islands.magazine, (c) => {
    c.fillStyle = '#1e293b';
    c.fillRect(250, 640, 500, 380);
  });

  // Barrel
  clipToIsland(ctx, layout.islands.barrel, (c) => {
    c.fillStyle = '#111827';
    c.fillRect(93, 17, 877, 943);
  });
}

/**
 * Glock-18 | Catacombs (Custom Paint Job)
 * Skull graphic fading into charcoal slide smoke.
 */
function paintGlock18Catacombs(ctx: Canvas2D, seed: number): void {
  const layout = WEAPON_UV_ISLANDS['pist_glock18'];
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 1024, 1024);

  // Upper Slide
  clipToIsland(ctx, layout.islands.slide, (c) => {
    c.fillStyle = '#09090b';
    c.fillRect(40, 60, 944, 460);

    // Smoke wisps & particulate fading towards rear slide
    const rng = mulberry32(seed);
    const smokeGrad = c.createLinearGradient(400, 280, 960, 280);
    smokeGrad.addColorStop(0.0, 'rgba(63, 63, 70, 0.8)');
    smokeGrad.addColorStop(0.6, 'rgba(39, 39, 42, 0.6)');
    smokeGrad.addColorStop(1.0, 'rgba(9, 9, 11, 0.95)');

    c.fillStyle = smokeGrad;
    for (let s = 0; s < 10; s++) {
      const sy = 120 + s * 38;
      c.beginPath();
      c.moveTo(420, sy);
      c.bezierCurveTo(600 + rng() * 100, sy - 30, 750 + rng() * 100, sy + 40, 960, sy);
      c.lineTo(960, sy + 30);
      c.bezierCurveTo(750, sy + 60, 600, sy, 420, sy + 25);
      c.closePath();
      c.fill();
    }

    // Stylized Bone-White Skulls
    const drawSkull = (sx: number, sy: number, scale: number) => {
      c.save();
      c.translate(sx, sy);
      c.scale(scale, scale);

      c.fillStyle = '#f1f5f9'; // Bone White
      c.beginPath();
      c.arc(0, 0, 55, Math.PI, 0, false);
      c.bezierCurveTo(55, 30, 35, 65, 25, 75);
      c.lineTo(-25, 75);
      c.bezierCurveTo(-35, 65, -55, 30, -55, 0);
      c.closePath();
      c.fill();

      c.fillStyle = '#e2e8f0';
      c.fillRect(-22, 75, 44, 25);

      c.fillStyle = '#09090b';
      c.beginPath();
      c.ellipse(-20, 15, 14, 18, 0.1, 0, Math.PI * 2);
      c.ellipse(20, 15, 14, 18, -0.1, 0, Math.PI * 2);
      c.fill();

      c.beginPath();
      c.moveTo(0, 35);
      c.lineTo(-7, 52);
      c.lineTo(7, 52);
      c.closePath();
      c.fill();

      c.strokeStyle = '#09090b';
      c.lineWidth = 3;
      c.beginPath();
      for (let t = -15; t <= 15; t += 10) {
        c.moveTo(t, 75);
        c.lineTo(t, 100);
      }
      c.stroke();

      c.restore();
    };

    drawSkull(200, 270, 1.15);
    drawSkull(330, 310, 0.95);
    drawSkull(440, 260, 0.8);
  });

  // Lower Frame & Grip
  clipToIsland(ctx, layout.islands.frame_grip, (c) => {
    c.fillStyle = '#18181b';
    c.fillRect(0, 520, 1024, 504);

    c.fillStyle = '#09090b';
    c.fillRect(120, 560, 340, 420);
  });
}

/**
 * UMP-45 | Late Night Transit (Custom Paint Job / Heavy Battle Wear)
 * Metro transit schematic lines (cyan, magenta, green, yellow) with heavy battle scuffs.
 */
function paintUmp45LateNightTransit(ctx: Canvas2D, _seed: number): void {
  const layout = WEAPON_UV_ISLANDS['smg_ump45'];
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 1024);

  // Upper Receiver
  clipToIsland(ctx, layout.islands.upper_receiver, (c) => {
    c.fillStyle = '#1e293b';
    c.fillRect(40, 60, 944, 620);

    // Transit Route Lines
    c.strokeStyle = '#06b6d4';
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(60, 180);
    c.lineTo(380, 180);
    c.lineTo(520, 320);
    c.lineTo(960, 320);
    c.stroke();

    c.strokeStyle = '#ec4899';
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(60, 480);
    c.lineTo(320, 480);
    c.lineTo(460, 340);
    c.lineTo(720, 340);
    c.lineTo(840, 220);
    c.lineTo(960, 220);
    c.stroke();

    c.strokeStyle = '#22c55e';
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(140, 600);
    c.lineTo(480, 260);
    c.lineTo(960, 260);
    c.stroke();

    c.strokeStyle = '#eab308';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(60, 360);
    c.lineTo(960, 360);
    c.stroke();

    // Station Node Transfer Interchange circles
    const drawStation = (x: number, y: number, isTransfer = false) => {
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#0f172a';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(x, y, isTransfer ? 14 : 9, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      if (isTransfer) {
        c.fillStyle = '#0f172a';
        c.beginPath();
        c.arc(x, y, 5, 0, Math.PI * 2);
        c.fill();
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
    c.fillStyle = '#ffffff';
    c.font = 'bold 32px monospace';
    c.fillText('METRO TRANSIT MAP', 80, 120);

    c.fillStyle = '#94a3b8';
    c.font = 'bold 15px monospace';
    c.fillText('NIGHT LINE NETWORK // S-LINE 4', 80, 640);
  });

  // Forward Barrel & Handguard
  clipToIsland(ctx, layout.islands.barrel_handguard, (c) => {
    c.fillStyle = '#172033';
    c.fillRect(615, 330, 130, 110);
  });

  // Lower Grip
  clipToIsland(ctx, layout.islands.lower_grip, (c) => {
    c.fillStyle = '#131b2e';
    c.fillRect(94, 60, 696, 595);
  });

  // Stock
  clipToIsland(ctx, layout.islands.stock, (c) => {
    c.fillStyle = '#0f172a';
    c.fillRect(0, 360, 610, 200);
  });
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
  const rng = mulberry32(seed);
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

// ============================================================================
// MAIN COMPOSITOR PIPELINE
// ============================================================================

interface SkinPresetDefinition {
  baseColorHex: string;
  baseRoughness: number;
  baseMetalness: number;
  baseClearcoat: number;
  finishStyle: FinishStyle;
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
        finishStyle: 'gunsmith',
        paint: (ctx, s) => paintAwpIceCoaled(ctx, s),
      };
    } else {
      preset = {
        baseColorHex: '#00e5ff',
        baseRoughness: 0.28,
        baseMetalness: 0.35,
        baseClearcoat: 0.45,
        finishStyle: 'gunsmith',
        paint: (ctx, s) => paintAk47IceCoaled(ctx, s),
      };
    }
  } else if (normalizedPattern.includes('liquidation') || fullName.includes('liquidation')) {
    preset = {
      baseColorHex: '#e11d48',
      baseRoughness: 0.32,
      baseMetalness: 0.45,
      baseClearcoat: 0.35,
      finishStyle: 'hydrographic',
      paint: (ctx, s) => paintM4a1sLiquidation(ctx, s),
    };
  } else if (normalizedPattern.includes('royal guard') || fullName.includes('royal guard')) {
    preset = {
      baseColorHex: '#991b1b',
      baseRoughness: 0.18,
      baseMetalness: 0.75,
      baseClearcoat: 0.65,
      finishStyle: 'gunsmith',
      paint: (ctx, s) => paintUspsRoyalGuard(ctx, s),
    };
  } else if (normalizedPattern.includes('candy apple') || fullName.includes('candy apple')) {
    preset = {
      baseColorHex: '#dc2626',
      baseRoughness: 0.12,
      baseMetalness: 0.7,
      baseClearcoat: 0.85,
      finishStyle: 'anodized',
      paint: (ctx, s) => paintMac10CandyApple(ctx, s),
    };
  } else if (normalizedPattern.includes('electric blue') || fullName.includes('electric blue')) {
    preset = {
      baseColorHex: '#2563eb',
      baseRoughness: 0.35,
      baseMetalness: 0.3,
      baseClearcoat: 0.2,
      finishStyle: 'custom',
      paint: (ctx, s) => paintZeusElectricBlue(ctx, s),
    };
  } else if (normalizedPattern.includes('control') || fullName.includes('control')) {
    preset = {
      baseColorHex: '#3b82f6',
      baseRoughness: 0.38,
      baseMetalness: 0.45,
      baseClearcoat: 0.15,
      finishStyle: 'hydrographic',
      paint: (ctx, s) => paintGalilArControl(ctx, s),
    };
  } else if (normalizedPattern.includes('catacombs') || fullName.includes('catacombs')) {
    preset = {
      baseColorHex: '#18181b',
      baseRoughness: 0.42,
      baseMetalness: 0.2,
      baseClearcoat: 0.1,
      finishStyle: 'custom',
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
      finishStyle: 'custom',
      paint: (ctx, s) => paintUmp45LateNightTransit(ctx, s),
    };
  } else {
    // Generic procedural fallback
    preset = {
      baseColorHex: getSkinFallbackColor(skinName, weaponName, rarityColor),
      baseRoughness: 0.35,
      baseMetalness: 0.5,
      baseClearcoat: 0.2,
      finishStyle: 'custom',
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
    applyFloatWearOverlay(ctx, width, height, validFloat, seed ?? 0, weaponName);
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
    finishStyle: preset.finishStyle,
  };
}
