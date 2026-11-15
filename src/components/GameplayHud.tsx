import React, { useMemo, useState } from 'react';
import {
  Anvil,
  Archive,
  BookOpen,
  Check,
  Compass,
  Flame,
  Hammer,
  HeartPulse,
  Lock,
  Moon,
  RotateCw,
  ScrollText,
  Shield,
  Sparkles,
  Sun,
  Swords,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  JOURNAL_ENTRIES,
  SECRET_MECHANISMS,
  TREASURE_CONTAINERS,
} from '../data/exploration';
import {
  CONSUMABLE_EFFECTS_BY_ITEM_ID,
  GEAR_STATS_BY_ITEM_ID,
} from '../data/itemsGameplay';
import { GAMEPLAY_QUESTS } from '../data/quests';
import { CRAFTING_RECIPES } from '../data/recipes';
import { BUILDABLE_STRUCTURE_LIST, BUILDABLE_STRUCTURES } from '../data/structures';
import {
  countInventoryItem,
  countUsedInventorySlots,
  INVENTORY_CAPACITY,
  ITEM_CATALOG,
} from '../game/inventory';
import { STASH_CAPACITY } from '../game/persistence';
import { ThornvaleSaveState } from '../game/types';
import { CombatDerivedStats } from '../systems/EquipmentSystem';
import {
  ExplorationAtmosphereState,
  JournalEntryDef,
} from '../types/exploration';
import {
  BuildableStructureId,
  CraftingStationKind,
  GearSlot,
  PlacementPreviewState,
  PlayerSurvivalState,
  StructureEnvironmentId,
} from '../types/gameplay';
import { ItemIcon } from './ItemIcon';

export type WorkshopTab = 'craft' | 'build' | 'gear' | 'quests' | 'journal';

interface SurvivalMetersProps {
  survival: PlayerSurvivalState;
}

export const SurvivalMeters: React.FC<SurvivalMetersProps> = ({ survival }) => {
  const staminaPct = Math.max(
    0,
    Math.min(100, (survival.stamina / Math.max(1, survival.maxStamina)) * 100)
  );
  const warmthPct = Math.max(
    0,
    Math.min(100, (survival.warmth / Math.max(1, survival.maxWarmth)) * 100)
  );

  const hasCampfire = survival.nearbyStations.includes('campfire');
  const hasWorkbench = survival.nearbyStations.includes('workbench');

  return (
    <div className="mt-1.5 flex w-40 flex-col gap-1 rounded-md border border-white/12 bg-[#141a20]/90 px-2.5 py-1.5">
      <div>
        <div className="mb-0.5 flex items-center justify-between text-[10px] tracking-wide text-[#c5beb0]">
          <span>Stamina</span>
          <span className="font-mono tabular-nums">{survival.stamina}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-sm bg-[#272f37]">
          <div
            className={`h-full transition-[width] duration-150 ${
              staminaPct < 20 ? 'bg-[#b96b38]' : 'bg-[#64966a]'
            }`}
            style={{ width: `${staminaPct}%` }}
          />
        </div>
      </div>

      <div>
        <div className="mb-0.5 flex items-center justify-between text-[10px] tracking-wide text-[#c5beb0]">
          <span>Warmth</span>
          <span className="font-mono tabular-nums">{survival.warmth}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-sm bg-[#272f37]">
          <div
            className={`h-full transition-[width] duration-150 ${
              warmthPct < 35 ? 'bg-[#5d82a3]' : 'bg-[#cc7d3d]'
            }`}
            style={{ width: `${warmthPct}%` }}
          />
        </div>
      </div>

      {(survival.nearFire || survival.inShelter || hasCampfire || hasWorkbench) && (
        <div className="mt-0.5 flex flex-wrap gap-1 border-t border-white/10 pt-1 text-[9px] font-medium text-[#e6c38d]">
          {survival.nearFire && (
            <span className="rounded border border-[#e0a65c]/35 bg-[#291f14] px-1 py-0.5">
              Hearth Warmth
            </span>
          )}
          {survival.inShelter && (
            <span className="rounded border border-[#6e9977]/40 bg-[#19261d] px-1 py-0.5 text-[#a8d5b0]">
              Sheltered
            </span>
          )}
          {hasWorkbench && (
            <span className="rounded border border-white/15 bg-[#1e262f] px-1 py-0.5 text-[#d4dde6]">
              Workbench
            </span>
          )}
        </div>
      )}
    </div>
  );
};

interface GameplayHudProps {
  saveState: ThornvaleSaveState;
  survival: PlayerSurvivalState;
  placement: PlacementPreviewState;
  activeEnvironmentId: StructureEnvironmentId;
  combatStats: CombatDerivedStats;
  atmosphere?: ExplorationAtmosphereState;
  devModeEnabled: boolean;
  touchEnabled: boolean;
  workshopOpen: boolean;
  workshopTab: WorkshopTab;
  stashOpen: boolean;
  onChangeWorkshopTab: (tab: WorkshopTab) => void;
  onCloseWorkshop: () => void;
  onCloseStash: () => void;
  onCraftRecipe: (recipeId: string) => void;
  onStartPlacement: (structureId: BuildableStructureId) => void;
  onConfirmPlacement: () => void;
  onRotatePlacement: () => void;
  onCancelPlacement: () => void;
  onDismantleStructure: (recordId: string) => void;
  onEquipSlot: (slotIdx: number) => void;
  onUnequipSlot: (slot: GearSlot) => void;
  onUseSlot: (slotIdx: number) => void;
  onTransferPackToStash: (packIdx: number) => void;
  onTransferStashToPack: (stashIdx: number) => void;
  onClaimQuest: (questId: string) => void;
}

const STATION_LABELS: Record<'all' | CraftingStationKind, string> = {
  all: 'All',
  hand: 'Hand Craft',
  campfire: 'Campfire',
  workbench: 'Workbench',
};

const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
  weapon: 'Weapon',
  tool: 'Tool',
  armor: 'Armor / Mantle',
  shield: 'Off-Hand Shield',
};

const JOURNAL_CATEGORY_LABELS: Record<'all' | JournalEntryDef['category'], string> = {
  all: 'All',
  lore: 'Lore',
  map_clue: 'Map Clues',
  secret: 'Secrets',
  phenomenon: 'Phenomena',
};

export const GameplayHud: React.FC<GameplayHudProps> = ({
  saveState,
  survival,
  placement,
  activeEnvironmentId,
  combatStats,
  atmosphere,
  devModeEnabled,
  touchEnabled,
  workshopOpen,
  workshopTab,
  stashOpen,
  onChangeWorkshopTab,
  onCloseWorkshop,
  onCloseStash,
  onCraftRecipe,
  onStartPlacement,
  onConfirmPlacement,
  onRotatePlacement,
  onCancelPlacement,
  onDismantleStructure,
  onEquipSlot,
  onUnequipSlot,
  onUseSlot,
  onTransferPackToStash,
  onTransferStashToPack,
  onClaimQuest,
}) => {
  const [stationFilter, setStationFilter] = useState<'all' | CraftingStationKind>('all');
  const [journalFilter, setJournalFilter] = useState<'all' | JournalEntryDef['category']>('all');

  const stopProp = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const placedInCurrentEnv = useMemo(() => {
    const all = saveState.gameplay?.placedStructures ?? [];
    return all.filter((s) => s.environmentId === activeEnvironmentId);
  }, [saveState.gameplay?.placedStructures, activeEnvironmentId]);

  const usableInventory = useMemo(() => {
    const out: {
      idx: number;
      itemId: string;
      name: string;
      quantity: number;
      isGear: boolean;
      isConsumable: boolean;
    }[] = [];
    saveState.inventory.forEach((slot, idx) => {
      if (!slot) return;
      const def = ITEM_CATALOG[slot.itemId];
      const isGear = !!GEAR_STATS_BY_ITEM_ID[slot.itemId];
      const isConsumable = !!CONSUMABLE_EFFECTS_BY_ITEM_ID[slot.itemId];
      if (!isGear && !isConsumable) return;
      out.push({
        idx,
        itemId: slot.itemId,
        name: def ? def.name : slot.itemId,
        quantity: slot.quantity,
        isGear,
        isConsumable,
      });
    });
    return out;
  }, [saveState.inventory]);

  const filteredRecipes = useMemo(() => {
    if (stationFilter === 'all') return CRAFTING_RECIPES;
    return CRAFTING_RECIPES.filter((r) => r.station === stationFilter);
  }, [stationFilter]);

  const filteredJournal = useMemo(() => {
    if (journalFilter === 'all') return JOURNAL_ENTRIES;
    return JOURNAL_ENTRIES.filter((entry) => entry.category === journalFilter);
  }, [journalFilter]);

  const unlockedJournalCount = Object.values(
    saveState.exploration?.journalEntries ?? {}
  ).filter(Boolean).length;
  const openedChestsCount = Object.values(
    saveState.exploration?.openedChests ?? {}
  ).filter(Boolean).length;
  const activatedMechsCount = Object.values(
    saveState.exploration?.activatedMechanisms ?? {}
  ).filter(Boolean).length;

  const stashSlots = saveState.gameplay?.stash ?? [];
  const usedPack = countUsedInventorySlots(saveState.inventory);
  const usedStash = countUsedInventorySlots(stashSlots);

  const placementBottomClass = touchEnabled ? 'bottom-52 sm:bottom-20' : 'bottom-20';

  return (
    <>
      {/* Ghost Structure Placement Control Bar */}
      {placement.active && !workshopOpen && !stashOpen && (
        <div
          onMouseDown={stopProp}
          onTouchStart={stopProp}
          className={`pointer-events-auto fixed left-1/2 z-30 flex w-[min(94vw,460px)] -translate-x-1/2 flex-col gap-2 rounded-xl border bg-[#12171d]/96 px-4 py-3 text-xs text-[#e5dfd3] shadow-2xl ${
            placement.valid ? 'border-[#6da876]/75' : 'border-[#b35147]/75'
          } ${placementBottomClass}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-display text-sm font-medium text-[#f2dec0]">
                Placing: {placement.structureName}
              </div>
              <div
                className={`text-[11px] font-medium ${
                  placement.valid ? 'text-[#9bd3a4]' : 'text-[#e59d95]'
                }`}
              >
                {placement.reason}
              </div>
            </div>
            <span
              className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                placement.valid
                  ? 'border-[#6da876]/60 bg-[#1a2b1e] text-[#a5deb0]'
                  : 'border-[#b35147]/60 bg-[#2e1a18] text-[#ebb0a9]'
              }`}
            >
              {placement.valid ? 'VALID' : 'BLOCKED'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!placement.valid}
              onClick={onConfirmPlacement}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                placement.valid
                  ? 'border-[#e0a65c]/75 bg-[#2a2216] text-[#f5e3c6] hover:bg-[#382d1d]'
                  : 'cursor-not-allowed border-white/10 bg-[#192027] text-[#6d7782]'
              }`}
            >
              <Check className="h-4 w-4" />
              <span>Place [F]</span>
            </button>

            <button
              type="button"
              onClick={onRotatePlacement}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#1b232b] px-3 py-1.5 text-xs font-medium text-[#e0d8c8] hover:border-[#e0a65c]/65 hover:bg-[#232d37]"
            >
              <RotateCw className="h-3.5 w-3.5 text-[#e0a65c]" />
              <span>Rotate [R]</span>
            </button>

            <button
              type="button"
              onClick={onCancelPlacement}
              className="flex min-h-[44px] items-center justify-center gap-1 rounded-lg border border-white/15 bg-[#1b232b] px-3 py-1.5 text-xs font-medium text-[#b8c2ca] hover:bg-white/10 hover:text-[#e8e2d5]"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Workshop Modal: Crafting, Building, Gear & Quests */}
      {workshopOpen && (
        <div
          role="dialog"
          aria-label="Field Workshop and Journal"
          onMouseDown={stopProp}
          onTouchStart={stopProp}
          className="pointer-events-auto fixed left-1/2 top-1/2 z-40 flex max-h-[min(88vh,700px)] w-[min(96vw,840px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-[#e0a65c]/45 bg-[#12171d]/98 text-xs text-[#dfd8cb] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Anvil className="h-4 w-4 text-[#e0a65c]" />
              <div>
                <h2 className="font-display text-sm font-medium tracking-wide text-[#f0dec0]">
                  Thornvale Workshop & Ledger
                </h2>
                <p className="text-[11px] text-[#8d98a3]">
                  Nearby stations:{' '}
                  <span className="text-[#cfc6b6]">
                    {survival.nearbyStations
                      .map((s) => STATION_LABELS[s])
                      .join(' · ')}
                  </span>
                  {devModeEnabled ? ' · Dev Sandbox Active' : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseWorkshop}
              aria-label="Close Workshop"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#9ca7b0] hover:bg-white/10 hover:text-[#e8e2d5]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Primary Tabs */}
          <div className="grid grid-cols-2 gap-1.5 border-b border-white/10 px-4 py-2 sm:grid-cols-5">
            {(
              [
                { id: 'craft', label: 'Crafting', icon: Wrench },
                { id: 'build', label: 'Build', icon: Hammer },
                { id: 'gear', label: 'Gear & Vitals', icon: Shield },
                { id: 'quests', label: 'Quests', icon: ScrollText },
                { id: 'journal', label: 'Journal & Lore', icon: BookOpen },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = workshopTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeWorkshopTab(tab.id)}
                  className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-[#e0a65c]/75 bg-[#2a2217] text-[#f2dec0]'
                      : 'border-white/10 bg-[#182027] text-[#98a4ae] hover:bg-white/5 hover:text-[#e8e2d5]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 text-[#e0a65c]" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {workshopTab === 'craft' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['all', 'hand', 'campfire', 'workbench'] as const).map((st) => {
                      const available =
                        st === 'all' || survival.nearbyStations.includes(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStationFilter(st)}
                          className={`min-h-[36px] rounded-lg border px-3 py-1 text-[11px] font-medium transition-colors ${
                            stationFilter === st
                              ? 'border-[#e0a65c]/70 bg-[#2a2319] text-[#f2dec0]'
                              : 'border-white/10 bg-[#192027] text-[#98a4ae] hover:text-[#e8e2d5]'
                          }`}
                        >
                          {STATION_LABELS[st]}
                          {st !== 'all' && !available ? ' (Need nearby)' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {filteredRecipes.map((recipe) => {
                    const outDef = ITEM_CATALOG[recipe.outputItemId];
                    const unlocked = recipe.requiredUnlockId
                      ? !!saveState.exploration?.unlockedRecipes?.[recipe.requiredUnlockId]
                      : true;
                    const stationReady = survival.nearbyStations.includes(recipe.station);
                    const hasMats = recipe.ingredients.every(
                      (ing) => countInventoryItem(saveState.inventory, ing.itemId) >= ing.quantity
                    );
                    const canCraft = unlocked && stationReady && hasMats;

                    return (
                      <div
                        key={recipe.id}
                        className={`flex flex-col justify-between gap-2.5 rounded-xl border p-3 ${
                          unlocked
                            ? 'border-white/12 bg-[#171f26]'
                            : 'border-white/8 bg-[#141a20] opacity-85'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-[#1d2630]">
                            {outDef && <ItemIcon icon={outDef.icon} className="h-7 w-7" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="truncate font-display text-sm font-medium text-[#f0dec0]">
                                {outDef ? outDef.name : recipe.outputItemId}
                                {recipe.outputQuantity > 1 ? ` x${recipe.outputQuantity}` : ''}
                              </h3>
                              {!unlocked ? (
                                <span className="flex shrink-0 items-center gap-1 rounded border border-[#e0a65c]/45 bg-[#282016] px-1.5 py-0.5 text-[10px] text-[#e7c48b]">
                                  <Lock className="h-2.5 w-2.5" />
                                  <span>Locked</span>
                                </span>
                              ) : (
                                <span
                                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                                    stationReady
                                      ? 'border-[#5a9276]/45 bg-[#182921] text-[#a5dbc0]'
                                      : 'border-[#a84a40]/45 bg-[#291a19] text-[#eabdb8]'
                                  }`}
                                >
                                  {STATION_LABELS[recipe.station]}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] leading-snug text-[#a5b0ba]">
                              {recipe.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {recipe.ingredients.map((ing) => {
                            const ingDef = ITEM_CATALOG[ing.itemId];
                            const owned = countInventoryItem(saveState.inventory, ing.itemId);
                            const ok = owned >= ing.quantity;
                            return (
                              <span
                                key={ing.itemId}
                                className={`rounded border px-2 py-0.5 font-mono text-[10px] tabular-nums ${
                                  ok
                                    ? 'border-white/15 bg-[#1d262f] text-[#dce4ec]'
                                    : 'border-[#a84a40]/45 bg-[#2a1a19] text-[#e7ada6]'
                                }`}
                              >
                                {ingDef ? ingDef.name : ing.itemId}: {owned}/{ing.quantity}
                              </span>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          disabled={!canCraft}
                          onClick={() => onCraftRecipe(recipe.id)}
                          className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            canCraft
                              ? 'border-[#e0a65c]/70 bg-[#2b2217] text-[#f3e1c3] hover:bg-[#3a2e1f]'
                              : 'cursor-not-allowed border-white/10 bg-[#141a20] text-[#6d7782]'
                          }`}
                        >
                          {!unlocked ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : (
                            <Anvil className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {!unlocked
                              ? 'Locked Schematic (Find in World)'
                              : !stationReady
                                ? `Needs ${STATION_LABELS[recipe.station]}`
                                : !hasMats
                                  ? 'Missing Materials'
                                  : 'Craft'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {workshopTab === 'build' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {BUILDABLE_STRUCTURE_LIST.map((st) => {
                    const envAllowed =
                      activeEnvironmentId === 'overworld' ? st.allowOverworld : st.allowInterior;
                    const hasMats = st.costs.every(
                      (c) => countInventoryItem(saveState.inventory, c.itemId) >= c.quantity
                    );
                    const canStart = envAllowed && hasMats;

                    return (
                      <div
                        key={st.id}
                        className="flex flex-col justify-between gap-2.5 rounded-xl border border-white/12 bg-[#171f26] p-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-display text-sm font-medium text-[#f0dec0]">
                              {st.name}
                            </h3>
                            <span className="rounded border border-white/12 bg-[#1c242c] px-1.5 py-0.5 text-[10px] text-[#b4bec7]">
                              {st.allowInterior ? 'Out & Indoors' : 'Outdoors Only'}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-[#a6b1bb]">
                            {st.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {st.costs.map((c) => {
                            const def = ITEM_CATALOG[c.itemId];
                            const owned = countInventoryItem(saveState.inventory, c.itemId);
                            const ok = owned >= c.quantity;
                            return (
                              <span
                                key={c.itemId}
                                className={`rounded border px-2 py-0.5 font-mono text-[10px] tabular-nums ${
                                  ok
                                    ? 'border-white/15 bg-[#1d262f] text-[#dce4ec]'
                                    : 'border-[#a84a40]/45 bg-[#2a1a19] text-[#e7ada6]'
                                }`}
                              >
                                {def ? def.name : c.itemId}: {owned}/{c.quantity}
                              </span>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          disabled={!canStart}
                          onClick={() => onStartPlacement(st.id)}
                          className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            canStart
                              ? 'border-[#e0a65c]/75 bg-[#2b2217] text-[#f3e1c3] hover:bg-[#3a2e1f]'
                              : 'cursor-not-allowed border-white/10 bg-[#141a20] text-[#6d7782]'
                          }`}
                        >
                          <Hammer className="h-3.5 w-3.5" />
                          <span>
                            {!envAllowed
                              ? 'Outdoors Only'
                              : !hasMats
                                ? 'Insufficient Materials'
                                : 'Place Structure'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {placedInCurrentEnv.length > 0 && (
                  <div className="border-t border-white/10 pt-3">
                    <h3 className="mb-2 font-display text-xs font-medium uppercase tracking-wider text-[#cfc6b6]">
                      Built in This Area ({placedInCurrentEnv.length})
                    </h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {placedInCurrentEnv.map((rec) => {
                        const def = BUILDABLE_STRUCTURES[rec.structureId];
                        return (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#171f26] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[#ede5d6]">
                                {def ? def.name : rec.structureId}
                              </div>
                              <div className="font-mono text-[10px] text-[#8d98a3]">
                                ({rec.x.toFixed(1)}, {rec.z.toFixed(1)})
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onDismantleStructure(rec.id)}
                              className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-[#a84a40]/45 bg-[#291a19] px-2.5 py-1 text-[11px] font-medium text-[#eabdb8] hover:bg-[#382220]"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Dismantle</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {workshopTab === 'gear' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {/* 4 Equipment Slots */}
                  <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#171f26] p-3">
                    <h3 className="font-display text-xs font-medium uppercase tracking-wider text-[#cfc6b6]">
                      Equipped Gear
                    </h3>
                    {(['weapon', 'tool', 'armor', 'shield'] as const).map((slot) => {
                      const eqId = saveState.gameplay?.equipment?.[slot] ?? null;
                      const def = eqId ? ITEM_CATALOG[eqId] : null;
                      return (
                        <div
                          key={slot}
                          className="flex min-h-[48px] items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#12171d] px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 bg-[#1a222b]">
                              {def ? (
                                <ItemIcon icon={def.icon} className="h-6 w-6" />
                              ) : (
                                <Shield className="h-4 w-4 text-[#4a5560]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] uppercase tracking-wider text-[#8d98a3]">
                                {GEAR_SLOT_LABELS[slot]}
                              </div>
                              <div className="truncate font-medium text-[#ede5d6]">
                                {def ? def.name : 'None equipped'}
                              </div>
                            </div>
                          </div>
                          {eqId && (
                            <button
                              type="button"
                              onClick={() => onUnequipSlot(slot)}
                              className="min-h-[34px] shrink-0 rounded-lg border border-white/15 bg-[#1e262f] px-2.5 py-1 text-[11px] font-medium text-[#e0d8c8] hover:border-[#e0a65c]/65"
                            >
                              Unequip
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Derived Combat & Field Readiness Stats */}
                  <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-[#171f26] p-3">
                    <div>
                      <h3 className="font-display text-xs font-medium uppercase tracking-wider text-[#cfc6b6]">
                        Wanderer Combat & Field Readiness
                      </h3>
                      <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-white/10 bg-[#12171d] p-2.5">
                          <div className="flex items-center gap-1 text-[10px] text-[#8d98a3]">
                            <Swords className="h-3 w-3 text-[#e0a65c]" />
                            <span>Attack Power</span>
                          </div>
                          <div className="mt-1 font-mono text-base font-semibold text-[#f0dec0]">
                            {combatStats.attackDamage}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#12171d] p-2.5">
                          <div className="flex items-center gap-1 text-[10px] text-[#8d98a3]">
                            <Shield className="h-3 w-3 text-[#e0a65c]" />
                            <span>Armor Mitigation</span>
                          </div>
                          <div className="mt-1 font-mono text-base font-semibold text-[#f0dec0]">
                            {Math.round(combatStats.defenseReduction * 100)}%
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#12171d] p-2.5">
                          <div className="flex items-center gap-1 text-[10px] text-[#8d98a3]">
                            <Flame className="h-3 w-3 text-[#e0a65c]" />
                            <span>Insulation Bonus</span>
                          </div>
                          <div className="mt-1 font-mono text-base font-semibold text-[#f0dec0]">
                            +{Math.round(combatStats.warmthBonus * 100)}%
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#12171d] p-2.5">
                          <div className="flex items-center gap-1 text-[10px] text-[#8d98a3]">
                            <HeartPulse className="h-3 w-3 text-[#e0a65c]" />
                            <span>Harvest Tools</span>
                          </div>
                          <div className="mt-1 text-[11px] font-medium text-[#e0d8c8]">
                            Axe: {combatStats.ownedTools.axe ? 'Ready' : 'None'} · Pick:{' '}
                            {combatStats.ownedTools.pickaxe ? 'Ready' : 'None'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-[#12171d] px-3 py-2 text-[11px] text-[#9aa5b0]">
                      Equipped tools and weapons replace your drawn travel blade in 3D during combat and harvesting. Shields and cloaks remain visible on your wanderer rig.
                    </div>
                  </div>
                </div>

                {/* Pack Gear & Provisions Quick-Use */}
                <div className="border-t border-white/10 pt-3">
                  <h3 className="mb-2 font-display text-xs font-medium uppercase tracking-wider text-[#cfc6b6]">
                    Equippable Gear & Provisions in Pack
                  </h3>
                  {usableInventory.length === 0 ? (
                    <p className="rounded-lg border border-white/10 bg-[#171f26] px-3 py-4 text-center text-[11px] text-[#808b96]">
                      Craft tools, armor, weapons, or camp provisions in the Crafting tab, or gather wild berries & mushrooms to use here.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {usableInventory.map((entry) => {
                        const def = ITEM_CATALOG[entry.itemId];
                        return (
                          <div
                            key={`${entry.idx}_${entry.itemId}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#171f26] px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              {def && <ItemIcon icon={def.icon} className="h-6 w-6 shrink-0" />}
                              <div className="min-w-0">
                                <div className="truncate font-medium text-[#ede5d6]">
                                  {entry.name}
                                  {entry.quantity > 1 ? ` x${entry.quantity}` : ''}
                                </div>
                                <div className="text-[10px] text-[#8d98a3]">
                                  {entry.isGear ? 'Equipment' : 'Consumable Provision'}
                                </div>
                              </div>
                            </div>
                            {entry.isGear ? (
                              <button
                                type="button"
                                onClick={() => onEquipSlot(entry.idx)}
                                className="min-h-[36px] shrink-0 rounded-lg border border-[#e0a65c]/65 bg-[#2a2216] px-3 py-1 text-[11px] font-medium text-[#f2dec0] hover:bg-[#3a2f1e]"
                              >
                                Equip
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUseSlot(entry.idx)}
                                className="min-h-[36px] shrink-0 rounded-lg border border-[#5a9276]/60 bg-[#182921] px-3 py-1 text-[11px] font-medium text-[#a5dbc0] hover:bg-[#22392e]"
                              >
                                Use
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {workshopTab === 'quests' && (
              <div className="flex flex-col gap-2.5">
                {GAMEPLAY_QUESTS.map((q) => {
                  const prog = saveState.gameplay?.questStates?.[q.id] ?? {
                    progress: 0,
                    completed: false,
                    claimed: false,
                  };
                  const pct = Math.min(100, (prog.progress / Math.max(1, q.targetCount)) * 100);
                  return (
                    <div
                      key={q.id}
                      className="flex flex-col justify-between gap-2.5 rounded-xl border border-white/12 bg-[#171f26] p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-sm font-medium text-[#f0dec0]">
                            {q.title}
                          </h3>
                          <span className="rounded border border-white/12 bg-[#12171d] px-1.5 py-0.5 text-[10px] text-[#98a4ae]">
                            {q.giver}
                          </span>
                          {prog.claimed && (
                            <span className="rounded border border-[#5a9276]/50 bg-[#182921] px-1.5 py-0.5 text-[10px] text-[#a5dbc0]">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-[#b4bec7]">{q.description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-[#272f37]">
                            <div
                              className="h-full bg-[#e0a65c] transition-[width] duration-200"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] tabular-nums text-[#cfc6b6]">
                            {prog.progress}/{q.targetCount}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
                        <div className="flex flex-wrap gap-1">
                          {q.rewards.map((rw) => {
                            const rDef = ITEM_CATALOG[rw.itemId];
                            return (
                              <span
                                key={rw.itemId}
                                className="rounded border border-white/12 bg-[#12171d] px-2 py-0.5 text-[10px] text-[#dcd3c4]"
                              >
                                +{rw.quantity} {rDef ? rDef.name : rw.itemId}
                              </span>
                            );
                          })}
                        </div>
                        {prog.completed && !prog.claimed && (
                          <button
                            type="button"
                            onClick={() => onClaimQuest(q.id)}
                            className="flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-[#e0a65c]/75 bg-[#2d2316] px-3 py-1 text-xs font-medium text-[#f5e1be] hover:bg-[#3d301e]"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-[#e0a65c]" />
                            <span>Claim Reward</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {workshopTab === 'journal' && (
              <div className="flex flex-col gap-3">
                {/* Exploration Progress Summary */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-white/10 bg-[#171f26] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-[#8d98a3]">
                      Journal Notes
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-[#f0dec0]">
                      {unlockedJournalCount} / {JOURNAL_ENTRIES.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#171f26] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-[#8d98a3]">
                      Secret Passages
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-[#f0dec0]">
                      {activatedMechsCount} / {SECRET_MECHANISMS.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#171f26] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-[#8d98a3]">
                      Hidden Coffers
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-[#f0dec0]">
                      {openedChestsCount} / {TREASURE_CONTAINERS.length}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#171f26] px-3 py-2">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#8d98a3]">
                      {atmosphere?.isDuskOrNight ? (
                        <Moon className="h-3 w-3 text-[#8bc9dc]" />
                      ) : (
                        <Sun className="h-3 w-3 text-[#e0a65c]" />
                      )}
                      <span>Valley Hour</span>
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-semibold capitalize text-[#f0dec0]">
                      {atmosphere ? `${atmosphere.phase} · ${atmosphere.hourLabel}` : 'Day'}
                    </div>
                  </div>
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['all', 'lore', 'map_clue', 'secret', 'phenomenon'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setJournalFilter(cat)}
                      className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        journalFilter === cat
                          ? 'border-[#e0a65c]/70 bg-[#2a2319] text-[#f2dec0]'
                          : 'border-white/10 bg-[#192027] text-[#98a4ae] hover:text-[#e8e2d5]'
                      }`}
                    >
                      {JOURNAL_CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>

                {/* Journal Entries */}
                <div className="flex flex-col gap-2">
                  {filteredJournal.map((entry) => {
                    const known = !!saveState.exploration?.journalEntries?.[entry.id];
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-xl border p-3 ${
                          known
                            ? 'border-[#e0a65c]/30 bg-[#171f26]'
                            : 'border-white/8 bg-[#13181e]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Compass
                              className={`h-3.5 w-3.5 ${
                                known ? 'text-[#e0a65c]' : 'text-[#55616d]'
                              }`}
                            />
                            <h3
                              className={`font-display text-sm font-medium ${
                                known ? 'text-[#f0dec0]' : 'text-[#7c8791]'
                              }`}
                            >
                              {known ? entry.title : `Unexplored Lead — ${entry.regionName}`}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded border border-white/10 bg-[#12171d] px-1.5 py-0.5 text-[10px] text-[#8d98a3]">
                              {entry.regionName}
                            </span>
                            <span className="rounded border border-white/10 bg-[#12171d] px-1.5 py-0.5 text-[10px] text-[#c5b9a3]">
                              {JOURNAL_CATEGORY_LABELS[entry.category]}
                            </span>
                          </div>
                        </div>

                        {known ? (
                          <>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-[#d4cec2]">
                              {entry.body}
                            </p>
                            {entry.secretHint && (
                              <div className="mt-2 rounded border border-[#e0a65c]/30 bg-[#231d15] px-2.5 py-1 text-[11px] font-medium text-[#edd09c]">
                                Lead: {entry.secretHint}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="mt-1 text-[11px] italic text-[#66717b]">
                            Inspect carved stones, ruins, or forgotten caches around {entry.regionName} to record this discovery.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Storage Chest Modal: 24-Slot Pack <-> 18-Slot Persistent Camp Stash */}
      {stashOpen && (
        <div
          role="dialog"
          aria-label="Iron-Bound Storage Chest"
          onMouseDown={stopProp}
          onTouchStart={stopProp}
          className="pointer-events-auto fixed left-1/2 top-1/2 z-40 flex max-h-[min(86vh,680px)] w-[min(96vw,840px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-[#e0a65c]/45 bg-[#12171d]/98 text-xs text-[#dfd8cb] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Archive className="h-4 w-4 text-[#e0a65c]" />
              <div>
                <h2 className="font-display text-sm font-medium tracking-wide text-[#f0dec0]">
                  Iron-Bound Camp Stash
                </h2>
                <p className="text-[11px] text-[#8d98a3]">
                  Tap any slot to transfer between your Traveler Pack ({usedPack}/{INVENTORY_CAPACITY}) and shared Stash ({usedStash}/{STASH_CAPACITY})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseStash}
              aria-label="Close Stash"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#9ca7b0] hover:bg-white/10 hover:text-[#e8e2d5]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
            {/* Pack Side */}
            <div className="rounded-xl border border-white/10 bg-[#161d24] p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-[#e8dfd0]">
                <span>Traveler Pack (Click to Store)</span>
                <span className="font-mono text-[#9ca8b3]">
                  {usedPack}/{INVENTORY_CAPACITY}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {saveState.inventory.map((slot, idx) => {
                  const def = slot ? ITEM_CATALOG[slot.itemId] : null;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!slot}
                      onClick={() => onTransferPackToStash(idx)}
                      title={def && slot ? `Store ${def.name}` : undefined}
                      className={`relative flex aspect-square min-h-[48px] items-center justify-center rounded-lg border p-1 transition-colors ${
                        slot
                          ? 'border-white/15 bg-[#1b242d] hover:border-[#e0a65c]/70 hover:bg-[#24303c]'
                          : 'cursor-default border-white/8 bg-[#12171d]'
                      }`}
                    >
                      {def && slot && (
                        <>
                          <ItemIcon icon={def.icon} className="h-6 w-6" />
                          {slot.quantity > 1 && (
                            <span className="absolute bottom-0.5 right-1 rounded bg-[#0e1217]/90 px-1 font-mono text-[10px] text-[#f0dec0]">
                              {slot.quantity}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stash Side */}
            <div className="rounded-xl border border-white/10 bg-[#161d24] p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-[#e8dfd0]">
                <span>Camp Chest Stash (Click to Take)</span>
                <span className="font-mono text-[#9ca8b3]">
                  {usedStash}/{STASH_CAPACITY}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {Array.from({ length: STASH_CAPACITY }).map((_, idx) => {
                  const slot = stashSlots[idx] ?? null;
                  const def = slot ? ITEM_CATALOG[slot.itemId] : null;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!slot}
                      onClick={() => onTransferStashToPack(idx)}
                      title={def && slot ? `Take ${def.name}` : undefined}
                      className={`relative flex aspect-square min-h-[48px] items-center justify-center rounded-lg border p-1 transition-colors ${
                        slot
                          ? 'border-[#e0a65c]/30 bg-[#21262b] hover:border-[#e0a65c]/80 hover:bg-[#2c333b]'
                          : 'cursor-default border-white/8 bg-[#12171d]'
                      }`}
                    >
                      {def && slot && (
                        <>
                          <ItemIcon icon={def.icon} className="h-6 w-6" />
                          {slot.quantity > 1 && (
                            <span className="absolute bottom-0.5 right-1 rounded bg-[#0e1217]/90 px-1 font-mono text-[10px] text-[#f0dec0]">
                              {slot.quantity}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
