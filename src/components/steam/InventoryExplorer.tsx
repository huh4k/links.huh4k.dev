import { useState, useMemo, useRef } from 'react';
import ModelViewer from '../ModelViewer';
import { getWeaponModelPath } from '../../utils/weaponModels';
import type { EnrichedInventoryItem } from '../../types/inventory';

export interface InventoryExplorerProps {
  initialItems: EnrichedInventoryItem[];
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

export default function InventoryExplorer({ initialItems = [] }: InventoryExplorerProps) {
  // Select AK-47 by default or first weapon with float, or first available item
  const defaultItem = useMemo(() => {
    return (
      initialItems.find((i) => i.name.toLowerCase().includes('ak-47')) ||
      initialItems.find((i) => i.float !== null) ||
      initialItems[0] ||
      null
    );
  }, [initialItems]);

  const [selectedItem, setSelectedItem] = useState<EnrichedInventoryItem | null>(defaultItem);
  const [inspectMode, setInspectMode] = useState<InspectDockMode>('3d');
  const [activeCategory, setActiveCategory] = useState<InventoryCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedInspect, setCopiedInspect] = useState(false);
  const [copiedCert, setCopiedCert] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // Filtered item list
  const filteredItems = useMemo(() => {
    return initialItems.filter(
      (item) => matchesCategory(item, activeCategory) && matchesSearch(item, searchQuery)
    );
  }, [initialItems, activeCategory, searchQuery]);

  // Category item counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      counts[cat] = initialItems.filter((i) => matchesCategory(i, cat)).length;
    }
    return counts;
  }, [initialItems]);

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
    return getWeaponModelPath(selectedItem.name);
  }, [selectedItem]);

  const selectedParsed = useMemo(() => {
    if (!selectedItem) return null;
    return parseWeaponName(selectedItem.name);
  }, [selectedItem]);

  const selectedWear = useMemo(() => {
    if (!selectedItem) return null;
    return getWearTier(selectedItem.float);
  }, [selectedItem]);

  return (
    <div className="space-y-8">
      {/* ==================================================================== */}
      {/* SECTION 1: INTERACTIVE 3D INSPECT STAGE                              */}
      {/* ==================================================================== */}
      {selectedItem && (
        <section
          ref={stageRef}
          aria-label="3D Weapon Inspect Stage"
          className="rounded-2xl border border-[#1E2333] bg-[#0B0D13] p-4 sm:p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle Stage Ambience Gradient */}
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ backgroundColor: selectedItem.rarityColor || '#38bdf8' }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Viewport Column (7 Cols on desktop) */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              {/* Inspect View Dock Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-0.5">
                <div
                  className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0A0C12] border border-[#1E2333] font-mono text-xs"
                  role="tablist"
                  aria-label="Inspect View Mode"
                >
                  {/* Option 1: 3D Model (R2 PBR) */}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inspectMode === '3d'}
                    onClick={() => setInspectMode('3d')}
                    className={`px-2.5 py-1.5 sm:px-3 rounded-lg font-bold transition-all cursor-pointer ${
                      inspectMode === '3d'
                        ? 'bg-telemetry-blue/20 border border-telemetry-blue text-white shadow-sm'
                        : 'border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#151824]'
                    }`}
                  >
                    [3D Model (R2 PBR)]
                  </button>

                  {/* Option 2: Steam 2D Artwork */}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inspectMode === '2d'}
                    onClick={() => setInspectMode('2d')}
                    className={`px-2.5 py-1.5 sm:px-3 rounded-lg font-bold transition-all cursor-pointer ${
                      inspectMode === '2d'
                        ? 'bg-telemetry-blue/20 border border-telemetry-blue text-white shadow-sm'
                        : 'border border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#151824]'
                    }`}
                  >
                    [Steam 2D Artwork]
                  </button>
                </div>

                {/* Option 3: Launch CS2 Inspect Direct Action */}
                {selectedItem.inspectUrl ? (
                  <a
                    href={selectedItem.inspectUrl}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-telemetry-blue hover:text-sky-300 hover:bg-telemetry-blue/10 border border-telemetry-blue/30 transition-colors"
                    title="Launch CS2 client and inspect item"
                  >
                    <span>[Launch CS2 Inspect ↗]</span>
                  </a>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-zinc-600 border border-zinc-800 cursor-not-allowed"
                    title="No in-game inspect link available for this item"
                  >
                    <span>[Launch CS2 Inspect ↗]</span>
                  </span>
                )}
              </div>

              {/* Viewport Container (3D Model or 2D Artwork) */}
              <div className="w-full flex-1 min-h-[340px] sm:min-h-[420px] rounded-xl overflow-hidden border border-[#1E2333]/80 bg-black/40">
                {inspectMode === '2d' ? (
                  <div className="relative w-full h-full min-h-[340px] sm:min-h-[420px] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-900/90 via-slate-950 to-black select-none overflow-hidden group">
                    {/* Background Radial Glow */}
                    <div
                      className="absolute inset-0 pointer-events-none opacity-20 transition-opacity duration-500 group-hover:opacity-30"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${selectedItem.rarityColor || '#38bdf8'} 0%, transparent 70%)`,
                      }}
                    />

                    {/* Valve Official Isometric Render */}
                    <div className="relative z-10 flex items-center justify-center w-full h-full max-h-[280px] sm:max-h-[340px]">
                      <img
                        src={selectedItem.iconUrl}
                        alt={selectedItem.name}
                        className="max-h-full max-w-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    {/* Stage Label Badge */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-500 opacity-80 group-hover:opacity-100">
                      <span className="px-3 py-1 text-[11px] font-mono tracking-wide bg-slate-900/80 backdrop-blur-md text-slate-300 rounded-full border border-slate-700/60 shadow-lg">
                        Steam 2D Artwork • Valve Isometric Render
                      </span>
                    </div>
                  </div>
                ) : (
                  <ModelViewer
                    key={selectedItem.id}
                    modelUrl={activeModelPath}
                    weaponName={selectedItem.name}
                    skinName={selectedParsed?.skinName}
                    float={selectedItem.float}
                    seed={selectedItem.seed}
                    rarityColor={selectedItem.rarityColor}
                    className="w-full h-full min-h-[340px] sm:min-h-[420px]"
                    autoRotate={true}
                    showControlsHint={true}
                  />
                )}
              </div>
            </div>

            {/* Item Telemetry & Inspect Metrics Panel (5 Cols on desktop) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-5 bg-[#0F1118]/80 rounded-xl p-5 border border-[#1E2333]">
              {/* Header Badges & Title */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* StatTrak / Souvenir Badge */}
                  {selectedParsed?.isStatTrak && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-[#cf6a32]/20 text-[#cf6a32] border border-[#cf6a32]/40 shadow-sm shadow-[#cf6a32]/20">
                      StatTrak™
                    </span>
                  )}
                  {selectedParsed?.isSouvenir && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
                      Souvenir
                    </span>
                  )}

                  {/* Rarity Badge */}
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider uppercase border"
                    style={{
                      color: selectedItem.rarityColor || '#b0c3d9',
                      borderColor: `${selectedItem.rarityColor || '#b0c3d9'}60`,
                      backgroundColor: `${selectedItem.rarityColor || '#b0c3d9'}15`,
                    }}
                  >
                    {selectedItem.rarity}
                  </span>

                  {/* Weapon Type */}
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-black/60 text-zinc-400 border border-[#1E2333]">
                    {selectedItem.type}
                  </span>
                </div>

                {/* Skin Title */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight leading-snug">
                    {selectedParsed?.weaponBase}
                    {selectedParsed?.skinName ? (
                      <span className="text-telemetry-blue block sm:inline sm:ml-2">
                        | {selectedParsed.skinName}
                      </span>
                    ) : null}
                  </h2>
                  {selectedWear && (
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-1">
                      <span style={{ color: selectedWear.color }} className="font-semibold">
                        {selectedWear.name}
                      </span>
                      <span>•</span>
                      <span className="text-zinc-500">Tier: {selectedWear.tag}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Wear Rating Float Progress Bar */}
              {selectedItem.float !== null ? (
                <div className="space-y-2 p-3.5 rounded-lg bg-black/50 border border-[#1E2333]">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">Wear Rating (Float)</span>
                    <span className="font-bold text-white tracking-wider">
                      {selectedItem.float.toFixed(8)}
                    </span>
                  </div>

                  {/* Multi-Segmented Float Bar with Indicator Pin */}
                  <div className="relative pt-2 pb-1">
                    {/* The 5 standard CS2 Wear Brackets: FN(0-0.07), MW(0.07-0.15), FT(0.15-0.38), WW(0.38-0.45), BS(0.45-1.00) */}
                    <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-zinc-900 border border-zinc-700/60 shadow-inner">
                      <div className="h-full bg-emerald-500" style={{ width: '7%' }} title="Factory New (0.00 - 0.07)" />
                      <div className="h-full bg-sky-500" style={{ width: '8%' }} title="Minimal Wear (0.07 - 0.15)" />
                      <div className="h-full bg-amber-500" style={{ width: '23%' }} title="Field-Tested (0.15 - 0.38)" />
                      <div className="h-full bg-orange-500" style={{ width: '7%' }} title="Well-Worn (0.38 - 0.45)" />
                      <div className="h-full bg-red-500" style={{ width: '55%' }} title="Battle-Scarred (0.45 - 1.00)" />
                    </div>

                    {/* Indicator needle with glowing ping dot */}
                    <div
                      className="absolute top-1 bottom-0 -ml-[1px] w-[2px] bg-white z-20 pointer-events-none"
                      style={{
                        left: `${Math.min(100, Math.max(0, selectedItem.float * 100))}%`,
                      }}
                    >
                      <div className="absolute -top-1 -left-[3px] w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                    </div>
                  </div>

                  {/* Bracket Labels */}
                  <div className="flex justify-between text-[9px] font-mono text-zinc-500 pt-0.5 px-0.5">
                    <span>FN: 0.00</span>
                    <span>MW: 0.07</span>
                    <span>FT: 0.15</span>
                    <span>WW: 0.38</span>
                    <span>BS: 0.45</span>
                    <span>1.00</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-black/40 border border-[#1E2333] text-xs font-mono text-zinc-500">
                  Wear Rating: <span className="text-zinc-400">N/A (Standard Issue / Stock Quality)</span>
                </div>
              )}

              {/* Secondary Telemetry: Paint Seed & Certificate Hash */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                {/* Paint Seed */}
                <div className="p-3 rounded-lg bg-black/40 border border-[#1E2333]">
                  <span className="text-[10px] text-zinc-500 block uppercase">Pattern Template</span>
                  <span className="text-white font-semibold text-sm mt-0.5 block">
                    {selectedItem.seed !== null ? `#${selectedItem.seed}` : 'N/A'}
                  </span>
                </div>

                {/* Asset ID */}
                <div className="p-3 rounded-lg bg-black/40 border border-[#1E2333]">
                  <span className="text-[10px] text-zinc-500 block uppercase">Asset Telemetry ID</span>
                  <span className="text-zinc-300 font-mono text-xs mt-0.5 block truncate" title={selectedItem.id}>
                    {selectedItem.id}
                  </span>
                </div>
              </div>

              {/* Item Certificate (if present) */}
              {selectedItem.certificate && (
                <div className="p-3 rounded-lg bg-black/40 border border-[#1E2333] space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
                    <span>Item Certificate Hash</span>
                    <button
                      type="button"
                      onClick={() => copyCertificate(selectedItem.certificate!)}
                      className="text-telemetry-blue hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedCert ? '✓ Copied' : 'Copy Hash'}
                    </button>
                  </div>
                  <div
                    className="text-[11px] font-mono text-zinc-300 truncate bg-black/60 px-2 py-1 rounded border border-white/5 select-all"
                    title={selectedItem.certificate}
                  >
                    {selectedItem.certificate}
                  </div>
                </div>
              )}

              {/* Action Buttons: Direct Inspect URL & External Links */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                {selectedItem.inspectUrl ? (
                  <>
                    <a
                      href={selectedItem.inspectUrl}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-telemetry-blue hover:bg-sky-400 text-black font-semibold text-xs font-mono transition-colors tactile-btn shadow-md shadow-telemetry-blue/20"
                    >
                      <span>Inspect in Game</span>
                      <span>↗</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => copyInspectUrl(selectedItem.inspectUrl!)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2333] bg-[#0F1118] hover:border-zinc-500 text-xs font-mono text-zinc-300 transition-colors tactile-btn cursor-pointer"
                    >
                      <span>{copiedInspect ? '✓ Copied URL' : 'Copy Inspect Link'}</span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs font-mono text-zinc-500 italic">
                    In-game preview link not applicable for this item type
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* SECTION 2: CATEGORY FILTER PILLS & INSTANT SEARCH CONTROLS           */}
      {/* ==================================================================== */}
      <section aria-label="Inventory Filters and Search" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Filter Pills Taxonomy */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none font-mono text-xs">
            {CATEGORIES.map((category) => {
              const isActive = activeCategory === category;
              const count = categoryCounts[category] || 0;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all tactile-btn cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-telemetry-blue/15 border-telemetry-blue text-white font-semibold shadow-sm shadow-telemetry-blue/20'
                      : 'bg-[#0F1118] border-[#1E2333] text-zinc-400 hover:text-white hover:border-zinc-600'
                  }`}
                >
                  <span>[{category}]</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded ${
                      isActive ? 'bg-telemetry-blue/20 text-telemetry-blue' : 'bg-black/50 text-zinc-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Instant Search Box & Results Counter */}
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">
                {'>'}
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skins, seeds, floats..."
                className="w-full pl-7 pr-8 py-1.5 rounded-lg border border-[#1E2333] bg-[#0F1118] text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-telemetry-blue transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs font-mono cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Line: Results Count */}
        <div className="flex items-center justify-between text-xs font-mono text-zinc-500 px-1">
          <span>
            Showing <strong className="text-zinc-200">{filteredItems.length}</strong> of{' '}
            <strong className="text-zinc-200">{initialItems.length}</strong> items
          </span>
          {searchQuery && (
            <span className="text-telemetry-blue">
              Filter: &ldquo;{searchQuery}&rdquo;
            </span>
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 3: RESPONSIVE INVENTORY ITEM GRID                            */}
      {/* ==================================================================== */}
      <section aria-label="Inventory Grid">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#1E2333] bg-[#0F1118]/50 p-12 text-center space-y-3 font-mono">
            <p className="text-sm text-zinc-400">
              No CS2 inventory items match current filter and search query.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All');
                setSearchQuery('');
              }}
              className="px-3 py-1.5 rounded-lg border border-telemetry-blue bg-telemetry-blue/10 text-xs text-telemetry-blue hover:bg-telemetry-blue/20 transition-colors cursor-pointer tactile-btn"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const parsed = parseWeaponName(item.name);
              const wear = getWearTier(item.float);

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectItem(item);
                    }
                  }}
                  className={`group relative rounded-xl border p-3 flex flex-col justify-between transition-all cursor-pointer select-none text-left overflow-hidden ${
                    isSelected
                      ? 'border-telemetry-blue bg-[#161a28] shadow-lg shadow-telemetry-blue/10 ring-1 ring-telemetry-blue'
                      : 'border-[#1E2333] bg-[#0F1118] hover:border-telemetry-blue/50 hover:bg-[#131622]'
                  }`}
                  style={{
                    borderTopColor: item.rarityColor || '#b0c3d9',
                    borderTopWidth: '3px',
                  }}
                >
                  {/* Card Header: Badges & Wear Tag */}
                  <div className="flex items-center justify-between gap-1 mb-1.5 font-mono text-[10px]">
                    <div className="flex items-center gap-1 truncate">
                      {parsed.isStatTrak && (
                        <span className="px-1 py-0.2 rounded font-bold bg-[#cf6a32]/20 text-[#cf6a32] border border-[#cf6a32]/30">
                          ST
                        </span>
                      )}
                      {parsed.isSouvenir && (
                        <span className="px-1 py-0.2 rounded font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          SOUV
                        </span>
                      )}
                      {wear ? (
                        <span
                          className="px-1 py-0.2 rounded font-semibold"
                          style={{
                            color: wear.color,
                            backgroundColor: `${wear.color}15`,
                          }}
                        >
                          {wear.tag}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Stock</span>
                      )}
                    </div>

                    {/* Paint Seed Badge */}
                    {item.seed !== null && (
                      <span className="text-zinc-500 font-mono text-[9px] shrink-0">
                        #{item.seed}
                      </span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="relative py-2 flex items-center justify-center min-h-[96px]">
                    <img
                      src={item.iconUrl}
                      alt={item.name}
                      loading="lazy"
                      className="max-h-20 w-auto object-contain transition-transform duration-200 group-hover:scale-105 filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
                    />
                  </div>

                  {/* Weapon Name & Skin Title */}
                  <div className="space-y-0.5 pt-1.5 border-t border-[#1E2333]/60 font-mono">
                    <p className="text-[11px] text-zinc-400 truncate" title={parsed.weaponBase}>
                      {parsed.weaponBase}
                    </p>
                    <p
                      className="text-xs font-semibold text-white truncate"
                      title={parsed.skinName || parsed.weaponBase}
                    >
                      {parsed.skinName || parsed.weaponBase}
                    </p>

                    {/* Bottom Metadata: Float & Rarity Accent */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                      <span>
                        {item.float !== null ? item.float.toFixed(4) : item.type}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: item.rarityColor || '#b0c3d9' }}
                        title={item.rarity}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
