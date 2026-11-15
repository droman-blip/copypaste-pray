import * as THREE from 'three';
import type { CadBlueprintVariant } from '../data/componentDossierData';
import { makeAccentMat, makeRoundedRectShape } from './furnitureBuilder';
import type { SpaceMaterialLibrary } from './materials';

export interface RocketPartPreviewRig {
  root: THREE.Group;
  turntableGroup: THREE.Group;
  recommendedDistance: number;
  recommendedTargetY: number;
  animate: (elapsed: number, delta: number, autoRotate: boolean) => void;
  disposeLocalResources: () => void;
}

export function buildRocketPartPreview(
  variant: CadBlueprintVariant,
  accentHex: string,
  mats: SpaceMaterialLibrary,
): RocketPartPreviewRig {
  const root = new THREE.Group();
  const localMaterials: THREE.Material[] = [];
  const localGeometries: THREE.BufferGeometry[] = [];

  const trackMat = <T extends THREE.Material>(m: T): T => {
    localMaterials.push(m);
    return m;
  };
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    localGeometries.push(g);
    return g;
  };

  const accentGlowMat = trackMat(makeAccentMat(accentHex, 0.85));
  const cyanGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0.4,
    }),
  );
  const cryoFrostMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.3,
    }),
  );
  const plasmaGlowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
    }),
  );

  // =========================================================================
  // STUDIO HOLOGRAPHIC TURNTABLE PEDESTAL (Seated flush at y = 0)
  // =========================================================================
  const turntableBase = new THREE.Group();
  const basePts = [
    new THREE.Vector2(0, -0.34),
    new THREE.Vector2(2.35, -0.34),
    new THREE.Vector2(2.3, -0.18),
    new THREE.Vector2(2.02, -0.06),
    new THREE.Vector2(1.94, 0.0),
    new THREE.Vector2(0, 0.0),
  ];
  const baseDisc = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(basePts, 40)), mats.weatheredSteel);
  baseDisc.receiveShadow = true;
  turntableBase.add(baseDisc);

  const holoRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(2.04, 0.024, 10, 48)),
    accentGlowMat,
  );
  holoRing.rotation.x = Math.PI / 2;
  holoRing.position.y = -0.02;
  turntableBase.add(holoRing);

  const innerRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(1.52, 1.57, 48)),
    cyanGlowMat,
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.008;
  turntableBase.add(innerRing);

  // Subtle calibration ticks around turntable rim
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    const tick = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.04, 0.02, 0.16)),
      i % 3 === 0 ? accentGlowMat : mats.titanium,
    );
    tick.position.set(Math.cos(a) * 1.8, 0.01, Math.sin(a) * 1.8);
    tick.rotation.y = -a + Math.PI / 2;
    turntableBase.add(tick);
  }

  const shadowDisc = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(3.8, 3.8)), mats.contactShadow);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.005;
  turntableBase.add(shadowDisc);
  root.add(turntableBase);

  // Rotating hero stage group mounted on turntable
  const turntableGroup = new THREE.Group();
  turntableGroup.position.y = 0.02;
  root.add(turntableGroup);

  const modelGroup = new THREE.Group();
  turntableGroup.add(modelGroup);

  // Dynamic animation handles populated per variant
  const animators: Array<(elapsed: number, delta: number) => void> = [];
  let recommendedDistance = 5.4;
  let recommendedTargetY = 1.45;

  // =========================================================================
  // 1. MAIN PROPULSION NOZZLES & TURBOPUMP CLUSTER
  // =========================================================================
  if (variant === 'nozzles') {
    recommendedDistance = 5.0;
    recommendedTargetY = 1.3;

    // Upper thrust mounting octagonal flange
    const thrustPlate = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(1.15, 1.24, 0.28, 24)),
      mats.hullDark,
    );
    thrustPlate.position.y = 2.45;
    modelGroup.add(thrustPlate);

    const mountCollar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.18, 0.06, 10, 28)),
      mats.titanium,
    );
    mountCollar.rotation.x = Math.PI / 2;
    mountCollar.position.y = 2.58;
    modelGroup.add(mountCollar);

    const bellProfile = [
      new THREE.Vector2(0.18, 1.35),
      new THREE.Vector2(0.32, 1.15),
      new THREE.Vector2(0.22, 0.94),
      new THREE.Vector2(0.45, 0.42),
      new THREE.Vector2(0.58, 0.0),
    ];
    const bellGeo = trackGeo(new THREE.LatheGeometry(bellProfile, 28));

    const buildEngineBell = (scale: number): { unit: THREE.Group; rotor: THREE.Mesh; glow: THREE.Mesh } => {
      const unit = new THREE.Group();

      // Gimbal pivot yoke at top
      const yoke = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.26 * scale, 0.28 * scale, 0.34 * scale, 16)),
        mats.titanium,
      );
      yoke.position.y = 1.48 * scale;
      unit.add(yoke);

      // Parabolic copper bell
      const bell = new THREE.Mesh(bellGeo, mats.copperNozzle);
      bell.scale.setScalar(scale);
      unit.add(bell);

      // Titanium structural cooling stiffening rings along bell exterior
      for (const [ry, rr] of [
        [0.86, 0.27],
        [0.52, 0.42],
        [0.2, 0.54],
      ]) {
        const ring = new THREE.Mesh(
          trackGeo(new THREE.TorusGeometry(rr * scale, 0.022 * scale, 8, 24)),
          mats.brushedSteel,
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = ry * scale;
        unit.add(ring);
      }

      // Helical regenerative cooling pipe
      const coilPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const a = t * Math.PI * 5;
        const r = (0.25 + t * 0.32) * scale;
        coilPts.push(new THREE.Vector3(Math.cos(a) * r, (0.95 - t * 0.8) * scale, Math.sin(a) * r));
      }
      const coil = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 32, 0.018 * scale, 6, false)),
        mats.goldKapton,
      );
      unit.add(coil);

      // Turbopump volute casing + spinning impeller rotor
      const volute = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.18 * scale, 0.18 * scale, 0.22 * scale, 14)),
        mats.weatheredSteel,
      );
      volute.rotation.z = Math.PI / 2;
      volute.position.set(0.32 * scale, 1.18 * scale, 0);
      unit.add(volute);

      const rotor = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.14 * scale, 0.14 * scale, 0.06 * scale, 6)),
        accentGlowMat,
      );
      rotor.rotation.z = Math.PI / 2;
      rotor.position.set(0.45 * scale, 1.18 * scale, 0);
      unit.add(rotor);

      // Hydraulic TVC gimbal struts
      for (const s of [-1, 1]) {
        const piston = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.03 * scale, 0.03 * scale, 0.56 * scale, 8)),
          mats.brushedSteel,
        );
        piston.position.set(0, 1.28 * scale, s * 0.32 * scale);
        piston.rotation.x = s * 0.34;
        unit.add(piston);
      }

      // Subtle inner ion throat plume cone
      const glow = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(0.42 * scale, 0.9 * scale, 18, 1, true)),
        plasmaGlowMat,
      );
      glow.position.y = 0.24 * scale;
      unit.add(glow);

      return { unit, rotor, glow };
    };

    const centerEng = buildEngineBell(1.0);
    centerEng.unit.position.set(0, 0.72, 0);
    modelGroup.add(centerEng.unit);

    const sideEngines: Array<{ unit: THREE.Group; rotor: THREE.Mesh; baseAngle: number }> = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
      const eng = buildEngineBell(0.68);
      eng.unit.position.set(Math.cos(a) * 0.78, 1.18, Math.sin(a) * 0.78);
      eng.unit.rotation.y = -a;
      modelGroup.add(eng.unit);

      // Copper propellant manifold feed from thrust plate to side bell
      const feedCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.45, 2.38, Math.sin(a) * 0.45),
        new THREE.Vector3(Math.cos(a) * 0.84, 2.28, Math.sin(a) * 0.84),
        new THREE.Vector3(Math.cos(a) * 0.78, 1.98, Math.sin(a) * 0.78),
      ]);
      modelGroup.add(
        new THREE.Mesh(trackGeo(new THREE.TubeGeometry(feedCurve, 12, 0.055, 8, false)), mats.copperNozzle),
      );
      sideEngines.push({ unit: eng.unit, rotor: eng.rotor, baseAngle: a });
    }

    animators.push((elapsed, delta) => {
      centerEng.rotor.rotation.x += delta * 12;
      centerEng.glow.scale.y = 0.9 + Math.sin(elapsed * 9) * 0.12;
      plasmaGlowMat.opacity = 0.36 + Math.sin(elapsed * 7) * 0.12;
      sideEngines.forEach((se, idx) => {
        se.rotor.rotation.x += delta * 14;
        se.unit.rotation.z = Math.sin(elapsed * 1.4 + idx * 2.1) * 0.09;
      });
    });

  // =========================================================================
  // 2. CORE FUEL TANK & SOLAR ARRAY INTERFACE
  // =========================================================================
  } else if (variant === 'fuel-tank') {
    recommendedDistance = 5.6;
    recommendedTargetY = 1.75;

    // Lower aft dome + upper forward bulkhead
    const aftSkirt = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.84, 0.92, 0.34, 28)),
      mats.hullDark,
    );
    aftSkirt.position.y = 0.25;
    modelGroup.add(aftSkirt);

    // Outer Al-Li 2195 cutaway half shell (250 deg arc revealing internal cryo pressure vessel)
    const outerShell = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.86, 0.86, 2.55, 28, 1, false, -0.4, Math.PI * 1.42)),
      mats.rocketMetallicHull,
    );
    outerShell.position.y = 1.65;
    modelGroup.add(outerShell);

    // Exposed internal titanium orthogrid rib rings
    for (const ry of [0.65, 1.15, 1.65, 2.15, 2.65]) {
      const rib = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.85, 0.032, 8, 28)),
        mats.titanium,
      );
      rib.rotation.x = Math.PI / 2;
      rib.position.y = ry;
      modelGroup.add(rib);
    }

    // Internal LH2 subcooled core vessel with dome ends
    const innerVessel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.62, 0.62, 2.1, 24)),
      mats.brushedSteel,
    );
    innerVessel.position.y = 1.65;
    modelGroup.add(innerVessel);

    const upperDome = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      mats.goldKapton,
    );
    upperDome.position.y = 2.7;
    modelGroup.add(upperDome);

    // 4 External cryo feed spheres + copper manifolds
    const cryoRings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const sphere = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.24, 14, 12)), mats.brushedSteel);
      sphere.position.set(Math.cos(a) * 0.88, 0.58, Math.sin(a) * 0.88);
      modelGroup.add(sphere);

      const pipeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.9, 0.78, Math.sin(a) * 0.9),
        new THREE.Vector3(Math.cos(a) * 0.96, 1.65, Math.sin(a) * 0.96),
        new THREE.Vector3(Math.cos(a) * 0.88, 2.72, Math.sin(a) * 0.88),
      ]);
      modelGroup.add(
        new THREE.Mesh(trackGeo(new THREE.TubeGeometry(pipeCurve, 16, 0.045, 8, false)), mats.copperNozzle),
      );

      const pulseRing = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.07, 0.016, 6, 14)),
        cryoFrostMat,
      );
      pulseRing.rotation.x = Math.PI / 2;
      pulseRing.position.set(Math.cos(a) * 0.94, 1.0, Math.sin(a) * 0.94);
      modelGroup.add(pulseRing);
      cryoRings.push(pulseRing);
    }

    // Twin articulating solar wing hinges
    const wingGroups: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.92, 2.05, 0);
      const collar = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 12)),
        mats.goldKapton,
      );
      collar.rotation.z = Math.PI / 2;
      pivot.add(collar);

      const panel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.56, 0.04)), mats.solarCell);
      panel.position.set(side * 0.68, 0, 0);
      pivot.add(panel);

      const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 0.05, 0.06)), mats.titanium);
      frame.position.set(side * 0.68, 0.28, 0);
      pivot.add(frame);

      modelGroup.add(pivot);
      wingGroups.push(pivot);
    }

    animators.push((elapsed) => {
      cryoRings.forEach((ring, i) => {
        const phase = ((elapsed * 0.75 + i * 0.25) % 1);
        ring.position.y = 0.85 + phase * 1.75;
      });
      wingGroups.forEach((wg, i) => {
        const sign = i === 0 ? -1 : 1;
        wg.rotation.y = Math.sin(elapsed * 1.1) * 0.22 * sign;
      });
    });

  // =========================================================================
  // 3. INTERSTAGE RING & PNEUMATIC SEPARATION TRUSS
  // =========================================================================
  } else if (variant === 'interstage') {
    recommendedDistance = 5.0;
    recommendedTargetY = 1.25;

    // Lower adapter collar + thermal tile shell
    const baseFlange = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.12, 0.075, 10, 32)),
      mats.titanium,
    );
    baseFlange.rotation.x = Math.PI / 2;
    baseFlange.position.y = 0.35;
    modelGroup.add(baseFlange);

    const shell = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.95, 1.12, 1.35, 28, 1, true, 0, Math.PI * 1.45)),
      mats.rocketThermalTile,
    );
    shell.position.y = 1.05;
    modelGroup.add(shell);

    const upperClamp = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.96, 0.065, 10, 32)),
      mats.brushedSteel,
    );
    upperClamp.rotation.x = Math.PI / 2;
    upperClamp.position.y = 1.72;
    modelGroup.add(upperClamp);

    // Internal diagonal composite truss struts
    for (let i = 0; i < 8; i++) {
      const a1 = (i * Math.PI * 2) / 8;
      const a2 = a1 + Math.PI / 8;
      const strutCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a1) * 1.05, 0.38, Math.sin(a1) * 1.05),
        new THREE.Vector3(Math.cos(a2) * 0.92, 1.68, Math.sin(a2) * 0.92),
      ]);
      modelGroup.add(
        new THREE.Mesh(trackGeo(new THREE.TubeGeometry(strutCurve, 4, 0.032, 6, false)), mats.titanium),
      );
    }

    // Internal protruding Stage 2 vacuum copper nozzle bell
    const vacBellPts = [
      new THREE.Vector2(0.16, 1.25),
      new THREE.Vector2(0.24, 1.08),
      new THREE.Vector2(0.18, 0.94),
      new THREE.Vector2(0.48, 0.36),
      new THREE.Vector2(0.62, 0.05),
    ];
    const vacBell = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(vacBellPts, 24)), mats.copperNozzle);
    vacBell.position.y = 0.35;
    modelGroup.add(vacBell);

    // Quad RCS thruster pods + reciprocating pneumatic separation pushers
    const pusherRods: THREE.Mesh[] = [];
    const rcsTips: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const pod = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.42, 0.24)), mats.weatheredSteel);
      pod.position.set(Math.cos(a) * 1.08, 1.15, Math.sin(a) * 1.08);
      pod.rotation.y = -a;
      modelGroup.add(pod);

      const tip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.06, 0.14, 10)), accentGlowMat);
      tip.rotation.z = -Math.PI / 2;
      tip.rotation.y = -a;
      tip.position.set(Math.cos(a) * 1.24, 1.15, Math.sin(a) * 1.24);
      modelGroup.add(tip);
      rcsTips.push(tip);

      // Pneumatic pusher cylinder + animated rod
      const pa = a + Math.PI / 4;
      const cyl = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 10)),
        mats.hullDark,
      );
      cyl.position.set(Math.cos(pa) * 0.88, 1.52, Math.sin(pa) * 0.88);
      modelGroup.add(cyl);

      const rod = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8)),
        mats.brushedSteel,
      );
      rod.position.set(Math.cos(pa) * 0.88, 1.76, Math.sin(pa) * 0.88);
      modelGroup.add(rod);
      pusherRods.push(rod);
    }

    animators.push((elapsed) => {
      const stroke = (Math.sin(elapsed * 2.1) * 0.5 + 0.5) * 0.26;
      pusherRods.forEach((rod) => {
        rod.position.y = 1.74 + stroke;
      });
      accentGlowMat.emissiveIntensity = 0.45 + Math.max(0, Math.sin(elapsed * 6)) * 0.9;
    });

  // =========================================================================
  // 4. UPPER STAGE LOX TANK & SCIENCE INSTRUMENT BAY
  // =========================================================================
  } else if (variant === 'oxidizer-tank') {
    recommendedDistance = 5.1;
    recommendedTargetY = 1.45;

    // Lower pressurized LOX spherical vessel on cradle struts
    const lowerRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.95, 0.05, 8, 28)),
      mats.titanium,
    );
    lowerRing.rotation.x = Math.PI / 2;
    lowerRing.position.y = 0.35;
    modelGroup.add(lowerRing);

    const loxSphere = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.76, 24, 18)), mats.brushedSteel);
    loxSphere.position.y = 1.05;
    modelGroup.add(loxSphere);

    const frostBand = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.77, 0.032, 8, 28)),
      cryoFrostMat,
    );
    frostBand.rotation.x = Math.PI / 2;
    frostBand.position.y = 1.05;
    modelGroup.add(frostBand);

    // Cutaway service cage frame rising to upper optical bench
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      const strut = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 2.25, 8)), mats.titanium);
      strut.position.set(Math.cos(a) * 0.94, 1.45, Math.sin(a) * 0.94);
      modelGroup.add(strut);
    }

    const deckPlate = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.94, 0.94, 0.08, 24)),
      mats.weatheredSteel,
    );
    deckPlate.position.y = 1.88;
    modelGroup.add(deckPlate);

    // Analytical Spectrometer & Bio-Sample Bay on upper optical bench
    const specHousing = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.78, 0.48, 0.65)),
      mats.hullWhite,
    );
    specHousing.position.set(-0.22, 2.16, 0);
    modelGroup.add(specHousing);

    const greenOpticMat = trackMat(makeAccentMat('#22C55E', 1.1));
    const lensBarrel = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.28, 16)),
      mats.brushedSteel,
    );
    lensBarrel.rotation.z = Math.PI / 2;
    lensBarrel.position.set(0.24, 2.18, 0);
    modelGroup.add(lensBarrel);

    // Rotating diffraction prism inside optics aperture
    const prism = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.14, 0)), greenOpticMat);
    prism.position.set(0.42, 2.18, 0);
    modelGroup.add(prism);

    // Sealed bio-sample canisters
    for (let i = 0; i < 3; i++) {
      const tube = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.38, 12)),
        mats.goldKapton,
      );
      tube.position.set(0.25, 2.1, -0.26 + i * 0.26);
      modelGroup.add(tube);
    }

    const topCollar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.95, 0.05, 8, 28)),
      mats.brushedSteel,
    );
    topCollar.rotation.x = Math.PI / 2;
    topCollar.position.y = 2.58;
    modelGroup.add(topCollar);

    animators.push((elapsed, delta) => {
      prism.rotation.y += delta * 2.2;
      prism.rotation.x += delta * 1.4;
      greenOpticMat.emissiveIntensity = 0.75 + Math.sin(elapsed * 4.5) * 0.35;
    });

  // =========================================================================
  // 5. TRIPLE-MODULAR AVIONICS RING & KA-BAND GIMBAL
  // =========================================================================
  } else if (variant === 'avionics') {
    recommendedDistance = 4.5;
    recommendedTargetY = 1.0;

    // Gold-plated precision avionics ring chassis seated on struts
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.05, 0.55, 8)), mats.titanium);
      leg.position.set(Math.cos(a) * 1.15, 0.28, Math.sin(a) * 1.15);
      modelGroup.add(leg);
    }

    const mainRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(1.18, 0.14, 14, 36)),
      mats.weatheredSteel,
    );
    mainRing.rotation.x = Math.PI / 2;
    mainRing.position.y = 0.65;
    modelGroup.add(mainRing);

    const chassisPlate = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(1.12, 1.12, 0.08, 32)),
      mats.hullDark,
    );
    chassisPlate.position.y = 0.56;
    modelGroup.add(chassisPlate);

    // 3 Triple-Modular Redundant Voting IMU Computers with pulsing status LEDs
    const imuLeds: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const imu = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.24, 0.28)), mats.goldKapton);
      imu.position.set(Math.cos(a) * 0.82, 0.74, Math.sin(a) * 0.82);
      imu.rotation.y = -a;
      modelGroup.add(imu);

      const ledMat = trackMat(makeAccentMat('#38BDF8', 1.1));
      imuLeds.push(ledMat);
      const led = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.06, 0.2)), ledMat);
      led.position.set(Math.cos(a) * 0.82, 0.88, Math.sin(a) * 0.82);
      led.rotation.y = -a;
      modelGroup.add(led);
    }

    // Central 3-Axis Spinning Precision Gyroscope Assembly
    const gyroOuter = new THREE.Group();
    gyroOuter.position.set(0, 1.15, 0);
    gyroOuter.add(new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.46, 0.032, 10, 28)), mats.brushedSteel));
    const gyroMiddle = new THREE.Group();
    gyroMiddle.add(new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.36, 0.028, 10, 24)), mats.titanium));
    const gyroRotor = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 18)),
      mats.goldKapton,
    );
    gyroMiddle.add(gyroRotor);
    gyroOuter.add(gyroMiddle);
    modelGroup.add(gyroOuter);

    // Articulated Ka-Band Parabolic High-Gain Dish on side boom
    const dishGimbal = new THREE.Group();
    dishGimbal.position.set(0.95, 1.1, 0);
    const dishPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.18, 0.03),
      new THREE.Vector2(0.34, 0.12),
      new THREE.Vector2(0.42, 0.24),
    ];
    const dish = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(dishPts, 20)), mats.hullWhite);
    dish.rotation.x = Math.PI * 0.35;
    dishGimbal.add(dish);
    const feed = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.04, 0.22, 10)), cyanGlowMat);
    feed.position.set(0, 0.18, 0.18);
    feed.rotation.x = -Math.PI * 0.65;
    dishGimbal.add(feed);
    modelGroup.add(dishGimbal);

    animators.push((elapsed, delta) => {
      gyroOuter.rotation.y += delta * 1.1;
      gyroMiddle.rotation.x += delta * 2.4;
      gyroRotor.rotation.z += delta * 6.5;
      dishGimbal.rotation.y = Math.sin(elapsed * 0.9) * 0.65;
      imuLeds.forEach((m, i) => {
        m.emissiveIntensity = 0.4 + Math.max(0, Math.sin(elapsed * 5 + i * 2.1)) * 1.2;
      });
    });

  // =========================================================================
  // 6. SPLIT CLAMSHELL PAYLOAD FAIRING, ESCAPE TOWER & INTERNAL SATELLITE
  // =========================================================================
  } else if (variant === 'fairing') {
    recommendedDistance = 5.4;
    recommendedTargetY = 1.65;

    const adapterRing = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.95, 0.98, 0.22, 28)),
      mats.hullDark,
    );
    adapterRing.position.y = 0.18;
    modelGroup.add(adapterRing);

    const ogivePts = [
      new THREE.Vector2(0.92, 0.0),
      new THREE.Vector2(0.9, 0.55),
      new THREE.Vector2(0.76, 1.25),
      new THREE.Vector2(0.46, 1.92),
      new THREE.Vector2(0.15, 2.4),
      new THREE.Vector2(0.0, 2.55),
    ];

    const leftHalf = new THREE.Group();
    leftHalf.position.y = 0.28;
    leftHalf.add(
      new THREE.Mesh(trackGeo(new THREE.LatheGeometry(ogivePts, 20, Math.PI * 0.5, Math.PI)), mats.brushedSteel),
    );
    modelGroup.add(leftHalf);

    const rightHalf = new THREE.Group();
    rightHalf.position.y = 0.28;
    rightHalf.add(
      new THREE.Mesh(trackGeo(new THREE.LatheGeometry(ogivePts, 20, -Math.PI * 0.5, Math.PI)), mats.brushedSteel),
    );
    modelGroup.add(rightHalf);

    // Top Launch Escape Tower spire attached to right/top collar
    const towerGroup = new THREE.Group();
    towerGroup.position.y = 2.48;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.024, 0.72, 6)), accentGlowMat);
      leg.position.set(Math.cos(a) * 0.1, 0.28, Math.sin(a) * 0.1);
      leg.rotation.z = Math.cos(a) * 0.14;
      leg.rotation.x = -Math.sin(a) * 0.14;
      towerGroup.add(leg);
    }
    const abortMotor = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.075, 0.09, 0.44, 12)),
      mats.hullWhite,
    );
    abortMotor.position.y = 0.72;
    towerGroup.add(abortMotor);
    rightHalf.add(towerGroup);

    // Internal Gold-Kapton Orbital Telescope Satellite with articulating solar wings
    const satGroup = new THREE.Group();
    satGroup.position.y = 1.22;
    const satBus = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.36, 0.38, 0.92, 14)), mats.goldKapton);
    satGroup.add(satBus);

    const opticsLens = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.26, 0.25, 16)), cyanGlowMat);
    opticsLens.position.y = 0.56;
    satGroup.add(opticsLens);

    const satWingL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.75, 0.36, 0.03)), mats.solarCell);
    satWingL.position.set(-0.72, 0.05, 0);
    satGroup.add(satWingL);

    const satWingR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.75, 0.36, 0.03)), mats.solarCell);
    satWingR.position.set(0.72, 0.05, 0);
    satGroup.add(satWingR);
    modelGroup.add(satGroup);

    animators.push((elapsed) => {
      // Smooth clamshell split-open & close breathing cycle showing hidden satellite inside!
      const openFactor = Math.sin(elapsed * 0.85 - Math.PI * 0.15) * 0.5 + 0.5;
      leftHalf.position.x = -0.14 - openFactor * 0.72;
      leftHalf.rotation.z = openFactor * 0.16;
      rightHalf.position.x = 0.14 + openFactor * 0.72;
      rightHalf.rotation.z = -openFactor * 0.16;
      satGroup.rotation.y = elapsed * 0.45;
      satWingL.scale.x = 0.45 + openFactor * 0.75;
      satWingR.scale.x = 0.45 + openFactor * 0.75;
    });

  // =========================================================================
  // 7. LAUNCH GANTRY TOWER & RETRACTING GOLD UMBILICAL ARM
  // =========================================================================
  } else if (variant === 'umbilical') {
    recommendedDistance = 5.4;
    recommendedTargetY = 1.65;

    const towerPed = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.25, 0.26, 1.25)),
      mats.weatheredSteel,
    );
    towerPed.position.set(-0.55, 0.14, 0);
    modelGroup.add(towerPed);

    // 4 steel lattice tower columns + horizontal & diagonal X-bracing
    for (const cx of [-0.95, -0.15]) {
      for (const cz of [-0.4, 0.4]) {
        const col = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 2.95, 10)),
          mats.brushedSteel,
        );
        col.position.set(cx, 1.65, cz);
        modelGroup.add(col);
      }
    }

    for (let tier = 0; tier < 5; tier++) {
      const ty = 0.55 + tier * 0.6;
      const ring = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.07, 0.92)), mats.wallTrim);
      ring.position.set(-0.55, ty, 0);
      modelGroup.add(ring);
    }

    const crown = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.45, 0.58, 0.25, 8)),
      mats.copperNozzle,
    );
    crown.position.set(-0.55, 3.22, 0);
    modelGroup.add(crown);

    // Articulated retracting Gold-Kapton Umbilical Swing Arm
    const swingPivot = new THREE.Group();
    swingPivot.position.set(-0.15, 2.25, 0);

    const armBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.55, 0.18, 0.22)), mats.goldKapton);
    armBeam.position.set(0.78, 0, 0);
    swingPivot.add(armBeam);

    const qdHead = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.34, 12)),
      mats.brushedSteel,
    );
    qdHead.rotation.z = Math.PI / 2;
    qdHead.position.set(1.55, 0, 0);
    swingPivot.add(qdHead);

    const qdRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.19, 0.03, 8, 16)), accentGlowMat);
    qdRing.rotation.y = Math.PI / 2;
    qdRing.position.set(1.62, 0, 0);
    swingPivot.add(qdRing);
    modelGroup.add(swingPivot);

    // Subtle wireframe/metallic rocket interface collar target
    const targetCollar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 2.4, 20)),
      mats.rocketMetallicHull,
    );
    targetCollar.position.set(1.45, 1.35, 0);
    modelGroup.add(targetCollar);

    animators.push((elapsed) => {
      const retract = Math.max(0, Math.sin(elapsed * 1.15)) * 0.72;
      swingPivot.rotation.y = retract;
    });

  // =========================================================================
  // 8. PAD 39A LAUNCH CONTROL CONSOLE
  // =========================================================================
  } else if (variant === 'pad-console') {
    recommendedDistance = 4.3;
    recommendedTargetY = 1.05;

    const ped = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.68, 1.05, 16)), mats.hullDark);
    ped.position.y = 0.55;
    modelGroup.add(ped);

    const deskShape = makeRoundedRectShape(2.15, 1.08, 0.16);
    const deskGeo = trackGeo(
      new THREE.ExtrudeGeometry(deskShape, {
        depth: 0.09,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
      }),
    );
    deskGeo.rotateX(Math.PI / 2);
    deskGeo.center();
    const deskTop = new THREE.Mesh(deskGeo, mats.weatheredSteel);
    deskTop.position.y = 1.1;
    modelGroup.add(deskTop);

    // Twin panoramic telemetry screens
    const screenMatL = trackMat(mats.createScreenMaterial('flight', '#38BDF8', 'PAD 39A GO/NO-GO'));
    const screenMatR = trackMat(mats.createScreenMaterial('cad', '#F97316', 'PROPULSION MATRIX'));

    for (const [sx, ry, sMat] of [
      [-0.5, 0.16, screenMatL],
      [0.5, -0.16, screenMatR],
    ] as const) {
      const bezel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.56, 0.05)), mats.hullDark);
      bezel.position.set(sx, 1.54, -0.2);
      bezel.rotation.y = ry;
      modelGroup.add(bezel);

      const pane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.84, 0.48)), sMat);
      pane.position.set(sx, 1.54, -0.172);
      pane.rotation.y = ry;
      modelGroup.add(pane);
    }

    // Armored Ignition Switch + glowing keycap strip
    const armCover = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.04, 0.24)), mats.craneYellow);
    armCover.position.set(0.55, 1.18, 0.22);
    modelGroup.add(armCover);

    const igniteBtn = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 14)), accentGlowMat);
    igniteBtn.position.set(0.55, 1.15, 0.22);
    modelGroup.add(igniteBtn);

    // Floating holographic trajectory dome above desk
    const holoDome = new THREE.Mesh(trackGeo(new THREE.IcosahedronGeometry(0.26, 1)), mats.holoGlow);
    holoDome.position.set(0, 1.55, 0.22);
    modelGroup.add(holoDome);

    animators.push((elapsed, delta) => {
      holoDome.rotation.y += delta * 1.4;
      armCover.rotation.x = -(Math.sin(elapsed * 1.3) * 0.5 + 0.5) * 0.75;
    });

  // =========================================================================
  // 9. VACUUM-JACKETED CRYO SPHERES & FAST-FILL MANIFOLD
  // =========================================================================
  } else if (variant === 'cryo-pipes') {
    recommendedDistance = 5.2;
    recommendedTargetY = 1.15;

    for (const side of [-1, 1]) {
      const legRing = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.55, 0.65, 0.35, 12)),
        mats.hullDark,
      );
      legRing.position.set(side * 0.92, 0.2, 0);
      modelGroup.add(legRing);

      const sphere = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.72, 22, 16)), mats.rocketMetallicHull);
      sphere.position.set(side * 0.92, 1.05, 0);
      modelGroup.add(sphere);

      const band = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(0.73, 0.032, 8, 28)),
        side === -1 ? cryoFrostMat : mats.copperNozzle,
      );
      band.rotation.x = Math.PI / 2;
      band.position.set(side * 0.92, 1.05, 0);
      modelGroup.add(band);
    }

    // Interconnecting braided copper & titanium manifold pipework
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.92, 0.42, 0.45),
      new THREE.Vector3(-0.92, 0.25, 0.88),
      new THREE.Vector3(0, 0.25, 0.88),
      new THREE.Vector3(0.92, 0.25, 0.88),
      new THREE.Vector3(0.92, 0.42, 0.45),
    ]);
    modelGroup.add(
      new THREE.Mesh(trackGeo(new THREE.TubeGeometry(trunkCurve, 28, 0.085, 10, false)), mats.copperNozzle),
    );

    // Central isolation valve handwheel
    const valveBody = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 12)),
      mats.weatheredSteel,
    );
    valveBody.position.set(0, 0.36, 0.88);
    modelGroup.add(valveBody);

    const valveWheel = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.22, 0.025, 8, 18)),
      mats.craneYellow,
    );
    valveWheel.rotation.x = Math.PI / 2;
    valveWheel.position.set(0, 0.56, 0.88);
    modelGroup.add(valveWheel);

    // Animated cryo flow pulse beads moving along trunkCurve
    const flowBeads: Array<{ mesh: THREE.Mesh; offset: number }> = [];
    for (let i = 0; i < 6; i++) {
      const bead = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 10, 8)), cryoFrostMat);
      modelGroup.add(bead);
      flowBeads.push({ mesh: bead, offset: i / 6 });
    }

    animators.push((elapsed, delta) => {
      valveWheel.rotation.z += delta * 1.8;
      flowBeads.forEach((b) => {
        const u = (elapsed * 0.42 + b.offset) % 1;
        trunkCurve.getPointAt(u, b.mesh.position);
      });
    });

  // =========================================================================
  // 10. 120-TON OVERHEAD BRIDGE CRANE & TROLLEY HOIST
  // =========================================================================
  } else {
    recommendedDistance = 5.4;
    recommendedTargetY = 1.4;

    // Support gantry columns flanking bridge span
    for (const sx of [-1.45, 1.45]) {
      for (const sz of [-0.5, 0.5]) {
        const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 2.5, 0.14)), mats.weatheredSteel);
        col.position.set(sx, 1.25, sz);
        modelGroup.add(col);
      }
      const endTruck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.22, 1.25)), mats.craneYellow);
      endTruck.position.set(sx, 2.48, 0);
      modelGroup.add(endTruck);
    }

    // Twin Crane-Yellow Box Girders
    for (const gz of [-0.36, 0.36]) {
      const girder = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.1, 0.28, 0.2)), mats.craneYellow);
      girder.position.set(0, 2.55, gz);
      modelGroup.add(girder);
    }

    // Traversing Hoist Trolley + Cable + Hook + Miniature Test Stage Ring
    const trolley = new THREE.Group();
    trolley.position.set(0, 2.52, 0);
    const trolleyCart = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.65, 0.22, 0.92)), mats.hullDark);
    trolley.add(trolleyCart);

    const hoistRig = new THREE.Group();
    trolley.add(hoistRig);

    for (const cx of [-0.14, 0.14]) {
      const cable = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 6)), mats.brushedSteel);
      cable.position.set(cx, -0.72, 0);
      hoistRig.add(cable);
    }
    const hookBlock = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.2, 0.22)), mats.craneYellow);
    hookBlock.position.y = -1.35;
    hoistRig.add(hookBlock);

    const hook = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.14, 0.032, 8, 16, Math.PI * 1.4)),
      mats.titanium,
    );
    hook.position.y = -1.56;
    hoistRig.add(hook);

    const payloadRing = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.55, 0.55, 0.36, 20, 1, true)),
      mats.rocketMetallicHull,
    );
    payloadRing.position.y = -1.92;
    hoistRig.add(payloadRing);

    modelGroup.add(trolley);

    animators.push((elapsed) => {
      trolley.position.x = Math.sin(elapsed * 0.8) * 0.72;
      hoistRig.position.y = Math.sin(elapsed * 1.45) * 0.16;
    });
  }

  return {
    root,
    turntableGroup,
    recommendedDistance,
    recommendedTargetY,
    animate: (elapsed, delta, autoRotate) => {
      if (autoRotate) {
        turntableGroup.rotation.y += delta * 0.42;
      }
      for (const fn of animators) {
        fn(elapsed, delta);
      }
    },
    disposeLocalResources: () => {
      localGeometries.forEach((g) => g.dispose());
      localMaterials.forEach((m) => m.dispose());
    },
  };
}
