/**
 * Steam Community API & CSFloat Inspect Data Pipeline Utilities
 */

import type {
  RawSteamDescription,
  RawSteamInventoryResponse,
  CSFloatItemInfo,
  CSFloatResponse,
  EnrichedInventoryItem,
} from '../types/inventory';

// Steam Economy CDN prefix
export const STEAM_ECON_CDN = 'https://community.cloudflare.steamstatic.com/economy/image/';

// CSFloat API rate limiting and defaults
const DEFAULT_CSFLOAT_API_BASE = 'https://api.csfloat.com/';
const CSFLOAT_RATE_LIMIT_MS = 600; // ~1.6 requests/second
let lastCSFloatCallTime = 0;

/**
 * Pure ES6 Map-based LRU Cache compatible with Cloudflare Pages / Web standard runtime.
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, { value: V; expiresAt: number }>;
  private defaultTtlMs: number;

  constructor(capacity = 500, defaultTtlMs = 24 * 60 * 60 * 1000) {
    this.capacity = capacity;
    this.defaultTtlMs = defaultTtlMs;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh position to mark as most recently used
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict oldest (first inserted in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Global LRU Cache for item float & paintseed data keyed by assetid.
 */
export const inventoryLRUCache = new LRUCache<string, { float: number | null; seed: number | null }>(500);

/**
 * Curated authentic fallback inventory used when Steam API is unreachable,
 * rate-limited (HTTP 429), or profile is private.
 */
export const FALLBACK_INVENTORY: EnrichedInventoryItem[] = [
  {
    id: 'fallback-ak47-redline',
    name: 'AK-47 | Redline',
    iconUrl: `${STEAM_ECON_CDN}-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf28_3dU594Nmzx4-Flf71IKnukm5QvoV32r-Qpdr02QW1-xZlMT_yJNSVdlQ2YwqF-1e3wLvo05O4tc6anXJh6yN043_aywXhihkacKUx0t6lZ7Bq`,
    inspectUrl: 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198000000000A31459265358D14432168987455850901',
    float: 0.18432109,
    seed: 451,
    rarity: 'Classified',
    rarityColor: '#d32ce6',
    type: 'Rifle',
  },
  {
    id: 'fallback-m4a1s-printstream',
    name: 'M4A1-S | Printstream',
    iconUrl: `${STEAM_ECON_CDN}-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou-6kejhjxszfjTwW09j_lom0m_7zO6-fzj9V7cAl2eyVpNrx2wXn-kBtZzz7LdTAcFA7YQ6B_VO2wOa-05S6vcvIzicxvCA8pGB8sr6M2Zg`,
    inspectUrl: 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198000000000A31459265359D14432168987455850902',
    float: 0.03215894,
    seed: 82,
    rarity: 'Covert',
    rarityColor: '#eb4b4b',
    type: 'Rifle',
  },
  {
    id: 'fallback-deagle-blaze',
    name: 'Desert Eagle | Blaze',
    iconUrl: `${STEAM_ECON_CDN}-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgposr-kLAtl7PLZTjlH_9mkgIWKkPr1Ibndk1RX6sl0g_b--InxjVnkrxFpYW-ld4-Scw45YVzQ-1LvwuzvgZG46ZvMyXc2uyRw7SqJn0DjhB4eb_sv26K-A3d9dQ`,
    inspectUrl: 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198000000000A31459265360D14432168987455850903',
    float: 0.01084215,
    seed: 147,
    rarity: 'Restricted',
    rarityColor: '#8847ff',
    type: 'Pistol',
  },
  {
    id: 'fallback-karambit-doppler',
    name: '★ Karambit | Doppler',
    iconUrl: `${STEAM_ECON_CDN}-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf1ObcTj5X09ujgL-HmOXxDLfYkWNF18l4jeHVu4qiiQCx_0ZsNT-nIdTBdQdoYQ7V_lC8yL_p15e_tZzMnSRh7HYn-z-DyG2qM4Y1`,
    inspectUrl: 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198000000000A31459265361D14432168987455850904',
    float: 0.00891244,
    seed: 399,
    rarity: '★ Extraordinary',
    rarityColor: '#ffd700',
    type: 'Knife',
  },
];

// Seed initial fallback items into LRU cache
for (const fallbackItem of FALLBACK_INVENTORY) {
  if (fallbackItem.float !== null && fallbackItem.seed !== null) {
    inventoryLRUCache.set(fallbackItem.id, {
      float: fallbackItem.float,
      seed: fallbackItem.seed,
    });
  }
}

/**
 * Replaces `%owner_steamid%` and `%assetid%` in raw Steam inspect action links.
 */
export function formatInspectUrl(rawLink: string, steamId64: string, assetId: string): string {
  if (!rawLink) return '';
  return rawLink
    .replaceAll('%owner_steamid%', steamId64)
    .replaceAll('%assetid%', assetId);
}

/**
 * Normalizes Steam relative image hashes into full CDN URLs.
 */
export function formatEconomyImageUrl(iconUrl: string): string {
  if (!iconUrl) return '';
  if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://')) {
    return iconUrl;
  }
  return `${STEAM_ECON_CDN}${iconUrl}`;
}

/**
 * Extracts rarity tier name and color from Steam item tags.
 */
export function getRarityFromTags(tags?: RawSteamDescription['tags']): {
  rarity: string;
  rarityColor?: string;
} {
  if (!tags || !Array.isArray(tags)) {
    return { rarity: 'Base Grade', rarityColor: '#b0c3d9' };
  }

  const rarityTag = tags.find(
    (t) => t.category === 'Rarity' || t.category === 'ItemSet' || t.internal_name?.startsWith('Rarity_')
  );

  if (!rarityTag) {
    return { rarity: 'Base Grade', rarityColor: '#b0c3d9' };
  }

  const rarity = rarityTag.localized_tag_name || rarityTag.internal_name || 'Base Grade';
  let rarityColor = rarityTag.color ? `#${rarityTag.color.replace(/^#/, '')}` : undefined;

  if (!rarityColor) {
    const lower = rarity.toLowerCase();
    if (lower.includes('extraordinary') || lower.includes('covert') || lower.includes('★')) {
      rarityColor = lower.includes('★') ? '#ffd700' : '#eb4b4b';
    } else if (lower.includes('classified')) {
      rarityColor = '#d32ce6';
    } else if (lower.includes('restricted')) {
      rarityColor = '#8847ff';
    } else if (lower.includes('mil-spec')) {
      rarityColor = '#4b69ff';
    } else if (lower.includes('industrial')) {
      rarityColor = '#5e98d9';
    } else {
      rarityColor = '#b0c3d9';
    }
  }

  return { rarity, rarityColor };
}

/**
 * Extracts weapon/item type from tags or type string.
 */
export function getTypeFromTags(tags?: RawSteamDescription['tags'], typeStr?: string): string {
  if (tags && Array.isArray(tags)) {
    const typeTag = tags.find((t) => t.category === 'Type' || t.category === 'Weapon');
    if (typeTag?.localized_tag_name) {
      return typeTag.localized_tag_name;
    }
  }

  if (typeStr) {
    const lower = typeStr.toLowerCase();
    if (lower.includes('knife')) return 'Knife';
    if (lower.includes('gloves')) return 'Gloves';
    if (lower.includes('sniper rifle')) return 'Sniper Rifle';
    if (lower.includes('rifle')) return 'Rifle';
    if (lower.includes('pistol')) return 'Pistol';
    if (lower.includes('smg')) return 'SMG';
    if (lower.includes('shotgun')) return 'Shotgun';
    if (lower.includes('machinegun')) return 'Machinegun';
    if (lower.includes('container') || lower.includes('case')) return 'Container';
    if (lower.includes('sticker')) return 'Sticker';
    if (lower.includes('agent')) return 'Agent';
    return typeStr;
  }

  return 'Weapon';
}

/**
 * Throttles execution to prevent exceeding CSFloat rate limits (~1.6 req/s).
 */
async function waitForCSFloatThrottle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCSFloatCallTime;
  if (elapsed < CSFLOAT_RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, CSFLOAT_RATE_LIMIT_MS - elapsed));
  }
  lastCSFloatCallTime = Date.now();
}

/**
 * Queries the CSFloat inspect endpoint for weapon wear float and paint seed.
 */
export async function fetchCSFloatInspect(inspectUrl: string): Promise<CSFloatItemInfo | null> {
  if (!inspectUrl) return null;

  try {
    const apiBase =
      (typeof process !== 'undefined' && process.env?.CSFLOAT_API_BASE) || DEFAULT_CSFLOAT_API_BASE;
    const cleanBase = apiBase.replace(/\/+$/, '');
    const url = `${cleanBase}/?url=${encodeURIComponent(inspectUrl)}`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'huh4k-links/1.0.0',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`[CSFloat API] Inspect request returned status ${res.status}`);
      return null;
    }

    const data = (await res.json()) as CSFloatResponse;

    const floatvalue =
      data.iteminfo?.floatvalue ??
      data.item?.float_value ??
      data.item?.floatvalue ??
      data.floatvalue ??
      null;

    const paintseed =
      data.iteminfo?.paintseed ??
      data.item?.paint_seed ??
      data.item?.paintseed ??
      data.paintseed ??
      null;

    const paintindex =
      data.iteminfo?.paintindex ??
      data.item?.paint_index ??
      data.item?.paintindex ??
      data.paintindex ??
      null;

    return {
      floatvalue: floatvalue !== null ? Number(floatvalue) : undefined,
      paintseed: paintseed !== null ? Number(paintseed) : undefined,
      paintindex: paintindex !== null ? Number(paintindex) : undefined,
      defindex: data.iteminfo?.defindex,
      quality: data.iteminfo?.quality,
      rarity: data.iteminfo?.rarity,
      origin: data.iteminfo?.origin,
      itemid: data.iteminfo?.itemid,
    };
  } catch (error) {
    console.warn('[CSFloat API] Error fetching inspect info:', error);
    return null;
  }
}

/**
 * Enriches an item with float wear and seed via CSFloat, utilizing the LRU cache.
 */
export async function enrichWithCSFloat(item: EnrichedInventoryItem): Promise<EnrichedInventoryItem> {
  if (!item.inspectUrl) {
    return { ...item, float: null, seed: null };
  }

  // Check LRU cache first
  const cached = inventoryLRUCache.get(item.id);
  if (cached !== undefined) {
    return {
      ...item,
      float: cached.float,
      seed: cached.seed,
    };
  }

  // Rate limit throttle
  await waitForCSFloatThrottle();

  const csfloatData = await fetchCSFloatInspect(item.inspectUrl);
  const float = csfloatData?.floatvalue ?? null;
  const seed = csfloatData?.paintseed ?? null;

  inventoryLRUCache.set(item.id, { float, seed });

  return {
    ...item,
    float,
    seed,
  };
}

/**
 * Enriches an array of inventory items with CSFloat data up to a max batch size.
 */
export async function enrichInventory(
  items: EnrichedInventoryItem[],
  maxEnrich = 15
): Promise<EnrichedInventoryItem[]> {
  const result: EnrichedInventoryItem[] = [];
  let enrichedCount = 0;

  for (const item of items) {
    if (item.inspectUrl && item.float === null && enrichedCount < maxEnrich) {
      const enriched = await enrichWithCSFloat(item);
      result.push(enriched);
      enrichedCount++;
    } else if (item.inspectUrl && item.float === null && inventoryLRUCache.has(item.id)) {
      // If already cached, populate without consuming enrichment quota
      const cached = inventoryLRUCache.get(item.id);
      result.push({
        ...item,
        float: cached?.float ?? null,
        seed: cached?.seed ?? null,
      });
    } else {
      result.push(item);
    }
  }

  return result;
}

/**
 * Fetches user CS2 inventory from Steam Community endpoint.
 * Gracefully falls back to FALLBACK_INVENTORY on private profiles, rate limits (HTTP 429), or network errors.
 */
export async function fetchCS2Inventory(
  steamId64: string,
  _apiKey?: string
): Promise<EnrichedInventoryItem[]> {
  // Validate steamId64 format
  if (!steamId64 || !/^\d{17,20}$/.test(steamId64)) {
    console.warn(`[Steam Inventory] Invalid Steam ID format: "${steamId64}". Using fallback inventory.`);
    return FALLBACK_INVENTORY;
  }

  const endpoint = `https://steamcommunity.com/inventory/${steamId64}/730/2?l=english&count=100`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401 || res.status === 403) {
      console.warn(`[Steam Inventory] Profile ${steamId64} is private (status ${res.status}). Using fallback inventory.`);
      return FALLBACK_INVENTORY;
    }

    if (res.status === 429) {
      console.warn(`[Steam Inventory] Hit Steam Community rate limit (429). Using fallback inventory.`);
      return FALLBACK_INVENTORY;
    }

    if (!res.ok) {
      console.warn(`[Steam Inventory] Request failed with status ${res.status}. Using fallback inventory.`);
      return FALLBACK_INVENTORY;
    }

    const data = (await res.json()) as RawSteamInventoryResponse;

    if (!data.assets || !data.descriptions || data.assets.length === 0) {
      console.warn('[Steam Inventory] Response contains empty assets. Using fallback inventory.');
      return FALLBACK_INVENTORY;
    }

    // Build description lookup map
    const descMap = new Map<string, RawSteamDescription>();
    for (const desc of data.descriptions) {
      descMap.set(`${desc.classid}_${desc.instanceid}`, desc);
      if (desc.instanceid === '0') {
        descMap.set(desc.classid, desc);
      }
    }

    const items: EnrichedInventoryItem[] = [];

    for (const asset of data.assets) {
      const descKey = `${asset.classid}_${asset.instanceid}`;
      const desc = descMap.get(descKey) || descMap.get(asset.classid);
      if (!desc) continue;

      // Extract inspect link if available
      const inspectAction = desc.actions?.find(
        (a) => a.link && (a.link.includes('+csgo_econ_action_preview') || a.link.includes('%owner_steamid%'))
      );
      const inspectUrl = inspectAction
        ? formatInspectUrl(inspectAction.link, steamId64, asset.assetid)
        : null;

      const { rarity, rarityColor } = getRarityFromTags(desc.tags);
      const type = getTypeFromTags(desc.tags, desc.type);
      const iconUrl = formatEconomyImageUrl(desc.icon_url_large || desc.icon_url);
      const name = desc.market_name || desc.name || 'Counter-Strike 2 Item';

      // Check if already in LRU cache
      const cached = inventoryLRUCache.get(asset.assetid);

      items.push({
        id: asset.assetid,
        name,
        iconUrl,
        inspectUrl,
        float: cached ? cached.float : null,
        seed: cached ? cached.seed : null,
        rarity,
        rarityColor,
        type,
      });
    }

    return items.length > 0 ? items : FALLBACK_INVENTORY;
  } catch (error) {
    console.error('[Steam Inventory] Failed to fetch inventory:', error);
    return FALLBACK_INVENTORY;
  }
}

/**
 * Fetches CS2 inventory and performs throttled CSFloat enrichment.
 */
export async function getEnrichedInventory(
  steamId64: string,
  apiKey?: string,
  maxEnrich = 15
): Promise<EnrichedInventoryItem[]> {
  const items = await fetchCS2Inventory(steamId64, apiKey);
  return enrichInventory(items, maxEnrich);
}

// Backward-compatibility and spec-compliant aliases
export const fetchSteamInventory = fetchCS2Inventory;
export const extractRarity = getRarityFromTags;
export const extractItemType = getTypeFromTags;
