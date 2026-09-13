import type { APIRoute } from 'astro';
import { getSteamId64 } from '../lib/steam';

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
  const steamId = getSteamId64();
  return redirect(`https://leetify.com/app/profile/${steamId}`, 302);
};
