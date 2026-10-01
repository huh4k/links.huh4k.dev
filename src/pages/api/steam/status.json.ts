import type { APIRoute } from 'astro';
import { getPlayerSummary } from '../../../lib/steam';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const runtimeEnv = (context.locals as any)?.runtime?.env;
    const apiKey = runtimeEnv?.STEAM_API_KEY || process.env.STEAM_API_KEY;
    const steamId = runtimeEnv?.STEAM_ID64 || process.env.STEAM_ID64;

    const status = await getPlayerSummary(steamId, apiKey);
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        state: 'offline',
        label: 'Offline',
        personaname: 'huh4k',
        avatarUrl: '',
        profileUrl: 'https://steamcommunity.com',
        lastUpdated: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
};
