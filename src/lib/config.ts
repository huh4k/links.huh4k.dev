export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  url: string;
  author: {
    name: string;
    handle: string;
    steam: string;
    leetify: string;
    steamId: string;
    status: string;
  };
}

export const SITE_CONFIG: SiteConfig = {
  name: 'huh4k',
  title: 'links and shit',
  description: 'pronounced hufk',
  url: 'https://links.huh4k.dev',
  author: {
    name: 'huh4k',
    handle: '@huh4k',
    steam: 'https://steamcommunity.com',
    leetify: 'https://leetify.com',
    steamId: '76561198920486334',
    status: 'Links',
  },
};
