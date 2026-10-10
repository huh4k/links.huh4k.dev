/**
 * CSFloat inventory source.
 *
 * Calls CSFloat's "my inventory" endpoint with the owner's API key
 * (csfloat.com/profile -> Developers). CSFloat serves the data from its own infrastructure, so it keeps
 * working when Steam rate-limits requests from shared Cloudflare IPs, and it includes float/seed.
 *
 * The response shape is mapped defensively (several field spellings, array or wrapped list) because it
 * is not covered by a stable public schema. Anything that cannot be mapped is skipped, never thrown.
 */
import type { EnrichedInventoryItem } from '../types/inventory';

export const CSFLOAT_INVENTORY_URL = 'https://csfloat.com/api/v1/me/inventory';
const STEAM_ECON_CDN = 'https://community.cloudflare.steamstatic.com/economy/image/';

/** Valve rarity ids (CSFloat uses the same numbers) -> label + colour */
const RARITY_BY_ID: Record<number, { rarity: string; color: string }> = {
  1: { rarity: 'Consumer Grade', color: '#b0c3d9' },
  2: { rarity: 'Industrial Grade', color: '#5e98d9' },
  3: { rarity: 'Mil-Spec', color: '#4b69ff' },
  4: { rarity: 'Restricted', color: '#8847ff' },
  5: { rarity: 'Classified', color: '#d32ce6' },
  6: { rarity: 'Covert', color: '#eb4b4b' },
  7: { rarity: 'Contraband', color: '#e4ae39' },
};

type Json = Record<string, unknown>;

const WEAPON_TYPES: Array<[RegExp, string]> = [
  [/^(?:★\s*)?(?:stattrak™\s*|souvenir\s*)?(?:.*(?:knife|karambit|bayonet|daggers|butterfly|flip|gut|huntsman|falchion|bowie|navaja|stiletto|talon|ursus|paracord|survival|skeleton|nomad|classic))/i, 'Knife'],
  [/gloves|hand wraps/i, 'Gloves'],
  [/\b(awp|ssg 08|scar-20|g3sg1)\b/i, 'Sniper Rifle'],
  [/\b(ak-47|m4a4|m4a1-s|galil ar|famas|aug|sg 553)\b/i, 'Rifle'],
  [/\b(glock-18|usp-s|p2000|p250|five-seven|tec-9|cz75-auto|desert eagle|dual berettas|r8 revolver)\b/i, 'Pistol'],
  [/\b(mac-10|mp9|mp7|mp5-sd|ump-45|p90|pp-bizon)\b/i, 'SMG'],
  [/\b(nova|xm1014|sawed-off|mag-7)\b/i, 'Shotgun'],
  [/\b(negev|m249)\b/i, 'Machinegun'],
  [/\b(zeus x27)\b/i, 'Equipment'],
];

export function inferItemType(name: string): string {
  for (const [re, type] of WEAPON_TYPES) if (re.test(name)) return type;
  return 'Collectible';
}

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Extracts the item list from an array or a wrapped response ({ inventory | items | data | results }) */
export function extractCSFloatItems(body: unknown): Json[] {
  if (Array.isArray(body)) return body as Json[];
  if (body && typeof body === 'object') {
    for (const key of ['inventory', 'items', 'data', 'results']) {
      const v = (body as Json)[key];
      if (Array.isArray(v)) return v as Json[];
    }
  }
  return [];
}

/** Maps one CSFloat inventory entry to the site's item shape; null if it has no usable id or name */
export function mapCSFloatItem(raw: Json, steamId64?: string): EnrichedInventoryItem | null {
  const id = str(raw.asset_id ?? raw.assetid ?? raw.assetId ?? raw.id);
  let name = str(raw.market_hash_name ?? raw.item_name ?? raw.name);
  if (!id || !name) return null;

  if (raw.is_stattrak && !/stattrak/i.test(name)) name = name.startsWith('★') ? name.replace('★', '★ StatTrak™') : `StatTrak™ ${name}`;
  if (raw.is_souvenir && !/souvenir/i.test(name)) name = `Souvenir ${name}`;

  const rarityId = num(raw.rarity);
  const rarityInfo = rarityId !== null ? RARITY_BY_ID[rarityId] : undefined;
  const isKnifeOrGlove = name.startsWith('★');

  const icon = str(raw.icon_url ?? raw.image ?? raw.icon);
  const iconUrl = icon ? (icon.startsWith('http') ? icon : `${STEAM_ECON_CDN}${icon}`) : '';

  let inspectUrl: string | null = str(raw.inspect_link ?? raw.inspectLink) || null;
  const dParam = str(raw.d_param ?? raw.dParam);
  if (!inspectUrl && dParam && steamId64) {
    inspectUrl = `steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S${steamId64}A${id}D${dParam}`;
  }

  return {
    id,
    name,
    iconUrl,
    inspectUrl,
    float: num(raw.float_value ?? raw.floatvalue ?? raw.floatValue),
    seed: num(raw.paint_seed ?? raw.paintseed ?? raw.paintSeed),
    rarity: isKnifeOrGlove ? 'Extraordinary' : (rarityInfo?.rarity ?? 'Base Grade'),
    rarityColor: isKnifeOrGlove ? '#ffd700' : (rarityInfo?.color ?? '#b0c3d9'),
    type: inferItemType(name),
  };
}

export interface CSFloatInventoryResult {
  items: EnrichedInventoryItem[];
  /** Set when the call failed or returned nothing usable */
  error?: string;
}

/** Fetches the key owner's inventory from CSFloat. Never throws. */
export async function fetchCSFloatInventory(apiKey: string, steamId64?: string): Promise<CSFloatInventoryResult> {
  if (!apiKey) return { items: [], error: 'No CSFloat API key configured' };
  try {
    const res = await fetch(CSFLOAT_INVENTORY_URL, {
      headers: { Authorization: apiKey, Accept: 'application/json', 'User-Agent': 'huh4k-links/1.0.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 401 || res.status === 403) return { items: [], error: `CSFloat rejected the API key (${res.status})` };
    if (res.status === 429) return { items: [], error: 'CSFloat rate limit hit (429)' };
    if (!res.ok) return { items: [], error: `CSFloat request failed (${res.status})` };

    const items: EnrichedInventoryItem[] = [];
    for (const raw of extractCSFloatItems(await res.json())) {
      const mapped = mapCSFloatItem(raw, steamId64);
      if (mapped) items.push(mapped);
    }
    return items.length > 0 ? { items } : { items: [], error: 'CSFloat returned no usable items' };
  } catch (error) {
    return { items: [], error: `CSFloat request error: ${error instanceof Error ? error.message : String(error)}` };
  }
}
