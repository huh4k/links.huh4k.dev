/**
 * CS2 Weapon 3D Model Mapping Utility
 *
 * Maps official CS2 weapon names, skin names, StatTrak™, Souvenir,
 * and knife variations to their corresponding static .obj or .glb model assets.
 */

export const DEFAULT_WEAPON_MODEL = '/models/placeholder-weapon.glb';

/**
 * Authoritative mapping dictionary from normalized weapon key to static model path.
 * Covers all 35 CS2 weapon models present in public/models/.
 */
export const WEAPON_MODEL_MAP: Record<string, string> = {
  // Rifles
  'ak-47': '/models/weapon_rif_ak47.obj',
  'ak47': '/models/weapon_rif_ak47.obj',
  'ak': '/models/weapon_rif_ak47.obj',
  'm4a1-s': '/models/weapon_rif_m4a1_silencer.obj',
  'm4a1_silencer': '/models/weapon_rif_m4a1_silencer.obj',
  'm4a1 silencer': '/models/weapon_rif_m4a1_silencer.obj',
  'm4a1': '/models/weapon_rif_m4a1_silencer.obj',
  'm4a4': '/models/weapon_rif_m4a4.obj',
  'galil ar': '/models/weapon_rif_galilar.obj',
  'galilar': '/models/weapon_rif_galilar.obj',
  'galil': '/models/weapon_rif_galilar.obj',
  'famas': '/models/weapon_rif_famas.obj',
  'aug': '/models/weapon_rif_aug.obj',
  'sg 553': '/models/weapon_rif_sg556.obj',
  'sg553': '/models/weapon_rif_sg556.obj',
  'sg 556': '/models/weapon_rif_sg556.obj',
  'sg556': '/models/weapon_rif_sg556.obj',

  // Sniper Rifles
  'awp': '/models/weapon_snip_awp.obj',
  'ssg 08': '/models/weapon_snip_ssg08.obj',
  'ssg08': '/models/weapon_snip_ssg08.obj',
  'scout': '/models/weapon_snip_ssg08.obj',
  'g3sg1': '/models/weapon_snip_g3sg1.obj',
  'scar-20': '/models/weapon_snip_scar20.obj',
  'scar20': '/models/weapon_snip_scar20.obj',

  // Pistols & Sidearms
  'usp-s': '/models/weapon_pist_usp_silencer.obj',
  'usp_silencer': '/models/weapon_pist_usp_silencer.obj',
  'usp silencer': '/models/weapon_pist_usp_silencer.obj',
  'usp': '/models/weapon_pist_usp_silencer.obj',
  'glock-18': '/models/weapon_pist_glock18.obj',
  'glock 18': '/models/weapon_pist_glock18.obj',
  'glock18': '/models/weapon_pist_glock18.obj',
  'glock': '/models/weapon_pist_glock18.obj',
  'desert eagle': '/models/weapon_pist_deagle.obj',
  'deagle': '/models/weapon_pist_deagle.obj',
  'p250': '/models/weapon_pist_p250.obj',
  'p2000': '/models/weapon_pist_hkp2000.obj',
  'hkp2000': '/models/weapon_pist_hkp2000.obj',
  'five-seven': '/models/weapon_pist_fiveseven.obj',
  'fiveseven': '/models/weapon_pist_fiveseven.obj',
  'five seven': '/models/weapon_pist_fiveseven.obj',
  'cz75-auto': '/models/weapon_pist_cz75a.obj',
  'cz75a': '/models/weapon_pist_cz75a.obj',
  'cz75 auto': '/models/weapon_pist_cz75a.obj',
  'cz75': '/models/weapon_pist_cz75a.obj',
  'tec-9': '/models/weapon_pist_tec9.obj',
  'tec9': '/models/weapon_pist_tec9.obj',
  'tec 9': '/models/weapon_pist_tec9.obj',
  'dual berettas': '/models/weapon_pist_elite.obj',
  'dualies': '/models/weapon_pist_elite.obj',
  'dual beretta': '/models/weapon_pist_elite.obj',
  'elite': '/models/weapon_pist_elite.obj',
  'r8 revolver': '/models/weapon_pist_revolver.obj',
  'revolver': '/models/weapon_pist_revolver.obj',
  'r8': '/models/weapon_pist_revolver.obj',
  'zeus x27': '/models/weapon_pist_taser.obj',
  'zeus': '/models/weapon_pist_taser.obj',
  'taser': '/models/weapon_pist_taser.obj',

  // Submachine Guns (SMGs)
  'mac-10': '/models/weapon_smg_mac10.obj',
  'mac10': '/models/weapon_smg_mac10.obj',
  'mac 10': '/models/weapon_smg_mac10.obj',
  'mp9': '/models/weapon_smg_mp9.obj',
  'mp7': '/models/weapon_smg_mp7.obj',
  'mp5-sd': '/models/weapon_smg_mp5sd.obj',
  'mp5sd': '/models/weapon_smg_mp5sd.obj',
  'mp5 sd': '/models/weapon_smg_mp5sd.obj',
  'mp5': '/models/weapon_smg_mp5sd.obj',
  'ump-45': '/models/weapon_smg_ump45.obj',
  'ump45': '/models/weapon_smg_ump45.obj',
  'ump 45': '/models/weapon_smg_ump45.obj',
  'p90': '/models/weapon_smg_p90.obj',
  'pp-bizon': '/models/weapon_smg_bizon.obj',
  'ppbizon': '/models/weapon_smg_bizon.obj',
  'pp bizon': '/models/weapon_smg_bizon.obj',
  'bizon': '/models/weapon_smg_bizon.obj',

  // Shotguns
  'nova': '/models/weapon_shot_nova.obj',
  'xm1014': '/models/weapon_shot_xm1014.obj',
  'mag-7': '/models/weapon_shot_mag7.obj',
  'mag7': '/models/weapon_shot_mag7.obj',
  'mag 7': '/models/weapon_shot_mag7.obj',
  'sawed-off': '/models/weapon_shot_sawedoff.obj',
  'sawedoff': '/models/weapon_shot_sawedoff.obj',
  'sawed off': '/models/weapon_shot_sawedoff.obj',

  // Machine Guns / Heavy
  'm249': '/models/weapon_mach_m249.obj',
  'negev': '/models/weapon_mach_negev.obj',
};

/**
 * List of weapon keys sorted by length descending to prioritize
 * specific matches (e.g. 'm4a1-s' over 'm4a1', 'cz75-auto' over 'cz75').
 */
const SORTED_KEYS = Object.keys(WEAPON_MODEL_MAP).sort((a, b) => b.length - a.length);

/**
 * Resolves a CS2 weapon or skin market name to its static 3D model asset path.
 *
 * @param weaponName Full skin name or weapon identifier
 *   (e.g., "StatTrak™ M4A1-S | Liquidation (Field-Tested)", "AK-47", "★ Karambit | Doppler")
 * @returns Path to the .obj or .glb asset (defaulting to /models/placeholder-weapon.glb)
 */
export function getWeaponModelPath(weaponName?: string): string {
  if (!weaponName || typeof weaponName !== 'string') {
    return DEFAULT_WEAPON_MODEL;
  }

  // 1. Sanitize prefixes: remove star symbol, StatTrak™, Souvenir
  let clean = weaponName.trim();
  clean = clean.replace(/^[★\s]+/, '');
  clean = clean.replace(/^StatTrak™\s+/i, '');
  clean = clean.replace(/^Souvenir\s+/i, '');

  // 2. Strip skin pattern name after pipe delimiter (e.g. "AK-47 | Ice Coaled" -> "AK-47")
  if (clean.includes('|')) {
    clean = clean.split('|')[0].trim();
  }

  // 3. Strip wear rating in parentheses if present (e.g. "(Field-Tested)")
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // 4. Exact direct match
  const lower = clean.toLowerCase();
  if (WEAPON_MODEL_MAP[lower]) {
    return WEAPON_MODEL_MAP[lower];
  }

  // 5. Normalized alphanumeric match (ignoring spaces, hyphens, underscores)
  const normalized = lower.replace(/[\s\-_]/g, '');
  for (const key of SORTED_KEYS) {
    if (key.replace(/[\s\-_]/g, '') === normalized) {
      return WEAPON_MODEL_MAP[key];
    }
  }

  // 6. Substring match against known keys (longest first)
  for (const key of SORTED_KEYS) {
    const keyNorm = key.replace(/[\s\-_]/g, '');
    if (normalized.includes(keyNorm) && keyNorm.length >= 3) {
      return WEAPON_MODEL_MAP[key];
    }
  }

  // 7. Knife / Melee detection: fallback to placeholder combat knife GLB
  if (
    lower.includes('knife') ||
    lower.includes('bayonet') ||
    lower.includes('karambit') ||
    lower.includes('daggers') ||
    lower.includes('kukri') ||
    lower.includes('stiletto') ||
    lower.includes('talon') ||
    lower.includes('ursus') ||
    lower.includes('navaja') ||
    lower.includes('skeleton') ||
    lower.includes('nomad') ||
    lower.includes('paracord') ||
    lower.includes('bowie') ||
    lower.includes('falchion') ||
    lower.includes('huntsman')
  ) {
    return DEFAULT_WEAPON_MODEL;
  }

  // 8. General fallback
  return DEFAULT_WEAPON_MODEL;
}

/**
 * Checks if a given model URL represents an OBJ mesh.
 */
export function isObjModelUrl(url?: string): boolean {
  if (!url) return false;
  return /\.obj(\?.*)?$/i.test(url);
}

/**
 * Authoritative mapping to official Valve Workshop CS:GO / CS2 Legacy UV OBJ models
 * with exact matching vt UV coordinates for authentic workshop finishes and UV sheets.
 */
export const CSGO_LEGACY_MODEL_MAP: Record<string, string> = {
  'ak-47': '/models/csgo_legacy/ak-47.obj',
  'ak47': '/models/csgo_legacy/ak-47.obj',
  'ak': '/models/csgo_legacy/ak-47.obj',
  'm4a1-s': '/models/csgo_legacy/m4a1_s.obj',
  'm4a1_silencer': '/models/csgo_legacy/m4a1_s.obj',
  'm4a1': '/models/csgo_legacy/m4a1_s.obj',
  'm4a4': '/models/csgo_legacy/m4a4.obj',
  'galil ar': '/models/csgo_legacy/galil_ar.obj',
  'galilar': '/models/csgo_legacy/galil_ar.obj',
  'galil': '/models/csgo_legacy/galil_ar.obj',
  'famas': '/models/csgo_legacy/famas.obj',
  'aug': '/models/csgo_legacy/aug.obj',
  'sg 553': '/models/csgo_legacy/sg_553.obj',
  'sg553': '/models/csgo_legacy/sg_553.obj',
  'sg 556': '/models/csgo_legacy/sg_553.obj',
  'sg556': '/models/csgo_legacy/sg_553.obj',
  'awp': '/models/csgo_legacy/awp.obj',
  'ssg 08': '/models/csgo_legacy/ssg_08.obj',
  'ssg08': '/models/csgo_legacy/ssg_08.obj',
  'scout': '/models/csgo_legacy/ssg_08.obj',
  'g3sg1': '/models/csgo_legacy/g3sg1.obj',
  'scar-20': '/models/csgo_legacy/scar-20.obj',
  'scar20': '/models/csgo_legacy/scar-20.obj',
  'usp-s': '/models/csgo_legacy/usp-s.obj',
  'usp_silencer': '/models/csgo_legacy/usp-s.obj',
  'usp': '/models/csgo_legacy/usp-s.obj',
  'glock-18': '/models/csgo_legacy/glock-18.obj',
  'glock 18': '/models/csgo_legacy/glock-18.obj',
  'glock18': '/models/csgo_legacy/glock-18.obj',
  'glock': '/models/csgo_legacy/glock-18.obj',
  'desert eagle': '/models/csgo_legacy/desert_eagle.obj',
  'deagle': '/models/csgo_legacy/desert_eagle.obj',
  'p250': '/models/csgo_legacy/p250.obj',
  'p2000': '/models/csgo_legacy/p2000.obj',
  'hkp2000': '/models/csgo_legacy/p2000.obj',
  'five-seven': '/models/csgo_legacy/five-seven.obj',
  'fiveseven': '/models/csgo_legacy/five-seven.obj',
  'cz75-auto': '/models/csgo_legacy/cz_75.obj',
  'cz75a': '/models/csgo_legacy/cz_75.obj',
  'cz75': '/models/csgo_legacy/cz_75.obj',
  'tec-9': '/models/csgo_legacy/tec-9.obj',
  'tec9': '/models/csgo_legacy/tec-9.obj',
  'dual berettas': '/models/csgo_legacy/dual_berettas.obj',
  'dualies': '/models/csgo_legacy/dual_berettas.obj',
  'r8 revolver': '/models/csgo_legacy/revolver.obj',
  'revolver': '/models/csgo_legacy/revolver.obj',
  'mac-10': '/models/csgo_legacy/mac-10.obj',
  'mac10': '/models/csgo_legacy/mac-10.obj',
  'mp9': '/models/csgo_legacy/mp9.obj',
  'mp7': '/models/csgo_legacy/mp7.obj',
  'mp5-sd': '/models/csgo_legacy/mp5sd.obj',
  'mp5sd': '/models/csgo_legacy/mp5sd.obj',
  'ump-45': '/models/csgo_legacy/ump-45.obj',
  'ump45': '/models/csgo_legacy/ump-45.obj',
  'p90': '/models/csgo_legacy/p90.obj',
  'pp-bizon': '/models/csgo_legacy/bizon.obj',
  'bizon': '/models/csgo_legacy/bizon.obj',
  'nova': '/models/csgo_legacy/nova.obj',
  'xm1014': '/models/csgo_legacy/xm1014.obj',
  'mag-7': '/models/csgo_legacy/mag-7.obj',
  'mag7': '/models/csgo_legacy/mag-7.obj',
  'sawed-off': '/models/csgo_legacy/sawed-off.obj',
  'sawedoff': '/models/csgo_legacy/sawed-off.obj',
  'm249': '/models/csgo_legacy/m249.obj',
  'negev': '/models/csgo_legacy/negev.obj',
};

/**
 * Resolves a CS2 weapon name to its legacy UV layout OBJ model asset path.
 */
export function getLegacyWeaponModelPath(weaponName?: string): string | undefined {
  if (!weaponName || typeof weaponName !== 'string') return undefined;

  let clean = weaponName.trim();
  clean = clean.replace(/^[★\s]+/, '');
  clean = clean.replace(/^StatTrak™\s+/i, '');
  clean = clean.replace(/^Souvenir\s+/i, '');
  if (clean.includes('|')) {
    clean = clean.split('|')[0].trim();
  }
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();

  if (CSGO_LEGACY_MODEL_MAP[clean]) {
    return CSGO_LEGACY_MODEL_MAP[clean];
  }

  const normalized = clean.replace(/[\s\-_]/g, '');
  for (const [key, path] of Object.entries(CSGO_LEGACY_MODEL_MAP)) {
    if (key.replace(/[\s\-_]/g, '') === normalized) {
      return path;
    }
  }

  return undefined;
}
