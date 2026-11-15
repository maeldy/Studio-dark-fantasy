import React, { useRef, useState } from 'react';
import { InteractPrompt, TouchMoveInput } from '../game/types';

interface TouchControlsProps {
  onMove: (input: TouchMoveInput) => void;
  onJump: () => void;
  onSprintChange: (sprinting: boolean) => void;
  onCrouchChange?: (crouching: boolean) => void;
  onAttack?: () => void;
  interactPrompt?: InteractPrompt | null;
  onInteract?: () => void;
}

const STICK_RADIUS = 46;

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMove,
  onJump,
  onSprintChange,
  onCrouchChange,
  onAttack,
  interactPrompt,
  onInteract,
}) => {
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickActive, setStickActive] = useState(false);
  const [sprintLocked, setSprintLocked] = useState(false);
  const [crouchLocked, setCrouchLocked] = useState(false);

  const stickTouchId = useRef<number | null>(null);
  const stickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stickMouseDown = useRef(false);

  const updateStickFromClient = (clientX: number, clientY: number) => {
    const dx = clientX - stickCenter.current.x;
    const dy = clientY - stickCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, STICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;
    const mag = clamped / STICK_RADIUS;

    setKnobOffset({ x: ox, y: oy });
    onMove({
      x: dist > 0.001 ? ox / STICK_RADIUS : 0,
      y: dist > 0.001 ? oy / STICK_RADIUS : 0,
      magnitude: mag,
    });
  };

  const handleStickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    stickTouchId.current = touch.identifier;
    stickCenter.current = {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
    };
    setStickActive(true);
    updateStickFromClient(touch.clientX, touch.clientY);
  };

  const handleStickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === stickTouchId.current) {
        updateStickFromClient(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleStickTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === stickTouchId.current) {
        stickTouchId.current = null;
        setStickActive(false);
        setKnobOffset({ x: 0, y: 0 });
        onMove({ x: 0, y: 0, magnitude: 0 });
        break;
      }
    }
  };

  const handleStickMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    stickMouseDown.current = true;
    stickCenter.current = {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
    };
    setStickActive(true);
    updateStickFromClient(e.clientX, e.clientY);

    const onWinMove = (ev: MouseEvent) => {
      if (!stickMouseDown.current) return;
      updateStickFromClient(ev.clientX, ev.clientY);
    };
    const onWinUp = () => {
      stickMouseDown.current = false;
      setStickActive(false);
      setKnobOffset({ x: 0, y: 0 });
      onMove({ x: 0, y: 0, magnitude: 0 });
      window.removeEventListener('mousemove', onWinMove);
      window.removeEventListener('mouseup', onWinUp);
    };
    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('mouseup', onWinUp);
  };

  const toggleSprintLock = () => {
    const next = !sprintLocked;
    setSprintLocked(next);
    onSprintChange(next);
    if (next && crouchLocked) {
      setCrouchLocked(false);
      onCrouchChange?.(false);
    }
  };

  const toggleCrouchLock = () => {
    const next = !crouchLocked;
    setCrouchLocked(next);
    onCrouchChange?.(next);
    if (next && sprintLocked) {
      setSprintLocked(false);
      onSprintChange(false);
    }
  };

  const getInteractLabel = () => {
    if (!interactPrompt) return 'INTERAGIR';
    switch (interactPrompt.kind) {
      case 'portal':
        return 'ENTRER';
      case 'npc':
        return 'PARLER';
      case 'resource':
        return 'RÉCOLTER';
      case 'found_item':
        return 'PRENDRE';
      default:
        return 'EXAMINER';
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* =========================================================================
          LEFT VIRTUAL THUMBSTICK — Carved Megalithic Stone Dais
          ========================================================================= */}
      <div
        role="application"
        aria-label="Contrôle de déplacement"
        className="pointer-events-auto absolute bottom-6 left-6 flex h-32 w-32 items-center justify-center rounded-full border-2 border-t-[#5e6c7a] border-l-[#5e6c7a] border-b-[#12161b] border-r-[#12161b] bg-gradient-to-br from-[#27303a]/92 via-[#1c232a]/95 to-[#12171c]/98 shadow-[0_8px_24px_rgba(0,0,0,0.7),inset_1px_1px_0_rgba(255,255,255,0.12),inset_-2px_-2px_4px_rgba(0,0,0,0.75)] backdrop-blur-md"
        onTouchStart={handleStickTouchStart}
        onTouchMove={handleStickTouchMove}
        onTouchEnd={handleStickTouchEnd}
        onTouchCancel={handleStickTouchEnd}
        onMouseDown={handleStickMouseDown}
      >
        {/* Chiseled Stone Compass Ticks (N, S, E, W) */}
        <div className="pointer-events-none absolute top-1.5 h-2 w-1 rounded-sm bg-[#8495a5]/70 shadow-sm" />
        <div className="pointer-events-none absolute bottom-1.5 h-2 w-1 rounded-sm bg-[#12161b] shadow-sm" />
        <div className="pointer-events-none absolute left-1.5 h-1 w-2 rounded-sm bg-[#8495a5]/70 shadow-sm" />
        <div className="pointer-events-none absolute right-1.5 h-1 w-2 rounded-sm bg-[#12161b] shadow-sm" />

        {/* Concentric Chiseled Stone Groove */}
        <div className="pointer-events-none h-20 w-20 rounded-full border border-t-[#12161b] border-l-[#12161b] border-b-[#5e6c7a]/40 border-r-[#5e6c7a]/40 bg-[#0e1317]/60 shadow-inner" />

        {/* Draggable Carved Stone Knob */}
        <div
          className={`pointer-events-none absolute flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-75 ${
            stickActive
              ? 'border-t-[#d9983b] border-l-[#d9983b] border-b-[#472c0d] border-r-[#472c0d] bg-gradient-to-br from-[#3b4754] via-[#28323c] to-[#182027] text-[#fadc9e] shadow-[0_0_16px_rgba(217,152,59,0.5),inset_1px_1px_0_rgba(255,255,255,0.25)]'
              : 'border-t-[#788796] border-l-[#788796] border-b-[#12171c] border-r-[#12171c] bg-gradient-to-br from-[#2f3944] via-[#212932] to-[#141b21] text-[#9ba8b5] shadow-[0_4px_10px_rgba(0,0,0,0.65),inset_1px_1px_0_rgba(255,255,255,0.15)]'
          }`}
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        >
          {/* Engraved Stone Boss Emblem */}
          <svg className="h-6 w-6 opacity-80 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="7" strokeDasharray="3 3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="square" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </div>
      </div>

      {/* =========================================================================
          RIGHT ACTION CLUSTER — Chiseled Stone & Masonry Tablets (Retro-Medieval)
          ========================================================================= */}
      <div className="pointer-events-auto absolute bottom-6 right-6">
        {/* Contextual Action Tablet (Matches the "SAVE / PLAY" carved stone tablets from user reference) */}
        {interactPrompt && onInteract && (
          <div className="absolute -top-16 right-0 z-20 animate-fade-in">
            <button
              type="button"
              onTouchStart={(e) => {
                e.stopPropagation();
                onInteract();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onInteract();
              }}
              className="group flex h-12 items-center gap-2.5 rounded-lg border-2 border-t-[#d9983b] border-l-[#d9983b] border-b-[#3d2407] border-r-[#3d2407] bg-gradient-to-br from-[#302315] via-[#241a0f] to-[#181109] px-4 text-xs font-bold tracking-widest text-[#f5debe] shadow-[0_5px_0_#1a1005,0_8px_16px_rgba(0,0,0,0.65),inset_1px_1px_0_rgba(255,255,255,0.18)] transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:border-t-[#3d2407] active:border-l-[#3d2407] active:border-b-[#d9983b] active:border-r-[#d9983b] active:shadow-[0_2px_0_#1a1005,inset_0_3px_5px_rgba(0,0,0,0.85)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d9983b]"
            >
              {/* Chiseled Corner Notches (Weathered Masonry) */}
              <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-1.5 w-1.5 border-t border-r border-[#1a1005] bg-[#12161c]" />
              <div className="pointer-events-none absolute -bottom-0.5 -left-0.5 h-1.5 w-1.5 border-b border-l border-[#d9983b] bg-[#12161c]" />

              {/* Contextual Icon */}
              <div className="flex h-6 w-6 items-center justify-center rounded border border-[#d9983b]/60 bg-[#1a120a] text-[#f5debe] shadow-inner">
                {interactPrompt.kind === 'portal' ? (
                  <svg className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
                    <path d="M4 21V8a8 8 0 0 1 16 0v13" />
                    <path d="M4 21h16" />
                    <path d="M9 21v-6a3 3 0 0 1 6 0v6" />
                  </svg>
                ) : interactPrompt.kind === 'npc' ? (
                  <svg className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <line x1="8" y1="9" x2="16" y2="9" />
                    <line x1="8" y1="13" x2="13" y2="13" />
                  </svg>
                ) : interactPrompt.kind === 'resource' ? (
                  <svg className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
                    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                    <path d="M2 21c0-3 1.85-5.36 5.08-6" />
                  </svg>
                ) : interactPrompt.kind === 'found_item' ? (
                  <svg className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
                    <path d="M6 3h12l4 6-10 12L2 9z" />
                    <path d="M12 21V9" />
                    <path d="M2 9h20" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square">
                    <path d="M18 11V6a2 2 0 0 0-4 0v5" />
                    <path d="M14 10V4a2 2 0 0 0-4 0v7" />
                    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83L7 15" />
                  </svg>
                )}
              </div>
              <span className="font-serif tracking-widest drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                {getInteractLabel()}
              </span>
            </button>
          </div>
        )}

        {/* Action Hub Container (Ergonomic Radial Fan — Zero Overlap) */}
        <div className="relative h-44 w-44">
          {/* =============================================================
              1. JUMP BUTTON (Grand Saut) — Primary Bottom-Right Stone Anchor
              ============================================================= */}
          <button
            type="button"
            aria-label="Sauter"
            onTouchStart={(e) => {
              e.stopPropagation();
              onJump();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onJump();
            }}
            className="group absolute bottom-0 right-0 flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-t-[#788899] border-l-[#788899] border-b-[#12161c] border-r-[#12161c] bg-gradient-to-br from-[#2a3440] via-[#1d252e] to-[#131920] text-[#e8e1d3] shadow-[0_5px_0_#0e1216,0_8px_16px_rgba(0,0,0,0.7),inset_1px_1px_0_rgba(255,255,255,0.18),inset_-2px_-2px_4px_rgba(0,0,0,0.8)] transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:border-t-[#12161c] active:border-l-[#12161c] active:border-b-[#546270] active:border-r-[#546270] active:shadow-[0_2px_0_#0e1216,inset_0_3px_6px_rgba(0,0,0,0.9)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d9983b]"
          >
            {/* Chiseled Stone Corner Notches */}
            <div className="pointer-events-none absolute top-1 right-1 h-1.5 w-1.5 bg-[#12161c]/80" />
            <div className="pointer-events-none absolute bottom-1 left-1 h-1.5 w-1.5 bg-[#788899]/40" />

            {/* Inner Stone Recess */}
            <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-[#101418] bg-[#161c22]/40 shadow-inner" />

            {/* Chiseled Leaping Adventurer Icon */}
            <svg
              className="relative h-7 w-7 text-[#ece4d6] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-transform group-active:scale-95"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="15.5" cy="4.5" r="2.2" />
              <path d="M13.8 7.5c-.8 0-1.8.4-2.4 1.1l-2.6 3.1 1.6 1.4 2.2-2.5.4 3.9-3.2 2.8 1.4 1.6 4.1-3.6c.4-.4.7-.9.7-1.5l-.2-3.8 1.9 1.7 1.4-1.5-2.8-2.6c-.6-.7-1.4-1.1-2.4-1.1z" />
              <path
                d="M5 19.5c2.5-1.5 5.5-2 8.5-1.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                fill="none"
                opacity="0.75"
              />
              <path
                d="M3 21.5c3.2-2 7-2.4 11-1.6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                fill="none"
                opacity="0.45"
              />
            </svg>
          </button>

          {/* =============================================================
              2. ATTACK / STRIKE (Attaque) — Inward Diagonal Stone Anchor
              ============================================================= */}
          {onAttack && (
            <button
              type="button"
              aria-label="Attaquer"
              onTouchStart={(e) => {
                e.stopPropagation();
                onAttack();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAttack();
              }}
              className="group absolute bottom-18 right-18 flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-t-[#85453a] border-l-[#85453a] border-b-[#1f0d0a] border-r-[#1f0d0a] bg-gradient-to-br from-[#2c1815] via-[#20100e] to-[#140a08] text-[#f2d8d1] shadow-[0_5px_0_#140a08,0_8px_16px_rgba(0,0,0,0.7),inset_1px_1px_0_rgba(255,255,255,0.15),inset_-2px_-2px_4px_rgba(0,0,0,0.8)] transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:border-t-[#1f0d0a] active:border-l-[#1f0d0a] active:border-b-[#85453a] active:border-r-[#85453a] active:shadow-[0_2px_0_#140a08,inset_0_3px_6px_rgba(0,0,0,0.9)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c96a52]"
            >
              <div className="pointer-events-none absolute top-1 right-1 h-1.5 w-1.5 bg-[#1f0d0a]/80" />
              <div className="pointer-events-none absolute bottom-1 left-1 h-1.5 w-1.5 bg-[#85453a]/40" />

              <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-[#180907] bg-[#140806]/40 shadow-inner" />

              {/* Chiseled Forged Arming Sword Icon */}
              <svg
                className="relative h-6 w-6 text-[#f5dbd4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-transform group-active:scale-95"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.5 2.5a1.2 1.2 0 0 0-1.7 0L8.2 12.1l-.8-.8a1 1 0 0 0-1.4 1.4l.8.8-3.3 3.3a1 1 0 0 0 0 1.4l1.6 1.6-2.6 2.6 1.4 1.4 2.6-2.6 1.6 1.6a1 1 0 0 0 1.4 0l3.3-3.3.8.8a1 1 0 0 0 1.4-1.4l-.8-.8 9.6-9.6a1.2 1.2 0 0 0 0-1.7l-4.5-4.5zM17.4 6.7 9.8 14.3l-.9-.9 7.6-7.6.9.9z" />
              </svg>
            </button>
          )}

          {/* =============================================================
              3. RUN / SPRINT (Course) — Upper Flank Stone Medallion
              ============================================================= */}
          <button
            type="button"
            aria-label="Courir"
            aria-pressed={sprintLocked}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onClick={toggleSprintLock}
            className={`group absolute bottom-20 right-0 flex h-12 w-12 items-center justify-center rounded-xl border-[3px] transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d9983b] ${
              sprintLocked
                ? 'border-t-[#d9983b] border-l-[#d9983b] border-b-[#472c0d] border-r-[#472c0d] bg-gradient-to-br from-[#3b2713] via-[#26180a] to-[#170e05] text-[#fadc9e] shadow-[0_5px_0_#140c04,0_0_14px_rgba(217,152,59,0.45),inset_1px_1px_0_rgba(255,255,255,0.25)] active:shadow-[0_2px_0_#140c04,inset_0_3px_5px_rgba(0,0,0,0.85)]'
                : 'border-t-[#6e7d8c] border-l-[#6e7d8c] border-b-[#12161c] border-r-[#12161c] bg-gradient-to-br from-[#262f3a] via-[#1a2128] to-[#11161a] text-[#cfc7b6] shadow-[0_4px_0_#0d1115,0_6px_14px_rgba(0,0,0,0.65),inset_1px_1px_0_rgba(255,255,255,0.12)] active:border-t-[#12161c] active:border-l-[#12161c] active:border-b-[#4c5864] active:border-r-[#4c5864] active:shadow-[0_2px_0_#0d1115,inset_0_3px_5px_rgba(0,0,0,0.85)]'
            }`}
          >
            {/* Chiseled Corner Accent */}
            <div className="pointer-events-none absolute top-1 right-1 h-1 w-1 bg-[#12161c]/80" />

            {/* Active Lock Gemstone Pip */}
            {sprintLocked && (
              <span className="pointer-events-none absolute -top-1.5 h-2 w-2 rounded-sm border border-[#fadc9e] bg-[#d9983b] shadow-[0_0_6px_#d9983b]" />
            )}

            {/* Chiseled Runner Silhouette Icon */}
            <svg
              className={`relative h-5 w-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-transform group-active:scale-95 ${
                sprintLocked ? 'text-[#fadc9e]' : 'text-[#d4ccbd]'
              }`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="16" cy="4" r="2.2" />
              <path d="m14.2 7.3-3.8 2.2-2.1-1.8-1.3 1.5 2.8 2.4c.5.4 1.1.6 1.8.4l3.1-1.1 1.7 3.3-2.9 3.8 1.6 1.2 3.5-4.5c.4-.5.5-1.1.3-1.7l-1.5-3.1 1.8-1.1 2.3 2.5 1.5-1.4-3.1-3.4c-.6-.7-1.8-1-2.9-.6z" />
              <path d="M5.5 14.5 4 19l1.9.6 1.3-4.1z" />
            </svg>
          </button>

          {/* =============================================================
              4. SNEAK / CROUCH (Discrétion) — Left Flank Stone Medallion
              ============================================================= */}
          {onCrouchChange && (
            <button
              type="button"
              aria-label="Discrétion / Accroupi"
              aria-pressed={crouchLocked}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              onClick={toggleCrouchLock}
              className={`group absolute bottom-0 right-20 flex h-12 w-12 items-center justify-center rounded-xl border-[3px] transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7abecf] ${
                crouchLocked
                  ? 'border-t-[#7abecf] border-l-[#7abecf] border-b-[#173038] border-r-[#173038] bg-gradient-to-br from-[#162e36] via-[#0f2127] to-[#081216] text-[#dcf4fa] shadow-[0_5px_0_#070f12,0_0_14px_rgba(122,190,207,0.45),inset_1px_1px_0_rgba(255,255,255,0.25)] active:shadow-[0_2px_0_#070f12,inset_0_3px_5px_rgba(0,0,0,0.85)]'
                  : 'border-t-[#6e7d8c] border-l-[#6e7d8c] border-b-[#12161c] border-r-[#12161c] bg-gradient-to-br from-[#262f3a] via-[#1a2128] to-[#11161a] text-[#cfc7b6] shadow-[0_4px_0_#0d1115,0_6px_14px_rgba(0,0,0,0.65),inset_1px_1px_0_rgba(255,255,255,0.12)] active:border-t-[#12161c] active:border-l-[#12161c] active:border-b-[#4c5864] active:border-r-[#4c5864] active:shadow-[0_2px_0_#0d1115,inset_0_3px_5px_rgba(0,0,0,0.85)]'
            }`}
          >
            {/* Chiseled Corner Accent */}
            <div className="pointer-events-none absolute top-1 right-1 h-1 w-1 bg-[#12161c]/80" />

            {/* Active Lock Gemstone Pip */}
            {crouchLocked && (
              <span className="pointer-events-none absolute -top-1.5 h-2 w-2 rounded-sm border border-[#dcf4fa] bg-[#7abecf] shadow-[0_0_6px_#7abecf]" />
            )}

            {/* Chiseled Hooded Stalker Icon */}
            <svg
              className={`relative h-5 w-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-transform group-active:scale-95 ${
                crouchLocked ? 'text-[#dcf4fa]' : 'text-[#d4ccbd]'
              }`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="14" cy="8.5" r="2.1" />
              <path d="M12.5 11.2c-.8 0-1.6.4-2.1 1.1l-2.6 3.6 1.6 1.2 2.3-3.1 2.8 1.4-3.5 3.8 1.5 1.3 4.2-4.6c.4-.4.5-1 .3-1.5l-1.3-2.6 1.7-.8 1.2 1.4 1.5-1.3-2.4-2.7c-.5-.6-1.3-.9-2.1-.9z" />
              <ellipse cx="12" cy="21" rx="6" ry="1.2" opacity="0.4" />
            </svg>
          </button>
        )}
      </div>
    </div>
  </div>
);
};
