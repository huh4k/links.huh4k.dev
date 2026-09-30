import { useEffect, useState } from 'react';
import type { SteamPresenceStatus } from '../../lib/types/steam';

interface SteamPresenceProps {
  /**
   * Display variant:
   * - 'badge': Compact status badge suitable for hero, navbar, or footer
   * - 'card': Rich widget with thumbnail and details
   */
  variant?: 'badge' | 'card';
  className?: string;
  initialStatus?: SteamPresenceStatus;
}

// Module-level shared presence state and singleton polling
// Eliminates duplicate requests from multiple component instances (navbar + profile)
let cachedStatus: SteamPresenceStatus | null = null;
let inflightPromise: Promise<SteamPresenceStatus> | null = null;
let activeInterval: ReturnType<typeof setInterval> | null = null;
let listenerAttached = false;
const listeners = new Set<(status: SteamPresenceStatus) => void>();

async function executeSharedFetch(): Promise<SteamPresenceStatus> {
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    try {
      const res = await fetch(`/api/steam/status.json?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SteamPresenceStatus;
      cachedStatus = data;
      listeners.forEach((callback) => callback(data));
      return data;
    } catch {
      const fallback: SteamPresenceStatus = cachedStatus || {
        state: 'offline',
        label: 'Offline',
        personaname: 'huh4k',
        avatarUrl: '',
        profileUrl: 'https://steamcommunity.com',
        lastUpdated: new Date().toISOString(),
      };
      cachedStatus = fallback;
      listeners.forEach((callback) => callback(fallback));
      return fallback;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

function startSharedPolling() {
  if (typeof window === 'undefined') return;
  if (!activeInterval) {
    activeInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        executeSharedFetch();
      }
    }, 30000);
  }
}

function stopSharedPolling() {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
}

function initVisibilityManager() {
  if (typeof document === 'undefined' || listenerAttached) return;
  listenerAttached = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      executeSharedFetch();
      startSharedPolling();
    } else {
      stopSharedPolling();
    }
  });
}

export default function SteamPresence({
  variant = 'badge',
  className = '',
  initialStatus,
}: SteamPresenceProps) {
  const [status, setStatus] = useState<SteamPresenceStatus | null>(
    initialStatus || cachedStatus || null
  );
  const [loading, setLoading] = useState(!initialStatus && !cachedStatus);

  useEffect(() => {
    initVisibilityManager();

    const handleUpdate = (updated: SteamPresenceStatus) => {
      setStatus(updated);
      setLoading(false);
    };

    listeners.add(handleUpdate);

    if (cachedStatus) {
      setStatus(cachedStatus);
      setLoading(false);
    } else {
      executeSharedFetch();
    }

    if (document.visibilityState === 'visible') {
      startSharedPolling();
    }

    return () => {
      listeners.delete(handleUpdate);
      if (listeners.size === 0) {
        stopSharedPolling();
      }
    };
  }, []);

  // Default offline fallback while loading
  const current = status || {
    state: 'offline' as const,
    label: 'Checking Steam...',
    personaname: 'huh4k',
    avatarUrl: '',
    profileUrl: 'https://steamcommunity.com',
    lastUpdated: '',
  };

  const isInGame = current.state === 'in-game';
  const isOnline = current.state === 'online';

  // State 1: In-Game Dot (Pulsing Green bg-emerald-500)
  // State 2: Online Dot (Blue bg-sky-500)
  // State 3: Offline Dot (Gray bg-zinc-500)
  const dotColor = isInGame ? 'bg-emerald-500' : isOnline ? 'bg-sky-500' : 'bg-zinc-500';
  const ringColor = isInGame ? 'bg-emerald-400' : isOnline ? 'bg-sky-400' : 'bg-zinc-400';

  if (variant === 'card') {
    return (
      <div
        className={`rounded-xl border border-dark-border bg-dark-card p-4 transition-all duration-300 hover:border-zinc-700/80 ${className}`}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isInGame && (
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ringColor}`}
                />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`} />
            </span>
            <span className="text-xs font-mono font-medium text-zinc-300">
              {loading ? 'Connecting to Steam...' : current.label}
            </span>
          </div>

          <a
            href={current.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Steam ↗
          </a>
        </div>

        {isInGame && current.game && (
          <div className="mt-3 overflow-hidden rounded-lg border border-dark-border bg-[#0d0f17]">
            <a
              href={current.game.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block relative overflow-hidden"
            >
              <img
                src={current.game.headerUrl}
                alt={current.game.title}
                loading="lazy"
                decoding="async"
                className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 flex flex-col justify-end">
                <span className="text-xs font-semibold text-white tracking-wide drop-shadow-md">
                  {current.game.title}
                </span>
                <span className="text-[11px] font-mono text-emerald-400">View on Steam Store ↗</span>
              </div>
            </a>
          </div>
        )}
      </div>
    );
  }

  // Default 'badge' variant
  return (
    <div className={`inline-flex flex-col sm:flex-row items-start sm:items-center gap-2 ${className}`}>
      <div
        className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border transition-all duration-200 text-xs font-mono ${
          isInGame
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-sm shadow-emerald-950/20'
            : isOnline
              ? 'border-sky-500/30 bg-sky-500/10 text-sky-300 shadow-sm shadow-sky-950/20'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-400'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {isInGame && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ringColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>

        <span className="truncate max-w-[220px] sm:max-w-xs">
          {loading ? 'Checking Steam...' : current.label}
        </span>

        {isInGame && current.game && (
          <a
            href={current.game.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 ml-1"
            title={`View ${current.game.title} on Steam`}
          >
            Store ↗
          </a>
        )}
      </div>

      {isInGame && current.game && (
        <a
          href={current.game.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex items-center gap-2 px-2 py-1 rounded-md border border-dark-border bg-dark-card hover:border-emerald-500/40 transition-colors"
          title={`Currently Playing ${current.game.title}`}
        >
          <img
            src={current.game.headerUrl}
            alt={current.game.title}
            loading="lazy"
            decoding="async"
            className="w-10 h-5 object-cover rounded"
          />
          <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[140px]">
            {current.game.title}
          </span>
        </a>
      )}
    </div>
  );
}
