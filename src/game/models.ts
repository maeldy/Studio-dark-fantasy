import * as THREE from 'three';
import { applyRetroVertexSnap } from './terrain';
import { ProceduralTextures } from './textures';
import { WandererRig } from './types';

function createTatteredCloakGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.26, 0.0);
  shape.lineTo(0.26, 0.0);
  shape.lineTo(0.36, -0.78);
  shape.lineTo(0.24, -0.96);
  shape.lineTo(0.11, -0.82);
  shape.lineTo(-0.02, -1.0);
  shape.lineTo(-0.15, -0.84);
  shape.lineTo(-0.29, -0.95);
  shape.lineTo(-0.35, -0.74);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: false,
    steps: 1,
  });
  geo.center();
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const topY = geo.boundingBox.max.y;
    geo.translate(0, -topY + 0.02, -0.02);
  }
  return geo;
}

export function createWandererCharacter(textures: ProceduralTextures): WandererRig {
  const root = new THREE.Group();
  root.name = 'Wanderer';

  // Soft radial contact shadow grounded at feet
  const shadowGeo = new THREE.PlaneGeometry(1.15, 1.15);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const matCloak = new THREE.MeshLambertMaterial({
    color: '#262c33',
    flatShading: true,
  });
  const matTunic = new THREE.MeshLambertMaterial({
    color: '#4c4035',
    flatShading: true,
  });
  const matLeather = new THREE.MeshLambertMaterial({
    color: '#35281f',
    flatShading: true,
  });
  const matDarkIron = new THREE.MeshStandardMaterial({
    color: '#4f5761',
    roughness: 0.42,
    metalness: 0.78,
    flatShading: true,
  });
  const matBrass = new THREE.MeshStandardMaterial({
    color: '#b08e52',
    roughness: 0.34,
    metalness: 0.82,
    flatShading: true,
  });
  const matShadowFace = new THREE.MeshLambertMaterial({
    color: '#171a1e',
    flatShading: true,
  });
  const matEmber = new THREE.MeshBasicMaterial({
    color: '#ff9d42',
  });

  for (const m of [matCloak, matTunic, matLeather, matDarkIron, matBrass, matShadowFace]) {
    applyRetroVertexSnap(m, 220);
  }

  // 1. Torso group (hips at y = 0.72)
  const torso = new THREE.Group();
  torso.position.y = 0.72;
  bodyPivot.add(torso);

  // Fluted brigandine/tunic via LatheGeometry
  const tunicProfile = [
    new THREE.Vector2(0.0, -0.15),
    new THREE.Vector2(0.24, -0.15),
    new THREE.Vector2(0.18, 0.05),
    new THREE.Vector2(0.24, 0.35),
    new THREE.Vector2(0.18, 0.50),
    new THREE.Vector2(0.0, 0.52),
  ];
  const tunicMesh = new THREE.Mesh(new THREE.LatheGeometry(tunicProfile, 7), matTunic);
  tunicMesh.castShadow = true;
  torso.add(tunicMesh);

  // Subtle dark iron breastplate overlay
  const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.32, 6), matDarkIron);
  cuirass.position.set(0, 0.28, 0.01);
  cuirass.castShadow = true;
  torso.add(cuirass);

  // 2. Leather belt & brass buckle
  const beltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.09, 7), matLeather);
  beltMesh.position.y = 0.07;
  torso.add(beltMesh);

  const buckleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.04), matBrass);
  buckleMesh.position.set(0, 0.07, 0.205);
  torso.add(buckleMesh);

  // 3. Shoulder mantle & spiked dark iron pauldrons (inspired by dark knight reference)
  const mantleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.31, 0.2, 7), matCloak);
  mantleMesh.position.y = 0.45;
  torso.add(mantleMesh);

  for (const side of [-1, 1] as const) {
    const pauldron = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 5), matDarkIron);
    pauldron.position.set(side * 0.27, 0.49, 0);
    pauldron.rotation.z = -side * 0.85;
    pauldron.castShadow = true;
    torso.add(pauldron);

    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), matDarkIron);
    spike.position.set(side * 0.32, 0.58, 0);
    spike.rotation.z = -side * 0.32;
    torso.add(spike);
  }

  // 4. Tattered ragged cloak
  const cloak = new THREE.Mesh(createTatteredCloakGeometry(), matCloak);
  cloak.position.set(0, 0.47, -0.17);
  cloak.rotation.x = 0.14;
  cloak.castShadow = true;
  torso.add(cloak);

  // 5. Pointed Gothic Visored Helm / Hooded Cowl
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.55, 0.01);
  torso.add(headPivot);

  const faceMask = new THREE.Mesh(new THREE.OctahedronGeometry(0.125, 0), matShadowFace);
  faceMask.position.y = 0.13;
  headPivot.add(faceMask);

  // Angular iron faceplate with T-visor ridge
  const visorPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.10, 0.18, 5), matDarkIron);
  visorPlate.position.set(0, 0.14, 0.04);
  visorPlate.castShadow = true;
  headPivot.add(visorPlate);

  const hoodProfile = [
    new THREE.Vector2(0.17, 0.02),
    new THREE.Vector2(0.18, 0.15),
    new THREE.Vector2(0.14, 0.28),
    new THREE.Vector2(0.05, 0.38),
    new THREE.Vector2(0.0, 0.44),
  ];
  const hoodMesh = new THREE.Mesh(new THREE.LatheGeometry(hoodProfile, 6), matCloak);
  hoodMesh.rotation.x = -0.16;
  hoodMesh.position.set(0, 0.02, -0.02);
  hoodMesh.castShadow = true;
  headPivot.add(hoodMesh);

  // Subtle helm spire crest
  const helmCrest = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 4), matDarkIron);
  helmCrest.position.set(0, 0.37, 0.0);
  headPivot.add(helmCrest);

  // 6 & 7. Articulated Arms + Iron Gauntlets
  function buildArm(side: -1 | 1): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.25, 0.43, 0);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.24, 5), matTunic);
    upper.position.y = -0.11;
    pivot.add(upper);

    const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.22, 5), matDarkIron);
    bracer.position.y = -0.32;
    pivot.add(bracer);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.075), matLeather);
    hand.position.y = -0.45;
    pivot.add(hand);

    return pivot;
  }

  const leftArmPivot = buildArm(-1);
  const rightArmPivot = buildArm(1);
  torso.add(leftArmPivot, rightArmPivot);

  // 8. Sheathed Longsword at right-rear hip
  const swordGroup = new THREE.Group();
  swordGroup.position.set(0.22, 0.06, -0.04);
  swordGroup.rotation.set(0.68, 0.12, -0.22);

  const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.86, 0.028), matLeather);
  scabbard.position.y = -0.32;
  swordGroup.add(scabbard);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.028, 0.035), matDarkIron);
  guard.position.y = 0.12;
  swordGroup.add(guard);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 5), matLeather);
  grip.position.y = 0.22;
  swordGroup.add(grip);

  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), matBrass);
  pommel.position.y = 0.32;
  swordGroup.add(pommel);

  torso.add(swordGroup);

  // 9. Belt Iron Lantern on left hip
  const lanternPivot = new THREE.Group();
  lanternPivot.position.set(-0.23, 0.06, 0.11);
  torso.add(lanternPivot);

  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.06, 5), matDarkIron);
  lanternCap.position.y = -0.05;
  lanternPivot.add(lanternCap);

  const lanternCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), matEmber);
  lanternCore.position.y = -0.10;
  lanternPivot.add(lanternCore);

  const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.025, 5), matDarkIron);
  lanternBase.position.y = -0.145;
  lanternPivot.add(lanternBase);

  const lanternLight = new THREE.PointLight('#ff923c', 1.4, 9.0, 1.8);
  lanternLight.position.set(0, -0.1, 0.05);
  lanternPivot.add(lanternLight);

  // 10 & 11. Articulated Legs + Greaves & Boots
  function buildLeg(side: -1 | 1): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11, 0.66, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.06, 0.34, 5), matTunic);
    thigh.position.y = -0.16;
    pivot.add(thigh);

    const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.054, 0.31, 5), matDarkIron);
    greave.position.y = -0.47;
    pivot.add(greave);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.08, 0.17), matLeather);
    foot.position.set(0, -0.62, 0.035);
    pivot.add(foot);

    return pivot;
  }

  const leftLegPivot = buildLeg(-1);
  const rightLegPivot = buildLeg(1);
  bodyPivot.add(leftLegPivot, rightLegPivot);

  return {
    root,
    bodyPivot,
    torso,
    headPivot,
    cape: cloak,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    lanternPivot,
    lanternLight,
    contactShadow,
  };
}

/**
 * Tall, slender, eerie misty forest pine inspired by reference Screenshot_49f8541d.
 * High bare trunk with sparse lower dead stubs and high irregular bough crowns.
 */
export function createHeroPineTree(textures: ProceduralTextures, scale = 1): THREE.Group {
  const group = new THREE.Group();

  const barkMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#ab998b',
  });
  const needleDark = new THREE.MeshLambertMaterial({
    map: textures.foliageColor,
    color: '#788c7a',
    flatShading: true,
  });
  const needleMid = new THREE.MeshLambertMaterial({
    map: textures.foliageColor,
    color: '#8ea38e',
    flatShading: true,
  });
  applyRetroVertexSnap(barkMat, 200);
  applyRetroVertexSnap(needleDark, 200);
  applyRetroVertexSnap(needleMid, 200);

  // Tall slender trunk (~10m)
  const trunkProfile = [
    new THREE.Vector2(0.38, 0.0),
    new THREE.Vector2(0.24, 1.2),
    new THREE.Vector2(0.18, 4.4),
    new THREE.Vector2(0.11, 7.8),
    new THREE.Vector2(0.04, 10.2),
  ];
  const trunk = new THREE.Mesh(new THREE.LatheGeometry(trunkProfile, 6), barkMat);
  trunk.castShadow = true;
  group.add(trunk);

  // Sparse gnarled lower dead branch stubs
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + 0.3;
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, 0.95, 4), barkMat);
    stub.position.set(Math.cos(a) * 0.38, 2.2 + i * 0.85, Math.sin(a) * 0.38);
    stub.rotation.z = -Math.cos(a) * 1.15;
    stub.rotation.x = Math.sin(a) * 1.15;
    group.add(stub);
  }

  // High sparse bough tiers
  const tiers = [
    { y: 5.5, r: 1.75, h: 2.0, mat: needleDark, tilt: 0.04 },
    { y: 7.0, r: 1.45, h: 1.9, mat: needleMid, tilt: -0.05 },
    { y: 8.4, r: 1.1, h: 1.8, mat: needleDark, tilt: 0.03 },
    { y: 9.7, r: 0.72, h: 1.7, mat: needleMid, tilt: -0.02 },
  ];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 6), t.mat);
    cone.position.y = t.y;
    cone.rotation.y = i * 0.65;
    cone.rotation.z = t.tilt;
    cone.castShadow = i < 2;
    group.add(cone);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Gnarled leafless dead bog tree (Swamps of Sadness inspiration).
 */
export function createDeadBogTree(textures: ProceduralTextures, scale = 1): THREE.Group {
  const group = new THREE.Group();
  const barkMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#8f8479',
    flatShading: true,
  });
  applyRetroVertexSnap(barkMat, 200);

  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.25, 1.1, -0.15),
    new THREE.Vector3(-0.15, 2.3, 0.2),
    new THREE.Vector3(0.35, 3.5, 0.05),
  ]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 6, 0.16, 5, false), barkMat);
  trunk.castShadow = true;
  group.add(trunk);

  const limbs = [
    [new THREE.Vector3(0.05, 1.9, 0.1), new THREE.Vector3(-0.9, 2.6, 0.55), new THREE.Vector3(-1.5, 2.4, 0.85)],
    [new THREE.Vector3(0.15, 2.7, 0.1), new THREE.Vector3(1.1, 3.3, -0.45), new THREE.Vector3(1.7, 3.1, -0.7)],
    [new THREE.Vector3(0.25, 3.2, 0.05), new THREE.Vector3(0.1, 4.1, 0.65), new THREE.Vector3(-0.2, 4.5, 1.05)],
  ];
  for (const pts of limbs) {
    const c = new THREE.CatmullRomCurve3(pts);
    const branch = new THREE.Mesh(new THREE.TubeGeometry(c, 4, 0.06, 4, false), barkMat);
    group.add(branch);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Abandoned rustic two-wheeled wooden cart (adapted from cart reference to dark fantasy).
 */
export function createAbandonedCart(textures: ProceduralTextures): THREE.Group {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshLambertMaterial({
    map: textures.woodPlankColor,
    color: '#b8a898',
    flatShading: true,
  });
  const darkWoodMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#9c8977',
    flatShading: true,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: '#525a62',
    roughness: 0.5,
    metalness: 0.72,
    flatShading: true,
  });
  applyRetroVertexSnap(woodMat, 200);
  applyRetroVertexSnap(darkWoodMat, 200);
  applyRetroVertexSnap(ironMat, 200);

  // Tilted wagon body (resting on front shafts in the mud)
  const body = new THREE.Group();
  body.position.y = 0.62;
  body.rotation.x = 0.18;
  group.add(body);

  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 2.1), woodMat);
  bed.castShadow = true;
  bed.receiveShadow = true;
  body.add(bed);

  // Side walls & rear tailgate
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 2.05), woodMat);
  sideL.position.set(-0.64, 0.28, 0);
  body.add(sideL);

  const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 2.05), woodMat);
  sideR.position.set(0.64, 0.28, 0);
  body.add(sideR);

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.42, 0.08), woodMat);
  frontWall.position.set(0, 0.25, 1.0);
  body.add(frontWall);

  // Front hitch shafts
  for (const sx of [-0.46, 0.46]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.45, 5), darkWoodMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(sx, 0.0, 1.68);
    body.add(shaft);
  }

  // Axle
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.75, 5), darkWoodMat);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, -0.05, -0.15);
  body.add(axle);

  // Two spoked wheels (left slightly sunken/tilted)
  function buildWheel(): THREE.Group {
    const w = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.055, 5, 10), darkWoodMat);
    rim.rotation.y = Math.PI / 2;
    rim.castShadow = true;
    w.add(rim);

    const ironRim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.02, 4, 10), ironMat);
    ironRim.rotation.y = Math.PI / 2;
    w.add(ironRim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 6), ironMat);
    hub.rotation.z = Math.PI / 2;
    w.add(hub);

    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.04, 0.04), darkWoodMat);
      spoke.rotation.x = (s / 4) * Math.PI;
      w.add(spoke);
    }
    return w;
  }

  const leftWheel = buildWheel();
  leftWheel.position.set(-0.84, -0.05, -0.15);
  leftWheel.rotation.z = 0.08;
  body.add(leftWheel);

  const rightWheel = buildWheel();
  rightWheel.position.set(0.84, -0.05, -0.15);
  body.add(rightWheel);

  // Forgotten weathered crate inside cart
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.44, 0.56), darkWoodMat);
  crate.position.set(0.15, 0.27, -0.35);
  crate.rotation.y = 0.24;
  body.add(crate);

  return group;
}

/**
 * Weathered crooked tombstone or gothic stone cross (Graveyardcore inspiration).
 */
export function createGraveMarker(
  textures: ProceduralTextures,
  kind: 'slab' | 'cross' = 'slab'
): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#a0a9af',
    flatShading: true,
  });
  applyRetroVertexSnap(stoneMat, 200);

  if (kind === 'cross') {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 0.16), stoneMat);
    post.position.y = 0.66;
    post.castShadow = true;
    group.add(post);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.15), stoneMat);
    bar.position.y = 0.96;
    bar.castShadow = true;
    group.add(bar);
  } else {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.05, 0.18), stoneMat);
    slab.position.y = 0.5;
    slab.castShadow = true;
    group.add(slab);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.29, 0.18, 5), stoneMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.y = 1.02;
    group.add(cap);
  }

  return group;
}

/**
 * Hooded Angel / Sentinel Stone Memorial Statue (Graveyardcore inspiration).
 */
export function createSentinelStatue(textures: ProceduralTextures): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#a8b0b5',
    flatShading: true,
  });
  applyRetroVertexSnap(stoneMat, 200);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.4), stoneMat);
  plinth.position.y = 0.27;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.54, 1.85, 6), stoneMat);
  robe.position.y = 1.45;
  robe.castShadow = true;
  group.add(robe);

  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.58, 6), stoneMat);
  hood.position.set(0, 2.55, 0.04);
  hood.rotation.x = 0.18;
  group.add(hood);

  // Carved stone wings folded back
  for (const side of [-1, 1] as const) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.45, 0.56), stoneMat);
    wing.position.set(side * 0.34, 2.1, -0.22);
    wing.rotation.set(-0.18, side * 0.35, side * 0.22);
    wing.castShadow = true;
    group.add(wing);
  }

  return group;
}

/**
 * Composite Waystone Shrine (stepped plinth + moss slab + beveled obelisk + carved rune band)
 */
export function createWaystoneShrine(textures: ProceduralTextures): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#aab3b8',
    flatShading: true,
  });
  const runeMat = new THREE.MeshBasicMaterial({
    color: '#b86e2e',
  });
  applyRetroVertexSnap(stoneMat, 200);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 0.32, 6), stoneMat);
  plinth.position.y = 0.16;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const step = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.12, 0.28, 6), stoneMat);
  step.position.y = 0.44;
  step.receiveShadow = true;
  group.add(step);

  const monolithShape = new THREE.Shape();
  monolithShape.moveTo(-0.36, 0);
  monolithShape.lineTo(0.36, 0);
  monolithShape.lineTo(0.26, 2.05);
  monolithShape.lineTo(0.0, 2.45);
  monolithShape.lineTo(-0.26, 2.05);
  monolithShape.closePath();

  const monolithGeo = new THREE.ExtrudeGeometry(monolithShape, {
    depth: 0.36,
    bevelEnabled: false,
  });
  monolithGeo.translate(0, 0, -0.18);
  const monolith = new THREE.Mesh(monolithGeo, stoneMat);
  monolith.position.y = 0.56;
  monolith.castShadow = true;
  group.add(monolith);

  const runeBand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.42), runeMat);
  runeBand.position.set(0, 1.58, 0);
  group.add(runeBand);

  return group;
}

/**
 * Composite Iron Brazier (PointLight is managed externally via engine light-pooling for high FPS).
 */
export function createIronBrazier(): { group: THREE.Group; ember: THREE.Mesh } {
  const group = new THREE.Group();

  const ironMat = new THREE.MeshStandardMaterial({
    color: '#2e3338',
    roughness: 0.48,
    metalness: 0.78,
    flatShading: true,
  });
  const emberMat = new THREE.MeshBasicMaterial({
    color: '#ff7e29',
  });
  applyRetroVertexSnap(ironMat, 200);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.92, 5), ironMat);
    leg.position.set(Math.cos(a) * 0.22, 0.42, Math.sin(a) * 0.22);
    leg.rotation.z = Math.cos(a) * 0.2;
    leg.rotation.x = -Math.sin(a) * 0.2;
    leg.castShadow = true;
    group.add(leg);
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 4, 7), ironMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.56;
  group.add(ring);

  const bowlProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.20, 0.03),
    new THREE.Vector2(0.38, 0.16),
    new THREE.Vector2(0.42, 0.26),
    new THREE.Vector2(0.34, 0.26),
    new THREE.Vector2(0.0, 0.07),
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 7), ironMat);
  bowl.position.y = 0.72;
  bowl.castShadow = true;
  group.add(bowl);

  const ember = new THREE.Mesh(new THREE.DodecahedronGeometry(0.21, 0), emberMat);
  ember.scale.set(1.15, 0.58, 1.15);
  ember.position.y = 0.93;
  group.add(ember);

  return { group, ember };
}

/**
 * Composite Ancient Ruined Gatehouse Archway
 */
export function createRuinArchway(textures: ProceduralTextures): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#9ea6ac',
    flatShading: true,
  });
  const mossStoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#7c8f81',
    flatShading: true,
  });
  applyRetroVertexSnap(stoneMat, 200);
  applyRetroVertexSnap(mossStoneMat, 200);

  for (const side of [-1, 1]) {
    const x = side * 2.35;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.65, 1.55), mossStoneMat);
    base.position.set(x, 0.32, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.15, 3.6, 1.15), stoneMat);
    shaft.position.set(x, 2.4, 0);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    group.add(shaft);

    const capital = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.45, 1.45), stoneMat);
    capital.position.set(x, 4.35, 0);
    group.add(capital);
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.85, 1.35), stoneMat);
  lintel.position.set(0, 4.95, 0);
  lintel.rotation.z = -0.022;
  lintel.castShadow = true;
  group.add(lintel);

  const brokenLeft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 1.05), mossStoneMat);
  brokenLeft.position.set(-1.95, 5.7, 0);
  brokenLeft.rotation.z = 0.04;
  group.add(brokenLeft);

  const brokenRight = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 1.0), stoneMat);
  brokenRight.position.set(2.15, 5.55, 0);
  brokenRight.rotation.z = -0.07;
  group.add(brokenRight);

  const fallen = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mossStoneMat);
  fallen.position.set(3.45, 0.35, 0.7);
  fallen.rotation.set(0.3, 0.7, 0.2);
  group.add(fallen);

  return group;
}

/**
 * Timber Lantern Post for guiding the player down the winding forest path.
 */
export function createLanternPost(textures: ProceduralTextures): {
  group: THREE.Group;
  ember: THREE.Mesh;
} {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#9c8876',
    flatShading: true,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: '#525b63',
    roughness: 0.45,
    metalness: 0.78,
    flatShading: true,
  });
  const emberMat = new THREE.MeshBasicMaterial({
    color: '#ffa046',
  });
  applyRetroVertexSnap(woodMat, 200);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 2.75, 5), woodMat);
  post.position.y = 1.37;
  post.castShadow = true;
  group.add(post);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.1, 0.1), woodMat);
  arm.position.set(0.32, 2.55, 0);
  group.add(arm);

  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.07, 0.07), woodMat);
  brace.position.set(0.18, 2.34, 0);
  brace.rotation.z = Math.PI / 4;
  group.add(brace);

  const lanternRoof = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.14, 5), ironMat);
  lanternRoof.position.set(0.62, 2.34, 0);
  group.add(lanternRoof);

  const ember = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.11), emberMat);
  ember.position.set(0.62, 2.2, 0);
  group.add(ember);

  const lanternBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.05, 5), ironMat);
  lanternBottom.position.set(0.62, 2.1, 0);
  group.add(lanternBottom);

  return { group, ember };
}

/**
 * Standing Monolith Stone (3 parts: base cairn, slab)
 */
export function createStandingStone(textures: ProceduralTextures, height = 2.8): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#9fa7ad',
    flatShading: true,
  });
  applyRetroVertexSnap(stoneMat, 200);

  const shape = new THREE.Shape();
  shape.moveTo(-0.42, 0);
  shape.lineTo(0.42, 0);
  shape.lineTo(0.3, height * 0.85);
  shape.lineTo(-0.04, height);
  shape.lineTo(-0.34, height * 0.8);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.28,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -0.14);

  const slab = new THREE.Mesh(geo, stoneMat);
  slab.castShadow = true;
  group.add(slab);

  const baseStone1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), stoneMat);
  baseStone1.position.set(-0.32, 0.14, 0.16);
  baseStone1.scale.set(1.2, 0.65, 1.0);
  group.add(baseStone1);

  return group;
}

/**
 * Distant Gothic Citadel on rocky crags + Watchtower + Aqueduct + Layered Peaks & Ridge Pines
 */
export function createDistantSilhouettes(): THREE.Group {
  const group = new THREE.Group();
  const mountainMat = new THREE.MeshLambertMaterial({
    color: '#2c3640',
    flatShading: true,
  });
  const ruinMat = new THREE.MeshLambertMaterial({
    color: '#36414b',
    flatShading: true,
  });
  const ridgePineMat = new THREE.MeshLambertMaterial({
    color: '#26312d',
    flatShading: true,
  });

  // 1. Ring of distant jagged mountain peaks beyond the 92m playable region
  const peakCount = 20;
  for (let i = 0; i < peakCount; i++) {
    const angle = (i / peakCount) * Math.PI * 2 + 0.12;
    const dist = 118 + (i % 3) * 14;
    const h = 34 + ((i * 7) % 5) * 8.5;
    const r = 20 + ((i * 3) % 4) * 5.5;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), mountainMat);
    peak.position.set(Math.cos(angle) * dist, h * 0.38 - 1, Math.sin(angle) * dist);
    peak.rotation.y = i * 0.9;
    group.add(peak);
  }

  // 2. Layered distant forest ridge silhouettes perched on outer hills
  const ridgeConeGeo = new THREE.ConeGeometry(2.6, 9.5, 5);
  const ridgePineInst = new THREE.InstancedMesh(ridgeConeGeo, ridgePineMat, 44);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + (i % 3) * 0.04;
    const dist = 96 + (i % 4) * 5.5;
    const s = 0.9 + (i % 5) * 0.22;
    dummy.position.set(Math.cos(a) * dist, 6.5 + (i % 3) * 2.2, Math.sin(a) * dist);
    dummy.rotation.set(0, i * 0.7, 0);
    dummy.scale.set(s, s * 1.15, s);
    dummy.updateMatrix();
    ridgePineInst.setMatrixAt(i, dummy.matrix);
  }
  ridgePineInst.instanceMatrix.needsUpdate = true;
  ridgePineInst.computeBoundingSphere();
  group.add(ridgePineInst);

  // 3. Distant Gothic Citadel perched on a misty crag beyond the NW Bastion Ruins
  const citadel = new THREE.Group();
  citadel.position.set(-54, 12, -118);
  citadel.rotation.y = 0.52;

  const crag = new THREE.Mesh(new THREE.ConeGeometry(13, 24, 6), mountainMat);
  crag.position.y = 4;
  citadel.add(crag);

  const keepBase = new THREE.Mesh(new THREE.BoxGeometry(11, 12, 8.5), ruinMat);
  keepBase.position.y = 16;
  citadel.add(keepBase);

  const centralSpire = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, 16, 6), ruinMat);
  centralSpire.position.set(0, 27, 0);
  citadel.add(centralSpire);

  const spireRoof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 10, 6), ruinMat);
  spireRoof.position.set(0, 39.5, 0);
  citadel.add(spireRoof);

  const turretOffsets = [
    [-4.8, -3.5, 18],
    [4.8, -3.5, 17],
    [-4.8, 3.5, 16],
    [4.8, 3.5, 18.5],
  ];
  for (const [tx, tz, th] of turretOffsets) {
    const tBody = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, th, 5), ruinMat);
    tBody.position.set(tx, 10 + th * 0.5, tz);
    citadel.add(tBody);
    const tRoof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 4.8, 5), ruinMat);
    tRoof.position.set(tx, 10 + th + 2.3, tz);
    citadel.add(tRoof);
  }

  const causeway = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 18), ruinMat);
  causeway.position.set(0, 13.5, 12.5);
  causeway.rotation.x = 0.16;
  citadel.add(causeway);

  const beaconMat = new THREE.MeshBasicMaterial({ color: '#e68838' });
  const beacon1 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.3, 0.35), beaconMat);
  beacon1.position.set(0, 29.5, 2.3);
  citadel.add(beacon1);

  const beacon2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.35), beaconMat);
  beacon2.position.set(-2.0, 19.0, 4.3);
  citadel.add(beacon2);

  group.add(citadel);

  // 4. Distant Ruined Aqueduct silhouette on the eastern ridge beyond Silvermire Pond
  const aqueduct = new THREE.Group();
  aqueduct.position.set(106, 10, -28);
  aqueduct.rotation.y = -0.95;
  for (let p = 0; p < 4; p++) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 14, 1.8), ruinMat);
    pillar.position.set((p - 1.5) * 5.2, 7.0, 0);
    aqueduct.add(pillar);
  }
  const span = new THREE.Mesh(new THREE.BoxGeometry(19, 1.8, 2.0), ruinMat);
  span.position.set(-1.4, 14.0, 0);
  aqueduct.add(span);
  group.add(aqueduct);

  return group;
}

/**
 * Abandoned Medieval Timber & Stone Woodsman's Cabin (Hollowbark Homestead)
 */
export function createAbandonedCabin(textures: ProceduralTextures): {
  group: THREE.Group;
  ember: THREE.Mesh;
} {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#9ea6ac',
    flatShading: true,
  });
  const wallWoodMat = new THREE.MeshLambertMaterial({
    map: textures.woodPlankColor,
    color: '#ad9d8d',
    flatShading: true,
  });
  const beamMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#8f7c6a',
    flatShading: true,
  });
  const roofMat = new THREE.MeshLambertMaterial({
    map: textures.woodPlankColor,
    color: '#6b655c',
    flatShading: true,
  });
  const darkDoorMat = new THREE.MeshLambertMaterial({
    color: '#201b17',
    flatShading: true,
  });
  const emberMat = new THREE.MeshBasicMaterial({
    color: '#ff8f3a',
  });

  for (const m of [stoneMat, wallWoodMat, beamMat, roofMat, darkDoorMat]) {
    applyRetroVertexSnap(m, 200);
  }

  // Stone plinth foundation
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.55, 4.2), stoneMat);
  foundation.position.y = 0.25;
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation);

  // Main timber-framed cabin body
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.55, 3.8), wallWoodMat);
  body.position.y = 1.78;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Exposed dark timber corner posts & cross-beams
  for (const cx of [-2.38, 2.38]) {
    for (const cz of [-1.88, 1.88]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.65, 0.22), beamMat);
      post.position.set(cx, 1.8, cz);
      group.add(post);
    }
  }
  const tieBeamF = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.18, 0.2), beamMat);
  tieBeamF.position.set(0, 3.0, 1.88);
  group.add(tieBeamF);

  // Steep pitched medieval gable roof (two pitched slabs + triangular gable walls)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-2.45, 0);
  gableShape.lineTo(2.45, 0);
  gableShape.lineTo(0, 1.85);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 3.82, bevelEnabled: false });
  gableGeo.translate(0, 0, -1.91);
  const gable = new THREE.Mesh(gableGeo, wallWoodMat);
  gable.position.y = 3.04;
  gable.castShadow = true;
  group.add(gable);

  const roofSlopeL = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.18, 4.65), roofMat);
  roofSlopeL.position.set(-1.35, 3.92, 0.08);
  roofSlopeL.rotation.z = 0.65;
  roofSlopeL.castShadow = true;
  group.add(roofSlopeL);

  const roofSlopeR = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.18, 4.65), roofMat);
  roofSlopeR.position.set(1.35, 3.92, 0.08);
  roofSlopeR.rotation.z = -0.65;
  roofSlopeR.castShadow = true;
  group.add(roofSlopeR);

  const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 4.8), beamMat);
  ridgeBeam.position.set(0, 4.92, 0.08);
  group.add(ridgeBeam);

  // Crooked stone chimney on the right wall
  const chimneyBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 3.3, 1.05), stoneMat);
  chimneyBase.position.set(2.55, 1.65, -0.35);
  chimneyBase.castShadow = true;
  group.add(chimneyBase);

  const chimneyStack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 2.35, 0.72), stoneMat);
  chimneyStack.position.set(2.45, 4.35, -0.35);
  chimneyStack.rotation.z = -0.04;
  chimneyStack.castShadow = true;
  group.add(chimneyStack);

  // Front wooden porch step, crooked plank door, and overhanging awning
  const porchStep = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 1.0), beamMat);
  porchStep.position.set(-0.4, 0.12, 2.45);
  porchStep.receiveShadow = true;
  group.add(porchStep);

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.98, 0.14), beamMat);
  doorFrame.position.set(-0.4, 1.48, 1.93);
  group.add(doorFrame);

  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.82, 0.08), darkDoorMat);
  doorPanel.position.set(-0.4, 1.44, 1.95);
  group.add(doorPanel);

  // Porch awning + crooked posts
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.12, 1.25), roofMat);
  awning.position.set(-0.4, 2.68, 2.45);
  awning.rotation.x = 0.24;
  awning.castShadow = true;
  group.add(awning);

  for (const px of [-1.25, 0.45]) {
    const pPost = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 2.35, 5), beamMat);
    pPost.position.set(px, 1.38, 2.88);
    pPost.castShadow = true;
    group.add(pPost);
  }

  // Boarded side window + faint warm lantern ember peeking through slats
  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.14), beamMat);
  windowFrame.position.set(1.15, 1.92, 1.92);
  group.add(windowFrame);

  const ember = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), emberMat);
  ember.position.set(1.15, 1.92, 1.94);
  group.add(ember);

  const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.18), beamMat);
  shutter.position.set(1.15, 1.94, 1.96);
  shutter.rotation.z = -0.18;
  group.add(shutter);

  // Stacked firewood logs & weathered barrel beside the porch
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3 - row; col++) {
      const fLog = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.85, 5), beamMat);
      fLog.rotation.x = Math.PI / 2;
      fLog.position.set(-2.05 + col * 0.24 + row * 0.12, 0.62 + row * 0.2, 2.28);
      group.add(fLog);
    }
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.78, 7), wallWoodMat);
  barrel.position.set(1.85, 0.92, 2.32);
  barrel.castShadow = true;
  group.add(barrel);

  return { group, ember };
}

/**
 * Old Arched Wooden Footbridge spanning Blackwater Brook
 */
export function createOldWoodenBridge(
  textures: ProceduralTextures,
  halfLength: number,
  halfWidth: number,
  bankSouthY: number,
  bankNorthY: number
): THREE.Group {
  const group = new THREE.Group();

  const plankMat = new THREE.MeshLambertMaterial({
    map: textures.woodPlankColor,
    color: '#b09e8d',
    flatShading: true,
  });
  const logMat = new THREE.MeshLambertMaterial({
    map: textures.barkColor,
    color: '#8e7b69',
    flatShading: true,
  });
  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#9aa2a8',
    flatShading: true,
  });
  applyRetroVertexSnap(plankMat, 200);
  applyRetroVertexSnap(logMat, 200);
  applyRetroVertexSnap(stoneMat, 200);

  const plankCount = 18;
  const totalLen = halfLength * 2;
  const plankDepth = totalLen / plankCount - 0.04;

  const deckYAtT = (t: number) =>
    THREE.MathUtils.lerp(bankSouthY, bankNorthY, t) + Math.sin(t * Math.PI) * 0.48;

  // Timber deck planks & curved support stringers matching walkableHeightAt()
  for (let i = 0; i < plankCount; i++) {
    const t = (i + 0.5) / plankCount;
    const zPos = THREE.MathUtils.lerp(-halfLength, halfLength, t);
    const yPos = deckYAtT(t);
    const nextY = deckYAtT(Math.min(1, t + 0.04));
    const prevY = deckYAtT(Math.max(0, t - 0.04));
    const pitch = Math.atan2(nextY - prevY, totalLen * 0.08);

    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(halfWidth * 2 + ((i % 3) - 1) * 0.08, 0.14, plankDepth),
      plankMat
    );
    plank.position.set(((i % 2) - 0.5) * 0.03, yPos - 0.06, zPos);
    plank.rotation.x = -pitch;
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);

    // Side stringer segments underneath deck edges
    if (i < plankCount - 1) {
      const tNext = (i + 1.5) / plankCount;
      const zNext = THREE.MathUtils.lerp(-halfLength, halfLength, tNext);
      const yNext = deckYAtT(tNext);
      const segLen = Math.hypot(zNext - zPos, yNext - yPos) + 0.06;
      const segAngle = Math.atan2(yNext - yPos, zNext - zPos);
      for (const side of [-1, 1] as const) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, segLen, 5), logMat);
        beam.rotation.x = Math.PI / 2 - segAngle;
        beam.position.set(side * (halfWidth - 0.22), (yPos + yNext) * 0.5 - 0.18, (zPos + zNext) * 0.5);
        group.add(beam);
      }
    }
  }

  // Stone bank abutments at south & north ends
  for (const endSign of [-1, 1] as const) {
    const t = endSign < 0 ? 0.04 : 0.96;
    const abut = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2.25, 0.9, 0.85), stoneMat);
    abut.position.set(0, deckYAtT(t) - 0.45, endSign * (halfLength - 0.15));
    abut.receiveShadow = true;
    group.add(abut);
  }

  // Crooked timber railing posts & top handrails on left and right sides
  const postTs = [0.08, 0.35, 0.65, 0.92];
  for (const side of [-1, 1] as const) {
    const xPos = side * (halfWidth - 0.08);
    for (let i = 0; i < postTs.length; i++) {
      const t = postTs[i];
      const zPos = THREE.MathUtils.lerp(-halfLength, halfLength, t);
      const yBase = deckYAtT(t);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 1.05, 5), logMat);
      post.position.set(xPos, yBase + 0.45, zPos);
      post.rotation.z = side * (0.04 + (i % 2) * 0.03);
      post.castShadow = true;
      group.add(post);

      if (i < postTs.length - 1) {
        const t2 = postTs[i + 1];
        const z2 = THREE.MathUtils.lerp(-halfLength, halfLength, t2);
        const y2 = deckYAtT(t2);
        const railLen = Math.hypot(z2 - zPos, y2 - yBase) + 0.08;
        const railAngle = Math.atan2(y2 - yBase, z2 - zPos);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, railLen), plankMat);
        rail.position.set(xPos, (yBase + y2) * 0.5 + 0.88, (zPos + z2) * 0.5);
        rail.rotation.x = -railAngle;
        group.add(rail);
      }
    }
  }

  return group;
}

/**
 * Mossy Bastion Ruins — Ancient shattered medieval keep walls & broken gothic arch
 */
export function createBastionRuins(textures: ProceduralTextures): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#9ca4aa',
    flatShading: true,
  });
  const mossStoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#7a8d7f',
    flatShading: true,
  });
  applyRetroVertexSnap(stoneMat, 200);
  applyRetroVertexSnap(mossStoneMat, 200);

  // Flagstone floor
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.9, 0.28, 7), mossStoneMat);
  floor.position.y = 0.1;
  floor.receiveShadow = true;
  group.add(floor);

  // Broken north-west bastion wall + crenellation tooth
  const wallBack = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.8, 1.05), stoneMat);
  wallBack.position.set(0, 1.9, -4.1);
  wallBack.castShadow = true;
  wallBack.receiveShadow = true;
  group.add(wallBack);

  const merlonL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.95), mossStoneMat);
  merlonL.position.set(-2.2, 4.35, -4.1);
  merlonL.castShadow = true;
  group.add(merlonL);

  const merlonR = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.95, 0.95), stoneMat);
  merlonR.position.set(1.9, 4.2, -4.1);
  group.add(merlonR);

  // Shattered corner turret tower (left rear)
  const towerDrum = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 5.4, 6), stoneMat);
  towerDrum.position.set(-3.7, 2.7, -3.5);
  towerDrum.castShadow = true;
  towerDrum.receiveShadow = true;
  group.add(towerDrum);

  const brokenCrown = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.68, 1.4, 5), mossStoneMat);
  brokenCrown.position.set(-3.7, 5.8, -3.5);
  brokenCrown.rotation.z = 0.08;
  group.add(brokenCrown);

  // Flanking ruined side walls
  const wallEast = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.9, 5.2), stoneMat);
  wallEast.position.set(3.4, 1.45, -1.6);
  wallEast.castShadow = true;
  wallEast.receiveShadow = true;
  group.add(wallEast);

  const wallWest = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 4.0), mossStoneMat);
  wallWest.position.set(-3.8, 1.05, 0.4);
  wallWest.castShadow = true;
  group.add(wallWest);

  // Fallen masonry blocks & broken column drum
  const fallenDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 6), stoneMat);
  fallenDrum.rotation.z = Math.PI / 2;
  fallenDrum.rotation.y = 0.42;
  fallenDrum.position.set(0.6, 0.52, -1.2);
  fallenDrum.castShadow = true;
  group.add(fallenDrum);

  const rubbleOffsets = [
    [-1.6, 0.45, 1.8, 0.7],
    [2.1, 0.4, 1.6, 0.55],
    [1.8, 0.5, -2.5, 0.8],
  ];
  for (const [rx, ry, rz, rs] of rubbleOffsets) {
    const block = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), mossStoneMat);
    block.position.set(rx, ry, rz);
    block.rotation.set(rx, rz, 0.3);
    group.add(block);
  }

  return group;
}

/**
 * Moss-Choked Ruined Altar Shrine (centerpiece of The Whispering Ring mysterious clearing)
 */
export function createRuinedAltar(textures: ProceduralTextures): {
  group: THREE.Group;
  ember: THREE.Mesh;
} {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#9ba3a8',
    flatShading: true,
  });
  const mossStoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#798c7d',
    flatShading: true,
  });
  const emberMat = new THREE.MeshBasicMaterial({
    color: '#f28b35',
  });
  applyRetroVertexSnap(stoneMat, 200);
  applyRetroVertexSnap(mossStoneMat, 200);

  // Stepped circular stone dais
  const dais1 = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.55, 0.34, 7), mossStoneMat);
  dais1.position.y = 0.16;
  dais1.receiveShadow = true;
  group.add(dais1);

  const dais2 = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.75, 0.3, 7), stoneMat);
  dais2.position.y = 0.46;
  dais2.receiveShadow = true;
  group.add(dais2);

  // Carved stone altar pedestal & cracked altar slab
  const ped = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.72), stoneMat);
  ped.position.y = 1.02;
  ped.castShadow = true;
  group.add(ped);

  const table = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.22, 1.08), mossStoneMat);
  table.position.y = 1.52;
  table.rotation.z = -0.025;
  table.castShadow = true;
  group.add(table);

  // Flanking broken gothic arch pillars behind the altar
  for (const side of [-1, 1] as const) {
    const h = side < 0 ? 2.85 : 2.15;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.29, h, 6), stoneMat);
    pillar.position.set(side * 1.15, 0.55 + h * 0.5, -0.82);
    pillar.rotation.z = side * 0.04;
    pillar.castShadow = true;
    group.add(pillar);
  }

  // Flickering offering brazier bowl atop the altar
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.14, 0.22, 6), stoneMat);
  bowl.position.set(0, 1.72, 0.05);
  group.add(bowl);

  const ember = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), emberMat);
  ember.scale.set(1.1, 0.65, 1.1);
  ember.position.set(0, 1.85, 0.05);
  group.add(ember);

  return { group, ember };
}

/**
 * Multi-Part Jagged Rock Formations (Cragstone Tor & rocky outcrops)
 */
export function createRockFormation(
  textures: ProceduralTextures,
  variant: 0 | 1 | 2,
  scale = 1
): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#939ca3',
    flatShading: true,
  });
  const mossMat = new THREE.MeshLambertMaterial({
    map: textures.stoneColor,
    color: '#7a8c7e',
    flatShading: true,
  });
  applyRetroVertexSnap(stoneMat, 200);
  applyRetroVertexSnap(mossMat, 200);

  if (variant === 0) {
    // Leaning twin megalith spires
    const main = new THREE.Mesh(new THREE.ConeGeometry(1.45, 4.6, 5), stoneMat);
    main.position.set(0, 2.0, 0);
    main.rotation.set(0.08, 0.3, -0.14);
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    const side = new THREE.Mesh(new THREE.ConeGeometry(1.05, 3.1, 5), mossMat);
    side.position.set(1.25, 1.35, 0.45);
    side.rotation.set(-0.1, 0.9, 0.22);
    side.castShadow = true;
    group.add(side);

    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35, 0), mossMat);
    base.scale.set(1.4, 0.65, 1.2);
    base.position.set(-0.5, 0.45, 0.55);
    group.add(base);
  } else if (variant === 1) {
    // Split cleft boulders
    const left = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), stoneMat);
    left.scale.set(0.95, 1.65, 1.1);
    left.position.set(-0.85, 1.15, 0);
    left.rotation.set(0.15, 0.4, 0.16);
    left.castShadow = true;
    group.add(left);

    const right = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 0), mossMat);
    right.scale.set(1.0, 1.45, 0.95);
    right.position.set(0.95, 0.95, 0.2);
    right.rotation.set(-0.1, -0.5, -0.14);
    right.castShadow = true;
    group.add(right);
  } else {
    // Broad stepped crag outcrop
    const slab = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), mossMat);
    slab.scale.set(1.5, 0.85, 1.2);
    slab.position.set(0, 0.7, 0);
    slab.receiveShadow = true;
    slab.castShadow = true;
    group.add(slab);

    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), stoneMat);
    cap.scale.set(1.2, 0.95, 0.9);
    cap.position.set(-0.35, 1.55, -0.15);
    cap.rotation.y = 0.7;
    cap.castShadow = true;
    group.add(cap);
  }

  group.scale.setScalar(scale);
  return group;
}

