/**
 * Steam Persona State enumeration
 * 0 - Offline, 1 - Online, 2 - Busy, 3 - Away, 4 - Snooze, 5 - looking to trade, 6 - looking to play
 */
export type SteamPersonaState = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Raw Valve API response for GetPlayerSummaries/v2
 */
export interface SteamPlayerSummaryRaw {
  steamid: string;
  communityvisibilitystate: number;
  profilestate?: number;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  avatarhash: string;
  personastate: SteamPersonaState;
  realname?: string;
  primaryclanid?: string;
  timecreated?: number;
  personastateflags?: number;
  loccountrycode?: string;
  gameid?: string;
  gameextrainfo?: string;
  gameserverip?: string;
}

export interface SteamGetPlayerSummariesResponse {
  response: {
    players?: SteamPlayerSummaryRaw[];
  };
}

/**
 * Raw Valve API item for GetOwnedGames/v1
 */
export interface SteamOwnedGameRaw {
  appid: number;
  name: string;
  playtime_forever: number; // in minutes
  img_icon_url: string;
  has_community_visible_stats?: boolean;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  playtime_deck_forever?: number;
  rtime_last_played?: number;
}

export interface SteamGetOwnedGamesResponse {
  response: {
    game_count?: number;
    games?: SteamOwnedGameRaw[];
  };
}

/**
 * Clean UI / API Presence State
 */
export type PresenceState = 'in-game' | 'online' | 'offline';

export interface SteamPresenceGame {
  id: string;
  title: string;
  headerUrl: string;
  capsuleUrl: string;
  storeUrl: string;
}

export interface SteamPresenceStatus {
  state: PresenceState;
  label: string;
  personaname: string;
  avatarUrl: string;
  profileUrl: string;
  game?: SteamPresenceGame;
  lastUpdated: string;
}

/**
 * Clean Game Library Model for UI
 */
export interface SteamGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  playtimeHours: number;
  iconUrl: string;
  headerUrl: string;
  capsuleUrl: string;
  storeUrl: string;
}
