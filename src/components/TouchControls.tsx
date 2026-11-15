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

const STICK_RADIUS = 44;

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

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {/* Left Virtual Thumbstick */}
      <div
        role="application"
        aria-label="Movement Joystick"
        className="pointer-events-auto absolute bottom-6 left-5 flex h-28 w-28 items-center justify-center rounded-full border border-white/15 bg-[#161c22]/78"
        onTouchStart={handleStickTouchStart}
        onTouchMove={handleStickTouchMove}
        onTouchEnd={handleStickTouchEnd}
        onTouchCancel={handleStickTouchEnd}
        onMouseDown={handleStickMouseDown}
      >
        <div className="pointer-events-none h-16 w-16 rounded-full border border-white/10" />
        <div
          className={`pointer-events-none absolute h-11 w-11 rounded-full border transition-colors ${
            stickActive
              ? 'border-[#e0a65c]/80 bg-[#3a434d]/95'
              : 'border-white/25 bg-[#28313a]/90'
          }`}
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Right Action Buttons (Contextual Use/Enter, Run & Jump) */}
      <div className="pointer-events-auto absolute bottom-7 right-5 flex flex-col items-end gap-2.5">
        {interactPrompt && onInteract && (
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
            className="flex h-11 items-center justify-center rounded-xl border border-[#e0a65c]/65 bg-[#332718]/92 px-4 text-xs font-medium tracking-wide text-[#f2dfc0] active:bg-[#4b3822] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c]"
          >
            {interactPrompt.kind === 'portal'
              ? 'Enter'
              : interactPrompt.kind === 'npc'
                ? 'Talk'
                : interactPrompt.kind === 'resource'
                  ? 'Gather'
                  : interactPrompt.kind === 'found_item'
                    ? 'Take'
                    : 'Use'}
          </button>
        )}

        <div className="flex items-end gap-2.5">
          {onAttack && (
            <button
              type="button"
              onTouchStart={(e) => {
                e.stopPropagation();
                onAttack();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAttack();
              }}
              className="flex h-12 min-w-14 items-center justify-center rounded-xl border border-[#c96a52]/55 bg-[#2e1c1a]/90 px-3 text-xs font-medium tracking-wide text-[#f0d8cf] active:bg-[#472926] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c]"
            >
              Strike
            </button>
          )}

          {onCrouchChange && (
            <button
              type="button"
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              onClick={toggleCrouchLock}
              aria-pressed={crouchLocked}
              className={`flex h-12 min-w-12 items-center justify-center rounded-xl border px-3 text-xs font-medium tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                crouchLocked
                  ? 'border-[#7fb8c9]/70 bg-[#1a2f36]/90 text-[#cbeaf2]'
                  : 'border-white/15 bg-[#161c22]/85 text-[#d7d2c6]'
              }`}
            >
              Sneak
            </button>
          )}

          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onClick={toggleSprintLock}
            aria-pressed={sprintLocked}
            className={`flex h-12 min-w-12 items-center justify-center rounded-xl border px-3.5 text-xs font-medium tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
              sprintLocked
                ? 'border-[#e0a65c]/70 bg-[#52381c]/90 text-[#f5dec0]'
                : 'border-white/15 bg-[#161c22]/85 text-[#d7d2c6]'
            }`}
          >
            Run
          </button>

          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              onJump();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onJump();
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#1e262e]/90 text-xs font-medium tracking-wide text-[#e8e2d5] active:bg-[#323d48] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c]"
          >
            Jump
          </button>
        </div>
      </div>
    </div>
  );
};
