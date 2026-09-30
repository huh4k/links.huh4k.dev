import type { APIRoute } from 'astro';
import { getSteamId64 } from '../lib/steam';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context.locals as any)?.runtime?.env;
  const steamId = runtimeEnv?.STEAM_ID64 || getSteamId64();
  return context.redirect(`https://leetify.com/app/profile/${steamId}`, 302);
};
