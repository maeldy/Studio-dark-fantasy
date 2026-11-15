import * as THREE from 'three';
import {
  CONSUMABLE_EFFECTS_BY_ITEM_ID,
  GEAR_STATS_BY_ITEM_ID,
} from '../data/itemsGameplay';
import {
  addItemsToInventory,
  countInventoryItem,
  ITEM_CATALOG,
  removeInventorySlotItem,
} from '../game/inventory';
import { createDefaultGameplaySave } from '../game/persistence';
import { ProceduralTextures } from '../game/textures';
import { ThornvaleSaveState, WandererRig } from '../game/types';
import { ConsumableEffect, EquipmentLoadout, GearSlot } from '../types/gameplay';
import { buildGearMesh, disposeObjectTree } from '../visuals/LowPolyGearBuilder';

export interface CombatDerivedStats {
  attackDamage: number;
  defenseReduction: number;
  warmthBonus: number;
  ownedTools: {
    axe: boolean;
    pickaxe: boolean;
  };
}

export interface EquipResult {
  success: boolean;
  message: string;
}

export interface ConsumeResult {
  success: boolean;
  message: string;
  effect?: ConsumableEffect;
}

export class EquipmentSystem {
  private rig: WandererRig;
  private textures: ProceduralTextures;

  private attachedHandMesh: THREE.Group | null = null;
  private attachedHandItemId: string | null = null;

  private attachedShieldMesh: THREE.Group | null = null;
  private attachedShieldItemId: string | null = null;

  private attachedArmorMesh: THREE.Group | null = null;
  private attachedArmorItemId: string | null = null;

  private activeEquipment: EquipmentLoadout = {
    weapon: null,
    tool: null,
    armor: null,
    shield: null,
  };

  constructor(rig: WandererRig, textures: ProceduralTextures) {
    this.rig = rig;
    this.textures = textures;
  }

  public syncFromSave(saveState: ThornvaleSaveState): void {
    const eq = saveState.gameplay?.equipment ?? {
      weapon: null,
      tool: null,
      armor: null,
      shield: null,
    };
    this.activeEquipment = {
      weapon: eq.weapon ?? null,
      tool: eq.tool ?? null,
      armor: eq.armor ?? null,
      shield: eq.shield ?? null,
    };

    // Right-hand mesh prefers equipped weapon; falls back to equipped tool
    const desiredHandItemId = this.activeEquipment.weapon ?? this.activeEquipment.tool;
    if (desiredHandItemId !== this.attachedHandItemId) {
      if (this.attachedHandMesh) {
        this.rig.rightForearmPivot.remove(this.attachedHandMesh);
        disposeObjectTree(this.attachedHandMesh);
        this.attachedHandMesh = null;
      }
      this.attachedHandItemId = desiredHandItemId;
      if (desiredHandItemId && GEAR_STATS_BY_ITEM_ID[desiredHandItemId]) {
        const mesh = buildGearMesh(
          GEAR_STATS_BY_ITEM_ID[desiredHandItemId].visualKind,
          this.textures
        );
        mesh.position.set(0, -0.23, 0.04);
        mesh.rotation.x = Math.PI * 0.44;
        this.rig.rightForearmPivot.add(mesh);
        this.attachedHandMesh = mesh;
      }
    }

    // Left-forearm shield mesh
    const desiredShield = this.activeEquipment.shield;
    if (desiredShield !== this.attachedShieldItemId) {
      if (this.attachedShieldMesh) {
        this.rig.leftForearmPivot.remove(this.attachedShieldMesh);
        disposeObjectTree(this.attachedShieldMesh);
        this.attachedShieldMesh = null;
      }
      this.attachedShieldItemId = desiredShield;
      if (desiredShield && GEAR_STATS_BY_ITEM_ID[desiredShield]) {
        const mesh = buildGearMesh(
          GEAR_STATS_BY_ITEM_ID[desiredShield].visualKind,
          this.textures
        );
        mesh.position.set(-0.085, -0.14, 0.04);
        this.rig.leftForearmPivot.add(mesh);
        this.attachedShieldMesh = mesh;
      }
    }

    // Torso armor / cloak mesh
    const desiredArmor = this.activeEquipment.armor;
    if (desiredArmor !== this.attachedArmorItemId) {
      if (this.attachedArmorMesh) {
        this.rig.torso.remove(this.attachedArmorMesh);
        disposeObjectTree(this.attachedArmorMesh);
        this.attachedArmorMesh = null;
      }
      this.attachedArmorItemId = desiredArmor;
      if (desiredArmor && GEAR_STATS_BY_ITEM_ID[desiredArmor]) {
        const mesh = buildGearMesh(
          GEAR_STATS_BY_ITEM_ID[desiredArmor].visualKind,
          this.textures
        );
        this.rig.torso.add(mesh);
        this.attachedArmorMesh = mesh;
      }
    }
  }

  /**
   * Coordinates custom right-hand weapon/tool visibility with the Wanderer's default sword rig.
   */
  public syncRigCombatPose(isAttacking: boolean, isGathering: boolean): void {
    const hasCustomWeapon = !!this.activeEquipment.weapon;
    const hasCustomTool = !!this.activeEquipment.tool;

    if (this.attachedHandMesh) {
      if (isGathering && hasCustomTool) {
        this.attachedHandMesh.visible = true;
      } else if (isAttacking) {
        this.attachedHandMesh.visible = hasCustomWeapon || hasCustomTool;
      } else {
        // Show equipped tool or custom weapon visibly in hand while exploring
        this.attachedHandMesh.visible = true;
      }
    }

    if (isAttacking) {
      this.rig.drawnSwordGroup.visible = !hasCustomWeapon && !hasCustomTool;
      this.rig.sheathedSwordGroup.visible = false;
    } else if (isGathering) {
      this.rig.drawnSwordGroup.visible = false;
      this.rig.sheathedSwordGroup.visible = !hasCustomWeapon;
    } else {
      this.rig.drawnSwordGroup.visible = false;
      this.rig.sheathedSwordGroup.visible = !hasCustomWeapon;
    }
  }

  public getCombatStats(saveState: ThornvaleSaveState): CombatDerivedStats {
    const eq = saveState.gameplay?.equipment;
    let attackBonus = 0;
    let defenseReduction = 0;
    let warmthBonus = 0;

    if (eq?.weapon && GEAR_STATS_BY_ITEM_ID[eq.weapon]) {
      const s = GEAR_STATS_BY_ITEM_ID[eq.weapon];
      attackBonus += s.attackBonus;
      defenseReduction += s.defenseReduction;
    } else if (eq?.tool && GEAR_STATS_BY_ITEM_ID[eq.tool]) {
      const s = GEAR_STATS_BY_ITEM_ID[eq.tool];
      attackBonus += s.attackBonus;
    }

    if (eq?.armor && GEAR_STATS_BY_ITEM_ID[eq.armor]) {
      const s = GEAR_STATS_BY_ITEM_ID[eq.armor];
      defenseReduction += s.defenseReduction;
      warmthBonus += s.warmthBonus;
    }

    if (eq?.shield && GEAR_STATS_BY_ITEM_ID[eq.shield]) {
      const s = GEAR_STATS_BY_ITEM_ID[eq.shield];
      defenseReduction += s.defenseReduction;
    }

    const inv = saveState.inventory;
    const hasAxe =
      eq?.tool === 'flint_hatchet' ||
      eq?.tool === 'iron_axe' ||
      countInventoryItem(inv, 'flint_hatchet') > 0 ||
      countInventoryItem(inv, 'iron_axe') > 0;
    const hasPickaxe =
      eq?.tool === 'stone_pickaxe' ||
      eq?.tool === 'iron_pickaxe' ||
      countInventoryItem(inv, 'stone_pickaxe') > 0 ||
      countInventoryItem(inv, 'iron_pickaxe') > 0;

    return {
      attackDamage: 22 + attackBonus,
      defenseReduction: Math.min(0.68, defenseReduction),
      warmthBonus,
      ownedTools: {
        axe: hasAxe,
        pickaxe: hasPickaxe,
      },
    };
  }

  public equipFromInventorySlot(
    slotIdx: number,
    getActiveSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): EquipResult {
    const current = getActiveSaveState();
    const slot = current.inventory[slotIdx];
    if (!slot) {
      return { success: false, message: 'No item in selected slot.' };
    }
    const stats = GEAR_STATS_BY_ITEM_ID[slot.itemId];
    if (!stats) {
      return { success: false, message: 'This item cannot be equipped.' };
    }

    let equippedOk = false;
    let failReason = 'Pack is full — cannot swap equipped gear.';
    updateSaveState((prev) => {
      const curSlot = prev.inventory[slotIdx];
      if (!curSlot) return prev;
      const curStats = GEAR_STATS_BY_ITEM_ID[curSlot.itemId];
      if (!curStats) return prev;

      const gp = prev.gameplay ?? createDefaultGameplaySave();
      const prevEquippedId = gp.equipment[curStats.slot];
      let nextInv = removeInventorySlotItem(prev.inventory, slotIdx, 1);

      if (prevEquippedId) {
        const putBack = addItemsToInventory(
          nextInv,
          [{ itemId: prevEquippedId, quantity: 1 }],
          true
        );
        if (putBack.addedTotal === 0 || putBack.leftover > 0) {
          failReason = 'Make space in your pack before swapping gear.';
          return prev;
        }
        nextInv = putBack.nextSlots;
      }

      equippedOk = true;
      return {
        ...prev,
        inventory: nextInv,
        gameplay: {
          ...gp,
          equipment: {
            ...gp.equipment,
            [curStats.slot]: curSlot.itemId,
          },
        },
      };
    });

    if (!equippedOk) {
      return { success: false, message: failReason };
    }

    const updated = getActiveSaveState();
    this.syncFromSave(updated);
    const def = ITEM_CATALOG[slot.itemId];
    return {
      success: true,
      message: `Equipped: ${def ? def.name : slot.itemId}`,
    };
  }

  public unequipSlot(
    gearSlot: GearSlot,
    getActiveSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): EquipResult {
    const current = getActiveSaveState();
    const itemId = current.gameplay?.equipment?.[gearSlot];
    if (!itemId) {
      return { success: false, message: 'Nothing equipped in that slot.' };
    }

    let ok = false;
    updateSaveState((prev) => {
      const gp = prev.gameplay ?? createDefaultGameplaySave();
      const eqItem = gp.equipment[gearSlot];
      if (!eqItem) return prev;
      const added = addItemsToInventory(prev.inventory, [{ itemId: eqItem, quantity: 1 }], true);
      if (added.addedTotal === 0 || added.leftover > 0) return prev;
      ok = true;
      return {
        ...prev,
        inventory: added.nextSlots,
        gameplay: {
          ...gp,
          equipment: {
            ...gp.equipment,
            [gearSlot]: null,
          },
        },
      };
    });

    if (!ok) {
      return { success: false, message: 'Pack is full — cannot unequip.' };
    }

    this.syncFromSave(getActiveSaveState());
    const def = ITEM_CATALOG[itemId];
    return {
      success: true,
      message: `Unequipped: ${def ? def.name : itemId}`,
    };
  }

  public useConsumableSlot(
    slotIdx: number,
    getActiveSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void
  ): ConsumeResult {
    const current = getActiveSaveState();
    const slot = current.inventory[slotIdx];
    if (!slot) {
      return { success: false, message: 'Empty slot.' };
    }
    const effect = CONSUMABLE_EFFECTS_BY_ITEM_ID[slot.itemId];
    if (!effect) {
      return { success: false, message: 'Item cannot be consumed.' };
    }

    let consumed = false;
    updateSaveState((prev) => {
      const s = prev.inventory[slotIdx];
      if (!s || s.itemId !== slot.itemId) return prev;
      consumed = true;
      return {
        ...prev,
        inventory: removeInventorySlotItem(prev.inventory, slotIdx, 1),
      };
    });

    if (!consumed) {
      return { success: false, message: 'Could not consume item.' };
    }

    return {
      success: true,
      message: effect.message,
      effect,
    };
  }

  public dispose(): void {
    if (this.attachedHandMesh) {
      this.rig.rightForearmPivot.remove(this.attachedHandMesh);
      disposeObjectTree(this.attachedHandMesh);
      this.attachedHandMesh = null;
    }
    if (this.attachedShieldMesh) {
      this.rig.leftForearmPivot.remove(this.attachedShieldMesh);
      disposeObjectTree(this.attachedShieldMesh);
      this.attachedShieldMesh = null;
    }
    if (this.attachedArmorMesh) {
      this.rig.torso.remove(this.attachedArmorMesh);
      disposeObjectTree(this.attachedArmorMesh);
      this.attachedArmorMesh = null;
    }
  }
}
