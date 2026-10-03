import { useState } from 'react';
import ModelViewer from '../ModelViewer';
import { getWeaponModelPath } from '../../utils/weaponModels';

export interface LoadoutWeapon {
  id: string;
  slot: string;
  tabLabel: string;
  name: string;
  weapon: string;
  skin: string;
  wear: string;
  wearShort: string;
  float: number;
  seed: number;
  rarity: string;
  rarityColor: string;
  color?: string;
  modelUrl: string;
  isStatTrak?: boolean;
}

/**
 * Authentic primary CS2 weapons for the live loadout showcase.
 * Matches user's real CS2 inventory:
 * - Primary Rifle: AK-47 | Ice Coaled (Minimal Wear, Float: 0.0825, Seed: 367)
 * - CT Rifle: StatTrak™ M4A1-S | Liquidation (Field-Tested, Float: 0.3438, Seed: 937)
 * - Sniper: AWP | Ice Coaled (Factory New, Float: 0.0631, Seed: 309)
 * - Sidearm: USP-S | Royal Guard (Factory New, Float: 0.0560, Seed: 644)
 * - Knife: ★ Karambit | Doppler (Factory New, Float: 0.0089, Seed: 399) / Combat Knife 3D model
 */
export const DEFAULT_LOADOUT_WEAPONS: LoadoutWeapon[] = [
  {
    id: '53025617652',
    slot: 'Primary Rifle',
    tabLabel: 'AK-47',
    name: 'AK-47 | Ice Coaled (Minimal Wear)',
    weapon: 'AK-47',
    skin: 'Ice Coaled',
    wear: 'Minimal Wear',
    wearShort: 'MW',
    float: 0.0825,
    seed: 367,
    rarity: 'Classified',
    rarityColor: '#d32ce6',
    color: '#d32ce6',
    modelUrl: '/models/weapon_rif_ak47.obj',
  },
  {
    id: '52289606446',
    slot: 'CT Rifle',
    tabLabel: 'M4A1-S',
    name: 'StatTrak™ M4A1-S | Liquidation (Field-Tested)',
    weapon: 'M4A1-S',
    skin: 'Liquidation',
    wear: 'Field-Tested',
    wearShort: 'FT',
    float: 0.3438,
    seed: 937,
    rarity: 'Restricted',
    rarityColor: '#8847ff',
    color: '#8847ff',
    isStatTrak: true,
    modelUrl: '/models/weapon_rif_m4a1_silencer.obj',
  },
  {
    id: '53778348583',
    slot: 'Sniper',
    tabLabel: 'AWP',
    name: 'AWP | Ice Coaled (Factory New)',
    weapon: 'AWP',
    skin: 'Ice Coaled',
    wear: 'Factory New',
    wearShort: 'FN',
    float: 0.0631,
    seed: 309,
    rarity: 'Classified',
    rarityColor: '#d32ce6',
    color: '#d32ce6',
    modelUrl: '/models/weapon_snip_awp.obj',
  },
  {
    id: '52875530986',
    slot: 'Sidearm',
    tabLabel: 'USP-S',
    name: 'USP-S | Royal Guard (Factory New)',
    weapon: 'USP-S',
    skin: 'Royal Guard',
    wear: 'Factory New',
    wearShort: 'FN',
    float: 0.0560,
    seed: 644,
    rarity: 'Restricted',
    rarityColor: '#8847ff',
    color: '#8847ff',
    modelUrl: '/models/weapon_pist_usp_silencer.obj',
  },
  {
    id: 'knife-karambit',
    slot: 'Knife',
    tabLabel: 'Knife',
    name: '★ Karambit | Doppler (Factory New)',
    weapon: '★ Karambit',
    skin: 'Doppler',
    wear: 'Factory New',
    wearShort: 'FN',
    float: 0.0089,
    seed: 399,
    rarity: '★ Extraordinary',
    rarityColor: '#ffd700',
    color: '#ffd700',
    modelUrl: '/models/placeholder-weapon.glb',
  },
];

/**
 * Returns canonical wear bracket title according to official CS2 wear thresholds.
 */
export function getWearBracket(float: number): string {
  if (float < 0.07) return 'Factory New';
  if (float < 0.15) return 'Minimal Wear';
  if (float < 0.38) return 'Field-Tested';
  if (float < 0.45) return 'Well-Worn';
  return 'Battle-Scarred';
}

/**
 * Returns float as a clamped percentage (0.0 to 100.0).
 */
export function getFloatPercentage(float: number): number {
  return Math.min(Math.max(float * 100, 0), 100);
}

/**
 * Formats pattern template seed with canonical hash prefix.
 */
export function formatSeed(seed: number): string {
  return `Seed #${seed}`;
}

/**
 * Live Segmented Float Wear Bar with wear bracket indicators and pin needle.
 */
export function FloatWearBar({ float }: { float: number }) {
  const clamped = Math.min(Math.max(float, 0), 1);
  const percent = getFloatPercentage(clamped);
  const wearName = getWearBracket(clamped);

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Condition:</span>
          <span className="font-semibold text-zinc-200">{wearName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">Float:</span>
          <span className="font-mono font-bold text-cyan-400">
            {clamped.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Segmented Wear Bar Track */}
      <div
        className="relative h-2.5 w-full rounded-full bg-slate-900 border border-white/10 overflow-hidden flex shadow-inner"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-label="CS2 Float Wear Bar"
      >
        {/* FN: 0.00 - 0.07 (7%) */}
        <div
          style={{ width: '7%' }}
          className="h-full bg-emerald-500/80 border-r border-black/40"
          title="Factory New (0.00 - 0.07)"
        />
        {/* MW: 0.07 - 0.15 (8%) */}
        <div
          style={{ width: '8%' }}
          className="h-full bg-cyan-500/80 border-r border-black/40"
          title="Minimal Wear (0.07 - 0.15)"
        />
        {/* FT: 0.15 - 0.38 (23%) */}
        <div
          style={{ width: '23%' }}
          className="h-full bg-amber-400/80 border-r border-black/40"
          title="Field-Tested (0.15 - 0.38)"
        />
        {/* WW: 0.38 - 0.45 (7%) */}
        <div
          style={{ width: '7%' }}
          className="h-full bg-orange-500/80 border-r border-black/40"
          title="Well-Worn (0.38 - 0.45)"
        />
        {/* BS: 0.45 - 1.00 (55%) */}
        <div
          style={{ width: '55%' }}
          className="h-full bg-rose-600/80"
          title="Battle-Scarred (0.45 - 1.00)"
        />

        {/* Live Needle Indicator */}
        <div
          className="absolute top-0 bottom-0 w-1.5 -ml-0.5 bg-white shadow-[0_0_8px_#ffffff] z-10 rounded-full pointer-events-none transition-all duration-300"
          style={{ left: `${percent}%` }}
        />
      </div>

      {/* Bracket Indicators */}
      <div className="flex justify-between text-[9px] font-mono text-zinc-500 px-0.5">
        <span className="text-emerald-400/80">FN 0.00</span>
        <span className="text-cyan-400/80">MW 0.07</span>
        <span className="text-amber-400/80">FT 0.15</span>
        <span className="text-orange-400/80">WW 0.38</span>
        <span className="text-rose-400/80">BS 0.45-1.00</span>
      </div>
    </div>
  );
}

export interface CS2LoadoutCardProps {
  weapons?: LoadoutWeapon[];
  steamInventoryUrl?: string;
  className?: string;
  initialIndex?: number;
}

/**
 * CS2 Loadout Bento Card (Module C-2, Homepage Bento Grid).
 * Features 5 weapon slots, interactive tabs, 3D model inspect,
 * segmented float wear bar, paint seed, rarity badge, and footer links.
 */
export default function CS2LoadoutCard({
  weapons = DEFAULT_LOADOUT_WEAPONS,
  steamInventoryUrl = 'https://steamcommunity.com/profiles/76561198920486334/inventory/',
  className = '',
  initialIndex = 0,
}: CS2LoadoutCardProps) {
  const [activeIndex, setActiveIndex] = useState(
    initialIndex >= 0 && initialIndex < weapons.length ? initialIndex : 0
  );

  const activeWeapon = weapons[activeIndex] || weapons[0];
  const modelAssetUrl = activeWeapon.modelUrl || getWeaponModelPath(activeWeapon.name);

  return (
    <div
      className={`rounded-2xl border border-hardware bg-[#0F1118] p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between telemetry-card spotlight-card shadow-xl gap-4 ${className}`}
    >
      {/* Background Grid Pattern & Ambient Rarity Accent */}
      <div className="absolute inset-0 bg-grid-pattern opacity-25 pointer-events-none" />
      <div
        className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none transition-colors duration-500"
        style={{ backgroundColor: activeWeapon.rarityColor }}
      />

      {/* Card Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-[#1E2333] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-telemetry-amber shadow-sm shadow-telemetry-amber/60 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-white uppercase">
            [CS2 // LOADOUT]
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-[#151824] border border-[#1E2333] text-[10px] font-mono text-zinc-400">
            {activeWeapon.slot}
          </span>
        </div>
      </div>

      {/* Interactive Tab Pills */}
      <div
        className="relative z-10 grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-[#0A0C12] border border-[#1E2333]"
        role="tablist"
        aria-label="CS2 Active Weapon Loadout Slots"
      >
        {weapons.map((w, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={w.id || w.name}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveIndex(index)}
              className={`px-1.5 py-1.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-mono font-bold transition-all duration-200 cursor-pointer text-center truncate ${
                isActive
                  ? 'text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151824]'
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: `${w.rarityColor}22`,
                      borderColor: `${w.rarityColor}88`,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      boxShadow: `0 0 12px ${w.rarityColor}33`,
                    }
                  : {
                      border: '1px solid transparent',
                    }
              }
            >
              {w.tabLabel}
            </button>
          );
        })}
      </div>

      {/* 3D Inspect Viewport Stage */}
      <div className="relative z-10 w-full h-48 sm:h-56 rounded-xl overflow-hidden border border-[#1E2333] bg-[#0A0C12] shadow-inner">
        <ModelViewer
          key={activeWeapon.id || activeWeapon.name}
          modelUrl={modelAssetUrl}
          weaponName={activeWeapon.name}
          skinName={activeWeapon.skin}
          float={activeWeapon.float}
          seed={activeWeapon.seed}
          rarityColor={activeWeapon.rarityColor}
          className="w-full h-full"
          autoRotate={true}
          showControlsHint={true}
        />
      </div>

      {/* Weapon Details & Telemetry Dock */}
      <div className="relative z-10 space-y-3 bg-[#0A0C12]/80 border border-[#1E2333] rounded-xl p-3 sm:p-3.5">
        {/* Weapon Title & StatTrak Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {activeWeapon.isStatTrak && (
              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#cf6a32]/20 border border-[#cf6a32]/40 text-[#cf6a32]">
                StatTrak™
              </span>
            )}
            <h3
              className="text-xs sm:text-sm font-mono font-bold text-white truncate"
              title={activeWeapon.name}
            >
              {activeWeapon.name}
            </h3>
          </div>
          <span
            className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase"
            style={{
              color: activeWeapon.rarityColor,
              backgroundColor: `${activeWeapon.rarityColor}18`,
              border: `1px solid ${activeWeapon.rarityColor}40`,
            }}
          >
            [{activeWeapon.rarity}]
          </span>
        </div>

        {/* Badges Row: Pattern Seed & Condition */}
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded bg-[#151824] border border-[#1E2333] text-zinc-300">
            {formatSeed(activeWeapon.seed)}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#151824] border border-[#1E2333] text-zinc-300">
            {activeWeapon.wear}
          </span>
        </div>

        {/* Live Segmented Float Wear Bar */}
        <FloatWearBar float={activeWeapon.float} />
      </div>

      {/* Card Footer Navigation */}
      <div className="relative z-10 pt-2 border-t border-[#1E2333] flex items-center justify-between text-xs font-mono">
        <a
          href="/inventory"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-telemetry-blue/15 hover:bg-telemetry-blue/25 border border-telemetry-blue/40 hover:border-telemetry-blue/70 text-telemetry-blue hover:text-white text-xs font-mono font-bold transition-all tactile-btn"
        >
          <span>[VIEW ALL SKINS] →</span>
        </a>

        <a
          href={steamInventoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-telemetry-amber transition-colors"
        >
          <span>Steam Inventory</span>
          <span>↗</span>
        </a>
      </div>
    </div>
  );
}

export { CS2LoadoutCard };
