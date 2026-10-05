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

/**
 * Weapon models that do not currently have remote Source 2 PBR texture assets
 * hosted on Cloudflare R2 (e.g. Zeus x27 / pist_taser).
 * These models are rendered exclusively via procedural canvas textures.
 */
export const KNOWN_UNHOSTED_WEAPON_KEYS = new Set<string>([
  'pist_taser',
]);

/**
 * Returns true if a given weapon possesses verified, live Source 2 PBR texture assets on R2.
 */
export function hasVerifiedRemoteTextures(weaponNameOrKey?: string): boolean {
  if (!weaponNameOrKey) return false;
  const key = getWeaponKeyFromName(weaponNameOrKey);
  if (!key) return false;
  if (KNOWN_UNHOSTED_WEAPON_KEYS.has(key)) return false;
  return key in BASE_WEAPON_MAPS;
}

// In-memory texture cache to prevent redundant network fetches
const textureCache = new Map<string, THREE.Texture>();

// In-flight promises cache for deduplicating concurrent fetches
const inFlightRequests = new Map<string, Promise<THREE.Texture | null>>();

// Failed URL cache to avoid repeated 404/network hammering
const failedUrls = new Set<string>();

/**
 * Authoritative verified Cloudflare R2 asset paths for all CS2 weapons.
 * Maps folder keys to their verified filenames in the cs2-textures bucket.
 */
export const R2_ACTUAL_WEAPON_FILES: Record<string, { ao: string; masks: string; surface: string }> = {
  mach_m249para: {
    ao: 'mach_m249para_ao_psd_2bfcb5e8.png',
    masks: 'mach_m249para_masks_psd_da5a7179.png',
    surface: 'mach_m249para_surface_psd_ad0c2f19.png',
  },
  mach_negev: {
    ao: 'mach_negev_ao_psd_3a8bb222.png',
    masks: 'mach_negev_masks_psd_ce55f770.png',
    surface: 'mach_negev_surface_tga_1045b082.png',
  },
  pist_223: {
    ao: 'pist_223_ao_psd_2d11c42c.png',
    masks: 'pist_223_masks_psd_25c9e723.png',
    surface: 'pist_223_surface_psd_4ba9ea8a.png',
  },
  pist_cz_75: {
    ao: 'pist_cz_75_ao_psd_15dc5ed0.png',
    masks: 'pist_cz_75_masks_psd_508e4d17.png',
    surface: 'pist_cz_75_surface_psd_5db16329.png',
  },
  pist_deagle: {
    ao: 'pist_deagle_ao_psd_d8bd07a9.png',
    masks: 'pist_deagle_masks_psd_798a71da.png',
    surface: 'pist_deagle_surface_psd_539e8975.png',
  },
  pist_elite: {
    ao: 'pist_elite_ao_psd_f377bde.png',
    masks: 'pist_elite_masks_psd_6f76b8d4.png',
    surface: 'pist_elite_surface_psd_deecd8e6.png',
  },
  pist_fiveseven: {
    ao: 'pist_fiveseven_ao_psd_d263ab10.png',
    masks: 'pist_fiveseven_masks_psd_3ce2d3f3.png',
    surface: 'pist_fiveseven_surface_psd_d16eb7a7.png',
  },
  pist_glock18: {
    ao: 'pist_glock18_ao_tga_b31a63b8.png',
    masks: 'pist_glock18_masks_tga_2a676e44.png',
    surface: 'pist_glock18_surface_tga_deddd48a.png',
  },
  pist_hkp2000: {
    ao: 'pist_hkp2000_ao_psd_dfe65789.png',
    masks: 'pist_hkp2000_masks_psd_135e1a2f.png',
    surface: 'pist_hkp2000_surface_psd_8b91a1c0.png',
  },
  pist_p250: {
    ao: 'pist_p250_nopaint2_ao_psd_84d3ef4.png',
    masks: 'pist_p250_masks_psd_b3ebdfc5.png',
    surface: 'pist_p250_surface_psd_ec8de691.png',
  },
  pist_revolver: {
    ao: 'pist_revolver_ao_psd_759dc95f.png',
    masks: 'pist_revolver_masks_psd_daa88bf2.png',
    surface: 'pist_revolver_surface_psd_142c2e4e.png',
  },
  pist_tec9: {
    ao: 'pist_tec9_ao_psd_84c0421f.png',
    masks: 'pist_tec9_masks_psd_68642f2a.png',
    surface: 'pist_tec9_surface_psd_9cdd60e1.png',
  },
  rif_ak47: {
    ao: 'rif_ak47_ao_psd_3cdda94d.png',
    masks: 'rif_ak47_masks_psd_cc08789a.png',
    surface: 'rif_ak47_surface_psd_1262e7bf.png',
  },
  rif_aug: {
    ao: 'rif_aug_ao_tga_4955c1d7.png',
    masks: 'rif_aug_masks_psd_9e6ecdbd.png',
    surface: 'rif_aug_surface_tga_96e957f7.png',
  },
  rif_famas: {
    ao: 'rif_famas_ao_psd_aef1628b.png',
    masks: 'rif_famas_masks_psd_4a5996e7.png',
    surface: 'rif_famas_surface_psd_7d22e43d.png',
  },
  rif_galilar: {
    ao: 'rif_galilar_ao_psd_3e31ab3.png',
    masks: 'rif_galilar_masks_psd_b25dafb7.png',
    surface: 'rif_galilar_surface_psd_8317326c.png',
  },
  rif_m4a1: {
    ao: 'rif_m4a1_ao_psd_271a23bd.png',
    masks: 'rif_m4a1_masks_psd_b555aaf5.png',
    surface: 'rif_m4a1_surface_psd_22c7d9d1.png',
  },
  rif_m4a1_s: {
    ao: 'rif_m4a1_s_ao_psd_4fcef6bd.png',
    masks: 'rif_m4a1_s_masks_psd_a83c1744.png',
    surface: 'rif_m4a1_s_surface_psd_1514d837.png',
  },
  rif_sg556: {
    ao: 'rif_sg556_ao_psd_c746db78.png',
    masks: 'rif_sg556_masks_psd_1e3fe18d.png',
    surface: 'rif_sg556_surface_psd_9e52d9f3.png',
  },
  shot_mag7: {
    ao: 'shot_mag7_ao_psd_edde0e1.png',
    masks: 'shot_mag7_masks_psd_34392cbc.png',
    surface: 'shot_mag7_surface_psd_12c4f6b7.png',
  },
  shot_nova: {
    ao: 'shot_nova_ao_psd_78cb575d.png',
    masks: 'shot_nova_masks_psd_27bc86b.png',
    surface: 'shot_nova_surface_psd_be0ced1f.png',
  },
  shot_sawedoff: {
    ao: 'shot_sawedoff_ao_psd_d406c3d.png',
    masks: 'shot_sawedoff_masks_psd_703ec12.png',
    surface: 'shot_sawedoff_surface_psd_13053074.png',
  },
  shot_xm1014: {
    ao: 'shot_xm1014_ao_psd_4b7a055e.png',
    masks: 'shot_xm1014_masks_psd_31cd0e18.png',
    surface: 'shot_xm1014_surface_psd_9969f91b.png',
  },
  smg_bizon: {
    ao: 'smg_bizon_ao_psd_5cf2078a.png',
    masks: 'smg_bizon_masks_psd_b3326b34.png',
    surface: 'smg_bizon_surface_psd_3c8bb3e2.png',
  },
  smg_mac10: {
    ao: 'smg_mac10_ao_psd_607359a0.png',
    masks: 'smg_mac10_masks_psd_b5c1be46.png',
    surface: 'smg_mac10_surface_psd_b99436d8.png',
  },
  smg_mp5sd: {
    ao: 'smg_mp5sd_ao_psd_8ae0e623.png',
    masks: 'smg_mp5sd_masks_psd_cf8dbc1b.png',
    surface: 'smg_mp5sd_surface_psd_46619ae8.png',
  },
  smg_mp7: {
    ao: 'smg_mp7_ao_psd_ed0a97ff.png',
    masks: 'smg_mp7_masks_psd_497e71e9.png',
    surface: 'smg_mp7_surface_psd_f3a4244d.png',
  },
  smg_mp9: {
    ao: 'smg_mp9_ao_psd_6de68ade.png',
    masks: 'smg_mp9_masks_psd_c1e92ba6.png',
    surface: 'smg_mp9_surface_psd_6382a845.png',
  },
  smg_p90: {
    ao: 'smg_p90_ao_tga_647dff3.png',
    masks: 'smg_p90_masks_psd_78e2c8c8.png',
    surface: 'smg_p90_surface_tga_be92be04.png',
  },
  smg_ump45: {
    ao: 'smg_ump45_ao_tga_d15152e8.png',
    masks: 'smg_ump45_masks_psd_14f89dd8.png',
    surface: 'smg_ump45_surface_tga_edf6fbab.png',
  },
  snip_awp: {
    ao: 'snip_awp_ao_psd_c4627094.png',
    masks: 'snip_awp_masks_psd_10fcf89f.png',
    surface: 'snip_awp_surface_tga_92c324e4.png',
  },
  snip_g3sg1: {
    ao: 'snip_g3sg1_ao_psd_8a76cb4b.png',
    masks: 'snip_g3sg1_masks_psd_a2e8ed76.png',
    surface: 'snip_g3sg1_surface_tga_b8acd5c4.png',
  },
  snip_scar20: {
    ao: 'snip_scar20_ao_psd_be073ac5.png',
    masks: 'snip_scar20_masks_psd_ddbd6f6e.png',
    surface: 'snip_scar20_surface_tga_b5ae99f3.png',
  },
  snip_ssg08: {
    ao: 'snip_ssg08_scope_ao_tga_8cff0972.png',
    masks: 'snip_ssg08_scope_masks_psd_9f73317e.png',
    surface: 'snip_ssg08_surface_tga_1b8195eb.png',
  },
};

R2_ACTUAL_WEAPON_FILES['mach_m249'] = R2_ACTUAL_WEAPON_FILES['mach_m249para'];
R2_ACTUAL_WEAPON_FILES['rif_m4a4'] = R2_ACTUAL_WEAPON_FILES['rif_m4a1'];
R2_ACTUAL_WEAPON_FILES['pist_cz75a'] = R2_ACTUAL_WEAPON_FILES['pist_cz_75'];
R2_ACTUAL_WEAPON_FILES['pist_usp_silencer'] = R2_ACTUAL_WEAPON_FILES['pist_223'];
R2_ACTUAL_WEAPON_FILES['rif_m4a1_silencer'] = R2_ACTUAL_WEAPON_FILES['rif_m4a1_s'];

export const WEAPON_PREFIX_TO_FOLDER: Record<string, string> = {
  mach_m249para: 'mach_m249para',
  mach_m249: 'mach_m249para',
  mach_negev: 'mach_negev',
  pist_223: 'pist_223',
  pist_usp_silencer: 'pist_223',
  pist_cz_75: 'pist_cz_75',
  pist_cz75a: 'pist_cz_75',
  pist_deagle: 'pist_deagle',
  pist_elite: 'pist_elite',
  pist_fiveseven: 'pist_fiveseven',
  pist_glock18: 'pist_glock18',
  pist_hkp2000: 'pist_hkp2000',
  pist_p250: 'pist_p250',
  pist_revolver: 'pist_revolver',
  pist_tec9: 'pist_tec9',
  rif_ak47: 'rif_ak47',
  rif_aug: 'rif_aug',
  rif_famas: 'rif_famas',
  rif_galilar: 'rif_galilar',
  rif_m4a1_s: 'rif_m4a1_s',
  rif_m4a1_silencer: 'rif_m4a1_s',
  rif_m4a1: 'rif_m4a1',
  rif_m4a4: 'rif_m4a1',
  rif_sg556: 'rif_sg556',
  shot_mag7: 'shot_mag7',
  shot_nova: 'shot_nova',
  shot_sawedoff: 'shot_sawedoff',
  shot_xm1014: 'shot_xm1014',
  smg_bizon: 'smg_bizon',
  smg_mac10: 'smg_mac10',
  smg_mp5sd: 'smg_mp5sd',
  smg_mp7: 'smg_mp7',
  smg_mp9: 'smg_mp9',
  smg_p90: 'smg_p90',
  smg_ump45: 'smg_ump45',
  snip_awp: 'snip_awp',
  snip_g3sg1: 'snip_g3sg1',
  snip_scar20: 'snip_scar20',
  snip_ssg08: 'snip_ssg08',
};

/**
 * Normalizes an R2 texture asset URL to its actual CDN path under /cs2-textures/paints/<folder>/<filename>
 */
export function resolveActualR2TextureUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.includes('/cs2-textures/paints/')) {
    return trimmed;
  }
  const prefix = 'https://assets.huh4k.dev/cs2-textures/';
  if (trimmed.startsWith(prefix)) {
    const rawFile = trimmed.slice(prefix.length);
    const sortedPrefixes = Object.keys(WEAPON_PREFIX_TO_FOLDER).sort((a, b) => b.length - a.length);
    for (const key of sortedPrefixes) {
      if (rawFile.startsWith(key) || rawFile.includes(key)) {
        const folder = WEAPON_PREFIX_TO_FOLDER[key];
        const files = R2_ACTUAL_WEAPON_FILES[folder];
        if (files) {
          if (rawFile.includes('_ao')) {
            return `${R2_PAINTS_BASE_URL}${folder}/${files.ao}`;
          }
          if (rawFile.includes('_surface')) {
            return `${R2_PAINTS_BASE_URL}${folder}/${files.surface}`;
          }
          if (rawFile.includes('_masks')) {
            return `${R2_PAINTS_BASE_URL}${folder}/${files.masks}`;
          }
        }
      }
    }
  }
  return trimmed;
}

/**
 * Asynchronously loads a texture from Cloudflare R2 using Three.js TextureLoader.
 *
 * Key guarantees:
 * - In-memory caching: textures are cached in `textureCache` to avoid duplicate downloads.
 * - In-flight deduplication: multiple simultaneous calls for the same URL share a single request.
 * - Non-blocking error handling: catches 404s, CORS errors, and network failures without throwing,
 *   returning `null` so procedural canvas fallback materials engage seamlessly.
 * - SSR safety: only instantiates `THREE.TextureLoader` in browser DOM environments.
 * - Resolves to authoritative CDN endpoints under /cs2-textures/paints/<weapon>/
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

  const actualFetchUrl = resolveActualR2TextureUrl(trimmedUrl);

  // 1. Cache hit (check both original and resolved URLs)
  if (textureCache.has(trimmedUrl)) {
    return textureCache.get(trimmedUrl)!;
  }
  if (textureCache.has(actualFetchUrl)) {
    const cached = textureCache.get(actualFetchUrl)!;
    textureCache.set(trimmedUrl, cached);
    return cached;
  }

  // 2. Known failed URL or known unhosted weapon assets (e.g. pist_taser)
  if (failedUrls.has(trimmedUrl) || failedUrls.has(actualFetchUrl)) {
    return null;
  }
  for (const unhosted of KNOWN_UNHOSTED_WEAPON_KEYS) {
    if (trimmedUrl.includes(unhosted) || actualFetchUrl.includes(unhosted)) {
      failedUrls.add(trimmedUrl);
      failedUrls.add(actualFetchUrl);
      return null;
    }
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
  if (inFlightRequests.has(actualFetchUrl)) {
    return inFlightRequests.get(actualFetchUrl)!;
  }

  const loadPromise = new Promise<THREE.Texture | null>((resolve) => {
    try {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');

      loader.load(
        actualFetchUrl,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.needsUpdate = true;
          textureCache.set(trimmedUrl, texture);
          if (actualFetchUrl !== trimmedUrl) {
            textureCache.set(actualFetchUrl, texture);
          }
          inFlightRequests.delete(trimmedUrl);
          inFlightRequests.delete(actualFetchUrl);
          resolve(texture);
        },
        undefined,
        (error) => {
          // Non-blocking: catch 404 / CORS failure without throwing
          console.warn(`[r2Textures] Non-blocking fallback: unable to load texture from ${actualFetchUrl}:`, error);
          failedUrls.add(trimmedUrl);
          failedUrls.add(actualFetchUrl);
          inFlightRequests.delete(trimmedUrl);
          inFlightRequests.delete(actualFetchUrl);
          resolve(null);
        }
      );
    } catch (err) {
      console.warn(`[r2Textures] Synchronous error loading texture ${actualFetchUrl}:`, err);
      failedUrls.add(trimmedUrl);
      failedUrls.add(actualFetchUrl);
      inFlightRequests.delete(trimmedUrl);
      inFlightRequests.delete(actualFetchUrl);
      resolve(null);
    }
  });

  inFlightRequests.set(trimmedUrl, loadPromise);
  if (actualFetchUrl !== trimmedUrl) {
    inFlightRequests.set(actualFetchUrl, loadPromise);
  }
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
