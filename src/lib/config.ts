export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  url: string;
  author: {
    name: string;
    handle: string;
    email: string;
    github: string;
    linkedin: string;
    portfolio: string;
    steam: string;
    steamId: string;
    status: string;
  };
}

export const SITE_CONFIG: SiteConfig = {
  name: 'huh4k',
  title: 'huh4k links — Developer & Gaming Hub',
  description: 'Verified links, live Steam gaming presence, and game library for huh4k (huh4k).',
  url: 'https://links.huh4k.dev',
  author: {
    name: 'huh4k',
    handle: 'huh4k',
    email: 'huh4k@huh4k.dev',
    github: 'https://github.com/huh4k',
    linkedin: 'https://linkedin.com',
    portfolio: 'https://huh4k.dev',
    steam: 'https://steamcommunity.com',
    steamId: '76561198000000000',
    status: 'Software Developer & CS Student',
  },
};
