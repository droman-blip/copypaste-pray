import * as THREE from 'three';

export type ScreenTheme =
  | 'cad'
  | 'finance'
  | 'science'
  | 'flight'
  | 'whiteboard'
  | 'blueprint'
  | 'specs'
  | 'molecule'
  | 'orbitmap'
  | 'servers'
  | 'comms'
  | 'schedule'
  | 'paper';

export interface SpaceMaterialLibrary {
  hullWhite: THREE.MeshStandardMaterial;
  hullDark: THREE.MeshStandardMaterial;
  rocketMetallicHull: THREE.MeshStandardMaterial;
  rocketThermalTile: THREE.MeshStandardMaterial;
  titanium: THREE.MeshStandardMaterial;
  brushedSteel: THREE.MeshStandardMaterial;
  copperNozzle: THREE.MeshStandardMaterial;
  goldKapton: THREE.MeshStandardMaterial;
  craneYellow: THREE.MeshStandardMaterial;
  solarCell: THREE.MeshStandardMaterial;
  ceramicHeatShield: THREE.MeshStandardMaterial;
  floorDeck: THREE.MeshStandardMaterial;
  floorScience: THREE.MeshStandardMaterial;
  floorFinance: THREE.MeshStandardMaterial;
  floorControl: THREE.MeshStandardMaterial;
  floorPolishedOrange: THREE.MeshStandardMaterial;
  floorPolishedYellow: THREE.MeshStandardMaterial;
  floorPolishedGreen: THREE.MeshStandardMaterial;
  floorPolishedBlue: THREE.MeshStandardMaterial;
  floorPolishedSlate: THREE.MeshStandardMaterial;
  mezzFloor: THREE.MeshStandardMaterial;
  rampSurface: THREE.MeshStandardMaterial;
  facilityDeck: THREE.MeshStandardMaterial;
  wallSlate: THREE.MeshStandardMaterial;
  wallEngineering: THREE.MeshStandardMaterial;
  wallScience: THREE.MeshStandardMaterial;
  wallFinance: THREE.MeshStandardMaterial;
  wallControl: THREE.MeshStandardMaterial;
  wallCementOrange: THREE.MeshStandardMaterial;
  wallCementYellow: THREE.MeshStandardMaterial;
  wallCementGreen: THREE.MeshStandardMaterial;
  wallCementBlue: THREE.MeshStandardMaterial;
  wallCementSlate: THREE.MeshStandardMaterial;
  wallHangarMetal: THREE.MeshStandardMaterial;
  wallTrim: THREE.MeshStandardMaterial;
  woodTable: THREE.MeshStandardMaterial;
  ceilingAcoustic: THREE.MeshStandardMaterial;
  glassPanel: THREE.MeshPhysicalMaterial;
  hazardFloor: THREE.MeshStandardMaterial;
  corridorFloor: THREE.MeshStandardMaterial;
  terrainGrass: THREE.MeshStandardMaterial;
  sandBeach: THREE.MeshStandardMaterial;
  oceanWater: THREE.MeshStandardMaterial;
  asphaltRoad: THREE.MeshStandardMaterial;
  concretePad: THREE.MeshStandardMaterial;
  foliageGreen: THREE.MeshStandardMaterial;
  trunkBrown: THREE.MeshStandardMaterial;
  fabricCharcoal: THREE.MeshStandardMaterial;
  fabricExecutive: THREE.MeshStandardMaterial;
  paperReport: THREE.MeshStandardMaterial;
  holoGlow: THREE.MeshBasicMaterial;
  exhaustFlame: THREE.MeshBasicMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  weatheredSteel: THREE.MeshStandardMaterial;
  heavyCableDark: THREE.MeshStandardMaterial;
  repoVisorGlass: THREE.MeshStandardMaterial;
  repoJointRubber: THREE.MeshStandardMaterial;
  createScreenMaterial: (theme: ScreenTheme, accentHex: string, title: string) => THREE.MeshStandardMaterial;
  dispose: () => void;
}

function createSolarTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c1f45';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 248);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createHazardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#182030';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 18;
  for (let i = -256; i < 512; i += 48) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function createSteelGratingTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark gunmetal open-bar steel grating base
  ctx.fillStyle = '#0d131d';
  ctx.fillRect(0, 0, 512, 512);

  // Longitudinal load-bearing steel bars
  for (let x = 0; x < 512; x += 16) {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x, 0, 6, 512);
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 1, 0, 2, 512);
  }

  // Transverse serrated cross-bars & diamond traction studs
  for (let y = 0; y < 512; y += 24) {
    ctx.fillStyle = '#182230';
    ctx.fillRect(0, y, 512, 6);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, y + 1, 512, 1.5);

    for (let x = 8; x < 512; x += 16) {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(x, y + 9);
      ctx.lineTo(x + 4, y + 14);
      ctx.lineTo(x, y + 19);
      ctx.lineTo(x - 4, y + 14);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Bolted transverse structural seam every 256px
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 248, 512, 16);
  ctx.fillStyle = '#64748b';
  for (let x = 24; x < 512; x += 64) {
    ctx.beginPath();
    ctx.arc(x, 256, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 4.5);
  return tex;
}

function createAerospaceDeckTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Dark titanium / gunmetal launch complex steel deck
  ctx.fillStyle = '#1a2230';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle multi-plate tonal variation
  const tileSize = 256;
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const shade = (gx + gy) % 2 === 0 ? '#1f2838' : '#171f2c';
      ctx.fillStyle = shade;
      ctx.fillRect(gx * tileSize + 3, gy * tileSize + 3, tileSize - 6, tileSize - 6);

      // Subtle brushed metallic streaks
      ctx.fillStyle = 'rgba(148, 163, 184, 0.04)';
      for (let s = 0; s < 14; s++) {
        ctx.fillRect(gx * tileSize + 10, gy * tileSize + 14 + s * 16, tileSize - 20, 2);
      }
    }
  }

  // Heavy recessed bolted panel seams
  ctx.strokeStyle = '#090e17';
  ctx.lineWidth = 6;
  for (let i = 0; i <= 1024; i += tileSize) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Corner hex bolts & bevel highlight lines
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const x0 = gx * tileSize;
      const y0 = gy * tileSize;
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 8, y0 + 8, tileSize - 16, tileSize - 16);

      ctx.fillStyle = '#64748b';
      for (const bx of [x0 + 18, x0 + tileSize - 18]) {
        for (const by of [y0 + 18, y0 + tileSize - 18]) {
          ctx.beginPath();
          ctx.arc(bx, by, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Slotted industrial drainage grate bay on tile (1, 2) and (3, 0)
  for (const [dx, dy] of [
    [tileSize + 24, tileSize * 2 + 92],
    [tileSize * 3 + 24, 92],
  ]) {
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(dx, dy, 208, 72);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(dx, dy, 208, 72);
    ctx.fillStyle = '#334155';
    for (let sx = dx + 12; sx < dx + 196; sx += 14) {
      ctx.fillRect(sx, dy + 8, 6, 56);
    }
  }

  // Painted aerospace taxiway & safety alignment markings
  ctx.fillStyle = 'rgba(234, 179, 8, 0.42)';
  ctx.fillRect(0, 506, 1024, 12);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
  for (let y = 32; y < 1024; y += 96) {
    ctx.fillRect(508, y, 8, 48);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

function createTechnicalFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base cleanroom slate
  ctx.fillStyle = '#1b2434';
  ctx.fillRect(0, 0, 512, 512);

  // Panel seams
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Subtle inner tile bevel & corner bolts
  ctx.strokeStyle = '#283548';
  ctx.lineWidth = 2;
  for (let x = 0; x < 512; x += 128) {
    for (let y = 0; y < 512; y += 128) {
      ctx.strokeRect(x + 8, y + 8, 112, 112);
      ctx.fillStyle = '#475569';
      for (const bx of [x + 14, x + 114]) {
        for (const by of [y + 14, y + 114]) {
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Yellow & black safety stripe along tile seam edge
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 512, 12);
  ctx.fillStyle = '#0f172a';
  for (let i = -24; i < 536; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 14, 0);
    ctx.lineTo(i + 4, 12);
    ctx.lineTo(i - 10, 12);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function createTerrainGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3b5c34';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 10;
    ctx.fillStyle =
      i % 3 === 0 ? 'rgba(74, 112, 56, 0.35)' : i % 3 === 1 ? 'rgba(42, 68, 36, 0.35)' : 'rgba(116, 130, 74, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

function createAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2c323d';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle grain
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Yellow shoulder lines & dashed center lane
  ctx.fillStyle = '#eab308';
  ctx.fillRect(10, 0, 6, 256);
  ctx.fillRect(240, 0, 6, 256);

  ctx.fillStyle = '#f8fafc';
  for (let y = 16; y < 256; y += 56) {
    ctx.fillRect(125, y, 6, 30);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  return tex;
}

function createOceanTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#0c4a6e');
  grad.addColorStop(0.5, '#0284c7');
  grad.addColorStop(1, '#0369a1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(224, 242, 254, 0.22)';
  ctx.lineWidth = 3;
  for (let y = 16; y < 512; y += 28) {
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 32) {
      const wy = y + Math.sin(x * 0.04 + y) * 5;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.3)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createIndustrialWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 512, 512);

  // Corrugated vertical steel ribs
  for (let x = 0; x < 512; x += 32) {
    ctx.fillStyle = x % 64 === 0 ? '#3f4f66' : '#293548';
    ctx.fillRect(x, 0, 14, 512);
  }

  // Horizontal structural beam + rivets
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 220, 512, 34);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 440, 512, 18);
  ctx.fillStyle = '#0f172a';
  for (let i = -24; i < 536; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 440);
    ctx.lineTo(i + 16, 440);
    ctx.lineTo(i + 6, 458);
    ctx.lineTo(i - 10, 458);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createScienceWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 512);

  // Clean vertical modular wall seams
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  for (let x = 0; x <= 512; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Sterile emerald lab stripe
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(0, 310, 512, 26);
  ctx.fillStyle = '#86efac';
  ctx.fillRect(0, 302, 512, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function createScienceFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 64) {
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = (x / 64 + y / 64) % 2 === 0 ? '#f1f5f9' : '#e5edf5';
      ctx.fillRect(x + 2, y + 2, 60, 60);
    }
  }

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function createWoodWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4a2c1d';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle wood grain planks
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = x % 128 === 0 ? '#553423' : '#432719';
    ctx.fillRect(x + 2, 0, 60, 512);
    ctx.strokeStyle = 'rgba(28, 14, 8, 0.4)';
    ctx.lineWidth = 2;
    for (let g = 0; g < 12; g++) {
      const gx = x + 6 + g * 4.5;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx + Math.sin(g) * 3, 512);
      ctx.stroke();
    }
  }

  // Brass architectural trim rail
  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, 325, 512, 10);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, 340, 512, 172);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function createExecutiveCarpetTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#242b38';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.18)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2);
  }

  ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 236, 236);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function createControlAcousticTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);

  // Soundproof acoustic tiles
  for (let x = 0; x < 512; x += 64) {
    for (let y = 0; y < 512; y += 64) {
      ctx.fillStyle = (x / 64 + y / 64) % 2 === 0 ? '#172238' : '#131d30';
      ctx.fillRect(x + 3, y + 3, 58, 58);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.14)';
      ctx.fillRect(x + 12, y + 12, 40, 2);
    }
  }

  // Deep blue telemetry wall trim band
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 320, 512, 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function createControlFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < 512; x += 128) {
    for (let y = 0; y < 512; y += 128) {
      ctx.strokeRect(x + 14, y + 14, 100, 100);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function createCementWallTexture(
  baseHex: string,
  stripeHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle industrial concrete wear, oil grime & aggregate grain
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const sz = 1 + Math.random() * 3.2;
    ctx.fillStyle =
      i % 3 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(4, 7, 14, 0.22)';
    ctx.fillRect(x, y, sz, sz);
  }

  // Heavy industrial oil & condensation weathering streaks
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 360;
    const h = 45 + Math.random() * 140;
    ctx.fillStyle = 'rgba(2, 4, 10, 0.14)';
    ctx.fillRect(x, y, 3 + Math.random() * 9, h);
  }

  // Precast concrete panel joints
  ctx.strokeStyle = 'rgba(6, 10, 18, 0.7)';
  ctx.lineWidth = 4;
  for (let x = 0; x <= 512; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 170) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Formwork tie holes in precast slabs
  ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
  for (let x = 24; x < 512; x += 128) {
    for (let y = 28; y < 512; y += 170) {
      for (const ox of [0, 80]) {
        ctx.beginPath();
        ctx.arc(x + ox, y, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + ox, y + 114, 3.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Signature department stripe band & dark hazard kickplate plinth
  ctx.fillStyle = stripeHex;
  ctx.fillRect(0, 326, 512, 12);
  ctx.fillStyle = 'rgba(8, 11, 18, 0.62)';
  ctx.fillRect(0, 434, 512, 78);

  // Subtle industrial caution chevron along lower wall plinth
  ctx.fillStyle = 'rgba(245, 158, 11, 0.24)';
  for (let x = -32; x < 544; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 512);
    ctx.lineTo(x + 14, 512);
    ctx.lineTo(x + 28, 492);
    ctx.lineTo(x + 14, 492);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createPolishedConcreteFloorTexture(
  baseHex: string,
  tileHex: string,
  accentHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 128) {
    for (let y = 0; y < 512; y += 128) {
      ctx.fillStyle = (x / 128 + y / 128) % 2 === 0 ? baseHex : tileHex;
      ctx.fillRect(x + 3, y + 3, 122, 122);
    }
  }

  // Weathered industrial scuff marks & subtle oil sheen speckles
  for (let i = 0; i < 3200; i++) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.14)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2.5, 2.5);
  }

  ctx.strokeStyle = 'rgba(4, 7, 14, 0.78)';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.fillStyle = accentHex;
  ctx.globalAlpha = 0.22;
  ctx.fillRect(0, 0, 512, 5);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

function createHangarMetalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#252f3f';
  ctx.fillRect(0, 0, 512, 512);

  // Weathered dark corrugated steel ribs + heavy rivets
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = x % 128 === 0 ? '#2c384b' : '#1e2736';
    ctx.fillRect(x + 2, 0, 58, 512);

    ctx.fillStyle = '#64748b';
    for (let y = 18; y < 512; y += 44) {
      ctx.beginPath();
      ctx.arc(x + 9, y, 2.6, 0, Math.PI * 2);
      ctx.arc(x + 53, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Industrial grime & rust drips
  for (let i = 0; i < 45; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(6, 9, 15, 0.25)' : 'rgba(120, 53, 15, 0.14)';
    ctx.fillRect(Math.random() * 512, Math.random() * 420, 4 + Math.random() * 10, 30 + Math.random() * 90);
  }

  // Structural steel girder bands & hazard warning band
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 210, 512, 32);
  ctx.fillRect(0, 446, 512, 26);
  ctx.fillStyle = '#d97706';
  for (let x = -32; x < 544; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 448);
    ctx.lineTo(x + 16, 448);
    ctx.lineTo(x + 26, 434);
    ctx.lineTo(x + 10, 434);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createRocketMetallicTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#cbd5e1');
  grad.addColorStop(0.35, '#f1f5f9');
  grad.addColorStop(0.7, '#94a3b8');
  grad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Aerospace skin panel seams & rivets
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.38)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#334155';
  for (let x = 8; x < 512; x += 64) {
    for (let y = 8; y < 512; y += 64) {
      ctx.fillRect(x, y, 3, 3);
      ctx.fillRect(x + 48, y, 3, 3);
    }
  }

  // NASA-style metallic markings band
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 240, 512, 26);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 266, 512, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createPaperDocumentTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8f5ec';
  ctx.fillRect(0, 0, 256, 320);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 236, 300);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(22, 24, 212, 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('NASA TECH REPORT', 44, 42);

  ctx.fillStyle = '#334155';
  for (let y = 74; y < 210; y += 18) {
    ctx.fillRect(24, y, y % 36 === 0 ? 185 : 155, 5);
  }

  // Mini schematic sketch
  ctx.strokeStyle = '#ea580c';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 224, 90, 65);
  ctx.beginPath();
  ctx.arc(69, 256, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Official stamp
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(142, 236, 86, 34);
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('VERIFIED', 156, 257);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function drawScreenCanvas(
  theme: ScreenTheme,
  accentHex: string,
  title: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  if (theme === 'whiteboard') {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 248);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(title, 22, 34);

    // Hand-drawn style orbital transfer ellipse
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(150, 145, 105, 58, -0.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(110, 145, 20, 0, Math.PI * 2);
    ctx.fill();

    // Rocket staging sketch on right
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 3;
    ctx.strokeRect(320, 66, 26, 130);
    ctx.beginPath();
    ctx.moveTo(320, 66);
    ctx.lineTo(333, 40);
    ctx.lineTo(346, 66);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '15px monospace';
    ctx.fillText('Δv = 9.4 km/s', 368, 92);
    ctx.fillText('Mass <= Margin', 368, 122);
    ctx.fillText('Budget: Locked', 368, 152);
    ctx.fillStyle = '#16a34a';
    ctx.fillText('GO · Target Orbit', 368, 188);
    return canvas;
  } else if (theme === 'schedule') {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 248);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(10, 10, 492, 34);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(title, 20, 32);

    // 10-Phase Gantt Bars
    for (let i = 0; i < 10; i++) {
      const y = 52 + i * 19;
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`PH-${String(i + 1).padStart(2, '0')}`, 18, y + 11);

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(72, y + 2, 418, 12);

      const barX = 72 + i * 36;
      const barW = i === 9 ? 58 : 74;
      ctx.fillStyle = i < 3 ? '#22c55e' : i < 6 ? '#38bdf8' : '#f97316';
      ctx.fillRect(barX, y + 2, barW, 12);
    }
    return canvas;
  } else if (theme === 'blueprint') {
    // Architectural rocket drafting blueprint on deep Prussian blue paper
    ctx.fillStyle = '#0a254d';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 512; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 0; y <= 256; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(12, 12, 488, 232);

    // Sideways rocket blueprint cross-section
    ctx.strokeStyle = '#e0f2fe';
    ctx.strokeRect(86, 98, 220, 56);
    ctx.beginPath();
    ctx.moveTo(306, 98);
    ctx.lineTo(368, 126);
    ctx.lineTo(306, 154);
    ctx.stroke();
    // Nozzle bell
    ctx.beginPath();
    ctx.moveTo(86, 108);
    ctx.lineTo(52, 92);
    ctx.lineTo(52, 160);
    ctx.lineTo(86, 144);
    ctx.stroke();

    // Dimension lines
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(52, 185);
    ctx.lineTo(368, 185);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(title, 24, 40);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('SCALE 1:20 · THRUST 7.6 MN · MASS ENVELOPE', 24, 222);
    return canvas;
  } else if (theme === 'specs') {
    // Specs panel received from Scientist
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 500, 244);

    ctx.fillStyle = '#14532d';
    ctx.fillRect(10, 10, 492, 44);
    ctx.fillStyle = '#dcfce7';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('SCIENCE PAYLOAD REQUIREMENTS', 22, 39);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '16px monospace';
    ctx.fillText('• PAYLOAD: Spectrometer + HD Optics', 26, 88);
    ctx.fillText('• ACCEL LIMIT: <= 4.2 G Vibration Cap', 26, 124);
    ctx.fillText('• INSERTION: Circular Orbit Alignment', 26, 160);
    ctx.fillStyle = '#fb923c';
    ctx.fillText('• ACTION: Validate Mass & Propulsion', 26, 204);
    return canvas;
  } else if (theme === 'molecule') {
    // Sterile laboratory poster: Molecular structure + spectrum
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 244);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(title, 22, 36);

    // Hexagon benzene-like molecular ring + bonds
    const cx = 135;
    const cy = 142;
    const r = 46;
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 3;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.fillStyle = i % 2 === 0 ? '#0284c7' : '#22c55e';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Emission spectrum bars on right
    const barColors = ['#6366f1', '#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#ef4444'];
    barColors.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(260 + i * 36, 75, 18, 120);
    });
    ctx.fillStyle = '#334155';
    ctx.font = '14px monospace';
    ctx.fillText('SPECTRAL BANDS 280 - 950 nm', 252, 225);
    return canvas;
  } else if (theme === 'orbitmap') {
    // NASA Orbital World Tracking Wall
    ctx.fillStyle = '#040b18';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, 502, 246);

    // Lat/lon grid
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.22)';
    ctx.lineWidth = 1;
    for (let x = 24; x < 490; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 42);
      ctx.lineTo(x, 224);
      ctx.stroke();
    }
    for (let y = 50; y < 224; y += 36) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(492, y);
      ctx.stroke();
    }

    // Stylized continents
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.ellipse(135, 110, 52, 34, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(295, 118, 66, 42, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(390, 175, 36, 22, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Sinusoidal orbital ground track
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let x = 22; x <= 490; x += 10) {
      const y = 136 + Math.sin((x - 22) * 0.025) * 64;
      if (x === 22) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Cape Canaveral pin
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(165, 112, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(title, 20, 30);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('CAPE CANAVERAL · INC 28.5° · LINK ACTIVE', 20, 240);
    return canvas;
  } else if (theme === 'servers') {
    // Server telemetry rack LED faceplate
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 256);
    for (let row = 0; row < 6; row++) {
      const y = 16 + row * 38;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(20, y, 472, 28);
      for (let led = 0; led < 14; led++) {
        ctx.fillStyle =
          (row + led) % 5 === 0
            ? '#38bdf8'
            : (row * 3 + led) % 7 === 0
              ? '#22c55e'
              : '#1e40af';
        ctx.beginPath();
        ctx.arc(42 + led * 30, y + 14, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return canvas;
  } else if (theme === 'comms') {
    ctx.fillStyle = '#061121';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 500, 244);

    ctx.fillStyle = accentHex;
    ctx.globalAlpha = 0.24;
    ctx.fillRect(10, 10, 492, 40);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(title, 22, 36);

    const rows = [
      ['SCIENCE -> SYSTEMS', 'Orbit 412 km · <= 4.2 G Limit'],
      ['FLIGHT OPS -> FINANCE', 'Prioritize Ka-Band & Escape'],
      ['FINANCE -> ALL CREW', 'Submit orders from Room PC'],
    ];
    rows.forEach(([hdr, body], i) => {
      const y = 74 + i * 56;
      ctx.fillStyle = '#0f1d34';
      ctx.fillRect(20, y, 472, 44);
      ctx.fillStyle = accentHex;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(hdr, 30, y + 18);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px sans-serif';
      ctx.fillText(body, 30, y + 36);
    });
    return canvas;
  }

  // Dark NASA telemetry monitor background
  ctx.fillStyle = '#060c18';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, 500, 244);

  ctx.fillStyle = accentHex;
  ctx.globalAlpha = 0.22;
  ctx.fillRect(10, 10, 492, 38);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(title.toUpperCase(), 22, 36);

  if (theme === 'cad') {
    // Rocket wireframe CAD blueprint
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 20; x < 240; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, 230);
      ctx.stroke();
    }
    for (let y = 60; y < 230; y += 22) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(240, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 3;
    ctx.strokeRect(108, 102, 42, 95);
    ctx.beginPath();
    ctx.moveTo(108, 102);
    ctx.lineTo(129, 68);
    ctx.lineTo(150, 102);
    ctx.stroke();
    // Nozzle bell
    ctx.beginPath();
    ctx.moveTo(116, 197);
    ctx.lineTo(106, 220);
    ctx.lineTo(152, 220);
    ctx.lineTo(142, 197);
    ctx.stroke();

    // Thrust curve on right
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 270; x <= 480; x += 12) {
      const t = (x - 270) / 210;
      const y = 205 - Math.sin(t * Math.PI) * 105;
      if (x === 270) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px monospace';
    ctx.fillText('THRUST: 7.6 MN · ISP: 452s', 265, 232);
  } else if (theme === 'finance') {
    // Budget bar chart & pie chart
    const bars = [135, 92, 118, 76, 148];
    bars.forEach((bh, i) => {
      const bx = 34 + i * 48;
      ctx.fillStyle = i % 2 === 0 ? '#eab308' : '#38bdf8';
      ctx.fillRect(bx, 218 - bh, 28, bh);
    });

    // Donut chart on right
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(388, 134, 48, 0, Math.PI * 1.3);
    ctx.stroke();
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(388, 134, 48, Math.PI * 1.3, Math.PI * 1.85);
    ctx.stroke();
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(388, 134, 48, Math.PI * 1.85, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('$100M CAP', 345, 140);
  } else if (theme === 'science') {
    // Spectral wavelength graph
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 26; x <= 290; x += 6) {
      const peak1 = Math.exp(-Math.pow((x - 110) / 14, 2)) * 95;
      const peak2 = Math.exp(-Math.pow((x - 205) / 18, 2)) * 120;
      const y = 210 - peak1 - peak2 - Math.sin(x * 0.4) * 6;
      if (x === 26) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Planetary scan grid
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(405, 138, 56, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(405, 138, 56, 22, 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(405, 138, 22, 56, 0.2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Flight / Orbit telemetry
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(138, 142, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#60a5fa';
    ctx.beginPath();
    ctx.ellipse(138, 142, 92, 44, -0.35, 0, Math.PI * 2);
    ctx.stroke();

    // Artificial horizon & telemetry bars
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(275, 70, 210, 120);
    ctx.beginPath();
    ctx.moveTo(275, 130);
    ctx.lineTo(485, 130);
    ctx.stroke();
    ctx.fillStyle = '#93c5fd';
    ctx.font = '15px monospace';
    ctx.fillText('APO: 412 km · INC: 28.5°', 274, 218);
  }

  return canvas;
}

export function createMaterialLibrary(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): SpaceMaterialLibrary {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const solarTex = createSolarTexture(maxAniso);
  const hazardTex = createHazardTexture(maxAniso);
  const steelGratingTex = createSteelGratingTexture(maxAniso);
  const facilityDeckTex = createAerospaceDeckTexture(maxAniso);
  const floorGridTex = createTechnicalFloorTexture(maxAniso);
  const wallEngTex = createIndustrialWallTexture(maxAniso);
  const wallSciTex = createScienceWallTexture(maxAniso);
  const floorSciTex = createScienceFloorTexture(maxAniso);
  const wallFinTex = createWoodWallTexture(maxAniso);
  const floorFinTex = createExecutiveCarpetTexture(maxAniso);
  const wallCtrlTex = createControlAcousticTexture(maxAniso);
  const floorCtrlTex = createControlFloorTexture(maxAniso);
  const grassTex = createTerrainGrassTexture(maxAniso);
  const asphaltTex = createAsphaltTexture(maxAniso);
  const oceanTex = createOceanTexture(maxAniso);
  const contactTex = createContactShadowTexture();

  // Moody R.E.P.O. retro-industrial dark concrete walls + specular concrete floors + weathered steel
  const cementOrangeTex = createCementWallTexture('#3a1c12', '#f97316', maxAniso);
  const cementYellowTex = createCementWallTexture('#362b12', '#eab308', maxAniso);
  const cementGreenTex = createCementWallTexture('#132d21', '#22c55e', maxAniso);
  const cementBlueTex = createCementWallTexture('#111f38', '#3b82f6', maxAniso);
  const cementSlateTex = createCementWallTexture('#1f2733', '#06b6d4', maxAniso);
  const hangarMetalTex = createHangarMetalTexture(maxAniso);
  const rocketMetalTex = createRocketMetallicTexture(maxAniso);
  const paperTex = createPaperDocumentTexture(maxAniso);

  const floorPolOrangeTex = createPolishedConcreteFloorTexture('#151211', '#1c1715', '#f97316', maxAniso);
  const floorPolYellowTex = createPolishedConcreteFloorTexture('#16140f', '#1d1a14', '#eab308', maxAniso);
  const floorPolGreenTex = createPolishedConcreteFloorTexture('#101816', '#15201d', '#22c55e', maxAniso);
  const floorPolBlueTex = createPolishedConcreteFloorTexture('#0d1320', '#121a2b', '#3b82f6', maxAniso);
  const floorPolSlateTex = createPolishedConcreteFloorTexture('#121721', '#181f2c', '#06b6d4', maxAniso);

  const hullWhite = new THREE.MeshStandardMaterial({
    color: 0xeff4fa,
    roughness: 0.34,
    metalness: 0.14,
  });

  const hullDark = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.62,
    metalness: 0.38,
  });

  const rocketMetallicHull = new THREE.MeshStandardMaterial({
    map: rocketMetalTex,
    roughness: 0.22,
    metalness: 0.88,
  });

  const rocketThermalTile = new THREE.MeshStandardMaterial({
    color: 0x262e3d,
    roughness: 0.48,
    metalness: 0.62,
  });

  const titanium = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.22,
    metalness: 0.9,
  });

  const brushedSteel = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.2,
    metalness: 0.92,
  });

  const copperNozzle = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.24,
    metalness: 0.88,
  });

  const goldKapton = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.2,
    metalness: 0.92,
  });

  const craneYellow = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.34,
    metalness: 0.55,
  });

  const solarCell = new THREE.MeshStandardMaterial({
    map: solarTex,
    roughness: 0.18,
    metalness: 0.68,
  });

  const ceramicHeatShield = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.72,
    metalness: 0.25,
  });

  const floorDeck = new THREE.MeshStandardMaterial({
    map: floorGridTex,
    roughness: 0.24,
    metalness: 0.36,
  });

  const floorScience = new THREE.MeshStandardMaterial({
    map: floorSciTex,
    roughness: 0.18,
    metalness: 0.2,
  });

  const floorFinance = new THREE.MeshStandardMaterial({
    map: floorFinTex,
    roughness: 0.72,
    metalness: 0.08,
  });

  const floorControl = new THREE.MeshStandardMaterial({
    map: floorCtrlTex,
    roughness: 0.26,
    metalness: 0.34,
  });

  const floorPolishedOrange = new THREE.MeshStandardMaterial({
    map: floorPolOrangeTex,
    roughness: 0.18,
    metalness: 0.26,
  });

  const floorPolishedYellow = new THREE.MeshStandardMaterial({
    map: floorPolYellowTex,
    roughness: 0.18,
    metalness: 0.26,
  });

  const floorPolishedGreen = new THREE.MeshStandardMaterial({
    map: floorPolGreenTex,
    roughness: 0.16,
    metalness: 0.24,
  });

  const floorPolishedBlue = new THREE.MeshStandardMaterial({
    map: floorPolBlueTex,
    roughness: 0.18,
    metalness: 0.26,
  });

  const floorPolishedSlate = new THREE.MeshStandardMaterial({
    map: floorPolSlateTex,
    roughness: 0.18,
    metalness: 0.26,
  });

  const mezzFloor = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.42,
    metalness: 0.65,
  });

  const rampSurface = new THREE.MeshStandardMaterial({
    map: steelGratingTex,
    roughness: 0.3,
    metalness: 0.8,
  });

  const facilityDeck = new THREE.MeshStandardMaterial({
    map: facilityDeckTex,
    roughness: 0.35,
    metalness: 0.7,
  });

  const wallSlate = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.58,
    metalness: 0.14,
  });

  const wallEngineering = new THREE.MeshStandardMaterial({
    map: wallEngTex,
    roughness: 0.46,
    metalness: 0.48,
  });

  const wallScience = new THREE.MeshStandardMaterial({
    map: wallSciTex,
    roughness: 0.32,
    metalness: 0.08,
  });

  const wallFinance = new THREE.MeshStandardMaterial({
    map: wallFinTex,
    roughness: 0.52,
    metalness: 0.08,
  });

  const wallControl = new THREE.MeshStandardMaterial({
    map: wallCtrlTex,
    roughness: 0.85,
    metalness: 0.12,
  });

  const wallCementOrange = new THREE.MeshStandardMaterial({
    map: cementOrangeTex,
    roughness: 0.86,
    metalness: 0.06,
  });

  const wallCementYellow = new THREE.MeshStandardMaterial({
    map: cementYellowTex,
    roughness: 0.86,
    metalness: 0.06,
  });

  const wallCementGreen = new THREE.MeshStandardMaterial({
    map: cementGreenTex,
    roughness: 0.84,
    metalness: 0.06,
  });

  const wallCementBlue = new THREE.MeshStandardMaterial({
    map: cementBlueTex,
    roughness: 0.86,
    metalness: 0.08,
  });

  const wallCementSlate = new THREE.MeshStandardMaterial({
    map: cementSlateTex,
    roughness: 0.84,
    metalness: 0.08,
  });

  const wallHangarMetal = new THREE.MeshStandardMaterial({
    map: hangarMetalTex,
    roughness: 0.38,
    metalness: 0.78,
  });

  const wallTrim = new THREE.MeshStandardMaterial({
    color: 0x263142,
    roughness: 0.34,
    metalness: 0.78,
  });

  const woodTable = new THREE.MeshStandardMaterial({
    map: wallFinTex,
    roughness: 0.42,
    metalness: 0.1,
  });

  const ceilingAcoustic = new THREE.MeshStandardMaterial({
    color: 0x0b101b,
    roughness: 0.85,
    metalness: 0.22,
  });

  const glassPanel = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.08,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.74,
    transparent: true,
    opacity: isSoftwareGl ? 0.36 : 0.86,
    ior: 1.5,
    thickness: 0.35,
    depthWrite: false,
  });

  const hazardFloor = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.75,
    metalness: 0.18,
  });

  const corridorFloor = new THREE.MeshStandardMaterial({
    color: 0x243144,
    roughness: 0.52,
    metalness: 0.35,
  });

  const terrainGrass = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 0.92,
    metalness: 0.02,
  });

  const sandBeach = new THREE.MeshStandardMaterial({
    color: 0xd6c297,
    roughness: 0.9,
    metalness: 0.02,
  });

  const oceanWater = new THREE.MeshStandardMaterial({
    map: oceanTex,
    roughness: 0.16,
    metalness: 0.32,
  });

  const asphaltRoad = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.85,
    metalness: 0.05,
  });

  const concretePad = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.86,
    metalness: 0.06,
  });

  const foliageGreen = new THREE.MeshStandardMaterial({
    color: 0x2f6b32,
    roughness: 0.78,
    metalness: 0.04,
  });

  const trunkBrown = new THREE.MeshStandardMaterial({
    color: 0x6b4c35,
    roughness: 0.88,
    metalness: 0.02,
  });

  const fabricCharcoal = new THREE.MeshStandardMaterial({
    color: 0x1e2533,
    roughness: 0.85,
    metalness: 0.05,
  });

  const fabricExecutive = new THREE.MeshStandardMaterial({
    color: 0x472d20,
    roughness: 0.75,
    metalness: 0.06,
  });

  const paperReport = new THREE.MeshStandardMaterial({
    map: paperTex,
    roughness: 0.78,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const holoGlow = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.82,
    wireframe: true,
  });

  const exhaustFlame = new THREE.MeshBasicMaterial({
    color: 0xfb923c,
    transparent: true,
    opacity: 0.9,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: contactTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.65,
  });

  const weatheredSteel = new THREE.MeshStandardMaterial({
    color: 0x1a2230,
    roughness: 0.44,
    metalness: 0.82,
  });

  const heavyCableDark = new THREE.MeshStandardMaterial({
    color: 0x0f131b,
    roughness: 0.74,
    metalness: 0.14,
  });

  const repoVisorGlass = new THREE.MeshStandardMaterial({
    color: 0x060b14,
    roughness: 0.1,
    metalness: 0.72,
  });

  const repoJointRubber = new THREE.MeshStandardMaterial({
    color: 0x171d29,
    roughness: 0.82,
    metalness: 0.12,
  });

  const dynamicMaterials: THREE.Material[] = [];
  const dynamicTextures: THREE.Texture[] = [];

  function createScreenMaterial(
    theme: ScreenTheme,
    accentHex: string,
    title: string,
  ): THREE.MeshStandardMaterial {
    const canvas = drawScreenCanvas(theme, accentHex, title);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    dynamicTextures.push(tex);

    const isMattePrint =
      theme === 'whiteboard' ||
      theme === 'blueprint' ||
      theme === 'molecule' ||
      theme === 'schedule' ||
      theme === 'paper';
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: isMattePrint ? new THREE.Color(0x000000) : new THREE.Color(accentHex),
      emissiveMap: isMattePrint ? null : tex,
      emissiveIntensity: isMattePrint ? 0 : 0.72,
      roughness: isMattePrint ? 0.38 : 0.16,
      metalness: 0.06,
    });
    dynamicMaterials.push(mat);
    return mat;
  }

  const allMaterials: THREE.Material[] = [
    hullWhite,
    hullDark,
    rocketMetallicHull,
    rocketThermalTile,
    titanium,
    brushedSteel,
    copperNozzle,
    goldKapton,
    craneYellow,
    solarCell,
    ceramicHeatShield,
    floorDeck,
    floorScience,
    floorFinance,
    floorControl,
    floorPolishedOrange,
    floorPolishedYellow,
    floorPolishedGreen,
    floorPolishedBlue,
    floorPolishedSlate,
    mezzFloor,
    rampSurface,
    facilityDeck,
    wallSlate,
    wallEngineering,
    wallScience,
    wallFinance,
    wallControl,
    wallCementOrange,
    wallCementYellow,
    wallCementGreen,
    wallCementBlue,
    wallCementSlate,
    wallHangarMetal,
    wallTrim,
    woodTable,
    ceilingAcoustic,
    glassPanel,
    hazardFloor,
    corridorFloor,
    terrainGrass,
    sandBeach,
    oceanWater,
    asphaltRoad,
    concretePad,
    foliageGreen,
    trunkBrown,
    fabricCharcoal,
    fabricExecutive,
    paperReport,
    holoGlow,
    exhaustFlame,
    contactShadow,
    weatheredSteel,
    heavyCableDark,
    repoVisorGlass,
    repoJointRubber,
  ];

  const allTextures: THREE.Texture[] = [
    solarTex,
    hazardTex,
    steelGratingTex,
    facilityDeckTex,
    floorGridTex,
    wallEngTex,
    wallSciTex,
    floorSciTex,
    wallFinTex,
    floorFinTex,
    wallCtrlTex,
    floorCtrlTex,
    grassTex,
    asphaltTex,
    oceanTex,
    contactTex,
    cementOrangeTex,
    cementYellowTex,
    cementGreenTex,
    cementBlueTex,
    cementSlateTex,
    hangarMetalTex,
    rocketMetalTex,
    paperTex,
    floorPolOrangeTex,
    floorPolYellowTex,
    floorPolGreenTex,
    floorPolBlueTex,
    floorPolSlateTex,
  ];

  return {
    hullWhite,
    hullDark,
    rocketMetallicHull,
    rocketThermalTile,
    titanium,
    brushedSteel,
    copperNozzle,
    goldKapton,
    craneYellow,
    solarCell,
    ceramicHeatShield,
    floorDeck,
    floorScience,
    floorFinance,
    floorControl,
    floorPolishedOrange,
    floorPolishedYellow,
    floorPolishedGreen,
    floorPolishedBlue,
    floorPolishedSlate,
    mezzFloor,
    rampSurface,
    facilityDeck,
    wallSlate,
    wallEngineering,
    wallScience,
    wallFinance,
    wallControl,
    wallCementOrange,
    wallCementYellow,
    wallCementGreen,
    wallCementBlue,
    wallCementSlate,
    wallHangarMetal,
    wallTrim,
    woodTable,
    ceilingAcoustic,
    glassPanel,
    hazardFloor,
    corridorFloor,
    terrainGrass,
    sandBeach,
    oceanWater,
    asphaltRoad,
    concretePad,
    foliageGreen,
    trunkBrown,
    fabricCharcoal,
    fabricExecutive,
    paperReport,
    holoGlow,
    exhaustFlame,
    contactShadow,
    weatheredSteel,
    heavyCableDark,
    repoVisorGlass,
    repoJointRubber,
    createScreenMaterial,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
      dynamicMaterials.forEach((m) => m.dispose());
      dynamicTextures.forEach((t) => t.dispose());
    },
  };
}
