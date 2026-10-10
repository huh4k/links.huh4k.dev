import type { APIRoute } from 'astro';
import { getInventoryResult, FALLBACK_INVENTORY } from '../../utils/steam';
import type { EnrichedInventoryItem } from '../../types/inventory';
import { SITE_CONFIG } from '../../lib/config';

export const prerender = false;

const LIVE_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
const DEGRADED_CACHE_CONTROL = 'public, max-age=15, s-maxage=30';
/** How long the last good live inventory is kept around to serve when Steam is down */
const LAST_GOOD_TTL_SECONDS = 60 * 60 * 24;

interface LastGood {
  items: EnrichedInventoryItem[];
  fetchedAt: string;
}

function lastGoodKey(steamId: string): Request {
  return new Request(`https://inventory-last-good.invalid/${steamId}`);
}

/** Cloudflare's per-colo Cache API; absent in dev/Node, so every use is guarded */
function getEdgeCache(): Cache | undefined {
  try {
    return typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined;
  } catch {
    return undefined;
  }
}

function respond(
  items: EnrichedInventoryItem[],
  source: 'live' | 'stale' | 'fallback',
  fetchedAt: string | null,
  extra: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': source === 'live' ? LIVE_CACHE_CONTROL : DEGRADED_CACHE_CONTROL,
      // The body stays a plain array (backward compatible); where it came from travels in headers
      'X-Inventory-Source': source,
      ...(fetchedAt ? { 'X-Inventory-Fetched-At': fetchedAt } : {}),
      ...extra,
    },
  });
}

export const GET: APIRoute = async (context) => {
  try {
    const url = new URL(context.request.url);
    const querySteamId = url.searchParams.get('steamid') || url.searchParams.get('steamId');

    const runtimeEnv = (context.locals as any)?.runtime?.env;
    const steamId =
      querySteamId ||
      runtimeEnv?.STEAM_ID64 ||
      process.env.STEAM_ID64 ||
      SITE_CONFIG?.author?.steamId ||
      '76561198920486334';

    const apiKey = runtimeEnv?.STEAM_API_KEY || process.env.STEAM_API_KEY;

    const result = await getInventoryResult(steamId, apiKey);
    const edgeCache = getEdgeCache();
    const key = lastGoodKey(steamId);

    if (result.source === 'live') {
      const fetchedAt = new Date().toISOString();
      // Don't let a partial page overwrite a complete last-good copy
      if (edgeCache && !result.partial) {
        const save = edgeCache.put(
          key,
          new Response(JSON.stringify({ items: result.items, fetchedAt } satisfies LastGood), {
            headers: { 'Cache-Control': `max-age=${LAST_GOOD_TTL_SECONDS}` },
          })
        );
        const waitUntil = (context.locals as any)?.runtime?.ctx?.waitUntil;
        if (typeof waitUntil === 'function') waitUntil.call((context.locals as any).runtime.ctx, save);
        else await save.catch(() => undefined);
      }
      return respond(result.items, 'live', fetchedAt, result.partial ? { 'X-Inventory-Note': result.reason ?? 'partial' } : {});
    }

    // Steam failed: prefer the last real inventory over the hardcoded example snapshot
    if (edgeCache) {
      try {
        const hit = await edgeCache.match(key);
        if (hit) {
          const saved = (await hit.json()) as LastGood;
          if (Array.isArray(saved.items) && saved.items.length > 0) {
            return respond(saved.items, 'stale', saved.fetchedAt, { 'X-Inventory-Note': result.reason ?? 'Steam unavailable' });
          }
        }
      } catch {
        /* fall through to the fallback snapshot */
      }
    }

    return respond(result.items, 'fallback', null, { 'X-Inventory-Note': result.reason ?? 'Steam unavailable' });
  } catch (error) {
    console.error('[API /api/inventory.json] Unexpected error:', error);
    return new Response(JSON.stringify(FALLBACK_INVENTORY), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
        'X-Inventory-Source': 'fallback',
        'X-Inventory-Note': 'Unexpected server error',
      },
    });
  }
};
