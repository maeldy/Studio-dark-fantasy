import * as THREE from 'three';

export interface ProceduralTextures {
  groundColor: THREE.CanvasTexture;
  barkColor: THREE.CanvasTexture;
  stoneColor: THREE.CanvasTexture;
  foliageColor: THREE.CanvasTexture;
  broadleafColor: THREE.CanvasTexture;
  woodPlankColor: THREE.CanvasTexture;
  weatheredTimberColor: THREE.CanvasTexture;
  roofShingleColor: THREE.CanvasTexture;
  carvedRuneStoneColor: THREE.CanvasTexture;
  plasterTimberColor: THREE.CanvasTexture;
  dungeonBrickColor: THREE.CanvasTexture;
  caveRockColor: THREE.CanvasTexture;
  wovenRugColor: THREE.CanvasTexture;
  cobbleColor: THREE.CanvasTexture;
  grassSprite: THREE.CanvasTexture;
  fernSprite: THREE.CanvasTexture;
  brambleSprite: THREE.CanvasTexture;
  ivySprite: THREE.CanvasTexture;
  lianaSprite: THREE.CanvasTexture;
  tallPlantSprite: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  mistParticle: THREE.CanvasTexture;
  dispose: () => void;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function configureRetroTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  isSprite = false
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  if (!isSprite) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  return tex;
}

function createGroundTexture(): THREE.CanvasTexture {
  // 64x64 coarse PS1 texels — vertex colors supply moss/mud/rock macro variation
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(4217);

  ctx.fillStyle = '#aba99f';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = rand();
      // Subtle checkerboard dither + organic soil grit
      const dither = ((x + y) & 1) === 0 ? 6 : -6;
      const v = Math.floor(158 + (n - 0.5) * 58 + dither);
      const warm = n > 0.7 ? -6 : 0;
      ctx.fillStyle = `rgb(${v}, ${v + warm}, ${v - 7})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Scattered coarse dark pebble / pine needle blocks (2x1 texels)
  for (let i = 0; i < 95; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.fillStyle = rand() > 0.4 ? 'rgba(34, 32, 26, 0.55)' : 'rgba(195, 190, 174, 0.28)';
    ctx.fillRect(x, y, 2, 1);
  }

  return configureRetroTexture(canvas, 38, 38);
}

function createBarkTexture(): THREE.CanvasTexture {
  // 32x64 rugged vertical pine bark texels
  const w = 32;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(8813);

  ctx.fillStyle = '#33271e';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 64; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const bw = 1 + Math.floor(rand() * 2);
    const bh = 5 + Math.floor(rand() * 14);
    ctx.fillStyle = rand() > 0.45 ? '#1b140f' : '#4a3b2e';
    ctx.fillRect(x, y, bw, bh);
    if (y + bh > h) ctx.fillRect(x, y - h, bw, bh);
  }

  // Mossy vertical flecks
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    ctx.fillStyle = '#263625';
    ctx.fillRect(x, y, 2, 3 + Math.floor(rand() * 5));
  }

  return configureRetroTexture(canvas, 1, 4);
}

function createStoneTexture(): THREE.CanvasTexture {
  // 64x64 weathered ashlar stone blocks + cracks + moss
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(9921);

  ctx.fillStyle = '#535b61';
  ctx.fillRect(0, 0, size, size);

  // Coarse stone noise
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.floor(76 + (rand() - 0.5) * 30);
      ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 8})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Masonry mortar seams
  ctx.fillStyle = 'rgba(22, 26, 30, 0.65)';
  for (let row = 0; row < 4; row++) {
    const y = row * 16;
    ctx.fillRect(0, y, size, 1);
    const offset = (row % 2) * 16;
    for (let col = 0; col < 2; col++) {
      ctx.fillRect((col * 32 + offset) % size, y, 1, 16);
    }
  }

  // Moss patches
  for (let i = 0; i < 24; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.fillStyle = 'rgba(42, 60, 44, 0.55)';
    ctx.fillRect(x, y, 2 + Math.floor(rand() * 4), 2 + Math.floor(rand() * 3));
  }

  return configureRetroTexture(canvas, 1, 1);
}

function createFoliageTexture(): THREE.CanvasTexture {
  // 64x64 jagged dark pine needle texels
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(3105);

  ctx.fillStyle = '#213024';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 180; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const len = 2 + Math.floor(rand() * 5);
    const s = rand();
    ctx.fillStyle = s < 0.4 ? '#121c15' : s < 0.8 ? '#2c402d' : '#40533b';
    ctx.fillRect(x, y, 1, len);
    ctx.fillRect(x + (rand() > 0.5 ? 1 : -1), y + 1, 1, Math.max(1, len - 2));
  }

  return configureRetroTexture(canvas, 2, 2);
}

function createBroadleafTexture(): THREE.CanvasTexture {
  // 64x64 muted dark woodland oak/alder leaf clusters matching PS1 palette
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(4729);

  ctx.fillStyle = '#243122';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 210; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const s = rand();
    ctx.fillStyle =
      s < 0.34 ? '#151e16' : s < 0.72 ? '#2e3f28' : s < 0.92 ? '#3d4d32' : '#4a5539';
    const w = 2 + Math.floor(rand() * 3);
    const h = 2 + Math.floor(rand() * 2);
    ctx.fillRect(x, y, w, h);
    if (x + w > size) ctx.fillRect(x - size, y, w, h);
    if (y + h > size) ctx.fillRect(x, y - size, w, h);
  }

  return configureRetroTexture(canvas, 2, 2);
}

function createWoodPlankTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(6619);

  ctx.fillStyle = '#473628';
  ctx.fillRect(0, 0, size, size);

  for (let p = 0; p < 4; p++) {
    const py = p * 16;
    ctx.fillStyle = p % 2 === 0 ? '#4d3b2c' : '#413124';
    ctx.fillRect(0, py + 1, size, 14);
    ctx.fillStyle = '#1f1610';
    ctx.fillRect(0, py, size, 1);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(25, 18, 13, 0.45)' : 'rgba(95, 76, 58, 0.25)';
      ctx.fillRect(Math.floor(rand() * size), py + 2 + Math.floor(rand() * 12), 4 + Math.floor(rand() * 10), 1);
    }
  }

  return configureRetroTexture(canvas, 1, 1);
}

function createWeatheredTimberTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(3347);

  ctx.fillStyle = '#3b2e24';
  ctx.fillRect(0, 0, size, size);

  for (let row = 0; row < 6; row++) {
    const py = Math.floor((row / 6) * size);
    const h = 9;
    ctx.fillStyle = row % 2 === 0 ? '#45362a' : '#372a20';
    ctx.fillRect(0, py + 1, size, h);
    ctx.fillStyle = '#1b140e';
    ctx.fillRect(0, py, size, 1);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = rand() > 0.45 ? 'rgba(20, 14, 10, 0.5)' : 'rgba(84, 68, 52, 0.25)';
      ctx.fillRect(Math.floor(rand() * size), py + 2 + Math.floor(rand() * 7), 3 + Math.floor(rand() * 9), 1);
    }
  }

  // Mossy damp stains near bottom and seams
  for (let i = 0; i < 28; i++) {
    const x = Math.floor(rand() * size);
    const y = 32 + Math.floor(rand() * 32);
    ctx.fillStyle = 'rgba(42, 60, 41, 0.52)';
    ctx.fillRect(x, y, 2 + Math.floor(rand() * 4), 2 + Math.floor(rand() * 3));
  }

  return configureRetroTexture(canvas, 1, 1);
}

function createRoofShingleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(5189);

  ctx.fillStyle = '#2d2a26';
  ctx.fillRect(0, 0, size, size);

  for (let row = 0; row < 8; row++) {
    const y = row * 8;
    const offset = (row % 2) * 4;
    for (let col = 0; col < 8; col++) {
      const x = (col * 8 + offset) % size;
      const shade = Math.floor(46 + (rand() - 0.5) * 18);
      const moss = rand() > 0.68 ? 14 : 0;
      ctx.fillStyle = `rgb(${shade}, ${shade + moss}, ${shade - 3})`;
      ctx.fillRect(x + 1, y + 1, 6, 6);
    }
    ctx.fillStyle = 'rgba(14, 14, 12, 0.72)';
    ctx.fillRect(0, y, size, 1);
  }

  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.fillStyle = 'rgba(46, 66, 44, 0.58)';
    ctx.fillRect(x, y, 3 + Math.floor(rand() * 4), 2 + Math.floor(rand() * 3));
  }

  return configureRetroTexture(canvas, 2, 2);
}

function createCarvedRuneStoneTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(9091);

  ctx.fillStyle = '#4e565c';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.floor(74 + (rand() - 0.5) * 26);
      ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 7})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Carved horizontal frieze bands and geometric medieval runes
  ctx.fillStyle = 'rgba(20, 24, 28, 0.72)';
  ctx.fillRect(0, 10, size, 2);
  ctx.fillRect(0, 52, size, 2);
  for (let gx = 4; gx < size - 4; gx += 10) {
    ctx.fillRect(gx, 16, 1, 30);
    ctx.fillRect(gx + 4, 20, 1, 22);
    ctx.fillRect(gx, 16, 5, 1);
    ctx.fillRect(gx + 1, 29, 3, 1);
    ctx.fillRect(gx, 45, 5, 1);
  }

  // Creeping moss blotches
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.fillStyle = 'rgba(44, 64, 44, 0.55)';
    ctx.fillRect(x, y, 2 + Math.floor(rand() * 4), 2 + Math.floor(rand() * 4));
  }

  return configureRetroTexture(canvas, 1, 1);
}

function createCobbleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(7731);

  ctx.fillStyle = '#252826';
  ctx.fillRect(0, 0, size, size);

  for (let row = 0; row < 6; row++) {
    const y = row * 11;
    const offset = (row % 2) * 6;
    for (let col = 0; col < 5; col++) {
      const x = (col * 13 + offset) % size;
      const shade = Math.floor(68 + (rand() - 0.5) * 26);
      const moss = rand() > 0.65 ? 8 : 0;
      ctx.fillStyle = `rgb(${shade}, ${shade + 4 + moss}, ${shade + 6})`;
      ctx.fillRect(x + 1, y + 1, 10, 8);
    }
  }

  return configureRetroTexture(canvas, 2, 4);
}

function createPlasterTimberTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(2049);

  // Aged muted cream-grey daub plaster
  ctx.fillStyle = '#8b8374';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.floor(132 + (rand() - 0.5) * 26);
      ctx.fillStyle = `rgb(${v}, ${v - 5}, ${v - 14})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Dark oak half-timber frame & diagonal cross braces (inspired by manor ref)
  ctx.fillStyle = '#2d2219';
  ctx.fillRect(0, 0, size, 5);
  ctx.fillRect(0, size - 5, size, 5);
  ctx.fillRect(0, 0, 5, size);
  ctx.fillRect(size - 5, 0, 5, size);
  ctx.fillRect(29, 0, 5, size);

  for (let i = 0; i < 28; i++) {
    const t = i / 28;
    const dx = Math.round(5 + t * 24);
    const dy = Math.round(5 + t * 54);
    ctx.fillRect(dx, dy, 3, 3);
    ctx.fillRect(size - 8 - dx + 5, dy, 3, 3);
  }

  return configureRetroTexture(canvas, 1, 1);
}

function createDungeonBrickTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(8123);

  ctx.fillStyle = '#33363a';
  ctx.fillRect(0, 0, size, size);

  for (let row = 0; row < 8; row++) {
    const y = row * 8;
    const off = (row % 2) * 8;
    for (let col = 0; col < 4; col++) {
      const x = (col * 16 + off) % size;
      const base = Math.floor(54 + (rand() - 0.5) * 20);
      const warm = rand() > 0.6 ? 6 : 0;
      ctx.fillStyle = `rgb(${base + warm}, ${base + 2}, ${base})`;
      ctx.fillRect(x + 1, y + 1, 14, 6);
    }
    ctx.fillStyle = '#181a1d';
    ctx.fillRect(0, y, size, 1);
  }

  // Damp soot & moss seepage
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(20, 26, 20, 0.48)' : 'rgba(18, 16, 15, 0.45)';
    ctx.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), 3, 2 + Math.floor(rand() * 4));
  }

  return configureRetroTexture(canvas, 2, 2);
}

function createCaveRockTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(4519);

  ctx.fillStyle = '#2d3237';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const strata = Math.sin(y * 0.25 + x * 0.08) * 10;
      const v = Math.floor(46 + strata + (rand() - 0.5) * 24);
      ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 7})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Mineral fissures & damp streaks
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.fillStyle = rand() > 0.4 ? 'rgba(14, 17, 20, 0.65)' : 'rgba(72, 86, 82, 0.35)';
    ctx.fillRect(x, y, 1 + Math.floor(rand() * 2), 4 + Math.floor(rand() * 9));
  }

  return configureRetroTexture(canvas, 2, 2);
}

function createWovenRugTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(9941);

  // Muted dark-crimson & worn ochre medieval tapestry weave
  ctx.fillStyle = '#4f2423';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#735a38';
  ctx.fillRect(4, 4, size - 8, 3);
  ctx.fillRect(4, size - 7, size - 8, 3);
  ctx.fillRect(4, 4, 3, size - 8);
  ctx.fillRect(size - 7, 4, 3, size - 8);

  ctx.fillStyle = '#2e3b3f';
  ctx.fillRect(14, 14, size - 28, size - 28);
  ctx.fillStyle = '#6d5434';
  ctx.fillRect(22, 22, size - 44, size - 44);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rand() > 0.72) {
        ctx.fillStyle = 'rgba(18, 14, 12, 0.25)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return configureRetroTexture(canvas, 1, 1);
}

function createGrassSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(5501);
  ctx.clearRect(0, 0, size, size);

  const bladeCount = 13;
  for (let i = 0; i < bladeCount; i++) {
    const bx = 10 + Math.floor((i / (bladeCount - 1)) * 44);
    const h = 24 + Math.floor(rand() * 28);
    const lean = Math.floor((bx - 32) * 0.32 + (rand() - 0.5) * 8);
    for (let step = 0; step < h; step++) {
      const t = step / h;
      const x = Math.round(bx + lean * t * t);
      const y = 63 - step;
      const w = step < h * 0.45 ? 2 : 1;
      ctx.fillStyle =
        t < 0.35 ? '#182218' : t < 0.72 ? '#2c3d29' : rand() > 0.5 ? '#48573b' : '#57553b';
      ctx.fillRect(x, y, w, 1);
    }
  }

  return configureRetroTexture(canvas, 1, 1, true);
}

function createFernSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const fronds = [
    { angle: -0.72, len: 38 },
    { angle: -0.35, len: 46 },
    { angle: 0.0, len: 50 },
    { angle: 0.36, len: 45 },
    { angle: 0.72, len: 36 },
  ];

  for (const frond of fronds) {
    for (let s = 4; s <= frond.len; s += 2) {
      const t = s / frond.len;
      const cx = Math.round(32 + Math.sin(frond.angle) * s);
      const cy = Math.round(62 - Math.cos(frond.angle) * s);
      ctx.fillStyle = '#1a2618';
      ctx.fillRect(cx, cy, 1, 2);
      if (s > 10 && s % 4 === 0) {
        const span = Math.max(1, Math.round((1 - t * 0.6) * 6));
        ctx.fillStyle = t > 0.65 ? '#3a4e32' : '#263823';
        ctx.fillRect(cx - span, cy, span * 2 + 1, 2);
      }
    }
  }

  return configureRetroTexture(canvas, 1, 1, true);
}

function createBrambleSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(7123);
  ctx.clearRect(0, 0, size, size);

  // Crooked dark woody twigs
  for (let i = 0; i < 6; i++) {
    let x = 28 + Math.floor(rand() * 8);
    let y = 62;
    const dir = (rand() - 0.5) * 1.4;
    for (let s = 0; s < 36; s++) {
      x += dir + (rand() - 0.5) * 1.2;
      y -= 1.2;
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }

  // Sparse muted leaves
  for (let i = 0; i < 34; i++) {
    const cx = 10 + Math.floor(rand() * 44);
    const cy = 12 + Math.floor(rand() * 42);
    ctx.fillStyle = rand() > 0.45 ? '#202e20' : '#323f27';
    ctx.fillRect(cx, cy, 3 + Math.floor(rand() * 3), 2 + Math.floor(rand() * 2));
  }

  return configureRetroTexture(canvas, 1, 1, true);
}

function createIvySprite(): THREE.CanvasTexture {
  // 64x64 lush clinging creeping ivy vines & leaf clusters that read clearly at retro resolution
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(9411);
  ctx.clearRect(0, 0, size, size);

  const runners = 6;
  for (let r = 0; r < runners; r++) {
    let x = 7 + r * 9.5 + (rand() - 0.5) * 4;
    for (let y = 1; y < 63; y++) {
      x += Math.sin(y * 0.21 + r * 1.6) * 0.85;
      const rx = Math.round(x);
      ctx.fillStyle = '#182115';
      ctx.fillRect(rx, y, 2, 2);

      if (y % 3 === 0) {
        const side = (y / 3 + r) % 2 === 0 ? 1 : -1;
        const lx = rx + side * (2 + Math.floor(rand() * 4));
        const ly = y + Math.floor((rand() - 0.5) * 3);
        const shade = rand();
        ctx.fillStyle = shade < 0.35 ? '#1b2b1a' : shade < 0.72 ? '#2c4128' : '#3d5434';
        ctx.fillRect(lx - 2, ly - 1, 4, 4);
        ctx.fillRect(lx - 1, ly - 2, 3, 5);
      }
    }
  }

  return configureRetroTexture(canvas, 1, 1, true);
}

function createLianaSprite(): THREE.CanvasTexture {
  // 64x64 draped hanging woodland lianas & mossy vine tendrils dropping from upper branch (y=0)
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(8363);
  ctx.clearRect(0, 0, size, size);

  const strandCount = 7;
  for (let s = 0; s < strandCount; s++) {
    let x = 7 + s * 8 + (rand() - 0.5) * 3;
    const maxLen = 44 + Math.floor(rand() * 20);
    for (let y = 0; y < maxLen; y++) {
      x += Math.sin(y * 0.15 + s * 1.9) * 0.6;
      const px = Math.round(x);
      ctx.fillStyle = y < 18 ? '#23281b' : '#263421';
      ctx.fillRect(px, y, 2, 2);

      if (y > 3 && y % 4 === 0 && rand() > 0.18) {
        const side = rand() > 0.5 ? 1 : -1;
        ctx.fillStyle = rand() > 0.45 ? '#2b3e26' : '#3b5031';
        ctx.fillRect(px + side * 1, y - 1, 3, 4);
        if (rand() > 0.55) {
          ctx.fillRect(px - side * 2, y + 1, 2, 3);
        }
      }
    }
  }

  return configureRetroTexture(canvas, 1, 1, true);
}

function createTallPlantSprite(): THREE.CanvasTexture {
  // 64x64 tall wild forest stalks, broad woodland leaves & dark reed clusters
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(6207);
  ctx.clearRect(0, 0, size, size);

  for (let s = 0; s < 5; s++) {
    const bx = 14 + s * 9 + Math.floor((rand() - 0.5) * 4);
    const topY = 6 + Math.floor(rand() * 14);
    for (let y = 63; y >= topY; y--) {
      const t = (63 - y) / (63 - topY);
      const cx = Math.round(bx + Math.sin(t * 2.5 + s) * 2.5);
      ctx.fillStyle = t < 0.4 ? '#1b2719' : '#2b3c26';
      ctx.fillRect(cx, y, 1, 1);

      if (y % 7 === 0 && y > topY + 4 && y < 56) {
        const side = (s + y) % 2 === 0 ? 1 : -1;
        const len = 4 + Math.floor(rand() * 4);
        ctx.fillStyle = rand() > 0.4 ? '#35482e' : '#455436';
        for (let k = 1; k <= len; k++) {
          ctx.fillRect(cx + side * k, y - Math.floor(k * 0.45), 2, 2);
        }
      }
    }
    // Small dried wildflower/umbel head at stalk top
    ctx.fillStyle = '#4e543b';
    ctx.fillRect(bx - 2, topY - 1, 5, 2);
  }

  return configureRetroTexture(canvas, 1, 1, true);
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(6, 9, 12, 0.78)');
  grad.addColorStop(0.6, 'rgba(8, 12, 16, 0.35)');
  grad.addColorStop(1, 'rgba(8, 12, 16, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMistParticleTexture(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  grad.addColorStop(0, 'rgba(208, 218, 226, 0.6)');
  grad.addColorStop(0.5, 'rgba(170, 184, 196, 0.22)');
  grad.addColorStop(1, 'rgba(170, 184, 196, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createProceduralTextures(): ProceduralTextures {
  const groundColor = createGroundTexture();
  const barkColor = createBarkTexture();
  const stoneColor = createStoneTexture();
  const foliageColor = createFoliageTexture();
  const broadleafColor = createBroadleafTexture();
  const woodPlankColor = createWoodPlankTexture();
  const weatheredTimberColor = createWeatheredTimberTexture();
  const roofShingleColor = createRoofShingleTexture();
  const carvedRuneStoneColor = createCarvedRuneStoneTexture();
  const plasterTimberColor = createPlasterTimberTexture();
  const dungeonBrickColor = createDungeonBrickTexture();
  const caveRockColor = createCaveRockTexture();
  const wovenRugColor = createWovenRugTexture();
  const cobbleColor = createCobbleTexture();
  const grassSprite = createGrassSprite();
  const fernSprite = createFernSprite();
  const brambleSprite = createBrambleSprite();
  const ivySprite = createIvySprite();
  const lianaSprite = createLianaSprite();
  const tallPlantSprite = createTallPlantSprite();
  const contactShadow = createContactShadowTexture();
  const mistParticle = createMistParticleTexture();

  const all = [
    groundColor,
    barkColor,
    stoneColor,
    foliageColor,
    broadleafColor,
    woodPlankColor,
    weatheredTimberColor,
    roofShingleColor,
    carvedRuneStoneColor,
    plasterTimberColor,
    dungeonBrickColor,
    caveRockColor,
    wovenRugColor,
    cobbleColor,
    grassSprite,
    fernSprite,
    brambleSprite,
    ivySprite,
    lianaSprite,
    tallPlantSprite,
    contactShadow,
    mistParticle,
  ];

  return {
    groundColor,
    barkColor,
    stoneColor,
    foliageColor,
    broadleafColor,
    woodPlankColor,
    weatheredTimberColor,
    roofShingleColor,
    carvedRuneStoneColor,
    plasterTimberColor,
    dungeonBrickColor,
    caveRockColor,
    wovenRugColor,
    cobbleColor,
    grassSprite,
    fernSprite,
    brambleSprite,
    ivySprite,
    lianaSprite,
    tallPlantSprite,
    contactShadow,
    mistParticle,
    dispose: () => {
      for (const tex of all) tex.dispose();
    },
  };
}
