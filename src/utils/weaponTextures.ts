/**
 * Weapon Texture Resolver
 *
 * Resolves static skin texture PNG/WebP files from the public /textures/ directory
 * based on weaponName and skinName, adhering to the naming convention:
 * /textures/${weaponName.toLowerCase()}_${skinName.toLowerCase().replace(/\s+/g, '_')}.png
 */

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
 * Automatically resolves the texture URL for a given weapon and skin.
 * Returns the public path e.g. /textures/ak-47_ice_coaled.png
 */
export function resolveSkinTextureUrl(weaponName?: string, skinName?: string): string | undefined {
  if (!weaponName && !skinName) return undefined;
  
  // If weaponName contains a pipe, parse skinName out of it if not supplied
  let effectiveWeapon = weaponName;
  let effectiveSkin = skinName;
  
  if (weaponName && weaponName.includes('|') && !skinName) {
    const parts = weaponName.split('|');
    effectiveWeapon = parts[0].trim();
    effectiveSkin = parts[1].trim();
  }
  
  const wKey = normalizeWeaponKey(effectiveWeapon);
  const sKey = normalizeSkinKey(effectiveSkin);
  
  if (!wKey) return undefined;
  if (!sKey) return undefined;
  
  return `/textures/${wKey}_${sKey}.png`;
}
