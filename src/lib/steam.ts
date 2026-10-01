import type {
  SteamGetPlayerSummariesResponse,
  SteamGetOwnedGamesResponse,
  SteamPresenceStatus,
  SteamGame,
} from './types/steam';

const STEAM_API_BASE = 'https://api.steampowered.com';

// Default / fallback configurations
const DEFAULT_STEAM_ID = '76561198000000000';
const DEFAULT_PERSONA_NAME = 'huh4k';

// In-memory cache structures to avoid Valve rate limits
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let playerSummaryCache: CacheEntry<SteamPresenceStatus> | null = null;
const SUMMARY_CACHE_TTL_MS = 30 * 1000; // 30 seconds

let ownedGamesCache: CacheEntry<SteamGame[]> | null = null;
const OWNED_GAMES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Helper to safely retrieve environment variables across Node/Astro runtimes.
 * Never exposed to client bundles.
 */
export function getSteamApiKey(): string | undefined {
  return (
    process.env.STEAM_API_KEY ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.STEAM_API_KEY : undefined)
  );
}

export function getSteamId64(): string {
  const rawId = (
    process.env.STEAM_ID64 ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.STEAM_ID64 : undefined) ||
    DEFAULT_STEAM_ID
  );
  return /^\d{17,20}$/.test(rawId) ? rawId : DEFAULT_STEAM_ID;
}

/**
 * Curated fallback games library used when Steam API key is unset or API is unreachable.
 * Ensures the build and UI never fail.
 */
export const FALLBACK_GAMES: SteamGame[] = [
  {
    appId: 730,
    name: 'Counter-Strike 2',
    playtimeMinutes: 87420,
    playtimeHours: 1457,
    iconUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg',
    headerUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg',
    capsuleUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/capsule_616x353.jpg',
    storeUrl: 'https://store.steampowered.com/app/730/',
  },
  {
    appId: 284160,
    name: 'BeamNG.drive',
    playtimeMinutes: 14760,
    playtimeHours: 246,
    iconUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/284160/header.jpg',
    headerUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/284160/header.jpg',
    capsuleUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/284160/capsule_616x353.jpg',
    storeUrl: 'https://store.steampowered.com/app/284160/',
  },
  {
    appId: 620,
    name: 'Portal 2',
    playtimeMinutes: 5280,
    playtimeHours: 88,
    iconUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
    headerUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
    capsuleUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/620/capsule_616x353.jpg',
    storeUrl: 'https://store.steampowered.com/app/620/',
  },
  {
    appId: 220,
    name: 'Half-Life 2',
    playtimeMinutes: 3840,
    playtimeHours: 64,
    iconUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/220/header.jpg',
    headerUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/220/header.jpg',
    capsuleUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/220/capsule_616x353.jpg',
    storeUrl: 'https://store.steampowered.com/app/220/',
  },
  {
    appId: 2225070,
    name: 'Trackmania',
    playtimeMinutes: 7200,
    playtimeHours: 120,
    iconUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2225070/header.jpg',
    headerUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2225070/header.jpg',
    capsuleUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2225070/capsule_616x353.jpg',
    storeUrl: 'https://store.steampowered.com/app/2225070/',
  },
  {
    appId: 400,
    name: 'Portal',
    playtimeMinutes: 2100,
    playtimeHours: 35,
    iconUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/400/header.jpg',
    headerUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/400/header.jpg',
    capsuleUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/400/capsule_616x353.jpg',
    storeUrl: 'https://store.steampowered.com/app/400/',
  },
];

/**
 * Fetches the user's current live status / game presence.
 * Gracefully falls back to offline state on errors.
 */
export async function getPlayerSummary(
  customSteamId?: string,
  customApiKey?: string
): Promise<SteamPresenceStatus> {
  const now = Date.now();
  if (playerSummaryCache && now - playerSummaryCache.timestamp < SUMMARY_CACHE_TTL_MS) {
    return playerSummaryCache.data;
  }

  const apiKey = customApiKey || getSteamApiKey();
  const steamId = customSteamId || getSteamId64();

  const fallback: SteamPresenceStatus = {
    state: 'offline',
    label: 'Offline',
    personaname: DEFAULT_PERSONA_NAME,
    avatarUrl: '',
    profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
    lastUpdated: new Date().toISOString(),
  };

  if (!apiKey || !steamId) {
    return fallback;
  }

  try {
    const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!res.ok) {
      console.warn(`[Steam API] GetPlayerSummaries returned status ${res.status}`);
      return fallback;
    }

    const json = (await res.json()) as SteamGetPlayerSummariesResponse;
    const player = json.response?.players?.[0];

    if (!player) {
      return fallback;
    }

    let state: 'in-game' | 'online' | 'offline' = 'offline';
    let label = 'Offline';

    const isInGame = Boolean(player.gameextrainfo || (player.gameid && player.gameid !== '0'));
    const isOnline = player.personastate > 0;

    let gameInfo: SteamPresenceStatus['game'] = undefined;

    if (isInGame) {
      state = 'in-game';
      const gameTitle = player.gameextrainfo || 'Game';
      label = `Currently Playing: ${gameTitle}`;
      const appId = player.gameid || '730';
      gameInfo = {
        id: appId,
        title: gameTitle,
        headerUrl: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
        capsuleUrl: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_616x353.jpg`,
        storeUrl: `https://store.steampowered.com/app/${appId}/`,
      };
    } else if (isOnline) {
      state = 'online';
      label =
        player.personastate === 3
          ? 'Away on Steam'
          : player.personastate === 4
            ? 'Snooze on Steam'
            : 'Online on Steam';
    }

    const result: SteamPresenceStatus = {
      state,
      label,
      personaname: player.personaname || DEFAULT_PERSONA_NAME,
      avatarUrl: player.avatarfull || player.avatarmedium || player.avatar || '',
      profileUrl: player.profileurl || `https://steamcommunity.com/profiles/${steamId}`,
      game: gameInfo,
      lastUpdated: new Date().toISOString(),
    };

    playerSummaryCache = { data: result, timestamp: now };
    return result;
  } catch (error) {
    console.error('[Steam API] Error fetching player summary:', error);
    return fallback;
  }
}

/**
 * Fetches all owned games for the given Steam ID with total logged playtime.
 * Caches the result in memory for 24 hours to avoid Valve rate limits.
 */
export async function getOwnedGames(customSteamId?: string): Promise<SteamGame[]> {
  const now = Date.now();
  if (ownedGamesCache && now - ownedGamesCache.timestamp < OWNED_GAMES_CACHE_TTL_MS) {
    return ownedGamesCache.data;
  }

  const apiKey = getSteamApiKey();
  const steamId = customSteamId || getSteamId64();

  if (!apiKey || !steamId) {
    return FALLBACK_GAMES;
  }

  try {
    const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000), // 8 second timeout
    });

    if (!res.ok) {
      console.warn(`[Steam API] GetOwnedGames returned status ${res.status}`);
      return FALLBACK_GAMES;
    }

    const json = (await res.json()) as SteamGetOwnedGamesResponse;
    const rawGames = json.response?.games;

    if (!rawGames || !Array.isArray(rawGames) || rawGames.length === 0) {
      return FALLBACK_GAMES;
    }

    // Filter games with playtime, sort descending by playtime_forever
    const mappedGames: SteamGame[] = rawGames
      .filter((g) => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .map((g) => ({
        appId: g.appid,
        name: g.name,
        playtimeMinutes: g.playtime_forever,
        playtimeHours: Math.round(g.playtime_forever / 60),
        iconUrl: g.img_icon_url
          ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
          : `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`,
        headerUrl: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`,
        capsuleUrl: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${g.appid}/capsule_616x353.jpg`,
        storeUrl: `https://store.steampowered.com/app/${g.appid}/`,
      }));

    ownedGamesCache = { data: mappedGames, timestamp: now };
    return mappedGames;
  } catch (error) {
    console.error('[Steam API] Error fetching owned games:', error);
    return FALLBACK_GAMES;
  }
}

/**
 * Returns top played games up to the specified limit (defaults to 12).
 */
export async function getTopPlayedGames(limit: number = 12): Promise<SteamGame[]> {
  const games = await getOwnedGames();
  return games.slice(0, limit);
}
