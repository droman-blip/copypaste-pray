import * as THREE from 'three';
import { CARGO_MODULES, HANGAR_ASSEMBLY_PAD_POS } from '../data/missionData';
import type { CargoModuleDef } from '../types/mission';
import { makeAccentMat, makeRoundedRectShape } from './furnitureBuilder';
import type { SpaceMaterialLibrary } from './materials';

export interface CargoObject3D {
  def: CargoModuleDef;
  group: THREE.Group;
  visualGroup: THREE.Group;
  integrityMat: THREE.MeshStandardMaterial;
  beaconMat: THREE.MeshStandardMaterial;
  hitProxy: THREE.Mesh;
  // Physics state in world coordinates
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  angularVel: THREE.Vector3;
  integrity: number;
  delivered: boolean;
  riskPenaltyPct: number;
  floorY: number;
}

export interface HangarAssemblyPad3D {
  group: THREE.Group;
  ringMat: THREE.MeshStandardMaterial;
  slotMats: THREE.MeshStandardMaterial[];
  centerWorld: THREE.Vector3;
}

export interface TractorBeamVisual {
  group: THREE.Group;
  beamMesh: THREE.Mesh;
  coreBeamMesh: THREE.Mesh;
  haloRing: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial;
  update: (
    active: boolean,
    startWorld: THREE.Vector3,
    endWorld: THREE.Vector3,
    time: number,
    integrityPct: number,
  ) => void;
}

export interface ImpactSparkPool {
  group: THREE.Group;
  trigger: (worldPos: THREE.Vector3, intensity: number) => void;
  update: (delta: number) => void;
}

function buildCargoMeshByVariant(
  def: CargoModuleDef,
  mats: SpaceMaterialLibrary,
  integrityMat: THREE.MeshStandardMaterial,
  beaconMat: THREE.MeshStandardMaterial,
): THREE.Group {
  const g = new THREE.Group();
  const accentMat = makeAccentMat(def.accentHex, 0.35);

  if (def.variant === 'cryo-cell') {
    // Pressurized Cryogenic Fuel Cell: twin horizontal titanium cylinders in hazard cradle + copper manifold
    const baseShape = makeRoundedRectShape(0.74, 0.56, 0.08);
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    baseGeo.rotateX(Math.PI / 2);
    baseGeo.center();
    const skid = new THREE.Mesh(baseGeo, mats.weatheredSteel);
    skid.position.y = 0.05;
    skid.castShadow = true;
    g.add(skid);

    for (const zOff of [-0.13, 0.13]) {
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.44, 6, 12), mats.brushedSteel);
      tank.rotation.z = Math.PI / 2;
      tank.position.set(0, 0.25, zOff);
      tank.castShadow = true;
      g.add(tank);

      const band = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 14), accentMat);
      band.rotation.y = Math.PI / 2;
      band.position.set(0, 0.25, zOff);
      g.add(band);
    }

    const manifold = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.024, 6, 14), mats.copperNozzle);
    manifold.position.set(0, 0.34, 0);
    g.add(manifold);

    const statusBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.38, 4, 8), integrityMat);
    statusBar.rotation.z = Math.PI / 2;
    statusBar.position.set(0, 0.43, 0.16);
    g.add(statusBar);
  } else if (def.variant === 'thermal-crate') {
    // Ablative Thermal Shield Tile Pack: chamfered dark ceramic crate with hazard ribs & handle loops
    const crateShape = makeRoundedRectShape(0.76, 0.58, 0.07);
    const crateGeo = new THREE.ExtrudeGeometry(crateShape, {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    crateGeo.rotateX(Math.PI / 2);
    crateGeo.center();
    const crate = new THREE.Mesh(crateGeo, mats.rocketThermalTile);
    crate.position.y = 0.25;
    crate.castShadow = true;
    g.add(crate);

    // Ceramic tile grid top relief
    for (const xOff of [-0.19, 0.19]) {
      const tile = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.14, 0.06, 6),
        mats.ceramicHeatShield,
      );
      tile.position.set(xOff, 0.49, 0);
      g.add(tile);
    }

    const trimBand = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 6, 16), accentMat);
    trimBand.rotation.x = Math.PI / 2;
    trimBand.position.y = 0.28;
    g.add(trimBand);

    const statusBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.44, 4, 8), integrityMat);
    statusBar.rotation.z = Math.PI / 2;
    statusBar.position.set(0, 0.36, 0.31);
    g.add(statusBar);
  } else if (def.variant === 'budget-case') {
    // Encrypted Budget Case: armored briefcase/strongbox with gold security latches & antenna beacon
    const caseShape = makeRoundedRectShape(0.68, 0.48, 0.06);
    const caseGeo = new THREE.ExtrudeGeometry(caseShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    caseGeo.rotateX(Math.PI / 2);
    caseGeo.center();
    const body = new THREE.Mesh(caseGeo, mats.weatheredSteel);
    body.position.y = 0.19;
    body.castShadow = true;
    g.add(body);

    for (const xOff of [-0.18, 0.18]) {
      const latch = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.1, 4, 8), mats.goldKapton);
      latch.position.set(xOff, 0.22, 0.25);
      g.add(latch);
    }

    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI),
      mats.brushedSteel,
    );
    handle.position.set(0, 0.35, 0);
    g.add(handle);

    const statusBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.34, 4, 8), integrityMat);
    statusBar.rotation.z = Math.PI / 2;
    statusBar.position.set(0, 0.35, 0.15);
    g.add(statusBar);
  } else if (def.variant === 'sample-canister') {
    // Sealed Lunar Sample Canister: vertical glowing green cryo-chamber inside protective cage
    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.1, 16), mats.weatheredSteel);
    baseRing.position.y = 0.06;
    baseRing.castShadow = true;
    g.add(baseRing);

    const coreTank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.48, 16), integrityMat);
    coreTank.position.y = 0.35;
    g.add(coreTank);

    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.11, 16), mats.brushedSteel);
    topCap.position.y = 0.62;
    topCap.castShadow = true;
    g.add(topCap);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.56, 8), mats.titanium);
      strut.position.set(Math.cos(a) * 0.23, 0.34, Math.sin(a) * 0.23);
      g.add(strut);
    }
  } else {
    // Avionics Guidance Core: octagonal gyro unit with gimbal ring & blue optic sensor dome
    const chassis = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.28, 8), mats.weatheredSteel);
    chassis.position.y = 0.16;
    chassis.castShadow = true;
    g.add(chassis);

    const gyroRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.032, 8, 18), accentMat);
    gyroRing.rotation.x = Math.PI / 2;
    gyroRing.position.y = 0.32;
    g.add(gyroRing);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), mats.brushedSteel);
    dome.position.y = 0.36;
    g.add(dome);

    const statusBar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 6, 16), integrityMat);
    statusBar.rotation.x = Math.PI / 2;
    statusBar.position.y = 0.42;
    g.add(statusBar);
  }

  // Top tractor-beam lock beacon on all cargo
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), beaconMat);
  beacon.position.y = def.variant === 'sample-canister' ? 0.72 : 0.56;
  g.add(beacon);

  return g;
}

export function buildCargoObjects(mats: SpaceMaterialLibrary): Record<string, CargoObject3D> {
  const result: Record<string, CargoObject3D> = {};

  for (const def of CARGO_MODULES) {
    const group = new THREE.Group();
    group.name = `Cargo_${def.id}`;

    const integrityMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: new THREE.Color(0x22c55e),
      emissiveIntensity: 1.1,
      roughness: 0.25,
    });

    const beaconMat = new THREE.MeshStandardMaterial({
      color: def.accentNumber,
      emissive: new THREE.Color(def.accentNumber),
      emissiveIntensity: 1.35,
      roughness: 0.2,
    });

    // Subtle ground contact shadow disc
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), mats.contactShadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    group.add(shadow);

    const visualGroup = buildCargoMeshByVariant(def, mats, integrityMat, beaconMat);
    group.add(visualGroup);

    // Raycast hit proxy on layer 1 (only checked by tractor beam / aim raycaster)
    const hitProxy = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius * 1.35, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitProxy.position.y = 0.32;
    hitProxy.userData.cargoId = def.id;
    hitProxy.layers.set(1);
    group.add(hitProxy);

    result[def.id] = {
      def,
      group,
      visualGroup,
      integrityMat,
      beaconMat,
      hitProxy,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      angularVel: new THREE.Vector3(),
      integrity: 100,
      delivered: false,
      riskPenaltyPct: 0,
      floorY: def.spawnLocalPos[1],
    };
  }

  return result;
}

export function buildHangarAssemblyPad(mats: SpaceMaterialLibrary): HangarAssemblyPad3D {
  const group = new THREE.Group();
  const [px, py, pz] = HANGAR_ASSEMBLY_PAD_POS;
  group.position.set(px, py, pz);

  // Heavy circular steel apron platform
  const baseDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 2.55, 0.14, 28),
    mats.weatheredSteel,
  );
  baseDisc.position.y = 0.07;
  baseDisc.receiveShadow = true;
  group.add(baseDisc);

  const hazardTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.34, 0.06, 28),
    mats.hazardFloor,
  );
  hazardTrim.position.y = 0.14;
  group.add(hazardTrim);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: new THREE.Color(0x38bdf8),
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.045, 8, 36), ringMat);
  glowRing.rotation.x = Math.PI / 2;
  glowRing.position.y = 0.18;
  group.add(glowRing);

  // 5 magnetic cargo dock slots
  const slotMats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < CARGO_MODULES.length; i++) {
    const def = CARGO_MODULES[i];
    const slotMat = new THREE.MeshStandardMaterial({
      color: def.accentNumber,
      emissive: new THREE.Color(def.accentNumber),
      emissiveIntensity: 0.45,
      roughness: 0.35,
    });
    slotMats.push(slotMat);

    const slotPad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.04, 16), slotMat);
    slotPad.position.set(def.padSlotOffset[0], 0.17, def.padSlotOffset[2]);
    group.add(slotPad);
  }

  return {
    group,
    ringMat,
    slotMats,
    centerWorld: new THREE.Vector3(px, py, pz),
  };
}

export function buildTractorBeamEffect(): TractorBeamVisual {
  const group = new THREE.Group();
  group.visible = false;

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfb923c,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Unit-height cylinders oriented along +Y, scaled & oriented dynamically
  const beamGeo = new THREE.CylinderGeometry(0.055, 0.025, 1, 10, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);

  const coreGeo = new THREE.CylinderGeometry(0.018, 0.012, 1, 8, 1, true);
  coreGeo.translate(0, 0.5, 0);
  const coreBeamMesh = new THREE.Mesh(coreGeo, coreMat);

  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.026, 8, 24), haloMat);
  haloRing.rotation.x = Math.PI / 2;

  group.add(beamMesh);
  group.add(coreBeamMesh);
  group.add(haloRing);

  const _dir = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _quat = new THREE.Quaternion();

  function update(
    active: boolean,
    startWorld: THREE.Vector3,
    endWorld: THREE.Vector3,
    time: number,
    integrityPct: number,
  ) {
    group.visible = active;
    if (!active) return;

    _dir.subVectors(endWorld, startWorld);
    const dist = Math.max(0.05, _dir.length());
    _dir.normalize();
    _quat.setFromUnitVectors(_up, _dir);

    beamMesh.position.copy(startWorld);
    beamMesh.quaternion.copy(_quat);
    const pulse = 1 + Math.sin(time * 24) * 0.22;
    beamMesh.scale.set(pulse, dist, pulse);

    coreBeamMesh.position.copy(startWorld);
    coreBeamMesh.quaternion.copy(_quat);
    coreBeamMesh.scale.set(1, dist, 1);

    haloRing.position.copy(endWorld);
    haloRing.rotation.z = time * 2.8;
    haloRing.rotation.x = Math.PI / 2 + Math.sin(time * 5.2) * 0.16;

    // Color shifts toward hot warning orange/red if cargo integrity is low
    if (integrityPct < 45) {
      beamMat.color.setHex(0xf97316);
      haloMat.color.setHex(0xef4444);
    } else {
      beamMat.color.setHex(0x22d3ee);
      haloMat.color.setHex(0x38bdf8);
    }
    beamMat.opacity = 0.36 + Math.sin(time * 20) * 0.12;
  }

  return {
    group,
    beamMesh,
    coreBeamMesh,
    haloRing,
    beamMat,
    coreMat,
    haloMat,
    update,
  };
}

export function buildImpactSparkPool(): ImpactSparkPool {
  const group = new THREE.Group();
  const COUNT = 18;
  const sparks: Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
  }> = [];

  const sparkGeo = new THREE.SphereGeometry(0.045, 6, 6);
  for (let i = 0; i < COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xfbbf24 : 0xf97316,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(sparkGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    sparks.push({
      mesh,
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 0.45,
    });
  }

  function trigger(worldPos: THREE.Vector3, intensity: number) {
    const count = Math.min(COUNT, Math.max(6, Math.round(intensity * COUNT)));
    for (let i = 0; i < count; i++) {
      const s = sparks[i];
      s.mesh.position.copy(worldPos);
      s.mesh.visible = true;
      s.vel.set(
        (Math.random() - 0.5) * 5.5 * intensity,
        1.5 + Math.random() * 4.2 * intensity,
        (Math.random() - 0.5) * 5.5 * intensity,
      );
      s.maxLife = 0.28 + Math.random() * 0.28;
      s.life = s.maxLife;
    }
  }

  function update(delta: number) {
    for (let i = 0; i < COUNT; i++) {
      const s = sparks[i];
      if (s.life <= 0) {
        if (s.mesh.visible) s.mesh.visible = false;
        continue;
      }
      s.life -= delta;
      if (s.life <= 0) {
        s.mesh.visible = false;
        continue;
      }
      s.vel.y -= 11 * delta;
      s.mesh.position.addScaledVector(s.vel, delta);
      const ratio = s.life / s.maxLife;
      s.mesh.scale.setScalar(0.5 + ratio * 0.8);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = ratio;
    }
  }

  return { group, trigger, update };
}
