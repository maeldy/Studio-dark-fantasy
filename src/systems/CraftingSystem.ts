import { CRAFTING_RECIPES } from '../data/recipes';
import {
  addItemsToInventory,
  consumeInventoryIngredients,
  hasInventoryIngredients,
  ITEM_CATALOG,
} from '../game/inventory';
import { ThornvaleSaveState } from '../game/types';
import { CraftingRecipe, CraftingStationKind } from '../types/gameplay';

export interface CraftResult {
  success: boolean;
  message: string;
  recipe?: CraftingRecipe;
}

export class CraftingSystem {
  public isRecipeUnlocked(
    recipe: CraftingRecipe,
    saveState: ThornvaleSaveState
  ): boolean {
    if (!recipe.requiredUnlockId) return true;
    return !!saveState.exploration?.unlockedRecipes?.[recipe.requiredUnlockId];
  }

  public getRecipes(): CraftingRecipe[] {
    return CRAFTING_RECIPES;
  }

  public canCraftRecipe(
    recipe: CraftingRecipe,
    saveState: ThornvaleSaveState,
    availableStations: CraftingStationKind[]
  ): { canCraft: boolean; reason: string } {
    if (!this.isRecipeUnlocked(recipe, saveState)) {
      return {
        canCraft: false,
        reason: 'Locked schematic — discover through exploration',
      };
    }

    if (!availableStations.includes(recipe.station)) {
      const stationName =
        recipe.station === 'campfire' ? 'Stone Campfire' : 'Timber Workbench';
      return {
        canCraft: false,
        reason: `Requires nearby ${stationName}`,
      };
    }

    if (!hasInventoryIngredients(saveState.inventory, recipe.ingredients)) {
      return {
        canCraft: false,
        reason: 'Missing required materials',
      };
    }

    const afterConsume = consumeInventoryIngredients(
      saveState.inventory,
      recipe.ingredients
    );
    if (!afterConsume) {
      return {
        canCraft: false,
        reason: 'Missing required materials',
      };
    }

    const addCheck = addItemsToInventory(
      afterConsume,
      [{ itemId: recipe.outputItemId, quantity: recipe.outputQuantity }],
      true
    );
    if (addCheck.addedTotal === 0 || addCheck.leftover > 0) {
      return {
        canCraft: false,
        reason: 'Traveler Pack is full',
      };
    }

    return { canCraft: true, reason: 'Ready to craft' };
  }

  public craftRecipe(
    recipeId: string,
    getActiveSaveState: () => ThornvaleSaveState,
    updateSaveState: (updater: (prev: ThornvaleSaveState) => ThornvaleSaveState) => void,
    availableStations: CraftingStationKind[]
  ): CraftResult {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) {
      return { success: false, message: 'Unknown crafting recipe.' };
    }

    const current = getActiveSaveState();
    const check = this.canCraftRecipe(recipe, current, availableStations);
    if (!check.canCraft) {
      return { success: false, message: check.reason };
    }

    let craftedOk = false;
    updateSaveState((prev) => {
      const consumed = consumeInventoryIngredients(prev.inventory, recipe.ingredients);
      if (!consumed) return prev;
      const added = addItemsToInventory(
        consumed,
        [{ itemId: recipe.outputItemId, quantity: recipe.outputQuantity }],
        true
      );
      if (added.addedTotal === 0 || added.leftover > 0) return prev;
      craftedOk = true;
      const prevGameplay = prev.gameplay;
      return {
        ...prev,
        inventory: added.nextSlots,
        gameplay: prevGameplay
          ? {
              ...prevGameplay,
              stats: {
                ...prevGameplay.stats,
                craftedCount: (prevGameplay.stats.craftedCount ?? 0) + 1,
              },
            }
          : prevGameplay,
      };
    });

    if (!craftedOk) {
      return { success: false, message: 'Could not craft item — check materials or pack space.' };
    }

    const outDef = ITEM_CATALOG[recipe.outputItemId];
    const outName = outDef ? outDef.name : recipe.outputItemId;
    const qtyText = recipe.outputQuantity > 1 ? ` x${recipe.outputQuantity}` : '';
    return {
      success: true,
      recipe,
      message: `Crafted: ${outName}${qtyText}`,
    };
  }
}
