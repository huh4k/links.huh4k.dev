import type { APIRoute } from 'astro';
import { getPlayerSummary } from '../../../lib/steam';

export const GET: APIRoute = async () => {
  try {
    const status = await getPlayerSummary();
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
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
        },
      }
    );
  }
};
