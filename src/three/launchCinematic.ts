import * as THREE from 'three';
import type {
  DifficultyId,
  LaunchFailureMode,
  LaunchTelemetrySnapshot,
} from '../types/mission';
import { LAUNCH_CINEMATIC_DURATIONS } from '../data/missionData';
import type { SpaceMaterialLibrary } from './materials';
import type { RocketAssembly } from './rocketBuilder';

const Y_ORBIT = 165;
const SPLASHDOWN_X = 128;
const SPLASHDOWN_Y = -0.2;
const SPLASHDOWN_Z = 0;

// Pre-allocated math helpers (Zero GC in render loop)
const _skyCoastal = new THREE.Color(0x93c5fd);
const _skyStrato = new THREE.Color(0x0b1636);
const _skySpace = new THREE.Color(0x02040a);
const _fogCoastal = new THREE.Color(0xbae6fd);
const _fogMars = new THREE.Color(0x451a12);
const _tmpColor = new THREE.Color();
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _rocketWorld = new THREE.Vector3();
const _targetBodyWorld = new THREE.Vector3();

function formatMissionClock(flightSec: number): string {
  const sign = flightSec < 0 ? '-' : '+';
  const abs = Math.abs(Math.round(flightSec));
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  return `T${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface LaunchCinematicRig {
  root: THREE.Group;
  setActive: (active: boolean, difficulty: DifficultyId, mode?: LaunchFailureMode) => void;
  update: (
    elapsed: number,
    delta: number,
    mode: LaunchFailureMode,
    difficulty: DifficultyId,
    camera: THREE.PerspectiveCamera,
    rocket: RocketAssembly,
    gantryArm: THREE.Group,
    scene: THREE.Scene,
    skyDome: THREE.Mesh | null,
  ) => LaunchTelemetrySnapshot;
  updateOpeningLiftoff: (
    elapsed: number,
    delta: number,
    difficulty: DifficultyId,
    camera: THREE.PerspectiveCamera,
    rocket: RocketAssembly,
    gantryArm: THREE.Group,
    scene: THREE.Scene,
    skyDome: THREE.Mesh | null,
  ) => void;
}

export function createLaunchCinematicRig(mats: SpaceMaterialLibrary): LaunchCinematicRig {
  const root = new THREE.Group();
  root.name = 'LaunchCinematicFXRoot';
  root.visible = false;

  // === 1. STARFIELD FOR HIGH-ALTITUDE / ORBITAL ACTS ===
  const starCount = 260;
  const starGeo = new THREE.SphereGeometry(0.28, 6, 6);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const starsMesh = new THREE.InstancedMesh(starGeo, starMat, starCount);
  starsMesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < starCount; i++) {
    const theta = (i * 2.399963) % (Math.PI * 2);
    const radius = 58 + (i % 9) * 14;
    const height = Y_ORBIT - 55 + ((i * 37) % 140);
    dummy.position.set(
      Math.cos(theta) * radius,
      height,
      Math.sin(theta) * radius - 16,
    );
    const s = 0.45 + (i % 5) * 0.25;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    starsMesh.setMatrixAt(i, dummy.matrix);
  }
  starsMesh.instanceMatrix.needsUpdate = true;
  starsMesh.computeBoundingSphere();
  root.add(starsMesh);

  // === 2. ORBITAL & DEEP SPACE TARGET STAGING (Earth Curvature, Moon, Mars) ===
  const orbitalStage = new THREE.Group();
  orbitalStage.position.set(0, Y_ORBIT, -20);
  root.add(orbitalStage);

  // Large curved Earth horizon underneath LEO orbit
  const curvedEarth = new THREE.Mesh(
    new THREE.SphereGeometry(48, 36, 24),
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x075985,
      emissiveIntensity: 0.35,
      roughness: 0.45,
      metalness: 0.1,
    }),
  );
  curvedEarth.position.set(0, -56, -4);
  orbitalStage.add(curvedEarth);

  const earthAtmoRing = new THREE.Mesh(
    new THREE.TorusGeometry(48.3, 0.45, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.45 }),
  );
  earthAtmoRing.position.copy(curvedEarth.position);
  orbitalStage.add(earthAtmoRing);

  // Target: Earth Orbit Station Beacon Ring
  const targetEarthGroup = new THREE.Group();
  targetEarthGroup.position.set(0, 6, -6);
  const leoStationRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.8, 0.2, 10, 32),
    mats.titanium,
  );
  const leoStationHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 3.2, 14),
    mats.hullWhite,
  );
  leoStationHub.rotation.z = Math.PI / 2;
  const leoStationSolar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 6.2, 8),
    mats.goldKapton,
  );
  targetEarthGroup.add(leoStationRing, leoStationHub, leoStationSolar);
  orbitalStage.add(targetEarthGroup);

  // Target: The Moon (Sphere + Crater Rings + Landing Surface)
  const targetMoonGroup = new THREE.Group();
  targetMoonGroup.position.set(0, -2, -10);
  const moonSphere = new THREE.Mesh(
    new THREE.SphereGeometry(12.5, 32, 24),
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.88,
      metalness: 0.05,
    }),
  );
  moonSphere.position.set(0, -12.5, 0);
  targetMoonGroup.add(moonSphere);

  const moonCraterMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.92,
  });
  for (const [cx, cz, r] of [
    [-3.2, 2.4, 1.8],
    [4.1, -1.6, 2.2],
    [0.8, 4.4, 1.4],
    [-4.8, -3.2, 1.5],
  ]) {
    const cr = new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 8, 18), moonCraterMat);
    cr.rotation.x = Math.PI / 2;
    cr.position.set(cx, -0.35, cz);
    targetMoonGroup.add(cr);
  }
  const moonPadRing = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.85, 24),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }),
  );
  moonPadRing.rotation.x = -Math.PI / 2;
  moonPadRing.position.set(0, 0.06, 0);
  targetMoonGroup.add(moonPadRing);
  orbitalStage.add(targetMoonGroup);

  // Target: Mars (Rust-Red Planet + Ice Caps + Landing Surface)
  const targetMarsGroup = new THREE.Group();
  targetMarsGroup.position.set(0, -2, -10);
  const marsSphere = new THREE.Mesh(
    new THREE.SphereGeometry(12.5, 32, 24),
    new THREE.MeshStandardMaterial({
      color: 0xc2410c,
      emissive: 0x431407,
      emissiveIntensity: 0.25,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  marsSphere.position.set(0, -12.5, 0);
  targetMarsGroup.add(marsSphere);

  const marsRockMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.9,
  });
  for (const [rx, rz, rr] of [
    [-3.5, 2.1, 1.1],
    [3.8, -2.2, 1.4],
    [-1.4, -4.0, 0.9],
  ]) {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(rr, 0), marsRockMat);
    boulder.scale.set(1.2, 0.55, 1.0);
    boulder.position.set(rx, -0.1, rz);
    targetMarsGroup.add(boulder);
  }
  const marsPadRing = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.85, 24),
    new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide }),
  );
  marsPadRing.rotation.x = -Math.PI / 2;
  marsPadRing.position.set(0, 0.06, 0);
  targetMarsGroup.add(marsPadRing);
  orbitalStage.add(targetMarsGroup);

  // === 3. OCEAN SPLASHDOWN ZONE (Phase 10 Act 5) ===
  const splashdownGroup = new THREE.Group();
  splashdownGroup.position.set(SPLASHDOWN_X, SPLASHDOWN_Y + 0.08, SPLASHDOWN_Z);
  splashdownGroup.visible = false;
  root.add(splashdownGroup);

  const splashRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const rMesh = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 28), ringMat);
    rMesh.rotation.x = -Math.PI / 2;
    splashdownGroup.add(rMesh);
    splashRings.push(rMesh);
  }

  // === 4. PAD SMOKE, CRYO VAPOR, SPARKS, FIREBALL & DEBRIS POOLS ===
  const smokeMeshes: THREE.Mesh[] = [];
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.95,
    transparent: true,
    opacity: 0.82,
  });
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), smokeMat);
    m.visible = false;
    root.add(m);
    smokeMeshes.push(m);
  }

  const fireMeshes: THREE.Mesh[] = [];
  const fireMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.9,
  });
  for (let i = 0; i < 16; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), fireMat);
    f.visible = false;
    root.add(f);
    fireMeshes.push(f);
  }

  const sparkMeshes: THREE.Mesh[] = [];
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  for (let i = 0; i < 20; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), sparkMat);
    s.visible = false;
    root.add(s);
    sparkMeshes.push(s);
  }

  const debrisMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.36, 0.72, 6),
      i % 2 === 0 ? mats.rocketThermalTile : mats.brushedSteel,
    );
    d.visible = false;
    root.add(d);
    debrisMeshes.push(d);
  }

  function hideAllFX() {
    smokeMeshes.forEach((m) => (m.visible = false));
    fireMeshes.forEach((m) => (m.visible = false));
    sparkMeshes.forEach((m) => (m.visible = false));
    debrisMeshes.forEach((m) => (m.visible = false));
    splashdownGroup.visible = false;
    orbitalStage.visible = false;
    starsMesh.visible = false;
  }

  function setActive(active: boolean, difficulty: DifficultyId) {
    root.visible = active;
    if (!active) {
      hideAllFX();
      return;
    }
    targetEarthGroup.visible = difficulty === 'easy';
    targetMoonGroup.visible = difficulty === 'medium';
    targetMarsGroup.visible = difficulty === 'hard';
  }

  function updatePadSmoke(
    originX: number,
    originY: number,
    originZ: number,
    t: number,
    intensity: number,
    darkMode: boolean,
    spreadScale = 1,
  ) {
    smokeMat.color.setHex(darkMode ? 0x171c26 : 0xf1f5f9);
    smokeMat.opacity = darkMode ? 0.88 : 0.68;
    for (let i = 0; i < smokeMeshes.length; i++) {
      const m = smokeMeshes[i];
      if (intensity <= 0.01) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const phase = ((t * 1.45 + i * 0.19) % 1);
      const angle = (i / smokeMeshes.length) * Math.PI * 2 + i * 0.7;
      const rad = (0.8 + phase * 6.5) * spreadScale * intensity;
      m.position.set(
        originX + Math.cos(angle) * rad,
        originY + phase * 3.8 * spreadScale + Math.sin(i) * 0.4,
        originZ + Math.sin(angle) * rad,
      );
      const s = (0.45 + phase * 1.9) * spreadScale * intensity;
      m.scale.setScalar(s);
    }
  }

  function updateSparks(
    originX: number,
    originY: number,
    originZ: number,
    t: number,
    intensity: number,
  ) {
    for (let i = 0; i < sparkMeshes.length; i++) {
      const s = sparkMeshes[i];
      if (intensity <= 0.01) {
        s.visible = false;
        continue;
      }
      s.visible = true;
      const life = ((t * 2.8 + i * 0.13) % 1);
      const a = i * 1.73 + Math.floor(t * 2.8) * 0.5;
      const speed = 3.2 + (i % 5) * 1.4;
      s.position.set(
        originX + Math.cos(a) * life * speed,
        originY + life * (3.5 - life * 4.2) + 0.5,
        originZ + Math.sin(a) * life * speed,
      );
      s.scale.setScalar((1 - life * 0.7) * intensity);
    }
  }

  function updateFireball(
    originX: number,
    originY: number,
    originZ: number,
    localT: number,
    radiusScale: number,
  ) {
    const grow = THREE.MathUtils.clamp(localT * 1.8, 0.05, 1.35);
    fireMat.opacity = THREE.MathUtils.clamp(1.15 - localT * 0.28, 0, 0.92);
    for (let i = 0; i < fireMeshes.length; i++) {
      const f = fireMeshes[i];
      f.visible = fireMat.opacity > 0.04;
      const a = (i / fireMeshes.length) * Math.PI * 2;
      const r = (i % 3) * 0.95 * grow;
      f.position.set(
        originX + Math.cos(a) * r,
        originY + (i % 4) * 0.75 * grow,
        originZ + Math.sin(a) * r,
      );
      f.scale.setScalar((0.8 + (i % 3) * 0.45) * grow * radiusScale);
    }
  }

  function updateDebris(
    originX: number,
    originY: number,
    originZ: number,
    localT: number,
  ) {
    for (let i = 0; i < debrisMeshes.length; i++) {
      const d = debrisMeshes[i];
      d.visible = localT > 0.01;
      const a = (i / debrisMeshes.length) * Math.PI * 2 + 0.4;
      const spread = 1.6 + (i % 4) * 1.1;
      d.position.set(
        originX + Math.cos(a) * localT * spread,
        originY + localT * (2.5 - i * 0.35) - localT * localT * 2.2,
        originZ + Math.sin(a) * localT * spread,
      );
      d.rotation.set(localT * (2 + i), localT * 3.1, localT * (1.5 - i * 0.4));
    }
  }

  function setAtmosphereSpaceMix(
    mix: number,
    scene: THREE.Scene,
    skyDome: THREE.Mesh | null,
    marsTint = false,
  ) {
    const clamped = THREE.MathUtils.clamp(mix, 0, 1);
    if (skyDome) {
      skyDome.visible = clamped < 0.18;
    }
    starsMesh.visible = clamped > 0.3;
    if (clamped < 0.5) {
      _tmpColor.copy(_skyCoastal).lerp(_skyStrato, clamped * 2);
    } else {
      _tmpColor.copy(_skyStrato).lerp(_skySpace, (clamped - 0.5) * 2);
    }
    if (marsTint) {
      _tmpColor.lerp(_fogMars, 0.45);
    }
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(_tmpColor);
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(clamped > 0.25 ? _tmpColor : _fogCoastal);
      scene.fog.density = THREE.MathUtils.lerp(0.0016, 0.00025, clamped);
    }
  }

  function setCameraCut(
    camera: THREE.PerspectiveCamera,
    camId: 'A' | 'B' | 'C',
    posX: number,
    posY: number,
    posZ: number,
    lookX: number,
    lookY: number,
    lookZ: number,
    fov: number,
    delta: number,
    hardCut: boolean,
  ) {
    _camPos.set(posX, posY, posZ);
    _camLook.set(lookX, lookY, lookZ);
    if (hardCut) {
      camera.position.copy(_camPos);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.lookAt(_camLook);
    } else {
      const alpha = 1 - Math.exp(-8.5 * delta);
      camera.position.lerp(_camPos, alpha);
      camera.fov = THREE.MathUtils.damp(camera.fov, fov, 8, delta);
      camera.updateProjectionMatrix();
      camera.lookAt(_camLook);
    }
    return camId;
  }

  let prevCameraKey = '';

  function update(
    elapsed: number,
    delta: number,
    mode: LaunchFailureMode,
    difficulty: DifficultyId,
    camera: THREE.PerspectiveCamera,
    rocket: RocketAssembly,
    gantryArm: THREE.Group,
    scene: THREE.Scene,
    skyDome: THREE.Mesh | null,
  ): LaunchTelemetrySnapshot {
    const duration = LAUNCH_CINEMATIC_DURATIONS[mode];
    const finished = elapsed >= duration;
    const fc = rocket.flightControls;

    // Reset per-frame defaults
    hideAllFX();
    fc.rootOffset.set(0, 0, 0);
    fc.rootRotation.set(0, 0, 0);
    fc.lowerStageOffset.set(0, 0, 0);
    fc.lowerStageRotation.set(0, 0, 0);
    fc.upperStageOffset.set(0, 0, 0);
    fc.upperStageRotation.set(0, 0, 0);
    fc.fairingOpenAmount = 0;
    fc.capsuleDetached = false;
    fc.capsuleOffset.set(0, 0, 0);
    fc.capsuleRotation.set(0, 0, 0);
    fc.payloadVisible = false;
    fc.stage1Throttle = 0;
    fc.stage1Asymmetric = false;
    fc.stage2Throttle = 0;
    fc.navLightsOn = true;
    fc.reentryPlasmaIntensity = 0;
    fc.safeHeatshieldGlow = 0;
    fc.parachuteDeploy = 0;
    fc.recoveryBeaconOn = false;

    const targetLabel =
      difficulty === 'easy'
        ? 'EARTH ORBIT'
        : difficulty === 'medium'
          ? 'THE MOON'
          : 'MARS';

    let camId: 'A' | 'B' | 'C' = 'A';
    let cameraLabel = 'CAM A · PAD LOW-ANGLE TRACKING';
    let altitudeKm = 0;
    let altitudeLabel = '0 m';
    let velocityMps = 0;
    let stageLabel = 'PRE-IGNITION';
    let alertText: string | null = null;
    let blackout = false;
    let missionSec = elapsed - 2.0;

    // Helper for smooth camera switching without abrupt jump inside same cut
    const applyCut = (
      id: 'A' | 'B' | 'C',
      cutTag: string,
      px: number,
      py: number,
      pz: number,
      lx: number,
      ly: number,
      lz: number,
      fov = 52,
    ) => {
      const key = `${mode}-${id}-${cutTag}`;
      const isHardCut = prevCameraKey !== key;
      prevCameraKey = key;
      camId = id;
      cameraLabel =
        id === 'A'
          ? 'CAM A · PAD LOW-ANGLE TRACKING'
          : id === 'B'
            ? 'CAM B · ROCKET BOOSTER MOUNTED'
            : 'CAM C · HIGH-ALTITUDE / ORBITAL WIDE';
      setCameraCut(camera, id, px, py, pz, lx, ly, lz, fov, delta, isHardCut);
    };

    // =========================================================================
    // PHASE 1: MISSION ARCHITECTURE — PAD STATIC FIRE FAILURE
    // =========================================================================
    if (mode === 'phase1_pad_fire') {
      missionSec = elapsed - 2.2;
      gantryArm.rotation.y = 0;
      setAtmosphereSpaceMix(0, scene, skyDome);
      stageLabel = elapsed < 2.2 ? 'STATIC FIRE COUNTDOWN' : 'PAD ABORT · ENGINE FAULT';

      if (elapsed < 2.2) {
        fc.rootOffset.set(Math.sin(elapsed * 45) * 0.02, 0, Math.cos(elapsed * 40) * 0.02);
        updateSparks(0, 1.5, 0, elapsed, 0.55);
        applyCut('A', 'p1-1', -6.8, 2.3, 8.2, 0, 2.8, 0, 48);
      } else if (elapsed < 5.2) {
        const ft = elapsed - 2.2;
        fc.stage1Throttle = 0.38;
        fc.stage1Asymmetric = true;
        fc.rootOffset.set(Math.sin(elapsed * 68) * 0.08, 0, Math.cos(elapsed * 60) * 0.08);
        updateSparks(0, 1.4, 0, elapsed, 1.35);
        updatePadSmoke(0, 1.5, 0, ft, 1.25, true, 1.2);
        alertText = 'PAD ABORT TRIGGERED — INCOMPLETE VEHICLE ARCHITECTURE';
        applyCut('B', 'p1-2', 3.9, 3.4, 4.2, 0, 1.9, 0, 54);
      } else {
        const ft = elapsed - 2.2;
        updatePadSmoke(0, 1.5, 0, ft, 0.95, true, 1.35);
        alertText = 'FAILURE: INCOMPLETE VEHICLE ARCHITECTURE — NEVER LEFT PAD';
        applyCut('C', 'p1-3', -12.5, 8.2, 14.0, 0, 2.2, 0, 42);
      }
    }

    // =========================================================================
    // PHASE 2: PROPULSION & DELTA-V — THRUST INSTABILITY & PAD CRASH
    // =========================================================================
    else if (mode === 'phase2_pad_crash') {
      missionSec = elapsed - 1.6;
      setAtmosphereSpaceMix(0, scene, skyDome);
      gantryArm.rotation.y = elapsed > 1.2 ? THREE.MathUtils.clamp((elapsed - 1.2) * 0.9, 0, 1.1) : 0;

      if (elapsed < 1.8) {
        fc.stage1Throttle = 0.72;
        fc.stage1Asymmetric = true;
        fc.rootOffset.set(Math.sin(elapsed * 65) * 0.06, 0, 0);
        updatePadSmoke(0, 1.4, 0, elapsed, 0.9, false, 0.9);
        stageLabel = 'IGNITION · UNEVEN THRUST';
        applyCut('A', 'p2-1', -7.2, 2.2, 9.2, 0, 4.0, 0, 50);
      } else if (elapsed < 4.8) {
        const ft = elapsed - 1.8;
        const u = ft / 3.0;
        const climbY = u * 21; // ~25m visual peak
        const wobbleZ = Math.sin(ft * 8.5) * 0.14 - u * 1.05; // tilts ~60 deg (1.05 rad) sideways!
        const driftX = u * u * 11.5;
        fc.stage1Throttle = 0.92;
        fc.stage1Asymmetric = true;
        fc.rootOffset.set(driftX, climbY, u * 4.5);
        fc.rootRotation.set(u * 0.18, 0, wobbleZ);
        altitudeLabel = `${Math.round(THREE.MathUtils.lerp(1, 25, u))} m`;
        velocityMps = Math.round(u * 38);
        stageLabel = 'GIMBAL HARDOVER · +60° ROLL';
        alertText = 'WARNING: THRUST VECTOR INSTABILITY — +60° PITCH DEVIATION';
        _rocketWorld.set(driftX, 1.33 + climbY, u * 4.5);
        applyCut('B', 'p2-2', driftX + 4.4, 1.33 + climbY + 3.2, u * 4.5 + 5.6, driftX, 1.33 + climbY + 2.8, u * 4.5, 58);
      } else if (elapsed < 6.1) {
        const u = (elapsed - 4.8) / 1.3;
        const px = THREE.MathUtils.lerp(11.5, 22, u);
        const py = THREE.MathUtils.lerp(21, 0.2, u * u);
        const pz = THREE.MathUtils.lerp(4.5, 11, u);
        fc.stage1Throttle = 0.8;
        fc.stage1Asymmetric = true;
        fc.rootOffset.set(px, py, pz);
        fc.rootRotation.set(0.25, 0, -1.25 - u * 0.4);
        altitudeLabel = `${Math.max(0, Math.round(25 * (1 - u * u)))} m`;
        velocityMps = Math.round(38 + u * 14);
        stageLabel = 'TERRAIN IMPACT TRAJECTORY';
        alertText = 'CRITICAL: UNCONTROLLED DESCENT TOWARD PAD PERIMETER';
        applyCut('C', 'p2-3', 32, 16, 30, px, py + 2, pz, 48);
      } else {
        const impT = elapsed - 6.1;
        fc.rootOffset.set(22, -10, 11);
        updateFireball(22, 1.6, 11, impT, 2.2);
        updatePadSmoke(22, 1.6, 11, impT, 1.4, true, 1.7);
        updateSparks(22, 1.6, 11, impT, 1.4);
        altitudeLabel = '0 m (Impact)';
        velocityMps = 0;
        stageLabel = 'VEHICLE DESTROYED';
        alertText = 'FAILURE: UNCALIBRATED THRUST VECTORING & INSUFFICIENT DELTA-V';
        applyCut('C', 'p2-3', 34, 14, 28, 22, 2.5, 11, 48);
      }
    }

    // =========================================================================
    // PHASE 3: STRUCTURAL ASSEMBLY — MID-AIR MAX-Q BUCKLING
    // =========================================================================
    else if (mode === 'phase3_maxq_buckle') {
      missionSec = elapsed - 1.5;
      gantryArm.rotation.y = elapsed > 1.0 ? 1.15 : 0;

      if (elapsed < 2.8) {
        const u = Math.max(0, (elapsed - 1.2) / 1.6);
        const y = u * u * 18;
        fc.stage1Throttle = elapsed > 0.7 ? 1.1 : 0;
        fc.rootOffset.set(0, y, 0);
        if (elapsed > 0.7 && elapsed < 2.3) {
          updatePadSmoke(0, 1.4, 0, elapsed, 0.9, false, 1.0);
        }
        altitudeLabel = `${Math.round(y * 3)} m`;
        velocityMps = Math.round(u * 85);
        stageLabel = elapsed < 1.2 ? 'TOWER IGNITION' : 'TOWER CLEARANCE';
        applyCut('A', 'p3-1', -7.8, 2.4, 9.6, 0, 1.33 + y + 4, 0, 50);
      } else if (elapsed < 5.3) {
        const u = (elapsed - 2.8) / 2.5;
        const y = 18 + u * 44;
        setAtmosphereSpaceMix(u * 0.35, scene, skyDome);
        fc.stage1Throttle = 1.2;
        // High vibration right before Max-Q fracture
        const vib = u > 0.65 ? Math.sin(elapsed * 75) * 0.14 : 0.02;
        fc.rootOffset.set(vib, y, 0);
        altitudeLabel = `${Math.round(54 + u * 146)} m`;
        velocityMps = Math.round(85 + u * 113);
        stageLabel = u > 0.55 ? 'MAX-Q AERODYNAMIC PEAK' : 'STAGE 1 ASCENT';
        if (u > 0.6) alertText = 'WARNING: INTERSTAGE STRUCTURAL VIBRATION EXCEEDED';
        applyCut('B', 'p3-2', 4.1, 1.33 + y + 6.5, 5.2, 0, 1.33 + y + 5.8, 0, 56);
      } else {
        const bt = elapsed - 5.3;
        const y = 62 + bt * 6;
        setAtmosphereSpaceMix(0.38, scene, skyDome);
        fc.stage1Throttle = Math.max(0, 1 - bt * 0.8);
        fc.rootOffset.set(0, y, 0);
        // Upper stage shears off at interstage and tumbles away!
        fc.lowerStageRotation.set(bt * 0.35, 0, bt * 0.4);
        fc.upperStageOffset.set(bt * 3.8, -bt * bt * 1.4 + bt * 3.0, bt * 2.2);
        fc.upperStageRotation.set(bt * 2.4, bt * 1.6, -bt * 2.9);
        updateDebris(0, 1.33 + y + 6, 0, bt);
        updateSparks(0, 1.33 + y + 6, 0, bt, Math.max(0, 1.4 - bt * 0.4));
        altitudeLabel = '200 m (Max-Q Breakup)';
        velocityMps = 198;
        stageLabel = 'STRUCTURAL HULL FAILURE';
        alertText = 'FAILURE: INTERSTAGE BUCKLING UNDER MAX-Q AERODYNAMIC STRESS';
        applyCut('C', 'p3-3', 14, 1.33 + y + 10, 18, bt * 1.5, 1.33 + y + 5, bt, 52);
      }
    }

    // =========================================================================
    // PHASE 4: POWER & AVIONICS — UPPER ATMOSPHERE BLACKOUT
    // =========================================================================
    else if (mode === 'phase4_blackout') {
      missionSec = elapsed - 1.2;
      gantryArm.rotation.y = 1.15;

      if (elapsed < 3.2) {
        const u = elapsed / 3.2;
        const y = u * u * 38;
        setAtmosphereSpaceMix(u * 0.35, scene, skyDome);
        fc.stage1Throttle = 1.18;
        fc.rootOffset.set(0, y, 0);
        if (elapsed < 1.8) updatePadSmoke(0, 1.4, 0, elapsed, 0.8, false);
        altitudeKm = u * 22;
        altitudeLabel = `${altitudeKm.toFixed(1)} km`;
        velocityMps = Math.round(u * 980);
        stageLabel = 'STAGE 1 ASCENT';
        applyCut('A', 'p4-1', -8.2, 2.5, 10.5, 0, 1.33 + y + 4.5, 0, 50);
      } else if (elapsed < 5.6) {
        const u = (elapsed - 3.2) / 2.4;
        const y = 38 + u * 52;
        setAtmosphereSpaceMix(0.35 + u * 0.55, scene, skyDome);
        fc.rootOffset.set(0, y, 0);
        // Clean Stage 1 separation!
        if (u > 0.35) {
          const sepT = u - 0.35;
          fc.stage1Throttle = 0;
          fc.stage2Throttle = 1.05;
          fc.lowerStageOffset.set(-sepT * 2.5, -sepT * 14, -sepT * 1.5);
          fc.lowerStageRotation.set(sepT * 0.8, 0, sepT * 0.4);
          stageLabel = 'STAGE 2 IGNITION · SEP CONFIRMED';
        } else {
          fc.stage1Throttle = 1.0;
          stageLabel = 'MECO · STAGE SEPARATION';
        }
        altitudeKm = 22 + u * 42;
        altitudeLabel = `${altitudeKm.toFixed(1)} km`;
        velocityMps = Math.round(980 + u * 1160);
        applyCut('B', 'p4-2', 4.6, 1.33 + y + 7.2, 5.8, 0, 1.33 + y + 6.8, 0, 54);
      } else {
        const bt = elapsed - 5.6;
        const y = 90 + bt * 4;
        setAtmosphereSpaceMix(0.95, scene, skyDome);
        fc.rootOffset.set(0, y, 0);
        fc.lowerStageOffset.set(-4, -22, -2);
        // TOTAL AVIONICS BLACKOUT: lights off, engine dead, flat spin!
        fc.stage1Throttle = 0;
        fc.stage2Throttle = 0;
        fc.navLightsOn = false;
        blackout = true;
        fc.upperStageRotation.set(Math.PI / 2.2, bt * 3.8, bt * 1.2);
        altitudeLabel = '68.0 km (Signal Lost)';
        velocityMps = 2140;
        stageLabel = 'BUS BLACKOUT · FLAT SPIN';
        alertText = 'FAILURE: TOTAL AVIONICS & ELECTRICAL BUS BLACKOUT';
        applyCut('C', 'p4-3', 11, 1.33 + y + 9, 13, 0, 1.33 + y + 7, 0, 50);
      }
    }

    // =========================================================================
    // PHASE 5: PAYLOAD & SCIENCE — FAIRING & INSTRUMENT LOSS
    // =========================================================================
    else if (mode === 'phase5_payload_loss') {
      missionSec = elapsed - 1.0;
      gantryArm.rotation.y = 1.15;

      if (elapsed < 3.4) {
        const u = elapsed / 3.4;
        const y = u * u * 55;
        setAtmosphereSpaceMix(u * 0.75, scene, skyDome);
        fc.stage1Throttle = 1.15;
        fc.rootOffset.set(0, y, 0);
        altitudeKm = u * 95;
        altitudeLabel = `${altitudeKm.toFixed(0)} km`;
        velocityMps = Math.round(u * 3800);
        stageLabel = 'ORBITAL INSERTION BURN';
        applyCut('A', 'p5-1', -8.0, 2.5, 10.0, 0, 1.33 + y + 5, 0, 52);
      } else if (elapsed < 6.0) {
        const u = (elapsed - 3.4) / 2.6;
        const y = Y_ORBIT - 8 + u * 8;
        setAtmosphereSpaceMix(1.0, scene, skyDome);
        orbitalStage.visible = true;
        fc.rootOffset.set(0, y, 0);
        fc.lowerStageOffset.set(0, -35, 0);
        fc.stage2Throttle = 0.65;
        fc.fairingOpenAmount = THREE.MathUtils.clamp(u * 1.3, 0, 1);
        fc.payloadVisible = true;
        fc.payloadOffset.set(0, 9.5 + u * 0.6, 0);
        altitudeLabel = '175 km (Orbit Edge)';
        velocityMps = 6820;
        stageLabel = 'FAIRING JETTISON';
        applyCut('B', 'p5-2', 4.2, 1.33 + y + 10.6, 5.2, 0, 1.33 + y + 9.4, 0, 50);
      } else {
        const dt = elapsed - 6.0;
        const y = Y_ORBIT;
        setAtmosphereSpaceMix(1.0, scene, skyDome);
        orbitalStage.visible = true;
        fc.rootOffset.set(0, y, 0);
        fc.lowerStageOffset.set(0, -35, 0);
        fc.fairingOpenAmount = 1;
        fc.payloadVisible = true;
        rocket.satBeaconMat.color.setHex(Math.sin(elapsed * 14) > 0 ? 0xef4444 : 0x7f1d1d);
        fc.payloadOffset.set(dt * 2.9, 10.1 + dt * 1.4, -dt * 1.8);
        fc.payloadRotation.set(dt * 3.1, dt * 2.2, dt * 1.7);
        altitudeLabel = '175 km (Payload Lost)';
        velocityMps = 6820;
        stageLabel = 'INSTRUMENT DRIFT · TELEMETRY 0%';
        alertText = 'FAILURE: PAYLOAD DEPLOYMENT FAILURE — ZERO SCIENTIFIC TELEMETRY';
        applyCut('C', 'p5-3', 9.5, 1.33 + y + 12, 11.5, dt * 1.8, 1.33 + y + 10, -dt, 52);
      }
    }

    // =========================================================================
    // PHASE 6: LIFE SUPPORT & THERMAL — RE-ENTRY THERMAL BURN-UP
    // =========================================================================
    else if (mode === 'phase6_reentry_burn') {
      missionSec = elapsed - 1.0;
      gantryArm.rotation.y = 1.15;

      if (elapsed < 3.4) {
        const u = elapsed / 3.4;
        const y = u * u * 48;
        setAtmosphereSpaceMix(u * 0.85, scene, skyDome);
        fc.stage1Throttle = 1.15;
        fc.rootOffset.set(0, y, 0);
        altitudeLabel = `${Math.round(u * 340)} km`;
        velocityMps = Math.round(u * 7650);
        stageLabel = 'ORBIT INSERTION -> RETURN BURN';
        applyCut('A', 'p6-1', -8.0, 2.5, 10.0, 0, 1.33 + y + 5, 0, 52);
      } else if (elapsed < 7.2) {
        const u = (elapsed - 3.4) / 3.8;
        const y = Y_ORBIT - u * 45;
        setAtmosphereSpaceMix(0.85 - u * 0.35, scene, skyDome);
        orbitalStage.visible = true;
        fc.capsuleDetached = true;
        fc.rootOffset.set(0, y, 0);
        fc.capsuleOffset.set(0, 0, 0);
        fc.capsuleRotation.set(0.28, elapsed * 1.8, Math.sin(elapsed * 18) * 0.08);
        fc.reentryPlasmaIntensity = THREE.MathUtils.clamp(u * 1.6, 0.2, 1.4);
        altitudeLabel = `${Math.round(120 - u * 38)} km (Re-Entry)`;
        velocityMps = 7650;
        stageLabel = 'RE-ENTRY PLASMA · THERMAL BREACH';
        alertText = 'CRITICAL ALARM: CABIN TEMP 1,840°C — HEATSHIELD BREACH!';
        applyCut('B', 'p6-2', 3.4, 1.33 + y + 0.6, 4.4, 0, 1.33 + y + 0.4, 0, 56);
      } else {
        const bt = elapsed - 7.2;
        const y = Y_ORBIT - 45 - bt * 12;
        setAtmosphereSpaceMix(0.45, scene, skyDome);
        fc.capsuleDetached = true;
        fc.rootOffset.set(0, y, 0);
        fc.capsuleRotation.set(bt * 2.5, bt * 4.2, bt * 3.1);
        fc.reentryPlasmaIntensity = 1.5;
        updateFireball(0, 1.33 + y, 0, bt, 1.6);
        updateSparks(0, 1.33 + y, 0, bt, 1.4);
        altitudeLabel = '82 km (Thermal Loss)';
        velocityMps = 6900;
        stageLabel = 'CAPSULE INTEGRITY LOST';
        alertText = 'FAILURE: THERMAL SHIELD & LIFE SUPPORT BREACH ON RE-ENTRY';
        applyCut('C', 'p6-3', 9.5, 1.33 + y + 3.2, 12.0, 0, 1.33 + y, 0, 50);
      }
    }

    // =========================================================================
    // PHASE 7: TRAJECTORY & NAVIGATION — DEEP SPACE NAVIGATION MISS
    // =========================================================================
    else if (mode === 'phase7_nav_miss') {
      missionSec = elapsed - 1.0;
      gantryArm.rotation.y = 1.15;

      if (elapsed < 3.4) {
        const u = elapsed / 3.4;
        const y = u * u * 50;
        setAtmosphereSpaceMix(u * 0.9, scene, skyDome);
        fc.stage1Throttle = 1.2;
        fc.rootOffset.set(0, y, 0);
        altitudeLabel = `${Math.round(u * 400)} km`;
        velocityMps = Math.round(u * 10480);
        stageLabel = 'TRANS-ORBITAL INJECTION';
        applyCut('A', 'p7-1', -8.0, 2.6, 10.0, 0, 1.33 + y + 5, 0, 52);
      } else {
        const u = (elapsed - 3.4) / 7.2;
        setAtmosphereSpaceMix(1.0, scene, skyDome);
        orbitalStage.visible = true;
        fc.lowerStageOffset.set(0, -40, 0);
        fc.stage2Throttle = 0.85;
        // Rocket blasts wildly off-axis right past the Target Planet into deep space!
        const rx = THREE.MathUtils.lerp(-16, 26, u);
        const ry = Y_ORBIT + THREE.MathUtils.lerp(-4, 15, u);
        const rz = THREE.MathUtils.lerp(10, -28, u);
        fc.rootOffset.set(rx, ry, rz);
        fc.rootRotation.set(-0.75, 0.55, -0.55);
        altitudeLabel = `${Math.round(400 + u * 38000).toLocaleString()} km`;
        velocityMps = 10480;
        stageLabel = `OFF-AXIS BURN · MISSED ${targetLabel}`;
        if (u > 0.45) {
          alertText = `FAILURE: ORBITAL TRAJECTORY MISCALCULATION — MISSED ${targetLabel}`;
        }
        if (u < 0.35) {
          applyCut('B', 'p7-2', rx + 4.5, 1.33 + ry + 6.5, rz + 5.5, rx, 1.33 + ry + 6, rz, 54);
        } else {
          _targetBodyWorld.set(0, Y_ORBIT + 1, -24);
          applyCut('C', 'p7-3', 18, Y_ORBIT + 16, 24, _targetBodyWorld.x + 2, _targetBodyWorld.y + 3, _targetBodyWorld.z, 54);
        }
      }
    }

    // =========================================================================
    // PHASE 8: GROUND SYSTEMS & FUELING — EARLY MECO FUEL DEPLETION
    // =========================================================================
    else if (mode === 'phase8_early_meco') {
      missionSec = elapsed - 2.4;
      setAtmosphereSpaceMix(0, scene, skyDome);
      gantryArm.rotation.y = elapsed > 1.8 ? 1.15 : 0;

      if (elapsed < 2.4) {
        // Thick white cryogenic vapor leaks continuously on pad!
        updatePadSmoke(0, 3.8, 0, elapsed * 1.2, 1.2, false, 1.15);
        stageLabel = 'CRYO FUELING · LOX VENT LEAK';
        alertText = 'CAUTION: ELEVATED CRYOGENIC BOIL-OFF ON PAD 39A';
        applyCut('A', 'p8-1', -7.2, 3.5, 8.8, 0, 4.8, 0, 50);
      } else if (elapsed < 5.4) {
        const u = (elapsed - 2.4) / 3.0;
        const y = u * 48;
        setAtmosphereSpaceMix(u * 0.45, scene, skyDome);
        fc.stage1Throttle = u < 0.78 ? 1.25 : 0; // Early MECO!
        fc.rootOffset.set(u * 8, y, 0);
        fc.rootRotation.set(0, 0, -0.18 - u * 0.25);
        altitudeLabel = `${Math.round(u * 54)} km`;
        velocityMps = u < 0.78 ? Math.round(u * 1790) : 1420;
        stageLabel = u < 0.78 ? 'FAST ASCENT · HIGH FUEL DRAIN' : 'EARLY MECO · FUEL 0.0%';
        if (u >= 0.78) alertText = 'CRITICAL: EARLY MECO — PROPELLANT TANKS DEPLETED!';
        applyCut('B', 'p8-2', u * 8 + 4.4, 1.33 + y + 5.8, 5.5, u * 8, 1.33 + y + 4.8, 0, 55);
      } else {
        const dt = elapsed - 5.4;
        const u = dt / 4.2;
        setAtmosphereSpaceMix(Math.max(0, 0.45 - u * 0.45), scene, skyDome);
        const px = 8 + u * 62;
        const py = Math.max(-1.0, 48 - u * u * 52);
        fc.stage1Throttle = 0;
        fc.rootOffset.set(px, py, 0);
        fc.rootRotation.set(0, 0, -0.6 - u * 1.9);
        if (u > 0.88) {
          updatePadSmoke(px, 0.4, 0, dt, 1.3, false, 1.4);
        }
        altitudeLabel = `${Math.max(0, Math.round(54 * (1 - u * u)))} km (Ballistic Fall)`;
        velocityMps = Math.round(1420 * (1 - u * 0.4));
        stageLabel = 'FUEL EXHAUSTED · OCEAN IMPACT';
        alertText = 'FAILURE: CRYOGENIC PROPELLANT BOIL-OFF — RAN OUT OF FUEL';
        applyCut('C', 'p8-3', px - 14, Math.max(8, py + 12), 28, px, Math.max(1, py + 3), 0, 50);
      }
    }

    // =========================================================================
    // PHASE 9: PRE-LAUNCH INTEGRATION — ROUGH DESCENT & COMMS LOSS
    // =========================================================================
    else if (mode === 'phase9_rough_descent') {
      missionSec = elapsed - 1.0;
      gantryArm.rotation.y = 1.15;

      if (elapsed < 3.6) {
        const u = elapsed / 3.6;
        const y = u * u * 52;
        setAtmosphereSpaceMix(u * 0.9, scene, skyDome);
        fc.stage1Throttle = 1.15;
        fc.rootOffset.set(0, y, 0);
        altitudeLabel = `${Math.round(u * 380)} km`;
        velocityMps = Math.round(u * 5200);
        stageLabel = `TRANSIT TO ${targetLabel}`;
        applyCut('A', 'p9-1', -8.0, 2.6, 10.0, 0, 1.33 + y + 5, 0, 52);
      } else if (elapsed < 7.8) {
        const u = (elapsed - 3.6) / 4.2;
        setAtmosphereSpaceMix(1.0, scene, skyDome, difficulty === 'hard');
        orbitalStage.visible = true;
        fc.capsuleDetached = true;
        // Approach target surface at (0, Y_ORBIT - 2, -30)
        const cy = THREE.MathUtils.lerp(Y_ORBIT + 18, Y_ORBIT + 1.8, u);
        const cz = THREE.MathUtils.lerp(-14, -30, u);
        const tilt = Math.sin(u * 14) * 0.32 + u * 0.52;
        fc.rootOffset.set(u * 2.5, cy, cz);
        fc.capsuleRotation.set(0.25, 0, tilt);
        fc.stage2Throttle = u % 0.35 < 0.2 ? 0.55 : 0;
        altitudeLabel = `${Math.max(15, Math.round((1 - u) * 1800))} m (Approach)`;
        velocityMps = Math.round(420 - u * 110);
        stageLabel = `${targetLabel} APPROACH DESYNC`;
        alertText = 'WARNING: LANDING RADAR & RCS CONTROL LOOP DESYNCED';
        applyCut('B', 'p9-2', u * 2.5 + 4.8, cy + 2.8, cz + 6.2, u * 2.5, cy + 0.8, cz, 54);
      } else {
        const it = elapsed - 7.8;
        setAtmosphereSpaceMix(1.0, scene, skyDome, difficulty === 'hard');
        orbitalStage.visible = true;
        fc.capsuleDetached = true;
        const surfaceWorldY = Y_ORBIT - 2.0;
        const cz = -30;
        fc.rootOffset.set(2.5, surfaceWorldY - 1.33, cz);
        fc.capsuleRotation.set(0.4, 0.2, 1.15);
        blackout = it > 1.1;
        updatePadSmoke(2.5, surfaceWorldY, cz, it, 1.3, difficulty !== 'hard', 1.3);
        updateSparks(2.5, surfaceWorldY + 0.4, cz, it, Math.max(0, 1.2 - it * 0.4));
        altitudeLabel = `0 m (${targetLabel} Hard Impact)`;
        velocityMps = 0;
        stageLabel = 'HARD IMPACT · SIGNAL LOST';
        alertText = 'FAILURE: FINAL APPROACH SYSTEM DESYNC — HARD LANDING / LOS';
        applyCut('C', 'p9-3', 13, Y_ORBIT + 6, -15, 1.5, surfaceWorldY + 0.5, -30, 50);
      }
    }

    // =========================================================================
    // PHASE 10: FINAL FLIGHT READINESS — FULL 5-ACT EPIC MISSION EXECUTION
    // =========================================================================
    else {
      missionSec = elapsed - 2.2;

      // ACT 1 (0.0s .. 3.2s): Umbilical Retraction & T-0 Ignition
      if (elapsed < 3.2) {
        setAtmosphereSpaceMix(0, scene, skyDome);
        gantryArm.rotation.y = elapsed > 0.6 ? THREE.MathUtils.clamp((elapsed - 0.6) * 0.9, 0, 1.2) : 0;
        const ign = elapsed >= 2.2;
        fc.stage1Throttle = ign ? 1.25 : 0;
        const liftU = ign ? (elapsed - 2.2) / 1.0 : 0;
        const y = liftU * liftU * 8.5;
        fc.rootOffset.set(0, y, 0);
        if (elapsed > 1.6) {
          updatePadSmoke(0, 1.5, 0, elapsed, 1.1, false, 1.15);
        }
        altitudeLabel = `${Math.round(y * 4)} m`;
        velocityMps = Math.round(liftU * 48);
        stageLabel = ign ? 'ACT 1 · T-0 LIFTOFF!' : 'ACT 1 · UMBILICAL RETRACT';
        applyCut('A', 'p10-act1', -8.4, 2.2, 10.6, 0, 1.33 + y + 5.2, 0, 50);
      }

      // ACT 2 (3.2s .. 6.8s): Supersonic Ascent & Clean Stage 1 Separation
      else if (elapsed < 6.8) {
        gantryArm.rotation.y = 1.2;
        const u = (elapsed - 3.2) / 3.6;
        const y = 8.5 + u * 64;
        setAtmosphereSpaceMix(u * 0.92, scene, skyDome);
        fc.rootOffset.set(0, y, 0);

        if (u < 0.45) {
          fc.stage1Throttle = 1.28;
          stageLabel = 'ACT 2 · MAX-Q NOMINAL';
        } else {
          const sepT = (u - 0.45) / 0.55;
          fc.stage1Throttle = 0;
          fc.stage2Throttle = 1.15;
          fc.lowerStageOffset.set(-sepT * 2.2, -sepT * 18, -sepT * 1.2);
          fc.lowerStageRotation.set(sepT * 0.4, 0, sepT * 0.25);
          stageLabel = 'ACT 2 · STAGE 1 SEP NOMINAL';
        }
        altitudeLabel = `${Math.round(0.2 + u * 185)} km`;
        velocityMps = Math.round(48 + u * 7400);
        applyCut('B', 'p10-act2', 4.6, 1.33 + y + 6.5, 5.8, 0, 1.33 + y + 5.8, 0, 54);
      }

      // ACT 3 (6.8s .. 11.8s): Deep Space Transit & Target Arrival (Earth Orbit / Moon / Mars)
      else if (elapsed < 11.8) {
        const u = (elapsed - 6.8) / 5.0;
        setAtmosphereSpaceMix(1.0, scene, skyDome, difficulty === 'hard');
        orbitalStage.visible = true;

        if (difficulty === 'easy') {
          // Earth Orbit: Fairing splits cleanly and deploys Golden Science Satellite!
          const y = Y_ORBIT + 5;
          fc.rootOffset.set(0, y, -16);
          fc.lowerStageOffset.set(0, -45, 0);
          fc.fairingOpenAmount = THREE.MathUtils.clamp(u * 2.2, 0, 1);
          fc.payloadVisible = true;
          const depU = Math.max(0, (u - 0.35) / 0.65);
          fc.payloadOffset.set(depU * 3.8, 9.5 + depU * 2.4, -depU * 4.5);
          fc.payloadRotation.set(0, depU * 1.4, 0);
          rocket.satBeaconMat.color.setHex(0x22c55e);
          altitudeLabel = '412 km (Earth Orbit)';
          velocityMps = 7820;
          stageLabel = 'ACT 3 · LEO SATELLITE DEPLOYED';
          applyCut('C', 'p10-act3-leo', 8.5, Y_ORBIT + 16, -2.5, 1.2, Y_ORBIT + 14.5, -18, 48);
        } else {
          // Moon or Mars: Capsule/Lander descends to target surface, touches down, then blasts back!
          fc.capsuleDetached = true;
          const surfaceWorldY = Y_ORBIT - 2.0;
          const surfOffsetY = surfaceWorldY - 1.33;
          let cy = surfOffsetY;
          if (u < 0.42) {
            const du = u / 0.42;
            cy = THREE.MathUtils.lerp(Y_ORBIT + 16, surfOffsetY, du * (2 - du));
            stageLabel = `ACT 3 · ${targetLabel} LANDING`;
          } else if (u < 0.65) {
            cy = surfOffsetY;
            stageLabel = `ACT 3 · ${targetLabel} TOUCHDOWN`;
          } else {
            const au = (u - 0.65) / 0.35;
            cy = THREE.MathUtils.lerp(surfOffsetY, Y_ORBIT + 18, au * au);
            updateSparks(0, surfaceWorldY + 0.2, -30, elapsed, 0.95);
            stageLabel = `ACT 3 · ${targetLabel} ASCENT BURN`;
          }
          fc.rootOffset.set(0, cy, -30);
          fc.capsuleOffset.set(0, 0, 0);
          altitudeLabel =
            u < 0.42
              ? `${Math.round((1 - u / 0.42) * 14)} km`
              : u < 0.65
                ? `0 m (${targetLabel} Surface)`
                : `${Math.round(((u - 0.65) / 0.35) * 45)} km`;
          velocityMps = u >= 0.42 && u < 0.65 ? 0 : difficulty === 'medium' ? 1680 : 3820;
          applyCut('C', 'p10-act3-land', 11.5, Y_ORBIT + 5.5, -14.5, 0, cy + 1.33, -30, 50);
        }
      }

      // ACT 4 (11.8s .. 15.2s): Controlled Re-Entry with Glowing Heatshield + 3 Parachutes
      else if (elapsed < 15.2) {
        const u = (elapsed - 11.8) / 3.4;
        setAtmosphereSpaceMix(Math.max(0, 0.65 - u * 0.65), scene, skyDome);
        fc.capsuleDetached = true;

        if (u < 0.5) {
          // High-energy atmospheric re-entry with controlled golden ablative shield!
          const ru = u / 0.5;
          const px = THREE.MathUtils.lerp(88, SPLASHDOWN_X - 8, ru);
          const py = THREE.MathUtils.lerp(72, 24, ru);
          fc.rootOffset.set(px, py, SPLASHDOWN_Z);
          fc.capsuleRotation.set(0.18, ru * 0.8, 0.22);
          fc.safeHeatshieldGlow = Math.sin(ru * Math.PI);
          altitudeLabel = `${Math.round(THREE.MathUtils.lerp(78, 12, ru))} km`;
          velocityMps = Math.round(THREE.MathUtils.lerp(9400, 420, ru));
          stageLabel = 'ACT 4 · ABLATIVE HEATSHIELD NOMINAL';
          applyCut('B', 'p10-act4-entry', px - 4.2, py + 1.2, 5.2, px, py + 0.4, 0, 54);
        } else {
          // Triple Main Parachutes deploy cleanly over ocean!
          const cu = (u - 0.5) / 0.5;
          const px = THREE.MathUtils.lerp(SPLASHDOWN_X - 8, SPLASHDOWN_X, cu);
          const py = THREE.MathUtils.lerp(24, 3.2, cu);
          fc.rootOffset.set(px, py, SPLASHDOWN_Z);
          fc.capsuleRotation.set(0, 0, Math.sin(elapsed * 2) * 0.04);
          fc.parachuteDeploy = THREE.MathUtils.clamp(cu * 2.4, 0, 1);
          altitudeLabel = `${Math.round(THREE.MathUtils.lerp(3200, 45, cu))} m`;
          velocityMps = Math.round(THREE.MathUtils.lerp(180, 9, cu));
          stageLabel = 'ACT 4 · 3 MAIN CHUTES DEPLOYED';
          applyCut('B', 'p10-act4-chute', px - 7.5, py + 2.5, 9.5, px, py + 2.2, 0, 52);
        }
      }

      // ACT 5 (15.2s .. 18.0s): Safe Ocean Splashdown & Recovery Beacon
      else {
        const su = THREE.MathUtils.clamp((elapsed - 15.2) / 2.8, 0, 1);
        setAtmosphereSpaceMix(0, scene, skyDome);
        splashdownGroup.visible = true;
        fc.capsuleDetached = true;
        const bobY = SPLASHDOWN_Y - 1.33 + Math.sin(elapsed * 3.2) * 0.08;
        fc.rootOffset.set(SPLASHDOWN_X, bobY, SPLASHDOWN_Z);
        fc.capsuleRotation.set(Math.sin(elapsed * 2.4) * 0.05, 0.3, Math.cos(elapsed * 2.1) * 0.05);
        fc.parachuteDeploy = Math.max(0, 1 - su * 1.4);
        fc.recoveryBeaconOn = true;

        for (let i = 0; i < splashRings.length; i++) {
          const phase = ((elapsed * 0.75 + i * 0.33) % 1);
          splashRings[i].scale.setScalar(0.8 + phase * 4.5);
          (splashRings[i].material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.72;
        }

        altitudeLabel = '0 m (Pacific Splashdown)';
        velocityMps = 0;
        stageLabel = 'ACT 5 · SPLASHDOWN · CREW SAFE';
        applyCut(
          'C',
          'p10-act5',
          SPLASHDOWN_X - 11.5,
          4.8,
          12.5,
          SPLASHDOWN_X,
          0.9,
          SPLASHDOWN_Z,
          46,
        );
      }
    }

    return {
      elapsedSec: elapsed,
      durationSec: duration,
      missionClock: formatMissionClock(missionSec),
      altitudeLabel,
      velocityLabel: blackout ? '--- NO CARRIER' : `${velocityMps.toLocaleString()} m/s`,
      stageLabel,
      cameraId: camId,
      cameraLabel,
      alertText,
      blackout,
      finished,
    };
  }

  function updateOpeningLiftoff(
    elapsed: number,
    delta: number,
    difficulty: DifficultyId,
    camera: THREE.PerspectiveCamera,
    rocket: RocketAssembly,
    gantryArm: THREE.Group,
    scene: THREE.Scene,
    skyDome: THREE.Mesh | null,
  ) {
    const fc = rocket.flightControls;
    hideAllFX();
    fc.rootOffset.set(0, 0, 0);
    fc.rootRotation.set(0, 0, 0);
    fc.lowerStageOffset.set(0, 0, 0);
    fc.lowerStageRotation.set(0, 0, 0);
    fc.upperStageOffset.set(0, 0, 0);
    fc.upperStageRotation.set(0, 0, 0);
    fc.fairingOpenAmount = 0;
    fc.capsuleDetached = false;
    fc.capsuleOffset.set(0, 0, 0);
    fc.capsuleRotation.set(0, 0, 0);
    fc.payloadVisible = false;
    fc.stage1Throttle = 0;
    fc.stage1Asymmetric = false;
    fc.stage2Throttle = 0;
    fc.navLightsOn = true;
    fc.reentryPlasmaIntensity = 0;
    fc.safeHeatshieldGlow = 0;
    fc.parachuteDeploy = 0;
    fc.recoveryBeaconOn = false;

    const cutTo = (
      key: string,
      px: number,
      py: number,
      pz: number,
      lx: number,
      ly: number,
      lz: number,
      fov: number,
    ) => {
      const hard = prevCameraKey !== key;
      prevCameraKey = key;
      setCameraCut(camera, 'A', px, py, pz, lx, ly, lz, fov, delta, hard);
    };

    // Phase A (0.0s .. 1.6s): Umbilical Retract, Main Engine Ignition & Clamps Release
    if (elapsed < 1.6) {
      setAtmosphereSpaceMix(0, scene, skyDome);
      gantryArm.rotation.y =
        elapsed > 0.2 ? THREE.MathUtils.clamp((elapsed - 0.2) * 1.15, 0, 1.2) : 0;

      const ign = elapsed >= 0.45;
      const throttleU = ign ? THREE.MathUtils.clamp((elapsed - 0.45) / 0.55, 0, 1) : 0;
      fc.stage1Throttle = ign ? 0.55 + throttleU * 0.78 : 0;

      const liftU = elapsed >= 1.0 ? (elapsed - 1.0) / 0.6 : 0;
      const y = liftU * liftU * 3.8;
      const rumble = ign && liftU < 0.75 ? Math.sin(elapsed * 48) * 0.032 : 0;
      fc.rootOffset.set(rumble, y, rumble * 0.7);

      if (elapsed > 0.25) {
        updatePadSmoke(0, 1.45, 0, elapsed, 0.75 + throttleU * 0.55, false, 1.25);
        updateSparks(0, 1.55, 0, elapsed, ign ? 0.95 : 0.45);
      }

      const camU = elapsed / 1.6;
      cutTo(
        'opening-liftoff-1',
        THREE.MathUtils.lerp(-9.6, -10.5, camU),
        THREE.MathUtils.lerp(2.5, 3.4, camU),
        THREE.MathUtils.lerp(11.6, 12.6, camU),
        0,
        1.33 + y + 5.6,
        0,
        52,
      );
    }
    // Phase B (1.6s .. 4.3s): Pad Tower Clearance & Vertical Ascent through Hangar Roof
    else if (elapsed < 4.3) {
      const u = (elapsed - 1.6) / 2.7;
      const y = 3.8 + u * u * 36;
      gantryArm.rotation.y = 1.2;
      fc.stage1Throttle = 1.32;
      fc.rootOffset.set(0, y, 0);
      setAtmosphereSpaceMix(u * 0.32, scene, skyDome);

      if (u < 0.58) {
        updatePadSmoke(0, 1.5, 0, elapsed, (1 - u / 0.58) * 1.15, false, 1.35);
      }

      cutTo(
        'opening-liftoff-2',
        THREE.MathUtils.lerp(-10.5, -13.2, u),
        THREE.MathUtils.lerp(3.4, 21.5, u),
        THREE.MathUtils.lerp(12.6, 17.5, u),
        0,
        1.33 + y + 5.5,
        0,
        54,
      );
    }
    // Phase C (4.3s .. 7.0s): Supersonic Ascent into Upper Atmosphere
    else {
      const u = THREE.MathUtils.clamp((elapsed - 4.3) / 2.7, 0, 1);
      const y = 39.8 + u * 86;
      gantryArm.rotation.y = 1.2;
      fc.stage1Throttle = 1.35;
      fc.rootOffset.set(u * 6.5, y, 0);
      fc.rootRotation.set(0, 0, -u * 0.16);
      setAtmosphereSpaceMix(0.32 + u * 0.58, scene, skyDome, difficulty === 'hard');

      cutTo(
        'opening-liftoff-3',
        u * 6.5 + 10.4,
        1.33 + y + 10.5,
        13.2,
        u * 6.5,
        1.33 + y + 5.2,
        0,
        56,
      );
    }
  }

  return {
    root,
    setActive,
    update,
    updateOpeningLiftoff,
  };
}
