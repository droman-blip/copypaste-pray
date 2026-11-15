import * as THREE from 'three';
import { makeAccentMat, makeRoundedRectShape } from './furnitureBuilder';
import type { SpaceMaterialLibrary } from './materials';

export interface RocketFlightVisualControls {
  // Primary root transform relative to Hangar pad (0, 1.33, 0)
  rootOffset: THREE.Vector3;
  rootRotation: THREE.Euler;
  // Upper stage & Stage 1 separation kinematics
  lowerStageOffset: THREE.Vector3;
  lowerStageRotation: THREE.Euler;
  upperStageOffset: THREE.Vector3;
  upperStageRotation: THREE.Euler;
  // Fairing clamshell separation (0 = closed, 1 = jettisoned wide)
  fairingOpenAmount: number;
  // Crew Capsule detached flight & orientation
  capsuleDetached: boolean;
  capsuleOffset: THREE.Vector3;
  capsuleRotation: THREE.Euler;
  // Payload satellite drift/deployment
  payloadVisible: boolean;
  payloadOffset: THREE.Vector3;
  payloadRotation: THREE.Euler;
  // Flames, lights, plasma, parachutes
  stage1Throttle: number; // 0..1.5
  stage1Asymmetric: boolean;
  stage2Throttle: number; // 0..1.5
  navLightsOn: boolean;
  reentryPlasmaIntensity: number; // 0 = off, >0 = blazing red-orange breach
  safeHeatshieldGlow: number; // 0..1 controlled golden ablative shield
  parachuteDeploy: number; // 0 = stowed, 0..1 = inflated
  recoveryBeaconOn: boolean;
}

export interface RocketAssembly {
  root: THREE.Group;
  rocketBody: THREE.Group;
  lowerStageGroup: THREE.Group;
  upperStageGroup: THREE.Group;
  crewCapsuleGroup: THREE.Group;
  payloadSatGroup: THREE.Group;
  fairingLeft: THREE.Group;
  fairingRight: THREE.Group;
  parachutesGroup: THREE.Group;
  moduleGroups: Record<string, THREE.Group>;
  partGroups: Record<string, THREE.Group>;
  exhaustGroup: THREE.Group;
  stage2ExhaustGroup: THREE.Group;
  satBeaconMat: THREE.MeshBasicMaterial;
  flightControls: RocketFlightVisualControls;
  resetFlightState: () => void;
  updateAnimation: (
    time: number,
    delta: number,
    installedIds: Set<string>,
    explodedAmount: number,
    isLaunching: boolean,
    currentPhase: number,
    forceFullAssembly?: boolean,
  ) => void;
}

function enableShadows(group: THREE.Object3D) {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

export function buildModularRocket(mats: SpaceMaterialLibrary): RocketAssembly {
  const root = new THREE.Group();
  root.name = 'ModularRocketRoot';

  const rocketBody = new THREE.Group();
  rocketBody.name = 'RocketBody';
  root.add(rocketBody);

  // Separate hierarchical flight stages so Stage 1, Upper Stage, Fairings & Capsule can physically split!
  const lowerStageGroup = new THREE.Group();
  lowerStageGroup.name = 'LowerStageGroup';
  rocketBody.add(lowerStageGroup);

  const upperStageGroup = new THREE.Group();
  upperStageGroup.name = 'UpperStageGroup';
  rocketBody.add(upperStageGroup);

  const orangeMat = makeAccentMat(0xf97316, 0.28);
  const yellowMat = makeAccentMat(0xfacc15, 0.25);
  const greenMat = makeAccentMat(0x22c55e, 0.3);
  const blueMat = makeAccentMat(0x3b82f6, 0.32);
  const cyanGlowMat = makeAccentMat(0x38bdf8, 0.75);

  const partGroups: Record<string, THREE.Group> = {
    'hng-nozzles': new THREE.Group(),
    'hng-fuel-tank': new THREE.Group(),
    'hng-interstage': new THREE.Group(),
    'hng-oxidizer-tank': new THREE.Group(),
    'hng-avionics': new THREE.Group(),
    'hng-fairing': new THREE.Group(),
  };

  lowerStageGroup.add(partGroups['hng-nozzles']);
  lowerStageGroup.add(partGroups['hng-fuel-tank']);
  upperStageGroup.add(partGroups['hng-interstage']);
  upperStageGroup.add(partGroups['hng-oxidizer-tank']);
  upperStageGroup.add(partGroups['hng-avionics']);
  upperStageGroup.add(partGroups['hng-fairing']);

  // === CORE ROCKET (Seated on pad at y = 0, ~11.5m tall) ===
  // 1. Flared Main Engine Bell (LatheGeometry)
  const nozzlePts = [
    new THREE.Vector2(0.24, 0.95),
    new THREE.Vector2(0.42, 0.8),
    new THREE.Vector2(0.32, 0.62),
    new THREE.Vector2(0.56, 0.16),
    new THREE.Vector2(0.66, 0.0),
  ];
  const mainNozzle = new THREE.Mesh(
    new THREE.LatheGeometry(nozzlePts, 18),
    mats.copperNozzle,
  );
  partGroups['hng-nozzles'].add(mainNozzle);

  // 2. Sculpted Thrust Skirt + Ring Flanges
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.12, 1.05, 18),
    mats.hullDark,
  );
  skirt.position.y = 1.45;
  partGroups['hng-nozzles'].add(skirt);

  const skirtRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.12, 0.06, 8, 20),
    mats.titanium,
  );
  skirtRing.rotation.x = Math.PI / 2;
  skirtRing.position.y = 0.96;
  partGroups['hng-nozzles'].add(skirtRing);

  const coreCollarTop = new THREE.Mesh(
    new THREE.TorusGeometry(0.96, 0.065, 8, 20),
    mats.titanium,
  );
  coreCollarTop.rotation.x = Math.PI / 2;
  coreCollarTop.position.y = 1.98;
  partGroups['hng-nozzles'].add(coreCollarTop);

  // Sculpted Aerodynamic Fins (ExtrudeGeometry with bevel)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.75, 0);
  finShape.lineTo(0.22, 1.45);
  finShape.lineTo(0, 1.45);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  finGeo.translate(0, 0, -0.05);

  for (let i = 0; i < 4; i++) {
    const finGroup = new THREE.Group();
    finGroup.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
    const fin = new THREE.Mesh(finGeo, mats.titanium);
    fin.position.set(0.96, 0.85, 0);
    finGroup.add(fin);
    partGroups['hng-nozzles'].add(finGroup);
  }

  // 3. Spherical Cryogenic Tanks around Lower Interstage + Curved Fuel Pipes
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const sphereTank = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 12),
      mats.brushedSteel,
    );
    sphereTank.position.set(Math.cos(a) * 0.92, 2.05, Math.sin(a) * 0.92);
    partGroups['hng-fuel-tank'].add(sphereTank);

    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.96, 2.45, Math.sin(a) * 0.96),
      new THREE.Vector3(Math.cos(a) * 1.05, 4.1, Math.sin(a) * 1.05),
      new THREE.Vector3(Math.cos(a) * 0.96, 5.65, Math.sin(a) * 0.96),
    ]);
    const pipe = new THREE.Mesh(
      new THREE.TubeGeometry(pipeCurve, 16, 0.075, 8, false),
      mats.copperNozzle,
    );
    partGroups['hng-fuel-tank'].add(pipe);
  }

  // 4. First Stage Tank (Metallic riveted fuselage)
  const stage1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 3.8, 24),
    mats.rocketMetallicHull,
  );
  stage1.position.y = 3.85;
  partGroups['hng-fuel-tank'].add(stage1);

  const collar1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.96, 0.055, 8, 24),
    mats.titanium,
  );
  collar1.rotation.x = Math.PI / 2;
  collar1.position.y = 2.65;
  partGroups['hng-fuel-tank'].add(collar1);

  // 5. Interstage + Second Stage Bell (exposed when Stage 1 separates)
  const interstage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.95, 0.65, 24),
    mats.rocketThermalTile,
  );
  interstage.position.y = 6.08;
  partGroups['hng-interstage'].add(interstage);

  const stage2Bell = new THREE.Mesh(
    new THREE.LatheGeometry(nozzlePts, 16),
    mats.copperNozzle,
  );
  stage2Bell.scale.setScalar(0.68);
  stage2Bell.position.y = 5.82;
  partGroups['hng-interstage'].add(stage2Bell);

  // 6. Second Stage Tank
  const stage2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.86, 2.3, 24),
    mats.rocketMetallicHull,
  );
  stage2.position.y = 7.55;
  partGroups['hng-oxidizer-tank'].add(stage2);

  // 7. Avionics Ring + Navigation Strobe Beacons (turned off in Phase 4 blackout)
  const avionicsRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.87, 0.05, 8, 24),
    mats.brushedSteel,
  );
  avionicsRing.rotation.x = Math.PI / 2;
  avionicsRing.position.y = 8.66;
  partGroups['hng-avionics'].add(avionicsRing);

  const navLightMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const navLightMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), navLightMat);
    led.position.set(Math.cos(a) * 0.9, 8.66, Math.sin(a) * 0.9);
    partGroups['hng-avionics'].add(led);
    navLightMeshes.push(led);
  }

  // 8. Split Clamshell Fairing Halves (hng-fairing)
  const ogivePts = [
    new THREE.Vector2(0.86, 0.0),
    new THREE.Vector2(0.84, 0.45),
    new THREE.Vector2(0.72, 1.05),
    new THREE.Vector2(0.45, 1.65),
    new THREE.Vector2(0.14, 2.08),
    new THREE.Vector2(0.0, 2.2),
  ];

  const fairingLeft = new THREE.Group();
  fairingLeft.position.y = 8.7;
  const fairingLeftMesh = new THREE.Mesh(
    new THREE.LatheGeometry(ogivePts, 16, Math.PI * 0.5, Math.PI),
    mats.brushedSteel,
  );
  fairingLeft.add(fairingLeftMesh);
  partGroups['hng-fairing'].add(fairingLeft);

  const fairingRight = new THREE.Group();
  fairingRight.position.y = 8.7;
  const fairingRightMesh = new THREE.Mesh(
    new THREE.LatheGeometry(ogivePts, 16, -Math.PI * 0.5, Math.PI),
    mats.brushedSteel,
  );
  fairingRight.add(fairingRightMesh);
  partGroups['hng-fairing'].add(fairingRight);

  const noseTip = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.1, 0.45, 6, 10),
    mats.titanium,
  );
  noseTip.position.y = 2.25;
  fairingRight.add(noseTip);

  // 9. Internal Crew Capsule + Heatshield + Re-Entry Plasma + 3 Parachutes + Recovery Beacon
  const crewCapsuleGroup = new THREE.Group();
  crewCapsuleGroup.position.set(0, 8.72, 0);
  rocketBody.add(crewCapsuleGroup);

  const capsulePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.72, 0.08),
    new THREE.Vector2(0.74, 0.25),
    new THREE.Vector2(0.54, 0.85),
    new THREE.Vector2(0.32, 1.25),
    new THREE.Vector2(0.0, 1.32),
  ];
  const capsuleHull = new THREE.Mesh(
    new THREE.LatheGeometry(capsulePts, 18),
    mats.hullWhite,
  );
  crewCapsuleGroup.add(capsuleHull);

  const heatShieldDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.74, 0.62, 0.14, 18),
    mats.ceramicHeatShield,
  );
  heatShieldDisc.position.y = 0.04;
  crewCapsuleGroup.add(heatShieldDisc);

  // Capsule windows
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    const win = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), cyanGlowMat);
    win.rotation.x = Math.PI / 2 - 0.35;
    win.rotation.z = -a;
    win.position.set(Math.sin(a) * 0.58, 0.62, Math.cos(a) * 0.58);
    crewCapsuleGroup.add(win);
  }

  // Controlled Safe Heatshield Ablative Glow (Phase 10 Act 4)
  const safeGlowMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const safeHeatShieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42),
    safeGlowMat,
  );
  safeHeatShieldMesh.position.y = 0.3;
  crewCapsuleGroup.add(safeHeatShieldMesh);

  // Re-Entry Thermal Breach Plasma Sheath (Phase 6 Burn-Up)
  const plasmaMat = new THREE.MeshBasicMaterial({
    color: 0xff4500,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const plasmaOuter = new THREE.Mesh(
    new THREE.ConeGeometry(1.45, 2.6, 18, 1, true),
    plasmaMat,
  );
  plasmaOuter.rotation.x = Math.PI;
  plasmaOuter.position.y = 0.65;
  crewCapsuleGroup.add(plasmaOuter);

  const plasmaCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0,
  });
  const plasmaCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 14, 12),
    plasmaCoreMat,
  );
  plasmaCore.position.y = 0.25;
  crewCapsuleGroup.add(plasmaCore);

  // Triple Main Parachutes (Phase 10 Act 4 & Act 5)
  const parachutesGroup = new THREE.Group();
  parachutesGroup.position.set(0, 1.3, 0);
  parachutesGroup.visible = false;
  crewCapsuleGroup.add(parachutesGroup);

  const chuteOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const chuteWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const px = Math.cos(angle) * 1.45;
    const pz = Math.sin(angle) * 1.45;
    const chuteSub = new THREE.Group();
    chuteSub.position.set(px, 3.2, pz);
    chuteSub.rotation.z = -Math.cos(angle) * 0.28;
    chuteSub.rotation.x = Math.sin(angle) * 0.28;

    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.48),
      i % 2 === 0 ? chuteOrangeMat : chuteWhiteMat,
    );
    chuteSub.add(canopy);

    const stripeBand = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.07, 6, 16),
      i % 2 === 0 ? chuteWhiteMat : chuteOrangeMat,
    );
    stripeBand.rotation.x = Math.PI / 2;
    stripeBand.position.y = 0.08;
    chuteSub.add(stripeBand);

    for (let r = 0; r < 3; r++) {
      const ra = (r * Math.PI * 2) / 3;
      const cordCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-px, -3.2, -pz),
        new THREE.Vector3(Math.cos(ra) * 0.9, -0.05, Math.sin(ra) * 0.9),
      ]);
      const cord = new THREE.Mesh(
        new THREE.TubeGeometry(cordCurve, 6, 0.018, 5, false),
        mats.titanium,
      );
      chuteSub.add(cord);
    }

    parachutesGroup.add(chuteSub);
  }

  // Capsule Splashdown Recovery Beacon
  const recoveryBeaconMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const recoveryBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    recoveryBeaconMat,
  );
  recoveryBeacon.position.y = 1.48;
  recoveryBeacon.visible = false;
  crewCapsuleGroup.add(recoveryBeacon);

  // 10. Internal Scientific Payload Satellite (Phase 5 & Phase 10 LEO deployment)
  const payloadSatGroup = new THREE.Group();
  payloadSatGroup.position.set(0, 9.5, 0);
  payloadSatGroup.visible = false;
  rocketBody.add(payloadSatGroup);

  const satBus = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.95, 12),
    mats.goldKapton,
  );
  payloadSatGroup.add(satBus);
  const satDish = new THREE.Mesh(
    new THREE.LatheGeometry(
      [new THREE.Vector2(0, 0), new THREE.Vector2(0.35, 0.1), new THREE.Vector2(0.55, 0.28)],
      14,
    ),
    mats.hullWhite,
  );
  satDish.position.y = 0.52;
  payloadSatGroup.add(satDish);

  const satWingShape = makeRoundedRectShape(1.6, 0.55, 0.06);
  const satWingGeo = new THREE.ExtrudeGeometry(satWingShape, { depth: 0.03, bevelEnabled: false });
  satWingGeo.center();
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(satWingGeo, mats.solarCell);
    wing.position.set(s * 1.18, 0, 0);
    payloadSatGroup.add(wing);
  }
  const satFaultMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const satBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), satFaultMat);
  satBeacon.position.y = 0.85;
  payloadSatGroup.add(satBeacon);

  // === 12 MODULAR ATTACHMENTS ===
  const moduleGroups: Record<string, THREE.Group> = {};

  function registerModule(
    id: string,
    explodeDir: [number, number, number],
    parentGroup: THREE.Group = rocketBody,
  ): THREE.Group {
    const g = new THREE.Group();
    g.name = `Module_${id}`;
    g.userData.explodeOffset = new THREE.Vector3(...explodeDir);
    g.userData.currentScale = 0.001;
    g.scale.setScalar(0.001);
    g.visible = false;
    moduleGroups[id] = g;
    parentGroup.add(g);
    return g;
  }

  // 1. S-1 Solid Rocket Boosters
  {
    const g = registerModule('sys-solid-boosters', [1.8, -0.4, 0], lowerStageGroup);
    for (const side of [-1, 1]) {
      const srb = new THREE.Group();
      srb.position.set(side * 1.48, 0.35, 0);

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 3.6, 14),
        mats.hullWhite,
      );
      body.position.y = 2.1;
      srb.add(body);

      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.85, 14), orangeMat);
      nose.position.y = 4.32;
      srb.add(nose);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 16), orangeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.4;
      srb.add(ring);

      const bell = new THREE.Mesh(new THREE.LatheGeometry(nozzlePts, 14), mats.copperNozzle);
      bell.scale.setScalar(0.55);
      bell.position.y = -0.18;
      srb.add(bell);

      const strut = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.09, 0.45, 4, 8),
        mats.titanium,
      );
      strut.rotation.z = Math.PI / 2;
      strut.position.set(-side * 0.34, 2.8, 0);
      srb.add(strut);

      g.add(srb);
    }
  }

  // 2. Advanced Cryogenic Engine Cluster
  {
    const g = registerModule('sys-cryo-engine', [0, -1.5, 1.6], lowerStageGroup);
    const manifold = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.13, 10, 20), orangeMat);
    manifold.rotation.x = Math.PI / 2;
    manifold.position.y = 1.85;
    g.add(manifold);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const pod = new THREE.Group();
      pod.position.set(Math.cos(a) * 0.82, 0.68, Math.sin(a) * 0.82);

      const cryoSphere = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mats.brushedSteel);
      cryoSphere.position.y = 0.65;
      pod.add(cryoSphere);

      const auxBell = new THREE.Mesh(new THREE.LatheGeometry(nozzlePts, 12), mats.copperNozzle);
      auxBell.scale.setScalar(0.52);
      auxBell.position.y = -0.25;
      pod.add(auxBell);

      const feedCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.85, 0),
        new THREE.Vector3(Math.cos(a) * 0.25, 1.05, Math.sin(a) * 0.25),
        new THREE.Vector3(Math.cos(a) * 0.28, 1.18, Math.sin(a) * 0.28),
      ]);
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(feedCurve, 8, 0.06, 6, false), orangeMat);
      pod.add(pipe);

      g.add(pod);
    }
  }

  // 3. Vectorial RCS Control Ring
  {
    const g = registerModule('sys-rcs-structure', [0, 0.5, -1.6], upperStageGroup);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.1, 10, 20), mats.hullDark);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 6.48;
    g.add(collar);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const rcs = new THREE.Group();
      rcs.rotation.y = a;
      rcs.position.y = 6.48;

      const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.26, 4, 8), orangeMat);
      capsule.position.set(0, 0, 1.02);
      rcs.add(capsule);

      const thrusterTop = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), mats.titanium);
      thrusterTop.position.set(0, 0.24, 1.04);
      rcs.add(thrusterTop);

      const thrusterOut = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), mats.titanium);
      thrusterOut.rotation.x = Math.PI / 2;
      thrusterOut.position.set(0, 0, 1.24);
      rcs.add(thrusterOut);

      g.add(rcs);
    }
  }

  // 4. Standard Contract Solar Array
  {
    const g = registerModule('fin-solar-standard', [-1.8, 0.3, 0], upperStageGroup);
    const panelShape = makeRoundedRectShape(2.2, 0.92, 0.1);
    const panelGeo = new THREE.ExtrudeGeometry(panelShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    panelGeo.rotateX(Math.PI / 2);
    panelGeo.center();

    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.92, 7.3, 0);

      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 10), yellowMat);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.x = side * 0.22;
      wing.add(hinge);

      const panel = new THREE.Mesh(panelGeo, mats.solarCell);
      panel.position.x = side * 1.48;
      panel.rotation.x = 0.28;
      wing.add(panel);

      const rim = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.035, 2.15, 4, 8),
        mats.goldKapton,
      );
      rim.rotation.z = Math.PI / 2;
      rim.position.set(side * 1.48, -0.04, 0);
      wing.add(rim);

      g.add(wing);
    }
  }

  // 5. Heavy Quad Solar Array
  {
    const g = registerModule('fin-solar-heavy', [1.8, 0.5, 1.0], lowerStageGroup);
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.08, 8, 20), yellowMat);
    hubRing.rotation.x = Math.PI / 2;
    hubRing.position.y = 4.8;
    g.add(hubRing);

    const wingShape = makeRoundedRectShape(2.5, 1.25, 0.14);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    wingGeo.rotateX(Math.PI / 2);
    wingGeo.center();

    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i * Math.PI) / 2 + Math.PI / 6;
      arm.position.y = 4.8;

      const boom = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 2.7, 8),
        mats.brushedSteel,
      );
      boom.rotation.z = Math.PI / 2;
      boom.position.x = 2.0;
      arm.add(boom);

      const array = new THREE.Mesh(wingGeo, mats.solarCell);
      array.position.set(2.3, 0, 0);
      array.rotation.x = 0.35;
      arm.add(array);

      g.add(arm);
    }
  }

  // 6. Certified Thermal Shield
  {
    const g = registerModule('fin-thermal-shield', [0, -0.5, -1.8], lowerStageGroup);
    const kaptonWrap = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 1.4, 18),
      mats.goldKapton,
    );
    kaptonWrap.position.y = 3.9;
    g.add(kaptonWrap);

    const radShape = makeRoundedRectShape(0.95, 1.65, 0.14);
    const radGeo = new THREE.ExtrudeGeometry(radShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    radGeo.center();

    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(radGeo, mats.hullWhite);
      fin.position.set(0, 3.9, side * 1.42);
      g.add(fin);

      const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.9, 4, 8), yellowMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 4.72, side * 1.42);
      g.add(bar);
    }
  }

  // 7. Mass Spectrometer
  {
    const g = registerModule('sci-spectrometer', [1.5, 0.6, -1.3], upperStageGroup);
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.65, 6, 12), mats.hullDark);
    pod.position.set(0.98, 7.65, 0.35);
    g.add(pod);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.05, 8, 14), greenMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0.98, 8.05, 0.35);
    g.add(ring);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 0.55, 12),
      mats.brushedSteel,
    );
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(1.36, 7.6, 0.35);
    g.add(barrel);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), greenMat);
    eye.position.set(1.62, 7.6, 0.35);
    g.add(eye);
  }

  // 8. HD Orbital Telescope
  {
    const g = registerModule('sci-hd-camera', [-1.5, 1.0, 1.3], upperStageGroup);
    const turret = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), mats.hullDark);
    turret.position.set(-0.92, 7.9, 0);
    g.add(turret);

    for (const zOff of [-0.18, 0.18]) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 0.68, 12),
        mats.brushedSteel,
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(-1.32, 7.9, zOff);
      g.add(barrel);

      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12), greenMat);
      lens.rotation.z = Math.PI / 2;
      lens.position.set(-1.64, 7.9, zOff);
      g.add(lens);
    }
  }

  // 9. Microgravity Lab Module
  {
    const g = registerModule('sci-microgravity-lab', [0, 1.3, 0], upperStageGroup);
    const labDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(1.02, 1.02, 1.32, 18),
      mats.hullWhite,
    );
    labDrum.position.y = 7.55;
    g.add(labDrum);

    const greenCollar = new THREE.Mesh(
      new THREE.TorusGeometry(1.04, 0.07, 8, 20),
      greenMat,
    );
    greenCollar.rotation.x = Math.PI / 2;
    greenCollar.position.y = 7.55;
    g.add(greenCollar);

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const port = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12), cyanGlowMat);
      port.rotation.x = Math.PI / 2;
      port.rotation.z = a;
      port.position.set(Math.sin(a) * 1.03, 7.82, Math.cos(a) * 1.03);
      g.add(port);
    }
  }

  // 10. S-Band Helical Link
  {
    const g = registerModule('plt-sband-link', [1.1, 1.8, 1.1], upperStageGroup);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.095, 1.85, 10),
      mats.brushedSteel,
    );
    mast.position.set(0.42, 10.6, 0.36);
    g.add(mast);

    for (let i = 0; i < 3; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.2 - i * 0.03, 0.035, 8, 14), blueMat);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(0.42, 10.75 + i * 0.28, 0.36);
      g.add(coil);
    }

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), cyanGlowMat);
    beacon.position.set(0.42, 11.55, 0.36);
    g.add(beacon);
  }

  // 11. Ka-Band Parabolic Dish
  {
    const g = registerModule('plt-kaband-dish', [0, 0.9, 1.8], upperStageGroup);
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 8.2, 0.78),
      new THREE.Vector3(0, 8.35, 1.25),
      new THREE.Vector3(0, 8.5, 1.52),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.09, 8, false), mats.titanium);
    g.add(arm);

    const dishPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.4, 0.08),
      new THREE.Vector2(0.74, 0.26),
      new THREE.Vector2(0.88, 0.44),
    ];
    const dish = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 18), mats.hullWhite);
    dish.rotation.x = Math.PI / 3;
    dish.position.set(0, 8.5, 1.52);
    g.add(dish);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.87, 0.045, 8, 18), blueMat);
    rim.rotation.x = Math.PI / 3 + Math.PI / 2;
    rim.position.set(0, 8.68, 1.85);
    g.add(rim);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.48, 8), blueMat);
    horn.rotation.x = -Math.PI / 6;
    horn.position.set(0, 8.75, 1.85);
    g.add(horn);
  }

  // 12. Autonomous Guidance & Abort Tower
  {
    const g = registerModule('plt-abort-guidance', [-1.1, 1.5, -1.1], upperStageGroup);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 10, 20), blueMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 8.65;
    g.add(ring);

    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.35, 6, 8), mats.brushedSteel);
      pod.rotation.z = -Math.PI / 5;
      pod.rotation.y = a;
      pod.position.set(Math.cos(a) * 0.94, 8.78, Math.sin(a) * 0.94);
      g.add(pod);
    }

    const escapeMast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.25, 8), blueMat);
    escapeMast.position.y = 11.4;
    g.add(escapeMast);
  }

  // === EXHAUST PLUMES ===
  const exhaustGroup = new THREE.Group();
  exhaustGroup.visible = false;
  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.62, 3.8, 14),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.95 }),
  );
  innerFlame.rotation.x = Math.PI;
  innerFlame.position.y = -1.8;
  exhaustGroup.add(innerFlame);

  const outerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(1.02, 5.4, 14),
    mats.exhaustFlame,
  );
  outerFlame.rotation.x = Math.PI;
  outerFlame.position.y = -2.55;
  exhaustGroup.add(outerFlame);
  lowerStageGroup.add(exhaustGroup);

  const stage2ExhaustGroup = new THREE.Group();
  stage2ExhaustGroup.position.set(0, 5.75, 0);
  stage2ExhaustGroup.visible = false;
  const s2Inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 2.8, 12),
    new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.92 }),
  );
  s2Inner.rotation.x = Math.PI;
  s2Inner.position.y = -1.35;
  stage2ExhaustGroup.add(s2Inner);
  const s2Outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.76, 4.1, 12),
    new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.55 }),
  );
  s2Outer.rotation.x = Math.PI;
  s2Outer.position.y = -1.95;
  stage2ExhaustGroup.add(s2Outer);
  upperStageGroup.add(stage2ExhaustGroup);

  enableShadows(root);

  const flightControls: RocketFlightVisualControls = {
    rootOffset: new THREE.Vector3(),
    rootRotation: new THREE.Euler(),
    lowerStageOffset: new THREE.Vector3(),
    lowerStageRotation: new THREE.Euler(),
    upperStageOffset: new THREE.Vector3(),
    upperStageRotation: new THREE.Euler(),
    fairingOpenAmount: 0,
    capsuleDetached: false,
    capsuleOffset: new THREE.Vector3(),
    capsuleRotation: new THREE.Euler(),
    payloadVisible: false,
    payloadOffset: new THREE.Vector3(),
    payloadRotation: new THREE.Euler(),
    stage1Throttle: 0,
    stage1Asymmetric: false,
    stage2Throttle: 0,
    navLightsOn: true,
    reentryPlasmaIntensity: 0,
    safeHeatshieldGlow: 0,
    parachuteDeploy: 0,
    recoveryBeaconOn: false,
  };

  function resetFlightState() {
    flightControls.rootOffset.set(0, 0, 0);
    flightControls.rootRotation.set(0, 0, 0);
    flightControls.lowerStageOffset.set(0, 0, 0);
    flightControls.lowerStageRotation.set(0, 0, 0);
    flightControls.upperStageOffset.set(0, 0, 0);
    flightControls.upperStageRotation.set(0, 0, 0);
    flightControls.fairingOpenAmount = 0;
    flightControls.capsuleDetached = false;
    flightControls.capsuleOffset.set(0, 0, 0);
    flightControls.capsuleRotation.set(0, 0, 0);
    flightControls.payloadVisible = false;
    flightControls.payloadOffset.set(0, 0, 0);
    flightControls.payloadRotation.set(0, 0, 0);
    flightControls.stage1Throttle = 0;
    flightControls.stage1Asymmetric = false;
    flightControls.stage2Throttle = 0;
    flightControls.navLightsOn = true;
    flightControls.reentryPlasmaIntensity = 0;
    flightControls.safeHeatshieldGlow = 0;
    flightControls.parachuteDeploy = 0;
    flightControls.recoveryBeaconOn = false;

    rocketBody.position.set(0, 0, 0);
    rocketBody.rotation.set(0, 0, 0);
    lowerStageGroup.position.set(0, 0, 0);
    lowerStageGroup.rotation.set(0, 0, 0);
    upperStageGroup.position.set(0, 0, 0);
    upperStageGroup.rotation.set(0, 0, 0);
    fairingLeft.position.set(0, 8.7, 0);
    fairingLeft.rotation.set(0, 0, 0);
    fairingRight.position.set(0, 8.7, 0);
    fairingRight.rotation.set(0, 0, 0);
    crewCapsuleGroup.position.set(0, 8.72, 0);
    crewCapsuleGroup.rotation.set(0, 0, 0);
    payloadSatGroup.visible = false;
    payloadSatGroup.position.set(0, 9.5, 0);
    payloadSatGroup.rotation.set(0, 0, 0);
    exhaustGroup.visible = false;
    stage2ExhaustGroup.visible = false;
    parachutesGroup.visible = false;
    recoveryBeacon.visible = false;
    plasmaMat.opacity = 0;
    plasmaCoreMat.opacity = 0;
    safeGlowMat.opacity = 0;
    satFaultMat.color.setHex(0x22c55e);
  }

  const _targetPos = new THREE.Vector3();

  function updateAnimation(
    time: number,
    delta: number,
    installedIds: Set<string>,
    explodedAmount: number,
    isLaunching: boolean,
    currentPhase: number,
    forceFullAssembly = false,
  ) {
    // Phase-accurate rocket construction state!
    // Phase 1: ONLY lower structural core (hng-nozzles) mounted!
    // Phase 2: Core + Stage 1 Tank (hng-fuel-tank)
    // Phase 3+: Interstage, Stage 2, Avionics, Fairing + Capsule
    const effectivePhase = forceFullAssembly ? 6 : currentPhase;
    const showStage1Tank = effectivePhase >= 2;
    const showUpperStage = effectivePhase >= 3;
    const showAvionics = effectivePhase >= 4;
    const showFairingAndCapsule = effectivePhase >= 3;

    partGroups['hng-nozzles'].visible = true;
    partGroups['hng-fuel-tank'].visible = showStage1Tank;
    partGroups['hng-interstage'].visible = showUpperStage;
    partGroups['hng-oxidizer-tank'].visible = showUpperStage;
    partGroups['hng-avionics'].visible = showAvionics;
    partGroups['hng-fairing'].visible = showFairingAndCapsule;
    crewCapsuleGroup.visible = showFairingAndCapsule || flightControls.capsuleDetached;

    // Hide exterior fairing/stage2 when capsule has separated for deep-space / re-entry / splashdown acts
    const hideRocketStackForCapsule = isLaunching && flightControls.capsuleDetached;
    lowerStageGroup.visible = !hideRocketStackForCapsule;
    upperStageGroup.visible = showUpperStage && !hideRocketStackForCapsule;

    for (const [id, group] of Object.entries(moduleGroups)) {
      const active = (forceFullAssembly || installedIds.has(id)) && !hideRocketStackForCapsule;
      const targetScale = active ? 1 : 0.001;
      const nextScale = forceFullAssembly
        ? targetScale
        : THREE.MathUtils.damp(
            group.userData.currentScale ?? 0.001,
            targetScale,
            10,
            delta,
          );
      group.userData.currentScale = nextScale;
      group.visible = nextScale > 0.02;
      group.scale.setScalar(nextScale);

      const offset = group.userData.explodeOffset as THREE.Vector3;
      _targetPos.copy(offset).multiplyScalar(isLaunching || forceFullAssembly ? 0 : explodedAmount);
      if (forceFullAssembly) {
        group.position.copy(_targetPos);
      } else {
        group.position.lerp(_targetPos, 1 - Math.exp(-10 * delta));
      }
    }

    // Navigation beacons on Avionics Ring
    for (let i = 0; i < navLightMeshes.length; i++) {
      navLightMeshes[i].visible = flightControls.navLightsOn && showAvionics;
    }
    if (flightControls.navLightsOn) {
      const blink = Math.sin(time * 7) > 0 ? 1.8 : 0.45;
      navLightMat.emissiveIntensity = blink;
    }

    if (isLaunching) {
      rocketBody.position.copy(flightControls.rootOffset);
      rocketBody.rotation.copy(flightControls.rootRotation);

      lowerStageGroup.position.copy(flightControls.lowerStageOffset);
      lowerStageGroup.rotation.copy(flightControls.lowerStageRotation);

      upperStageGroup.position.copy(flightControls.upperStageOffset);
      upperStageGroup.rotation.copy(flightControls.upperStageRotation);

      // Fairing halves split
      const fo = flightControls.fairingOpenAmount;
      fairingLeft.position.set(-fo * 3.8, 8.7 + fo * 1.1, 0);
      fairingLeft.rotation.set(0, 0, fo * 0.72);
      fairingRight.position.set(fo * 3.8, 8.7 + fo * 1.1, 0);
      fairingRight.rotation.set(0, 0, -fo * 0.72);

      // Crew Capsule position (either seated on Stage 2 or separated in deep space / re-entry / splashdown)
      if (flightControls.capsuleDetached) {
        crewCapsuleGroup.position.copy(flightControls.capsuleOffset);
        crewCapsuleGroup.rotation.copy(flightControls.capsuleRotation);
      } else {
        crewCapsuleGroup.position.set(
          flightControls.upperStageOffset.x,
          8.72 + flightControls.upperStageOffset.y,
          flightControls.upperStageOffset.z,
        );
        crewCapsuleGroup.rotation.copy(flightControls.upperStageRotation);
      }

      // Scientific Payload Satellite
      payloadSatGroup.visible = flightControls.payloadVisible;
      if (flightControls.payloadVisible) {
        payloadSatGroup.position.copy(flightControls.payloadOffset);
        payloadSatGroup.rotation.copy(flightControls.payloadRotation);
      }

      // Stage 1 Exhaust Plume
      const s1 = flightControls.stage1Throttle;
      exhaustGroup.visible = s1 > 0.02 && !hideRocketStackForCapsule;
      if (exhaustGroup.visible) {
        const asym = flightControls.stage1Asymmetric
          ? Math.sin(time * 28) * 0.35
          : 0;
        const flick = (0.86 + Math.sin(time * 44) * 0.18) * s1;
        exhaustGroup.scale.set(
          flick * (0.9 + Math.abs(asym)),
          (0.85 + Math.sin(time * 36) * 0.24) * s1,
          flick,
        );
        exhaustGroup.rotation.z = asym;
      }

      // Stage 2 Vacuum Plume
      const s2 = flightControls.stage2Throttle;
      stage2ExhaustGroup.visible = s2 > 0.02 && !hideRocketStackForCapsule;
      if (stage2ExhaustGroup.visible) {
        const flick2 = (0.88 + Math.cos(time * 39) * 0.14) * s2;
        stage2ExhaustGroup.scale.set(flick2, flick2, flick2);
      }

      // Plasma Breach vs Safe Ablative Glow
      const plasma = flightControls.reentryPlasmaIntensity;
      plasmaOuter.visible = plasma > 0.02;
      plasmaCore.visible = plasma > 0.02;
      plasmaMat.opacity = THREE.MathUtils.clamp(plasma * (0.68 + Math.sin(time * 26) * 0.18), 0, 0.92);
      plasmaCoreMat.opacity = THREE.MathUtils.clamp(plasma * 0.85, 0, 0.95);
      plasmaOuter.scale.setScalar(0.92 + Math.sin(time * 32) * 0.1);

      const safeGlow = flightControls.safeHeatshieldGlow;
      safeHeatShieldMesh.visible = safeGlow > 0.02;
      safeGlowMat.opacity = THREE.MathUtils.clamp(safeGlow * (0.62 + Math.sin(time * 18) * 0.12), 0, 0.8);

      // Triple Main Parachutes
      const chute = flightControls.parachuteDeploy;
      parachutesGroup.visible = chute > 0.03;
      if (parachutesGroup.visible) {
        parachutesGroup.scale.set(chute, chute, chute);
        parachutesGroup.rotation.z = Math.sin(time * 2.2) * 0.05;
      }

      // Ocean Recovery Beacon
      recoveryBeacon.visible = flightControls.recoveryBeaconOn;
      if (recoveryBeacon.visible) {
        const pulse = Math.sin(time * 8) > 0 ? 1.3 : 0.45;
        recoveryBeacon.scale.setScalar(pulse);
        recoveryBeaconMat.color.setHex(Math.sin(time * 8) > 0 ? 0x22d3ee : 0x34d399);
      }
    } else {
      resetFlightState();
    }
  }

  return {
    root,
    rocketBody,
    lowerStageGroup,
    upperStageGroup,
    crewCapsuleGroup,
    payloadSatGroup,
    fairingLeft,
    fairingRight,
    parachutesGroup,
    moduleGroups,
    partGroups,
    exhaustGroup,
    stage2ExhaustGroup,
    satBeaconMat: satFaultMat,
    flightControls,
    resetFlightState,
    updateAnimation,
  };
}
