import { useState, useEffect, useRef } from 'react';

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

export default function CommandDeck({ steamId }: CommandDeckProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const steamProfileUrl = `https://steamcommunity.com/profiles/${steamId}`;
  const steamInventoryUrl = `https://steamcommunity.com/profiles/${steamId}/inventory/`;

  const copyDiscord = async () => {
    let succeeded = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText('huh4k');
        succeeded = true;
      }
    } catch {
      // Fallback handled below
    }

    if (!succeeded) {
      try {
        const el = document.createElement('textarea');
        el.value = 'huh4k';
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
      title: copied ? 'Copied: huh4k' : 'Copy Discord Username',
      subtitle: 'Click to copy username: huh4k',
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
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-20 sm:pt-28 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-hardware bg-[#0F1118] text-white shadow-2xl shadow-black/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#08090D] border-b border-[#1E2333] text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-telemetry-green" />
            <span className="text-zinc-200 font-semibold tracking-wide">[COMMAND DECK]</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">huh4k.dev</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-[#1E2333] text-zinc-400 text-[10px]">ESC</span>
        </div>

        {/* Search Bar */}
        <div className="flex items-center px-4 py-3 border-b border-[#1E2333] bg-[#0c0e14]">
          <span className="font-mono text-xs text-telemetry-blue mr-2.5 select-none">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search links or commands (e.g. steam, leetify, games)..."
            className="w-full bg-transparent text-sm font-mono text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>

        {/* Command Items */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-zinc-500">
              No matching commands found.
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg font-mono text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#1E2333] text-white border border-telemetry-blue/50'
                      : 'text-zinc-300 hover:bg-[#151824] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-telemetry-blue font-semibold text-[11px]">{cmd.tag}</span>
                    <span className="text-zinc-100 font-medium truncate">{cmd.title}</span>
                    <span className="text-zinc-500 text-[11px] hidden sm:inline truncate">{cmd.subtitle}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {cmd.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 border border-[#1E2333] text-zinc-300">
                        {cmd.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#08090D] border-t border-[#1E2333] flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Enter to select • ↑↓ to navigate</span>
          <span>links.huh4k.dev</span>
        </div>
      </div>
    </div>
  );
}
