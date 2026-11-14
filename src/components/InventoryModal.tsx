import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Package, Scissors, Trash2, X } from 'lucide-react';
import {
  ACTIVE_INVENTORY_CATEGORIES,
  countUsedInventorySlots,
  INVENTORY_CAPACITY,
  ITEM_CATALOG,
  ITEM_CATEGORY_LABELS,
} from '../game/inventory';
import { InventorySlot, ItemCategory } from '../game/types';
import { ItemIcon } from './ItemIcon';

interface InventoryModalProps {
  slots: (InventorySlot | null)[];
  devModeEnabled: boolean;
  onClose: () => void;
  onMoveOrSwap: (fromIdx: number, toIdx: number) => void;
  onSplitStack: (slotIdx: number) => void;
  onDiscardItem: (slotIdx: number, amount?: number) => void;
}

const RARITY_BADGE: Record<string, string> = {
  common: 'border-white/15 bg-[#1b2229] text-[#b4bec7]',
  uncommon: 'border-[#5a9276]/50 bg-[#182921] text-[#a5dbc0]',
  rare: 'border-[#6f97b8]/55 bg-[#192632] text-[#b7daf5]',
  unique: 'border-[#e0a65c]/65 bg-[#2d2316] text-[#f2cfa0]',
};

export const InventoryModal: React.FC<InventoryModalProps> = ({
  slots,
  devModeEnabled,
  onClose,
  onMoveOrSwap,
  onSplitStack,
  onDiscardItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | ItemCategory>('all');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(() => {
    const first = slots.findIndex((s) => s !== null);
    return first >= 0 ? first : null;
  });
  const [moveFromIdx, setMoveFromIdx] = useState<number | null>(null);

  const usedCount = useMemo(() => countUsedInventorySlots(slots), [slots]);

  const activeSlot =
    selectedIdx !== null && selectedIdx >= 0 && selectedIdx < slots.length
      ? slots[selectedIdx]
      : null;
  const activeDef = activeSlot ? ITEM_CATALOG[activeSlot.itemId] : null;

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handleSlotTap = (idx: number) => {
    if (moveFromIdx !== null) {
      if (moveFromIdx !== idx) {
        onMoveOrSwap(moveFromIdx, idx);
        setSelectedIdx(idx);
      }
      setMoveFromIdx(null);
      return;
    }
    setSelectedIdx(idx);
  };

  return (
    <div
      role="dialog"
      aria-label="Traveler Pack"
      onMouseDown={stopPropagation}
      onTouchStart={stopPropagation}
      className="pointer-events-auto fixed left-1/2 top-1/2 z-40 flex max-h-[min(86vh,680px)] w-[min(95vw,760px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-[#e0a65c]/45 bg-[#12171d]/98 text-xs text-[#dfd8cb] shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Package className="h-4 w-4 text-[#e0a65c]" />
          <div>
            <h2 className="font-display text-sm font-medium tracking-wide text-[#f0dec0]">
              Traveler Pack
            </h2>
            <p className="text-[11px] text-[#8d98a3]">
              <span className="font-mono tabular-nums text-[#cfc5b4]">
                {usedCount}/{INVENTORY_CAPACITY}
              </span>{' '}
              slots occupied
              {devModeEnabled ? ' · Dev Sandbox (reverts on exit)' : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Inventory"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#9ca7b0] hover:bg-white/10 hover:text-[#e8e2d5]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'border border-[#e0a65c]/70 bg-[#2a2319] text-[#f2dec0]'
              : 'border border-white/10 bg-[#192027] text-[#98a4ae] hover:bg-white/5 hover:text-[#e8e2d5]'
          }`}
        >
          All
        </button>
        {ACTIVE_INVENTORY_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? 'border border-[#e0a65c]/70 bg-[#2a2319] text-[#f2dec0]'
                  : 'border border-white/10 bg-[#192027] text-[#98a4ae] hover:bg-white/5 hover:text-[#e8e2d5]'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Main Grid + Inspector */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 md:flex-row">
        {/* 24-Slot Grid */}
        <div className="flex-1">
          {moveFromIdx !== null && (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-[#e0a65c]/50 bg-[#282016] px-3 py-1.5 text-[11px] text-[#f2dec0]">
              <span>Select destination slot to move or merge stack...</span>
              <button
                type="button"
                onClick={() => setMoveFromIdx(null)}
                className="font-medium text-[#e0a65c] underline"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((slot, idx) => {
              const def = slot ? ITEM_CATALOG[slot.itemId] : null;
              const matchesFilter =
                selectedCategory === 'all' || (def && def.category === selectedCategory);
              const isSelected = selectedIdx === idx;
              const isMoveSource = moveFromIdx === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSlotTap(idx)}
                  aria-label={
                    def && slot
                      ? `${def.name}, quantity ${slot.quantity}`
                      : `Empty slot ${idx + 1}`
                  }
                  className={`relative flex aspect-square min-h-[54px] flex-col items-center justify-center rounded-lg border p-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0a65c] ${
                    isMoveSource
                      ? 'border-[#e0a65c] bg-[#362a1a]'
                      : isSelected
                        ? 'border-[#e0a65c]/80 bg-[#232b34]'
                        : slot
                          ? 'border-white/15 bg-[#192128] hover:border-white/30 hover:bg-[#202932]'
                          : 'border-white/8 bg-[#141a20] hover:border-white/20'
                  } ${slot && !matchesFilter ? 'opacity-30' : 'opacity-100'}`}
                >
                  {def && slot ? (
                    <>
                      <ItemIcon icon={def.icon} className="h-7 w-7" />
                      {slot.quantity > 1 && (
                        <span className="absolute bottom-1 right-1.5 rounded bg-[#0e1217]/90 px-1 font-mono text-[10px] font-semibold tabular-nums text-[#f0dec0]">
                          {slot.quantity}
                        </span>
                      )}
                      {def.isUnique && (
                        <span
                          aria-hidden="true"
                          className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e0a65c]"
                        />
                      )}
                    </>
                  ) : (
                    <span className="font-mono text-[10px] tabular-nums text-[#414c56]">
                      {idx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Item Inspector Panel */}
        <aside className="flex w-full flex-col justify-between rounded-xl border border-white/10 bg-[#161d24] p-3.5 md:w-64">
          {activeSlot && activeDef ? (
            <>
              <div>
                <div className="flex items-start gap-3 border-b border-white/10 pb-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-[#1c252e]">
                    <ItemIcon icon={activeDef.icon} className="h-8 w-8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-sm font-medium leading-tight text-[#f0dec0]">
                      {activeDef.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                          RARITY_BADGE[activeDef.rarity] ?? RARITY_BADGE.common
                        }`}
                      >
                        {ITEM_CATEGORY_LABELS[activeDef.category]}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-[#96a2ad]">
                        {activeSlot.quantity}/{activeDef.maxStack}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-[#c9c2b4]">
                  {activeDef.description}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-col gap-1.5 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIdx === null) return;
                    setMoveFromIdx((prev) => (prev === selectedIdx ? null : selectedIdx));
                  }}
                  className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#1e262e] px-3 py-1.5 text-xs font-medium text-[#e6dfd2] hover:border-[#e0a65c]/65 hover:bg-[#26303a]"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 text-[#e0a65c]" />
                  <span>{moveFromIdx === selectedIdx ? 'Cancel Move' : 'Move / Swap Slot'}</span>
                </button>

                {activeSlot.quantity >= 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedIdx !== null) onSplitStack(selectedIdx);
                    }}
                    className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#1e262e] px-3 py-1.5 text-xs font-medium text-[#e6dfd2] hover:border-[#e0a65c]/65 hover:bg-[#26303a]"
                  >
                    <Scissors className="h-3.5 w-3.5 text-[#e0a65c]" />
                    <span>Split Stack Half</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  {activeSlot.quantity > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedIdx !== null) onDiscardItem(selectedIdx, 1);
                      }}
                      className="flex min-h-[42px] items-center justify-center gap-1 rounded-lg border border-[#a84a40]/45 bg-[#291a19] px-2 py-1.5 text-[11px] font-medium text-[#eabdb8] hover:bg-[#382220]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Drop 1</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedIdx !== null) onDiscardItem(selectedIdx);
                    }}
                    className={`flex min-h-[42px] items-center justify-center gap-1 rounded-lg border border-[#a84a40]/45 bg-[#291a19] px-2 py-1.5 text-[11px] font-medium text-[#eabdb8] hover:bg-[#382220] ${
                      activeSlot.quantity <= 1 ? 'col-span-2' : ''
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{activeSlot.quantity > 1 ? 'Drop All' : 'Discard'}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <Package className="mb-2 h-6 w-6 text-[#4a5560]" />
              <p className="text-xs font-medium text-[#9aa5b0]">Select an item slot</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#6b7680]">
                Gather branches, stone, ore, berries, mushrooms, and curios across Thornvale to fill your pack.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
