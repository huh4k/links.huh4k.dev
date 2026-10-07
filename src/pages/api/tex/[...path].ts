import type { APIRoute } from 'astro';

export const prerender = false;

const ORIGIN = 'https://assets.huh4k.dev/cs2-textures/';

/**
 * Same-origin proxy for R2 skin textures.
 * The R2 bucket sends no Access-Control-Allow-Origin header, so WebGL (which needs
 * CORS-clean images) cannot use the textures directly from the browser.
 */
export const GET: APIRoute = async ({ params }) => {
  const path = params.path ?? '';
  if (!/^[\w\-./]+\.(png|webp|jpg|jpeg)$/i.test(path) || path.split('/').includes('..')) {
    return new Response('Bad texture path', { status: 400 });
  }

  const upstream = await fetch(ORIGIN + path, {
    cf: { cacheEverything: true, cacheTtl: 86400 },
  } as RequestInit);
  if (!upstream.ok || !upstream.body) {
    return new Response('Texture not found', { status: upstream.status === 404 ? 404 : 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    },
  });
};
