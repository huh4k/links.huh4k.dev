/**
 * Cloudflare R2 Texture Resolver & Weapon Mapping Engine
 *
 * Provides authoritative mapping between CS2 weapon models/skins and their
 * high-resolution PBR texture assets (Ambient Occlusion, Surface roughness, and Masks)
 * hosted on Cloudflare R2 CDN.
 *
 * Includes an in-memory cached, non-blocking asynchronous texture loader
 * designed for Three.js rendering pipelines with SSR safety.
 */

import * as THREE from 'three';

/** Base CDN endpoint for authentic CS2 weapon texture assets */
export const R2_BASE_URL = 'https://assets.huh4k.dev/cs2-textures/';

/** Base CDN endpoint for CS2 paint finish texture maps */
export const R2_PAINTS_BASE_URL = 'https://assets.huh4k.dev/cs2-textures/paints/';

/** Base weapon texture maps containing AO, Surface, and Mask textures */
export interface BaseWeaponTextures {
  aoUrl: string;
  surfaceUrl: string;
  masksUrl: string;
}

/** Supported CS2 paint finish types */
export const PAINT_FINISH_TYPES = [
  'anodized_air',
  'anodized_multi',
  'antiqued',
  'custom',
  'gunsmith',
  'hydrographic',
] as const;

export type PaintFinishType = typeof PAINT_FINISH_TYPES[number];

/**
 * Authoritative base texture maps catalog for CS2 weapon models.
 * Contains direct Source 2 VRF asset hashes for models with known hash signatures,
 * and canonical standardized texture paths for all 35 CS2 weapon models.
 */
export const BASE_WEAPON_MAPS: Record<string, BaseWeaponTextures> = {
  // Rifles
  rif_ak47: {
    aoUrl: `${R2_BASE_URL}rif_ak47_ao_psd_3cdda94d.png`,
    surfaceUrl: `${R2_BASE_URL}rif_ak47_surface_psd_1262e7bf.png`,
    masksUrl: `${R2_BASE_URL}rif_ak47_masks_psd_cc08789a.png`,
  },
  rif_m4a1_s: {
    aoUrl: `${R2_BASE_URL}rif_m4a1_s_ao.png`,
    surfaceUrl: `${R2_BASE_URL}rif_m4a1_s_surface.png`,
    masksUrl: `${R2_BASE_URL}rif_m4a1_s_masks.png`,
  },
  rif_m4a4: {
    aoUrl: `${R2_BASE_URL}rif_m4a4_ao.png`,
    surfaceUrl: `${R2_BASE_URL}rif_m4a4_surface.png`,
    masksUrl: `${R2_BASE_URL}rif_m4a4_masks.png`,
  },
  rif_galilar: {
    aoUrl: `${R2_BASE_URL}rif_galilar_ao.png`,
    surfaceUrl: `${R2_BASE_URL}rif_galilar_surface.png`,
    masksUrl: `${R2_BASE_URL}rif_galilar_masks.png`,
  },
  rif_famas: {
    aoUrl: `${R2_BASE_URL}rif_famas_ao.png`,
    surfaceUrl: `${R2_BASE_URL}rif_famas_surface.png`,
    masksUrl: `${R2_BASE_URL}rif_famas_masks.png`,
  },
  rif_aug: {
    aoUrl: `${R2_BASE_URL}rif_aug_ao.png`,
    surfaceUrl: `${R2_BASE_URL}rif_aug_surface.png`,
    masksUrl: `${R2_BASE_URL}rif_aug_masks.png`,
  },
  rif_sg556: {
    aoUrl: `${R2_BASE_URL}rif_sg556_ao.png`,
    surfaceUrl: `${R2_BASE_URL}rif_sg556_surface.png`,
    masksUrl: `${R2_BASE_URL}rif_sg556_masks.png`,
  },

  // Sniper Rifles
  snip_awp: {
    aoUrl: `${R2_BASE_URL}snip_awp_ao.png`,
    surfaceUrl: `${R2_BASE_URL}snip_awp_surface.png`,
    masksUrl: `${R2_BASE_URL}snip_awp_masks.png`,
  },
  snip_ssg08: {
    aoUrl: `${R2_BASE_URL}snip_ssg08_ao.png`,
    surfaceUrl: `${R2_BASE_URL}snip_ssg08_surface.png`,
    masksUrl: `${R2_BASE_URL}snip_ssg08_masks.png`,
  },
  snip_g3sg1: {
    aoUrl: `${R2_BASE_URL}snip_g3sg1_ao.png`,
    surfaceUrl: `${R2_BASE_URL}snip_g3sg1_surface.png`,
    masksUrl: `${R2_BASE_URL}snip_g3sg1_masks.png`,
  },
  snip_scar20: {
    aoUrl: `${R2_BASE_URL}snip_scar20_ao.png`,
    surfaceUrl: `${R2_BASE_URL}snip_scar20_surface.png`,
    masksUrl: `${R2_BASE_URL}snip_scar20_masks.png`,
  },

  // Pistols & Sidearms
  pist_223: {
    aoUrl: `${R2_BASE_URL}pist_223_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_223_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_223_masks.png`,
  },
  pist_glock18: {
    aoUrl: `${R2_BASE_URL}pist_glock18_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_glock18_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_glock18_masks.png`,
  },
  pist_deagle: {
    aoUrl: `${R2_BASE_URL}pist_deagle_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_deagle_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_deagle_masks.png`,
  },
  pist_p250: {
    aoUrl: `${R2_BASE_URL}pist_p250_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_p250_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_p250_masks.png`,
  },
  pist_hkp2000: {
    aoUrl: `${R2_BASE_URL}pist_hkp2000_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_hkp2000_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_hkp2000_masks.png`,
  },
  pist_fiveseven: {
    aoUrl: `${R2_BASE_URL}pist_fiveseven_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_fiveseven_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_fiveseven_masks.png`,
  },
  pist_cz75a: {
    aoUrl: `${R2_BASE_URL}pist_cz75a_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_cz75a_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_cz75a_masks.png`,
  },
  pist_tec9: {
    aoUrl: `${R2_BASE_URL}pist_tec9_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_tec9_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_tec9_masks.png`,
  },
  pist_elite: {
    aoUrl: `${R2_BASE_URL}pist_elite_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_elite_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_elite_masks.png`,
  },
  pist_revolver: {
    aoUrl: `${R2_BASE_URL}pist_revolver_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_revolver_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_revolver_masks.png`,
  },
  pist_taser: {
    aoUrl: `${R2_BASE_URL}pist_taser_ao.png`,
    surfaceUrl: `${R2_BASE_URL}pist_taser_surface.png`,
    masksUrl: `${R2_BASE_URL}pist_taser_masks.png`,
  },

  // Submachine Guns (SMGs)
  smg_mac10: {
    aoUrl: `${R2_BASE_URL}smg_mac10_ao.png`,
    surfaceUrl: `${R2_BASE_URL}smg_mac10_surface.png`,
    masksUrl: `${R2_BASE_URL}smg_mac10_masks.png`,
  },
  smg_ump45: {
    aoUrl: `${R2_BASE_URL}smg_ump45_ao.png`,
    surfaceUrl: `${R2_BASE_URL}smg_ump45_surface.png`,
    masksUrl: `${R2_BASE_URL}smg_ump45_masks.png`,
  },
  smg_mp9: {
    aoUrl: `${R2_BASE_URL}smg_mp9_ao.png`,
    surfaceUrl: `${R2_BASE_URL}smg_mp9_surface.png`,
    masksUrl: `${R2_BASE_URL}smg_mp9_masks.png`,
  },
  smg_mp7: {
    aoUrl: `${R2_BASE_URL}smg_mp7_ao.png`,
    surfaceUrl: `${R2_BASE_URL}smg_mp7_surface.png`,
    masksUrl: `${R2_BASE_URL}smg_mp7_masks.png`,
  },
  smg_mp5sd: {
    aoUrl: `${R2_BASE_URL}smg_mp5sd_ao.png`,
    surfaceUrl: `${R2_BASE_URL}smg_mp5sd_surface.png`,
    masksUrl: `${R2_BASE_URL}smg_mp5sd_masks.png`,
  },
  smg_p90: {
    aoUrl: `${R2_BASE_URL}smg_p90_ao.png`,
    surfaceUrl: `${R2_BASE_URL}smg_p90_surface.png`,
    masksUrl: `${R2_BASE_URL}smg_p90_masks.png`,
  },
  smg_bizon: {
    aoUrl: `${R2_BASE_URL}smg_bizon_ao.png`,
    surfaceUrl: `${R2_BASE_URL}smg_bizon_surface.png`,
    masksUrl: `${R2_BASE_URL}smg_bizon_masks.png`,
  },

  // Shotguns
  shot_mag7: {
    aoUrl: `${R2_BASE_URL}shot_mag7_ao.png`,
    surfaceUrl: `${R2_BASE_URL}shot_mag7_surface.png`,
    masksUrl: `${R2_BASE_URL}shot_mag7_masks.png`,
  },
  shot_nova: {
    aoUrl: `${R2_BASE_URL}shot_nova_ao.png`,
    surfaceUrl: `${R2_BASE_URL}shot_nova_surface.png`,
    masksUrl: `${R2_BASE_URL}shot_nova_masks.png`,
  },
  shot_sawedoff: {
    aoUrl: `${R2_BASE_URL}shot_sawedoff_ao.png`,
    surfaceUrl: `${R2_BASE_URL}shot_sawedoff_surface.png`,
    masksUrl: `${R2_BASE_URL}shot_sawedoff_masks.png`,
  },
  shot_xm1014: {
    aoUrl: `${R2_BASE_URL}shot_xm1014_ao.png`,
    surfaceUrl: `${R2_BASE_URL}shot_xm1014_surface.png`,
    masksUrl: `${R2_BASE_URL}shot_xm1014_masks.png`,
  },

  // Machine Guns / Heavy
  mach_m249: {
    aoUrl: `${R2_BASE_URL}mach_m249_ao.png`,
    surfaceUrl: `${R2_BASE_URL}mach_m249_surface.png`,
    masksUrl: `${R2_BASE_URL}mach_m249_masks.png`,
  },
  mach_negev: {
    aoUrl: `${R2_BASE_URL}mach_negev_ao.png`,
    surfaceUrl: `${R2_BASE_URL}mach_negev_surface.png`,
    masksUrl: `${R2_BASE_URL}mach_negev_masks.png`,
  },
};

// Aliases for common alternative model keys
BASE_WEAPON_MAPS['pist_usp_silencer'] = BASE_WEAPON_MAPS['pist_223'];
BASE_WEAPON_MAPS['rif_m4a1_silencer'] = BASE_WEAPON_MAPS['rif_m4a1_s'];

/**
 * Mapping of weapon names, abbreviations, and aliases to canonical weapon keys.
 */
const WEAPON_NAME_TO_KEY: Record<string, string> = {
  // Rifles
  'ak-47': 'rif_ak47',
  ak47: 'rif_ak47',
  ak: 'rif_ak47',
  'm4a1-s': 'rif_m4a1_s',
  'm4a1_s': 'rif_m4a1_s',
  'm4a1s': 'rif_m4a1_s',
  'm4a1 silencer': 'rif_m4a1_s',
  'm4a1-silencer': 'rif_m4a1_s',
  'm4a1_silencer': 'rif_m4a1_s',
  'm4a1': 'rif_m4a1_s',
  'm4a4': 'rif_m4a4',
  m4: 'rif_m4a4',
  'galil ar': 'rif_galilar',
  galilar: 'rif_galilar',
  galil: 'rif_galilar',
  famas: 'rif_famas',
  aug: 'rif_aug',
  'sg 553': 'rif_sg556',
  sg553: 'rif_sg556',
  'sg 556': 'rif_sg556',
  sg556: 'rif_sg556',
  sg: 'rif_sg556',

  // Sniper Rifles
  awp: 'snip_awp',
  'ssg 08': 'snip_ssg08',
  ssg08: 'snip_ssg08',
  'ssg-08': 'snip_ssg08',
  ssg: 'snip_ssg08',
  scout: 'snip_ssg08',
  g3sg1: 'snip_g3sg1',
  'g3-sg1': 'snip_g3sg1',
  'scar-20': 'snip_scar20',
  scar20: 'snip_scar20',
  scar: 'snip_scar20',

  // Pistols & Sidearms
  'usp-s': 'pist_223',
  'usp_s': 'pist_223',
  usps: 'pist_223',
  'usp silencer': 'pist_223',
  'usp-silencer': 'pist_223',
  'usp_silencer': 'pist_223',
  usp: 'pist_223',
  'pist_223': 'pist_223',
  '223': 'pist_223',
  'glock-18': 'pist_glock18',
  'glock 18': 'pist_glock18',
  glock18: 'pist_glock18',
  glock: 'pist_glock18',
  'desert eagle': 'pist_deagle',
  'desert-eagle': 'pist_deagle',
  deagle: 'pist_deagle',
  p250: 'pist_p250',
  p2000: 'pist_hkp2000',
  hkp2000: 'pist_hkp2000',
  p2k: 'pist_hkp2000',
  'five-seven': 'pist_fiveseven',
  fiveseven: 'pist_fiveseven',
  'five seven': 'pist_fiveseven',
  '5-7': 'pist_fiveseven',
  'cz75-auto': 'pist_cz75a',
  cz75a: 'pist_cz75a',
  'cz75 auto': 'pist_cz75a',
  cz75: 'pist_cz75a',
  'cz-75': 'pist_cz75a',
  'tec-9': 'pist_tec9',
  tec9: 'pist_tec9',
  'tec 9': 'pist_tec9',
  'dual berettas': 'pist_elite',
  dualies: 'pist_elite',
  'dual beretta': 'pist_elite',
  elite: 'pist_elite',
  'r8 revolver': 'pist_revolver',
  revolver: 'pist_revolver',
  r8: 'pist_revolver',
  'zeus x27': 'pist_taser',
  zeus: 'pist_taser',
  taser: 'pist_taser',
  pist_taser: 'pist_taser',

  // Submachine Guns (SMGs)
  'mac-10': 'smg_mac10',
  mac10: 'smg_mac10',
  'mac 10': 'smg_mac10',
  'ump-45': 'smg_ump45',
  ump45: 'smg_ump45',
  'ump 45': 'smg_ump45',
  ump: 'smg_ump45',
  mp9: 'smg_mp9',
  mp7: 'smg_mp7',
  'mp5-sd': 'smg_mp5sd',
  mp5sd: 'smg_mp5sd',
  'mp5 sd': 'smg_mp5sd',
  mp5: 'smg_mp5sd',
  p90: 'smg_p90',
  'pp-bizon': 'smg_bizon',
  ppbizon: 'smg_bizon',
  'pp bizon': 'smg_bizon',
  bizon: 'smg_bizon',

  // Shotguns
  'mag-7': 'shot_mag7',
  mag7: 'shot_mag7',
  'mag 7': 'shot_mag7',
  nova: 'shot_nova',
  'sawed-off': 'shot_sawedoff',
  sawedoff: 'shot_sawedoff',
  'sawed off': 'shot_sawedoff',
  xm1014: 'shot_xm1014',
  'xm-1014': 'shot_xm1014',

  // Machine Guns / Heavy
  m249: 'mach_m249',
  negev: 'mach_negev',
};

/** Pre-sorted list of keys for deterministic longest-match resolution */
const SORTED_NAME_KEYS = Object.keys(WEAPON_NAME_TO_KEY).sort((a, b) => b.length - a.length);

/** Known knife types that do not have base CS2 firearm maps */
const KNIFE_TERMS = [
  'knife',
  'bayonet',
  'karambit',
  'daggers',
  'kukri',
  'stiletto',
  'talon',
  'ursus',
  'navaja',
  'skeleton',
  'nomad',
  'paracord',
  'bowie',
  'falchion',
  'huntsman',
];

/**
 * Normalizes any CS2 weapon name, market string, or file path into a canonical weapon key.
 *
 * Examples:
 * - "AK-47" -> "rif_ak47"
 * - "StatTrak™ M4A1-S | Liquidation (Field-Tested)" -> "rif_m4a1_s"
 * - "USP-S | Royal Guard" -> "pist_223"
 * - "weapon_rif_ak47.obj" -> "rif_ak47"
 * - "★ Karambit | Doppler" -> null
 *
 * @param weaponName Weapon name, market string, or model path
 * @returns Canonical weapon key (e.g. "rif_ak47") or null if unrecognized
 */
export function getWeaponKeyFromName(weaponName: string): string | null {
  if (!weaponName || typeof weaponName !== 'string') {
    return null;
  }

  let clean = weaponName.trim();
  if (!clean) return null;

  // 1. If path or filename, extract base filename without extension
  if (clean.includes('/') || clean.endsWith('.obj') || clean.endsWith('.glb')) {
    const filename = clean.split('/').pop() || '';
    clean = filename.replace(/\.(obj|glb|gltf)$/i, '');
  }

  // 2. Strip standard CS2 prefixes: star, StatTrak™, Souvenir
  clean = clean.replace(/^[★\s]+/, '');
  clean = clean.replace(/^StatTrak™\s+/i, '');
  clean = clean.replace(/^Souvenir\s+/i, '');

  // 3. Strip skin pattern name after pipe delimiter (e.g. "AK-47 | Ice Coaled" -> "AK-47")
  if (clean.includes('|')) {
    clean = clean.split('|')[0].trim();
  }

  // 4. Strip wear rating in parentheses (e.g. "(Field-Tested)")
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '').trim();

  const lower = clean.toLowerCase();

  // 5. Check if it represents a knife or melee weapon
  for (const knife of KNIFE_TERMS) {
    if (lower.includes(knife)) {
      return null;
    }
  }

  // 6. Strip 'weapon_' prefix if present (e.g. "weapon_rif_ak47" -> "rif_ak47")
  const strippedWeapon = lower.replace(/^weapon_/, '');

  // 7. Check if already a canonical key in BASE_WEAPON_MAPS
  if (BASE_WEAPON_MAPS[strippedWeapon]) {
    // Normalize aliases to canonical form if needed
    if (strippedWeapon === 'pist_usp_silencer') return 'pist_223';
    if (strippedWeapon === 'rif_m4a1_silencer') return 'rif_m4a1_s';
    return strippedWeapon;
  }

  // 8. Direct dictionary lookup
  if (WEAPON_NAME_TO_KEY[lower]) {
    return WEAPON_NAME_TO_KEY[lower];
  }
  if (WEAPON_NAME_TO_KEY[strippedWeapon]) {
    return WEAPON_NAME_TO_KEY[strippedWeapon];
  }

  // 9. Alphanumeric match ignoring spaces, hyphens, underscores
  const alphanumeric = lower.replace(/[\s\-_]/g, '');
  for (const key of SORTED_NAME_KEYS) {
    const keyAlpha = key.replace(/[\s\-_]/g, '');
    if (keyAlpha === alphanumeric) {
      return WEAPON_NAME_TO_KEY[key];
    }
  }

  // 10. Substring match against known keys (longest first)
  for (const key of SORTED_NAME_KEYS) {
    const keyAlpha = key.replace(/[\s\-_]/g, '');
    if (keyAlpha.length >= 3 && alphanumeric.includes(keyAlpha)) {
      return WEAPON_NAME_TO_KEY[key];
    }
  }

  return null;
}

/**
 * Resolves a CS2 weapon name or key to its authentic R2 base texture assets.
 * Returns URLs for Ambient Occlusion (`aoUrl`), Surface roughness (`surfaceUrl`),
 * and Mask maps (`masksUrl`).
 *
 * @param weaponNameOrKey Weapon display name, market title, or key (e.g. "AK-47", "rif_ak47")
 * @returns BaseWeaponTextures object or null if not resolved
 */
export function getR2WeaponTextures(weaponNameOrKey: string): BaseWeaponTextures | null {
  if (!weaponNameOrKey || typeof weaponNameOrKey !== 'string') {
    return null;
  }

  const trimmed = weaponNameOrKey.trim();
  if (!trimmed) return null;

  // 1. Direct canonical map lookup
  if (BASE_WEAPON_MAPS[trimmed]) {
    return BASE_WEAPON_MAPS[trimmed];
  }

  // 2. Direct lookup after stripping weapon_ prefix
  const lower = trimmed.toLowerCase();
  const strippedWeapon = lower.replace(/^weapon_/, '');
  if (BASE_WEAPON_MAPS[strippedWeapon]) {
    return BASE_WEAPON_MAPS[strippedWeapon];
  }

  // 3. Normalized weapon key lookup
  const resolvedKey = getWeaponKeyFromName(trimmed);
  if (resolvedKey && BASE_WEAPON_MAPS[resolvedKey]) {
    return BASE_WEAPON_MAPS[resolvedKey];
  }

  // 4. Dynamic standard pattern fallback for valid CS2 weapon model prefixes
  if (resolvedKey && /^(rif_|snip_|pist_|smg_|shot_|mach_)/.test(resolvedKey)) {
    return {
      aoUrl: `${R2_BASE_URL}${resolvedKey}_ao.png`,
      surfaceUrl: `${R2_BASE_URL}${resolvedKey}_surface.png`,
      masksUrl: `${R2_BASE_URL}${resolvedKey}_masks.png`,
    };
  }

  return null;
}

/**
 * Resolves a CS2 paint finish type to its authentic R2 paint texture map URL.
 * Supports: `anodized_air`, `anodized_multi`, `antiqued`, `custom`, `gunsmith`, `hydrographic`.
 *
 * @param finishType Finish identifier (e.g. "gunsmith", "anodized_air")
 * @returns R2 paint texture URL or null if unrecognized
 */
export function getR2PaintFinishUrl(finishType: string): string | null {
  if (!finishType || typeof finishType !== 'string') {
    return null;
  }

  let clean = finishType.trim().toLowerCase();
  clean = clean.replace(/\.png$/i, '');
  clean = clean.replace(/[\s\-]+/g, '_');

  // Handle common aliases
  if (clean === 'custom_paint' || clean === 'custompaint') {
    clean = 'custom';
  } else if (clean === 'anodized') {
    clean = 'anodized_multi';
  } else if (clean === 'hydro') {
    clean = 'hydrographic';
  } else if (clean === 'antique') {
    clean = 'antiqued';
  }

  for (const validFinish of PAINT_FINISH_TYPES) {
    if (clean === validFinish) {
      return `${R2_PAINTS_BASE_URL}${validFinish}.png`;
    }
  }

  return null;
}

// In-memory texture cache to prevent redundant network fetches
const textureCache = new Map<string, THREE.Texture>();

// In-flight promises cache for deduplicating concurrent fetches
const inFlightRequests = new Map<string, Promise<THREE.Texture | null>>();

// Failed URL cache to avoid repeated 404/network hammering
const failedUrls = new Set<string>();

/**
 * Asynchronously loads a texture from Cloudflare R2 using Three.js TextureLoader.
 *
 * Key guarantees:
 * - In-memory caching: textures are cached in `textureCache` to avoid duplicate downloads.
 * - In-flight deduplication: multiple simultaneous calls for the same URL share a single request.
 * - Non-blocking error handling: catches 404s, CORS errors, and network failures without throwing,
 *   returning `null` so procedural canvas fallback materials engage seamlessly.
 * - SSR safety: only instantiates `THREE.TextureLoader` in browser DOM environments.
 *
 * @param url Full URL of the texture to load
 * @returns Promise resolving to THREE.Texture or null on failure/SSR
 */
export async function loadR2Texture(url: string): Promise<THREE.Texture | null> {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return null;
  }

  // 1. Cache hit
  if (textureCache.has(trimmedUrl)) {
    return textureCache.get(trimmedUrl)!;
  }

  // 2. Known failed URL
  if (failedUrls.has(trimmedUrl)) {
    return null;
  }

  // 3. SSR Safety Guard: TextureLoader requires full browser DOM (window, document, and createElementNS)
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof document.createElementNS !== 'function'
  ) {
    return null;
  }

  // 4. In-flight request deduplication
  if (inFlightRequests.has(trimmedUrl)) {
    return inFlightRequests.get(trimmedUrl)!;
  }

  const loadPromise = new Promise<THREE.Texture | null>((resolve) => {
    try {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');

      loader.load(
        trimmedUrl,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.needsUpdate = true;
          textureCache.set(trimmedUrl, texture);
          inFlightRequests.delete(trimmedUrl);
          resolve(texture);
        },
        undefined,
        (error) => {
          // Non-blocking: catch 404 / CORS failure without throwing
          console.warn(`[r2Textures] Non-blocking fallback: unable to load texture from ${trimmedUrl}:`, error);
          failedUrls.add(trimmedUrl);
          inFlightRequests.delete(trimmedUrl);
          resolve(null);
        }
      );
    } catch (err) {
      console.warn(`[r2Textures] Synchronous error loading texture ${trimmedUrl}:`, err);
      failedUrls.add(trimmedUrl);
      inFlightRequests.delete(trimmedUrl);
      resolve(null);
    }
  });

  inFlightRequests.set(trimmedUrl, loadPromise);
  return loadPromise;
}

/**
 * Helper to inspect the current texture cache.
 */
export function getTextureCache(): Map<string, THREE.Texture> {
  return textureCache;
}

/**
 * Helper to manually inject a texture into the cache (useful for testing or procedural overrides).
 */
export function setCachedTexture(url: string, texture: THREE.Texture): void {
  textureCache.set(url, texture);
}

/**
 * Clears the in-memory texture cache, in-flight requests, and failed URLs.
 */
export function clearTextureCache(): void {
  textureCache.clear();
  inFlightRequests.clear();
  failedUrls.clear();
}
