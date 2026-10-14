import { useState, useEffect, useRef } from 'react';
import { SITE_CONFIG } from '../lib/config';

interface CommandDeckProps {
  steamId: string;
}

interface CommandItem {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  badge?: string;
  action: () => void;
  external?: boolean;
}

const GO_TO: Record<string, () => void> = {
  h: () => { window.location.href = '/'; },
  i: () => { window.location.href = '/inventory'; },
  g: () => { window.location.href = '/games'; },
  l: () => { window.open('/leetify', '_blank', 'noopener,noreferrer'); },
  p: () => { window.open(SITE_CONFIG.portfolioUrl, '_blank', 'noopener,noreferrer'); },
  b: () => { window.open('https://github.com/huh4k', '_blank', 'noopener,noreferrer'); },
};

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['/'], label: 'jump to anything' },
  { keys: ['g', 'h'], label: 'home' },
  { keys: ['g', 'i'], label: 'inventory' },
  { keys: ['g', 'g'], label: 'games' },
  { keys: ['g', 'l'], label: 'leetify' },
  { keys: ['g', 'p'], label: 'portfolio' },
  { keys: ['g', 'b'], label: 'github' },
  { keys: ['?'], label: 'this cheat sheet' },
];

export default function CommandDeck({ steamId }: CommandDeckProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingG, setPendingG] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const steamProfileUrl = `https://steamcommunity.com/profiles/${steamId}`;
  const steamInventoryUrl = `https://steamcommunity.com/profiles/${steamId}/inventory/`;

  const copyDiscord = async () => {
    let succeeded = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText('huh3k');
        succeeded = true;
      }
    } catch {
      // Fallback handled below
    }

    if (!succeeded) {
      try {
        const el = document.createElement('textarea');
        el.value = 'huh3k';
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        succeeded = true;
      } catch {
        // Ignore
      }
    }

    if (succeeded) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const commands: CommandItem[] = [
    {
      id: 'steam',
      tag: '[STEAM]',
      title: 'Steam Profile',
      subtitle: 'View Steam Community profile, badges, and games',
      badge: 'Profile ↗',
      action: () => {
        window.open(steamProfileUrl, '_blank', 'noopener,noreferrer');
      },
      external: true,
    },
    {
      id: 'inventory',
      tag: '[INVENTORY]',
      title: 'CS2 Inventory Explorer',
      subtitle: 'Browse all 26+ weapon skins with live 3D inspect & float ratings',
      badge: '/inventory',
      action: () => {
        window.location.href = '/inventory';
      },
    },
    {
      id: 'steam-inventory',
      tag: '[STEAM INVENTORY]',
      title: 'Steam Community Inventory',
      subtitle: 'Official Steam Community inventory page',
      badge: 'Steam ↗',
      action: () => {
        window.open(steamInventoryUrl, '_blank', 'noopener,noreferrer');
      },
      external: true,
    },
    {
      id: 'leetify',
      tag: '[LEETIFY]',
      title: 'Leetify CS2 Profile',
      subtitle: 'Match analytics, Aim rating, and Premier stats',
      badge: 'Stats ↗',
      action: () => {
        window.open('/leetify', '_blank', 'noopener,noreferrer');
      },
      external: true,
    },
    {
      id: 'games',
      tag: '[GAMES]',
      title: 'Games Shelf',
      subtitle: 'Full Steam game library with total playtime logged',
      badge: '/games',
      action: () => {
        window.location.href = '/games';
      },
    },
    {
      id: 'models',
      tag: '[3D WEAPONS]',
      title: '3D Weapon Inspect',
      subtitle: 'Interactive 3D model viewer with studio lighting & OrbitControls',
      badge: '3D Viewer',
      action: () => {
        window.location.href = '/test/model-viewer';
      },
    },
    {
      id: 'portfolio',
      tag: '[PORTFOLIO]',
      title: 'Portfolio',
      subtitle: 'Selected work and projects',
      badge: 'Work ↗',
      action: () => {
        window.open(SITE_CONFIG.portfolioUrl, '_blank', 'noopener,noreferrer');
      },
      external: true,
    },
    {
      id: 'github',
      tag: '[GITHUB]',
      title: 'GitHub Profile',
      subtitle: 'Open source repositories and software projects',
      badge: 'Code ↗',
      action: () => {
        window.open('https://github.com/huh4k', '_blank', 'noopener,noreferrer');
      },
      external: true,
    },
    {
      id: 'discord',
      tag: '[DISCORD]',
      title: copied ? 'Copied: huh3k' : 'Copy Discord Username',
      subtitle: 'Click to copy username: huh3k',
      badge: copied ? '✓ Copied' : 'Copy',
      action: copyDiscord,
    },
  ];

  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle.toLowerCase().includes(q) ||
      cmd.tag.toLowerCase().includes(q) ||
      (cmd.badge && cmd.badge.toLowerCase().includes(q))
    );
  });

  // Global key listener for '/' and Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      const plain = !e.metaKey && !e.ctrlKey && !e.altKey;

      if (!isInput && plain && !isOpen) {
        if (pendingG) {
          const dest = GO_TO[e.key.toLowerCase()];
          setPendingG(false);
          if (dest) {
            e.preventDefault();
            dest();
            return;
          }
        } else if (e.key === 'g') {
          setPendingG(true);
          return;
        } else if (e.key === '?') {
          e.preventDefault();
          setShowHelp((prev) => !prev);
          return;
        }
      }

      if (e.key === 'Escape' && showHelp) {
        e.preventDefault();
        setShowHelp(false);
        return;
      }

      if (!isInput && e.key === '/') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-deck', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-deck', handleCustomOpen);
    };
  }, [isOpen, pendingG, showHelp]);

  useEffect(() => {
    if (!pendingG) return;
    const t = setTimeout(() => setPendingG(false), 1200);
    return () => clearTimeout(t);
  }, [pendingG]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const handleSelect = (index: number) => {
    const item = filtered[index];
    if (item) {
      item.action();
      if (item.id !== 'discord') {
        setIsOpen(false);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  const pendingHint = pendingG && (
    <div className="num fixed bottom-5 left-5 z-[100] flex items-center gap-2 border border-rule-strong bg-ink-2 px-3 py-2 text-[12px] uppercase tracking-wider text-ash sm:bottom-8 sm:left-8">
      <span className="kbd">g</span> then <span className="text-bone">h i g l p b</span>
    </div>
  );

  if (showHelp && !isOpen) {
    return (
      <>
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/90 px-4 pt-20 backdrop-blur-sm sm:pt-28"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-md border border-rule-strong bg-ink-2 shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Keyboard shortcuts"
          >
            <p className="eyebrow border-b border-rule px-5 py-4">keyboard</p>
            <ul>
              {SHORTCUTS.map((s) => (
                <li key={s.label} className="flex items-center justify-between border-b border-rule px-5 py-3 last:border-b-0">
                  <span className="text-lg">{s.label}</span>
                  <span className="flex items-center gap-1.5">
                    {s.keys.map((k, i) => (
                      <span key={i} className="kbd">{k}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="num border-t border-rule px-5 py-2.5 text-[10px] uppercase tracking-wider text-ash">esc or ? closes</p>
          </div>
        </div>
      </>
    );
  }

  if (!isOpen) return <>{pendingHint}</>;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/90 px-4 pt-20 backdrop-blur-sm sm:pt-28"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl border border-rule-strong bg-ink-2 shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Jump to"
      >
        <div className="flex items-center gap-3 border-b border-rule px-5 py-4">
          <span className="font-mono text-sm text-signal select-none">/</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="jump to… steam, inventory, games"
            className="w-full bg-transparent text-xl text-bone placeholder-ash-dim focus:outline-none"
          />
          <span className="kbd">esc</span>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-ash">nothing here.</p>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-baseline justify-between gap-4 border-b border-rule px-5 py-3.5 text-left transition-colors last:border-b-0 ${
                    isSelected ? 'bg-signal text-ink' : 'text-bone'
                  }`}
                >
                  <span className="truncate text-lg font-semibold tracking-tight">{cmd.title}</span>
                  <span className={`hidden truncate text-[14px] sm:inline ${isSelected ? 'text-ink/70' : 'text-ash'}`}>{cmd.subtitle}</span>
                  {cmd.badge && (
                    <span className={`num shrink-0 text-[11px] uppercase tracking-wider ${isSelected ? 'text-ink/70' : 'text-ash'}`}>{cmd.badge}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="num flex justify-between border-t border-rule px-5 py-2.5 text-[10px] uppercase tracking-wider text-ash">
          <span>enter select · ↑↓ move</span>
          <span>/ toggles</span>
        </div>
      </div>
    </div>
  );
}
