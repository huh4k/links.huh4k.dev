import type { APIRoute } from 'astro';
import { getCS2Stats } from '../../../lib/leetify';

export const GET: APIRoute = async () => {
  try {
    const stats = await getCS2Stats();
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=28800, stale-while-revalidate=3600',
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
