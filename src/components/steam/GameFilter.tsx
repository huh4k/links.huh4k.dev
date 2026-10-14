import { useState, useMemo } from 'react';
import type { SteamGame } from '../../lib/types/steam';

interface GameFilterProps {
  games: SteamGame[];
}

type FilterKey = 'all' | '100h' | '500h';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',  label: 'all'     },
  { key: '100h', label: '100h+'  },
  { key: '500h', label: '500h+'  },
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
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full max-w-sm">
          <span className="eyebrow">search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="type a game"
            className="mt-2 w-full border-b border-rule-strong bg-transparent pb-2 text-xl text-bone placeholder-ash-dim transition-colors focus:border-signal focus:outline-none"
          />
        </label>

        <div className="flex gap-6 text-[15px]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`cursor-pointer pb-1 transition-colors ${
                filter === f.key ? 'text-bone shadow-[0_2px_0_0_#ff6a1a]' : 'text-ash hover:text-bone'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="num mt-8 text-[12px] uppercase tracking-wider text-ash">
        {filtered.length === 0 ? 'nothing matches' : `${filtered.length} of ${games.length} titles`}
      </p>

      {filtered.length === 0 ? (
        <div className="py-16">
          <button
            type="button"
            onClick={() => { setQuery(''); setFilter('all'); }}
            className="u-link cursor-pointer text-xl text-bone"
          >
            clear filters
          </button>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((game, i) => (
            <li key={game.appId}>
              <a href={game.storeUrl} target="_blank" rel="noopener noreferrer" className="group block">
                <div className="relative aspect-video overflow-hidden bg-ink-3">
                  <img
                    src={game.capsuleUrl || game.headerUrl}
                    alt={game.name}
                    loading="lazy"
                    decoding="async"
                    width={460}
                    height={215}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = game.headerUrl;
                    }}
                  />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-4">
                  <h3 className="truncate text-lg font-semibold tracking-tight transition-colors group-hover:text-signal">
                    {game.name}
                  </h3>
                  <span className="num shrink-0 text-[12px] text-ash">
                    {new Intl.NumberFormat('en-US').format(game.playtimeHours)}h
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
