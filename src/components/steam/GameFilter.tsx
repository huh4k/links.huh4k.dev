import { useState, useMemo } from 'react';
import type { SteamGame } from '../../lib/types/steam';

interface GameFilterProps {
  games: SteamGame[];
}

type FilterKey = 'all' | '100h' | '500h';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',  label: '[All]'     },
  { key: '100h', label: '[> 100h]'  },
  { key: '500h', label: '[> 500h]'  },
];

export default function GameFilter({ games }: GameFilterProps) {
  const [query,  setQuery]  = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    let result = games;

    if (filter === '100h') result = result.filter((g) => g.playtimeHours >= 100);
    if (filter === '500h') result = result.filter((g) => g.playtimeHours >= 500);

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(q));
    }

    return result;
  }, [games, query, filter]);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-telemetry-blue select-none">{'>'}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games..."
            className="w-full bg-[#0F1118] border border-[#1E2333] hover:border-[#2E364F] focus:border-telemetry-blue/60 rounded-lg pl-8 pr-4 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg border transition-all tactile-btn cursor-pointer ${
                filter === f.key
                  ? 'border-telemetry-blue bg-telemetry-blue/15 text-telemetry-blue font-bold'
                  : 'border-[#1E2333] bg-[#0A0C12] text-zinc-400 hover:text-zinc-200 hover:border-[#2E364F]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-[11px] font-mono text-zinc-500">
        {filtered.length === 0
          ? 'No games match your filters.'
          : `Showing ${filtered.length} of ${games.length} titles`}
      </div>

      {/* Game grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#1E2333] bg-[#0F1118] p-8 text-center space-y-2">
          <p className="text-sm font-mono text-zinc-400">No games match your filters.</p>
          <button
            type="button"
            onClick={() => { setQuery(''); setFilter('all'); }}
            className="text-xs font-mono text-telemetry-blue hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((game) => (
            <a
              key={game.appId}
              href={game.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-[#1E2333] bg-[#0F1118] hover:border-telemetry-blue/50 transition-all overflow-hidden flex flex-col tactile-btn"
            >
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={game.capsuleUrl || game.headerUrl}
                  alt={game.name}
                  loading="lazy"
                  decoding="async"
                  width={460}
                  height={215}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = game.headerUrl;
                  }}
                />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 font-mono text-[9px] text-telemetry-green font-bold border border-white/10">
                  {new Intl.NumberFormat('en-US').format(game.playtimeHours)} hrs
                </div>
              </div>

              <div className="p-3 space-y-1.5 flex-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>App {game.appId}</span>
                  <span className="text-telemetry-blue group-hover:underline">Store ↗</span>
                </div>
                <h3 className="text-xs font-mono font-bold text-white group-hover:text-telemetry-blue transition-colors truncate">
                  {game.name}
                </h3>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
