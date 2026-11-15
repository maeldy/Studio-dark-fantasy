import * as THREE from 'three';
import { applyRetroVertexSnap } from '../game/terrain';
import { ProceduralTextures } from '../game/textures';
import {
  DynamicEventKind,
  LorePropDef,
  SecretMechanismDef,
  TreasureContainerDef,
} from '../types/exploration';

export interface ExplorationMaterialPalette {
  wood: THREE.MeshLambertMaterial;
  darkWood: THREE.MeshLambertMaterial;
  stone: THREE.MeshLambertMaterial;
  mossStone: THREE.MeshLambertMaterial;
  dungeonBrick: THREE.MeshLambertMaterial;
  carvedStone: THREE.MeshLambertMaterial;
  iron: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  bone: THREE.MeshLambertMaterial;
  runeGlow: THREE.MeshBasicMaterial;
  warmGlow: THREE.MeshBasicMaterial;
  spiritGlow: THREE.MeshBasicMaterial;
}

export function createExplorationMaterials(
  textures: ProceduralTextures
): ExplorationMaterialPalette {
  const makeLamb = (color: string, map?: THREE.Texture) => {
    const m = new THREE.MeshLambertMaterial({
      color,
      map,
      flatShading: true,
    });
    applyRetroVertexSnap(m, 200);
    return m;
  };
  const makeMetal = (color: string, roughness = 0.45, metalness = 0.78) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading: true,
    });
    applyRetroVertexSnap(m, 200);
    return m;
  };

  return {
    wood: makeLamb('#7c6047', textures.woodPlankColor),
    darkWood: makeLamb('#4f3c2d', textures.weatheredTimberColor),
    stone: makeLamb('#727b83', textures.stoneColor),
    mossStone: makeLamb('#5e6b60', textures.stoneColor),
    dungeonBrick: makeLamb('#595553', textures.dungeonBrickColor),
    carvedStone: makeLamb('#7d858c', textures.carvedRuneStoneColor),
    iron: makeMetal('#454e57', 0.48, 0.78),
    brass: makeMetal('#c4984f', 0.36, 0.82),
    bone: makeLamb('#d4ccb8'),
    runeGlow: new THREE.MeshBasicMaterial({ color: '#78d8e6' }),
    warmGlow: new THREE.MeshBasicMaterial({ color: '#ff9c42' }),
    spiritGlow: new THREE.MeshBasicMaterial({ color: '#9cf2e1' }),
  };
}

export function disposeExplorationPalette(pal: ExplorationMaterialPalette): void {
  Object.values(pal).forEach((m) => m.dispose());
}

export interface ChestVisualHandle {
  group: THREE.Group;
  lidPivot: THREE.Group;
  innerGlowMesh?: THREE.Mesh;
  runeSealMesh?: THREE.Mesh;
  openProgress: number;
}

export function buildTreasureVisual(
  def: TreasureContainerDef,
  pal: ExplorationMaterialPalette
): ChestVisualHandle {
  const group = new THREE.Group();
  group.name = `Treasure_${def.id}`;
  group.position.set(def.x, def.y, def.z);
  group.rotation.y = def.rotY;

  const lidPivot = new THREE.Group();
  let innerGlowMesh: THREE.Mesh | undefined;
  let runeSealMesh: THREE.Mesh | undefined;

  if (def.kind === 'ancient_chest' || def.kind === 'hidden_cache') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.48, 0.68), pal.darkWood);
    base.position.y = 0.24;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    for (const bx of [-0.38, 0.38]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.72), pal.iron);
      band.position.set(bx, 0.26, 0);
      group.add(band);
    }

    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.16, 0.08),
      def.requiredKeyItemId ? pal.brass : pal.iron
    );
    clasp.position.set(0, 0.43, 0.36);
    group.add(clasp);

    lidPivot.position.set(0, 0.48, -0.34);
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.06, 6, 1, false, 0, Math.PI),
      pal.wood
    );
    lid.rotation.z = Math.PI * 0.5;
    lid.rotation.y = Math.PI;
    lid.position.set(0, 0, 0.34);
    lid.castShadow = true;
    lidPivot.add(lid);

    for (const bx of [-0.38, 0.38]) {
      const lidBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.355, 0.355, 0.08, 6, 1, false, 0, Math.PI),
        pal.iron
      );
      lidBand.rotation.z = Math.PI * 0.5;
      lidBand.rotation.y = Math.PI;
      lidBand.position.set(bx, 0, 0.34);
      lidPivot.add(lidBand);
    }
    group.add(lidPivot);

    innerGlowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.08, 0.48),
      new THREE.MeshBasicMaterial({ color: '#e6ae4e' })
    );
    innerGlowMesh.position.set(0, 0.46, 0);
    innerGlowMesh.visible = false;
    group.add(innerGlowMesh);

    if (def.requiresNight) {
      runeSealMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12, 0),
        pal.runeGlow.clone()
      );
      runeSealMesh.position.set(0, 0.65, 0.36);
      group.add(runeSealMesh);
    }
  } else if (def.kind === 'forgotten_crate') {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.72, 0.88), pal.wood);
    crate.position.y = 0.36;
    crate.castShadow = true;
    crate.receiveShadow = true;
    group.add(crate);

    lidPivot.position.set(0, 0.72, -0.44);
    const topPlank = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.09, 0.92), pal.darkWood);
    topPlank.position.set(0, 0.04, 0.44);
    lidPivot.add(topPlank);
    group.add(lidPivot);
  } else if (def.kind === 'hollow_stump') {
    const stump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.74, 0.88, 7),
      pal.darkWood
    );
    stump.position.y = 0.44;
    stump.castShadow = true;
    group.add(stump);

    lidPivot.position.set(0, 0.88, -0.35);
    const mossCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.52, 0.14, 7),
      pal.mossStone
    );
    mossCap.position.set(0, 0.05, 0.35);
    lidPivot.add(mossCap);
    group.add(lidPivot);
  } else {
    // abandoned_satchel
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.42, 0.46), pal.darkWood);
    bag.position.y = 0.21;
    bag.castShadow = true;
    group.add(bag);

    lidPivot.position.set(0, 0.42, -0.2);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.48), pal.wood);
    flap.position.set(0, 0, 0.2);
    lidPivot.add(flap);
    group.add(lidPivot);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), pal.brass);
    buckle.position.set(0, 0.28, 0.24);
    group.add(buckle);
  }

  return { group, lidPivot, innerGlowMesh, runeSealMesh, openProgress: 0 };
}

export interface MechanismVisualHandle {
  group: THREE.Group;
  doorMesh?: THREE.Mesh;
  leverArmPivot?: THREE.Group;
  runeOrb?: THREE.Mesh;
  openProgress: number;
}

export function buildMechanismVisual(
  def: SecretMechanismDef,
  pal: ExplorationMaterialPalette
): MechanismVisualHandle {
  const group = new THREE.Group();
  group.name = `Mechanism_${def.id}`;

  const matMap = {
    stone: pal.carvedStone,
    wood: pal.wood,
    moss: pal.mossStone,
    dungeon: pal.dungeonBrick,
    iron: pal.iron,
  };
  const doorMat = matMap[def.visualTone ?? 'stone'];

  let doorMesh: THREE.Mesh | undefined;
  if (def.doorPos && def.doorSize) {
    if (def.kind === 'movable_boulder') {
      doorMesh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(def.doorSize.w * 0.52, 0),
        doorMat
      );
      doorMesh.scale.set(1.05, def.doorSize.h / def.doorSize.w, def.doorSize.d / def.doorSize.w);
    } else {
      doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(def.doorSize.w, def.doorSize.h, def.doorSize.d),
        doorMat
      );
    }
    doorMesh.position.set(
      def.doorPos.x,
      def.doorPos.y + def.doorSize.h * 0.5,
      def.doorPos.z
    );
    doorMesh.rotation.y = def.doorRotY ?? 0;
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    group.add(doorMesh);
  }

  // Trigger pedestal / lever / rune socket
  const leverArmPivot = new THREE.Group();
  let runeOrb: THREE.Mesh | undefined;

  const trigGroup = new THREE.Group();
  trigGroup.position.set(def.triggerPos.x, def.triggerPos.y, def.triggerPos.z);

  if (def.kind === 'iron_lever' || def.kind === 'rotating_masonry') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.42), pal.stone);
    base.position.y = 0.12;
    trigGroup.add(base);

    leverArmPivot.position.set(0, 0.24, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.72, 5), pal.iron);
    arm.position.y = 0.34;
    leverArmPivot.add(arm);

    const knob = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), pal.brass);
    knob.position.y = 0.72;
    leverArmPivot.add(knob);
    leverArmPivot.rotation.x = -0.35;
    trigGroup.add(leverArmPivot);
  } else if (def.kind === 'sliding_wall' || def.kind === 'multi_rune_seal') {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.82, 6), pal.carvedStone);
    plinth.position.y = 0.41;
    trigGroup.add(plinth);

    runeOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), pal.runeGlow.clone());
    runeOrb.position.y = 1.02;
    trigGroup.add(runeOrb);
  } else if (def.kind === 'pivoting_bookcase') {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 0.16), pal.brass);
    latch.position.y = 0.9;
    trigGroup.add(latch);
  }

  group.add(trigGroup);

  return { group, doorMesh, leverArmPivot, runeOrb, openProgress: 0 };
}

export function buildLorePropVisual(
  def: LorePropDef,
  pal: ExplorationMaterialPalette
): { group: THREE.Group; runeMesh?: THREE.Mesh } {
  const group = new THREE.Group();
  group.name = `Lore_${def.id}`;
  group.position.set(def.x, def.y, def.z);
  group.rotation.y = def.rotY;

  let runeMesh: THREE.Mesh | undefined;

  if (def.kind === 'carved_monolith') {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.05, 0.44), pal.carvedStone);
    slab.position.y = 1.02;
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);

    runeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.65, 0.48),
      pal.runeGlow.clone()
    );
    runeMesh.position.y = 1.25;
    group.add(runeMesh);
  } else if (def.kind === 'wall_inscription' || def.kind === 'fresco_panel') {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.35, 0.14), pal.carvedStone);
    panel.position.y = 1.35;
    group.add(panel);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.2), pal.brass);
    trim.position.y = 2.05;
    group.add(trim);
  } else if (def.kind === 'battle_remnant') {
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.07, 7), pal.darkWood);
    shield.rotation.x = 1.25;
    shield.position.set(-0.18, 0.18, 0.05);
    group.add(shield);

    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.85, 5), pal.wood);
    spear.rotation.z = 1.1;
    spear.rotation.y = 0.5;
    spear.position.set(0.15, 0.25, -0.05);
    group.add(spear);

    const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), pal.bone);
    skull.position.set(0.32, 0.14, 0.22);
    group.add(skull);
  } else if (def.kind === 'grave_marker') {
    const mound = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 1.6), pal.mossStone);
    mound.position.y = 0.1;
    group.add(mound);

    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.45, 0.14), pal.iron);
    post.position.set(0, 0.72, -0.52);
    post.rotation.z = 0.08;
    group.add(post);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.12), pal.iron);
    bar.position.set(-0.04, 1.12, -0.52);
    bar.rotation.z = 0.08;
    group.add(bar);
  } else if (def.kind === 'camp_remnant') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), pal.stone);
      stone.position.set(Math.cos(a) * 0.48, 0.08, Math.sin(a) * 0.48);
      group.add(stone);
    }
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.25, 5), pal.darkWood);
    log.rotation.z = Math.PI * 0.5;
    log.position.set(0, 0.15, 0.92);
    group.add(log);
  } else {
    // ancient_scroll on bronze lectern
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 0.95, 6), pal.carvedStone);
    stand.position.y = 0.47;
    group.add(stand);

    const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.44), pal.wood);
    board.position.y = 0.98;
    board.rotation.x = 0.35;
    group.add(board);

    const scroll = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.32), pal.bone);
    scroll.position.set(0, 1.02, 0);
    scroll.rotation.x = 0.35;
    group.add(scroll);
  }

  return { group, runeMesh };
}

export interface DynamicEventVisualHandle {
  group: THREE.Group;
  animatedParts: THREE.Object3D[];
}

export function buildDynamicEventVisual(
  kind: DynamicEventKind,
  x: number,
  y: number,
  z: number,
  pal: ExplorationMaterialPalette
): DynamicEventVisualHandle {
  const group = new THREE.Group();
  group.name = `DynEvent_${kind}`;
  group.position.set(x, y, z);
  const animatedParts: THREE.Object3D[] = [];

  if (kind === 'traveler_camp') {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), pal.stone);
      st.position.set(Math.cos(a) * 0.52, 0.09, Math.sin(a) * 0.52);
      group.add(st);
    }
    const ember = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.44, 5), pal.warmGlow);
    ember.position.y = 0.28;
    group.add(ember);
    animatedParts.push(ember);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.38), pal.wood);
    pack.position.set(1.15, 0.18, 0.25);
    pack.rotation.y = -0.4;
    group.add(pack);
  } else if (kind === 'wandering_peddler') {
    // Low-poly cart + cloaked figure + hanging brass lantern
    const cart = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 0.9), pal.wood);
    cart.position.set(-0.6, 0.46, 0);
    cart.castShadow = true;
    group.add(cart);

    for (const wx of [-1.05, -0.15]) {
      for (const wz of [-0.5, 0.5]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 7), pal.darkWood);
        wheel.rotation.x = Math.PI * 0.5;
        wheel.position.set(wx, 0.28, wz);
        group.add(wheel);
      }
    }

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.35, 6), pal.darkWood);
    body.position.set(0.65, 0.68, 0.2);
    group.add(body);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.45, 6), pal.mossStone);
    hood.position.set(0.65, 1.52, 0.2);
    group.add(hood);

    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), pal.warmGlow);
    lantern.position.set(0.95, 1.15, 0.45);
    group.add(lantern);
    animatedParts.push(lantern);
  } else if (kind === 'rare_spirit_stag') {
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.56, 1.28),
      pal.spiritGlow
    );
    torso.position.y = 1.05;
    group.add(torso);

    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.58, 0.24),
      pal.spiritGlow
    );
    neck.position.set(0, 1.48, 0.55);
    neck.rotation.x = 0.25;
    group.add(neck);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.42),
      pal.spiritGlow
    );
    head.position.set(0, 1.76, 0.72);
    group.add(head);

    for (const side of [-1, 1]) {
      const antler = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.65, 4),
        pal.spiritGlow
      );
      antler.position.set(side * 0.18, 2.08, 0.68);
      antler.rotation.z = -side * 0.38;
      group.add(antler);
    }

    for (const lx of [-0.18, 0.18]) {
      for (const lz of [-0.46, 0.46]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.82, 0.1), pal.spiritGlow);
        leg.position.set(lx, 0.42, lz);
        group.add(leg);
      }
    }
    animatedParts.push(torso);
  } else if (kind === 'nocturnal_wisp_choir') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        pal.runeGlow.clone()
      );
      orb.position.set(Math.cos(a) * 1.1, 1.15 + i * 0.22, Math.sin(a) * 1.1);
      group.add(orb);
      animatedParts.push(orb);
    }
  } else if (kind === 'recent_skirmish') {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.52), pal.darkWood);
    crate.position.set(0, 0.22, 0);
    crate.rotation.y = 0.3;
    group.add(crate);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.9, 5), pal.wood);
    pole.position.set(-0.55, 0.9, -0.2);
    pole.rotation.z = 0.22;
    group.add(pole);
  } else {
    // beast_pack_trail
    const hide = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.65), pal.darkWood);
    hide.position.y = 0.09;
    group.add(hide);
    const bones = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 5), pal.bone);
    bones.rotation.z = Math.PI * 0.45;
    bones.position.set(0.3, 0.14, 0.15);
    group.add(bones);
  }

  return { group, animatedParts };
}
