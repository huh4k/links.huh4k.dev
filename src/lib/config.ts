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
  title: 'huh4k links — Steam & Leetify Gaming Hub',
  description: 'Verified Steam gaming presence, Counter-Strike 2 Premier rating, and Leetify analytics for huh4k (huh4k).',
  url: 'https://links.huh4k.dev',
  author: {
    name: 'huh4k',
    handle: 'huh4k',
    steam: 'https://steamcommunity.com',
    leetify: 'https://leetify.com',
    steamId: '76561198000000000',
    status: 'Counter-Strike 2 & Steam Profile',
  },
};
