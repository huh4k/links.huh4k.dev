import { useState, useMemo } from 'react';
import ModelViewer from '../ModelViewer';
import { getSkinCompatibleModelPath } from '../../utils/weaponModels';
import { resolveSkinTextureUrl } from '../../utils/weaponTextures';

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
  /** Optional override; by default the mesh is chosen per skin so wraps land on matching UVs */
  modelUrl?: string;
  isStatTrak?: boolean;
}

/**
 * Authentic primary CS2 weapons for the live loadout showcase.
 * Matches user's real CS2 inventory:
 * - Primary Rifle: AK-47 | Ice Coaled (Minimal Wear, Float: 0.0825, Seed: 367)
 * - CT Rifle: StatTrak™ M4A1-S | Liquidation (Field-Tested, Float: 0.3438, Seed: 937)
 * - Sniper: AWP | Ice Coaled (Factory New, Float: 0.0631, Seed: 309)
 * - Sidearm: USP-S | Royal Guard (Factory New, Float: 0.0560, Seed: 644)
 * - Knife: ★ Nomad Knife | Blue Steel (Field-Tested, Float: 0.3652, Seed: 163)
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
  },
  {
    id: 'm4a4-cyber-security',
    slot: 'T Rifle',
    tabLabel: 'M4A4',
    name: 'M4A4 | Cyber Security (Minimal Wear)',
    weapon: 'M4A4',
    skin: 'Cyber Security',
    wear: 'Minimal Wear',
    wearShort: 'MW',
    float: 0.1447,
    seed: 320,
    rarity: 'Classified',
    rarityColor: '#d32ce6',
    color: '#d32ce6',
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
  },
  {
    id: '53997021184',
    slot: 'Knife',
    tabLabel: 'Knife',
    name: '★ Nomad Knife | Blue Steel (Field-Tested)',
    weapon: '★ Nomad Knife',
    skin: 'Blue Steel',
    wear: 'Field-Tested',
    wearShort: 'FT',
    float: 0.3652,
    seed: 163,
    rarity: '★ Extraordinary',
    rarityColor: '#ffd700',
    color: '#ffd700',
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

const WEAR_SEGMENTS = [
  { label: 'FN', from: 0, to: 0.07 },
  { label: 'MW', from: 0.07, to: 0.15 },
  { label: 'FT', from: 0.15, to: 0.38 },
  { label: 'WW', from: 0.38, to: 0.45 },
  { label: 'BS', from: 0.45, to: 1 },
];

/**
 * Float readout: one hairline track split at the wear brackets, a single tick for the value.
 */
export function FloatWearBar({ float }: { float: number }) {
  const clamped = Math.min(Math.max(float, 0), 1);
  const percent = getFloatPercentage(clamped);

  return (
    <div className="w-full">
      <div
        className="relative flex h-[6px] w-full gap-[2px]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-label="Float value"
      >
        {WEAR_SEGMENTS.map((s) => {
          const active = clamped >= s.from && (clamped < s.to || s.to === 1);
          return (
            <div
              key={s.label}
              style={{ width: `${(s.to - s.from) * 100}%` }}
              className={active ? 'bg-bone' : 'bg-rule-strong'}
              title={`${s.from.toFixed(2)} – ${s.to.toFixed(2)}`}
            />
          );
        })}
        <div
          className="pointer-events-none absolute -top-[5px] h-[16px] w-[2px] -translate-x-1/2 bg-signal"
          style={{ left: `${percent}%` }}
        />
      </div>
      <div className="num mt-2 flex justify-between text-[10px] uppercase tracking-wider text-ash-dim">
        {WEAR_SEGMENTS.map((s) => (
          <span key={s.label} style={{ width: `${(s.to - s.from) * 100}%` }}>
            {s.label}
          </span>
        ))}
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
 * Loadout: inspect stage on the left, weapon index on the right.
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
  const modelAssetUrl =
    activeWeapon.modelUrl ||
    getSkinCompatibleModelPath(activeWeapon.name, activeWeapon.skin);
  const textureUrl = useMemo(
    () => resolveSkinTextureUrl(activeWeapon.name, activeWeapon.skin),
    [activeWeapon.name, activeWeapon.skin]
  );

  return (
    <div className={`grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12 ${className}`}>
      {/* stage */}
      <div>
        <div className="relative h-[320px] overflow-hidden bg-ink-2 sm:h-[460px]">
          <ModelViewer
            modelUrl={modelAssetUrl}
            textureUrl={textureUrl}
            weaponName={activeWeapon.name}
            skinName={activeWeapon.skin}
            float={activeWeapon.float}
            seed={activeWeapon.seed}
            rarityColor={activeWeapon.rarityColor}
            className="h-full w-full"
            autoRotate={true}
            showControlsHint={true}
          />
          <span className="eyebrow pointer-events-none absolute left-4 top-4">{activeWeapon.slot}</span>
          <span
            className="num pointer-events-none absolute right-4 top-4 text-[11px] uppercase tracking-[0.16em]"
            style={{ color: activeWeapon.rarityColor }}
          >
            {activeWeapon.rarity}
          </span>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_minmax(0,20rem)] sm:items-end">
          <div className="min-w-0">
            <p className="text-[15px] text-ash">
              {activeWeapon.isStatTrak && <span className="mr-2 text-signal">StatTrak™</span>}
              {activeWeapon.weapon}
            </p>
            <h3 className="display mt-1 text-[clamp(2.25rem,5vw,3.75rem)]">{activeWeapon.skin}</h3>
            <p className="num mt-3 text-[12px] uppercase tracking-wider text-ash">
              {activeWeapon.wear} · float {activeWeapon.float.toFixed(4)} · {formatSeed(activeWeapon.seed).toLowerCase()}
            </p>
          </div>
          <FloatWearBar float={activeWeapon.float} />
        </div>
      </div>

      {/* index */}
      <div className="flex flex-col">
        <ul role="tablist" aria-label="Loadout slots" className="border-t border-rule">
          {weapons.map((w, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={w.id || w.name}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveIndex(index)}
                  className={`group flex w-full items-baseline gap-4 border-b border-rule py-4 text-left transition-colors ${
                    isActive ? 'text-bone' : 'text-ash hover:text-bone'
                  }`}
                >
                  <span className={`num w-6 text-[12px] ${isActive ? 'text-signal' : ''}`}>0{index + 1}</span>
                  <span className="display text-[clamp(1.6rem,3vw,2.25rem)]">{w.tabLabel}</span>
                  <span className="ml-auto truncate text-[14px]">{w.skin}</span>
                  <span
                    className="h-2 w-2 shrink-0 self-center rounded-full"
                    style={{ backgroundColor: isActive ? w.rarityColor : 'transparent', boxShadow: `inset 0 0 0 1px ${w.rarityColor}` }}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <a
          href={steamInventoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="u-link mt-6 self-start text-[15px] text-ash hover:text-bone"
        >
          steam inventory ↗
        </a>
      </div>
    </div>
  );
}

export { CS2LoadoutCard };
