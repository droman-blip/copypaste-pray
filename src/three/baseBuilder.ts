import * as THREE from 'three';
import { GROUND_FLOOR_Y, INTERACTABLES_MAP, ROOMS, ROOM_MAP } from '../data/missionData';
import type {
  InteractableId,
  MezzanineBounds,
  OrbitalTrajectoryConfig,
  RoleId,
  RoomId,
  TargetBodyId,
} from '../types/mission';
import { updateFloatingCharacterMotion } from './characterBuilder';
import {
  buildAerospaceRadarStation,
  buildAnimatedFilingDrawer,
  buildBeveledFolder,
  buildBookshelfWithBooks,
  buildCoffeeMug,
  buildCommsTerminal,
  buildCompressorUnit,
  buildCurvedDeskWorkstation,
  buildDeskLamp,
  buildDraftingTableWithBlueprints,
  buildErgonomicChair,
  buildFloorCable,
  buildGasBottleRack,
  buildKeyboardAndMouse,
  buildLockerBank,
  buildMezzanineRailing,
  buildMicroscopeAndCentrifugeBench,
  buildPanoramicMonitor,
  buildPottedPlant,
  buildRepoCrewBot,
  buildRollingToolCart,
  buildSampleTubeRack,
  buildScaleRocketModel,
  buildServerTelemetryRack,
  buildStandingScheduleBoard,
  buildStandingWhiteboard,
  buildStylizedTechnician,
  buildTechCrateCluster,
  buildVabWallSegment,
  buildWallPoster,
  buildWhiteboard,
  makeAccentMat,
  makeRoundedRectShape,
  registerInteractableObject,
  type AerospaceRadarRig,
  type InteractableRegistryItem,
  type RepoCrewBotRig,
} from './furnitureBuilder';
import {
  buildCargoObjects,
  buildHangarAssemblyPad,
  buildImpactSparkPool,
  buildTractorBeamEffect,
  type CargoObject3D,
  type HangarAssemblyPad3D,
  type ImpactSparkPool,
  type TractorBeamVisual,
} from './cargoBuilder';
import type { ScreenTheme, SpaceMaterialLibrary } from './materials';
import { createLaunchCinematicRig, type LaunchCinematicRig } from './launchCinematic';
import { buildModularRocket, type RocketAssembly } from './rocketBuilder';

const _auraBlueColor = new THREE.Color(0x38bdf8);
const _alertRedColor = new THREE.Color(0xef4444);
const _botLookLocal = new THREE.Vector3();

interface AlertLightTarget {
  light: THREE.PointLight;
  spotLights: Array<{ spot: THREE.SpotLight; baseIntensity: number }>;
  beaconRig: THREE.Group;
  beaconSpot: THREE.SpotLight;
  beaconDomeMat: THREE.MeshStandardMaterial;
  baseLightColor: THREE.Color;
  baseLightIntensity: number;
  accentMat: THREE.MeshStandardMaterial;
  baseAccentColor: THREE.Color;
}

export interface SpaceBaseScene {
  root: THREE.Group;
  rocket: RocketAssembly;
  clickTargets: THREE.Object3D[];
  interactableTargets: THREE.Object3D[];
  interactableRegistry: Record<string, InteractableRegistryItem>;
  cargoObjects: Record<string, CargoObject3D>;
  cargoTargets: THREE.Object3D[];
  hangarAssemblyPad: HangarAssemblyPad3D;
  tractorBeam: TractorBeamVisual;
  impactSparks: ImpactSparkPool;
  crewBots: RepoCrewBotRig[];
  roomRings: Record<string, THREE.Mesh>;
  roofGroups: Record<string, THREE.Group>;
  corridorGroup: THREE.Group;
  gantryArm: THREE.Group;
  craneTrolley: THREE.Group;
  holoGlobe: THREE.Group;
  scienceHolo: THREE.Group;
  radarDish: THREE.Group;
  robotArm: THREE.Group;
  skyDome: THREE.Mesh;
  launchCinematic: LaunchCinematicRig;
  setTargetPlanet: (targetBody: TargetBodyId) => void;
  setHologramTrajectory: (config: OrbitalTrajectoryConfig | null) => void;
  getPilotHologramCameraPose: (outPos: THREE.Vector3, outLookAt: THREE.Vector3) => boolean;
  updateMeetingCinematic: (elapsedSec: number, delta: number, active: boolean) => void;
  getInteractableAnchor: (id: InteractableId, out: THREE.Vector3) => boolean;
  getInteractableCameraPose: (
    id: InteractableId,
    outPos: THREE.Vector3,
    outLookAt: THREE.Vector3,
  ) => boolean;
  updateDynamicElements: (
    time: number,
    delta: number,
    activeRoom: RoomId,
    hoveredRoom: RoomId | null,
    isLaunching: boolean,
    hoveredInteractableId: InteractableId | null,
    inFirstPerson: boolean,
    focusedInteractableId: InteractableId | null,
    emergencyAlert?: boolean,
    cameraWorldPos?: THREE.Vector3,
    carryingCargo?: boolean,
    showCrewAvatars?: boolean,
  ) => void;
}

interface RoomShellTheme {
  wallMat: THREE.Material;
  floorMat: THREE.Material;
  interiorLightColor: number;
  interiorLightIntensity: number;
}

const HOVER_NO_SCALE_IDS = new Set<string>([
  'hng-nozzles',
  'hng-fuel-tank',
  'hng-oxidizer-tank',
  'hng-interstage',
  'hng-fairing',
  'hng-avionics',
  'hng-umbilical',
  'hng-cryo-pipes',
  'hng-crane',
  'mtg-holo',
]);

function createCoastalSkyDome(): THREE.Mesh {
  const skyGeo = new THREE.SphereGeometry(280, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x1d4ed8) },
      midColor: { value: new THREE.Color(0x38bdf8) },
      horizonColor: { value: new THREE.Color(0xdbeafe) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
        col = mix(col, topColor, smoothstep(0.28, 0.85, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(skyGeo, skyMat);
}

function createCapeCanaveralEnvironment(mats: SpaceMaterialLibrary): {
  envGroup: THREE.Group;
  skyDome: THREE.Mesh;
} {
  const envGroup = new THREE.Group();
  const skyDome = createCoastalSkyDome();
  envGroup.add(skyDome);

  const terrain = new THREE.Mesh(
    new THREE.CylinderGeometry(235, 245, 1.0, 48),
    mats.terrainGrass,
  );
  terrain.position.set(-28, -0.52, 0);
  terrain.receiveShadow = true;
  envGroup.add(terrain);

  const beachShape = makeRoundedRectShape(24, 420, 6);
  const beachGeo = new THREE.ExtrudeGeometry(beachShape, { depth: 0.5, bevelEnabled: false });
  beachGeo.rotateX(Math.PI / 2);
  const beach = new THREE.Mesh(beachGeo, mats.sandBeach);
  beach.position.set(84, -0.05, 0);
  beach.receiveShadow = true;
  envGroup.add(beach);

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(340, 520), mats.oceanWater);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(220, -0.22, 0);
  ocean.receiveShadow = true;
  envGroup.add(ocean);

  const apron = new THREE.Mesh(
    new THREE.CylinderGeometry(72, 74, 0.28, 64),
    mats.facilityDeck,
  );
  apron.position.y = -0.1;
  apron.receiveShadow = true;
  envGroup.add(apron);

  // Heavy beveled dark steel outer perimeter collar & aerospace taxiway markings
  const apronRim = new THREE.Mesh(
    new THREE.TorusGeometry(72.2, 0.42, 8, 64),
    mats.weatheredSteel,
  );
  apronRim.rotation.x = Math.PI / 2;
  apronRim.position.y = 0.04;
  envGroup.add(apronRim);

  const perimeterLine = new THREE.Mesh(
    new THREE.RingGeometry(70.4, 71.1, 64),
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.48,
      metalness: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  perimeterLine.rotation.x = -Math.PI / 2;
  perimeterLine.position.y = 0.055;
  envGroup.add(perimeterLine);

  const hubDeckRing = new THREE.Mesh(
    new THREE.RingGeometry(24.2, 25.0, 32),
    mats.titanium,
  );
  hubDeckRing.rotation.x = -Math.PI / 2;
  hubDeckRing.position.y = 0.05;
  envGroup.add(hubDeckRing);

  const roadConfigs = [
    { x: 0, z: -23, len: 42, rotY: 0 },
    { x: -22, z: -14, len: 50, rotY: 0.99 },
    { x: -22, z: 14, len: 50, rotY: -0.99 },
    { x: 22, z: -14, len: 50, rotY: -0.99 },
    { x: 22, z: 14, len: 50, rotY: 0.99 },
    { x: 0, z: 46, len: 46, rotY: 0 },
  ];
  roadConfigs.forEach((rc) => {
    const roadShape = makeRoundedRectShape(4.4, rc.len, 0.6);
    const roadGeo = new THREE.ExtrudeGeometry(roadShape, { depth: 0.14, bevelEnabled: false });
    roadGeo.rotateX(Math.PI / 2);
    const road = new THREE.Mesh(roadGeo, mats.asphaltRoad);
    road.position.set(rc.x, 0.08, rc.z);
    road.rotation.y = rc.rotY;
    road.receiveShadow = true;
    envGroup.add(road);
  });

  const treeCoords: Array<[number, number]> = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rad = 76 + (i % 5) * 14 + Math.sin(i * 3.1) * 6;
    const tx = Math.cos(a) * rad - 8;
    const tz = Math.sin(a) * rad;
    if (tx > 74) continue;
    treeCoords.push([tx, tz]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 4.4, 7);
  const crownGeo = new THREE.SphereGeometry(1.75, 8, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, mats.trunkBrown, treeCoords.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mats.foliageGreen, treeCoords.length);
  trunks.castShadow = true;
  crowns.castShadow = true;

  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();
  treeCoords.forEach(([tx, tz], idx) => {
    const s = 0.8 + (idx % 4) * 0.18;
    dummy.position.set(tx, 2.1 * s, tz);
    dummy.rotation.set(0, idx * 0.9, ((idx % 3) - 1) * 0.08);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(tx, 4.5 * s, tz);
    dummy.scale.set(s * 1.25, s * 0.72, s * 1.25);
    dummy.updateMatrix();
    crowns.setMatrixAt(idx, dummy.matrix);

    cColor.setHSL(0.28 + (idx % 5) * 0.015, 0.44, 0.28 + (idx % 3) * 0.04);
    crowns.setColorAt(idx, cColor);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  trunks.computeBoundingSphere();
  crowns.computeBoundingSphere();
  envGroup.add(trunks, crowns);

  return { envGroup, skyDome };
}

function buildExteriorCorridor(
  start: [number, number, number],
  end: [number, number, number],
  accentHex: string,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();
  const s = new THREE.Vector3(...start);
  const e = new THREE.Vector3(...end);
  const dir = new THREE.Vector3().subVectors(e, s);
  const length = dir.length();
  const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);

  group.position.copy(mid);
  group.rotation.y = Math.atan2(dir.x, dir.z);

  const deckShape = makeRoundedRectShape(4.4, length, 0.35);
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  deckGeo.rotateX(Math.PI / 2);
  const deck = new THREE.Mesh(deckGeo, mats.corridorFloor);
  deck.position.y = 0.44;
  deck.receiveShadow = true;
  group.add(deck);

  const stripMat = new THREE.MeshBasicMaterial({ color: accentHex });
  for (const xOff of [-1.4, 1.4]) {
    const strip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.06, length - 2.0, 3, 6),
      stripMat,
    );
    strip.rotation.x = Math.PI / 2;
    strip.position.set(xOff, 0.48, 0);
    group.add(strip);
  }

  const archCount = Math.max(3, Math.floor(length / 7));
  for (let i = 0; i < archCount; i++) {
    const zPos = -length / 2 + 4 + i * ((length - 8) / Math.max(1, archCount - 1));
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.1, 0.5, zPos),
      new THREE.Vector3(-2.0, 2.55, zPos),
      new THREE.Vector3(0, 2.95, zPos),
      new THREE.Vector3(2.0, 2.55, zPos),
      new THREE.Vector3(2.1, 0.5, zPos),
    ]);
    const arch = new THREE.Mesh(
      new THREE.TubeGeometry(archCurve, 14, 0.14, 8, false),
      mats.brushedSteel,
    );
    arch.castShadow = true;
    group.add(arch);
  }

  return group;
}

function buildSmartRoof(
  radius: number,
  height: number,
  accentHex: string,
  lightColor: number,
  lightIntensity: number,
  mats: SpaceMaterialLibrary,
  alertTargets: AlertLightTarget[],
): THREE.Group {
  const roof = new THREE.Group();
  const accentMat = makeAccentMat(accentHex, 0.9);

  const roofRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 0.5, 0.35, 8, 8),
    mats.wallTrim,
  );
  roofRing.rotation.x = Math.PI / 2;
  roofRing.rotation.z = Math.PI / 8;
  roofRing.position.y = height;
  roof.add(roofRing);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius - 0.4, radius - 0.2, 0.34, 8),
    mats.ceilingAcoustic,
  );
  cap.rotation.y = Math.PI / 8;
  cap.position.y = height + 0.35;
  cap.receiveShadow = true;
  roof.add(cap);

  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    const span = radius - 0.9;
    const trussCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-Math.cos(a) * span, height - 0.15, -Math.sin(a) * span),
      new THREE.Vector3(-Math.cos(a) * span * 0.45, height + 0.2, -Math.sin(a) * span * 0.45),
      new THREE.Vector3(0, height + 0.25, 0),
      new THREE.Vector3(Math.cos(a) * span * 0.45, height + 0.2, Math.sin(a) * span * 0.45),
      new THREE.Vector3(Math.cos(a) * span, height - 0.15, Math.sin(a) * span),
    ]);
    roof.add(
      new THREE.Mesh(new THREE.TubeGeometry(trussCurve, 18, 0.14, 8, false), mats.brushedSteel),
    );
  }

  for (const offset of [-radius * 0.36, radius * 0.36]) {
    const duct = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, radius * 1.25, 12),
      mats.titanium,
    );
    duct.rotation.z = Math.PI / 2;
    duct.position.set(0, height - 0.22, offset);
    roof.add(duct);
  }

  // Heavy industrial overhead cable swags draping under the roof truss
  for (const side of [-1, 1]) {
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * radius * 0.72, height - 0.55, -radius * 0.25),
      new THREE.Vector3(side * radius * 0.42, height - 1.55, 0.2),
      new THREE.Vector3(side * radius * 0.15, height - 1.1, radius * 0.35),
      new THREE.Vector3(-side * radius * 0.25, height - 0.5, radius * 0.65),
    ]);
    const cable = new THREE.Mesh(
      new THREE.TubeGeometry(cableCurve, 14, 0.045, 6, false),
      mats.heavyCableDark,
    );
    roof.add(cable);
  }

  // Upper glowing perimeter LED ring inside roofGroup so it hides cleanly in aerial overview
  const upperPerimeterLed = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 0.65, 0.065, 6, 8),
    accentMat,
  );
  upperPerimeterLed.rotation.x = Math.PI / 2;
  upperPerimeterLed.rotation.z = Math.PI / 8;
  upperPerimeterLed.position.y = height - 0.85;
  roof.add(upperPerimeterLed);

  const ledRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.46, 0.06, 8, 24),
    accentMat,
  );
  ledRing.rotation.x = Math.PI / 2;
  ledRing.position.y = height - 0.06;
  roof.add(ledRing);

  // Low moody ambient fill + dramatic overhead industrial SpotLights creating specular pools
  const ambientFillIntensity = lightIntensity * 0.22;
  const interiorLight = new THREE.PointLight(lightColor, ambientFillIntensity, radius * 2.5, 1.35);
  interiorLight.position.set(0, height - 0.9, 0);
  roof.add(interiorLight);

  const spotLights: Array<{ spot: THREE.SpotLight; baseIntensity: number }> = [];
  const isHangar = radius > 16;

  // Primary focused cone spotlight onto center rocket / main workstation desk
  const mainSpotIntensity = isHangar ? 95 : 54;
  const mainSpot = new THREE.SpotLight(
    lightColor,
    mainSpotIntensity,
    height * 2.4,
    isHangar ? 0.52 : 0.48,
    0.58,
    1.15,
  );
  mainSpot.position.set(0, height - 0.35, isHangar ? 2.2 : 0.6);
  mainSpot.target.position.set(0, 0.65, isHangar ? 0.4 : -0.6);
  roof.add(mainSpot);
  roof.add(mainSpot.target);
  spotLights.push({ spot: mainSpot, baseIntensity: mainSpotIntensity });

  // Secondary warm-cool pool spotlight over side bench/apron
  const sideSpotIntensity = isHangar ? 52 : 34;
  const sideSpot = new THREE.SpotLight(
    isHangar ? 0xbae6fd : lightColor,
    sideSpotIntensity,
    height * 2.3,
    0.5,
    0.65,
    1.2,
  );
  sideSpot.position.set(isHangar ? 0 : -4.2, height - 0.45, isHangar ? 8.8 : 3.2);
  sideSpot.target.position.set(isHangar ? 0 : -4.2, 0.65, isHangar ? 9.0 : 3.2);
  roof.add(sideSpot);
  roof.add(sideSpot.target);
  spotLights.push({ spot: sideSpot, baseIntensity: sideSpotIntensity });

  // Third accent pool for right-side comms / crane bay
  const rightSpotIntensity = isHangar ? 44 : 30;
  const rightSpot = new THREE.SpotLight(
    0x38bdf8,
    rightSpotIntensity,
    height * 2.3,
    0.48,
    0.68,
    1.25,
  );
  rightSpot.position.set(isHangar ? 7.5 : 4.2, height - 0.45, isHangar ? 4.8 : 3.2);
  rightSpot.target.position.set(isHangar ? 7.5 : 4.2, 0.65, isHangar ? 4.8 : 3.2);
  roof.add(rightSpot);
  roof.add(rightSpot.target);
  spotLights.push({ spot: rightSpot, baseIntensity: rightSpotIntensity });

  // Rotating Red Alert Emergency Beacon (dark-mode crimson sweep during Emergency Meetings)
  const beaconRig = new THREE.Group();
  beaconRig.position.set(0, height - 0.62, 0);
  const beaconHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.24, 12),
    mats.weatheredSteel,
  );
  beaconRig.add(beaconHousing);

  const beaconDomeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: new THREE.Color(0xdc2626),
    emissiveIntensity: 0.15,
    roughness: 0.18,
  });
  const beaconDome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), beaconDomeMat);
  beaconDome.position.y = -0.14;
  beaconRig.add(beaconDome);

  const beaconSpot = new THREE.SpotLight(0xff1e2d, 0, radius * 2.8, 0.64, 0.45, 0.9);
  beaconSpot.position.set(0, -0.16, 0);
  beaconSpot.target.position.set(radius * 0.72, -height + 0.8, 0);
  beaconRig.add(beaconSpot);
  beaconRig.add(beaconSpot.target);
  roof.add(beaconRig);

  alertTargets.push({
    light: interiorLight,
    spotLights,
    beaconRig,
    beaconSpot,
    beaconDomeMat,
    baseLightColor: new THREE.Color(lightColor),
    baseLightIntensity: ambientFillIntensity,
    accentMat,
    baseAccentColor: new THREE.Color(accentHex),
  });

  return roof;
}

function buildRampMesh(
  width: number,
  zStart: number,
  zEnd: number,
  elevation: number,
  mats: SpaceMaterialLibrary,
): THREE.Group {
  const rampGroup = new THREE.Group();
  const runLength = Math.abs(zEnd - zStart);
  const slopeDir = zEnd >= zStart ? 1 : -1;
  const railLength = Math.hypot(runLength, elevation);
  const slopeAngle = Math.atan2(elevation, runLength);
  const midZ = (zStart + zEnd) / 2;
  const midY = GROUND_FLOOR_Y + elevation / 2;

  // Flush industrial steel grating walking plate supported on side stringers
  const deckPlateGeo = new THREE.BoxGeometry(width - 0.16, 0.14, railLength);
  const rampDeck = new THREE.Mesh(deckPlateGeo, mats.rampSurface);
  rampDeck.position.set(0, midY - 0.05, midZ);
  rampDeck.rotation.x = slopeDir * slopeAngle;
  rampDeck.castShadow = true;
  rampDeck.receiveShadow = true;
  rampGroup.add(rampDeck);

  // Flush top steel landing plate connecting mezzanine deck edge to ramp lip
  const topLanding = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.06, 0.24, 1.35),
    mats.mezzFloor,
  );
  topLanding.position.set(0, GROUND_FLOOR_Y + elevation - 0.12, zStart - slopeDir * 0.62);
  topLanding.castShadow = true;
  topLanding.receiveShadow = true;
  rampGroup.add(topLanding);

  // Dark steel side channel stringers + subtle yellow safety outer border trim
  const stringerGeo = new THREE.BoxGeometry(0.14, 0.26, railLength + 0.12);
  const edgeTrimGeo = new THREE.BoxGeometry(0.055, 0.035, railLength);
  for (const side of [-1, 1]) {
    const stringer = new THREE.Mesh(stringerGeo, mats.weatheredSteel);
    stringer.position.set(side * (width / 2 - 0.07), midY - 0.09, midZ);
    stringer.rotation.x = slopeDir * slopeAngle;
    stringer.castShadow = true;
    stringer.receiveShadow = true;
    rampGroup.add(stringer);

    const trim = new THREE.Mesh(edgeTrimGeo, mats.craneYellow);
    trim.position.set(side * (width / 2 - 0.12), midY + 0.035, midZ);
    trim.rotation.x = slopeDir * slopeAngle;
    rampGroup.add(trim);
  }

  // Bolted structural I-beam cross-braces & vertical stanchions underneath ramp slope
  const crossBeamGeo = new THREE.BoxGeometry(width - 0.14, 0.16, 0.2);
  for (const t of [0.22, 0.48, 0.74]) {
    const bz = zStart + (zEnd - zStart) * t;
    const by = GROUND_FLOOR_Y + elevation * (1 - t);
    const crossBeam = new THREE.Mesh(crossBeamGeo, mats.weatheredSteel);
    crossBeam.position.set(0, by - 0.2, bz);
    crossBeam.castShadow = true;
    rampGroup.add(crossBeam);

    if (t < 0.6 && by - GROUND_FLOOR_Y > 0.45) {
      const colH = by - 0.22 - GROUND_FLOOR_Y;
      for (const side of [-1, 1]) {
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.11, colH, 8),
          mats.titanium,
        );
        col.position.set(side * (width / 2 - 0.18), GROUND_FLOOR_Y + colH / 2, bz);
        col.castShadow = true;
        rampGroup.add(col);
      }
    }
  }

  // Complete 3-bar steel ramp guardrails + vertical stanchion posts on both sides
  const postCount = Math.max(3, Math.round(railLength / 2.1) + 1);
  for (const sideX of [-width / 2 + 0.08, width / 2 - 0.08]) {
    for (const ry of [0.35, 0.7, 1.06]) {
      const barRadius = ry === 1.06 ? 0.048 : 0.028;
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(barRadius, barRadius, railLength, 8),
        mats.brushedSteel,
      );
      bar.rotation.x = Math.PI / 2 + slopeDir * slopeAngle;
      bar.position.set(sideX, midY + ry, midZ);
      rampGroup.add(bar);
    }

    for (let i = 0; i < postCount; i++) {
      const t = i / (postCount - 1);
      const pz = zStart + (zEnd - zStart) * t;
      const py = GROUND_FLOOR_Y + elevation * (1 - t);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.05, 1.06, 8),
        mats.brushedSteel,
      );
      post.position.set(sideX, py + 0.53, pz);
      rampGroup.add(post);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mats.titanium);
      cap.position.set(sideX, py + 1.08, pz);
      rampGroup.add(cap);
    }
  }

  return rampGroup;
}

function buildOpaqueTwoLevelRoomShell(
  roomId: RoomId,
  radius: number,
  wallHeight: number,
  accentHex: string,
  mezz: MezzanineBounds,
  theme: RoomShellTheme,
  mats: SpaceMaterialLibrary,
  clickTargets: THREE.Object3D[],
  roomRings: Record<string, THREE.Mesh>,
  roofGroups: Record<string, THREE.Group>,
  alertTargets: AlertLightTarget[],
): THREE.Group {
  const group = new THREE.Group();

  const basePad = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.9, radius + 1.4, 0.6, 8),
    mats.hullDark,
  );
  basePad.position.y = 0.3;
  basePad.rotation.y = Math.PI / 8;
  basePad.receiveShadow = true;
  basePad.castShadow = true;
  group.add(basePad);

  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(radius - 0.15, radius - 0.15, 0.12, 8),
    theme.floorMat,
  );
  floor.position.y = 0.57;
  floor.rotation.y = Math.PI / 8;
  floor.receiveShadow = true;
  group.add(floor);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.75, radius - 0.3, 8),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.rotation.z = Math.PI / 8;
  ring.position.y = 0.65;
  group.add(ring);
  roomRings[roomId] = ring;

  // 8 SOLID OPAQUE PERIMETER WALLS (Zero glass!)
  const wallFaceDist = Math.cos(Math.PI / 8) * (radius - 0.25);
  const segLen = 2 * wallFaceDist * Math.tan(Math.PI / 8) + 0.35;

  const fullWallShape = makeRoundedRectShape(segLen, wallHeight, 0.08);
  const fullWallGeo = new THREE.ExtrudeGeometry(fullWallShape, {
    depth: 0.45,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  fullWallGeo.rotateY(Math.PI / 2);
  fullWallGeo.center();

  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const cornerX = Math.cos(angle + Math.PI / 8) * (radius - 0.2);
    const cornerZ = Math.sin(angle + Math.PI / 8) * (radius - 0.2);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.58, wallHeight + 0.1, 10),
      mats.wallTrim,
    );
    pillar.position.set(cornerX, 0.6 + wallHeight / 2, cornerZ);
    pillar.castShadow = true;
    group.add(pillar);

    // Clean titanium architectural pillar cap (no glowing sphere sticking out in overview)
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.18, 10),
      mats.titanium,
    );
    cap.position.set(cornerX, 0.6 + wallHeight + 0.12, cornerZ);
    group.add(cap);

    const wallX = Math.cos(angle) * wallFaceDist;
    const wallZ = Math.sin(angle) * wallFaceDist;

    const solidWall = new THREE.Mesh(fullWallGeo, theme.wallMat);
    solidWall.position.set(wallX, 0.6 + wallHeight / 2, wallZ);
    solidWall.rotation.y = -angle;
    solidWall.castShadow = true;
    solidWall.receiveShadow = true;
    group.add(solidWall);

    // Hangar central gets heavy VAB aerospace structural bays, trusses, manifolds & valves on all walls
    if (roomId === 'hangar') {
      const vabDetail = buildVabWallSegment(segLen, wallHeight, accentHex, mats);
      vabDetail.position.set(wallX, 0.6, wallZ);
      vabDetail.rotation.y = -angle + Math.PI / 2;
      group.add(vabDetail);

      if (i % 2 === 0) {
        const themes: Array<{ t: ScreenTheme; title: string }> = [
          { t: 'flight', title: 'VAB TELEMETRY · BAY A' },
          { t: 'blueprint', title: 'HEAVY LAUNCHER SCHEMATIC' },
          { t: 'orbitmap', title: 'CAPE CANAVERAL CORRIDOR' },
          { t: 'specs', title: 'NASA CRYOGENIC PROTOCOL' },
        ];
        const info = themes[(i / 2) % themes.length];
        const wallDisplay = buildWallPoster(3.8, 2.0, info.t, '#38BDF8', info.title, mats);
        wallDisplay.position.set(
          Math.cos(angle) * (wallFaceDist - 0.36),
          6.35,
          Math.sin(angle) * (wallFaceDist - 0.36),
        );
        wallDisplay.rotation.y = -angle - Math.PI / 2;
        group.add(wallDisplay);
      }
    }
  }

  // Elevated Mezzanine + Ramps
  const mezzDepth = mezz.zMax - mezz.zMin;
  const mezzWidth = mezz.xHalfWidth * 2;
  const mezzShape = makeRoundedRectShape(mezzWidth, mezzDepth, 1.2);
  const mezzGeo = new THREE.ExtrudeGeometry(mezzShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  mezzGeo.rotateX(Math.PI / 2);
  mezzGeo.center();
  const mezzDeck = new THREE.Mesh(mezzGeo, mats.mezzFloor);
  mezzDeck.position.set(0, GROUND_FLOOR_Y + mezz.elevation - 0.12, (mezz.zMin + mezz.zMax) / 2);
  mezzDeck.castShadow = true;
  mezzDeck.receiveShadow = true;
  group.add(mezzDeck);

  for (const px of [
    -mezz.xHalfWidth + 1.8,
    -mezz.xHalfWidth * 0.38,
    mezz.xHalfWidth * 0.38,
    mezz.xHalfWidth - 1.8,
  ]) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, mezz.elevation - 0.15, 10),
      mats.brushedSteel,
    );
    col.position.set(px, GROUND_FLOOR_Y + (mezz.elevation - 0.15) / 2, mezz.zMax - 0.5);
    col.castShadow = true;
    group.add(col);
  }

  const mezzY = GROUND_FLOOR_Y + mezz.elevation;
  const rampZStart = mezz.rampZStart ?? mezz.zMax;
  const edgeOpeningWidth = mezz.sideCatwalkWidth ?? mezz.rampWidth;
  const centerRailSpan = (mezz.xHalfWidth - edgeOpeningWidth + 0.08) * 2;
  if (centerRailSpan > 1) {
    const rail = buildMezzanineRailing(centerRailSpan, mats);
    rail.position.set(0, mezzY, mezz.zMax - 0.08);
    group.add(rail);
  }

  // Full outer side perimeter guardrails from rear diagonal wall continuously to rampZStart
  // (guards all mezzanine side ledges, corner plant flanks, and Hangar side catwalk outer edges)
  const outerRailXAbs = mezz.xHalfWidth - 0.08;
  const zDiagonalWallHit = -(wallFaceDist * Math.SQRT2 - outerRailXAbs);
  const outerRailZStart = Math.max(mezz.zMin + 0.08, zDiagonalWallHit - 0.2);
  const outerRailLen = rampZStart - outerRailZStart;
  if (outerRailLen > 0.6) {
    for (const side of [-1, 1]) {
      const outerRail = buildMezzanineRailing(outerRailLen, mats);
      outerRail.rotation.y = Math.PI / 2;
      outerRail.position.set(
        side * outerRailXAbs,
        mezzY,
        (outerRailZStart + rampZStart) / 2,
      );
      group.add(outerRail);
    }
  }

  // Close rear mezzanine perimeter drop-off where octagonal rear wall sits behind mezz.zMin
  const rearRailZ = mezz.zMin + 0.08;
  const maxRearXAtWall = wallFaceDist * Math.SQRT2 - Math.abs(rearRailZ);
  const rearRailHalfSpan = Math.min(outerRailXAbs, maxRearXAtWall + 0.25);
  if (rearRailHalfSpan > 0.8) {
    const rearRail = buildMezzanineRailing(rearRailHalfSpan * 2, mats);
    rearRail.position.set(0, mezzY, rearRailZ);
    group.add(rearRail);
  }

  for (const side of [-1, 1]) {
    const rampCenterX = side * (mezz.xHalfWidth - mezz.rampWidth / 2);
    const ramp = buildRampMesh(mezz.rampWidth, rampZStart, mezz.rampZEnd, mezz.elevation, mats);
    ramp.position.x = rampCenterX;
    group.add(ramp);
  }

  if (mezz.sideCatwalkWidth && rampZStart > mezz.zMax) {
    const catLen = rampZStart - mezz.zMax;
    const catShape = makeRoundedRectShape(mezz.sideCatwalkWidth, catLen, 0.25);
    const catGeo = new THREE.ExtrudeGeometry(catShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    catGeo.rotateX(Math.PI / 2);
    catGeo.center();

    for (const side of [-1, 1]) {
      const cx = side * (mezz.xHalfWidth - mezz.sideCatwalkWidth / 2);
      const cz = mezz.zMax + catLen / 2;
      const cat = new THREE.Mesh(catGeo, mats.mezzFloor);
      cat.position.set(cx, mezzY - 0.11, cz);
      cat.castShadow = true;
      cat.receiveShadow = true;
      group.add(cat);

      const innerRail = buildMezzanineRailing(catLen + 0.16, mats);
      innerRail.rotation.y = Math.PI / 2;
      innerRail.position.set(
        side * (mezz.xHalfWidth - mezz.sideCatwalkWidth + 0.08),
        mezzY,
        cz,
      );
      group.add(innerRail);
    }
  }

  const roof = buildSmartRoof(
    radius,
    wallHeight + 0.65,
    accentHex,
    theme.interiorLightColor,
    theme.interiorLightIntensity,
    mats,
    alertTargets,
  );
  group.add(roof);
  roofGroups[roomId] = roof;

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, wallHeight, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitbox.position.y = wallHeight / 2;
  hitbox.layers.set(1);
  hitbox.userData.roomId = roomId;
  group.add(hitbox);
  clickTargets.push(hitbox);

  return group;
}

interface BuildRoleRoomConfig {
  roomId: Exclude<RoomId, 'overview' | 'hangar' | 'meeting'>;
  position: [number, number, number];
  accentHex: string;
  screenTheme: ScreenTheme;
  pcTitle: string;
  whiteboardTitle: string;
  commsTitle: string;
  wallMat: THREE.Material;
  floorMat: THREE.Material;
  interiorLightColor: number;
  buildBenchProp: () => THREE.Group;
  buildMezzExtras: (mezzY: number) => THREE.Object3D[];
}

export function buildSpaceBase(
  _renderer: THREE.WebGLRenderer,
  mats: SpaceMaterialLibrary,
): SpaceBaseScene {
  const root = new THREE.Group();
  root.name = 'CoastalSpaceComplexRoot';

  const clickTargets: THREE.Object3D[] = [];
  const interactableTargets: THREE.Object3D[] = [];
  const interactableRegistry: Record<string, InteractableRegistryItem> = {};
  const roomRings: Record<string, THREE.Mesh> = {};
  const roofGroups: Record<string, THREE.Group> = {};
  const alertTargets: AlertLightTarget[] = [];

  const { envGroup, skyDome } = createCapeCanaveralEnvironment(mats);
  root.add(envGroup);

  const launchCinematic = createLaunchCinematicRig(mats);
  root.add(launchCinematic.root);

  // Exterior Corridors (Visible only in Aerial Map; hidden in First Person)
  const corridorGroup = new THREE.Group();
  const corridorDefs: Array<{ end: [number, number, number]; color: string }> = [
    { end: [0, 0, -46], color: '#06B6D4' },
    { end: [-44, 0, -28], color: '#F97316' },
    { end: [-44, 0, 28], color: '#EAB308' },
    { end: [44, 0, -28], color: '#22C55E' },
    { end: [44, 0, 28], color: '#3B82F6' },
  ];
  corridorDefs.forEach((c) => {
    corridorGroup.add(buildExteriorCorridor([0, 0, 0], c.end, c.color, mats));
  });
  root.add(corridorGroup);

  const hoverSpot = new THREE.PointLight(0xffffff, 0, 8, 1.4);
  root.add(hoverSpot);

  // =========================================================================
  // 1. CENTRAL ROCKET HANGAR (0, 0, 0) — 100% INDUSTRIAL
  // =========================================================================
  const hangarDef = ROOM_MAP['hangar'];
  const hangarGroup = buildOpaqueTwoLevelRoomShell(
    'hangar',
    21,
    13.2,
    '#38BDF8',
    hangarDef.firstPerson!.mezzanine!,
    {
      wallMat: mats.wallHangarMetal,
      floorMat: mats.floorDeck,
      interiorLightColor: 0xfef3c7,
      interiorLightIntensity: 36,
    },
    mats,
    clickTargets,
    roomRings,
    roofGroups,
    alertTargets,
  );
  hangarGroup.position.set(0, 0, 0);
  root.add(hangarGroup);

  // Glowing Hangar Assembly Pad Drop-Zone for fragile cargo deliveries
  const hangarAssemblyPad = buildHangarAssemblyPad(mats);
  hangarGroup.add(hangarAssemblyPad.group);

  const padBase = new THREE.Mesh(
    new THREE.CylinderGeometry(6.6, 7.2, 0.55, 20),
    mats.hazardFloor,
  );
  padBase.position.y = 0.88;
  padBase.receiveShadow = true;
  hangarGroup.add(padBase);

  const blastPit = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.8, 0.3, 20),
    mats.ceramicHeatShield,
  );
  blastPit.position.y = 1.18;
  blastPit.receiveShadow = true;
  hangarGroup.add(blastPit);

  const rocketShadow = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 6.8), mats.contactShadow);
  rocketShadow.rotation.x = -Math.PI / 2;
  rocketShadow.position.y = 1.35;
  hangarGroup.add(rocketShadow);

  // Cryo spheres & thick copper cryo pipes (right side clickable as hng-cryo-pipes)
  const cryoHighlightGroup = new THREE.Group();
  for (const side of [-1, 1]) {
    const tankPed = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.9, 12), mats.hullDark);
    tankPed.position.set(side * 5.2, 1.1, -3.6);

    const cryoSphere = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), mats.rocketMetallicHull);
    cryoSphere.position.set(side * 5.2, 2.35, -3.6);
    cryoSphere.castShadow = true;

    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 5.2, 2.35, -2.5),
      new THREE.Vector3(side * 3.8, 1.5, -1.2),
      new THREE.Vector3(side * 1.4, 2.2, -0.4),
    ]);
    const pipeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(pipeCurve, 14, 0.16, 8, false),
      mats.copperNozzle,
    );

    if (side === 1) {
      cryoHighlightGroup.add(tankPed, cryoSphere, pipeMesh);
    } else {
      hangarGroup.add(tankPed, cryoSphere, pipeMesh);
    }
  }
  hangarGroup.add(cryoHighlightGroup);

  const cryoClickAnchor = new THREE.Group();
  cryoClickAnchor.position.set(5.2, 2.35, -3.6);
  cryoClickAnchor.rotation.y = -0.6;
  registerInteractableObject(
    cryoClickAnchor,
    'hng-cryo-pipes',
    'hangar',
    INTERACTABLES_MAP['hng-cryo-pipes'].hoverLabel,
    '#38BDF8',
    1.85,
    3.0,
    1.6,
    interactableTargets,
    interactableRegistry,
    {
      proxyCenterY: 0.0,
      hideRing: true,
      cameraLocalPos: [0, 1.1, 4.6],
      cameraLocalLookAt: [0, 0, 0],
      highlightRoots: [cryoHighlightGroup],
      auraRadius: 1.8,
      auraHeight: 2.8,
    },
  );
  hangarGroup.add(cryoClickAnchor);

  // Launch Gantry Tower + Umbilical Arm (hng-umbilical)
  const gantry = new THREE.Group();
  gantry.position.set(-4.6, 1.15, -3.2);
  const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.65, 0.85, 8), mats.hullDark);
  towerBase.position.y = 0.42;
  gantry.add(towerBase);

  for (const x of [-0.72, 0.72]) {
    for (const z of [-0.72, 0.72]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 10.6, 8),
        mats.brushedSteel,
      );
      col.position.set(x, 5.7, z);
      col.castShadow = true;
      gantry.add(col);
    }
  }
  for (let tier = 0; tier < 6; tier++) {
    const ringBrace = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 6, 8), mats.wallTrim);
    ringBrace.rotation.x = Math.PI / 2;
    ringBrace.rotation.z = Math.PI / 4;
    ringBrace.position.y = 1.8 + tier * 1.7;
    gantry.add(ringBrace);
  }
  const craneHead = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.35, 0.65, 8),
    mats.copperNozzle,
  );
  craneHead.position.y = 11.2;
  gantry.add(craneHead);

  const gantryArm = new THREE.Group();
  gantryArm.position.set(0.75, 7.6, 0.75);
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1.9, 0.15, 1.35),
    new THREE.Vector3(3.4, -0.05, 2.45),
  ]);
  gantryArm.add(
    new THREE.Mesh(new THREE.TubeGeometry(armCurve, 12, 0.18, 8, false), mats.goldKapton),
  );
  gantry.add(gantryArm);
  hangarGroup.add(gantry);

  const umbilicalAnchor = new THREE.Group();
  umbilicalAnchor.position.set(-2.5, 8.75, -1.5);
  registerInteractableObject(
    umbilicalAnchor,
    'hng-umbilical',
    'hangar',
    INTERACTABLES_MAP['hng-umbilical'].hoverLabel,
    '#F59E0B',
    2.1,
    3.6,
    0.8,
    interactableTargets,
    interactableRegistry,
    {
      proxyCenterY: 0,
      hideRing: true,
      cameraLocalPos: [4.8, -0.4, 6.4],
      cameraLocalLookAt: [-0.8, 0, -0.6],
      highlightRoots: [gantryArm, gantry],
      auraRadius: 2.2,
      auraHeight: 3.4,
    },
  );
  hangarGroup.add(umbilicalAnchor);

  // Yellow Overhead Bridge Crane (hng-crane) placed inside Hangar roofGroup so it hides cleanly in aerial overview
  const bridgeCrane = new THREE.Group();
  bridgeCrane.position.set(0, 12.2, 0);
  const girderShape = makeRoundedRectShape(28, 0.85, 0.1);
  const girderGeo = new THREE.ExtrudeGeometry(girderShape, {
    depth: 0.75,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  girderGeo.center();
  for (const gz of [-1.2, 1.2]) {
    const beam = new THREE.Mesh(girderGeo, mats.craneYellow);
    beam.position.z = gz;
    bridgeCrane.add(beam);
  }
  const craneTrolley = new THREE.Group();
  craneTrolley.position.set(5.5, -0.3, 0);
  craneTrolley.add(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.65, 12), mats.hullDark));
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6), mats.brushedSteel);
  cable.position.y = -1.65;
  craneTrolley.add(cable);
  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.06, 8, 12, Math.PI * 1.4),
    mats.craneYellow,
  );
  hook.position.y = -3.15;
  craneTrolley.add(hook);
  bridgeCrane.add(craneTrolley);
  roofGroups['hangar'].add(bridgeCrane);

  const craneAnchor = new THREE.Group();
  craneAnchor.position.set(0, 11.3, 0);
  registerInteractableObject(
    craneAnchor,
    'hng-crane',
    'hangar',
    INTERACTABLES_MAP['hng-crane'].hoverLabel,
    '#EAB308',
    5.5,
    2.4,
    -0.5,
    interactableTargets,
    interactableRegistry,
    {
      proxyCenterY: 0.3,
      hideRing: true,
      cameraLocalPos: [0, -3.5, 11.5],
      cameraLocalLookAt: [0, 0.4, 0],
      highlightRoots: [bridgeCrane],
      auraRadius: 4.8,
      auraHeight: 2.2,
    },
  );
  roofGroups['hangar'].add(craneAnchor);

  // Modular Rocket + 6 Granular Stage Interactable Zones
  const rocketWrap = new THREE.Group();
  rocketWrap.position.set(0, 1.33, 0);
  const rocket = buildModularRocket(mats);
  rocketWrap.add(rocket.root);

  const rocketPartSpecs: Array<{
    id: InteractableId;
    y: number;
    radius: number;
    height: number;
    camZ: number;
    accent: string;
  }> = [
    { id: 'hng-nozzles', y: 0.6, radius: 2.3, height: 1.5, camZ: 5.4, accent: '#F97316' },
    { id: 'hng-fuel-tank', y: 3.6, radius: 1.9, height: 3.6, camZ: 6.4, accent: '#38BDF8' },
    { id: 'hng-interstage', y: 6.08, radius: 1.8, height: 1.0, camZ: 5.6, accent: '#94A3B8' },
    { id: 'hng-oxidizer-tank', y: 7.45, radius: 1.8, height: 1.65, camZ: 5.6, accent: '#38BDF8' },
    { id: 'hng-avionics', y: 8.66, radius: 1.8, height: 0.85, camZ: 5.2, accent: '#3B82F6' },
    { id: 'hng-fairing', y: 10.1, radius: 1.9, height: 2.2, camZ: 5.8, accent: '#22C55E' },
  ];

  rocketPartSpecs.forEach((part) => {
    const partAnchor = new THREE.Group();
    partAnchor.position.set(0, part.y, 0);
    const stageGroup = rocket.partGroups[part.id];
    registerInteractableObject(
      partAnchor,
      part.id,
      'hangar',
      INTERACTABLES_MAP[part.id].hoverLabel,
      part.accent,
      part.radius,
      part.height,
      0.2,
      interactableTargets,
      interactableRegistry,
      {
        proxyCenterY: 0,
        hideRing: true,
        cameraLocalPos: [0, 0.25, part.camZ],
        cameraLocalLookAt: [0, 0, 0],
        highlightRoots: stageGroup ? [stageGroup] : [rocket.root],
        auraRadius: part.radius * 0.88,
        auraHeight: part.height,
      },
    );
    rocketWrap.add(partAnchor);
  });
  hangarGroup.add(rocketWrap);

  // Floating-Limb 3D Rocket Technician at Base Nozzles
  const techRig = buildStylizedTechnician(mats);
  const { group: techGroup, sparksGroup: techSparks } = techRig;
  techGroup.position.set(2.05, 1.33, 2.05);
  techGroup.rotation.y = -2.35;
  hangarGroup.add(techGroup);

  const crewBots: RepoCrewBotRig[] = [techRig];

  // Interactive Hangar Project Master Schedule Whiteboard (Gantt Chart)
  const scheduleBoard = buildStandingScheduleBoard(
    3.3,
    1.85,
    'PROJECT MASTER SCHEDULE · 10 PHASES',
    '#38BDF8',
    mats,
  );
  scheduleBoard.position.set(-8.6, GROUND_FLOOR_Y, 5.4);
  scheduleBoard.rotation.y = 0.85;
  registerInteractableObject(
    scheduleBoard,
    'hng-schedule',
    'hangar',
    INTERACTABLES_MAP['hng-schedule'].hoverLabel,
    '#38BDF8',
    2.0,
    2.75,
    2.8,
    interactableTargets,
    interactableRegistry,
    {
      cameraLocalPos: [0, 1.72, 2.65],
      cameraLocalLookAt: [0, 1.65, 0],
    },
  );
  hangarGroup.add(scheduleBoard);

  // Rugged Industrial Pad Telemetry Console (hng-pad-console)
  const padConsole = new THREE.Group();
  padConsole.position.set(8.4, GROUND_FLOOR_Y, 5.2);
  padConsole.rotation.y = -0.7;

  const pedPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.8, 0),
    new THREE.Vector2(0.6, 0.15),
    new THREE.Vector2(0.45, 0.9),
    new THREE.Vector2(0.68, 1.02),
    new THREE.Vector2(0, 1.02),
  ];
  padConsole.add(new THREE.Mesh(new THREE.LatheGeometry(pedPts, 14), mats.hullDark));
  const padMon = buildPanoramicMonitor(1.25, 0.65, 'flight', '#38BDF8', 'PAD 39A TELEMETRY', mats);
  padMon.position.set(0, 1.02, -0.1);
  padConsole.add(padMon);
  const padKb = buildKeyboardAndMouse('#38BDF8', mats);
  padKb.position.set(0, 1.04, 0.28);
  padConsole.add(padKb);

  registerInteractableObject(
    padConsole,
    'hng-pad-console',
    'hangar',
    INTERACTABLES_MAP['hng-pad-console'].hoverLabel,
    '#38BDF8',
    1.6,
    2.2,
    2.25,
    interactableTargets,
    interactableRegistry,
    {
      cameraLocalPos: [0, 1.65, 2.05],
      cameraLocalLookAt: [0, 1.32, -0.05],
    },
  );
  hangarGroup.add(padConsole);

  // Rich Hangar Industrial Decor (ZERO plants, ZERO office chairs/desks — 100% aerospace industrial)
  const hangarMezzY = GROUND_FLOOR_Y + hangarDef.firstPerson!.mezzanine!.elevation;
  for (const mx of [-6.8, -3.2, 3.2, 6.8]) {
    const rack = buildServerTelemetryRack('#38BDF8', mats);
    rack.position.set(mx, hangarMezzY, -13.2);
    hangarGroup.add(rack);
  }

  // Tool carts around Hangar floor & mezzanine
  const hCart1 = buildRollingToolCart('#F97316', mats);
  hCart1.position.set(11.6, GROUND_FLOOR_Y, 8.8);
  hCart1.rotation.y = -2.1;
  hangarGroup.add(hCart1);

  const hCart2 = buildRollingToolCart('#38BDF8', mats);
  hCart2.position.set(-12.2, GROUND_FLOOR_Y, 11.4);
  hCart2.rotation.y = 0.7;
  hangarGroup.add(hCart2);

  const hCartMezz = buildRollingToolCart('#EAB308', mats);
  hCartMezz.position.set(9.6, hangarMezzY, -11.4);
  hCartMezz.rotation.y = -0.5;
  hangarGroup.add(hCartMezz);

  // Tech crate clusters along outer Hangar bays
  const cratePositions: Array<[number, number, number, number]> = [
    [-14.6, GROUND_FLOOR_Y, -3.5, 0.4],
    [14.2, GROUND_FLOOR_Y, -2.5, -0.6],
    [10.8, GROUND_FLOOR_Y, 13.0, -1.1],
    [-9.8, hangarMezzY, -13.0, 0.25],
  ];
  cratePositions.forEach(([cx, cy, cz, rot]) => {
    const crates = buildTechCrateCluster('#38BDF8', mats);
    crates.position.set(cx, cy, cz);
    crates.rotation.y = rot;
    hangarGroup.add(crates);
  });

  // Gas bottle racks & industrial compressors
  for (const [gx, gz, rot] of [
    [-8.6, -15.4, 0.2],
    [8.6, -15.4, -0.2],
    [-15.2, 5.8, 1.35],
  ] as Array<[number, number, number]>) {
    const gasRack = buildGasBottleRack(mats);
    gasRack.position.set(gx, GROUND_FLOOR_Y, gz);
    gasRack.rotation.y = rot;
    hangarGroup.add(gasRack);
  }

  const comp1 = buildCompressorUnit('#38BDF8', mats);
  comp1.position.set(15.0, GROUND_FLOOR_Y, 4.8);
  comp1.rotation.y = -1.45;
  hangarGroup.add(comp1);

  const comp2 = buildCompressorUnit('#F59E0B', mats);
  comp2.position.set(-15.0, GROUND_FLOOR_Y, -8.5);
  comp2.rotation.y = 1.1;
  hangarGroup.add(comp2);

  // Heavy umbilical floor cable bundles radiating from blast pad
  hangarGroup.add(
    buildFloorCable(
      [
        [3.8, GROUND_FLOOR_Y + 0.04, 1.5],
        [6.1, GROUND_FLOOR_Y + 0.04, 3.6],
        [8.4, GROUND_FLOOR_Y + 0.04, 5.2],
      ],
      '#38BDF8',
    ),
    buildFloorCable(
      [
        [-5.2, GROUND_FLOOR_Y + 0.04, -3.6],
        [-10.2, GROUND_FLOOR_Y + 0.04, -6.2],
        [-14.4, GROUND_FLOOR_Y + 0.04, -8.2],
      ],
      '#F59E0B',
    ),
    buildFloorCable(
      [
        [5.2, GROUND_FLOOR_Y + 0.04, -3.6],
        [10.2, GROUND_FLOOR_Y + 0.04, 0.4],
        [14.5, GROUND_FLOOR_Y + 0.04, 4.2],
      ],
      '#38BDF8',
    ),
  );

  // Protective launch pad perimeter handrails on rear bays
  for (const [hx, hz, ry] of [
    [-7.8, 0.4, Math.PI / 2],
    [7.8, 0.4, Math.PI / 2],
    [0, -7.8, 0],
  ] as Array<[number, number, number]>) {
    const padRail = buildMezzanineRailing(4.2, mats);
    padRail.position.set(hx, GROUND_FLOOR_Y, hz);
    padRail.rotation.y = ry;
    hangarGroup.add(padRail);
  }

  // =========================================================================
  // 2. BRIEFING & NEGOTIATION ROOM (0, 0, -46)
  // =========================================================================
  const meetingDef = ROOM_MAP['meeting'];
  const meetingGroup = buildOpaqueTwoLevelRoomShell(
    'meeting',
    14,
    7.8,
    '#06B6D4',
    meetingDef.firstPerson!.mezzanine!,
    {
      wallMat: mats.wallCementSlate,
      floorMat: mats.floorPolishedSlate,
      interiorLightColor: 0xf0f9ff,
      interiorLightIntensity: 28,
    },
    mats,
    clickTargets,
    roomRings,
    roofGroups,
    alertTargets,
  );
  meetingGroup.position.set(0, 0, -46);
  root.add(meetingGroup);

  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, GROUND_FLOOR_Y, 1.2);
  for (const px of [-1.45, 1.45]) {
    const tPedPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.75, 0),
      new THREE.Vector2(0.45, 0.18),
      new THREE.Vector2(0.38, 0.78),
      new THREE.Vector2(0.68, 0.88),
      new THREE.Vector2(0, 0.88),
    ];
    const ped = new THREE.Mesh(new THREE.LatheGeometry(tPedPts, 14), mats.hullDark);
    ped.position.x = px;
    ped.castShadow = true;
    tableGroup.add(ped);
  }

  const ovalShape = new THREE.Shape();
  ovalShape.absellipse(0, 0, 3.25, 2.05, 0, Math.PI * 2, false, 0);
  const ovalGeo = new THREE.ExtrudeGeometry(ovalShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 3,
  });
  ovalGeo.rotateX(Math.PI / 2);
  const ovalWoodTop = new THREE.Mesh(ovalGeo, mats.woodTable);
  ovalWoodTop.position.y = 0.94;
  ovalWoodTop.castShadow = true;
  ovalWoodTop.receiveShadow = true;
  tableGroup.add(ovalWoodTop);

  const rimOval = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.06, 8, 32), mats.brushedSteel);
  rimOval.rotation.x = Math.PI / 2;
  rimOval.scale.set(1.24, 0.78, 1);
  rimOval.position.y = 0.89;
  tableGroup.add(rimOval);

  const confColors = ['#F97316', '#EAB308', '#22C55E', '#3B82F6'];
  confColors.forEach((hex, idx) => {
    const a = (idx * Math.PI) / 2 + Math.PI / 4;
    const fx = Math.cos(a) * 2.2;
    const fz = Math.sin(a) * 1.35;
    const folder = buildBeveledFolder(hex, mats);
    folder.position.set(fx, 0.95, fz);
    folder.rotation.y = -a;
    tableGroup.add(folder);

    const mug = buildCoffeeMug(mats);
    mug.position.set(fx + 0.3, 0.95, fz - 0.15);
    tableGroup.add(mug);
  });

  const holoPad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.35, 0.08, 24),
    makeAccentMat('#06B6D4', 0.9),
  );
  holoPad.position.y = 0.96;
  tableGroup.add(holoPad);

  const holoGlobe = new THREE.Group();
  holoGlobe.position.y = 2.25;

  const createTargetPlanetSet = (scale = 1) => {
    const grp = new THREE.Group();
    grp.scale.setScalar(scale);

    // Dynamic Target Planet 1: Earth (Easy / LEO)
    const earthGrp = new THREE.Group();
    const earthCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.84, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.65,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true,
        opacity: 0.92,
      }),
    );
    earthGrp.add(earthCore);
    const earthLandMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.55,
      roughness: 0.5,
    });
    const landArc1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.11, 6, 12, Math.PI * 0.7),
      earthLandMat,
    );
    landArc1.rotation.set(0.5, 0.4, 0.3);
    const landArc2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.09, 6, 12, Math.PI * 0.55),
      earthLandMat,
    );
    landArc2.rotation.set(-0.6, 2.1, -0.4);
    const earthOrbitRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.36, 0.035, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.88 }),
    );
    earthOrbitRing.rotation.x = Math.PI / 3;
    earthGrp.add(landArc1, landArc2, earthOrbitRing);
    earthGrp.visible = false;

    // Dynamic Target Planet 2: Moon (Medium / Lunar)
    const moonGrp = new THREE.Group();
    const moonCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        emissive: 0x64748b,
        emissiveIntensity: 0.45,
        roughness: 0.75,
        metalness: 0.1,
        transparent: true,
        opacity: 0.92,
      }),
    );
    moonGrp.add(moonCore);
    const craterMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      emissive: 0x475569,
      emissiveIntensity: 0.35,
      roughness: 0.85,
    });
    for (const [cx, cy, cz, rx, ry, r] of [
      [0.42, 0.32, 0.62, 0.4, -0.5, 0.18],
      [-0.45, -0.22, 0.64, -0.3, 0.6, 0.22],
      [0.12, -0.55, -0.58, 0.9, 0.2, 0.16],
    ]) {
      const crater = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 14), craterMat);
      crater.position.set(cx, cy, cz);
      crater.rotation.set(rx, ry, 0);
      moonGrp.add(crater);
    }
    const moonOrbitRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.36, 0.035, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 }),
    );
    moonOrbitRing.rotation.x = Math.PI / 3;
    moonGrp.add(moonOrbitRing);
    moonGrp.visible = true;

    // Dynamic Target Planet 3: Mars (Hard / Deep Space)
    const marsGrp = new THREE.Group();
    const marsCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 24, 18),
      new THREE.MeshStandardMaterial({
        color: 0xe05a2b,
        emissive: 0x9a3412,
        emissiveIntensity: 0.55,
        roughness: 0.68,
        metalness: 0.12,
        transparent: true,
        opacity: 0.94,
      }),
    );
    const iceCapMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xcbd5e1,
      emissiveIntensity: 0.4,
      roughness: 0.45,
    });
    const northCap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), iceCapMat);
    northCap.position.y = 0.64;
    northCap.scale.set(1.2, 0.45, 1.2);
    const southCap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), iceCapMat);
    southCap.position.y = -0.66;
    southCap.scale.set(1.1, 0.4, 1.1);
    const marsOrbitRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.36, 0.035, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.88 }),
    );
    marsOrbitRing.rotation.x = Math.PI / 3;
    marsGrp.add(marsCore, northCap, southCap, marsOrbitRing);
    marsGrp.visible = false;

    grp.add(earthGrp, moonGrp, marsGrp);
    return {
      group: grp,
      setTarget: (targetBody: TargetBodyId) => {
        earthGrp.visible = targetBody === 'earth';
        moonGrp.visible = targetBody === 'moon';
        marsGrp.visible = targetBody === 'mars';
      },
    };
  };

  const meetingPlanet = createTargetPlanetSet(1);
  holoGlobe.add(meetingPlanet.group);
  tableGroup.add(holoGlobe);

  // Synced Hangar Target Planet Hologram on Rear Mezzanine Platform for Scene 1 Sweep
  const hangarPlanetPod = new THREE.Group();
  hangarPlanetPod.position.set(0, hangarMezzY, -10.8);
  const hangarHoloBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.55, 0.24, 24),
    mats.hullDark,
  );
  hangarHoloBase.position.y = 0.12;
  const hangarHoloRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.28, 0.08, 24),
    makeAccentMat('#38BDF8', 0.9),
  );
  hangarHoloRing.position.y = 0.26;
  const hangarPlanet = createTargetPlanetSet(1.55);
  hangarPlanet.group.position.y = 2.45;
  hangarPlanetPod.add(hangarHoloBase, hangarHoloRing, hangarPlanet.group);
  hangarGroup.add(hangarPlanetPod);

  const setTargetPlanet = (targetBody: TargetBodyId) => {
    meetingPlanet.setTarget(targetBody);
    hangarPlanet.setTarget(targetBody);
  };

  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const cx = Math.cos(a) * 3.75;
    const cz = Math.sin(a) * 2.55;
    const chair = buildErgonomicChair(confColors[i % 4], mats);
    chair.position.set(cx, 0, cz);
    chair.rotation.y = Math.atan2(cx, cz);
    tableGroup.add(chair);
  }

  // Airlock Blast Doorway on front (+Z) perimeter bulkhead for 3-sequence Crew Entry Cinematic
  const airlockGroup = new THREE.Group();
  airlockGroup.position.set(0, GROUND_FLOOR_Y, 11.45);
  const airlockFrameLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 3.8, 0.75),
    mats.wallTrim,
  );
  airlockFrameLeft.position.set(-2.15, 1.9, 0);
  const airlockFrameRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 3.8, 0.75),
    mats.wallTrim,
  );
  airlockFrameRight.position.set(2.15, 1.9, 0);
  const airlockHeader = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.55, 0.8),
    mats.hullDark,
  );
  airlockHeader.position.set(0, 3.85, 0);
  const airlockRecessBack = new THREE.Mesh(
    new THREE.BoxGeometry(3.85, 3.55, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x050811, roughness: 0.9, metalness: 0.2 }),
  );
  airlockRecessBack.position.set(0, 1.78, 0.34);
  const airlockBeaconMat = makeAccentMat('#38BDF8', 1.15);
  const airlockBeaconBar = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.12, 0.16),
    airlockBeaconMat,
  );
  airlockBeaconBar.position.set(0, 3.58, -0.34);

  const airlockLeftDoor = new THREE.Mesh(
    new THREE.BoxGeometry(1.92, 3.5, 0.22),
    mats.titanium,
  );
  airlockLeftDoor.position.set(-0.96, 1.75, 0);
  const airlockLeftStripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.14, 0.26),
    makeAccentMat('#F97316', 0.8),
  );
  airlockLeftStripe.position.y = 0.05;
  airlockLeftDoor.add(airlockLeftStripe);

  const airlockRightDoor = new THREE.Mesh(
    new THREE.BoxGeometry(1.92, 3.5, 0.22),
    mats.titanium,
  );
  airlockRightDoor.position.set(0.96, 1.75, 0);
  const airlockRightStripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.14, 0.26),
    makeAccentMat('#F97316', 0.8),
  );
  airlockRightStripe.position.y = 0.05;
  airlockRightDoor.add(airlockRightStripe);

  airlockGroup.add(
    airlockFrameLeft,
    airlockFrameRight,
    airlockHeader,
    airlockRecessBack,
    airlockBeaconBar,
    airlockLeftDoor,
    airlockRightDoor,
  );
  meetingGroup.add(airlockGroup);

  // 4 Expressive Floating-Limb Role Crew Avatars standing at briefing table corners
  const briefingBotSpecs: Array<{
    roleId: RoleId;
    accentHex: string;
    suitHex: number;
    angle: number;
    entryColX: number;
    entryDelay: number;
  }> = [
    { roleId: 'systems', accentHex: '#F97316', suitHex: 0xf1f5f9, angle: Math.PI * 0.25, entryColX: -0.75, entryDelay: 0.0 },
    { roleId: 'finance', accentHex: '#EAB308', suitHex: 0xe2e8f0, angle: Math.PI * 0.75, entryColX: 0.75, entryDelay: 0.35 },
    { roleId: 'science', accentHex: '#22C55E', suitHex: 0xecfdf5, angle: Math.PI * 1.25, entryColX: -0.75, entryDelay: 0.7 },
    { roleId: 'pilot', accentHex: '#3B82F6', suitHex: 0xeff6ff, angle: Math.PI * 1.75, entryColX: 0.75, entryDelay: 1.05 },
  ];
  const meetingCrewEntries: Array<{
    bot: RepoCrewBotRig;
    seatX: number;
    seatZ: number;
    entryColX: number;
    entryDelay: number;
  }> = [];

  briefingBotSpecs.forEach((spec) => {
    const bot = buildRepoCrewBot(mats, {
      roleId: spec.roleId,
      accentHex: spec.accentHex,
      suitHex: spec.suitHex,
      withScannerWand: false,
    });
    const bx = Math.cos(spec.angle) * 4.45;
    const bz = Math.sin(spec.angle) * 3.1;
    bot.group.position.set(bx, 0, bz);
    bot.group.lookAt(0, 0, 0);
    tableGroup.add(bot.group);
    crewBots.push(bot);
    meetingCrewEntries.push({
      bot,
      seatX: bx,
      seatZ: bz,
      entryColX: spec.entryColX,
      entryDelay: spec.entryDelay,
    });
  });

  registerInteractableObject(
    tableGroup,
    'mtg-holo',
    'meeting',
    INTERACTABLES_MAP['mtg-holo'].hoverLabel,
    '#06B6D4',
    3.6,
    2.6,
    2.8,
    interactableTargets,
    interactableRegistry,
    {
      cameraLocalPos: [0, 3.25, 5.8],
      cameraLocalLookAt: [0, 1.85, 0],
    },
  );
  meetingGroup.add(tableGroup);

  const meetingMezzY = GROUND_FLOOR_Y + meetingDef.firstPerson!.mezzanine!.elevation;
  const meetingBoard = buildWhiteboard(4.2, 2.0, 'ORBITAL PLANNING · NASA MISSION', mats);
  meetingBoard.position.set(0, meetingMezzY + 2.0, -11.5);
  meetingGroup.add(meetingBoard);

  // Rich Meeting Room Decor: 8 Varied Plants, Extra Bookshelves, Telemetry Racks, Posters & Crates
  const mtgPlants: Array<[number, number, number, number]> = [
    [-10.4, GROUND_FLOOR_Y, 4.2, 1.15],
    [10.4, GROUND_FLOOR_Y, 4.2, 0.92],
    [-10.1, GROUND_FLOOR_Y, -1.6, 1.05],
    [10.1, GROUND_FLOOR_Y, -1.6, 1.24],
    [-6.6, GROUND_FLOOR_Y, 9.4, 0.84],
    [6.6, GROUND_FLOOR_Y, 9.4, 0.88],
    [-8.6, meetingMezzY, -8.8, 1.1],
    [8.6, meetingMezzY, -8.8, 0.95],
  ];
  mtgPlants.forEach(([px, py, pz, s]) => {
    const plant = buildPottedPlant(mats);
    plant.scale.setScalar(s);
    plant.position.set(px, py, pz);
    meetingGroup.add(plant);
  });

  const mtgShelf = buildBookshelfWithBooks('#06B6D4', mats);
  mtgShelf.position.set(-5.8, GROUND_FLOOR_Y, -8.5);
  meetingGroup.add(mtgShelf);

  const mtgShelf2 = buildBookshelfWithBooks('#38BDF8', mats);
  mtgShelf2.position.set(0, GROUND_FLOOR_Y, -9.2);
  meetingGroup.add(mtgShelf2);

  const mtgLockers = buildLockerBank('#06B6D4', mats);
  mtgLockers.position.set(5.8, GROUND_FLOOR_Y, -8.5);
  meetingGroup.add(mtgLockers);

  const mtgRack1 = buildServerTelemetryRack('#06B6D4', mats);
  mtgRack1.position.set(-5.2, meetingMezzY, -9.5);
  meetingGroup.add(mtgRack1);

  const mtgRack2 = buildServerTelemetryRack('#38BDF8', mats);
  mtgRack2.position.set(5.2, meetingMezzY, -9.5);
  meetingGroup.add(mtgRack2);

  const mtgWallLeft = buildWallPoster(3.4, 1.7, 'orbitmap', '#06B6D4', 'TEAM ORBITAL TRAJECTORIES', mats);
  mtgWallLeft.position.set(-12.4, 3.6, 0);
  mtgWallLeft.rotation.y = Math.PI / 2;
  meetingGroup.add(mtgWallLeft);

  const mtgWallRight = buildWallPoster(3.4, 1.7, 'comms', '#38BDF8', 'DEPARTMENTAL SYNC', mats);
  mtgWallRight.position.set(12.4, 3.6, 0);
  mtgWallRight.rotation.y = -Math.PI / 2;
  meetingGroup.add(mtgWallRight);

  meetingGroup.add(
    buildFloorCable(
      [
        [0, GROUND_FLOOR_Y + 0.04, 1.2],
        [-3.5, GROUND_FLOOR_Y + 0.04, -4.0],
        [-5.2, GROUND_FLOOR_Y + 0.04, -8.2],
      ],
      '#06B6D4',
    ),
  );

  // =========================================================================
  // 3. UNIFIED ROLE ROOM BUILDER (4 Role Rooms x 6 Interactables + Rich Decor)
  // =========================================================================
  const scienceHolo = new THREE.Group();
  scienceHolo.position.y = 1.65;
  scienceHolo.add(
    new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 2),
      new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      }),
    ),
  );

  const radarDish = new THREE.Group();
  const radarRigs: AerospaceRadarRig[] = [];
  const robotArm = new THREE.Group();

  const buildRoleRoom = (cfg: BuildRoleRoomConfig) => {
    const roomDef = ROOM_MAP[cfg.roomId];
    const roomGroup = buildOpaqueTwoLevelRoomShell(
      cfg.roomId,
      13.5,
      7.6,
      cfg.accentHex,
      roomDef.firstPerson!.mezzanine!,
      {
        wallMat: cfg.wallMat,
        floorMat: cfg.floorMat,
        interiorLightColor: cfg.interiorLightColor,
        interiorLightIntensity: 34,
      },
      mats,
      clickTargets,
      roomRings,
      roofGroups,
      alertTargets,
    );
    roomGroup.position.set(...cfg.position);
    root.add(roomGroup);

    const prefix =
      cfg.roomId === 'systems'
        ? 'sys'
        : cfg.roomId === 'finance'
          ? 'fin'
          : cfg.roomId === 'science'
            ? 'sci'
            : 'plt';

    // (1) Main Computer Workstation (0, GROUND_FLOOR_Y, -0.8)
    const pcId = `${prefix}-computer` as InteractableId;
    const pcDesk = buildCurvedDeskWorkstation(
      cfg.accentHex,
      cfg.screenTheme,
      cfg.pcTitle,
      mats,
      true,
    );
    pcDesk.position.set(0, GROUND_FLOOR_Y, -0.8);
    const deskLamp = buildDeskLamp(cfg.accentHex, mats);
    deskLamp.position.set(-1.12, 0.84, -0.26);
    deskLamp.rotation.y = 0.45;
    pcDesk.add(deskLamp);

    registerInteractableObject(
      pcDesk,
      pcId,
      cfg.roomId,
      INTERACTABLES_MAP[pcId].hoverLabel,
      cfg.accentHex,
      2.05,
      2.1,
      2.2,
      interactableTargets,
      interactableRegistry,
      {
        cameraLocalPos: [0, 1.52, 1.35],
        cameraLocalLookAt: [0, 1.24, -0.5],
      },
    );
    roomGroup.add(pcDesk);

    // (2) Animated Filing Drawer + Rising Paper Sheet (-4.6, GROUND_FLOOR_Y, +3.3)
    const drawerId = `${prefix}-drawer` as InteractableId;
    const { group: drawerGroup, drawerSlideGroup, paperSheet } =
      buildAnimatedFilingDrawer(cfg.accentHex, mats);
    drawerGroup.position.set(-4.6, GROUND_FLOOR_Y, 3.3);
    drawerGroup.rotation.y = 0.48;
    registerInteractableObject(
      drawerGroup,
      drawerId,
      cfg.roomId,
      INTERACTABLES_MAP[drawerId].hoverLabel,
      cfg.accentHex,
      1.5,
      2.1,
      2.2,
      interactableTargets,
      interactableRegistry,
      {
        cameraLocalPos: [0, 1.82, 1.55],
        cameraLocalLookAt: [0, 1.44, 0.35],
        drawerSlideGroup,
        paperSheet,
      },
    );
    roomGroup.add(drawerGroup);

    // (3) Role Validation / Test Bench (+4.6, GROUND_FLOOR_Y, +3.3)
    const benchId = `${prefix}-bench` as InteractableId;
    const benchGroup = cfg.buildBenchProp();
    benchGroup.position.set(4.6, GROUND_FLOOR_Y, 3.3);
    benchGroup.rotation.y = -0.48;
    registerInteractableObject(
      benchGroup,
      benchId,
      cfg.roomId,
      INTERACTABLES_MAP[benchId].hoverLabel,
      cfg.accentHex,
      1.95,
      2.2,
      2.25,
      interactableTargets,
      interactableRegistry,
      {
        cameraLocalPos: [0, 1.92, 2.35],
        cameraLocalLookAt: [0, 1.15, 0],
      },
    );
    roomGroup.add(benchGroup);

    // (4) Standing Requirements Whiteboard (-4.8, GROUND_FLOOR_Y, -1.8)
    const wbId = `${prefix}-whiteboard` as InteractableId;
    const wbGroup = buildStandingWhiteboard(
      2.75,
      1.55,
      cfg.whiteboardTitle,
      cfg.accentHex,
      mats,
    );
    wbGroup.position.set(-4.8, GROUND_FLOOR_Y, -1.8);
    wbGroup.rotation.y = 0.52;
    registerInteractableObject(
      wbGroup,
      wbId,
      cfg.roomId,
      INTERACTABLES_MAP[wbId].hoverLabel,
      cfg.accentHex,
      1.75,
      2.55,
      2.65,
      interactableTargets,
      interactableRegistry,
      {
        cameraLocalPos: [0, 1.65, 2.35],
        cameraLocalLookAt: [0, 1.62, 0],
      },
    );
    roomGroup.add(wbGroup);

    // (5) Inter-Department Messaging Terminal (+4.8, GROUND_FLOOR_Y, -1.8)
    const commsId = `${prefix}-comms` as InteractableId;
    const commsGroup = buildCommsTerminal(cfg.accentHex, cfg.commsTitle, mats);
    commsGroup.position.set(4.8, GROUND_FLOOR_Y, -1.8);
    commsGroup.rotation.y = -0.52;
    registerInteractableObject(
      commsGroup,
      commsId,
      cfg.roomId,
      INTERACTABLES_MAP[commsId].hoverLabel,
      cfg.accentHex,
      1.55,
      2.2,
      2.3,
      interactableTargets,
      interactableRegistry,
      {
        cameraLocalPos: [0, 1.62, 1.85],
        cameraLocalLookAt: [0, 1.42, -0.05],
      },
    );
    roomGroup.add(commsGroup);

    // (6) Aerospace Standards Bookshelf (0, GROUND_FLOOR_Y, -8.8 under mezzanine)
    const manualsId = `${prefix}-manuals` as InteractableId;
    const shelfGroup = buildBookshelfWithBooks(cfg.accentHex, mats);
    shelfGroup.position.set(0, GROUND_FLOOR_Y, -8.8);
    registerInteractableObject(
      shelfGroup,
      manualsId,
      cfg.roomId,
      INTERACTABLES_MAP[manualsId].hoverLabel,
      cfg.accentHex,
      1.7,
      2.2,
      2.3,
      interactableTargets,
      interactableRegistry,
      {
        cameraLocalPos: [0, 1.48, 2.15],
        cameraLocalLookAt: [0, 1.22, 0],
      },
    );
    roomGroup.add(shelfGroup);

    // Rich Non-Colliding Interior Decor: 8 Varied Plants, Extra Shelves, Blinking Telemetry Racks, Tool Carts, Crates & Wall Posters
    const mezzY = GROUND_FLOOR_Y + roomDef.firstPerson!.mezzanine!.elevation;

    const plantSpecs: Array<[number, number, number, number]> = [
      [-9.8, GROUND_FLOOR_Y, 4.6, 1.18],
      [9.8, GROUND_FLOOR_Y, 4.6, 0.92],
      [-5.6, GROUND_FLOOR_Y, 9.2, 0.85],
      [5.6, GROUND_FLOOR_Y, 9.2, 1.05],
      [-3.3, GROUND_FLOOR_Y, -9.6, 0.78],
      [3.3, GROUND_FLOOR_Y, -9.6, 0.82],
      [-8.4, mezzY, -8.2, 1.15],
      [8.4, mezzY, -8.2, 0.95],
    ];
    plantSpecs.forEach(([px, py, pz, s]) => {
      const plant = buildPottedPlant(mats);
      plant.scale.setScalar(s);
      plant.position.set(px, py, pz);
      roomGroup.add(plant);
    });

    const lockerBank = buildLockerBank(cfg.accentHex, mats);
    lockerBank.position.set(-6.4, GROUND_FLOOR_Y, -8.9);
    roomGroup.add(lockerBank);

    const extraShelf = buildBookshelfWithBooks(cfg.accentHex, mats);
    extraShelf.position.set(3.4, GROUND_FLOOR_Y, -9.4);
    roomGroup.add(extraShelf);

    const serverRackGround = buildServerTelemetryRack(cfg.accentHex, mats);
    serverRackGround.position.set(6.5, GROUND_FLOOR_Y, -8.9);
    roomGroup.add(serverRackGround);

    const serverRackMezz = buildServerTelemetryRack(cfg.accentHex, mats);
    serverRackMezz.position.set(-0.4, mezzY, -9.6);
    roomGroup.add(serverRackMezz);

    const toolCart = buildRollingToolCart(cfg.accentHex, mats);
    toolCart.position.set(8.2, GROUND_FLOOR_Y, 6.6);
    toolCart.rotation.y = -2.35;
    roomGroup.add(toolCart);

    const crateCluster = buildTechCrateCluster(cfg.accentHex, mats);
    crateCluster.scale.setScalar(0.85);
    crateCluster.position.set(-8.4, GROUND_FLOOR_Y, 6.6);
    crateCluster.rotation.y = 0.5;
    roomGroup.add(crateCluster);

    const leftWallPoster = buildWallPoster(3.2, 1.65, cfg.screenTheme, cfg.accentHex, `${cfg.commsTitle} · PANEL`, mats);
    leftWallPoster.position.set(-11.9, 3.6, 0.2);
    leftWallPoster.rotation.y = Math.PI / 2;
    roomGroup.add(leftWallPoster);

    const rightWallPoster = buildWallPoster(3.2, 1.65, 'orbitmap', cfg.accentHex, 'BASE TELEMETRY', mats);
    rightWallPoster.position.set(11.9, 3.6, 0.2);
    rightWallPoster.rotation.y = -Math.PI / 2;
    roomGroup.add(rightWallPoster);

    // Local floor cable bundles inside room coordinates
    roomGroup.add(
      buildFloorCable(
        [
          [0, GROUND_FLOOR_Y + 0.04, -1.6],
          [2.4, GROUND_FLOOR_Y + 0.04, -1.75],
          [4.6, GROUND_FLOOR_Y + 0.04, -1.85],
        ],
        cfg.accentHex,
      ),
      buildFloorCable(
        [
          [0, GROUND_FLOOR_Y + 0.04, -1.4],
          [-2.3, GROUND_FLOOR_Y + 0.04, -1.65],
          [-4.5, GROUND_FLOOR_Y + 0.04, -1.85],
        ],
        cfg.accentHex,
      ),
    );

    cfg.buildMezzExtras(mezzY).forEach((obj) => roomGroup.add(obj));

    // Role Specialist Avatar stationed beside the main workstation (visible in Intro & room framing)
    const roomSpecialistRole = cfg.roomId as RoleId;
    const roomBot = buildRepoCrewBot(mats, {
      roleId: roomSpecialistRole,
      accentHex: cfg.accentHex,
      withScannerWand: false,
    });
    roomBot.group.position.set(1.48, GROUND_FLOOR_Y, -1.42);
    roomBot.group.rotation.y = -0.26;
    roomGroup.add(roomBot.group);
    crewBots.push(roomBot);
  };

  // --- ROLE 1: MECHANIC (-44, 0, -28) ---
  buildRoleRoom({
    roomId: 'systems',
    position: [-44, 0, -28],
    accentHex: '#F97316',
    screenTheme: 'cad',
    pcTitle: 'MECHANIC · CAD & STRUCTURAL',
    whiteboardTitle: 'REQUIREMENTS & ΔV EQUATION',
    commsTitle: 'MECHANIC COMMS',
    wallMat: mats.wallCementOrange,
    floorMat: mats.floorPolishedOrange,
    interiorLightColor: 0xffedd5,
    buildBenchProp: () => {
      const bench = new THREE.Group();
      const draft = buildDraftingTableWithBlueprints('#F97316', mats);
      draft.position.set(0, 0, 0);
      bench.add(draft);
      const miniNoz = new THREE.Mesh(
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.08, 0.55),
            new THREE.Vector2(0.14, 0.44),
            new THREE.Vector2(0.1, 0.34),
            new THREE.Vector2(0.24, 0.06),
            new THREE.Vector2(0.28, 0.0),
          ],
          16,
        ),
        mats.copperNozzle,
      );
      miniNoz.position.set(0.75, 1.0, 0.15);
      bench.add(miniNoz);
      return bench;
    },
    buildMezzExtras: (mezzY) => {
      const propOrangeMat = makeAccentMat('#F97316', 0.45);
      const testStandGroup = new THREE.Group();
      testStandGroup.position.set(-3.6, mezzY, -7.8);
      const standBase = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.55, 0.45, 16),
        mats.hazardFloor,
      );
      standBase.position.y = 0.225;
      testStandGroup.add(standBase);
      const miniNozzle = new THREE.Mesh(
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.18, 1.45),
            new THREE.Vector2(0.35, 1.2),
            new THREE.Vector2(0.24, 0.95),
            new THREE.Vector2(0.62, 0.2),
            new THREE.Vector2(0.75, 0.0),
          ],
          18,
        ),
        mats.copperNozzle,
      );
      miniNozzle.position.y = 0.45;
      testStandGroup.add(miniNozzle);
      const archCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.05, 0.45, 0),
        new THREE.Vector3(-0.95, 2.2, 0),
        new THREE.Vector3(0, 2.45, 0),
        new THREE.Vector3(0.95, 2.2, 0),
        new THREE.Vector3(1.05, 0.45, 0),
      ]);
      testStandGroup.add(
        new THREE.Mesh(new THREE.TubeGeometry(archCurve, 18, 0.08, 8, false), propOrangeMat),
      );

      const robotBaseGroup = new THREE.Group();
      robotBaseGroup.position.set(3.8, mezzY, -7.8);
      const rPedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.95, 0.55, 14),
        mats.hullDark,
      );
      rPedestal.position.y = 0.275;
      robotBaseGroup.add(rPedestal);
      robotArm.position.y = 0.55;
      robotArm.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), propOrangeMat));
      const armLink1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.0, 6, 10), mats.hullWhite);
      armLink1.position.set(0.22, 0.65, 0);
      armLink1.rotation.z = -0.32;
      robotArm.add(armLink1);
      const armLink2 = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.1, 0.85, 6, 10),
        mats.brushedSteel,
      );
      armLink2.position.set(0.15, 1.65, 0.2);
      armLink2.rotation.z = 0.55;
      robotArm.add(armLink2);
      robotBaseGroup.add(robotArm);

      const sysPoster = buildWallPoster(3.6, 1.75, 'specs', '#F97316', 'ROCKET ARCHITECTURE', mats);
      sysPoster.position.set(0, mezzY + 1.55, -10.2);

      return [testStandGroup, robotBaseGroup, sysPoster];
    },
  });

  // --- ROLE 4: PROGRAM MANAGER (-44, 0, 28) ---
  buildRoleRoom({
    roomId: 'finance',
    position: [-44, 0, 28],
    accentHex: '#EAB308',
    screenTheme: 'finance',
    pcTitle: 'PROGRAM MANAGER · TERMINAL',
    whiteboardTitle: 'BUDGET & CONTRACT LEDGER',
    commsTitle: 'MANAGER COMMS',
    wallMat: mats.wallCementYellow,
    floorMat: mats.floorPolishedYellow,
    interiorLightColor: 0xfef3c7,
    buildBenchProp: () => {
      const bench = new THREE.Group();
      const topShape = makeRoundedRectShape(2.2, 1.15, 0.14);
      const topGeo = new THREE.ExtrudeGeometry(topShape, {
        depth: 0.08,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
      });
      topGeo.rotateX(Math.PI / 2);
      topGeo.center();
      const top = new THREE.Mesh(topGeo, mats.woodTable);
      top.position.y = 0.86;
      top.castShadow = true;
      bench.add(top);
      for (const lx of [-0.88, 0.88]) {
        for (const lz of [-0.36, 0.36]) {
          const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.045, 0.84, 8),
            mats.brushedSteel,
          );
          leg.position.set(lx, 0.42, lz);
          bench.add(leg);
        }
      }
      const scaleRocket = buildScaleRocketModel('#EAB308', mats);
      scaleRocket.scale.setScalar(1.35);
      scaleRocket.position.set(-0.35, 0.9, 0);
      bench.add(scaleRocket);

      const folder = buildBeveledFolder('#EAB308', mats);
      folder.position.set(0.45, 0.9, 0.12);
      folder.rotation.y = -0.3;
      bench.add(folder);

      const lamp = buildDeskLamp('#EAB308', mats);
      lamp.position.set(0.65, 0.9, -0.22);
      bench.add(lamp);
      return bench;
    },
    buildMezzExtras: (mezzY) => {
      const finPoster = buildWallPoster(
        4.0,
        1.85,
        'finance',
        '#EAB308',
        'LAUNCH VEHICLE TIMELINE',
        mats,
      );
      finPoster.position.set(0, mezzY + 1.55, -10.2);

      const loungeDesk = buildCurvedDeskWorkstation(
        '#EAB308',
        'finance',
        'CONTRACT AUDIT',
        mats,
        true,
      );
      loungeDesk.position.set(3.4, mezzY, -7.8);
      return [finPoster, loungeDesk];
    },
  });

  // --- ROLE 3: SCIENTIST (44, 0, -28) ---
  buildRoleRoom({
    roomId: 'science',
    position: [44, 0, -28],
    accentHex: '#22C55E',
    screenTheme: 'science',
    pcTitle: 'SCIENTIST · PAYLOAD TERMINAL',
    whiteboardTitle: 'SCIENCE OBJECTIVES & DATA',
    commsTitle: 'SCIENTIST COMMS',
    wallMat: mats.wallCementGreen,
    floorMat: mats.floorPolishedGreen,
    interiorLightColor: 0xf0fdf4,
    buildBenchProp: () => {
      const bench = new THREE.Group();
      const microBench = buildMicroscopeAndCentrifugeBench('#22C55E', mats);
      bench.add(microBench);
      const rack = buildSampleTubeRack('#22C55E', mats);
      rack.scale.setScalar(0.65);
      rack.position.set(0, 0.92, -0.35);
      bench.add(rack);
      return bench;
    },
    buildMezzExtras: (mezzY) => {
      const moleculePoster = buildWallPoster(
        3.6,
        1.8,
        'molecule',
        '#22C55E',
        'MOLECULAR SPECTRUM & PAYLOAD',
        mats,
      );
      moleculePoster.position.set(-3.4, mezzY + 1.55, -9.9);

      const planetBench = new THREE.Group();
      planetBench.position.set(3.8, mezzY, -7.8);
      const pBase = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.3, 0.75, 18),
        mats.hullDark,
      );
      pBase.position.y = 0.375;
      planetBench.add(pBase);
      planetBench.add(scienceHolo);

      return [moleculePoster, planetBench];
    },
  });

  // Dedicated 3D Holographic Orbital Trajectory Rig for Engineer (pilot) room bench
  const pilotHoloGroup = new THREE.Group();
  pilotHoloGroup.position.set(0.05, 1.85, 0.25);

  const pilotHoloPlanet = createTargetPlanetSet(0.46);
  pilotHoloGroup.add(pilotHoloPlanet.group);

  const orbitEllipseGroup = new THREE.Group();
  const ORBIT_SEGMENTS = 64;
  const orbitPositions = new Float32Array(ORBIT_SEGMENTS * 3);
  const orbitGeo = new THREE.BufferGeometry();
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
  const orbitLineMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.92,
  });
  const orbitLine = new THREE.LineLoop(orbitGeo, orbitLineMat);
  orbitEllipseGroup.add(orbitLine);

  const apogeeMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
  );
  const perigeeMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0x10b981 }),
  );
  const orbitProbeGroup = new THREE.Group();
  const probeBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.05, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
  );
  const probeWingL = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.012, 0.045),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
  );
  probeWingL.position.x = -0.11;
  const probeWingR = probeWingL.clone();
  probeWingR.position.x = 0.11;
  orbitProbeGroup.add(probeBody, probeWingL, probeWingR);
  orbitEllipseGroup.add(apogeeMarker, perigeeMarker, orbitProbeGroup);
  pilotHoloGroup.add(orbitEllipseGroup);

  let holoOrbitSemiMajor = 1.05;
  let holoOrbitSemiMinor = 0.85;
  let holoOrbitFocalShift = 0.35;

  const updateHoloEllipseGeometry = (config: OrbitalTrajectoryConfig | null) => {
    const targetBody: TargetBodyId = config?.targetBody ?? 'moon';
    pilotHoloPlanet.setTarget(targetBody);

    const perigeeKm = config?.perigeeKm ?? 320;
    const apogeeKm = Math.max(perigeeKm + 20, config?.apogeeKm ?? 3600);
    const incDeg = config?.inclinationDeg ?? 28.5;

    const maxRef = targetBody === 'mars' ? 6000 : targetBody === 'moon' ? 2000 : 1200;
    const rpNorm = 0.56 + THREE.MathUtils.clamp(perigeeKm / maxRef, 0, 1) * 0.32;
    const raNorm = Math.max(
      rpNorm + 0.08,
      0.66 + THREE.MathUtils.clamp(apogeeKm / (maxRef * 4), 0, 1) * 0.72,
    );

    holoOrbitSemiMajor = (raNorm + rpNorm) * 0.5;
    holoOrbitFocalShift = (raNorm - rpNorm) * 0.5;
    holoOrbitSemiMinor = Math.sqrt(Math.max(0.2, holoOrbitSemiMajor * holoOrbitSemiMajor - holoOrbitFocalShift * holoOrbitFocalShift));

    const posAttr = orbitGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < ORBIT_SEGMENTS; i++) {
      const t = (i / ORBIT_SEGMENTS) * Math.PI * 2;
      const x = holoOrbitFocalShift + holoOrbitSemiMajor * Math.cos(t);
      const z = holoOrbitSemiMinor * Math.sin(t);
      posAttr.setXYZ(i, x, 0, z);
    }
    posAttr.needsUpdate = true;

    apogeeMarker.position.set(holoOrbitFocalShift + holoOrbitSemiMajor, 0, 0);
    perigeeMarker.position.set(holoOrbitFocalShift - holoOrbitSemiMajor, 0, 0);

    orbitEllipseGroup.rotation.set(
      THREE.MathUtils.degToRad(incDeg * 0.65),
      0.22,
      THREE.MathUtils.degToRad(10),
    );
    orbitLineMat.color.setHex(
      targetBody === 'mars' ? 0xf97316 : targetBody === 'moon' ? 0x38bdf8 : 0x22d3ee,
    );
  };
  updateHoloEllipseGeometry(null);

  // --- ROLE 2: ENGINEER (44, 0, 28) ---
  buildRoleRoom({
    roomId: 'pilot',
    position: [44, 0, 28],
    accentHex: '#3B82F6',
    screenTheme: 'flight',
    pcTitle: 'ENGINEER · FLIGHT & ORBIT',
    whiteboardTitle: 'TRAJECTORY & KA/S LINKS',
    commsTitle: 'ENGINEER COMMS',
    wallMat: mats.wallCementBlue,
    floorMat: mats.floorPolishedBlue,
    interiorLightColor: 0xdbeafe,
    buildBenchProp: () => {
      const bench = new THREE.Group();
      const benchBase = new THREE.Mesh(
        new THREE.BoxGeometry(2.55, 0.86, 1.25),
        mats.hullDark,
      );
      benchBase.position.set(0, 0.43, 0);
      benchBase.castShadow = true;
      benchBase.receiveShadow = true;
      bench.add(benchBase);

      const emitterRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.68, 0.1, 24),
        makeAccentMat('#38BDF8', 1.15),
      );
      emitterRing.position.set(0.05, 0.91, 0.25);
      bench.add(emitterRing);

      const indoorRadar = buildAerospaceRadarStation('#3B82F6', mats, 0.5);
      indoorRadar.group.position.set(-0.88, 0.86, -0.18);
      radarRigs.push(indoorRadar);
      radarDish.add(indoorRadar.group);
      bench.add(radarDish);

      const srv = buildServerTelemetryRack('#3B82F6', mats);
      srv.scale.setScalar(0.76);
      srv.position.set(0.95, 0, -0.22);
      bench.add(srv);

      bench.add(pilotHoloGroup);
      return bench;
    },
    buildMezzExtras: (mezzY) => {
      const orbitPoster = buildWallPoster(
        4.0,
        1.9,
        'orbitmap',
        '#3B82F6',
        'REAL-TIME ORBITAL TRACK',
        mats,
      );
      orbitPoster.position.set(-3.2, mezzY + 1.55, -9.9);

      const simDesk = buildCurvedDeskWorkstation(
        '#3B82F6',
        'flight',
        'ORBIT SIMULATOR',
        mats,
        true,
      );
      simDesk.position.set(3.4, mezzY, -7.8);
      return [orbitPoster, simDesk];
    },
  });

  ROOMS.forEach((r) => {
    if (r.id !== 'overview' && !roomRings[r.id]) {
      console.warn('Missing ring for room', r.id);
    }
  });

  // Exterior Complex High-Detail Aerospace Tracking & Telemetry Radar Stations
  const exteriorRadarPlacements: Array<{ x: number; z: number; rotY: number; accent: string }> = [
    { x: 22, z: 44, rotY: -0.45, accent: '#38BDF8' },
    { x: -24, z: -44, rotY: 0.65, accent: '#06B6D4' },
  ];
  exteriorRadarPlacements.forEach((spec) => {
    const stationWrap = new THREE.Group();
    stationWrap.position.set(spec.x, 0, spec.z);

    const apronPad = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.5, 0.28, 12),
      mats.concretePad,
    );
    apronPad.position.y = 0.14;
    apronPad.receiveShadow = true;
    stationWrap.add(apronPad);

    const radarRig = buildAerospaceRadarStation(spec.accent, mats, 1.35);
    radarRig.group.position.y = 0.28;
    radarRig.group.rotation.y = spec.rotY;
    stationWrap.add(radarRig.group);
    radarRigs.push(radarRig);

    const powerBox = buildServerTelemetryRack(spec.accent, mats);
    powerBox.scale.setScalar(0.75);
    powerBox.position.set(-2.1, 0.28, -1.3);
    powerBox.rotation.y = 0.4;
    stationWrap.add(powerBox);

    root.add(stationWrap);
  });

  // Mount physical fragile 3D cargo modules, tractor beam tether, and impact spark pool
  const cargoObjects = buildCargoObjects(mats);
  const cargoTargets: THREE.Object3D[] = [];
  Object.values(cargoObjects).forEach((cargo) => {
    const originCenter = ROOM_MAP[cargo.def.originRoomId].center;
    cargo.position.set(
      originCenter[0] + cargo.def.spawnLocalPos[0],
      cargo.def.spawnLocalPos[1],
      originCenter[2] + cargo.def.spawnLocalPos[2],
    );
    cargo.group.position.copy(cargo.position);
    root.add(cargo.group);
    cargoTargets.push(cargo.hitProxy);
  });

  const tractorBeam = buildTractorBeamEffect();
  root.add(tractorBeam.group);

  const impactSparks = buildImpactSparkPool();
  root.add(impactSparks.group);

  const _anchorTemp = new THREE.Vector3();
  const _localVecTemp = new THREE.Vector3();

  function getInteractableAnchor(id: InteractableId, out: THREE.Vector3): boolean {
    const item = interactableRegistry[id];
    if (!item) return false;
    item.group.getWorldPosition(out);
    out.y += item.anchorOffsetY;
    return true;
  }

  function getInteractableCameraPose(
    id: InteractableId,
    outPos: THREE.Vector3,
    outLookAt: THREE.Vector3,
  ): boolean {
    const item = interactableRegistry[id];
    if (!item) return false;
    item.group.updateWorldMatrix(true, false);
    _localVecTemp.set(...item.cameraLocalPos);
    outPos.copy(_localVecTemp).applyMatrix4(item.group.matrixWorld);
    _localVecTemp.set(...item.cameraLocalLookAt);
    outLookAt.copy(_localVecTemp).applyMatrix4(item.group.matrixWorld);
    return true;
  }

  let meetingCinematicRunning = false;

  const setHologramTrajectory = (config: OrbitalTrajectoryConfig | null) => {
    updateHoloEllipseGeometry(config);
  };

  function getPilotHologramCameraPose(outPos: THREE.Vector3, outLookAt: THREE.Vector3): boolean {
    pilotHoloGroup.updateWorldMatrix(true, false);
    pilotHoloGroup.getWorldPosition(outLookAt);
    _localVecTemp.set(0.1, 0.55, 2.55);
    outPos.copy(_localVecTemp).applyMatrix4(pilotHoloGroup.matrixWorld);
    return true;
  }

  function updateMeetingCinematic(elapsedSec: number, delta: number, active: boolean) {
    meetingCinematicRunning = active;
    if (!active) {
      airlockLeftDoor.position.x = THREE.MathUtils.damp(airlockLeftDoor.position.x, -0.96, 8, delta);
      airlockRightDoor.position.x = THREE.MathUtils.damp(airlockRightDoor.position.x, 0.96, 8, delta);
      return;
    }

    // Sequence 1 (0 - 3.5s): Airlock doors slide open, 4 specialists march in
    // Sequence 2 (3.5 - 7.0s): Specialists walk to oval table positions
    // Sequence 3 (7.0 - 10.5s): Specialists settle around table gazing at Planet Hologram
    const doorsOpen = elapsedSec >= 0.15 && elapsedSec < 7.6;
    const targetLeftX = doorsOpen ? -2.42 : -0.96;
    const targetRightX = doorsOpen ? 2.42 : 0.96;
    airlockLeftDoor.position.x = THREE.MathUtils.damp(airlockLeftDoor.position.x, targetLeftX, 7, delta);
    airlockRightDoor.position.x = THREE.MathUtils.damp(airlockRightDoor.position.x, targetRightX, 7, delta);

    const doorBeaconHex = doorsOpen ? 0x22c55e : 0xef4444;
    airlockBeaconMat.color.setHex(doorBeaconHex);
    airlockBeaconMat.emissive.setHex(doorBeaconHex);

    meetingCrewEntries.forEach((entry, idx) => {
      const bot = entry.bot;
      bot.group.visible = true;

      let targetX = entry.seatX;
      let targetZ = entry.seatZ;
      let moveSpeed = 0;

      if (elapsedSec < 3.5) {
        const localT = THREE.MathUtils.clamp((elapsedSec - entry.entryDelay * 0.65) / 2.4, 0, 1);
        const smoothT = localT * localT * (3 - 2 * localT);
        targetX = entry.entryColX;
        targetZ = THREE.MathUtils.lerp(9.8, 5.2 - (idx >= 2 ? 0.9 : 0), smoothT);
        moveSpeed = localT > 0.02 && localT < 0.98 ? 0.95 : 0;
        bot.group.position.set(targetX, 0, targetZ);
        bot.group.rotation.y = Math.PI; // Facing -Z into Gates Room
      } else if (elapsedSec < 7.0) {
        const walkT = THREE.MathUtils.clamp((elapsedSec - 3.5) / 3.2, 0, 1);
        const smoothWalk = walkT * walkT * (3 - 2 * walkT);
        const startX = entry.entryColX;
        const startZ = 5.2 - (idx >= 2 ? 0.9 : 0);
        targetX = THREE.MathUtils.lerp(startX, entry.seatX, smoothWalk);
        targetZ = THREE.MathUtils.lerp(startZ, entry.seatZ, smoothWalk);
        const dx = entry.seatX - startX;
        const dz = entry.seatZ - startZ;
        bot.group.position.set(targetX, 0, targetZ);
        if (walkT < 0.92) {
          bot.group.rotation.y = Math.atan2(dx, dz);
          moveSpeed = 0.9;
        } else {
          bot.group.lookAt(0, 0, 0);
          moveSpeed = 0;
        }
      } else {
        bot.group.position.set(entry.seatX, 0, entry.seatZ);
        bot.group.lookAt(0, 0, 0);
        moveSpeed = 0;
      }

      updateFloatingCharacterMotion(bot.astronaut, {
        time: elapsedSec,
        delta,
        moveSpeed,
        reachTractorBeam: 0,
        gazeYaw: 0,
        gazePitch: elapsedSec >= 7.0 ? 0.12 : 0,
        blinkPhaseOffset: idx * 1.15,
        emergencyAlert: true,
        alertIndex: idx,
      });
    });
  }

  function updateDynamicElements(
    time: number,
    delta: number,
    activeRoom: RoomId,
    hoveredRoom: RoomId | null,
    isLaunching: boolean,
    hoveredInteractableId: InteractableId | null,
    inFirstPerson: boolean,
    focusedInteractableId: InteractableId | null,
    emergencyAlert = false,
    cameraWorldPos?: THREE.Vector3,
    carryingCargo = false,
    showCrewAvatars = true,
  ) {
    holoGlobe.rotation.y = time * 0.45;
    holoGlobe.position.y = 2.25 + Math.sin(time * 2.1) * 0.08;

    hangarPlanet.group.rotation.y = time * 0.38;
    hangarPlanet.group.position.y = 2.45 + Math.sin(time * 1.8) * 0.1;

    pilotHoloPlanet.group.rotation.y = time * 0.55;
    pilotHoloGroup.position.y = 1.85 + Math.sin(time * 2.0) * 0.04;
    const probeAngle = time * 1.15;
    orbitProbeGroup.position.set(
      holoOrbitFocalShift + holoOrbitSemiMajor * Math.cos(probeAngle),
      0,
      holoOrbitSemiMinor * Math.sin(probeAngle),
    );
    orbitProbeGroup.rotation.y = -probeAngle;

    scienceHolo.rotation.y = -time * 0.55;
    scienceHolo.position.y = 1.65 + Math.cos(time * 1.9) * 0.07;

    radarRigs.forEach((rig, idx) => {
      rig.azimuthGroup.rotation.y = Math.sin(time * 0.48 + idx * 1.4) * 0.9;
      rig.elevationGroup.rotation.x = -0.46 + Math.sin(time * 0.34 + idx * 0.9) * 0.16;
      const blinkWave = Math.sin(time * 5.2 + idx * 1.7);
      const useCyan = !emergencyAlert && Math.floor(time * 1.4 + idx) % 2 === 0;
      rig.beaconMat.color.setHex(useCyan ? 0x22d3ee : 0xef4444);
      rig.beaconMat.emissive.setHex(useCyan ? 0x22d3ee : 0xef4444);
      rig.beaconMat.emissiveIntensity = blinkWave > 0 ? 2.4 : 0.35;
    });
    robotArm.rotation.y = Math.sin(time * 0.65) * 0.35;
    craneTrolley.position.x = Math.sin(time * 0.25) * 5.2;

    // Floating-Limb Crew Avatars: visible in Lobby & Intro Briefing, hidden during active gameplay
    const crewVisible = showCrewAvatars && !isLaunching;
    techGroup.visible = crewVisible;
    if (crewVisible) {
      techSparks.rotation.y = time * 8.5;
      techSparks.rotation.z = time * 6.0;
      const sparkPulse = 0.65 + 0.55 * Math.abs(Math.sin(time * 16.0));
      techSparks.scale.setScalar(sparkPulse);
    }

    crewBots.forEach((bot, idx) => {
      const isMeetingEntryBot = meetingCrewEntries.some((entry) => entry.bot === bot);
      if (meetingCinematicRunning && isMeetingEntryBot) {
        return; // Animated exclusively by updateMeetingCinematic
      }

      if (!meetingCinematicRunning && isMeetingEntryBot) {
        const entry = meetingCrewEntries.find((e) => e.bot === bot)!;
        bot.group.position.set(entry.seatX, 0, entry.seatZ);
        bot.group.lookAt(0, 0, 0);
      }

      bot.group.visible = crewVisible;
      if (!crewVisible) return;

      let targetYaw = 0;
      let targetPitch = 0;
      if (cameraWorldPos && bot.group.parent && !bot.isTechnician) {
        _botLookLocal.copy(cameraWorldPos);
        bot.group.worldToLocal(_botLookLocal);
        const dist = _botLookLocal.length();
        if (dist < 18) {
          targetYaw = THREE.MathUtils.clamp(Math.atan2(_botLookLocal.x, _botLookLocal.z), -0.65, 0.65);
          targetPitch = THREE.MathUtils.clamp((_botLookLocal.y - 1.25) * 0.12, -0.25, 0.25);
        }
      } else if (bot.isTechnician) {
        // Hangar technician focuses on nozzle repair tether with subtle periodic glance
        targetYaw = Math.sin(time * 0.8) * 0.14;
        targetPitch = -0.06;
      }

      updateFloatingCharacterMotion(bot.astronaut, {
        time,
        delta,
        moveSpeed: 0,
        reachTractorBeam: bot.isTechnician ? 1 : 0,
        gazeYaw: targetYaw * 0.68,
        gazePitch: targetPitch * 0.55,
        blinkPhaseOffset: idx * 1.15,
        emergencyAlert,
        alertIndex: idx,
      });
    });

    // Hangar Assembly Pad magnetic target ring pulse when carrying cargo
    const padPulse = carryingCargo ? 1.35 + Math.sin(time * 6.5) * 0.55 : 0.75;
    hangarAssemblyPad.ringMat.emissiveIntensity = THREE.MathUtils.damp(
      hangarAssemblyPad.ringMat.emissiveIntensity,
      padPulse,
      10,
      delta,
    );
    hangarAssemblyPad.ringMat.color.setHex(carryingCargo ? 0x22c55e : 0x38bdf8);
    hangarAssemblyPad.ringMat.emissive.setHex(carryingCargo ? 0x22c55e : 0x38bdf8);

    // Impact sparks particle simulation
    impactSparks.update(delta);

    // Moody Lighting & Red Alert Emergency Near-Darkness + Sweeping Rotating Crimson Beacons
    const alertStrobe = 0.5 + 0.5 * Math.sin(time * 8.5);
    const dimFactor = emergencyAlert && inFirstPerson ? 0.08 : 1.0;

    for (let i = 0; i < alertTargets.length; i++) {
      const target = alertTargets[i];
      if (emergencyAlert) {
        target.light.color.lerp(_alertRedColor, 0.22);
        target.light.intensity = THREE.MathUtils.damp(
          target.light.intensity,
          target.baseLightIntensity * (inFirstPerson ? 0.16 : 0.55),
          10,
          delta,
        );
        for (const sp of target.spotLights) {
          sp.spot.intensity = THREE.MathUtils.damp(
            sp.spot.intensity,
            sp.baseIntensity * dimFactor,
            10,
            delta,
          );
        }
        target.beaconRig.rotation.y = time * 3.4 + i * 1.1;
        target.beaconSpot.intensity = THREE.MathUtils.damp(
          target.beaconSpot.intensity,
          64,
          12,
          delta,
        );
        target.beaconDomeMat.emissiveIntensity = 1.1 + alertStrobe * 1.6;
        target.accentMat.color.lerp(_alertRedColor, 0.25);
        target.accentMat.emissive.lerp(_alertRedColor, 0.25);
        target.accentMat.emissiveIntensity = 0.35 + alertStrobe * 1.65;
      } else {
        target.light.color.lerp(target.baseLightColor, 0.15);
        target.light.intensity = THREE.MathUtils.damp(
          target.light.intensity,
          target.baseLightIntensity,
          10,
          delta,
        );
        for (const sp of target.spotLights) {
          sp.spot.intensity = THREE.MathUtils.damp(
            sp.spot.intensity,
            sp.baseIntensity,
            10,
            delta,
          );
        }
        target.beaconSpot.intensity = THREE.MathUtils.damp(target.beaconSpot.intensity, 0, 12, delta);
        target.beaconDomeMat.emissiveIntensity = THREE.MathUtils.damp(
          target.beaconDomeMat.emissiveIntensity,
          0.15,
          10,
          delta,
        );
        target.accentMat.color.lerp(target.baseAccentColor, 0.15);
        target.accentMat.emissive.lerp(target.baseAccentColor, 0.15);
        target.accentMat.emissiveIntensity = THREE.MathUtils.damp(
          target.accentMat.emissiveIntensity,
          0.9,
          10,
          delta,
        );
      }
    }

    if (!isLaunching) {
      gantryArm.rotation.y = THREE.MathUtils.damp(gantryArm.rotation.y, 0, 5, delta);
    }

    corridorGroup.visible = !inFirstPerson || isLaunching;
    for (const [rId, roof] of Object.entries(roofGroups)) {
      if (isLaunching && rId === 'hangar') {
        roof.visible = false;
      } else {
        roof.visible = inFirstPerson;
      }
    }

    for (const [roomId, ring] of Object.entries(roomRings)) {
      const mat = ring.material as THREE.MeshBasicMaterial;
      const isSelected = activeRoom === roomId;
      const isHovered = hoveredRoom === roomId;
      const targetOpacity = isSelected ? 0.95 : isHovered ? 0.75 : 0.32;
      mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 10, delta);
    }

    let hoveredFound = false;
    for (const item of Object.values(interactableRegistry)) {
      const isHovered = hoveredInteractableId === item.id;
      const isFocused = focusedInteractableId === item.id;

      // Animate Drawer sliding open & Technical Paper rising up
      if (item.drawerSlideGroup && item.paperSheet) {
        const targetZ = isFocused ? 0.52 : 0;
        item.drawerSlideGroup.position.z = THREE.MathUtils.damp(
          item.drawerSlideGroup.position.z,
          targetZ,
          9,
          delta,
        );
        const targetPaperY = isFocused ? 0.44 : 0.06;
        const targetPaperRotX = isFocused ? -0.14 : -0.48;
        const targetPaperScale = isFocused ? 1.18 : 0.85;
        item.paperSheet.position.y = THREE.MathUtils.damp(
          item.paperSheet.position.y,
          targetPaperY,
          9,
          delta,
        );
        item.paperSheet.rotation.x = THREE.MathUtils.damp(
          item.paperSheet.rotation.x,
          targetPaperRotX,
          9,
          delta,
        );
        const s = THREE.MathUtils.damp(item.paperSheet.scale.x, targetPaperScale, 9, delta);
        item.paperSheet.scale.setScalar(s);
      }

      const mat = item.ringMesh.material as THREE.MeshBasicMaterial;
      const targetOpacity = isFocused || isHovered ? 0.95 : 0.26;
      mat.opacity = THREE.MathUtils.damp(mat.opacity, targetOpacity, 12, delta);

      const targetRingScale = isFocused || isHovered ? 1.14 : 1.0;
      const nextRingScale = THREE.MathUtils.damp(item.ringMesh.scale.x, targetRingScale, 12, delta);
      item.ringMesh.scale.setScalar(nextRingScale);

      const shouldScaleObj = isHovered && !HOVER_NO_SCALE_IDS.has(item.id);
      const targetObjScale = shouldScaleObj ? 1.03 : 1.0;
      const nextObjScale = THREE.MathUtils.damp(item.group.scale.x, targetObjScale, 12, delta);
      item.group.scale.setScalar(nextObjScale);

      // Electric light-blue (#38bdf8) aura glow on hover across all object meshes & soft halo shell
      const glowAlpha = 1 - Math.exp(-14 * delta);
      const targetGlowIntensity = isHovered ? 0.65 : isFocused ? 0.28 : 0;
      for (const entry of item.auraEntries) {
        if (isHovered || isFocused) {
          entry.mat.emissive.lerp(_auraBlueColor, glowAlpha);
          entry.mat.emissiveIntensity = THREE.MathUtils.damp(
            entry.mat.emissiveIntensity,
            Math.max(entry.baseIntensity, targetGlowIntensity),
            14,
            delta,
          );
        } else {
          entry.mat.emissive.lerp(entry.baseEmissive, glowAlpha);
          entry.mat.emissiveIntensity = THREE.MathUtils.damp(
            entry.mat.emissiveIntensity,
            entry.baseIntensity,
            12,
            delta,
          );
        }
      }

      const haloMat = item.auraHaloMesh.material as THREE.MeshBasicMaterial;
      const targetHaloOp = isHovered ? 0.26 : isFocused ? 0.1 : 0;
      haloMat.opacity = THREE.MathUtils.damp(haloMat.opacity, targetHaloOp, 14, delta);
      item.auraHaloMesh.visible = haloMat.opacity > 0.008;

      if (isHovered || isFocused) {
        hoveredFound = true;
        item.group.getWorldPosition(_anchorTemp);
        hoverSpot.color.setHex(isHovered ? 0x38bdf8 : 0xffffff);
        hoverSpot.position.set(
          _anchorTemp.x,
          _anchorTemp.y + item.anchorOffsetY + 0.6,
          _anchorTemp.z,
        );
        hoverSpot.intensity = THREE.MathUtils.damp(hoverSpot.intensity, isFocused ? 20 : 24, 12, delta);
      }
    }
    if (!hoveredFound) {
      hoverSpot.intensity = THREE.MathUtils.damp(hoverSpot.intensity, 0, 12, delta);
    }
  }

  return {
    root,
    rocket,
    clickTargets,
    interactableTargets,
    interactableRegistry,
    cargoObjects,
    cargoTargets,
    hangarAssemblyPad,
    tractorBeam,
    impactSparks,
    crewBots,
    roomRings,
    roofGroups,
    corridorGroup,
    gantryArm,
    craneTrolley,
    holoGlobe,
    scienceHolo,
    radarDish,
    robotArm,
    skyDome,
    launchCinematic,
    setTargetPlanet,
    setHologramTrajectory,
    getPilotHologramCameraPose,
    updateMeetingCinematic,
    getInteractableAnchor,
    getInteractableCameraPose,
    updateDynamicElements,
  };
}
