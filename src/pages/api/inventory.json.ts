import type { APIRoute } from 'astro';
import { getEnrichedInventory, FALLBACK_INVENTORY } from '../../utils/steam';
import { SITE_CONFIG } from '../../lib/config';

export const prerender = false;

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

    const inventory = await getEnrichedInventory(steamId, apiKey);

    return new Response(JSON.stringify(inventory), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('[API /api/inventory.json] Unexpected error:', error);
    return new Response(JSON.stringify(FALLBACK_INVENTORY), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }
};
