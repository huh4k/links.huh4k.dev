import { useEffect, useState } from 'react';
import type { SteamPresenceStatus } from '../../lib/types/steam';

interface SteamPresenceProps {
  /**
   * Display variant:
   * - 'badge': Compact status text for the navbar
   * - 'line': One sentence for the hero ("playing X right now")
   * - 'card': Larger "right now" block with the game art when in-game
   */
  variant?: 'badge' | 'line' | 'card';
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
        label: 'Status unavailable',
        personaname: 'huh4k',
        avatarUrl: '',
        profileUrl: 'https://steamcommunity.com',
        lastUpdated: new Date().toISOString(),
        unavailable: true,
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
  const gameTitle = current.game?.title;

  // in-game = signal orange (the accent, "doing something"), online = green, offline = hollow
  const dot = (size: 'sm' | 'md') => {
    const box = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
    return (
      <span className={`relative inline-flex shrink-0 ${box}`} aria-hidden="true">
        {isInGame && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60`} />}
        <span
          className={`relative inline-flex rounded-full ${box} ${
            isInGame ? 'bg-signal' : isOnline ? 'bg-live' : 'border border-ash-dim bg-transparent'
          }`}
        />
      </span>
    );
  };

  const unavailable = !loading && !!current.unavailable;
  const stateWord = loading ? 'checking…' : isInGame ? 'in game' : isOnline ? 'online' : 'offline';

  // Never claim "offline" when we simply could not reach Steam: show nothing (or a plain link) instead
  if (unavailable && variant !== 'card') return null;

  if (variant === 'card') {
    return (
      <div className={`${className}`}>
        <div className="eyebrow flex items-center gap-2.5">
          {dot('sm')}
          <span>right now</span>
        </div>
        <p className="display mt-3 text-[clamp(2.25rem,5vw,3.75rem)] text-bone">
          {loading ? (
            'checking steam…'
          ) : unavailable ? (
            'status unavailable.'
          ) : isInGame && gameTitle ? (
            <>
              playing <span className="text-signal">{gameTitle}</span>
            </>
          ) : isOnline ? (
            'online, not in a game.'
          ) : (
            'offline.'
          )}
        </p>

        {isInGame && current.game && (
          <a
            href={current.game.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative mt-6 block aspect-[460/215] max-w-md overflow-hidden bg-ink-3"
          >
            <img
              src={current.game.headerUrl}
              alt={current.game.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="num absolute bottom-0 left-0 bg-ink px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-bone">
              open in store ↗
            </span>
          </a>
        )}

        <a
          href={current.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="u-link mt-6 inline-block text-[15px] text-ash hover:text-bone"
        >
          steam profile ↗
        </a>
      </div>
    );
  }

  if (variant === 'line') {
    return (
      <p className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-bone-soft ${className}`}>
        {dot('md')}
        {loading ? (
          <span>checking steam…</span>
        ) : isInGame && gameTitle ? (
          <span>
            playing{' '}
            <a
              href={current.game?.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="u-link text-bone hover:text-signal"
            >
              {gameTitle}
            </a>{' '}
            right now
          </span>
        ) : (
          <span>{isOnline ? 'online right now' : 'offline right now'}</span>
        )}
      </p>
    );
  }

  // Default 'badge' variant (navbar)
  return (
    <div className={`items-center gap-2 text-[13px] text-ash ${className || 'inline-flex'}`}>
      {dot('sm')}
      <span className="max-w-[160px] truncate">
        {isInGame && gameTitle ? (
          <>
            <span className="text-bone">{gameTitle}</span>
          </>
        ) : (
          stateWord
        )}
      </span>
    </div>
  );
}
