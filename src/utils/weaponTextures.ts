/**
 * Weapon Texture Resolver
 *
 * Resolves authentic CS2 weapon skin color wrap PNG/WebP files
 * hosted on Cloudflare R2 CDN or locally in /textures/.
 *
 * Strict invariants:
 * - NEVER passes _surface, _masks, _rough, _ao, or _normal maps into material.map.
 * - Only matches actual color wrap textures.
 * - If no valid color wrap is matched, returns undefined so ModelViewer
 *   renders clean neutral dark gunmetal (#222222).
 */

import { R2_BASE_URL } from './r2Textures';
import paintkitWraps from '../data/paintkitWraps.json';

/**
 * Checks whether a texture URL or path represents a non-color data map
 * (Source 2 surface packed roughness/metalness, ambient occlusion, normal, masks, or position).
 */
export function isDataMapUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /_(surface|masks|tmasks|rough|ao|normal|tnormal|pos|pos_pfm)(_|\.|\?|$)/i.test(url);
}

/**
 * Checks whether a texture URL is a valid skin finish color wrap.
 */
export function isColorWrapUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Disallow any data maps
  if (isDataMapUrl(trimmed)) return false;
  return true;
}

/**
 * Normalizes a weapon name string (e.g. "StatTrak™ AK-47 | Ice Coaled" -> "ak-47")
 */
export function normalizeWeaponKey(rawName?: string): string {
  if (!rawName) return '';
  let clean = rawName.trim();
  clean = clean.replace(/^[★\s]+/, '');
  clean = clean.replace(/^StatTrak™\s+/i, '');
  clean = clean.replace(/^Souvenir\s+/i, '');
  if (clean.includes('|')) {
    clean = clean.split('|')[0].trim();
  }
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return clean.toLowerCase();
}

/**
 * Normalizes a skin name string (e.g. "Ice Coaled" -> "ice_coaled")
 */
export function normalizeSkinKey(skinName?: string): string {
  if (!skinName) return '';
  let clean = skinName.trim();
  // Strip wear bracket if present
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return clean.toLowerCase().replace(/[\s\-]+/g, '_');
}

/**
 * Known authoritative R2 skin color wrap catalog.
 * Maps normalized "weapon_skin" keys directly to their authentic Cloudflare R2 CDN color wrap PNGs.
 * None of these contain _surface, _masks, _rough, _ao, or _normal.
 */
export const R2_KNOWN_COLOR_WRAPS: Record<string, string> = {
  // AK-47
  ak47_asiimov: `${R2_BASE_URL}paints/paints/custom/workshop/ak47_asiimov_tga_a212f12a.png`,
  ak47_bloodsport: `${R2_BASE_URL}paints/paints/gunsmith/workshop/ak47_bloodsport_tga_814c7428.png`,
  ak47_neon_rider: `${R2_BASE_URL}paints/paints/custom/workshop/ak_neon_rider_tga_c77a29db.png`,
  ak47_anubis: `${R2_BASE_URL}paints/paints/custom/workshop/ak47_anubis_tga_fdec5ded.png`,
  ak47_nightwish: `${R2_BASE_URL}paints/paints/custom/workshop/ak47_nightwish_tga_44363f88.png`,
  ak47_point_disarray: `${R2_BASE_URL}paints/paints/custom/workshop/ak47_point_disarray_tga_94f6d095.png`,
  ak47_empress: `${R2_BASE_URL}paints/paints/gunsmith/workshop/ak47_empress_tga_fd58d708.png`,
  ak47_cartel: `${R2_BASE_URL}paints/paints/antiqued/workshop/ak47_cartel_tga_b09e52d0.png`,
  ak47_head_shot: `${R2_BASE_URL}paints/paints/custom/workshop/ak_head_shot_holo_tga_e7ce68e7.png`,

  // M4A1-S & M4A4
  m4a1s_decimator: `${R2_BASE_URL}paints/paints/gunsmith/workshop/m4a1_decimator_psd_e5a970e4.png`,
  m4a1s_cyrex: `${R2_BASE_URL}paints/paints/custom/workshop/m4a1_cyrex_psd_c07bf908.png`,
  m4a1s_flashback: `${R2_BASE_URL}paints/paints/custom/workshop/m4a1_flashback_tga_d24cc0a4.png`,
  m4a1s_shatter: `${R2_BASE_URL}paints/paints/gunsmith/workshop/m4a1_shatter_tga_9866df38.png`,
  m4a4_temukau: `${R2_BASE_URL}paints/paints/custom/workshop/m4a4_temukau_tga_ba3a649d.png`,
  m4a4_emperor: `${R2_BASE_URL}paints/paints/gunsmith/workshop/m4a4_emperor_psd_726547a.png`,
  m4a4_desolate_space: `${R2_BASE_URL}paints/paints/custom/workshop/m4a4_desolatespace2_tga_eb1445d6.png`,
  m4a4_hellfire: `${R2_BASE_URL}paints/paints/custom/workshop/m4a4_hellfire_psd_c9c7672.png`,
  m4a4_neo_noir: `${R2_BASE_URL}paints/paints/custom/workshop/m4a4_neo_noir_psd_6fe1b8ce.png`,

  // AWP
  awp_hyper_beast: `${R2_BASE_URL}paints/paints/custom/workshop/awp_hyper_beast_tga_ab5fb9eb.png`,
  awp_neo_noir: `${R2_BASE_URL}paints/paints/custom/workshop/awp_neonoir_tga_a60fa4.png`,
  awp_wildfire: `${R2_BASE_URL}paints/paints/custom/workshop/awp_wildfire_tga_caffb6f7.png`,
  awp_chroma_pink: `${R2_BASE_URL}paints/paints/custom/workshop/awp_chroma_pink_tga_aa96878e.png`,
  awp_phobos: `${R2_BASE_URL}paints/paints/gunsmith/workshop/awp-phobos_tga_c3a45d5b.png`,
  awp_exoskeleton: `${R2_BASE_URL}paints/paints/gunsmith/workshop/awp_exoskeleton_tga_4a2d9989.png`,

  // USP-S
  usps_printstream: `${R2_BASE_URL}paints/paints/custom/workshop/usp_printstream_tga_2d067cd8.png`,
  usps_kill_confirmed: `${R2_BASE_URL}paints/paints/custom/workshop/usp_kill_confirmed_tga_d5d60230.png`,
  usps_cyrex: `${R2_BASE_URL}paints/paints/custom/workshop/usp_cyrex_tga_78bbeb9a.png`,
  usps_black_lotus: `${R2_BASE_URL}paints/paints/custom/workshop/usp_black_lotus_tga_5e85ea82.png`,
  usps_flashback: `${R2_BASE_URL}paints/paints/custom/workshop/usp_flashback_tga_87982ed0.png`,
  usps_to_hell: `${R2_BASE_URL}paints/paints/custom/workshop/usp_to_hell_tga_439978c3.png`,
  usps_voltage: `${R2_BASE_URL}paints/paints/gunsmith/workshop/usp_voltage_tga_dc37fa8.png`,

  // Active User Inventory Skins
  // AK-47 | Ice Coaled is cu_ak47_cogthings (hosted under the mirrored customization/ tree).
  ak47_ice_coaled: `${R2_BASE_URL}paints/paints/custom/workshop/ak47_cogthings_tga_c09541d.png`,

  // Glock-18
  glock18_urban_moon_fever: `${R2_BASE_URL}paints/paints/anodized_air/workshop/glock_18_urban_moon_fever_tga_f06e020b.png`,

  // MAC-10
  mac10_the_last_dive: `${R2_BASE_URL}paints/paints/anodized_air/workshop/mac10_the_last_dive_tga_a6aa16fc.png`,
  mac10_neon_rider: `${R2_BASE_URL}paints/paints/custom/workshop/mac10_neonrider_psd_ec089576.png`,

  // UMP-45
  ump45_moonrise: `${R2_BASE_URL}paints/paints/anodized_air/workshop/ump45_moonrise_tga_e844ccb.png`,

  // MP9
  mp9_fuji: `${R2_BASE_URL}paints/paints/anodized_air/workshop/mp9_fuji_tga_44da368d.png`,
};

/**
 * Resolves the official UV sheet texture URL for a given CS2 weapon model.
 * These are the authentic 2048x2048 UV mapping sheets matching the OBJ geometry.
 */
export function resolveUVSheetTextureUrl(weaponName?: string): string | undefined {
  if (!weaponName || typeof weaponName !== 'string') return undefined;

  let clean = weaponName.trim();
  clean = clean.replace(/^[★\s]+/, '');
  clean = clean.replace(/^StatTrak™\s+/i, '');
  clean = clean.replace(/^Souvenir\s+/i, '');
  if (clean.includes('|')) {
    clean = clean.split('|')[0].trim();
  }
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();

  const dash = clean.replace(/[\s_]+/g, '-');
  const underscore = clean.replace(/[\s\-]+/g, '_');
  const compact = clean.replace(/[\s\-_]+/g, '');

  const candidates = [
    `/textures/${dash}.png`,
    `/textures/${underscore}.png`,
    `/textures/${compact}.png`,
    `/textures/${clean}.png`,
  ];

  // Return the canonical dash or underscore candidate
  return candidates[0];
}

/**
 * Generated from the game data (see scripts/export-paintkit-textures.sh): "<weapon>_<skin>" -> [R2 path, legacy mesh flag].
 * Only custom/gunsmith kits (real colour wraps) are listed; solid/spray/anodized finishes have no wrap texture.
 * Kits flagged legacy use the CS:GO workshop meshes in /models/objs/; the rest use the CS2 meshes in /models/.
 */
const PAINTKIT_WRAPS = paintkitWraps as unknown as Record<string, [string, number]>;

function splitWeaponSkin(weaponName?: string, skinName?: string): { weapon?: string; skin?: string } {
  if (weaponName && weaponName.includes('|') && !skinName) {
    const parts = weaponName.split('|');
    return { weapon: parts[0].trim(), skin: parts[1].trim() };
  }
  return { weapon: weaponName, skin: skinName };
}

function lookupPaintkitWrap(weaponName?: string, skinName?: string): [string, number] | undefined {
  const { weapon, skin } = splitWeaponSkin(weaponName, skinName);
  const wKey = normalizeWeaponKey(weapon).replace(/[\s\-_]/g, '');
  const sKey = normalizeSkinKey(skin);
  return wKey && sKey ? PAINTKIT_WRAPS[`${wKey}_${sKey}`] : undefined;
}

/** Which mesh family a skin's wrap was authored for, if known */
export function getSkinMeshFamily(weaponName?: string, skinName?: string): 'legacy' | 'cs2' | undefined {
  const entry = lookupPaintkitWrap(weaponName, skinName);
  return entry ? (entry[1] ? 'legacy' : 'cs2') : undefined;
}

/**
 * Automatically resolves the texture URL for a given weapon and skin.
 * Checks authoritative R2 skin catalog first, then falls back to public /textures/ path,
 * and finally to the official weapon UV sheet so weapon geometry is textured with authentic UV mapping.
 */
export function resolveSkinTextureUrl(weaponName?: string, skinName?: string): string | undefined {
  if (!weaponName && !skinName) return undefined;

  let effectiveWeapon = weaponName;
  let effectiveSkin = skinName;

  if (weaponName && weaponName.includes('|') && !skinName) {
    const parts = weaponName.split('|');
    effectiveWeapon = parts[0].trim();
    effectiveSkin = parts[1].trim();
  }

  const wKey = normalizeWeaponKey(effectiveWeapon);
  const sKey = normalizeSkinKey(effectiveSkin);

  if (wKey && sKey) {
    // Lookup key e.g. "ak47_asiimov", "m4a1s_decimator"
    const lookupKey = `${wKey.replace(/[\s\-_]/g, '')}_${sKey}`;
    if (R2_KNOWN_COLOR_WRAPS[lookupKey]) {
      return R2_KNOWN_COLOR_WRAPS[lookupKey];
    }

    const manifestEntry = PAINTKIT_WRAPS[lookupKey];
    if (manifestEntry) {
      return `${R2_BASE_URL}${manifestEntry[0]}`;
    }

    // Fallback to local static /textures/ format
    const localUrl = `/textures/${wKey}_${sKey}.png`;
    if (isColorWrapUrl(localUrl)) {
      return localUrl;
    }
  }

  // No skin wrap known: caller renders neutral gunmetal (UV sheets are wireframe guides, not skins)
  return undefined;
}

/** Approximate flat finish for skins with no hosted wrap */
export interface SkinFinish {
  color: number;
  metalness: number;
  roughness: number;
}

/**
 * Approximate base finishes for skins whose wraps are not hosted on R2 (their albedo textures ship in
 * newer game paintkits, or they are procedural solid/anodized finishes). Colours are the dominant hue of
 * each skin's Steam artwork, so these are approximations, not the real pattern.
 * Keys follow the "<weapon>_<skin>" format used by R2_KNOWN_COLOR_WRAPS.
 */
export const SKIN_FINISH_FALLBACKS: Record<string, SkinFinish> = {
  mac10_candy_apple: { color: 0xc81e1e, metalness: 0.15, roughness: 0.4 },
  zeusx27_electric_blue: { color: 0x1747c9, metalness: 0.1, roughness: 0.35 },
  usps_royal_guard: { color: 0x1f3f7a, metalness: 0.35, roughness: 0.4 },
  m4a1s_liquidation: { color: 0x2f4f9e, metalness: 0.35, roughness: 0.4 },
  galilar_control: { color: 0xcfc7ad, metalness: 0.2, roughness: 0.5 },
  ssg08_rapid_transit: { color: 0xd7dadf, metalness: 0.2, roughness: 0.45 },
  glock18_catacombs: { color: 0x5b5e5a, metalness: 0.3, roughness: 0.5 },
  mag7_irradiated_alert: { color: 0x6b4a2e, metalness: 0.2, roughness: 0.6 },
};

/** Looks up the approximate finish for a weapon/skin pair, if one is defined */
export function resolveSkinFinish(weaponName?: string, skinName?: string): SkinFinish | undefined {
  let effectiveWeapon = weaponName;
  let effectiveSkin = skinName;
  if (weaponName && weaponName.includes('|') && !skinName) {
    const parts = weaponName.split('|');
    effectiveWeapon = parts[0].trim();
    effectiveSkin = parts[1].trim();
  }
  const wKey = normalizeWeaponKey(effectiveWeapon).replace(/[\s\-_]/g, '');
  const sKey = normalizeSkinKey(effectiveSkin);
  return wKey && sKey ? SKIN_FINISH_FALLBACKS[`${wKey}_${sKey}`] : undefined;
}
