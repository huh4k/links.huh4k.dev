/**
 * Steam Community API & CSFloat Inspect Data Pipeline Utilities
 */

import type {
  RawSteamDescription,
  RawSteamInventoryResponse,
  CSFloatItemInfo,
  CSFloatResponse,
  EnrichedInventoryItem,
} from '../types/inventory';

// Steam Economy CDN prefix
export const STEAM_ECON_CDN = 'https://community.cloudflare.steamstatic.com/economy/image/';

// CSFloat API rate limiting and defaults
const DEFAULT_CSFLOAT_API_BASE = 'https://api.csfloat.com/';
const CSFLOAT_RATE_LIMIT_MS = 600; // ~1.6 requests/second
let lastCSFloatCallTime = 0;

/**
 * Pure ES6 Map-based LRU Cache compatible with Cloudflare Pages / Web standard runtime.
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, { value: V; expiresAt: number }>;
  private defaultTtlMs: number;

  constructor(capacity = 500, defaultTtlMs = 24 * 60 * 60 * 1000) {
    this.capacity = capacity;
    this.defaultTtlMs = defaultTtlMs;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh position to mark as most recently used
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict oldest (first inserted in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Global LRU Cache for item float & paintseed data keyed by assetid.
 */
export const inventoryLRUCache = new LRUCache<string, { float: number | null; seed: number | null }>(500);

/**
 * Curated authentic fallback inventory used when Steam API is unreachable,
 * rate-limited (HTTP 429), or profile is private.
 */
export const FALLBACK_INVENTORY: EnrichedInventoryItem[] = [
  {
    id: '53621835969',
    name: 'Charm Detachment Pack',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJG51EejH_3R2smpNHKZ2kRw-Yji72bzThL9oYbh_ikVv6qqPPQ0JaOXCmWRl7shtbhsFnHlkxl16miGy477dnmQb1R2DpBzF_lK7EckGgI0TA`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%20AFBFAFB779898FAF87AE9FABC7AFDFB790B8826F',
    float: null,
    seed: null,
    rarity: 'Base Grade',
    rarityColor: '#b0c3d9',
    type: 'Tool',
  },
  {
    id: '53025617652',
    name: 'AK-47 | Ice Coaled (Minimal Wear)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSI_-UGm-Zz-llj-1gSCGn2x4l5z_RyNj6JXnEbgFzXMYjEOUIsBe5m9exP-zg4leMj4pGxXn7jCJXrnE84asPq_0`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%205545A1B89F9190544D5275A25D7D5065516D8CDEF1B85615BA5737505D5645C10237505D5745C10237505D5445C10237505D5545E5033D4A255DF754435D55457068D9065F1410A6C46C6A18C0C75F1535B7691615CA4F',
    float: 0.08253068,
    seed: 367,
    rarity: 'Classified',
    rarityColor: '#d32ce6',
    type: 'Rifle',
    certificate: '5545A1B89F9190544D5275A25D7D5065516D8CDEF1B85615BA5737505D5645C10237505D5745C10237505D5445C10237505D5545E5033D4A255DF754435D55457068D9065F1410A6C46C6A18C0C75F1535B7691615CA4F',
  },
  {
    id: '52875530986',
    name: 'USP-S | Royal Guard (Factory New)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkjYbf7itX6vytbbZSM_-WMWWc1OtJse9tcC68mRkYvzSCkpu3dymfbAUmWJAkQ-AI40Oxx9ezMrvl5gyLj41Nn3n6iHlKvXk9trpXUr1lpPMve4WI8Q`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%206A7A80CFE897AE6B72574AAB63426E5A6E52FFFFFF81692AEE6F086F62697ADA3C086F62687ADA3C086F626B7ADA3C02611A6EE925FBAC',
    float: 0.05597933,
    seed: 644,
    rarity: 'Restricted',
    rarityColor: '#8847ff',
    type: 'Pistol',
    certificate: '6A7A80CFE897AE6B72574AAB63426E5A6E52FFFFFF81692AEE6F086F62697ADA3C086F62687ADA3C086F626B7ADA3C02611A6EE925FBAC',
  },
  {
    id: '52540963003',
    name: 'UMP-45 | Late Night Transit (Battle-Scarred)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkk4a0qB1O4uKRfLZsLuOaGliYxO9gqa9qHyjnwx5252WAntv4I32ebAYgXsN3R-IOu0PrkoCyNe_j4gzajYhF02yg2W-yrQiG`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%205D4DE6ACE0809E5C45457DEE54755E6D5965CBDFA8A75E1DA55C352E2D59F2FB113D',
    float: 0.86427438,
    seed: 248,
    rarity: 'Mil-Spec Grade',
    rarityColor: '#4b69ff',
    type: 'SMG',
    certificate: '5D4DE6ACE0809E5C45457DEE54755E6D5965CBDFA8A75E1DA55C352E2D59F2FB113D',
  },
  {
    id: '52524526423',
    name: '2026 Service Medal',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai2l-lQ8ndwMWvJjSE4ERj_YTx1VTiRRz9ocSwr3Rk4-SiOeo5I_LHWzDHl7wh4rM4THq2kUkm5Tncytr8cSnCP1MjWMRyTeUNtBfqjJS5YFFs_eaW`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%20A8B87F7E7A7D6BA9B03E8188A880AE98ACC0A6D8A191591B16',
    float: null,
    seed: null,
    rarity: 'Extraordinary',
    rarityColor: '#eb4b4b',
    type: 'Collectible',
    certificate: 'A8B87F7E7A7D6BA9B03E8188A880AE98ACC0A6D8A191591B16',
  },
  {
    id: '52376414856',
    name: 'Graffiti | Still Happy (Frog Green)',
    iconUrl: `${STEAM_ECON_CDN}IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdB2ozio1RrlIWFK3UfvMYB8UsvjiMXojflsZalyxSh31CIyHz2GZ-KuFpPsrTzBG0qe6yD3n-ZDLdYSXcTVg9ROEKZ2HYqGHzsevASzHPSb0tEV8Cf6YN9W0fbJjbPEFo3Y8Vu2u_0UdyEhk6f9BKZAarxm1OZeV9znlCJw4ohmA`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%208B9B8B934E81AB8BA38ABB8FE98C838B9B3086BB82E38BFB939EC5EE9A',
    float: null,
    seed: null,
    rarity: 'Base Grade',
    rarityColor: '#b0c3d9',
    type: 'Graffiti',
  },
  {
    id: '52289606446',
    name: 'StatTrak™ M4A1-S | Liquidation (Field-Tested)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwjFS4_ega6F_H_3HDzaD_v9jueJicCW6hAgutzyRk4D3HibCOl9lV4x4ELNfsBe5kYLjMejitFeMi49Gyyz93SJB7nlttuhRA_Im-6GGjwuTL_Rjtu8gPRgx`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%206676C8C0B683A4677E5A46DA6C4E62566F5ECCEAA6936526CF612E6636BF6404636E6576D63004636E6776D63004636E6476D63004636E6676D6300E6F166EC110888B',
    float: 0.34379703,
    seed: 937,
    rarity: 'Restricted',
    rarityColor: '#8847ff',
    type: 'Rifle',
    certificate: '6676C8C0B683A4677E5A46DA6C4E62566F5ECCEAA6936526CF612E6636BF6404636E6576D63004636E6776D63004636E6476D63004636E6676D6300E6F166EC110888B',
  },
  {
    id: '49958764612',
    name: 'Graffiti | Worry (Shark White)',
    iconUrl: `${STEAM_ECON_CDN}IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdB2ozio1RrlIWFK3UfvMYB8UsvjiMXojflsZalyxSh31CIyHz2GZ-KuFpPsrTzBG0qu-2BnqWZDG1ZCHcTFw8QOUJYWWP-mr3sebATTSdF70pFV9TfavP9mpqbZfbbgNu0d8D-D-010x1BBl-f8tPd1X6xWkfNOkuzWwRdwg5jGA`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%208B9B8B934E81AB8BA38ABB8FE98C838B9B3086BB82E38BFB939EC5EE9A',
    float: null,
    seed: null,
    rarity: 'Base Grade',
    rarityColor: '#b0c3d9',
    type: 'Graffiti',
  },
  {
    id: '49698007093',
    name: 'Graffiti | Sorry (War Pig Pink)',
    iconUrl: `${STEAM_ECON_CDN}IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdB2ozio1RrlIWFK3UfvMYB8UsvjiMXojflsZalyxSh31CIyHz2GZ-KuFpPsrTzBG0-ua7DW2bbzXfaXHcTFs_QOUJYWWP_m31sePFSTWeFbkpFl0EevfMoGBuYZ-PPwdr3Y0BuDu6kx1zFRh4fchPYVf8kmhMY-J8mSpFd1x8jGA`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%208B9B8B934E81AB8BA38ABB8FE98C838B9B3086BB82E38BFB939EC5EE9A',
    float: null,
    seed: null,
    rarity: 'Base Grade',
    rarityColor: '#b0c3d9',
    type: 'Graffiti',
  },
  {
    id: '47999077235',
    name: 'Graffiti | Karambit (Frog Green)',
    iconUrl: `${STEAM_ECON_CDN}IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdB2ozio1RrlIWFK3UfvMYB8UsvjiMXojflsZalyxSh31CIyHz2GZ-KuFpPsrTzBG0qe6yD3n-ZDLdYSXcTVg9ROEKZ2HYp2mwsurCRm_ESugpRQwBfq0P9W5ubZ7abgNvhIoB-m-wwkZyEhk6f9BKZAarxm1OZeV9znlCJw4ohmA`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%208B9B8B934E81AB8BA38ABB8FE98C838B9B3086BB82E38BFB939EC5EE9A',
    float: null,
    seed: null,
    rarity: 'Base Grade',
    rarityColor: '#b0c3d9',
    type: 'Graffiti',
  },
  {
    id: '47332299089',
    name: 'Galil AR | Control (Field-Tested)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8k4av1A1V3_6tb6xHIf-WEmeax-phrehnQHG2kgFzv2LWyN2n0HnBOAMoD5EkROUNsBfomNXsZ-vg4gfcj41BwnqmgSUF6-9f45tE`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%20514180F3B7F8E150495C71F0587955615569DCD6EEA55211D5533950215569731DC5',
    float: 0.28078881,
    seed: 260,
    rarity: 'Restricted',
    rarityColor: '#8847ff',
    type: 'Rifle',
    certificate: '514180F3B7F8E150495C71F0587955615569DCD6EEA55211D5533950215569731DC5',
  },
  {
    id: '47091037562',
    name: 'Zeus x27 | Electric Blue (Minimal Wear)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkk4fU2A8_3_2kbKhbM_-WFDWdxf1g4rtvEnq2kxRz6GqGyd2o0HnCPgMtU5N6Q-AItUPrw4XvZuvh4gfZgopBw3_6234Lp39G9oR9p-s`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%204454BEAEA4F2EB455C5B64B04D6C4674407CC09EE4A94704BA4526504C44549B786944443405791590717B0151C8AD7A2C45345CAE84DA30',
    float: 0.08211711,
    seed: 254,
    rarity: 'Industrial Grade',
    rarityColor: '#5e98d9',
    type: 'Equipment',
    certificate: '4454BEAEA4F2EB455C5B64B04D6C4674407CC09EE4A94704BA4526504C44549B786944443405791590717B0151C8AD7A2C45345CAE84DA30',
  },
  {
    id: '53778348583',
    name: 'AWP | Ice Coaled (Factory New)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8lcK_wCVB4uKRfLZsLuOaGliYxOxjr7xrSSmzkRFzvmiHyd-vj3-fbAUiWsA3RuMNsUOskde9Zuvj4gfcjYpCxXqmgSVTj0t0pUo`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%200818AFFCC9A3C009100128CA02200D380C3082848DE40B48BD0A6018780025C13510',
    float: 0.06312187,
    seed: 309,
    rarity: 'Classified',
    rarityColor: '#d32ce6',
    type: 'Sniper Rifle',
    certificate: '0818AFFCC9A3C009100128CA02200D380C3082848DE40B48BD0A6018780025C13510',
  },
  {
    id: '46795366284',
    name: 'SSG 08 | Rapid Transit (Minimal Wear)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLklYe6qiFT4_epbaVaI--WESWfwehjsehsGS2mkwRzuGiGyN6r0HmBP1MjA8R7E7INtELqy4XqZuvh4gaLgY9Bwnq46p18vD4`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%20B7A73B08551E19B6AF9F9737B69FB387B38F31293A5AB4F73EB3DFB6C7BFE1EE345F',
    float: 0.07974057,
    seed: 521,
    rarity: 'Restricted',
    rarityColor: '#8847ff',
    type: 'Sniper Rifle',
    certificate: 'B7A73B08551E19B6AF9F9737B69FB387B38F31293A5AB4F73EB3DFB6C7BFE1EE345F',
  },
  {
    id: '46364907601',
    name: 'Souvenir MAG-7 | Irradiated Alert (Field-Tested)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkn4amwCtT4vytbbZSM_-WGzDFkbhh5-pnHCHmkBtz6D6Gy9_403mbbgE_DJZwEeQI50OxmdaxNeji4waIjohDxHrr2n0D4m-rF7g`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%2080905130415C2C81989BA02B81A881B08CB87D61717483C06F85E29488809055829D80808080A5808000BFAD80808080E29488839049829D80808080A5808000BFAD80808080E881F088E9D19D38',
    float: 0.30554953,
    seed: 751,
    rarity: 'Consumer Grade',
    rarityColor: '#b0c3d9',
    type: 'Shotgun',
    certificate: '80905130415C2C81989BA02B81A881B08CB87D61717483C06F85E29488809055829D80808080A5808000BFAD80808080E29488839049829D80808080A5808000BFAD80808080E881F088E9D19D38',
  },
  {
    id: '46356592963',
    name: 'StatTrak™ Glock-18 | Catacombs (Field-Tested)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkhYe3qCZV3_2tb6pQI_-WFDWeve8hsehtSi2zlkh45D6Dy9_20X2dbAYpWMRzTuYJ50PrkdaxZ-jg4gfcjo5Bw3rqm_R6UoI`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%206171A293A4B9CD60796541EE624962516859D29C90936221F166296131B8600364696371B36309601169D0FA8F51',
    float: 0.21532707,
    seed: 912,
    rarity: 'Mil-Spec Grade',
    rarityColor: '#4b69ff',
    type: 'Pistol',
    certificate: '6171A293A4B9CD60796541EE624962516859D29C90936221F166296131B8600364696371B36309601169D0FA8F51',
  },
  {
    id: '45618309698',
    name: 'Desert Eagle',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLkxYff6B1X4_yqa6pUI-uWE2fHk7tmsu1mR3G3kBZyvGKEyd-r3n-faFYnWsB2R-gIsELrxdawZuvh4gfcjI5Bwnqu1q94w-M`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%20A4B46670645C0DA5BCA584A48CA494A0C6B0ACA7B47B9889A4A4AEE799857BB29BE19D72349ACCA6D4B2A49A134C',
    float: null,
    seed: null,
    rarity: 'Stock',
    rarityColor: '#ded6cc',
    type: 'Pistol',
    certificate: 'A4B46670645C0DA5BCA584A48CA494A0C6B0ACA7B47B9889A4A4AEE799857BB29BE19D72349ACCA6D4B2A49A134C',
  },
  {
    id: '45369276962',
    name: 'Graffiti | Uh Oh (Cash Green)',
    iconUrl: `${STEAM_ECON_CDN}IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdB2ozio1RrlIWFK3UfvMYB8UsvjiMXojflsZalyxSh31CIyHz2GZ-KuFpPsrTzBG0-ua7DW2bbzXeaHHZRFs6QuMLZmWN-mzxs-fDFnWeE70uQVlXevbe8zVrbpmLbgM-1YwB-2ug0EhyEhk6f9BKZAarxm1OZeV9znlCJw4ohmA`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%208B9B8B934E81AB8BA38ABB8FE98C838B9B3086BB82E38BFB939EC5EE9A',
    float: null,
    seed: null,
    rarity: 'Base Grade',
    rarityColor: '#b0c3d9',
    type: 'Graffiti',
  },
  {
    id: '45171613266',
    name: 'Premier Season Two Medal',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai2l-lQ8ndwMWvJjSE4ERj_YTx1VTiRRz5oMSpknRm0-i3O_g4I-eXFTGfxf5g47trEnq2lB106T6Gyo6nj3jGPwMsWMAwTeYJ50KxkNflMuv44gfbxYlCwnrhk3Nq6Z-5Y4Jg`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%20EDFD3F512D4E45ECF568CACDEDC5EBDDE985EA9DE4F14FF565',
    float: null,
    seed: null,
    rarity: 'Extraordinary',
    rarityColor: '#eb4b4b',
    type: 'Collectible',
    certificate: 'EDFD3F512D4E45ECF568CACDEDC5EBDDE985EA9DE4F14FF565',
  },
  {
    id: '44934195295',
    name: 'MAC-10 | Candy Apple (Factory New)',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLknIazryFT5vytbbZSM_-WGTDFx-tjsephQSGykhdzuGLWytr2in7EPlUkBcU6RLAIsBe8mNeyNr7v4gbbj41Cwnru11gJgT8`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%2048589798EDFAEF495059684B604A784C70BFC5C8A04B088F4E2A42404858C576551AF056772A42404A58C576551AF056772A42404B58C576551AF05677204938506DFC957C',
    float: 0.03125664,
    seed: 839,
    rarity: 'Industrial Grade',
    rarityColor: '#5e98d9',
    type: 'SMG',
    certificate: '48589798EDFAEF495059684B604A784C70BFC5C8A04B088F4E2A42404858C576551AF056772A42404A58C576551AF056772A42404B58C576551AF05677204938506DFC957C',
  },
  {
    id: '43826539097',
    name: '5 Year Veteran Coin',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai2l-lQ8ndwMWvJjSE4ERj_YTx1VTiRRz_p8exrHRn3_i1b7A4Ju6XFTeekPtg475tQSG1lBN14TuHyNupjHnGPgMoWpdwE-Ff50O9mda_NeP44gfbwohBwnrgk7_YQzM`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%2096864F42193435978E7C90B696BE90A692FEADE6963D7BEA0E',
    float: null,
    seed: null,
    rarity: 'Extraordinary',
    rarityColor: '#eb4b4b',
    type: 'Collectible',
    certificate: '96864F42193435978E7C90B696BE90A692FEADE6963D7BEA0E',
  },
  {
    id: '42276027396',
    name: 'CZ75-Auto',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLki4e0-SdS3fytbbZSM_-WGzDFxe5hse1gTCa2xghzuGLWyt7y3n7EeAIsBcU6TuAIskDrxNK8Muv44gfbw4hFwnrguG94Q14`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%206F7FEB978CD1F26E77504F6F476F5F6B0D60676E7FE75B52E30253512A6FF85D530D60676F7FBA2D526BC8DE512AEF794DD40D60676F7FCF5B527B6BD8512ADF1BF5530D60676F7FFB5B52313BD6512AAFF73C530D60676B7FC35B52C782C8532AAF6E66D207631F79718069F8',
    float: null,
    seed: null,
    rarity: 'Stock',
    rarityColor: '#ded6cc',
    type: 'Pistol',
    certificate: '6F7FEB978CD1F26E77504F6F476F5F6B0D60676E7FE75B52E30253512A6FF85D530D60676F7FBA2D526BC8DE512AEF794DD40D60676F7FCF5B527B6BD8512ADF1BF5530D60676F7FFB5B52313BD6512AAFF73C530D60676B7FC35B52C782C8532AAF6E66D207631F79718069F8',
  },
  {
    id: '41792171268',
    name: '2025 Service Medal',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai2l-lQ8ndwMWvJjSE4ERj_YTx1VTiRRz8psSmkXRn4_egbKg6Ju6XFDOek_lg4rtvS3G0kRV15T-HyN6t03jBPlIqD8F0TeINtBfqmdawMuvi4gbbxIhBwnr11a-W3Qk`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%202636A2FCA1FEBD273EFE0006260E2016224E3F562FA5A3C3C6',
    float: null,
    seed: null,
    rarity: 'Extraordinary',
    rarityColor: '#eb4b4b',
    type: 'Collectible',
    certificate: '2636A2FCA1FEBD273EFE0006260E2016224E3F562FA5A3C3C6',
  },
  {
    id: '41636214531',
    name: 'Premier Season One Medal',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai2l-lQ8ndwMWvJjSE4ERj_YTx1VTiRRz5oMSpknRm0-i3O_g4I-eXFTGfxf5g47trEnq2lB106T6Gyo6nj3jGPwMsWMAwTeYJ50KxkNflMuv44gfbxYlCwnrhk3Nq6Z-5Y4Jg`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%20978714794F1A0C968F6DB1B797BF91A793FF94E79E32F52CC8',
    float: null,
    seed: null,
    rarity: 'Extraordinary',
    rarityColor: '#eb4b4b',
    type: 'Collectible',
    certificate: '978714794F1A0C968F6DB1B797BF91A793FF94E79E32F52CC8',
  },
  {
    id: '33656197185',
    name: 'Music Kit | Valve, CS:GO',
    iconUrl: `${STEAM_ECON_CDN}IzMF03bi9WpSBq-S-ekoE33L-iLqGFHVaU25ZzQNQcXdB2ozio1RrlIWFK3UfvMYB8UsvjiMXojflsZalyxSh31CIyHz2GZ-KuFpPsrTzBG0-ua7DW2bbzXfaXHcTFs_QOUJYWWP_m31sePFSTWeFbkpFl0EevfMoGBuYZ-PPwdr3Y0BuDu6kx1zFRh4fchPYVf8kmhMY-J8mSpFd1x8jGA`,
    inspectUrl: null,
    float: null,
    seed: null,
    rarity: 'High Grade',
    rarityColor: '#4b69ff',
    type: 'Music Kit',
  },
  {
    id: '33656197184',
    name: 'Global Offensive Badge',
    iconUrl: `${STEAM_ECON_CDN}i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai2l-lQ8ndwMWvJjSE4ERj_YTx1VTiRRz_p8ehn3Rk0_ioOLJSI_eXF2fAxexg47lsEi20k0Ry5W-GyN-r2nnBPgcsU5B1ELBfsBerjtfjNuvh4gfZgI1CxHrv1aG8y90`,
    inspectUrl: 'steam://run/730//+csgo_econ_action_preview%20F3E3335330438EEB17F4D3F3DBF5C3F79BE783F3E42D7F89',
    float: null,
    seed: null,
    rarity: 'Extraordinary',
    rarityColor: '#eb4b4b',
    type: 'Collectible',
    certificate: 'F3E3335330438EEB17F4D3F3DBF5C3F79BE783F3E42D7F89',
  },
  {
    id: 'knife-karambit-doppler',
    name: '★ Karambit | Doppler',
    iconUrl: `${STEAM_ECON_CDN}-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf1ObcTj5X09ujgL-HmOXxDLfYkWNF18l4jeHVu4qiiQCx_0ZsNT-nIdTBdQdoYQ7V_lC8yL_p15e_tZzMnSRh7HYn-z-DyG2qM4Y1`,
    inspectUrl: 'steam://rungame/730/76561202255234564/+csgo_econ_action_preview%20S76561198920486334A31459265361D14432168987455850904',
    float: 0.00891244,
    seed: 399,
    rarity: '★ Extraordinary',
    rarityColor: '#ffd700',
    type: 'Knife',
  },
];

// Seed initial fallback items into LRU cache
for (const fallbackItem of FALLBACK_INVENTORY) {
  if (fallbackItem.float !== null && fallbackItem.seed !== null) {
    inventoryLRUCache.set(fallbackItem.id, {
      float: fallbackItem.float,
      seed: fallbackItem.seed,
    });
  }
}

/**
 * Replaces `%owner_steamid%`, `%assetid%`, and `%propid:6%` in raw Steam inspect action links.
 */
export function formatInspectUrl(
  rawLink: string,
  steamId64: string,
  assetId: string,
  certHash?: string | null
): string {
  if (!rawLink) return '';
  let formatted = rawLink
    .replaceAll('%owner_steamid%', steamId64)
    .replaceAll('%assetid%', assetId);
  if (certHash) {
    formatted = formatted.replaceAll('%propid:6%', certHash);
  }
  return formatted;
}

/**
 * Normalizes Steam relative image hashes into full CDN URLs.
 */
export function formatEconomyImageUrl(iconUrl: string): string {
  if (!iconUrl) return '';
  if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://')) {
    return iconUrl;
  }
  return `${STEAM_ECON_CDN}${iconUrl}`;
}

/**
 * Extracts rarity tier name and color from Steam item tags.
 * Fixes collection tag collision by excluding ItemSet from rarity resolution.
 */
export function getRarityFromTags(tags?: RawSteamDescription['tags']): {
  rarity: string;
  rarityColor?: string;
} {
  if (!tags || !Array.isArray(tags)) {
    return { rarity: 'Base Grade', rarityColor: '#b0c3d9' };
  }

  // Exclude ItemSet so collection tags don't collide with rarity
  const rarityTag = tags.find(
    (t) => t.category === 'Rarity' || (t.internal_name && t.internal_name.startsWith('Rarity_'))
  );

  if (!rarityTag) {
    return { rarity: 'Base Grade', rarityColor: '#b0c3d9' };
  }

  const rarity = rarityTag.localized_tag_name || rarityTag.internal_name || 'Base Grade';
  let rarityColor = rarityTag.color ? `#${rarityTag.color.replace(/^#/, '')}` : undefined;

  if (!rarityColor) {
    const lower = rarity.toLowerCase();
    if (lower.includes('contraband')) {
      rarityColor = '#e4ae39';
    } else if (lower.includes('★') || (lower.includes('extraordinary') && (lower.includes('knife') || lower.includes('glove')))) {
      rarityColor = '#ffd700';
    } else if (lower.includes('covert') || lower.includes('extraordinary')) {
      rarityColor = '#eb4b4b';
    } else if (lower.includes('classified')) {
      rarityColor = '#d32ce6';
    } else if (lower.includes('restricted')) {
      rarityColor = '#8847ff';
    } else if (lower.includes('mil-spec') || lower.includes('high grade')) {
      rarityColor = '#4b69ff';
    } else if (lower.includes('industrial')) {
      rarityColor = '#5e98d9';
    } else if (lower.includes('consumer')) {
      rarityColor = '#b0c3d9';
    } else if (lower.includes('stock') || lower.includes('default')) {
      rarityColor = '#ded6cc';
    } else {
      rarityColor = '#b0c3d9';
    }
  }

  return { rarity, rarityColor };
}

/**
 * Extracts weapon/item type from tags or type string.
 */
export function getTypeFromTags(tags?: RawSteamDescription['tags'], typeStr?: string): string {
  if (tags && Array.isArray(tags)) {
    const typeTag = tags.find((t) => t.category === 'Type');
    if (typeTag?.localized_tag_name) {
      return typeTag.localized_tag_name;
    }
    const weaponTag = tags.find((t) => t.category === 'Weapon');
    if (weaponTag?.localized_tag_name && (!typeStr || typeStr === 'Weapon')) {
      return weaponTag.localized_tag_name;
    }
  }

  if (typeStr) {
    const lower = typeStr.toLowerCase();
    if (lower.includes('gloves') || lower.includes('hand wraps')) return 'Gloves';
    if (lower.includes('knife') || lower.includes('karambit') || lower.includes('bayonet') || lower.includes('daggers') || (typeStr.includes('★') && !lower.includes('glove'))) return 'Knife';
    if (lower.includes('sniper rifle') || lower.includes('sniper')) return 'Sniper Rifle';
    if (lower.includes('rifle')) return 'Rifle';
    if (lower.includes('pistol')) return 'Pistol';
    if (lower.includes('smg')) return 'SMG';
    if (lower.includes('shotgun')) return 'Shotgun';
    if (lower.includes('machinegun')) return 'Machinegun';
    if (lower.includes('container') || lower.includes('case')) return 'Container';
    if (lower.includes('sticker')) return 'Sticker';
    if (lower.includes('graffiti')) return 'Graffiti';
    if (lower.includes('collectible') || lower.includes('medal') || lower.includes('coin') || lower.includes('badge')) return 'Collectible';
    if (lower.includes('tool')) return 'Tool';
    if (lower.includes('equipment') || lower.includes('taser')) return 'Equipment';
    if (lower.includes('music kit')) return 'Music Kit';
    if (lower.includes('agent')) return 'Agent';
    return typeStr;
  }

  return 'Weapon';
}

/**
 * Throttles execution to prevent exceeding CSFloat rate limits (~1.6 req/s).
 */
async function waitForCSFloatThrottle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCSFloatCallTime;
  if (elapsed < CSFLOAT_RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, CSFLOAT_RATE_LIMIT_MS - elapsed));
  }
  lastCSFloatCallTime = Date.now();
}

/**
 * Queries the CSFloat inspect endpoint for weapon wear float and paint seed.
 */
export async function fetchCSFloatInspect(inspectUrl: string): Promise<CSFloatItemInfo | null> {
  if (!inspectUrl) return null;

  try {
    const apiBase =
      (typeof process !== 'undefined' && process.env?.CSFLOAT_API_BASE) || DEFAULT_CSFLOAT_API_BASE;
    const cleanBase = apiBase.replace(/\/+$/, '');
    const url = `${cleanBase}/?url=${encodeURIComponent(inspectUrl)}`;

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'huh4k-links/1.0.0',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`[CSFloat API] Inspect request returned status ${res.status}`);
      return null;
    }

    const data = (await res.json()) as CSFloatResponse;

    const floatvalue =
      data.iteminfo?.floatvalue ??
      data.item?.float_value ??
      data.item?.floatvalue ??
      data.floatvalue ??
      null;

    const paintseed =
      data.iteminfo?.paintseed ??
      data.item?.paint_seed ??
      data.item?.paintseed ??
      data.paintseed ??
      null;

    const paintindex =
      data.iteminfo?.paintindex ??
      data.item?.paint_index ??
      data.item?.paintindex ??
      data.paintindex ??
      null;

    return {
      floatvalue: floatvalue !== null ? Number(floatvalue) : undefined,
      paintseed: paintseed !== null ? Number(paintseed) : undefined,
      paintindex: paintindex !== null ? Number(paintindex) : undefined,
      defindex: data.iteminfo?.defindex,
      quality: data.iteminfo?.quality,
      rarity: data.iteminfo?.rarity,
      origin: data.iteminfo?.origin,
      itemid: data.iteminfo?.itemid,
    };
  } catch (error) {
    console.warn('[CSFloat API] Error fetching inspect info:', error);
    return null;
  }
}

/**
 * Enriches an item with float wear and seed via CSFloat, utilizing the LRU cache.
 */
export async function enrichWithCSFloat(item: EnrichedInventoryItem): Promise<EnrichedInventoryItem> {
  if (!item.inspectUrl) {
    return { ...item, float: null, seed: null };
  }

  // Check LRU cache first
  const cached = inventoryLRUCache.get(item.id);
  if (cached !== undefined) {
    return {
      ...item,
      float: cached.float,
      seed: cached.seed,
    };
  }

  // Rate limit throttle
  await waitForCSFloatThrottle();

  const csfloatData = await fetchCSFloatInspect(item.inspectUrl);
  const float = csfloatData?.floatvalue ?? null;
  const seed = csfloatData?.paintseed ?? null;

  inventoryLRUCache.set(item.id, { float, seed });

  return {
    ...item,
    float,
    seed,
  };
}

/**
 * Enriches an array of inventory items with CSFloat data up to a max batch size.
 */
export async function enrichInventory(
  items: EnrichedInventoryItem[],
  maxEnrich = 15
): Promise<EnrichedInventoryItem[]> {
  const result: EnrichedInventoryItem[] = [];
  let enrichedCount = 0;

  for (const item of items) {
    if (item.inspectUrl && item.float === null && enrichedCount < maxEnrich) {
      const enriched = await enrichWithCSFloat(item);
      result.push(enriched);
      enrichedCount++;
    } else if (item.inspectUrl && item.float === null && inventoryLRUCache.has(item.id)) {
      // If already cached, populate without consuming enrichment quota
      const cached = inventoryLRUCache.get(item.id);
      result.push({
        ...item,
        float: cached?.float ?? null,
        seed: cached?.seed ?? null,
      });
    } else {
      result.push(item);
    }
  }

  return result;
}

/**
 * Fetches user CS2 inventory from Steam Community endpoint.
 * Gracefully falls back to FALLBACK_INVENTORY on private profiles, rate limits (HTTP 429), or network errors.
 */
export async function fetchCS2Inventory(
  steamId64: string,
  _apiKey?: string
): Promise<EnrichedInventoryItem[]> {
  // Validate steamId64 format
  if (!steamId64 || !/^\d{17,20}$/.test(steamId64)) {
    console.warn(`[Steam Inventory] Invalid Steam ID format: "${steamId64}". Using fallback inventory.`);
    return FALLBACK_INVENTORY;
  }

  const endpoint = `https://steamcommunity.com/inventory/${steamId64}/730/2?l=english&count=100`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401 || res.status === 403) {
      console.warn(`[Steam Inventory] Profile ${steamId64} is private (status ${res.status}). Using fallback inventory.`);
      return FALLBACK_INVENTORY;
    }

    if (res.status === 429) {
      console.warn(`[Steam Inventory] Hit Steam Community rate limit (429). Using fallback inventory.`);
      return FALLBACK_INVENTORY;
    }

    if (!res.ok) {
      console.warn(`[Steam Inventory] Request failed with status ${res.status}. Using fallback inventory.`);
      return FALLBACK_INVENTORY;
    }

    const data = (await res.json()) as RawSteamInventoryResponse;

    if (!data.assets || !data.descriptions || data.assets.length === 0) {
      console.warn('[Steam Inventory] Response contains empty assets. Using fallback inventory.');
      return FALLBACK_INVENTORY;
    }

    // Build description lookup map
    const descMap = new Map<string, RawSteamDescription>();
    for (const desc of data.descriptions) {
      descMap.set(`${desc.classid}_${desc.instanceid}`, desc);
      if (desc.instanceid === '0') {
        descMap.set(desc.classid, desc);
      }
    }

    // Parse root data.asset_properties
    const assetPropMap = new Map<
      string,
      { float: number | null; seed: number | null; certificate: string | null }
    >();

    if (Array.isArray(data.asset_properties)) {
      for (const entry of data.asset_properties) {
        if (!entry.assetid || !Array.isArray(entry.asset_properties)) continue;
        let float: number | null = null;
        let seed: number | null = null;
        let certificate: string | null = null;

        for (const prop of entry.asset_properties) {
          if (prop.propertyid === 1) {
            const val = prop.int_value !== undefined ? parseInt(String(prop.int_value), 10) : null;
            if (val !== null && !Number.isNaN(val)) seed = val;
          } else if (prop.propertyid === 2) {
            const val = prop.float_value !== undefined ? parseFloat(String(prop.float_value)) : null;
            if (val !== null && !Number.isNaN(val)) float = val;
          } else if (prop.propertyid === 6 && prop.string_value) {
            certificate = String(prop.string_value);
          }
        }

        assetPropMap.set(entry.assetid, { float, seed, certificate });

        // Pre-seed into inventoryLRUCache for 0ms re-lookups
        if (float !== null || seed !== null) {
          inventoryLRUCache.set(entry.assetid, { float, seed });
        }
      }
    }

    const items: EnrichedInventoryItem[] = [];

    for (const asset of data.assets) {
      const descKey = `${asset.classid}_${asset.instanceid}`;
      const desc = descMap.get(descKey) || descMap.get(asset.classid);
      if (!desc) continue;

      const propData = assetPropMap.get(asset.assetid);

      // Extract inspect link if available
      const inspectAction = desc.actions?.find(
        (a) =>
          a.link &&
          (a.link.includes('+csgo_econ_action_preview') ||
            a.link.includes('%owner_steamid%') ||
            a.link.includes('%propid:6%'))
      );
      const inspectUrl = inspectAction
        ? formatInspectUrl(inspectAction.link, steamId64, asset.assetid, propData?.certificate)
        : null;

      const { rarity, rarityColor } = getRarityFromTags(desc.tags);
      const type = getTypeFromTags(desc.tags, desc.type);
      const iconUrl = formatEconomyImageUrl(desc.icon_url_large || desc.icon_url);
      const name = desc.market_name || desc.name || 'Counter-Strike 2 Item';

      // Check asset_properties first, then fallback to LRU cache
      const cached = inventoryLRUCache.get(asset.assetid);
      const float =
        propData?.float !== undefined && propData?.float !== null
          ? propData.float
          : (cached?.float ?? null);
      const seed =
        propData?.seed !== undefined && propData?.seed !== null
          ? propData.seed
          : (cached?.seed ?? null);

      if ((float !== null || seed !== null) && !inventoryLRUCache.has(asset.assetid)) {
        inventoryLRUCache.set(asset.assetid, { float, seed });
      }

      items.push({
        id: asset.assetid,
        name,
        iconUrl,
        inspectUrl,
        float,
        seed,
        rarity,
        rarityColor,
        type,
        ...(propData?.certificate ? { certificate: propData.certificate } : {}),
      });
    }

    return items.length > 0 ? items : FALLBACK_INVENTORY;
  } catch (error) {
    console.error('[Steam Inventory] Failed to fetch inventory:', error);
    return FALLBACK_INVENTORY;
  }
}

/**
 * Fetches CS2 inventory and performs throttled CSFloat enrichment.
 */
export async function getEnrichedInventory(
  steamId64: string,
  apiKey?: string,
  maxEnrich = 15
): Promise<EnrichedInventoryItem[]> {
  const items = await fetchCS2Inventory(steamId64, apiKey);
  return enrichInventory(items, maxEnrich);
}

// Backward-compatibility and spec-compliant aliases
export const fetchSteamInventory = fetchCS2Inventory;
export const extractRarity = getRarityFromTags;
export const extractItemType = getTypeFromTags;
