import React, { useEffect, useMemo, useState } from 'react';
import {
  Backpack,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  DoorOpen,
  Flame,
  Gamepad2,
  HelpCircle,
  MapPin,
  MessageSquare,
  Monitor,
  Package,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Tv,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';
import { DEV_TELEPORT_CATEGORIES } from '../game/devLocations';
import { countUsedInventorySlots, INVENTORY_CAPACITY } from '../game/inventory';
import {
  DISCOVERABLE_CATALOG,
  TOTAL_DISCOVERABLE_PLACES,
} from '../game/persistence';
import {
  ActiveDialogue,
  DevTeleportCategory,
  DevTeleportPoint,
  GraphicsQuality,
  InteractPrompt,
  PlayerVitals,
  ThornvaleSaveState,
} from '../game/types';
import { InventoryModal } from './InventoryModal';

interface GameHudProps {
  zoneName: string;
  audioEnabled: boolean;
  lanternEnabled: boolean;
  touchEnabled: boolean;
  quality: GraphicsQuality;
  vhsEnabled: boolean;
  devModeEnabled: boolean;
  devTeleportLocations: DevTeleportPoint[];
  interactPrompt: InteractPrompt | null;
  dialogue: ActiveDialogue | null;
  vitals: PlayerVitals;
  bannerMessage: string | null;
  saveState: ThornvaleSaveState;
  onInteract: () => void;
  onAdvanceDialogue: () => void;
  onCloseDialogue: () => void;
  onToggleAudio: () => void;
  onToggleLantern: () => void;
  onResetCamera: () => void;
  onToggleTouch: () => void;
  onCycleQuality: () => void;
  onToggleVhs: () => void;
  onToggleDevMode: (enabled: boolean) => void;
  onDevTeleport: (locationId: string) => void;
  onDevReturnNormal: () => void;
  onResetSave: () => void;
  onMoveInventorySlot: (fromIdx: number, toIdx: number) => void;
  onSplitInventorySlot: (slotIdx: number) => void;
  onDiscardInventoryItem: (slotIdx: number, amount?: number) => void;
  onInventoryOpenChange?: (open: boolean) => void;
}

const QUALITY_LABELS: Record<GraphicsQuality, string> = {
  low: 'Low',
  retro: 'Retro',
  high: 'High',
};

export const GameHud: React.FC<GameHudProps> = ({
  zoneName,
  audioEnabled,
  lanternEnabled,
  touchEnabled,
  quality,
  vhsEnabled,
  devModeEnabled,
  devTeleportLocations,
  interactPrompt,
  dialogue,
  vitals,
  bannerMessage,
  saveState,
  onInteract,
  onAdvanceDialogue,
  onCloseDialogue,
  onToggleAudio,
  onToggleLantern,
  onResetCamera,
  onToggleTouch,
  onCycleQuality,
  onToggleVhs,
  onToggleDevMode,
  onDevTeleport,
  onDevReturnNormal,
  onResetSave,
  onMoveInventorySlot,
  onSplitInventorySlot,
  onDiscardInventoryItem,
  onInventoryOpenChange,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [showHelp, setShowHelp] = useState(false);
  const [showPlaces, setShowPlaces] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTeleport, setShowTeleport] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'All' | DevTeleportCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    onInventoryOpenChange?.(showInventory);
  }, [showInventory, onInventoryOpenChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (e.code === 'Escape') {
          setShowTeleport(false);
        }
        return;
      }
      if (e.code === 'KeyH') {
        setDockCollapsed((v) => !v);
      } else if ((e.code === 'KeyI' || e.code === 'KeyB') && !e.repeat) {
        setShowInventory((v) => {
          const next = !v;
          if (next) {
            setShowHelp(false);
            setShowPlaces(false);
            setShowSettings(false);
            setShowTeleport(false);
          }
          return next;
        });
      } else if (e.code === 'Escape') {
        setShowHelp(false);
        setShowPlaces(false);
        setShowSettings(false);
        setShowTeleport(false);
        setShowInventory(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!devModeEnabled) {
      setShowTeleport(false);
    }
  }, [devModeEnabled]);

  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return devTeleportLocations.filter((pt) => {
      if (selectedCategory !== 'All' && pt.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        pt.name.toLowerCase().includes(q) ||
        pt.subtitle.toLowerCase().includes(q) ||
        pt.category.toLowerCase().includes(q)
      );
    });
  }, [devTeleportLocations, selectedCategory, searchQuery]);

  const dockBottomClass = touchEnabled ? 'bottom-36 sm:bottom-4' : 'bottom-4';
  const promptBottomClass = dockCollapsed
    ? 'bottom-16'
    : touchEnabled
      ? 'bottom-52 sm:bottom-20'
      : 'bottom-20';

  const discoveredCount = saveState.discoveredIds.length;
  const relicsCount = Object.values(saveState.collectedRelics).filter(Boolean).length;
  const usedBagSlots = countUsedInventorySlots(saveState.inventory);

  const showVitals = vitals.hp < vitals.maxHp || vitals.inCombat;
  const hpPct = Math.max(0, Math.min(100, (vitals.hp / Math.max(1, vitals.maxHp)) * 100));
  const isLastDialogueLine = dialogue
    ? dialogue.lineIndex >= dialogue.lines.length - 1
    : false;

  const stopCanvasPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {/* Subtle Hurt Vignette Flash */}
      {vitals.hurtFlash > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-30 border-4 border-[#9e2c26]/70 bg-[#5c1210]/20"
          style={{ opacity: Math.min(1, vitals.hurtFlash * 2.2) }}
        />
      )}

      {/* Top-Left Title, Current Area Whisper, Dev Badge & Combat Vitality */}
      <header className="pointer-events-none fixed left-5 top-4 z-20 flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-lg font-medium tracking-wider text-[#e8e2d5]">
            Thornvale
          </h1>
          {devModeEnabled && (
            <span className="rounded border border-[#e0a65c]/60 bg-[#241e16]/95 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#f0c784]">
              DEV MODE
            </span>
          )}
        </div>
        <p className="text-xs font-normal tracking-wide text-[#9ca8b3]">
          {zoneName}
        </p>
        {showVitals && (
          <div className="mt-1.5 w-40 rounded-md border border-white/12 bg-[#141a20]/90 px-2.5 py-1.5">
            <div className="mb-1 flex items-center justify-between text-[10px] tracking-wide text-[#cfc6b6]">
              <span>Vitality</span>
              <span className="font-mono">
                {vitals.hp}/{vitals.maxHp}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-[#272f37]">
              <div
                className="h-full bg-[#a83b32] transition-[width] duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Top-Right Quick Actions: Pack & Developer Teleport (Desktop & Tablet Friendly >=44px) */}
      <div
        onMouseDown={stopCanvasPropagation}
        onTouchStart={stopCanvasPropagation}
        className="pointer-events-auto fixed right-4 top-4 z-20 flex items-center gap-2"
      >
        <button
          type="button"
          onClick={() => {
            setShowInventory((v) => !v);
            setShowTeleport(false);
            setShowSettings(false);
            setShowPlaces(false);
            setShowHelp(false);
          }}
          aria-expanded={showInventory}
          className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
            showInventory
              ? 'border-[#e0a65c]/80 bg-[#2a2319] text-[#f4e2c6]'
              : 'border-white/15 bg-[#191f26]/95 text-[#e6dfd2] hover:border-[#e0a65c]/65 hover:bg-[#242c35]'
          }`}
        >
          <Backpack className="h-4 w-4 text-[#e0a65c]" />
          <span className="font-mono tabular-nums">
            {usedBagSlots}/{INVENTORY_CAPACITY}
          </span>
        </button>

        {devModeEnabled && (
          <button
            type="button"
            onClick={() => {
              setShowTeleport((v) => !v);
              setShowInventory(false);
              setShowSettings(false);
              setShowPlaces(false);
              setShowHelp(false);
            }}
            aria-expanded={showTeleport}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#e0a65c]/55 bg-[#191f26]/95 px-3.5 py-2 text-xs font-medium text-[#f0dec0] shadow-lg transition-colors hover:border-[#e0a65c]/90 hover:bg-[#242c35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c]"
          >
            <MapPin className="h-4 w-4 text-[#e0a65c]" />
            <span>Teleport</span>
          </button>
        )}
      </div>

      {/* Top-Center Quiet Discovery / Interaction Whisper */}
      {bannerMessage && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-4 z-20 -translate-x-1/2 rounded-lg border border-[#e0a65c]/30 bg-[#141a20]/90 px-4 py-1.5 text-xs font-medium tracking-wide text-[#e8dfd0] shadow-lg"
        >
          {bannerMessage}
        </div>
      )}

      {/* NPC Dialogue Panel */}
      {dialogue && (
        <div
          role="dialog"
          aria-label={`Dialogue with ${dialogue.speakerName}`}
          onMouseDown={stopCanvasPropagation}
          onTouchStart={stopCanvasPropagation}
          className={`pointer-events-auto fixed left-1/2 z-30 w-[min(92vw,540px)] -translate-x-1/2 rounded-xl border border-[#e0a65c]/45 bg-[#12171d]/96 px-5 py-3.5 text-[#e5dfd3] shadow-2xl ${promptBottomClass}`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-2">
            <div>
              <h2 className="font-display text-sm font-medium tracking-wide text-[#f0dec0]">
                {dialogue.speakerName}
              </h2>
              <p className="text-[11px] tracking-wide text-[#9ca8b3]">
                {dialogue.speakerTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseDialogue}
              aria-label="Close dialogue"
              className="rounded p-1 text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-32 overflow-y-auto py-2.5 text-xs leading-relaxed text-[#d7d1c4] sm:text-sm">
            {dialogue.lines[dialogue.lineIndex]}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
            <span className="font-mono text-[#88949e]">
              {dialogue.lineIndex + 1} / {dialogue.lines.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCloseDialogue}
                className="rounded-md px-2.5 py-1 text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]"
              >
                Close [Esc]
              </button>
              <button
                type="button"
                onClick={onAdvanceDialogue}
                className="rounded-md border border-[#e0a65c]/50 bg-[#262018] px-3 py-1 font-medium text-[#f0dec0] hover:border-[#e0a65c]/80 hover:bg-[#33291d]"
              >
                {isLastDialogueLine ? 'Farewell [F]' : 'Continue [F]'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contextual Bottom-Center Interact Button (Clickable/Tappable + Keyboard F) */}
      {!dialogue && !showInventory && interactPrompt && (
        <div
          className={`pointer-events-none fixed left-1/2 z-20 -translate-x-1/2 ${promptBottomClass}`}
        >
          <button
            type="button"
            onClick={onInteract}
            className="pointer-events-auto flex min-h-[42px] items-center gap-2 rounded-lg border border-[#e0a65c]/50 bg-[#161c22]/94 px-3.5 py-2 text-xs font-medium tracking-wide text-[#ede4d4] shadow-lg transition-colors hover:border-[#e0a65c]/80 hover:bg-[#232c34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c]"
          >
            {interactPrompt.kind === 'npc' ? (
              <MessageSquare className="h-3.5 w-3.5 text-[#e0a65c]" />
            ) : interactPrompt.kind === 'resource' ? (
              <Package className="h-3.5 w-3.5 text-[#e0a65c]" />
            ) : interactPrompt.kind === 'found_item' ? (
              <Sparkles className="h-3.5 w-3.5 text-[#e0a65c]" />
            ) : (
              <DoorOpen className="h-3.5 w-3.5 text-[#e0a65c]" />
            )}
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-[#e0a65c]">
              F
            </span>
            <span>{interactPrompt.label}</span>
          </button>
        </div>
      )}

      {/* Traveler Pack / Inventory Modal */}
      {showInventory && (
        <InventoryModal
          slots={saveState.inventory}
          devModeEnabled={devModeEnabled}
          onClose={() => setShowInventory(false)}
          onMoveOrSwap={onMoveInventorySlot}
          onSplitStack={onSplitInventorySlot}
          onDiscardItem={onDiscardInventoryItem}
        />
      )}

      {/* Categorized Searchable Developer Teleport Menu */}
      {devModeEnabled && showTeleport && (
        <div
          role="dialog"
          aria-label="Developer Teleport Menu"
          onMouseDown={stopCanvasPropagation}
          onTouchStart={stopCanvasPropagation}
          className="pointer-events-auto fixed left-1/2 top-16 z-40 flex max-h-[min(78vh,600px)] w-[min(94vw,620px)] -translate-x-1/2 flex-col rounded-xl border border-[#e0a65c]/45 bg-[#12171d]/98 text-xs text-[#d6d0c4] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[#e0a65c]" />
              <div>
                <h2 className="font-display text-sm font-medium text-[#f0dec0]">
                  Developer Teleport
                </h2>
                <p className="text-[11px] text-[#8d99a3]">
                  Isolated test mode — normal saves & progression remain untouched
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTeleport(false)}
              aria-label="Close Teleport Menu"
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#9ca7b0] hover:bg-white/10 hover:text-[#e8e2d5]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-2.5 border-b border-white/10 px-4 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7e8a94]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                placeholder="Search landmarks, dwellings, caves, dungeons..."
                className="w-full rounded-lg border border-white/15 bg-[#1b222a] py-2 pl-9 pr-3 text-xs text-[#ece5d8] placeholder-[#6f7b85] focus:border-[#e0a65c]/70 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {(['All', ...DEV_TELEPORT_CATEGORIES] as const).map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-h-[34px] shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border border-[#e0a65c]/70 bg-[#2a2319] text-[#f2dec0]'
                        : 'border border-white/10 bg-[#192027] text-[#98a4ae] hover:bg-white/5 hover:text-[#e8e2d5]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2.5">
            {filteredLocations.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#7c8791]">
                No destinations match this filter.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {filteredLocations.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => {
                      onDevTeleport(pt.id);
                      setShowTeleport(false);
                    }}
                    className="flex min-h-[48px] items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#182027] px-3 py-2 text-left transition-colors hover:border-[#e0a65c]/65 hover:bg-[#222c35]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#ede5d6]">
                        {pt.name}
                      </div>
                      <div className="truncate text-[10px] text-[#8d98a3]">
                        {pt.category} · {pt.subtitle}
                      </div>
                    </div>
                    <span className="shrink-0 rounded border border-white/10 bg-[#12171d] px-2 py-0.5 font-mono text-[10px] text-[#e0a65c]">
                      {pt.targetEnv === 'overworld' ? 'EXT' : 'INT'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-2.5">
            <button
              type="button"
              onClick={() => {
                onDevReturnNormal();
                setShowTeleport(false);
              }}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#1c242c] px-3 py-1.5 text-xs font-medium text-[#dfd7c8] hover:border-[#e0a65c]/60 hover:bg-[#252f39]"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#e0a65c]" />
              <span>Return to Normal Position</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTeleport(false)}
              className="min-h-[40px] rounded-lg border border-white/15 bg-[#182027] px-3.5 py-1.5 text-xs font-medium text-[#b5bfc7] hover:bg-white/10 hover:text-[#e8e2d5]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Settings / Developer Mode Popover */}
      {showSettings && (
        <div
          role="dialog"
          aria-label="Settings"
          onMouseDown={stopCanvasPropagation}
          onTouchStart={stopCanvasPropagation}
          className="pointer-events-auto fixed bottom-48 sm:bottom-20 left-1/2 z-30 w-[min(92vw,380px)] -translate-x-1/2 rounded-xl border border-white/12 bg-[#141a20]/96 px-4 py-3 text-xs text-[#d2cdc2] shadow-xl"
        >
          <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-medium text-[#e8e2d5]">Settings & Tools</span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="rounded px-2 py-0.5 text-[#9ca7b0] hover:text-[#e8e2d5]"
            >
              Close
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex min-h-[44px] items-center justify-between rounded-lg border border-white/10 bg-[#1a2229] px-3 py-2">
              <div>
                <div className="font-medium text-[#ece4d6]">Developer Mode</div>
                <div className="text-[10px] text-[#8d98a3]">
                  Isolated teleport & inspection sandbox
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={devModeEnabled}
                onClick={() => onToggleDevMode(!devModeEnabled)}
                className={`min-h-[34px] min-w-[64px] rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                  devModeEnabled
                    ? 'border-[#e0a65c]/75 bg-[#2d2317] text-[#f2c883]'
                    : 'border-white/15 bg-[#13191e] text-[#98a4ae] hover:text-[#e8e2d5]'
                }`}
              >
                {devModeEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {devModeEnabled && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    setShowTeleport(true);
                  }}
                  className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#e0a65c]/55 bg-[#262018] px-3 py-1.5 font-medium text-[#f0dec0] hover:border-[#e0a65c]/85"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#e0a65c]" />
                  <span>Open Teleport Menu</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDevReturnNormal();
                    setShowSettings(false);
                  }}
                  className="flex min-h-[42px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#1b232a] px-3 py-1.5 text-[#cfc7b8] hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#e0a65c]" />
                  <span>Return</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={onCycleQuality}
                className="flex min-h-[40px] items-center justify-between rounded-lg border border-white/10 bg-[#182027] px-3 py-1.5 text-[#c7cfd6] hover:bg-white/5"
              >
                <span>Quality</span>
                <span className="font-mono text-[#e0a65c]">{QUALITY_LABELS[quality]}</span>
              </button>
              <button
                type="button"
                onClick={onToggleVhs}
                className="flex min-h-[40px] items-center justify-between rounded-lg border border-white/10 bg-[#182027] px-3 py-1.5 text-[#c7cfd6] hover:bg-white/5"
              >
                <span>VHS Pass</span>
                <span className="font-mono text-[#e0a65c]">{vhsEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discovered Locations & Relics Ledger Popover */}
      {showPlaces && (
        <div
          role="dialog"
          aria-label="Discovered Locations"
          onMouseDown={stopCanvasPropagation}
          onTouchStart={stopCanvasPropagation}
          className="pointer-events-auto fixed bottom-48 sm:bottom-20 left-1/2 z-30 w-[min(92vw,440px)] -translate-x-1/2 rounded-xl border border-white/12 bg-[#141a20]/96 px-4 py-3 text-xs text-[#d2cdc2] shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-medium text-[#e8e2d5]">
              Thornvale Ledger — {discoveredCount} / {TOTAL_DISCOVERABLE_PLACES} Places
            </span>
            <button
              type="button"
              onClick={() => setShowPlaces(false)}
              className="rounded px-1.5 py-0.5 text-[#9ca7b0] hover:text-[#e8e2d5]"
            >
              Close
            </button>
          </div>
          <div className="grid max-h-52 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto pr-1">
            {DISCOVERABLE_CATALOG.map((item) => {
              const found = saveState.discoveredIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`truncate text-[11px] ${
                    found ? 'text-[#e3dac8]' : 'text-[#6c767f]'
                  }`}
                >
                  {found ? `• ${item.name}` : '• Uncharted'}
                </div>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-[#9aa5ae]">
            <span>Relics recovered: {relicsCount} / 6</span>
            <button
              type="button"
              disabled={devModeEnabled}
              onClick={() => {
                onResetSave();
                setShowPlaces(false);
              }}
              className={`rounded px-2 py-0.5 ${
                devModeEnabled
                  ? 'cursor-not-allowed text-[#656f78]'
                  : 'text-[#b5877b] hover:bg-white/5 hover:text-[#e2afa3]'
              }`}
            >
              {devModeEnabled ? 'Locked in Dev Mode' : 'Reset Ledger'}
            </button>
          </div>
        </div>
      )}

      {/* Brief Controls Legend Popover */}
      {showHelp && (
        <div
          role="dialog"
          aria-label="Controls"
          onMouseDown={stopCanvasPropagation}
          onTouchStart={stopCanvasPropagation}
          className="pointer-events-auto fixed bottom-48 sm:bottom-20 left-1/2 z-30 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-white/12 bg-[#141a20]/95 px-4 py-3 text-xs text-[#d2cdc2] shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-medium text-[#e8e2d5]">Controls</span>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="rounded px-1.5 py-0.5 text-[#9ca7b0] hover:text-[#e8e2d5]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 leading-relaxed">
            <div>
              <span className="text-[#e0a65c]">Move</span> — WASD / Arrows
            </div>
            <div>
              <span className="text-[#e0a65c]">Run</span> — Hold Shift
            </div>
            <div>
              <span className="text-[#e0a65c]">Orbit Camera</span> — Drag / Q, E
            </div>
            <div>
              <span className="text-[#e0a65c]">Jump</span> — Space
            </div>
            <div>
              <span className="text-[#e0a65c]">Use / Gather</span> — F / Enter / G
            </div>
            <div>
              <span className="text-[#e0a65c]">Strike</span> — Click / V, J
            </div>
            <div>
              <span className="text-[#e0a65c]">Pack (Bag)</span> — I / B
            </div>
            <div>
              <span className="text-[#e0a65c]">Zoom</span> — Scroll Wheel
            </div>
            <div>
              <span className="text-[#e0a65c]">Lantern / View</span> — L / R
            </div>
            <div>
              <span className="text-[#e0a65c]">Hide Menu</span> — H
            </div>
            <div>
              <span className="text-[#e0a65c]">Close Panel</span> — Esc
            </div>
          </div>
          <p className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-[#9aa5ae]">
            On touch devices, use the left thumbstick to move, tap Gather/Take/Talk/Enter near nodes or doors, Strike to fend off monsters, and tap the Pack button in the corner to manage supplies.
          </p>
        </div>
      )}

      {/* Bottom-Center Collapsible Minimal Control Dock */}
      <div
        className={`pointer-events-none fixed left-1/2 z-20 flex -translate-x-1/2 flex-col items-center ${
          dockCollapsed ? 'bottom-4' : dockBottomClass
        }`}
      >
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          aria-expanded={!dockCollapsed}
          aria-label={dockCollapsed ? 'Show Controls' : 'Hide Controls'}
          className="pointer-events-auto mb-1 flex items-center gap-1 rounded-lg border border-white/12 bg-[#141a20]/90 px-3 py-1 text-[11px] font-medium text-[#b2bcc4] hover:text-[#e8e2d5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c]"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Menu</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Hide</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <nav
            aria-label="Exploration Controls"
            className="pointer-events-auto flex max-w-[94vw] items-center gap-1 overflow-x-auto rounded-xl border border-white/12 bg-[#141a20]/94 px-2 py-1.5 shadow-lg"
          >
            <button
              type="button"
              onClick={onToggleAudio}
              aria-pressed={audioEnabled}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                audioEnabled
                  ? 'bg-[#28323b] text-[#e8e2d5]'
                  : 'text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]'
              }`}
            >
              {audioEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-[#e0a65c]" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              <span>Sound</span>
            </button>

            <button
              type="button"
              onClick={onToggleLantern}
              aria-pressed={lanternEnabled}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                lanternEnabled
                  ? 'bg-[#28323b] text-[#e8e2d5]'
                  : 'text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]'
              }`}
            >
              <Flame
                className={`h-3.5 w-3.5 ${
                  lanternEnabled ? 'text-[#e0a65c]' : 'text-[#848f98]'
                }`}
              />
              <span>Lantern</span>
            </button>

            <button
              type="button"
              onClick={onCycleQuality}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#b2bcc4] transition-colors hover:bg-white/5 hover:text-[#e8e2d5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c]"
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>{QUALITY_LABELS[quality]}</span>
            </button>

            <button
              type="button"
              onClick={onToggleVhs}
              aria-pressed={vhsEnabled}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                vhsEnabled
                  ? 'bg-[#28323b] text-[#e8e2d5]'
                  : 'text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]'
              }`}
            >
              <Tv className={`h-3.5 w-3.5 ${vhsEnabled ? 'text-[#e0a65c]' : ''}`} />
              <span>VHS</span>
            </button>

            <button
              type="button"
              onClick={onResetCamera}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#b2bcc4] transition-colors hover:bg-white/5 hover:text-[#e8e2d5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c]"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>View</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowInventory((v) => !v);
                setShowPlaces(false);
                setShowHelp(false);
                setShowSettings(false);
              }}
              aria-pressed={showInventory}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                showInventory
                  ? 'bg-[#28323b] text-[#e8e2d5]'
                  : 'text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]'
              }`}
            >
              <Backpack className={`h-3.5 w-3.5 ${usedBagSlots > 0 ? 'text-[#e0a65c]' : ''}`} />
              <span>
                Pack {usedBagSlots}/{INVENTORY_CAPACITY}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowPlaces((v) => !v);
                setShowInventory(false);
                setShowHelp(false);
                setShowSettings(false);
              }}
              aria-pressed={showPlaces}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                showPlaces
                  ? 'bg-[#28323b] text-[#e8e2d5]'
                  : 'text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>
                Places {discoveredCount}/{TOTAL_DISCOVERABLE_PLACES}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleTouch}
              aria-pressed={touchEnabled}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                touchEnabled
                  ? 'bg-[#28323b] text-[#e8e2d5]'
                  : 'text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]'
              }`}
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Touch</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSettings((v) => !v);
                setShowPlaces(false);
                setShowHelp(false);
              }}
              aria-pressed={showSettings}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                showSettings || devModeEnabled
                  ? 'bg-[#28323b] text-[#e8e2d5]'
                  : 'text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]'
              }`}
            >
              <Settings
                className={`h-3.5 w-3.5 ${devModeEnabled ? 'text-[#e0a65c]' : ''}`}
              />
              <span>Options</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowHelp((v) => !v);
                setShowPlaces(false);
                setShowSettings(false);
              }}
              aria-pressed={showHelp}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                showHelp
                  ? 'bg-[#28323b] text-[#e8e2d5]'
                  : 'text-[#9ca7b0] hover:bg-white/5 hover:text-[#e8e2d5]'
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Keys</span>
            </button>
          </nav>
        )}
      </div>
    </>
  );
};
