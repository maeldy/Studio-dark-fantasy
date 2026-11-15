import { GEAR_STATS_BY_ITEM_ID } from '../data/itemsGameplay';
import { GAMEPLAY_QUESTS } from '../data/quests';
import { addItemsToInventory } from '../game/inventory';
import { createDefaultGameplaySave } from '../game/persistence';
import { ThornvaleSaveState } from '../game/types';
import { QuestDefinition, QuestProgressRecord } from '../types/gameplay';

export class QuestSystem {
  public getDefinitions(): QuestDefinition[] {
    return GAMEPLAY_QUESTS;
  }

  private applyProgress(
    prev: ThornvaleSaveState,
    matcher: (q: QuestDefinition) => boolean,
    amountOrExact: number,
    mode: 'add' | 'set'
  ): ThornvaleSaveState {
    const gp = prev.gameplay ?? createDefaultGameplaySave();
    let changed = false;
    const nextQuestStates: Record<string, QuestProgressRecord> = { ...gp.questStates };

    for (let i = 0; i < GAMEPLAY_QUESTS.length; i++) {
      const q = GAMEPLAY_QUESTS[i];
      if (!matcher(q)) continue;
      const cur = nextQuestStates[q.id] ?? {
        progress: 0,
        completed: false,
        claimed: false,
      };
      if (cur.completed) continue;

      const rawNext = mode === 'set' ? amountOrExact : cur.progress + amountOrExact;
      const clamped = Math.min(q.targetCount, Math.max(cur.progress, rawNext));
      if (clamped !== cur.progress || clamped >= q.targetCount) {
        changed = true;
        nextQuestStates[q.id] = {
          progress: clamped,
          completed: clamped >= q.targetCount,
          claimed: cur.claimed,
        };
      }
    }

    if (!changed) return prev;
    return {
      ...prev,
      gameplay: {
        ...gp,
        questStates: nextQuestStates,
      },
    };
  }

  public recordGather(
    count: number,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): void {
    if (count <= 0) return;
    updateSaveState((prev) => {
      const gp = prev.gameplay ?? createDefaultGameplaySave();
      const withStat: ThornvaleSaveState = {
        ...prev,
        gameplay: {
          ...gp,
          stats: {
            ...gp.stats,
            gatheredCount: (gp.stats.gatheredCount ?? 0) + count,
          },
        },
      };
      return this.applyProgress(
        withStat,
        (q) => q.kind === 'gather' && (q.targetId === 'any' || !q.targetId),
        count,
        'add'
      );
    });
  }

  public recordCraft(
    outputItemId: string,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): void {
    const isTool = !!GEAR_STATS_BY_ITEM_ID[outputItemId]?.toolKind;
    updateSaveState((prev) =>
      this.applyProgress(
        prev,
        (q) =>
          q.kind === 'craft' &&
          (q.targetId === outputItemId ||
            q.targetId === 'any' ||
            (q.targetId === 'any_tool' && isTool)),
        1,
        'add'
      )
    );
  }

  public recordBuild(
    structureId: string,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): void {
    updateSaveState((prev) =>
      this.applyProgress(
        prev,
        (q) => q.kind === 'build' && (q.targetId === structureId || q.targetId === 'any'),
        1,
        'add'
      )
    );
  }

  public recordDefeat(
    killCount: number,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): void {
    if (killCount <= 0) return;
    updateSaveState((prev) => {
      const gp = prev.gameplay ?? createDefaultGameplaySave();
      const withStat: ThornvaleSaveState = {
        ...prev,
        gameplay: {
          ...gp,
          stats: {
            ...gp.stats,
            defeatedCount: (gp.stats.defeatedCount ?? 0) + killCount,
          },
        },
      };
      return this.applyProgress(
        withStat,
        (q) => q.kind === 'defeat',
        killCount,
        'add'
      );
    });
  }

  public syncDiscoveries(
    discoveredCount: number,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): void {
    updateSaveState((prev) =>
      this.applyProgress(
        prev,
        (q) => q.kind === 'discover',
        discoveredCount,
        'set'
      )
    );
  }

  public claimReward(
    questId: string,
    getActiveSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): { success: boolean; message: string } {
    const def = GAMEPLAY_QUESTS.find((q) => q.id === questId);
    if (!def) return { success: false, message: 'Quest not found.' };

    const cur = getActiveSaveState();
    const prog = cur.gameplay?.questStates?.[questId];
    if (!prog?.completed) {
      return { success: false, message: 'Objective not yet completed.' };
    }
    if (prog.claimed) {
      return { success: false, message: 'Reward already claimed.' };
    }

    let claimedOk = false;
    updateSaveState((prev) => {
      const gp = prev.gameplay ?? createDefaultGameplaySave();
      const p = gp.questStates[questId];
      if (!p?.completed || p.claimed) return prev;
      const added = addItemsToInventory(prev.inventory, def.rewards, true);
      if (added.addedTotal === 0 || added.leftover > 0) return prev;
      claimedOk = true;
      return {
        ...prev,
        inventory: added.nextSlots,
        gameplay: {
          ...gp,
          questStates: {
            ...gp.questStates,
            [questId]: { ...p, claimed: true },
          },
        },
      };
    });

    if (!claimedOk) {
      return { success: false, message: 'Make space in your pack to claim reward.' };
    }

    return { success: true, message: `Claimed reward: ${def.title}` };
  }
}
