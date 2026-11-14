import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  DoorOpen,
  Flame,
  Gamepad2,
  HelpCircle,
  Monitor,
  Tv,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DISCOVERABLE_CATALOG,
  TOTAL_DISCOVERABLE_PLACES,
} from '../game/persistence';
import { GraphicsQuality, InteractPrompt, ThornvaleSaveState } from '../game/types';

interface GameHudProps {
  zoneName: string;
  audioEnabled: boolean;
  lanternEnabled: boolean;
  touchEnabled: boolean;
  quality: GraphicsQuality;
  vhsEnabled: boolean;
  interactPrompt: InteractPrompt | null;
  bannerMessage: string | null;
  saveState: ThornvaleSaveState;
  onInteract: () => void;
  onToggleAudio: () => void;
  onToggleLantern: () => void;
  onResetCamera: () => void;
  onToggleTouch: () => void;
  onCycleQuality: () => void;
  onToggleVhs: () => void;
  onResetSave: () => void;
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
  interactPrompt,
  bannerMessage,
  saveState,
  onInteract,
  onToggleAudio,
  onToggleLantern,
  onResetCamera,
  onToggleTouch,
  onCycleQuality,
  onToggleVhs,
  onResetSave,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [showHelp, setShowHelp] = useState(false);
  const [showPlaces, setShowPlaces] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setDockCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const dockBottomClass = touchEnabled ? 'bottom-36 sm:bottom-4' : 'bottom-4';
  const promptBottomClass = dockCollapsed
    ? 'bottom-16'
    : touchEnabled
      ? 'bottom-52 sm:bottom-20'
      : 'bottom-20';

  const discoveredCount = saveState.discoveredIds.length;
  const relicsCount = Object.values(saveState.collectedRelics).filter(Boolean).length;

  return (
    <>
      {/* Top-Left Title & Current Area Whisper */}
      <header className="pointer-events-none fixed left-5 top-4 z-20 flex flex-col gap-0.5">
        <h1 className="font-display text-lg font-medium tracking-wider text-[#e8e2d5]">
          Thornvale
        </h1>
        <p className="text-xs font-normal tracking-wide text-[#9ca8b3]">
          {zoneName}
        </p>
      </header>

      {/* Top-Center Quiet Discovery / Interaction Whisper */}
      {bannerMessage && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-4 z-20 -translate-x-1/2 rounded-lg border border-[#e0a65c]/30 bg-[#141a20]/90 px-4 py-1.5 text-xs font-medium tracking-wide text-[#e8dfd0] shadow-lg"
        >
          {bannerMessage}
        </div>
      )}

      {/* Contextual Bottom-Center Interact Button (Clickable/Tappable + Keyboard F) */}
      {interactPrompt && (
        <div
          className={`pointer-events-none fixed left-1/2 z-20 -translate-x-1/2 ${promptBottomClass}`}
        >
          <button
            type="button"
            onClick={onInteract}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[#e0a65c]/50 bg-[#161c22]/94 px-3.5 py-2 text-xs font-medium tracking-wide text-[#ede4d4] shadow-lg transition-colors hover:border-[#e0a65c]/80 hover:bg-[#232c34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c]"
          >
            <DoorOpen className="h-3.5 w-3.5 text-[#e0a65c]" />
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-[#e0a65c]">
              F
            </span>
            <span>{interactPrompt.label}</span>
          </button>
        </div>
      )}

      {/* Discovered Locations & Relics Ledger Popover */}
      {showPlaces && (
        <div
          role="dialog"
          aria-label="Discovered Locations"
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
              onClick={() => {
                onResetSave();
                setShowPlaces(false);
              }}
              className="rounded px-2 py-0.5 text-[#b5877b] hover:bg-white/5 hover:text-[#e2afa3]"
            >
              Reset Ledger
            </button>
          </div>
        </div>
      )}

      {/* Brief Controls Legend Popover */}
      {showHelp && (
        <div
          role="dialog"
          aria-label="Controls"
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
              <span className="text-[#e0a65c]">Enter / Interact</span> — F / Enter
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
          </div>
          <p className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-[#9aa5ae]">
            On touch devices, use the left thumbstick to move, tap Enter/Use near doors or relics, and drag anywhere to rotate the camera.
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
                setShowPlaces((v) => !v);
                setShowHelp(false);
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
                setShowHelp((v) => !v);
                setShowPlaces(false);
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
