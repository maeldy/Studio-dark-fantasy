import { CraftingStationKind, PlayerSurvivalState } from '../types/gameplay';

export class SurvivalSystem {
  private stamina = 100;
  private readonly maxStamina = 100;
  private warmth = 74;
  private readonly maxWarmth = 100;

  private nearFire = false;
  private inShelter = false;
  private nearbyStations: CraftingStationKind[] = ['hand'];
  private sprintExhausted = false;
  private emitAccum = 0;

  public reset(): void {
    this.stamina = 100;
    this.warmth = 74;
    this.nearFire = false;
    this.inShelter = false;
    this.nearbyStations = ['hand'];
    this.sprintExhausted = false;
    this.emitAccum = 0;
  }

  public canSprint(): boolean {
    if (this.sprintExhausted && this.stamina < 16) return false;
    return this.stamina > 1.0;
  }

  public spendAttackStamina(): void {
    this.stamina = Math.max(0, this.stamina - 8);
    if (this.stamina < 3) {
      this.sprintExhausted = true;
    }
  }

  public applyConsumableRestore(staminaDelta: number, warmthDelta: number): void {
    this.stamina = Math.min(this.maxStamina, this.stamina + staminaDelta);
    this.warmth = Math.min(this.maxWarmth, this.warmth + warmthDelta);
    if (this.stamina >= 16) {
      this.sprintExhausted = false;
    }
  }

  public applyRestRestore(): void {
    this.stamina = this.maxStamina;
    this.warmth = Math.max(this.warmth, 94);
    this.sprintExhausted = false;
  }

  /**
   * Updates stamina & warmth smoothly without blocking core movement or exploration.
   * Returns true when HUD state should be emitted.
   */
  public update(
    dt: number,
    isSprinting: boolean,
    isMoving: boolean,
    isInterior: boolean,
    nearFire: boolean,
    inShelter: boolean,
    warmthArmorBonus: number,
    nearbyStations: CraftingStationKind[]
  ): boolean {
    const stationsChanged =
      nearbyStations.length !== this.nearbyStations.length ||
      nearbyStations.some((s, idx) => s !== this.nearbyStations[idx]);

    const envChanged = nearFire !== this.nearFire || inShelter !== this.inShelter;
    this.nearFire = nearFire;
    this.inShelter = inShelter;
    this.nearbyStations = nearbyStations;

    const prevStamina = this.stamina;
    const prevWarmth = this.warmth;

    // Warmth target based on fire/shelter/armor/atmosphere
    const baseAmbient = isInterior ? 62 : 66;
    const targetWarmth = nearFire || inShelter
      ? 100
      : Math.min(96, baseAmbient + warmthArmorBonus * 45);
    const warmthRate = nearFire || inShelter ? 8.5 : 1.1;
    if (this.warmth < targetWarmth) {
      this.warmth = Math.min(targetWarmth, this.warmth + warmthRate * dt);
    } else if (this.warmth > targetWarmth) {
      this.warmth = Math.max(targetWarmth, this.warmth - 0.85 * dt);
    }

    // Stamina drain/regen
    const comfortBoost = (nearFire || inShelter ? 1.35 : 1.0) * (this.warmth > 50 ? 1.0 : 0.8);
    if (isSprinting && isMoving) {
      this.stamina = Math.max(0, this.stamina - 12.5 * dt);
      if (this.stamina <= 0.5) {
        this.sprintExhausted = true;
      }
    } else {
      const regenRate = (isMoving ? 10.5 : 20.0) * comfortBoost;
      this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);
      if (this.sprintExhausted && this.stamina >= 16) {
        this.sprintExhausted = false;
      }
    }

    this.emitAccum += dt;
    const significantChange =
      Math.abs(Math.round(prevStamina) - Math.round(this.stamina)) >= 1 ||
      Math.abs(Math.round(prevWarmth) - Math.round(this.warmth)) >= 1;

    if (stationsChanged || envChanged || (significantChange && this.emitAccum >= 0.16)) {
      this.emitAccum = 0;
      return true;
    }
    return false;
  }

  public getState(): PlayerSurvivalState {
    return {
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      warmth: Math.round(this.warmth),
      maxWarmth: this.maxWarmth,
      nearFire: this.nearFire,
      inShelter: this.inShelter,
      nearbyStations: [...this.nearbyStations],
    };
  }
}
