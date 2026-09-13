import type { APIRoute } from 'astro';
import { getCS2Stats } from '../../../lib/leetify';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const runtimeEnv = (context.locals as any)?.runtime?.env;
    const steamId = runtimeEnv?.STEAM_ID64 || process.env.STEAM_ID64;
    const apiKey = runtimeEnv?.LEETIFY_API_KEY || process.env.LEETIFY_API_KEY;

    const stats = await getCS2Stats(steamId, apiKey);
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=14400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve CS2 statistics',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
