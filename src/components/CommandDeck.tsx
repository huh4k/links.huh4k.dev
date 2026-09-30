import { useState, useEffect, useRef } from 'react';

interface CommandDeckProps {
  steamId: string;
}

interface CommandItem {
  id: string;
  code: string;
  label: string;
  category: string;
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
    try {
      await navigator.clipboard.writeText('huh4k');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const commands: CommandItem[] = [
    {
      id: 'games',
      code: 'NAV_01',
      label: 'Open Games Shelf & Lifetime Playtime',
      category: '[VALVE_LIBRARY]',
      badge: '/games',
      action: () => {
        window.location.href = '/games';
      },
    },
    {
      id: 'leetify',
      code: 'NAV_02',
      label: 'Launch CS2 Leetify Performance Analytics',
      category: '[CS2_METRICS]',
      badge: 'LEETIFY',
      action: () => {
        window.open('/leetify', '_blank', 'noopener,noreferrer');
      },
      external: true,
    },
    {
      id: 'steam',
      code: 'EXT_01',
      label: 'Connect to Steam Community Profile',
      category: '[VALVE_UPLINK]',
      badge: 'STEAM',
      action: () => {
        window.open(steamProfileUrl, '_blank', 'noopener,noreferrer');
      },
      external: true,
    },
    {
      id: 'inventory',
      code: 'EXT_02',
      label: 'Inspect Steam CS2 Inventory & Weapon Finishes',
      category: '[INVENTORY]',
      badge: 'ASSETS',
      action: () => {
        window.open(steamInventoryUrl, '_blank', 'noopener,noreferrer');
      },
      external: true,
    },
    {
      id: 'github',
      code: 'EXT_03',
      label: 'Access GitHub Engineering Profile & Repos',
      category: '[DEV_SOURCE]',
      badge: 'GITHUB',
      action: () => {
        window.open('https://github.com/huh4k', '_blank', 'noopener,noreferrer');
      },
      external: true,
    },
    {
      id: 'discord',
      code: 'ACT_01',
      label: copied ? 'COPIED TO CLIPBOARD: huh4k' : 'Copy Discord Contact Identifier',
      category: '[COMMS]',
      badge: copied ? '✓ COPIED' : 'DISCORD',
      action: copyDiscord,
    },
  ];

  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.code.toLowerCase().includes(q) ||
      (cmd.badge && cmd.badge.toLowerCase().includes(q))
    );
  });

  // Global key listener for '/' and Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
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
        className="w-full max-w-2xl rounded-xl border border-hardware bg-[#0F1118] text-white shadow-2xl shadow-black/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#08090D] border-b border-[#1E2333] text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-telemetry-green animate-pulse" />
            <span className="text-zinc-200 font-semibold">[COMMAND_DECK // OPERATOR_INTERFACE]</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-[#1E2333] text-zinc-400">ESC TO DISMISS</span>
          </div>
        </div>

        {/* Input Bar */}
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
            placeholder="Type a command or platform node (e.g. /games, leetify, steam)..."
            className="w-full bg-transparent text-sm font-mono text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>

        {/* Command List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-zinc-500">
              [NO_MATCHING_TELEMETRY_NODES]
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
                  <div className="flex items-center gap-3 truncate">
                    <span className="text-[10px] text-zinc-500 font-bold">{cmd.code}</span>
                    <span className="text-zinc-400 text-[11px]">{cmd.category}</span>
                    <span className="text-zinc-100 font-medium truncate">{cmd.label}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {cmd.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 border border-[#1E2333] text-zinc-300">
                        {cmd.badge}
                      </span>
                    )}
                    {cmd.external && <span className="text-zinc-500 text-[10px]">↗</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Telemetry Footer */}
        <div className="px-4 py-2 bg-[#08090D] border-t border-[#1E2333] flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span>SELECT: [ENTER] • NAVIGATE: [↑/↓]</span>
          <span>SYS_LATENCY: 0.12ms // NOMINAL</span>
        </div>
      </div>
    </div>
  );
}
