import { normalizeWeaponKey, normalizeSkinKey } from './weaponTextures';

/**
 * "Paint-by-number" skins (composite materials in the game files): a mask texture marks which parts of the
 * gun get which of four flat colours, so there is no ready-made wrap image. The colours, roughness and
 * metalness below are copied from the skin's .vcompmat recipe.
 *
 * Mask channels: black = base coat, R = colour 1, G = colour 2, B = colour 3.
 */
export interface PaintByNumberSkin {
  /** Mask image in the skin's UV layout (the Source 2 mesh UVs), served from /public */
  masksUrl: string;
  /** sRGB 0-255: [base coat, red channel, green channel, blue channel] */
  colors: [number, number, number][];
  /** [base, R, G, B] */
  roughness: number[];
  /** [base, R, G, B] */
  metalness: number[];
}

/** Keys follow the "<weapon>_<skin>" format used by SKIN_FINISH_FALLBACKS */
export const PAINT_BY_NUMBER_SKINS: Record<string, PaintByNumberSkin> = {
  // USP-S | Royal Guard (soe_blue_and_gold): dark base, blue slide, gold accents, silver details
  usps_royal_guard: {
    masksUrl: '/textures/usps_anodized_masks_psd_498e7aeb.png',
    colors: [
      [53, 50, 57],
      [27, 115, 183],
      [235, 208, 161],
      [152, 153, 174],
    ],
    roughness: [0.38, 0.3, 0.15, 0.4],
    metalness: [0, 0.5, 1, 0.4],
  },
};

export function resolvePaintByNumber(weaponName?: string, skinName?: string): PaintByNumberSkin | undefined {
  let w = weaponName;
  let s = skinName;
  if (weaponName && weaponName.includes('|') && !skinName) {
    const parts = weaponName.split('|');
    w = parts[0].trim();
    s = parts[1].trim();
  }
  const wKey = normalizeWeaponKey(w).replace(/[\s\-_]/g, '');
  const sKey = normalizeSkinKey(s);
  return wKey && sKey ? PAINT_BY_NUMBER_SKINS[`${wKey}_${sKey}`] : undefined;
}

/**
 * Bakes the mask into a colour canvas and a packed roughness/metalness canvas (G = roughness, B = metalness,
 * the layout three.js expects), so the viewer can use them as ordinary maps.
 */
export function renderPaintByNumber(
  mask: CanvasImageSource & { width: number; height: number },
  skin: PaintByNumberSkin,
  maxSize = 2048,
): { color: HTMLCanvasElement; orm: HTMLCanvasElement } {
  const size = Math.min(maxSize, Math.max(mask.width, mask.height));
  const src = document.createElement('canvas');
  src.width = src.height = size;
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(mask, 0, 0, size, size);
  const m = sctx.getImageData(0, 0, size, size).data;

  const color = document.createElement('canvas');
  const orm = document.createElement('canvas');
  color.width = color.height = orm.width = orm.height = size;
  const cctx = color.getContext('2d')!;
  const octx = orm.getContext('2d')!;
  const cimg = cctx.createImageData(size, size);
  const oimg = octx.createImageData(size, size);
  const c = cimg.data;
  const o = oimg.data;

  for (let i = 0; i < m.length; i += 4) {
    const r = m[i] / 255;
    const g = m[i + 1] / 255;
    const b = m[i + 2] / 255;
    const sum = r + g + b;
    // Where the channels overlap or antialias, normalise so the weights still add up to one
    const base = Math.max(0, 1 - sum);
    const norm = base + r + g + b || 1;
    const w = [base / norm, r / norm, g / norm, b / norm];
    let cr = 0, cg = 0, cb = 0, rough = 0, metal = 0;
    for (let k = 0; k < 4; k++) {
      cr += skin.colors[k][0] * w[k];
      cg += skin.colors[k][1] * w[k];
      cb += skin.colors[k][2] * w[k];
      rough += skin.roughness[k] * w[k];
      metal += skin.metalness[k] * w[k];
    }
    c[i] = cr; c[i + 1] = cg; c[i + 2] = cb; c[i + 3] = 255;
    o[i] = 255; o[i + 1] = rough * 255; o[i + 2] = metal * 255; o[i + 3] = 255;
  }
  cctx.putImageData(cimg, 0, 0);
  octx.putImageData(oimg, 0, 0);
  return { color, orm };
}
