import * as THREE from 'three';
import type { RoleId } from '../types/mission';
import type { SpaceMaterialLibrary } from './materials';

export interface RoleVisualTheme {
  accentHex: number;
  packHex: number;
  visorHex: number;
  eyeHex: number;
}

export const ROLE_VISUAL_THEMES: Record<RoleId, RoleVisualTheme> = {
  systems: {
    accentHex: 0xf97316, // Mechanic — Orange
    packHex: 0xea580c,
    visorHex: 0xfb923c,
    eyeHex: 0xffedd5,
  },
  finance: {
    accentHex: 0xeab308, // Program Manager — Gold / Amber
    packHex: 0xca8a04,
    visorHex: 0xfacc15,
    eyeHex: 0xfef9c3,
  },
  science: {
    accentHex: 0x22c55e, // Scientist — Emerald Green
    packHex: 0x16a34a,
    visorHex: 0x4ade80,
    eyeHex: 0xdcfce7,
  },
  pilot: {
    accentHex: 0x3b82f6, // Engineer — Cyan / Blue
    packHex: 0x0284c7,
    visorHex: 0x38bdf8,
    eyeHex: 0xe0f2fe,
  },
};

export interface FloatingLimbAstronautRig {
  group: THREE.Group;
  headGroup: THREE.Group;
  torsoGroup: THREE.Group;
  leftHandGroup: THREE.Group;
  rightHandGroup: THREE.Group;
  leftFootGroup: THREE.Group;
  rightFootGroup: THREE.Group;
  accentMat: THREE.MeshStandardMaterial;
  visorTrimMat: THREE.MeshStandardMaterial;
  baseAccentColor: THREE.Color;
  baseVisorColor: THREE.Color;
  setRoleTheme: (roleId: RoleId, immediate?: boolean) => void;
}

export interface FloatingMotionParams {
  time: number;
  delta: number;
  moveSpeed?: number;
  reachTractorBeam?: number;
  gazeYaw?: number;
  gazePitch?: number;
  blinkPhaseOffset?: number;
  emergencyAlert?: boolean;
  alertIndex?: number;
}

export interface LobbyHeroCharacterRig {
  group: THREE.Group;
  setRole: (roleId: RoleId) => void;
  update: (elapsed: number, delta: number, visible: boolean) => void;
}

export type TabletAnimPhase = 'idle' | 'drawing' | 'open' | 'holstering';

export interface FirstPersonTabletAnimState {
  phase: TabletAnimPhase;
  rawProgress: number; // 0..1 linear progress within drawing (0.4s) or holstering (0.3s)
}

export interface FirstPersonFloatingHandsRig {
  group: THREE.Group;
  update: (
    elapsed: number,
    delta: number,
    moveSpeedNorm: number,
    firingBeam: boolean,
    roleId: RoleId,
    visible: boolean,
    tabletState?: FirstPersonTabletAnimState,
  ) => void;
  getRightEmitterWorldPos: (out: THREE.Vector3) => THREE.Vector3;
}

const _targetAccentColor = new THREE.Color();
const _targetVisorColor = new THREE.Color();
const _alertRed = new THREE.Color(0xef4444);
const _tabletGripLeft = new THREE.Vector3();
const _tabletGripRight = new THREE.Vector3();
const _tabletEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _fpLeftTarget = new THREE.Vector3();
const _fpRightTarget = new THREE.Vector3();
const _fpTabletTargetPos = new THREE.Vector3();
const _fpTabletTargetRot = new THREE.Vector3();

function makeRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/**
 * Builds a concentric spherical-surface patch (circle when superExp=2, rounded rectangle when >2)
 * with radial interior rings and a tucked edge skirt so facial decals hug the sphere cleanly
 * with zero clipping or z-fighting from any angle.
 */
function buildSphericalFeaturePatch(
  outerRadius: number,
  innerSkirtRadius: number,
  centerAzimuth: number,
  centerElevation: number,
  halfWidthRad: number,
  halfHeightRad: number,
  superExp = 2,
  tiltRad = 0,
  radialSegments = 36,
  concentricRings = 6,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const pushSphericalVertex = (az: number, el: number, r: number) => {
    const cosEl = Math.cos(el);
    const nx = cosEl * Math.sin(az);
    const ny = Math.sin(el);
    const nz = cosEl * Math.cos(az);
    positions.push(nx * r, ny * r, nz * r);
    normals.push(nx, ny, nz);
  };

  // Vertex 0: patch center on outerRadius
  pushSphericalVertex(centerAzimuth, centerElevation, outerRadius);

  const cosTilt = Math.cos(tiltRad);
  const sinTilt = Math.sin(tiltRad);
  const totalRings = concentricRings + 1; // last ring is tucked edge skirt

  for (let ring = 1; ring <= totalRings; ring++) {
    const isSkirt = ring === totalRings;
    const t = isSkirt ? 1.0 : ring / concentricRings;
    const r = isSkirt ? innerSkirtRadius : outerRadius;

    for (let seg = 0; seg <= radialSegments; seg++) {
      const a = (seg / radialSegments) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const denom = Math.pow(
        Math.pow(Math.abs(ca) / halfWidthRad, superExp) +
          Math.pow(Math.abs(sa) / halfHeightRad, superExp),
        1 / superExp,
      );
      const localU = (ca / denom) * t;
      const localV = (sa / denom) * t;

      const rotU = localU * cosTilt - localV * sinTilt;
      const rotV = localU * sinTilt + localV * cosTilt;
      pushSphericalVertex(centerAzimuth + rotU, centerElevation + rotV, r);
    }
  }

  const stride = radialSegments + 1;

  // Inner fan triangles (center 0 -> ring 1)
  for (let seg = 0; seg < radialSegments; seg++) {
    indices.push(0, 1 + seg, 1 + seg + 1);
  }

  // Concentric quad rings + tucked skirt
  for (let ring = 1; ring < totalRings; ring++) {
    const rowA = 1 + (ring - 1) * stride;
    const rowB = 1 + ring * stride;
    for (let seg = 0; seg < radialSegments; seg++) {
      const a0 = rowA + seg;
      const a1 = rowA + seg + 1;
      const b0 = rowB + seg;
      const b1 = rowB + seg + 1;
      indices.push(a0, b0, b1);
      indices.push(a0, b1, a1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

function buildThrusterWrenchProp(mats: SpaceMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  const orangeAccent = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: new THREE.Color(0xea580c),
    emissiveIntensity: 0.45,
    roughness: 0.32,
    metalness: 0.45,
  });

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.046, 0.62, 12),
    mats.brushedSteel,
  );
  shaft.castShadow = true;
  group.add(shaft);

  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.056, 0.22, 12),
    orangeAccent,
  );
  grip.position.y = -0.14;
  grip.castShadow = true;
  group.add(grip);

  const calRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.012, 8, 16),
    new THREE.MeshBasicMaterial({ color: 0xfdba74 }),
  );
  calRing.rotation.x = Math.PI / 2;
  calRing.position.y = 0.06;
  group.add(calRing);

  const jawHead = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.034, 8, 16, Math.PI * 1.42),
    mats.titanium,
  );
  jawHead.position.y = 0.34;
  jawHead.rotation.z = Math.PI * 0.28;
  jawHead.castShadow = true;
  group.add(jawHead);

  const boxJaw = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.026, 8, 14),
    mats.titanium,
  );
  boxJaw.position.y = -0.34;
  boxJaw.castShadow = true;
  group.add(boxJaw);

  group.rotation.z = -0.32;
  return group;
}

function buildEncryptedBriefcaseProp(mats: SpaceMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  const goldLockMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: new THREE.Color(0xeab308),
    emissiveIntensity: 0.65,
    roughness: 0.24,
    metalness: 0.78,
  });

  const caseShape = makeRoundedRectShape(0.48, 0.34, 0.045);
  const caseGeo = new THREE.ExtrudeGeometry(caseShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.016,
    bevelSegments: 2,
  });
  caseGeo.center();
  const caseMesh = new THREE.Mesh(caseGeo, mats.hullDark);
  caseMesh.castShadow = true;
  group.add(caseMesh);

  const seamBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.036, 0.165),
    mats.titanium,
  );
  seamBand.position.y = 0.03;
  group.add(seamBand);

  const handleArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.018, 8, 12, Math.PI),
    mats.brushedSteel,
  );
  handleArc.position.y = 0.18;
  group.add(handleArc);

  for (const sx of [-0.14, 0.14]) {
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.068, 0.175), goldLockMat);
    clasp.position.set(sx, 0.03, 0);
    group.add(clasp);
  }

  const cipherLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.022, 0.012),
    new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  );
  cipherLed.position.set(0, -0.05, 0.09);
  group.add(cipherLed);

  group.rotation.y = -0.35;
  return group;
}

function buildSampleCanisterProp(mats: SpaceMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  const emeraldCoreMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    emissive: new THREE.Color(0x22c55e),
    emissiveIntensity: 1.4,
    roughness: 0.18,
    metalness: 0.1,
  });

  const innerCore = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.078, 0.24, 6, 12),
    emeraldCoreMat,
  );
  group.add(innerCore);

  const glassChamber = new THREE.Mesh(
    new THREE.CylinderGeometry(0.132, 0.132, 0.34, 16, 1, true),
    mats.glassPanel,
  );
  group.add(glassChamber);

  for (const sy of [-0.2, 0.2]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.155, 0.155, 0.075, 16),
      mats.titanium,
    );
    cap.position.y = sy;
    cap.castShadow = true;
    group.add(cap);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.014, 6, 18),
      emeraldCoreMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = sy * 0.82;
    group.add(ring);
  }

  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.38, 6),
      mats.brushedSteel,
    );
    strut.position.set(Math.cos(a) * 0.145, 0, Math.sin(a) * 0.145);
    group.add(strut);
  }

  group.rotation.z = 0.18;
  return group;
}

function buildTelemetryScannerProp(mats: SpaceMaterialLibrary): THREE.Group {
  const group = new THREE.Group();

  const cyanTrimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: new THREE.Color(0x0284c7),
    emissiveIntensity: 0.95,
    roughness: 0.22,
    metalness: 0.45,
  });

  // Rugged aerospace handheld scanner chassis
  const bodyShape = makeRoundedRectShape(0.32, 0.44, 0.045);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  bodyGeo.center();
  const body = new THREE.Mesh(bodyGeo, mats.hullDark);
  body.castShadow = true;
  group.add(body);

  // Waveform / Telemetry LCD screen
  const screenMat = mats.createScreenMaterial('orbitmap', '#38BDF8', 'TELEMETRY SCAN');
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.20), screenMat);
  screen.position.set(0, -0.02, 0.042);
  group.add(screen);

  // Top precision RF / optical scanner emitter dish & laser lens
  const dishRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.082, 0.014, 8, 22),
    mats.brushedSteel,
  );
  dishRim.position.set(0, 0.23, 0.015);
  dishRim.rotation.x = Math.PI * 0.22;
  group.add(dishRim);

  const lensCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 14, 10),
    cyanTrimMat,
  );
  lensCore.position.set(0, 0.23, 0.025);
  group.add(lensCore);

  // Dual ergonomic cyan bumper rails
  for (const sx of [-0.175, 0.175]) {
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.24, 4, 8), cyanTrimMat);
    grip.position.set(sx, -0.03, 0);
    group.add(grip);
  }

  // Side high-gain whip antenna
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.012, 0.18, 8),
    mats.brushedSteel,
  );
  antenna.position.set(0.125, 0.27, -0.01);
  group.add(antenna);

  group.rotation.y = -0.32;
  group.rotation.x = -0.14;
  return group;
}

/**
 * Canonical 6-part floating-limb astronaut / technician rig used across the entire experience:
 *   1) Floating Spherical Head (uniform, seamless 360° solid white SphereGeometry)
 *   2) Vertical Pill / Oval Torso (smooth vertical CapsuleGeometry + flush role-colored chest trim)
 *   3) Two Floating Spherical Hands (detached SphereGeometry with role-colored cuff rings — zero arms)
 *   4) Two Floating Horizontal Oval Feet (detached wide flat ovals with role-colored trim — zero legs)
 * Every part hovers independently with crisp, visible air gaps between all segments.
 */
export function buildFloatingLimbAstronaut(
  mats: SpaceMaterialLibrary,
  options: {
    roleId?: RoleId;
    accentHex?: string;
    suitHex?: number;
    scale?: number;
    name?: string;
  } = {},
): FloatingLimbAstronautRig {
  const initialTheme = options.roleId ? ROLE_VISUAL_THEMES[options.roleId] : ROLE_VISUAL_THEMES.systems;
  const parsedHex = options.accentHex ? new THREE.Color(options.accentHex).getHex() : initialTheme.accentHex;
  const visorHex = options.roleId ? initialTheme.visorHex : parsedHex;

  const group = new THREE.Group();
  if (options.name) {
    group.name = options.name;
  }

  const suitMat =
    options.suitHex !== undefined
      ? new THREE.MeshStandardMaterial({
          color: options.suitHex,
          roughness: 0.34,
          metalness: 0.14,
        })
      : mats.hullWhite;

  const baseAccentColor = new THREE.Color(parsedHex);
  const baseVisorColor = new THREE.Color(visorHex);

  const accentMat = new THREE.MeshStandardMaterial({
    color: parsedHex,
    emissive: new THREE.Color(parsedHex),
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.32,
  });

  const visorTrimMat = new THREE.MeshStandardMaterial({
    color: visorHex,
    emissive: new THREE.Color(visorHex),
    emissiveIntensity: 1.25,
    roughness: 0.2,
    metalness: 0.22,
  });

  // Soft floor contact shadow anchoring the hovering figure
  const contactDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 24),
    mats.contactShadow,
  );
  contactDisc.rotation.x = -Math.PI / 2;
  contactDisc.position.y = 0.012;
  group.add(contactDisc);

  // =========================================================================
  // PARTS 5 & 6: TWO FLOATING HORIZONTAL OVAL FEET (detached at y = 0.095)
  // =========================================================================
  const createFloatingOvalFoot = (side: -1 | 1) => {
    const footGroup = new THREE.Group();
    footGroup.position.set(side * 0.13, 0.095, 0.025);

    const ovalBody = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), suitMat);
    ovalBody.scale.set(0.86, 0.52, 1.48);
    ovalBody.castShadow = true;
    footGroup.add(ovalBody);

    // Role-colored sole perimeter trim hugging the horizontal oval
    const soleRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.092, 0.012, 8, 22),
      accentMat,
    );
    soleRim.rotation.x = Math.PI / 2;
    soleRim.scale.set(0.88, 1.48, 0.85);
    soleRim.position.y = -0.014;
    footGroup.add(soleRim);

    group.add(footGroup);
    return footGroup;
  };

  const leftFootGroup = createFloatingOvalFoot(-1);
  const rightFootGroup = createFloatingOvalFoot(1);

  // =========================================================================
  // PART 2: VERTICAL PILL / OVAL TORSO (detached above feet, y = 0.62)
  // Clean air gap below (~0.14m to feet) and clean air gap above (~0.11m to head)
  // =========================================================================
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.62, 0);
  group.add(torsoGroup);

  const torsoPill = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.195, 0.27, 14, 24),
    suitMat,
  );
  torsoPill.castShadow = true;
  torsoGroup.add(torsoPill);

  // Flush role-colored lower waist ring & chest mission badge trim (zero bulk protruding)
  const torsoTrimBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.196, 0.013, 8, 28),
    accentMat,
  );
  torsoTrimBand.rotation.x = Math.PI / 2;
  torsoTrimBand.position.y = -0.11;
  torsoGroup.add(torsoTrimBand);

  const chestBezel = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.038, 0.11, 6, 12),
    mats.hullDark,
  );
  chestBezel.rotation.z = Math.PI / 2;
  chestBezel.position.set(0, 0.085, 0.175);
  torsoGroup.add(chestBezel);

  const chestCoreLed = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.024, 0.095, 6, 10),
    visorTrimMat,
  );
  chestCoreLed.rotation.z = Math.PI / 2;
  chestCoreLed.position.set(0, 0.085, 0.188);
  torsoGroup.add(chestCoreLed);

  // =========================================================================
  // PARTS 3 & 4: TWO FLOATING SPHERICAL HANDS (detached at sides, y = 0.61)
  // Clean air gap (~0.08m) from torso edges — ZERO connecting arms or joints
  // =========================================================================
  const createFloatingHand = (side: -1 | 1) => {
    const handGroup = new THREE.Group();
    handGroup.position.set(side * 0.355, 0.61, 0.045);

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.074, 20, 14), suitMat);
    sphere.castShadow = true;
    handGroup.add(sphere);

    const roleCuffBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.073, 0.011, 8, 20),
      accentMat,
    );
    roleCuffBand.rotation.x = Math.PI / 2;
    handGroup.add(roleCuffBand);

    group.add(handGroup);
    return handGroup;
  };

  const leftHandGroup = createFloatingHand(-1);
  const rightHandGroup = createFloatingHand(1);

  // =========================================================================
  // PART 1: FLOATING SPHERICAL HEAD (detached above torso, y = 1.29)
  // Expressive asymmetrical face (+Z) & role-colored side ear-pods (±X)
  // =========================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.29, 0.01);
  group.add(headGroup);

  const headSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.242, 40, 28),
    mats.hullWhite,
  );
  headSphere.castShadow = true;
  headGroup.add(headSphere);

  // Two role-colored cylindrical/rounded side ear-pods (±X)
  for (const side of [-1, 1] as const) {
    const earPod = new THREE.Group();
    earPod.position.set(side * 0.242, 0.0, 0.0);

    const earCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.082, 0.056, 24),
      accentMat,
    );
    earCylinder.rotation.z = side * -(Math.PI / 2);
    earCylinder.castShadow = true;
    earPod.add(earCylinder);

    const earCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 20, 14),
      accentMat,
    );
    earCap.scale.set(0.48, 1.0, 1.0);
    earCap.position.x = side * 0.026;
    earCap.castShadow = true;
    earPod.add(earCap);

    const earCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.081, 0.011, 8, 24),
      mats.titanium,
    );
    earCollar.rotation.y = Math.PI / 2;
    earCollar.position.x = side * -0.008;
    earPod.add(earCollar);

    const earGlowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.0065, 6, 20),
      visorTrimMat,
    );
    earGlowRing.rotation.y = Math.PI / 2;
    earGlowRing.position.x = side * 0.036;
    earPod.add(earGlowRing);

    headGroup.add(earPod);
  }

  // Facial materials (crisp contrast, polygonOffset protects against distant z-fighting)
  const faceBlackMat = new THREE.MeshStandardMaterial({
    color: 0x090d14,
    roughness: 0.26,
    metalness: 0.14,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const faceWhiteEyeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.14,
    roughness: 0.2,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const facePupilMat = new THREE.MeshStandardMaterial({
    color: 0x05070b,
    roughness: 0.16,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });

  // Viewer's left side (-X local): asymmetrical black visor patch + large white circular eye + dark pupil
  const leftVisorPatch = new THREE.Mesh(
    buildSphericalFeaturePatch(0.246, 0.2395, -0.34, 0.03, 0.34, 0.29, 4.2, -0.05, 40, 6),
    faceBlackMat,
  );
  headGroup.add(leftVisorPatch);

  const leftWhiteEye = new THREE.Mesh(
    buildSphericalFeaturePatch(0.2485, 0.244, -0.34, 0.03, 0.175, 0.175, 2.0, 0, 32, 4),
    faceWhiteEyeMat,
  );
  headGroup.add(leftWhiteEye);

  const leftDarkPupil = new THREE.Mesh(
    buildSphericalFeaturePatch(0.2505, 0.2465, -0.335, 0.03, 0.082, 0.082, 2.0, 0, 24, 3),
    facePupilMat,
  );
  headGroup.add(leftDarkPupil);

  // Viewer's right white side (+X local): small round dark dot eye + short flat dark eyebrow
  const rightDotEye = new THREE.Mesh(
    buildSphericalFeaturePatch(0.2455, 0.24, 0.34, 0.01, 0.076, 0.076, 2.0, 0, 24, 3),
    facePupilMat,
  );
  headGroup.add(rightDotEye);

  const rightEyebrow = new THREE.Mesh(
    buildSphericalFeaturePatch(0.2458, 0.24, 0.34, 0.175, 0.145, 0.034, 4.5, -0.04, 28, 3),
    facePupilMat,
  );
  headGroup.add(rightEyebrow);

  if (options.scale && options.scale !== 1) {
    group.scale.setScalar(options.scale);
  }

  function setRoleTheme(roleId: RoleId, immediate = false) {
    const theme = ROLE_VISUAL_THEMES[roleId];
    baseAccentColor.setHex(theme.accentHex);
    baseVisorColor.setHex(theme.visorHex);
    if (immediate) {
      accentMat.color.copy(baseAccentColor);
      accentMat.emissive.copy(baseAccentColor);
      visorTrimMat.color.copy(baseVisorColor);
      visorTrimMat.emissive.copy(baseVisorColor);
    }
  }

  return {
    group,
    headGroup,
    torsoGroup,
    leftHandGroup,
    rightHandGroup,
    leftFootGroup,
    rightFootGroup,
    accentMat,
    visorTrimMat,
    baseAccentColor,
    baseVisorColor,
    setRoleTheme,
  };
}

/**
 * Shared procedural floating animation for every 6-part character:
 *   - Head bobs weightlessly and rotates gently toward gaze target.
 *   - Pill torso floats slightly out of phase and leans subtly with motion/reach.
 *   - Floating spherical hands hover/sway symmetrically at mid-torso OR reach forward
 *     when projecting/guiding a Tractor Beam / repair tether.
 *   - Floating horizontal oval feet alternate in a playful gliding/stepping ellipse.
 */
export function updateFloatingCharacterMotion(
  rig: FloatingLimbAstronautRig,
  params: FloatingMotionParams,
): void {
  const {
    time,
    delta,
    moveSpeed = 0,
    reachTractorBeam = 0,
    gazeYaw = 0,
    gazePitch = 0,
    blinkPhaseOffset = 0,
    emergencyAlert = false,
    alertIndex = 0,
  } = params;

  // Smooth role color & Red Alert chest core transition
  const colorAlpha = 1 - Math.exp(-10 * delta);
  _targetAccentColor.copy(rig.baseAccentColor);
  _targetVisorColor.copy(emergencyAlert ? _alertRed : rig.baseVisorColor);

  rig.accentMat.color.lerp(_targetAccentColor, colorAlpha);
  rig.accentMat.emissive.lerp(_targetAccentColor, colorAlpha);
  rig.visorTrimMat.color.lerp(_targetVisorColor, colorAlpha);
  rig.visorTrimMat.emissive.lerp(_targetVisorColor, colorAlpha);
  rig.visorTrimMat.emissiveIntensity = emergencyAlert
    ? 1.35 + Math.abs(Math.sin(time * 10 + alertIndex)) * 0.85
    : 1.25;

  const dampAlpha = 1 - Math.exp(-10 * delta);
  const speedNorm = THREE.MathUtils.clamp(moveSpeed, 0, 1.5);
  const reach = THREE.MathUtils.clamp(reachTractorBeam, 0, 1);

  // 1) Floating Spherical Head: weightless bob and gentle gaze tilt
  const headBobY = 1.29 + Math.sin(time * 2.25 + blinkPhaseOffset) * 0.022 + speedNorm * 0.014;
  rig.headGroup.position.y = THREE.MathUtils.lerp(rig.headGroup.position.y, headBobY, dampAlpha);
  rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, gazeYaw, 5.5, delta);
  rig.headGroup.rotation.x = THREE.MathUtils.damp(
    rig.headGroup.rotation.x,
    -gazePitch + reach * 0.06,
    5.5,
    delta,
  );
  rig.headGroup.rotation.z = THREE.MathUtils.damp(
    rig.headGroup.rotation.z,
    -gazeYaw * 0.16 + Math.sin(time * 1.4 + blinkPhaseOffset) * 0.025,
    4.5,
    delta,
  );

  // 2) Vertical Pill Torso: gentle hover out of phase with head + lean into move/reach
  const torsoFloatY = 0.62 + Math.sin(time * 1.95 + blinkPhaseOffset + 0.7) * 0.018;
  rig.torsoGroup.position.y = THREE.MathUtils.lerp(rig.torsoGroup.position.y, torsoFloatY, dampAlpha);
  rig.torsoGroup.rotation.x = THREE.MathUtils.damp(
    rig.torsoGroup.rotation.x,
    speedNorm * 0.08 + reach * 0.1,
    6,
    delta,
  );
  rig.torsoGroup.rotation.z = THREE.MathUtils.damp(
    rig.torsoGroup.rotation.z,
    Math.cos(time * 1.3 + blinkPhaseOffset) * 0.025,
    5,
    delta,
  );

  // 3) Floating Horizontal Oval Feet: playful alternating gliding/stepping motion
  const stepRate = speedNorm > 0.05 ? 7.2 : 1.85;
  const stridePhase = time * stepRate + blinkPhaseOffset;
  const ampZ = speedNorm > 0.05 ? 0.145 * Math.min(1.2, speedNorm) : 0.032;
  const ampY = speedNorm > 0.05 ? 0.058 * Math.min(1.2, speedNorm) : 0.016;
  const pitchAmp = speedNorm > 0.05 ? 0.24 : 0.05;

  const lCos = Math.cos(stridePhase);
  const lSin = Math.sin(stridePhase);
  const rCos = Math.cos(stridePhase + Math.PI);
  const rSin = Math.sin(stridePhase + Math.PI);

  rig.leftFootGroup.position.set(
    -0.13,
    0.095 + Math.max(0, lCos) * ampY + Math.sin(time * 2.1 + blinkPhaseOffset) * 0.008,
    0.025 + lSin * ampZ,
  );
  rig.leftFootGroup.rotation.x = -lSin * pitchAmp;

  rig.rightFootGroup.position.set(
    0.13,
    0.095 + Math.max(0, rCos) * ampY + Math.cos(time * 2.1 + blinkPhaseOffset) * 0.008,
    0.025 + rSin * ampZ,
  );
  rig.rightFootGroup.rotation.x = -rSin * pitchAmp;

  // 4) Two Floating Spherical Hands: hover/sway symmetrically OR reach forward toward energy tether
  const idleSwayY = Math.sin(time * 2.4 + blinkPhaseOffset) * 0.028;
  const idleSwayZ = Math.cos(time * 1.7 + blinkPhaseOffset) * 0.022;
  const walkSwingZ = -lSin * ampZ * 0.72;

  const targetLeftX = THREE.MathUtils.lerp(-0.355, -0.32, reach);
  const targetLeftY = THREE.MathUtils.lerp(0.61 + idleSwayY, 0.65 + idleSwayY * 0.5, reach);
  const targetLeftZ = THREE.MathUtils.lerp(0.045 + idleSwayZ - walkSwingZ, 0.14, reach);

  rig.leftHandGroup.position.x = THREE.MathUtils.damp(rig.leftHandGroup.position.x, targetLeftX, 9, delta);
  rig.leftHandGroup.position.y = THREE.MathUtils.damp(rig.leftHandGroup.position.y, targetLeftY, 9, delta);
  rig.leftHandGroup.position.z = THREE.MathUtils.damp(rig.leftHandGroup.position.z, targetLeftZ, 9, delta);

  const rightFloatY = 0.61 - idleSwayY * 0.9;
  const rightFloatZ = 0.045 - idleSwayZ + walkSwingZ;
  const reachTremorX = Math.sin(time * 11) * 0.008 * reach;
  const reachTremorY = Math.cos(time * 9.5) * 0.01 * reach;

  const targetRightX = THREE.MathUtils.lerp(0.355, 0.22 + reachTremorX, reach);
  const targetRightY = THREE.MathUtils.lerp(rightFloatY, 0.71 + reachTremorY, reach);
  const targetRightZ = THREE.MathUtils.lerp(rightFloatZ, 0.42, reach);

  rig.rightHandGroup.position.x = THREE.MathUtils.damp(rig.rightHandGroup.position.x, targetRightX, 11, delta);
  rig.rightHandGroup.position.y = THREE.MathUtils.damp(rig.rightHandGroup.position.y, targetRightY, 11, delta);
  rig.rightHandGroup.position.z = THREE.MathUtils.damp(rig.rightHandGroup.position.z, targetRightZ, 11, delta);
}

export function buildLobbyHeroCharacter(mats: SpaceMaterialLibrary): LobbyHeroCharacterRig {
  const heroRig = buildFloatingLimbAstronaut(mats, {
    roleId: 'systems',
    name: 'LobbyHeroCharacter',
  });
  const { group } = heroRig;

  // Floating Role Prop hovering cleanly beside the character's right flank
  const floatingPropAnchor = new THREE.Group();
  floatingPropAnchor.position.set(0.78, 0.92, 0.16);
  group.add(floatingPropAnchor);

  const propHoloRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.01, 6, 28),
    heroRig.visorTrimMat,
  );
  propHoloRing.rotation.x = Math.PI / 2;
  propHoloRing.position.y = -0.26;
  floatingPropAnchor.add(propHoloRing);

  const roleProps: Record<RoleId, THREE.Group> = {
    systems: buildThrusterWrenchProp(mats),
    finance: buildEncryptedBriefcaseProp(mats),
    science: buildSampleCanisterProp(mats),
    pilot: buildTelemetryScannerProp(mats),
  };

  Object.values(roleProps).forEach((prop) => {
    prop.visible = false;
    floatingPropAnchor.add(prop);
  });
  roleProps.systems.visible = true;

  let currentRole: RoleId = 'systems';
  let propPopScale = 1;
  let gazeTimer = 0;
  let gazeTargetYaw = 0;
  let gazeTargetPitch = 0;

  function setRole(roleId: RoleId) {
    if (roleId === currentRole) return;
    currentRole = roleId;
    heroRig.setRoleTheme(roleId);
    (Object.keys(roleProps) as RoleId[]).forEach((rId) => {
      roleProps[rId].visible = rId === roleId;
    });
    propPopScale = 0.55;
  }

  function update(elapsed: number, delta: number, visible: boolean) {
    group.visible = visible;
    if (!visible) return;

    // Curious look-around gaze targets changing every ~2.6s (often glancing toward the hovering prop)
    gazeTimer += delta;
    if (gazeTimer >= 2.6) {
      gazeTimer = 0;
      const cycle = Math.floor(elapsed * 0.45) % 5;
      if (cycle === 0) {
        gazeTargetYaw = 0.34;
        gazeTargetPitch = 0.04;
      } else if (cycle === 1) {
        gazeTargetYaw = -0.26;
        gazeTargetPitch = 0.04;
      } else if (cycle === 2) {
        gazeTargetYaw = 0.28;
        gazeTargetPitch = -0.06;
      } else if (cycle === 3) {
        gazeTargetYaw = 0.0;
        gazeTargetPitch = 0.02;
      } else {
        gazeTargetYaw = -0.16;
        gazeTargetPitch = 0.08;
      }
    }

    updateFloatingCharacterMotion(heroRig, {
      time: elapsed,
      delta,
      moveSpeed: 0,
      reachTractorBeam: 0,
      gazeYaw: gazeTargetYaw,
      gazePitch: gazeTargetPitch,
      blinkPhaseOffset: 0.25,
    });

    // Floating role prop smooth levitation, spin & role-swap pop animation
    propPopScale = THREE.MathUtils.damp(propPopScale, 1, 10, delta);
    floatingPropAnchor.scale.setScalar(propPopScale);
    floatingPropAnchor.position.y = 0.92 + Math.sin(elapsed * 2.2) * 0.065;
    propHoloRing.rotation.z = elapsed * 0.9;

    const activeProp = roleProps[currentRole];
    activeProp.rotation.y = Math.sin(elapsed * 0.9) * 0.35 + elapsed * 0.38;
  }

  return {
    group,
    setRole,
    update,
  };
}

function buildPocketTabletProp(
  mats: SpaceMaterialLibrary,
  accentMat: THREE.MeshStandardMaterial,
): { tabletGroup: THREE.Group; screenMat: THREE.MeshStandardMaterial } {
  const tabletGroup = new THREE.Group();
  tabletGroup.name = 'FirstPersonPocketTablet';

  // 1) Sleek beveled aerospace brushed titanium metallic chassis
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x3b485b,
    roughness: 0.24,
    metalness: 0.86,
  });
  const bodyShape = makeRoundedRectShape(0.46, 0.30, 0.024);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  bodyGeo.center();
  const chassis = new THREE.Mesh(bodyGeo, chassisMat);
  tabletGroup.add(chassis);

  // 2) Precision anodized silver outer chamfer trim
  const trimRing = new THREE.Mesh(
    new THREE.BoxGeometry(0.466, 0.306, 0.006),
    mats.brushedSteel,
  );
  trimRing.position.z = -0.002;
  tabletGroup.add(trimRing);

  // 3) Dark glossy front glass bezel
  const glassBezelMat = new THREE.MeshStandardMaterial({
    color: 0x070b14,
    roughness: 0.14,
    metalness: 0.32,
  });
  const glassBezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.434, 0.276, 0.004),
    glassBezelMat,
  );
  glassBezel.position.z = 0.01;
  tabletGroup.add(glassBezel);

  // 4) Procedural illuminated telemetry screen texture
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = 320;
  const ctx = screenCanvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 512, 320);
  grad.addColorStop(0, '#070c18');
  grad.addColorStop(0.55, '#0d182d');
  grad.addColorStop(1, '#060a14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 320);

  // Top status bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(0, 0, 512, 34);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('KA-LINK // MISSION TABLET OS', 18, 22);
  ctx.fillStyle = '#34d399';
  ctx.fillText('72/72 READY', 392, 22);

  // 4 App tiles preview
  const tiles = [
    { x: 46, c1: '#0ea5e9', c2: '#2563eb', label: 'MISSIONS' },
    { x: 156, c1: '#14b8a6', c2: '#0f766e', label: 'SCHEDULE' },
    { x: 266, c1: '#6366f1', c2: '#7c3aed', label: 'A.R.I.A.' },
    { x: 376, c1: '#f43f5e', c2: '#9f1239', label: 'GATES' },
  ];
  tiles.forEach((tile) => {
    const tGrad = ctx.createLinearGradient(tile.x, 108, tile.x + 88, 196);
    tGrad.addColorStop(0, tile.c1);
    tGrad.addColorStop(1, tile.c2);
    ctx.fillStyle = tGrad;
    ctx.beginPath();
    ctx.roundRect(tile.x, 108, 88, 88, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(tile.label, tile.x + 8, 218);
  });

  // Bottom dock bar
  ctx.fillStyle = 'rgba(7, 11, 22, 0.92)';
  ctx.fillRect(0, 274, 512, 46);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 274);
  ctx.lineTo(512, 274);
  ctx.stroke();

  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex,
    emissiveMap: screenTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.1,
    roughness: 0.16,
    metalness: 0.08,
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.402, 0.248), screenMat);
  screenMesh.position.z = 0.013;
  tabletGroup.add(screenMesh);

  // 5) Left bezel optic sensor & status LED (mirrors TabletHud left bezel)
  const camRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0085, 0.0022, 8, 16),
    mats.brushedSteel,
  );
  camRing.position.set(-0.207, 0, 0.013);
  tabletGroup.add(camRing);

  const camLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.004, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
  );
  camLed.position.set(-0.207, 0, 0.0135);
  tabletGroup.add(camLed);

  // 6) Ergonomic left & right bezel grip rails with role-accented LED trim
  for (const side of [-1, 1] as const) {
    const rail = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.011, 0.20, 6, 10),
      mats.hullDark,
    );
    rail.position.set(side * 0.236, 0, 0.002);
    tabletGroup.add(rail);

    const trimStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.16, 0.008),
      accentMat,
    );
    trimStrip.position.set(side * 0.239, 0, 0.006);
    tabletGroup.add(trimStrip);
  }

  // 7) Top-right micro Ka-Link antenna stub & rear spine detail
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0045, 0.0065, 0.048, 8),
    mats.brushedSteel,
  );
  antenna.position.set(0.175, 0.168, -0.003);
  tabletGroup.add(antenna);

  const rearPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.14, 0.005),
    mats.titanium,
  );
  rearPlate.position.set(0, 0, -0.011);
  tabletGroup.add(rearPlate);

  tabletGroup.traverse((child) => {
    child.frustumCulled = false;
  });
  tabletGroup.visible = false;

  return { tabletGroup, screenMat };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep01(v: number): number {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
}

function easeOutExpo01(v: number): number {
  const x = clamp01(v);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/**
 * First-Person camera-attached Floating Spherical Hands so the player sees their
 * weightless detached hands bob while walking, reach forward toward the energy
 * tether whenever the Tractor Beam is active, and pull/holster the 3D mission tablet.
 */
export function buildFirstPersonFloatingHands(
  mats: SpaceMaterialLibrary,
): FirstPersonFloatingHandsRig {
  const group = new THREE.Group();
  group.name = 'FirstPersonFloatingHands';

  const cuffMat = new THREE.MeshStandardMaterial({
    color: ROLE_VISUAL_THEMES.systems.accentHex,
    emissive: new THREE.Color(ROLE_VISUAL_THEMES.systems.accentHex),
    emissiveIntensity: 0.65,
    roughness: 0.26,
    metalness: 0.35,
  });

  const emitterGlowMat = new THREE.MeshStandardMaterial({
    color: ROLE_VISUAL_THEMES.systems.visorHex,
    emissive: new THREE.Color(ROLE_VISUAL_THEMES.systems.visorHex),
    emissiveIntensity: 1.4,
    roughness: 0.16,
  });

  const createFpHand = () => {
    const hand = new THREE.Group();

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.064, 20, 14),
      mats.hullWhite,
    );
    hand.add(sphere);

    const roleCuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.063, 0.0095, 8, 22),
      cuffMat,
    );
    roleCuff.rotation.x = Math.PI / 2;
    hand.add(roleCuff);

    const palmDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 12, 8),
      emitterGlowMat,
    );
    palmDot.position.set(0, 0.005, -0.056);
    hand.add(palmDot);

    hand.traverse((child) => {
      child.frustumCulled = false;
    });
    group.add(hand);
    return { hand, palmDot };
  };

  const left = createFpHand();
  const right = createFpHand();
  left.hand.position.set(-0.34, -0.27, -0.62);
  right.hand.position.set(0.34, -0.27, -0.62);

  const { tabletGroup, screenMat } = buildPocketTabletProp(mats, cuffMat);
  group.add(tabletGroup);

  let beamLerp = 0;

  // Canonical pocket & viewing poses in camera-local coordinates
  const IDLE_LX = -0.34;
  const IDLE_LY = -0.27;
  const IDLE_LZ = -0.62;
  const IDLE_RX = 0.34;
  const IDLE_RY = -0.27;
  const IDLE_RZ = -0.62;

  const POCKET_X = 0.44;
  const POCKET_Y = -0.50;
  const POCKET_Z = -0.36;
  const POCKET_ROT_X = 0.88;
  const POCKET_ROT_Y = -0.95;
  const POCKET_ROT_Z = -0.48;

  const VIEW_X = 0.02;
  const VIEW_Y = -0.04;
  const VIEW_Z = -0.52;
  const VIEW_ROT_X = -0.08;
  const VIEW_ROT_Y = 0.0;
  const VIEW_ROT_Z = 0.0;

  function computeTabletGrips(tx: number, ty: number, tz: number, rx: number, ry: number, rz: number) {
    _tabletEuler.set(rx, ry, rz, 'YXZ');
    _tabletGripLeft.set(-0.268, 0.0, 0.016).applyEuler(_tabletEuler);
    _tabletGripLeft.x += tx;
    _tabletGripLeft.y += ty;
    _tabletGripLeft.z += tz;

    _tabletGripRight.set(0.268, 0.0, 0.016).applyEuler(_tabletEuler);
    _tabletGripRight.x += tx;
    _tabletGripRight.y += ty;
    _tabletGripRight.z += tz;
  }

  function update(
    elapsed: number,
    delta: number,
    moveSpeedNorm: number,
    firingBeam: boolean,
    roleId: RoleId,
    visible: boolean,
    tabletState?: FirstPersonTabletAnimState,
  ) {
    group.visible = visible;
    if (!visible) return;

    const theme = ROLE_VISUAL_THEMES[roleId];
    const colorAlpha = 1 - Math.exp(-10 * delta);
    _targetAccentColor.setHex(theme.accentHex);
    _targetVisorColor.setHex(theme.visorHex);
    cuffMat.color.lerp(_targetAccentColor, colorAlpha);
    cuffMat.emissive.lerp(_targetAccentColor, colorAlpha);
    emitterGlowMat.color.lerp(_targetVisorColor, colorAlpha);
    emitterGlowMat.emissive.lerp(_targetVisorColor, colorAlpha);

    const walkAmp = THREE.MathUtils.clamp(moveSpeedNorm, 0, 1.3);
    const swayFreq = walkAmp > 0.12 ? 7.0 : 2.1;
    const swayY = Math.sin(elapsed * swayFreq) * (0.008 + walkAmp * 0.018);
    const swayX = Math.cos(elapsed * swayFreq * 0.5) * (0.005 + walkAmp * 0.014);

    const safeDelta = Math.min(delta, 0.05);
    const handLerpAlpha = 1 - Math.exp(-12 * safeDelta);
    const tabletLerpAlpha = 1 - Math.exp(-18 * safeDelta);
    const phase = tabletState?.phase ?? 'idle';
    const raw = tabletState?.rawProgress ?? 0;
    const wasTabletVisible = tabletGroup.visible;

    if (phase === 'drawing') {
      // 0.45s butter-smooth first-person pocket-draw sequence
      beamLerp = THREE.MathUtils.damp(beamLerp, 0, 16, safeDelta);
      emitterGlowMat.emissiveIntensity = 0.85;

      const u = clamp01(raw);
      const reachPhase = smoothstep01(u / 0.22);
      const liftT = clamp01((u - 0.16) / 0.84);
      const eLift = easeOutExpo01(liftT);
      const eRot = smoothstep01(liftT);

      // Gentle arc outward during the pull so the chassis clears the suit smoothly
      const arcZ = Math.sin(liftT * Math.PI) * -0.065;
      const arcY = Math.sin(liftT * Math.PI) * 0.026;

      _fpTabletTargetPos.set(
        THREE.MathUtils.lerp(POCKET_X, VIEW_X, eLift),
        THREE.MathUtils.lerp(POCKET_Y, VIEW_Y, eLift) + arcY,
        THREE.MathUtils.lerp(POCKET_Z, VIEW_Z, eLift) + arcZ,
      );
      _fpTabletTargetRot.set(
        THREE.MathUtils.lerp(POCKET_ROT_X, VIEW_ROT_X, eRot),
        THREE.MathUtils.lerp(POCKET_ROT_Y, VIEW_ROT_Y, eRot),
        THREE.MathUtils.lerp(POCKET_ROT_Z, VIEW_ROT_Z, eRot),
      );

      tabletGroup.visible = u >= 0.12;
      if (tabletGroup.visible) {
        if (!wasTabletVisible) {
          tabletGroup.position.copy(_fpTabletTargetPos);
          tabletGroup.rotation.set(
            _fpTabletTargetRot.x,
            _fpTabletTargetRot.y,
            _fpTabletTargetRot.z,
            'YXZ',
          );
        } else {
          tabletGroup.position.x = THREE.MathUtils.lerp(
            tabletGroup.position.x,
            _fpTabletTargetPos.x,
            tabletLerpAlpha,
          );
          tabletGroup.position.y = THREE.MathUtils.lerp(
            tabletGroup.position.y,
            _fpTabletTargetPos.y,
            tabletLerpAlpha,
          );
          tabletGroup.position.z = THREE.MathUtils.lerp(
            tabletGroup.position.z,
            _fpTabletTargetPos.z,
            tabletLerpAlpha,
          );
          tabletGroup.rotation.set(
            THREE.MathUtils.lerp(tabletGroup.rotation.x, _fpTabletTargetRot.x, tabletLerpAlpha),
            THREE.MathUtils.lerp(tabletGroup.rotation.y, _fpTabletTargetRot.y, tabletLerpAlpha),
            THREE.MathUtils.lerp(tabletGroup.rotation.z, _fpTabletTargetRot.z, tabletLerpAlpha),
            'YXZ',
          );
        }
      }
      screenMat.emissiveIntensity = 0.08 + smoothstep01((u - 0.30) / 0.70) * 1.15;

      computeTabletGrips(
        _fpTabletTargetPos.x,
        _fpTabletTargetPos.y,
        _fpTabletTargetPos.z,
        _fpTabletTargetRot.x,
        _fpTabletTargetRot.y,
        _fpTabletTargetRot.z,
      );

      if (u < 0.22) {
        _fpRightTarget.set(
          THREE.MathUtils.lerp(IDLE_RX + swayX, _tabletGripRight.x, reachPhase),
          THREE.MathUtils.lerp(IDLE_RY - swayY, _tabletGripRight.y, reachPhase),
          THREE.MathUtils.lerp(IDLE_RZ, _tabletGripRight.z, reachPhase),
        );
        _fpLeftTarget.set(
          THREE.MathUtils.lerp(IDLE_LX - swayX, -0.30, reachPhase),
          THREE.MathUtils.lerp(IDLE_LY + swayY, -0.32, reachPhase),
          THREE.MathUtils.lerp(IDLE_LZ, -0.55, reachPhase),
        );
      } else {
        _fpRightTarget.copy(_tabletGripRight);
        const catchT = smoothstep01((u - 0.22) / 0.45);
        _fpLeftTarget.set(
          THREE.MathUtils.lerp(-0.30, _tabletGripLeft.x, catchT),
          THREE.MathUtils.lerp(-0.32, _tabletGripLeft.y, catchT),
          THREE.MathUtils.lerp(-0.55, _tabletGripLeft.z, catchT),
        );
      }
    } else if (phase === 'open') {
      // Active Grip Pose: gentle breathing sway along outer left and right bezels
      beamLerp = THREE.MathUtils.damp(beamLerp, 0, 14, safeDelta);
      emitterGlowMat.emissiveIntensity = 0.95;

      const breathX = Math.cos(elapsed * 1.15) * 0.003;
      const breathY = Math.sin(elapsed * 1.85) * 0.0055;
      const breathRotX = Math.sin(elapsed * 1.45) * 0.012;
      const breathRotZ = Math.cos(elapsed * 1.2) * 0.008;

      _fpTabletTargetPos.set(VIEW_X + breathX, VIEW_Y + breathY, VIEW_Z);
      _fpTabletTargetRot.set(VIEW_ROT_X + breathRotX, VIEW_ROT_Y, VIEW_ROT_Z + breathRotZ);

      tabletGroup.visible = true;
      if (!wasTabletVisible) {
        tabletGroup.position.copy(_fpTabletTargetPos);
        tabletGroup.rotation.set(
          _fpTabletTargetRot.x,
          _fpTabletTargetRot.y,
          _fpTabletTargetRot.z,
          'YXZ',
        );
      } else {
        tabletGroup.position.x = THREE.MathUtils.lerp(
          tabletGroup.position.x,
          _fpTabletTargetPos.x,
          tabletLerpAlpha,
        );
        tabletGroup.position.y = THREE.MathUtils.lerp(
          tabletGroup.position.y,
          _fpTabletTargetPos.y,
          tabletLerpAlpha,
        );
        tabletGroup.position.z = THREE.MathUtils.lerp(
          tabletGroup.position.z,
          _fpTabletTargetPos.z,
          tabletLerpAlpha,
        );
        tabletGroup.rotation.set(
          THREE.MathUtils.lerp(tabletGroup.rotation.x, _fpTabletTargetRot.x, tabletLerpAlpha),
          THREE.MathUtils.lerp(tabletGroup.rotation.y, _fpTabletTargetRot.y, tabletLerpAlpha),
          THREE.MathUtils.lerp(tabletGroup.rotation.z, _fpTabletTargetRot.z, tabletLerpAlpha),
          'YXZ',
        );
      }
      screenMat.emissiveIntensity = 1.22 + Math.sin(elapsed * 2.4) * 0.05;

      computeTabletGrips(
        _fpTabletTargetPos.x,
        _fpTabletTargetPos.y,
        _fpTabletTargetPos.z,
        _fpTabletTargetRot.x,
        _fpTabletTargetRot.y,
        _fpTabletTargetRot.z,
      );

      const microHoverL = Math.sin(elapsed * 2.3) * 0.0025;
      const microHoverR = Math.cos(elapsed * 2.3) * 0.0025;
      _fpLeftTarget.set(_tabletGripLeft.x, _tabletGripLeft.y + microHoverL, _tabletGripLeft.z);
      _fpRightTarget.set(_tabletGripRight.x, _tabletGripRight.y + microHoverR, _tabletGripRight.z);
    } else if (phase === 'holstering') {
      // 0.35s smooth reverse holster animation: tilt downward, slide into bottom-right pocket, glide hands to idle
      beamLerp = THREE.MathUtils.damp(beamLerp, 0, 16, safeDelta);
      emitterGlowMat.emissiveIntensity = 0.78;

      const v = clamp01(raw);
      const tuckT = smoothstep01(v / 0.80);
      const downwardTilt = Math.sin(clamp01(v / 0.80) * Math.PI) * 0.24;
      const arcZ = Math.sin(clamp01(v / 0.80) * Math.PI) * -0.045;

      _fpTabletTargetPos.set(
        THREE.MathUtils.lerp(VIEW_X, POCKET_X, tuckT),
        THREE.MathUtils.lerp(VIEW_Y, POCKET_Y, tuckT),
        THREE.MathUtils.lerp(VIEW_Z, POCKET_Z, tuckT) + arcZ,
      );
      _fpTabletTargetRot.set(
        THREE.MathUtils.lerp(VIEW_ROT_X, POCKET_ROT_X, tuckT) + downwardTilt,
        THREE.MathUtils.lerp(VIEW_ROT_Y, POCKET_ROT_Y, tuckT),
        THREE.MathUtils.lerp(VIEW_ROT_Z, POCKET_ROT_Z, tuckT),
      );

      tabletGroup.visible = v < 0.84;
      if (tabletGroup.visible) {
        tabletGroup.position.x = THREE.MathUtils.lerp(
          tabletGroup.position.x,
          _fpTabletTargetPos.x,
          tabletLerpAlpha,
        );
        tabletGroup.position.y = THREE.MathUtils.lerp(
          tabletGroup.position.y,
          _fpTabletTargetPos.y,
          tabletLerpAlpha,
        );
        tabletGroup.position.z = THREE.MathUtils.lerp(
          tabletGroup.position.z,
          _fpTabletTargetPos.z,
          tabletLerpAlpha,
        );
        tabletGroup.rotation.set(
          THREE.MathUtils.lerp(tabletGroup.rotation.x, _fpTabletTargetRot.x, tabletLerpAlpha),
          THREE.MathUtils.lerp(tabletGroup.rotation.y, _fpTabletTargetRot.y, tabletLerpAlpha),
          THREE.MathUtils.lerp(tabletGroup.rotation.z, _fpTabletTargetRot.z, tabletLerpAlpha),
          'YXZ',
        );
      }
      screenMat.emissiveIntensity = THREE.MathUtils.lerp(1.2, 0.05, smoothstep01(v / 0.35));

      computeTabletGrips(
        _fpTabletTargetPos.x,
        _fpTabletTargetPos.y,
        _fpTabletTargetPos.z,
        _fpTabletTargetRot.x,
        _fpTabletTargetRot.y,
        _fpTabletTargetRot.z,
      );

      const leftReleaseT = smoothstep01((v - 0.10) / 0.72);
      _fpLeftTarget.set(
        THREE.MathUtils.lerp(_tabletGripLeft.x, IDLE_LX - swayX, leftReleaseT),
        THREE.MathUtils.lerp(_tabletGripLeft.y, IDLE_LY + swayY, leftReleaseT),
        THREE.MathUtils.lerp(_tabletGripLeft.z, IDLE_LZ, leftReleaseT),
      );

      if (v < 0.76) {
        _fpRightTarget.copy(_tabletGripRight);
      } else {
        const rightReturnT = smoothstep01((v - 0.76) / 0.24);
        _fpRightTarget.set(
          THREE.MathUtils.lerp(_tabletGripRight.x, IDLE_RX + swayX, rightReturnT),
          THREE.MathUtils.lerp(_tabletGripRight.y, IDLE_RY - swayY, rightReturnT),
          THREE.MathUtils.lerp(_tabletGripRight.z, IDLE_RZ, rightReturnT),
        );
      }
    } else {
      // Normal First-Person idle / walk / Tractor Beam stance
      tabletGroup.visible = false;

      beamLerp = THREE.MathUtils.damp(beamLerp, firingBeam ? 1 : 0, 12, safeDelta);
      emitterGlowMat.emissiveIntensity = firingBeam
        ? 2.2 + Math.sin(elapsed * 16) * 0.45
        : 0.75;

      _fpLeftTarget.set(
        IDLE_LX - swayX - beamLerp * 0.02,
        IDLE_LY + swayY + beamLerp * 0.02,
        IDLE_LZ - beamLerp * 0.04,
      );

      const reachVibration = beamLerp * Math.sin(elapsed * 18) * 0.004;
      _fpRightTarget.set(
        THREE.MathUtils.lerp(IDLE_RX + swayX, 0.21 + reachVibration, beamLerp),
        THREE.MathUtils.lerp(IDLE_RY - swayY, -0.17 + reachVibration, beamLerp),
        THREE.MathUtils.lerp(IDLE_RZ, -0.78, beamLerp),
      );
    }

    // Smooth frame-rate-independent THREE.MathUtils.lerp (delta * 12) eliminates any snap or teleportation
    left.hand.position.x = THREE.MathUtils.lerp(left.hand.position.x, _fpLeftTarget.x, handLerpAlpha);
    left.hand.position.y = THREE.MathUtils.lerp(left.hand.position.y, _fpLeftTarget.y, handLerpAlpha);
    left.hand.position.z = THREE.MathUtils.lerp(left.hand.position.z, _fpLeftTarget.z, handLerpAlpha);

    right.hand.position.x = THREE.MathUtils.lerp(right.hand.position.x, _fpRightTarget.x, handLerpAlpha);
    right.hand.position.y = THREE.MathUtils.lerp(right.hand.position.y, _fpRightTarget.y, handLerpAlpha);
    right.hand.position.z = THREE.MathUtils.lerp(right.hand.position.z, _fpRightTarget.z, handLerpAlpha);
  }

  function getRightEmitterWorldPos(out: THREE.Vector3): THREE.Vector3 {
    right.palmDot.getWorldPosition(out);
    return out;
  }

  return {
    group,
    update,
    getRightEmitterWorldPos,
  };
}
