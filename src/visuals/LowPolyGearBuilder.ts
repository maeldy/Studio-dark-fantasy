import * as THREE from 'three';
import { applyRetroVertexSnap } from '../game/terrain';
import { ProceduralTextures } from '../game/textures';
import { BuildableStructureId, GearVisualKind } from '../types/gameplay';

export interface BuiltStructureVisual {
  group: THREE.Group;
  ember?: THREE.Mesh;
}

function makeLambert(
  color: string,
  map?: THREE.Texture,
  snap = 200
): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    color,
    map,
    flatShading: true,
  });
  applyRetroVertexSnap(mat, snap);
  return mat;
}

function makeMetal(
  color: string,
  roughness = 0.44,
  metalness = 0.78,
  snap = 200
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true,
  });
  applyRetroVertexSnap(mat, snap);
  return mat;
}

export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material?.dispose();
      }
    }
  });
}

export function buildGearMesh(
  visualKind: GearVisualKind,
  textures?: ProceduralTextures
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Gear_${visualKind}`;

  const matWood = makeLambert('#6e5138', textures?.barkColor, 220);
  const matDarkLeather = makeLambert('#35261c', undefined, 220);
  const matTanHide = makeLambert('#7d5a3b', undefined, 220);
  const matWolfFur = makeLambert('#666d74', undefined, 220);
  const matFlint = makeLambert('#363f47', undefined, 220);
  const matStone = makeLambert('#6e7880', textures?.stoneColor, 220);
  const matIron = makeMetal('#5a646e', 0.42, 0.8, 220);
  const matSteel = makeMetal('#96a3ad', 0.34, 0.85, 220);
  const matBrass = makeMetal('#c29952', 0.36, 0.82, 220);
  const matMoon = new THREE.MeshBasicMaterial({ color: '#9fe2f7' });

  switch (visualKind) {
    case 'flint_hatchet':
    case 'iron_axe': {
      const isIron = visualKind === 'iron_axe';
      const headMat = isIron ? matSteel : matFlint;

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.019, 0.024, isIron ? 0.68 : 0.56, 5),
        matWood
      );
      shaft.position.y = isIron ? 0.28 : 0.22;
      group.add(shaft);

      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.08, 5),
        matDarkLeather
      );
      collar.position.y = isIron ? 0.52 : 0.44;
      group.add(collar);

      const headBlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, isIron ? 0.14 : 0.11, isIron ? 0.19 : 0.15),
        headMat
      );
      headBlock.position.set(0, isIron ? 0.56 : 0.46, 0.075);
      group.add(headBlock);

      const edge = new THREE.Mesh(
        new THREE.ConeGeometry(isIron ? 0.095 : 0.075, 0.09, 4),
        headMat
      );
      edge.rotation.x = Math.PI / 2;
      edge.rotation.z = Math.PI / 4;
      edge.scale.set(0.45, 1, 1);
      edge.position.set(0, isIron ? 0.56 : 0.46, isIron ? 0.19 : 0.16);
      group.add(edge);
      break;
    }

    case 'stone_pickaxe':
    case 'iron_pickaxe': {
      const isIron = visualKind === 'iron_pickaxe';
      const headMat = isIron ? matSteel : matStone;

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.025, 0.68, 5),
        matWood
      );
      shaft.position.y = 0.28;
      group.add(shaft);

      const socket = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.08, 0.07),
        isIron ? matIron : matDarkLeather
      );
      socket.position.y = 0.57;
      group.add(socket);

      for (const dir of [-1, 1] as const) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.042, isIron ? 0.24 : 0.19, 4),
          headMat
        );
        spike.rotation.x = dir > 0 ? Math.PI / 2 + 0.16 : -Math.PI / 2 - 0.16;
        spike.position.set(0, 0.555, dir * (isIron ? 0.14 : 0.12));
        group.add(spike);
      }
      break;
    }

    case 'hunting_spear': {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.017, 0.021, 1.38, 5),
        matWood
      );
      shaft.position.y = 0.52;
      group.add(shaft);

      const lashing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.09, 5),
        matDarkLeather
      );
      lashing.position.y = 1.19;
      group.add(lashing);

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 4), matFlint);
      tip.position.y = 1.33;
      tip.scale.set(0.55, 1, 1.1);
      group.add(tip);
      break;
    }

    case 'thornvale_longsword':
    case 'moonstone_blade': {
      const isMoon = visualKind === 'moonstone_blade';
      const bladeMat = isMoon ? matSteel : matIron;

      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.019, 0.019, 0.18, 5),
        matDarkLeather
      );
      grip.position.y = 0.04;
      group.add(grip);

      const pommel = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.036, 0),
        isMoon ? matMoon : matBrass
      );
      pommel.position.y = -0.06;
      group.add(pommel);

      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.032, 0.042),
        isMoon ? matBrass : matIron
      );
      guard.position.y = 0.14;
      group.add(guard);

      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.048, isMoon ? 0.94 : 0.88, 0.018),
        bladeMat
      );
      blade.position.y = isMoon ? 0.62 : 0.59;
      group.add(blade);

      if (isMoon) {
        const fuller = new THREE.Mesh(
          new THREE.BoxGeometry(0.016, 0.64, 0.022),
          matMoon
        );
        fuller.position.y = 0.54;
        group.add(fuller);
      }

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 4), bladeMat);
      tip.position.y = isMoon ? 1.15 : 1.09;
      group.add(tip);
      break;
    }

    case 'wooden_buckler': {
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.035, 8), matWood);
      boss.rotation.z = Math.PI / 2;
      group.add(boss);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 4, 8), matDarkLeather);
      rim.rotation.y = Math.PI / 2;
      group.add(rim);

      const center = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), matIron);
      center.position.x = -0.02;
      center.scale.set(0.6, 1, 1);
      group.add(center);
      break;
    }

    case 'iron_kite_shield': {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.28);
      shape.lineTo(0.2, 0.22);
      shape.lineTo(0.16, -0.08);
      shape.lineTo(0, -0.34);
      shape.lineTo(-0.16, -0.08);
      shape.lineTo(-0.2, 0.22);
      shape.closePath();

      const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false });
      bodyGeo.center();
      const body = new THREE.Mesh(bodyGeo, matIron);
      body.rotation.y = -Math.PI / 2;
      group.add(body);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.52, 0.05), matBrass);
      trim.position.x = -0.01;
      group.add(trim);

      const crossBar = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.05, 0.28), matBrass);
      crossBar.position.set(-0.01, 0.08, 0);
      group.add(crossBar);
      break;
    }

    case 'hide_jerkin': {
      const vest = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.215, 0.36, 7),
        matTanHide
      );
      vest.position.set(0, 0.28, 0.012);
      group.add(vest);

      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.32), matDarkLeather);
      strapL.position.set(-0.12, 0.32, 0);
      group.add(strapL);

      const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.32), matDarkLeather);
      strapR.position.set(0.12, 0.32, 0);
      group.add(strapR);
      break;
    }

    case 'wolfskin_cloak': {
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.35, 0.24, 7),
        matWolfFur
      );
      collar.position.set(0, 0.47, -0.02);
      group.add(collar);

      const peltTail = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.72, 0.06),
        matWolfFur
      );
      peltTail.position.set(0, 0.14, -0.21);
      peltTail.rotation.x = 0.14;
      group.add(peltTail);

      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), matBrass);
      clasp.position.set(0, 0.44, 0.22);
      group.add(clasp);
      break;
    }

    case 'iron_brigandine': {
      const chestPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.245, 0.215, 0.38, 6),
        matSteel
      );
      chestPlate.position.set(0, 0.29, 0.014);
      group.add(chestPlate);

      const gorget = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 0.1, 6),
        matBrass
      );
      gorget.position.set(0, 0.49, 0.01);
      group.add(gorget);

      for (const side of [-1, 1] as const) {
        const paul = new THREE.Mesh(new THREE.ConeGeometry(0.165, 0.23, 5), matSteel);
        paul.position.set(side * 0.28, 0.5, 0);
        paul.rotation.z = -side * 0.85;
        group.add(paul);
      }
      break;
    }

    case 'warden_greatsword':
    case 'sunfire_blade': {
      const isSunfire = visualKind === 'sunfire_blade';
      const matAmberCore = new THREE.MeshBasicMaterial({
        color: isSunfire ? '#ffaa45' : '#d68a38',
      });
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.24, 5),
        matDarkLeather
      );
      grip.position.y = 0.02;
      group.add(grip);

      const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), matAmberCore);
      pommel.position.y = -0.11;
      group.add(pommel);

      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.04, 0.055),
        matBrass
      );
      guard.position.y = 0.16;
      group.add(guard);

      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.068, 1.08, 0.022),
        isSunfire ? matSteel : matIron
      );
      blade.position.y = 0.72;
      group.add(blade);

      const fuller = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.76, 0.026),
        matAmberCore
      );
      fuller.position.y = 0.65;
      group.add(fuller);

      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.038, 0.16, 4),
        isSunfire ? matSteel : matIron
      );
      tip.position.y = 1.32;
      group.add(tip);
      break;
    }

    case 'ashwood_tower_shield': {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.76, 0.44), matWood);
      group.add(board);

      const rimTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.46), matIron);
      rimTop.position.y = 0.36;
      group.add(rimTop);

      const rimBot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.46), matIron);
      rimBot.position.y = -0.36;
      group.add(rimBot);

      const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), matBrass);
      crest.position.set(-0.025, 0.05, 0);
      crest.scale.set(0.45, 1.3, 1.0);
      group.add(crest);
      break;
    }

    case 'lantern_bearer_mantle': {
      const matMidnight = makeLambert('#202a36', undefined, 220);
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.37, 0.25, 7),
        matMidnight
      );
      collar.position.set(0, 0.48, -0.02);
      group.add(collar);

      const capeBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.78, 0.06),
        matMidnight
      );
      capeBody.position.set(0, 0.12, -0.22);
      capeBody.rotation.x = 0.15;
      group.add(capeBody);

      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), matBrass);
      clasp.position.set(0, 0.45, 0.22);
      group.add(clasp);
      break;
    }
  }

  return group;
}

export function buildStructureMesh(
  structureId: BuildableStructureId,
  textures?: ProceduralTextures,
  isGhost = false
): BuiltStructureVisual {
  const group = new THREE.Group();
  group.name = `Structure_${structureId}`;
  const snap = isGhost ? 0 : 200;

  const matWood = makeLambert('#8b7157', textures?.woodPlankColor, snap);
  const matDarkWood = makeLambert('#5a4635', textures?.barkColor, snap);
  const matStone = makeLambert('#7c858d', textures?.stoneColor, snap);
  const matIron = makeMetal('#4a535c', 0.48, 0.78, snap);
  const matBrass = makeMetal('#c29952', 0.35, 0.82, snap);
  const matBark = makeLambert('#5c4532', textures?.barkColor, snap);
  const matHide = makeLambert('#6e4e35', undefined, snap);
  const matEmber = new THREE.MeshBasicMaterial({ color: '#ff8a34' });

  let ember: THREE.Mesh | undefined;

  switch (structureId) {
    case 'campfire': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), matStone);
        stone.scale.set(1.1, 0.65, 0.9);
        stone.position.set(Math.cos(a) * 0.54, 0.09, Math.sin(a) * 0.54);
        stone.rotation.y = a + i * 0.5;
        stone.castShadow = !isGhost;
        stone.receiveShadow = !isGhost;
        group.add(stone);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI + 0.35;
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.76, 5), matDarkWood);
        log.position.set(Math.cos(a) * 0.05, 0.14, Math.sin(a) * 0.05);
        log.rotation.z = Math.PI * 0.38;
        log.rotation.y = a;
        group.add(log);
      }
      ember = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.44, 5), matEmber);
      ember.position.y = 0.28;
      group.add(ember);
      break;
    }

    case 'workbench': {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.13, 0.78), matWood);
      top.position.y = 0.84;
      top.castShadow = !isGhost;
      top.receiveShadow = !isGhost;
      group.add(top);

      for (const lx of [-0.62, 0.62]) {
        for (const lz of [-0.28, 0.28]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.82, 0.11), matDarkWood);
          leg.position.set(lx, 0.41, lz);
          leg.castShadow = !isGhost;
          group.add(leg);
        }
      }

      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.07, 0.54), matDarkWood);
      shelf.position.y = 0.28;
      group.add(shelf);

      const vise = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.2), matIron);
      vise.position.set(-0.46, 0.98, 0.18);
      group.add(vise);

      const anvilBlock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.18), matIron);
      anvilBlock.position.set(0.36, 0.97, -0.05);
      group.add(anvilBlock);

      const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 5), matWood);
      hammerHandle.rotation.z = Math.PI / 2;
      hammerHandle.rotation.y = 0.4;
      hammerHandle.position.set(0.05, 0.93, 0.15);
      group.add(hammerHandle);
      break;
    }

    case 'storage_chest': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.42, 0.58), matDarkWood);
      base.position.y = 0.21;
      base.castShadow = !isGhost;
      base.receiveShadow = !isGhost;
      group.add(base);

      const lid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.96, 6, 1, false, 0, Math.PI),
        matWood
      );
      lid.rotation.z = Math.PI / 2;
      lid.rotation.y = Math.PI;
      lid.position.y = 0.42;
      lid.castShadow = !isGhost;
      group.add(lid);

      for (const bx of [-0.36, 0.36]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.46, 0.61), matIron);
        band.position.set(bx, 0.24, 0);
        group.add(band);
      }

      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.06), matBrass);
      lock.position.set(0, 0.38, 0.3);
      group.add(lock);
      break;
    }

    case 'watch_lantern': {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.22, 6), matStone);
      plinth.position.y = 0.11;
      group.add(plinth);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 2.35, 5), matDarkWood);
      post.position.y = 1.24;
      post.castShadow = !isGhost;
      group.add(post);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.09), matDarkWood);
      arm.position.set(0.26, 2.28, 0);
      group.add(arm);

      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.06), matDarkWood);
      brace.position.set(0.15, 2.1, 0);
      brace.rotation.z = Math.PI / 4;
      group.add(brace);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.13, 5), matIron);
      cap.position.set(0.5, 2.09, 0);
      group.add(cap);

      ember = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.11), matEmber);
      ember.position.set(0.5, 1.95, 0);
      group.add(ember);
      break;
    }

    case 'timber_palisade': {
      const railLow = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.14), matDarkWood);
      railLow.position.set(0, 0.55, 0.08);
      group.add(railLow);

      const railHigh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.14), matDarkWood);
      railHigh.position.set(0, 1.35, 0.08);
      group.add(railHigh);

      for (let i = -2; i <= 2; i++) {
        const h = 1.85 + (Math.abs(i) % 2) * 0.2;
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, h, 5), matWood);
        stake.position.set(i * 0.34, h * 0.5, 0);
        stake.castShadow = !isGhost;
        group.add(stake);

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.34, 5), matWood);
        tip.position.set(i * 0.34, h + 0.17, 0);
        group.add(tip);
      }
      break;
    }

    case 'field_shelter': {
      // Back & front A-frame poles
      for (const side of [-1, 1] as const) {
        const postB = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 1.75, 5), matDarkWood);
        postB.position.set(side * 1.05, 0.85, -0.78);
        postB.castShadow = !isGhost;
        group.add(postB);

        const postF = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 1.15, 5), matDarkWood);
        postF.position.set(side * 1.05, 0.56, 0.72);
        postF.castShadow = !isGhost;
        group.add(postF);
      }

      const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.35, 5), matDarkWood);
      ridge.rotation.z = Math.PI / 2;
      ridge.position.set(0, 1.68, -0.78);
      group.add(ridge);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.12, 1.95), matBark);
      roof.position.set(0, 1.34, -0.04);
      roof.rotation.x = 0.42;
      roof.castShadow = !isGhost;
      roof.receiveShadow = !isGhost;
      group.add(roof);

      const bedroll = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.85), matHide);
      bedroll.position.set(0, 0.08, -0.1);
      bedroll.receiveShadow = !isGhost;
      group.add(bedroll);
      break;
    }
  }

  if (isGhost) {
    group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = false;
        const ghostMat = new THREE.MeshBasicMaterial({
          color: '#7ed497',
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        });
        if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
        else m.material?.dispose();
        m.material = ghostMat;
      }
    });
  }

  return { group, ember };
}

export function setGhostVisualState(group: THREE.Group, valid: boolean): void {
  const targetColor = valid ? '#73d690' : '#d65d58';
  group.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && m.material && !Array.isArray(m.material)) {
      const mat = m.material as THREE.MeshBasicMaterial;
      if (mat.color) {
        mat.color.set(targetColor);
      }
      mat.opacity = valid ? 0.52 : 0.44;
    }
  });
}
