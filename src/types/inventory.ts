/**
 * Counter-Strike 2 Inventory & CSFloat Data Pipeline Type Definitions
 */

export interface RawSteamAsset {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
}

export interface RawSteamAction {
  link: string;
  name: string;
}

export interface RawSteamTag {
  category: string;
  internal_name: string;
  localized_tag_name: string;
  localized_category_name?: string;
  color?: string;
}

export interface RawSteamDescription {
  appid: number;
  classid: string;
  instanceid: string;
  name: string;
  market_name?: string;
  market_hash_name?: string;
  type: string;
  icon_url: string;
  icon_url_large?: string;
  tradable: number;
  marketable: number;
  actions?: RawSteamAction[];
  tags?: RawSteamTag[];
}

export interface RawSteamInventoryResponse {
  success: number | boolean;
  total_inventory_count?: number;
  assets?: RawSteamAsset[];
  descriptions?: RawSteamDescription[];
  rwgrsn?: number;
  error?: string;
}

export interface CSFloatItemInfo {
  floatvalue?: number;
  paintseed?: number;
  paintindex?: number;
  defindex?: number;
  quality?: number;
  rarity?: number;
  origin?: number;
  itemid?: string;
  accountid?: string | null;
  customname?: string | null;
  weapon_type?: string;
  item_name?: string;
}

export interface CSFloatResponse {
  iteminfo?: CSFloatItemInfo;
  item?: CSFloatItemInfo & {
    float_value?: number;
    paint_seed?: number;
    paint_index?: number;
  };
  floatvalue?: number;
  paintseed?: number;
  paintindex?: number;
  error?: string;
  code?: number;
}

export interface EnrichedInventoryItem {
  id: string;              // assetid
  name: string;            // weapon name + skin name
  iconUrl: string;         // full CDN image url
  inspectUrl: string | null;
  float: number | null;    // float wear (e.g. 0.06312)
  seed: number | null;     // paint seed (e.g. 309)
  rarity: string;          // e.g. "Covert", "Classified", "Mil-Spec"
  rarityColor?: string;    // e.g. "#eb4b4b"
  type: string;            // e.g. "Rifle", "Pistol", "Knife"
}

// Aliases for convenience and spec compatibility
export type SteamInventoryAsset = RawSteamAsset;
export type SteamInventoryDescription = RawSteamDescription;
export type SteamInventoryResponse = RawSteamInventoryResponse;
export type CSFloatInspectResponse = CSFloatResponse;

export interface CachedItemData {
  float: number | null;
  seed: number | null;
  paintindex?: number | null;
  cachedAt?: number;
}
