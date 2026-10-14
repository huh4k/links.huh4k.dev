import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ModelViewer from '../ModelViewer';
import { getSkinCompatibleModelPath } from '../../utils/weaponModels';
import { resolveSkinTextureUrl } from '../../utils/weaponTextures';
import type { EnrichedInventoryItem } from '../../types/inventory';

export interface InventoryExplorerProps {
  /** Optional build-time snapshot shown immediately; the explorer always refreshes from the live API on mount */
  initialItems?: EnrichedInventoryItem[];
  /** When the snapshot was built (ISO) */
  snapshotAt?: string | null;
  /** Live inventory endpoint (default: /api/inventory.json) */
  apiUrl?: string;
  /** Auto-refresh interval while the tab is visible, in ms (default: 5 minutes; 0 disables) */
  refreshMs?: number;
}

export type InventoryStatus = 'loading' | 'snapshot' | 'live' | 'stale' | 'fallback' | 'error';

interface LiveInventoryState {
  items: EnrichedInventoryItem[];
  status: InventoryStatus;
  fetchedAt: string | null;
  note: string | null;
  provider: string | null;
  /** True once the first live refresh has finished (successfully or not) */
  checked: boolean;
  refreshing: boolean;
  refresh: () => void;
}

/**
 * Loads the inventory from the live API in the browser and keeps it fresh.
 * The API reports where the data came from (live / stale / fallback) in response headers.
 */
function useLiveInventory(
  initialItems: EnrichedInventoryItem[],
  snapshotAt: string | null,
  apiUrl: string,
  refreshMs: number
): LiveInventoryState {
  const [items, setItems] = useState<EnrichedInventoryItem[]>(initialItems);
  const [status, setStatus] = useState<InventoryStatus>(initialItems.length > 0 ? 'snapshot' : 'loading');
  const [fetchedAt, setFetchedAt] = useState<string | null>(initialItems.length > 0 ? snapshotAt : null);
  const [note, setNote] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as EnrichedInventoryItem[];
      if (!Array.isArray(data)) throw new Error('Unexpected response');
      const source = res.headers.get('X-Inventory-Source');
      if (source === 'fallback' && initialItems.length > 0) {
        // Never replace a real build-time snapshot with the hardcoded example list
        setNote(res.headers.get('X-Inventory-Note'));
        return;
      }
      setItems(data);
      setStatus(source === 'live' ? 'live' : source === 'stale' ? 'stale' : 'fallback');
      setFetchedAt(res.headers.get('X-Inventory-Fetched-At'));
      setNote(res.headers.get('X-Inventory-Note'));
      setProvider(res.headers.get('X-Inventory-Provider'));
    } catch (err) {
      // Keep whatever we already show (e.g. the build snapshot); only report an error if there is nothing
      setStatus((prev) => (prev === 'loading' ? 'error' : prev));
      setNote(err instanceof Error ? err.message : 'Request failed');
    } finally {
      inFlight.current = false;
      setChecked(true);
      setRefreshing(false);
    }
  }, [apiUrl, initialItems.length]);

  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, refreshMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, refreshMs]);

  return { items, status, fetchedAt, note, provider, checked, refreshing, refresh: () => void load() };
}

function formatAge(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export const CATEGORIES = [
  'All',
  'Rifles',
  'Pistols',
  'Snipers',
  'SMGs & Heavy',
  'Collectibles',
] as const;

export type InventoryCategory = (typeof CATEGORIES)[number];

export const DOCK_MODES = ['3d', '2d', 'inspect'] as const;
export type InspectDockMode = (typeof DOCK_MODES)[number];

/**
 * Resolves wear tier classification and abbreviation from float wear rating.
 */
export function getWearTier(float: number | null): { name: string; tag: string; color: string } | null {
  if (float === null || float === undefined || Number.isNaN(float)) return null;
  if (float < 0.07) return { name: 'Factory New', tag: 'FN', color: '#10b981' };
  if (float < 0.15) return { name: 'Minimal Wear', tag: 'MW', color: '#38bdf8' };
  if (float < 0.38) return { name: 'Field-Tested', tag: 'FT', color: '#eab308' };
  if (float < 0.45) return { name: 'Well-Worn', tag: 'WW', color: '#f97316' };
  return { name: 'Battle-Scarred', tag: 'BS', color: '#ef4444' };
}

/**
 * Matches an item against the chosen category filter taxonomy.
 */
export function matchesCategory(item: EnrichedInventoryItem, category: InventoryCategory): boolean {
  if (category === 'All') return true;
  const type = (item.type || '').toLowerCase();
  const name = (item.name || '').toLowerCase();

  switch (category) {
    case 'Rifles':
      return (
        type === 'rifle' ||
        name.includes('ak-47') ||
        name.includes('m4a1-s') ||
        name.includes('m4a4') ||
        name.includes('galil') ||
        name.includes('famas') ||
        name.includes('aug') ||
        name.includes('sg 553') ||
        name.includes('sg 556')
      );
    case 'Pistols':
      return (
        type === 'pistol' ||
        name.includes('usp-s') ||
        name.includes('glock') ||
        name.includes('desert eagle') ||
        name.includes('deagle') ||
        name.includes('cz75') ||
        name.includes('p250') ||
        name.includes('five-seven') ||
        name.includes('tec-9') ||
        name.includes('p2000') ||
        name.includes('dual berettas') ||
        name.includes('revolver')
      );
    case 'Snipers':
      return (
        type === 'sniper rifle' ||
        type === 'sniper' ||
        name.includes('awp') ||
        name.includes('ssg 08') ||
        name.includes('scar-20') ||
        name.includes('g3sg1')
      );
    case 'SMGs & Heavy':
      return (
        type === 'smg' ||
        type === 'shotgun' ||
        type === 'machinegun' ||
        type === 'equipment' ||
        name.includes('ump-45') ||
        name.includes('mac-10') ||
        name.includes('mp9') ||
        name.includes('mp7') ||
        name.includes('mp5') ||
        name.includes('p90') ||
        name.includes('bizon') ||
        name.includes('mag-7') ||
        name.includes('nova') ||
        name.includes('sawed-off') ||
        name.includes('xm1014') ||
        name.includes('m249') ||
        name.includes('negev') ||
        name.includes('zeus')
      );
    case 'Collectibles':
      return (
        type === 'collectible' ||
        type === 'graffiti' ||
        type === 'music kit' ||
        type === 'tool' ||
        type === 'container' ||
        type === 'sticker' ||
        name.includes('medal') ||
        name.includes('coin') ||
        name.includes('badge') ||
        name.includes('graffiti') ||
        name.includes('music kit') ||
        name.includes('detachment pack')
      );
    default:
      return true;
  }
}

/**
 * Matches an item against the client-side search query case-insensitively.
 */
export function matchesSearch(item: EnrichedInventoryItem, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  const name = (item.name || '').toLowerCase();
  const rarity = (item.rarity || '').toLowerCase();
  const type = (item.type || '').toLowerCase();
  const seed = item.seed !== null && item.seed !== undefined ? String(item.seed) : '';
  const floatStr = item.float !== null && item.float !== undefined ? item.float.toFixed(4) : '';
  const cert = (item.certificate || '').toLowerCase();

  return (
    name.includes(q) ||
    rarity.includes(q) ||
    type.includes(q) ||
    seed.includes(q) ||
    floatStr.includes(q) ||
    cert.includes(q)
  );
}

/**
 * Splits weapon full title into base weapon name, skin name, and wear suffix.
 */
function parseWeaponName(rawName: string) {
  let isStatTrak = false;
  let isSouvenir = false;
  let clean = rawName.trim();

  if (clean.startsWith('StatTrak™')) {
    isStatTrak = true;
    clean = clean.replace(/^StatTrak™\s+/, '');
  }
  if (clean.startsWith('Souvenir')) {
    isSouvenir = true;
    clean = clean.replace(/^Souvenir\s+/, '');
  }
  if (clean.startsWith('★')) {
    clean = clean.replace(/^★\s+/, '');
  }

  // Check if pipe delimiter exists (e.g. "AK-47 | Ice Coaled (Minimal Wear)")
  if (clean.includes('|')) {
    const parts = clean.split('|');
    const weaponBase = parts[0].trim();
    let skinFull = parts[1].trim();

    // Strip wear from skin title if present in parentheses
    skinFull = skinFull.replace(/\s*\([^)]*\)\s*$/, '').trim();

    return {
      weaponBase,
      skinName: skinFull,
      isStatTrak,
      isSouvenir,
    };
  }

  // Non-weapon or item without skin pattern
  return {
    weaponBase: clean,
    skinName: '',
    isStatTrak,
    isSouvenir,
  };
}

export default function InventoryExplorer({
  initialItems = [],
  snapshotAt = null,
  apiUrl = '/api/inventory.json',
  refreshMs = 5 * 60 * 1000,
}: InventoryExplorerProps) {
  const { items, status, fetchedAt, note, provider, checked, refreshing, refresh } = useLiveInventory(
    initialItems,
    snapshotAt,
    apiUrl,
    refreshMs
  );

  // Select AK-47 by default or first weapon with float, or first available item
  const defaultItem = useMemo(() => {
    return (
      items.find((i) => i.name.toLowerCase().includes('ak-47')) ||
      items.find((i) => i.float !== null) ||
      items[0] ||
      null
    );
  }, [items]);

  const [selectedItem, setSelectedItem] = useState<EnrichedInventoryItem | null>(defaultItem);

  // Keep the selection valid as the live inventory loads or changes (and pick up refreshed item data)
  useEffect(() => {
    setSelectedItem((prev) => (prev && items.find((i) => i.id === prev.id)) || defaultItem);
  }, [items, defaultItem]);
  const [inspectMode, setInspectMode] = useState<InspectDockMode>('3d');
  const [activeCategory, setActiveCategory] = useState<InventoryCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedInspect, setCopiedInspect] = useState(false);
  const [copiedCert, setCopiedCert] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // Filtered item list
  const filteredItems = useMemo(() => {
    return items.filter(
      (item) => matchesCategory(item, activeCategory) && matchesSearch(item, searchQuery)
    );
  }, [items, activeCategory, searchQuery]);

  // Category item counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      counts[cat] = items.filter((i) => matchesCategory(i, cat)).length;
    }
    return counts;
  }, [items]);

  const handleSelectItem = (item: EnrichedInventoryItem) => {
    setSelectedItem(item);
    // Smooth scroll into inspect stage on mobile devices if needed
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && stageRef.current) {
      stageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const copyInspectUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInspect(true);
      setTimeout(() => setCopiedInspect(false), 2000);
    } catch {
      // Fallback
    }
  };

  const copyCertificate = async (cert: string) => {
    try {
      await navigator.clipboard.writeText(cert);
      setCopiedCert(true);
      setTimeout(() => setCopiedCert(false), 2000);
    } catch {
      // Fallback
    }
  };

  const activeModelPath = useMemo(() => {
    if (!selectedItem) return '/models/placeholder-weapon.glb';
    return getSkinCompatibleModelPath(selectedItem.name);
  }, [selectedItem]);

  const selectedParsed = useMemo(() => {
    if (!selectedItem) return null;
    return parseWeaponName(selectedItem.name);
  }, [selectedItem]);

  const activeTextureUrl = useMemo(() => {
    if (!selectedItem) return undefined;
    return resolveSkinTextureUrl(selectedItem.name, selectedParsed?.skinName);
  }, [selectedItem, selectedParsed]);

  const selectedWear = useMemo(() => {
    if (!selectedItem) return null;
    return getWearTier(selectedItem.float);
  }, [selectedItem]);

  const WEAR_BRACKETS = [
    { label: 'FN', from: 0, to: 0.07 },
    { label: 'MW', from: 0.07, to: 0.15 },
    { label: 'FT', from: 0.15, to: 0.38 },
    { label: 'WW', from: 0.38, to: 0.45 },
    { label: 'BS', from: 0.45, to: 1 },
  ];

  const tabClass = (on: boolean) =>
    `cursor-pointer pb-1 text-[15px] transition-colors ${on ? 'text-bone shadow-[0_2px_0_0_#ff6a1a]' : 'text-ash hover:text-bone'}`;

  const statusTone =
    status === 'live' ? 'text-live' : status === 'loading' || status === 'snapshot' ? 'text-ash' : 'text-signal';

  return (
    <div>
      {/* inspect stage */}
      {selectedItem && (
        <section ref={stageRef} aria-label="3D weapon inspect" className="mb-16 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-6" role="tablist" aria-label="Inspect view mode">
                <button type="button" role="tab" aria-selected={inspectMode === '3d'} onClick={() => setInspectMode('3d')} className={tabClass(inspectMode === '3d')}>
                  3d model
                </button>
                <button type="button" role="tab" aria-selected={inspectMode === '2d'} onClick={() => setInspectMode('2d')} className={tabClass(inspectMode === '2d')}>
                  steam art
                </button>
              </div>
              {selectedItem.inspectUrl ? (
                <a href={selectedItem.inspectUrl} className="u-link text-[15px] text-ash hover:text-bone" title="Launch CS2 and inspect">
                  inspect in game ↗
                </a>
              ) : (
                <span className="text-[15px] text-ash-dim" title="No in-game inspect link for this item">no inspect link</span>
              )}
            </div>

            <div className="h-[340px] overflow-hidden bg-ink-2 sm:h-[460px]">
              {inspectMode === '2d' ? (
                <div className="flex h-full items-center justify-center p-8">
                  <img
                    src={selectedItem.iconUrl}
                    alt={selectedItem.name}
                    className="max-h-[320px] max-w-full object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.7)]"
                  />
                </div>
              ) : (
                <ModelViewer
                  modelUrl={activeModelPath}
                  textureUrl={activeTextureUrl}
                  weaponName={selectedItem.name}
                  skinName={selectedParsed?.skinName}
                  float={selectedItem.float}
                  seed={selectedItem.seed}
                  rarityColor={selectedItem.rarityColor}
                  className="h-full w-full"
                  autoRotate={true}
                  showControlsHint={true}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <p className="num flex flex-wrap items-center gap-x-3 text-[11px] uppercase tracking-[0.16em]">
              {selectedParsed?.isStatTrak && <span className="text-signal">StatTrak™</span>}
              {selectedParsed?.isSouvenir && <span className="text-signal">Souvenir</span>}
              <span style={{ color: selectedItem.rarityColor || undefined }}>{selectedItem.rarity}</span>
              <span className="text-ash">{selectedItem.type}</span>
            </p>
            <h2 className="mt-3 text-xl text-ash">{selectedParsed?.weaponBase}</h2>
            {selectedParsed?.skinName && (
              <p className="display text-[clamp(2.5rem,5.5vw,4.5rem)]">{selectedParsed.skinName}</p>
            )}
            {selectedWear && (
              <p className="num mt-3 text-[12px] uppercase tracking-wider text-ash">
                <span style={{ color: selectedWear.color }}>{selectedWear.name}</span> · {selectedWear.tag}
              </p>
            )}

            {selectedItem.float !== null ? (
              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow">float</span>
                  <span className="num text-xl">{selectedItem.float.toFixed(8)}</span>
                </div>
                <div className="relative mt-3 flex h-[6px] gap-[2px]">
                  {WEAR_BRACKETS.map((b) => {
                    const f = selectedItem.float as number;
                    const on = f >= b.from && (f < b.to || b.to === 1);
                    return (
                      <div key={b.label} style={{ width: `${(b.to - b.from) * 100}%` }} className={on ? 'bg-bone' : 'bg-rule-strong'} title={`${b.from.toFixed(2)} – ${b.to.toFixed(2)}`} />
                    );
                  })}
                  <div
                    className="pointer-events-none absolute -top-[5px] h-[16px] w-[2px] -translate-x-1/2 bg-signal"
                    style={{ left: `${Math.min(100, Math.max(0, selectedItem.float * 100))}%` }}
                  />
                </div>
                <div className="num mt-2 flex text-[10px] uppercase tracking-wider text-ash-dim">
                  {WEAR_BRACKETS.map((b) => (
                    <span key={b.label} style={{ width: `${(b.to - b.from) * 100}%` }}>{b.label}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-8 text-[15px] text-ash">no float — stock quality.</p>
            )}

            <dl className="mt-8 border-t border-rule text-[15px]">
              <div className="flex justify-between gap-6 border-b border-rule py-3">
                <dt className="text-ash">pattern seed</dt>
                <dd className="num">{selectedItem.seed !== null ? `#${selectedItem.seed}` : '—'}</dd>
              </div>
              <div className="flex justify-between gap-6 border-b border-rule py-3">
                <dt className="text-ash">asset id</dt>
                <dd className="num truncate" title={selectedItem.id}>{selectedItem.id}</dd>
              </div>
              {selectedItem.certificate && (
                <div className="flex items-center justify-between gap-6 border-b border-rule py-3">
                  <dt className="text-ash">certificate</dt>
                  <dd className="flex min-w-0 items-center gap-4">
                    <span className="num max-w-[10rem] select-all truncate text-[12px]" title={selectedItem.certificate}>{selectedItem.certificate}</span>
                    <button type="button" onClick={() => copyCertificate(selectedItem.certificate!)} className="u-link shrink-0 cursor-pointer text-ash hover:text-bone">
                      {copiedCert ? 'copied ✓' : 'copy'}
                    </button>
                  </dd>
                </div>
              )}
            </dl>

            {selectedItem.inspectUrl && (
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={selectedItem.inspectUrl} className="btn btn-signal">inspect in game ↗</a>
                <button type="button" onClick={() => copyInspectUrl(selectedItem.inspectUrl!)} className="btn">
                  {copiedInspect ? 'copied ✓' : 'copy link'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* controls */}
      <section aria-label="Filters and search" className="border-t border-rule pt-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="scrollbar-none -mx-5 flex gap-6 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            {CATEGORIES.map((category) => {
              const isActive = activeCategory === category;
              return (
                <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`${tabClass(isActive)} whitespace-nowrap`}>
                  {String(category).toLowerCase()} <span className="num text-[11px] text-ash">{categoryCounts[category] || 0}</span>
                </button>
              );
            })}
          </div>

          <label className="relative block w-full md:w-72">
            <span className="sr-only">Search inventory</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search skins, seeds, floats"
              className="w-full border-b border-rule-strong bg-transparent pb-2 pr-6 text-lg text-bone placeholder-ash-dim transition-colors focus:border-signal focus:outline-none"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute right-0 top-0 cursor-pointer text-ash hover:text-bone" title="Clear search">✕</button>
            )}
          </label>
        </div>

        <div role="status" className={`num mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] uppercase tracking-wider ${statusTone}`}>
          <span>
            {status === 'loading' && 'loading inventory from steam…'}
            {status === 'snapshot' &&
              (checked
                ? `couldn’t refresh — showing last site build${fetchedAt ? ` (${formatAge(fetchedAt)})` : ''}`
                : `showing last site build${fetchedAt ? ` (${formatAge(fetchedAt)})` : ''} · checking for updates…`)}
            {status === 'live' &&
              `● live${provider === 'csfloat' ? ' via csfloat' : provider === 'steam+csfloat' ? ' via steam + csfloat' : ' via steam'}${fetchedAt ? ` · updated ${formatAge(fetchedAt)}` : ''}`}
            {status === 'stale' && `steam unavailable — last loaded inventory${fetchedAt ? ` (${formatAge(fetchedAt)})` : ''}`}
            {status === 'fallback' && 'couldn’t reach steam — saved example snapshot, not the current inventory'}
            {status === 'error' && 'couldn’t load the inventory'}
            {note && (status === 'snapshot' || status === 'live' || status === 'stale' || status === 'fallback' || status === 'error') && (
              <span className="ml-1 normal-case text-ash">({note})</span>
            )}
          </span>
          <span className="flex items-center gap-5 text-ash">
            <span>{filteredItems.length} / {items.length} items</span>
            <button type="button" onClick={refresh} disabled={refreshing} className="u-link cursor-pointer hover:text-bone disabled:opacity-50">
              {refreshing ? 'refreshing…' : 'refresh'}
            </button>
          </span>
        </div>
      </section>

      {/* grid */}
      <section aria-label="Inventory grid" className="mt-8">
        {filteredItems.length === 0 && status === 'loading' ? (
          <p className="num animate-pulse py-24 text-center text-[13px] uppercase tracking-wider text-ash">loading…</p>
        ) : filteredItems.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-xl text-ash">nothing matches.</p>
            <button type="button" onClick={() => { setActiveCategory('All'); setSearchQuery(''); }} className="u-link mt-4 cursor-pointer text-bone">
              reset filters
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const parsed = parseWeaponName(item.name);
              const wear = getWearTier(item.float);

              return (
                <li key={item.id} className="bg-ink">
                  <button
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    aria-pressed={isSelected}
                    className={`group relative flex h-full w-full cursor-pointer flex-col p-4 text-left transition-colors ${isSelected ? 'bg-ink-3' : 'hover:bg-ink-2'}`}
                  >
                    <span
                      className={`absolute inset-x-0 top-0 h-[3px] origin-left transition-transform duration-300 ${isSelected ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
                      style={{ backgroundColor: item.rarityColor || '#948e7e' }}
                    />
                    <span className="num flex items-center justify-between text-[10px] uppercase tracking-wider text-ash">
                      <span className="flex gap-2">
                        {parsed.isStatTrak && <span className="text-signal">ST</span>}
                        {parsed.isSouvenir && <span className="text-signal">SV</span>}
                        <span style={{ color: wear?.color }}>{wear ? wear.tag : 'stock'}</span>
                      </span>
                      {item.seed !== null && <span>#{item.seed}</span>}
                    </span>

                    <span className="flex min-h-[104px] items-center justify-center py-3">
                      <img
                        src={item.iconUrl}
                        alt={item.name}
                        loading="lazy"
                        className="max-h-20 w-auto object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-105"
                      />
                    </span>

                    <span className="truncate text-[13px] text-ash" title={parsed.weaponBase}>{parsed.weaponBase}</span>
                    <span className="truncate text-[17px] font-semibold leading-tight tracking-tight" title={parsed.skinName || parsed.weaponBase}>
                      {parsed.skinName || parsed.weaponBase}
                    </span>
                    <span className="num mt-1 text-[11px] text-ash">{item.float !== null ? item.float.toFixed(4) : item.type}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
