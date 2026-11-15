import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Magnet,
  Orbit,
  Pencil,
  ShieldAlert,
  SkipForward,
} from 'lucide-react';
import {
  canAccessRoom,
  DIFFICULTY_CONFIGS,
  EYE_HEIGHT,
  GROUND_FLOOR_Y,
  HANGAR_ASSEMBLY_PAD_POS,
  HANGAR_ASSEMBLY_PAD_RADIUS,
  ROCKET_MODULES,
  ROLE_MANUAL_GUIDES,
  ROLE_MAP,
  ROOMS,
  ROOM_MAP,
} from '../data/missionData';
import { buildSpaceBase, type SpaceBaseScene } from '../three/baseBuilder';
import {
  buildFirstPersonFloatingHands,
  buildLobbyHeroCharacter,
  type TabletAnimPhase,
} from '../three/characterBuilder';
import { createMaterialLibrary } from '../three/materials';
import type {
  CargoModuleState,
  DifficultyId,
  InteractableId,
  LaunchFailureMode,
  LaunchTelemetrySnapshot,
  OrbitalTrajectoryConfig,
  RoleId,
  RoomId,
} from '../types/mission';
import { soundFx } from '../utils/soundFx';
import { OrbitalMissionLogo } from './OrbitalMissionLogo';

export type LobbyStageMode = 'menu' | 'host' | 'join' | 'singleplayer';

interface SpaceViewport3DProps {
  inLobby: boolean;
  lobbyStageMode?: LobbyStageMode;
  briefingActive: boolean;
  activeRoom: RoomId;
  activeRole: RoleId;
  difficulty: DifficultyId;
  currentPhase: number;
  emergencyAlert: boolean;
  installedModuleIds: string[];
  cargoStates: Record<string, CargoModuleState>;
  explodedView: boolean;
  isLaunching: boolean;
  launchMode: LaunchFailureMode | null;
  focusedInteractable: InteractableId | null;
  tabletOpen?: boolean;
  hologramProjectorConfig?: OrbitalTrajectoryConfig | null;
  hologramProjectorActive?: boolean;
  meetingCinematicActive?: boolean;
  onSelectRoom: (roomId: RoomId) => void;
  onSelectInteractable: (id: InteractableId) => void;
  onExitFocus: () => void;
  onCompleteBriefing: () => void;
  onCompleteLaunchCinematic: () => void;
  onSkipLaunchCinematic: () => void;
  onCargoDamaged: (cargoId: string, nextIntegrity: number, riskAddedPct: number) => void;
  onCargoDelivered: (cargoId: string) => void;
  onCancelRedAlert: () => void;
  onValidateHologramMission?: () => void;
  onEditHologramWhiteboard?: () => void;
  onCloseHologramProjector?: () => void;
  onCompleteMeetingCinematic?: () => void;
}

interface ProjectedMarker {
  id: RoomId;
  label: string;
  accentColor: string;
  locked: boolean;
  x: number;
  y: number;
}

interface ProjectedHoverBadge {
  id: InteractableId;
  label: string;
  accentColor: string;
  x: number;
  y: number;
  visible: boolean;
}

interface CargoHudStatus {
  mode: 'carrying' | 'aiming';
  cargoId: string;
  name: string;
  accentHex: string;
  integrity: number;
  delivered: boolean;
}

// Pre-allocated math helpers (zero GC inside animation loop)
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _lookMat = new THREE.Matrix4();
const _targetQuat = new THREE.Quaternion();
const _camUp = new THREE.Vector3(0, 1, 0);
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _beamStart = new THREE.Vector3();
const _beamEnd = new THREE.Vector3();
const _cargoTarget = new THREE.Vector3();
const _cargoForce = new THREE.Vector3();
const _sparkPos = new THREE.Vector3();
const _visorTarget = new THREE.Vector3();
const _coastalBg = new THREE.Color(0x93c5fd);
const _coastalFog = new THREE.Color(0xbae6fd);
const _indoorMoodBg = new THREE.Color(0x04070f);
const _indoorMoodFog = new THREE.Color(0x060a14);
const _redAlertFog = new THREE.Color(0x160306);
const _colorGreen = new THREE.Color(0x22c55e);
const _colorAmber = new THREE.Color(0xf59e0b);
const _colorRed = new THREE.Color(0xef4444);
const ALL_ROCKET_MODULE_IDS = new Set(ROCKET_MODULES.map((m) => m.id));

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export function SpaceViewport3D({
  inLobby,
  lobbyStageMode = 'menu',
  briefingActive,
  activeRoom,
  activeRole,
  difficulty,
  currentPhase,
  emergencyAlert,
  installedModuleIds,
  cargoStates,
  explodedView,
  isLaunching,
  launchMode,
  focusedInteractable,
  tabletOpen = false,
  hologramProjectorConfig = null,
  hologramProjectorActive = false,
  meetingCinematicActive = false,
  onSelectRoom,
  onSelectInteractable,
  onExitFocus,
  onCompleteBriefing,
  onCompleteLaunchCinematic,
  onSkipLaunchCinematic,
  onCargoDamaged,
  onCargoDelivered,
  onCancelRedAlert,
  onValidateHologramMission,
  onEditHologramWhiteboard,
  onCloseHologramProjector,
  onCompleteMeetingCinematic,
}: SpaceViewport3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const spaceBaseRef = useRef<SpaceBaseScene | null>(null);
  const [webglError, setWebglError] = useState(false);
  const [markers, setMarkers] = useState<ProjectedMarker[]>([]);
  const [briefingScene, setBriefingScene] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [meetingSeq, setMeetingSeq] = useState<1 | 2 | 3>(1);
  const [launchTelemetry, setLaunchTelemetry] = useState<LaunchTelemetrySnapshot | null>(null);
  const [cargoHud, setCargoHud] = useState<CargoHudStatus | null>(null);
  const [hoverBadge, setHoverBadge] = useState<ProjectedHoverBadge>({
    id: 'sys-drawer',
    label: '',
    accentColor: '#38BDF8',
    x: 0,
    y: 0,
    visible: false,
  });

  // Mutable refs for live state inside Three.js animation loop
  const inLobbyRef = useRef(inLobby);
  const lobbyStageModeRef = useRef<LobbyStageMode>(lobbyStageMode);
  const briefingActiveRef = useRef(briefingActive);
  const prevBriefingRef = useRef(briefingActive);
  const briefingElapsedRef = useRef(0);
  const briefingCutSceneRef = useRef<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>(0);
  const hologramProjectorActiveRef = useRef(hologramProjectorActive);
  const meetingCinematicActiveRef = useRef(meetingCinematicActive);
  const prevMeetingCinematicRef = useRef(meetingCinematicActive);
  const meetingElapsedRef = useRef(0);
  const meetingSeqRef = useRef<1 | 2 | 3>(1);
  const meetingCompletedFiredRef = useRef(false);
  const activeRoomRef = useRef(activeRoom);
  const activeRoleRef = useRef(activeRole);
  const difficultyRef = useRef(difficulty);
  const currentPhaseRef = useRef(currentPhase);
  const emergencyAlertRef = useRef(emergencyAlert);
  const installedSetRef = useRef(new Set(installedModuleIds));
  const cargoStatesRef = useRef(cargoStates);
  const explodedRef = useRef(explodedView);
  const isLaunchingRef = useRef(isLaunching);
  const prevLaunchingLoopRef = useRef(false);
  const prevOpeningLiftoffRef = useRef(false);
  const launchModeRef = useRef<LaunchFailureMode | null>(launchMode);
  const launchElapsedRef = useRef(0);
  const launchCompletedFiredRef = useRef(false);
  const focusedInteractableRef = useRef<InteractableId | null>(focusedInteractable);
  const prevFocusedRef = useRef<InteractableId | null>(focusedInteractable);
  const onSelectRoomRef = useRef(onSelectRoom);
  const onSelectInteractableRef = useRef(onSelectInteractable);
  const onCompleteBriefingRef = useRef(onCompleteBriefing);
  const onCompleteLaunchCinematicRef = useRef(onCompleteLaunchCinematic);
  const onCargoDamagedRef = useRef(onCargoDamaged);
  const onCargoDeliveredRef = useRef(onCargoDelivered);
  const onCompleteMeetingCinematicRef = useRef(onCompleteMeetingCinematic);

  // Camera transition & First-Person state refs
  const overviewFlightRef = useRef(false);
  const fpTransitionRef = useRef(false);
  const fpSnapNextRef = useRef(false);
  const fpPosRef = useRef(new THREE.Vector3(0, 2.38, 8.2));
  const fpVelRef = useRef(new THREE.Vector3(0, 0, 0));
  const fpYawRef = useRef(0);
  const fpPitchRef = useRef(0);
  const fpRollRef = useRef(0);
  const prevFpYawRef = useRef(0);
  const walkPhaseRef = useRef(0);
  const lastStepSignRef = useRef(1);
  const impactShakeRef = useRef(0);
  const hoveredInteractableRef = useRef<InteractableId | null>(null);
  const hoveredCargoIdRef = useRef<string | null>(null);
  const carriedCargoIdRef = useRef<string | null>(null);
  const beamToggleGrabRef = useRef(false);
  const tabletOpenRef = useRef(Boolean(tabletOpen));
  const tabletAnimRef = useRef<{
    phase: TabletAnimPhase;
    rawProgress: number;
    pitchOffset: number;
  }>({
    phase: tabletOpen ? 'open' : 'idle',
    rawProgress: tabletOpen ? 1 : 0,
    pitchOffset: 0,
  });

  inLobbyRef.current = inLobby;
  lobbyStageModeRef.current = lobbyStageMode;
  briefingActiveRef.current = briefingActive;
  hologramProjectorActiveRef.current = hologramProjectorActive;
  meetingCinematicActiveRef.current = meetingCinematicActive;
  activeRoleRef.current = activeRole;
  difficultyRef.current = difficulty;
  currentPhaseRef.current = currentPhase;
  emergencyAlertRef.current = emergencyAlert;
  installedSetRef.current = new Set(installedModuleIds);
  cargoStatesRef.current = cargoStates;
  explodedRef.current = explodedView;
  launchModeRef.current = launchMode;
  onSelectRoomRef.current = onSelectRoom;
  onSelectInteractableRef.current = onSelectInteractable;
  onCompleteBriefingRef.current = onCompleteBriefing;
  onCompleteLaunchCinematicRef.current = onCompleteLaunchCinematic;
  onCargoDamagedRef.current = onCargoDamaged;
  onCargoDeliveredRef.current = onCargoDelivered;
  onCompleteMeetingCinematicRef.current = onCompleteMeetingCinematic;

  useEffect(() => {
    spaceBaseRef.current?.setTargetPlanet(DIFFICULTY_CONFIGS[difficulty].targetBody);
  }, [difficulty]);

  useEffect(() => {
    spaceBaseRef.current?.setHologramTrajectory(hologramProjectorConfig);
  }, [hologramProjectorConfig]);

  useEffect(() => {
    if (meetingCinematicActive && !prevMeetingCinematicRef.current) {
      meetingElapsedRef.current = 0;
      meetingSeqRef.current = 1;
      meetingCompletedFiredRef.current = false;
      setMeetingSeq(1);
    } else if (!meetingCinematicActive && prevMeetingCinematicRef.current) {
      fpTransitionRef.current = true;
    }
    prevMeetingCinematicRef.current = meetingCinematicActive;
  }, [meetingCinematicActive]);

  useEffect(() => {
    tabletOpenRef.current = Boolean(tabletOpen);
    const anim = tabletAnimRef.current;
    if (tabletOpen) {
      if (anim.phase === 'idle') {
        anim.phase = 'drawing';
        anim.rawProgress = 0;
      } else if (anim.phase === 'holstering') {
        anim.phase = 'drawing';
        anim.rawProgress = Math.max(0, 1 - anim.rawProgress);
      }
    } else {
      if (anim.phase === 'open') {
        anim.phase = 'holstering';
        anim.rawProgress = 0;
      } else if (anim.phase === 'drawing') {
        anim.phase = 'holstering';
        anim.rawProgress = Math.max(0, 1 - anim.rawProgress);
      }
    }
  }, [tabletOpen]);

  useEffect(() => {
    if (briefingActive && !prevBriefingRef.current) {
      briefingElapsedRef.current = 0;
      briefingCutSceneRef.current = 0;
      setBriefingScene(1);
      hoveredInteractableRef.current = null;
      setHoverBadge((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    } else if (!briefingActive && prevBriefingRef.current && !inLobbyRef.current) {
      // Ending or skipping briefing: hand off cleanly to First Person inside assigned room
      const roomDef = ROOM_MAP[activeRoomRef.current];
      if (roomDef.firstPerson) {
        fpPosRef.current.set(...roomDef.firstPerson.spawn);
        fpVelRef.current.set(0, 0, 0);
        fpYawRef.current = roomDef.firstPerson.initialYaw;
        prevFpYawRef.current = roomDef.firstPerson.initialYaw;
        fpPitchRef.current = roomDef.firstPerson.initialPitch;
        if (briefingCutSceneRef.current === 6) {
          fpTransitionRef.current = true;
        } else {
          fpSnapNextRef.current = true;
          fpTransitionRef.current = false;
        }
      }
    }
    prevBriefingRef.current = briefingActive;
  }, [briefingActive]);

  useEffect(() => {
    focusedInteractableRef.current = focusedInteractable;
    if (prevFocusedRef.current && !focusedInteractable && activeRoomRef.current !== 'overview') {
      // Smoothly return camera back to First-Person standing position
      fpVelRef.current.set(0, 0, 0);
      fpTransitionRef.current = true;
    }
    if (focusedInteractable) {
      hoveredInteractableRef.current = null;
      setHoverBadge((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    }
    prevFocusedRef.current = focusedInteractable;
  }, [focusedInteractable]);

  useEffect(() => {
    if (isLaunching && !isLaunchingRef.current) {
      launchElapsedRef.current = 0;
      launchCompletedFiredRef.current = false;
      hoveredInteractableRef.current = null;
      carriedCargoIdRef.current = null;
      beamToggleGrabRef.current = false;
      soundFx.stopTractorHum();
      setHoverBadge((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    } else if (!isLaunching && isLaunchingRef.current) {
      setLaunchTelemetry(null);
    }
    isLaunchingRef.current = isLaunching;
  }, [isLaunching]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
    hoveredInteractableRef.current = null;
    hoveredCargoIdRef.current = null;
    setHoverBadge((prev) => (prev.visible ? { ...prev, visible: false } : prev));

    if (activeRoom === 'overview') {
      fpTransitionRef.current = false;
      overviewFlightRef.current = true;
      if (carriedCargoIdRef.current) {
        carriedCargoIdRef.current = null;
        beamToggleGrabRef.current = false;
        soundFx.stopTractorHum();
      }
    } else {
      const roomDef = ROOM_MAP[activeRoom];
      if (roomDef.firstPerson) {
        fpPosRef.current.set(...roomDef.firstPerson.spawn);
        fpVelRef.current.set(0, 0, 0);
        fpYawRef.current = roomDef.firstPerson.initialYaw;
        prevFpYawRef.current = roomDef.firstPerson.initialYaw;
        fpPitchRef.current = roomDef.firstPerson.initialPitch;
        overviewFlightRef.current = false;
        fpTransitionRef.current = !briefingActiveRef.current;

        // Carry held cargo across room transitions cleanly right in front of the player
        const carriedId = carriedCargoIdRef.current;
        const base = spaceBaseRef.current;
        if (carriedId && base && base.cargoObjects[carriedId]) {
          const cargo = base.cargoObjects[carriedId];
          const yaw = roomDef.firstPerson.initialYaw;
          cargo.position.set(
            roomDef.firstPerson.spawn[0] - Math.sin(yaw) * 2.5,
            GROUND_FLOOR_Y + 0.9,
            roomDef.firstPerson.spawn[2] - Math.cos(yaw) * 2.5,
          );
          cargo.velocity.set(0, 0, 0);
          cargo.group.position.copy(cargo.position);
        }
      }
    }
  }, [activeRoom]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const handleContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Scene & Coastal Atmospheric Fog (Sky Dome renders gradient background)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x93c5fd);
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.0016);

    // Studio Environment Reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      inLobbyRef.current ? 48 : 28,
      width / height,
      0.25,
      650,
    );
    camera.rotation.order = 'YXZ';
    const initialRoom = ROOM_MAP['overview'];
    if (inLobbyRef.current) {
      camera.position.set(12.2, 4.7, 7.6);
      camera.lookAt(0, 4.9, 0);
    } else {
      camera.position.set(
        initialRoom.center[0] + initialRoom.cameraOffset[0],
        initialRoom.center[1] + initialRoom.cameraOffset[1],
        initialRoom.center[2] + initialRoom.cameraOffset[2],
      );
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 24;
    controls.maxDistance = 185;
    controls.maxPolarAngle = Math.PI / 2.22;
    controls.minPolarAngle = 0.25;
    controls.target.set(...initialRoom.center);
    controls.update();

    const onControlStart = () => {
      overviewFlightRef.current = false;
    };
    controls.addEventListener('start', onControlStart);

    // Coastal Sunlight + Fill Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 1.05);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff6e5, 2.15);
    keyLight.position.set(55, 78, 48);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 210;
    const d = 76;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.85);
    rimLight.position.set(-55, 32, -52);
    scene.add(rimLight);

    // Diegetic Player Visor Flashlight Beam (illuminates dark industrial corners & Red Alert darkness)
    const visorLight = new THREE.SpotLight(0xe0f2fe, 0, 26, 0.44, 0.65, 1.35);
    scene.add(visorLight);
    scene.add(visorLight.target);

    // Build Space Complex & Rocket
    const mats = createMaterialLibrary(renderer, isSoftwareGl);
    const spaceBase = buildSpaceBase(renderer, mats);
    spaceBase.setTargetPlanet(DIFFICULTY_CONFIGS[difficultyRef.current].targetBody);
    spaceBaseRef.current = spaceBase;
    scene.add(spaceBase.root);

    // First-person camera-attached Floating Spherical Hands rig
    scene.add(camera);
    const fpHands = buildFirstPersonFloatingHands(mats);
    fpHands.group.visible = false;
    camera.add(fpHands.group);

    // Build Foreground Floating-Limb Hero Character + Overhead Studio Spotlight for Single Player Staging
    const lobbyHero = buildLobbyHeroCharacter(mats);
    lobbyHero.group.position.set(0, GROUND_FLOOR_Y, 12.6);
    lobbyHero.group.scale.setScalar(1.2);
    lobbyHero.group.visible = false;
    scene.add(lobbyHero.group);

    const heroSpotLight = new THREE.SpotLight(0xfff8eb, 0, 16, 0.46, 0.72, 1.35);
    heroSpotLight.position.set(0.4, GROUND_FLOOR_Y + 5.4, 13.8);
    heroSpotLight.target.position.set(0.18, GROUND_FLOOR_Y + 0.92, 12.6);
    heroSpotLight.castShadow = !isSoftwareGl;
    heroSpotLight.shadow.mapSize.width = 1024;
    heroSpotLight.shadow.mapSize.height = 1024;
    heroSpotLight.shadow.bias = -0.0004;
    scene.add(heroSpotLight);
    scene.add(heroSpotLight.target);

    const heroRimLight = new THREE.PointLight(0x38bdf8, 0, 9, 1.4);
    heroRimLight.position.set(-1.35, GROUND_FLOOR_Y + 2.45, 10.7);
    scene.add(heroRimLight);

    const heroFillLight = new THREE.PointLight(0xe0f2fe, 0, 8, 1.5);
    heroFillLight.position.set(1.5, GROUND_FLOOR_Y + 1.3, 14.8);
    scene.add(heroFillLight);

    let prevInLobbyLoop = inLobbyRef.current;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting & First-Person Drag-to-Look + Tractor Beam Grab
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    const centerNdc = new THREE.Vector2(0, 0);
    let hoveredRoom: RoomId | null = null;
    let isDraggingLook = false;
    let isRightHoldBeam = false;
    let pointerDownPos = { x: 0, y: 0 };
    let lastPointerPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const tryPickCargoAt = (ndc: THREE.Vector2): string | null => {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(spaceBase.cargoTargets, false);
      for (const hit of hits) {
        if (hit.distance > 9.5) continue;
        const cid = hit.object.userData.cargoId as string | undefined;
        if (cid && spaceBase.cargoObjects[cid] && !spaceBase.cargoObjects[cid].delivered) {
          return cid;
        }
      }
      return null;
    };

    const startCarryCargo = (cid: string) => {
      carriedCargoIdRef.current = cid;
      soundFx.startTractorHum();
    };

    const releaseCarryCargo = () => {
      if (carriedCargoIdRef.current) {
        carriedCargoIdRef.current = null;
        beamToggleGrabRef.current = false;
        soundFx.stopTractorHum();
      }
    };

    // Keyboard state for First-Person movement (WASD / Arrows / Shift Sprint / Q / E Tractor Beam)
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      soundFx.unlock();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      keys[e.code] = true;

      if (
        e.code === 'KeyE' &&
        !e.repeat &&
        !inLobbyRef.current &&
        !briefingActiveRef.current &&
        !isLaunchingRef.current &&
        activeRoomRef.current !== 'overview' &&
        !focusedInteractableRef.current
      ) {
        if (carriedCargoIdRef.current) {
          releaseCarryCargo();
        } else {
          const cid =
            hoveredCargoIdRef.current ??
            tryPickCargoAt(pointerNdc) ??
            tryPickCargoAt(centerNdc);
          if (cid) {
            beamToggleGrabRef.current = true;
            startCarryCargo(cid);
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const updateNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickActiveRoomInteractable = (): InteractableId | null => {
      const hits = raycaster.intersectObjects(spaceBase.interactableTargets, false);
      for (const hit of hits) {
        const hitRoom = hit.object.userData.interactableRoom as RoomId | undefined;
        const hitId = hit.object.userData.interactableId as InteractableId | undefined;
        if (hitId && hitRoom === activeRoomRef.current) {
          return hitId;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      soundFx.unlock();
      if (e.target !== renderer.domElement) return;
      if (briefingActiveRef.current || isLaunchingRef.current) return;

      // Right-Click hold -> R.E.P.O. Tractor Beam grab!
      if (e.button === 2) {
        if (
          !inLobbyRef.current &&
          activeRoomRef.current !== 'overview' &&
          !focusedInteractableRef.current
        ) {
          updateNdc(e.clientX, e.clientY);
          const cid =
            tryPickCargoAt(pointerNdc) ??
            hoveredCargoIdRef.current ??
            tryPickCargoAt(centerNdc);
          if (cid) {
            isRightHoldBeam = true;
            beamToggleGrabRef.current = false;
            startCarryCargo(cid);
          } else if (carriedCargoIdRef.current) {
            releaseCarryCargo();
          }
        }
        return;
      }

      if (e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      lastPointerPos = { x: e.clientX, y: e.clientY };
      if (
        !inLobbyRef.current &&
        activeRoomRef.current !== 'overview' &&
        !focusedInteractableRef.current
      ) {
        isDraggingLook = true;
        fpTransitionRef.current = false;
        renderer.domElement.style.cursor = 'grabbing';
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2) {
        if (isRightHoldBeam) {
          isRightHoldBeam = false;
          if (!beamToggleGrabRef.current) {
            releaseCarryCargo();
          }
        }
        return;
      }

      const wasDragging = isDraggingLook;
      isDraggingLook = false;
      if (inLobbyRef.current || briefingActiveRef.current || isLaunchingRef.current) return;
      if (focusedInteractableRef.current) return;
      if (!wasDragging && e.target !== renderer.domElement) return;

      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 6) {
        renderer.domElement.style.cursor =
          activeRoomRef.current === 'overview'
            ? 'grab'
            : hoveredInteractableRef.current
              ? 'pointer'
              : 'grab';
        return;
      }

      if (e.target !== renderer.domElement) return;

      updateNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);

      if (activeRoomRef.current === 'overview') {
        const hits = raycaster.intersectObjects(spaceBase.clickTargets, false);
        if (hits.length > 0) {
          const hitRoom = hits[0].object.userData.roomId as RoomId | undefined;
          if (hitRoom) {
            onSelectRoomRef.current(hitRoom);
          }
        }
      } else {
        const hitId = pickActiveRoomInteractable();
        if (hitId) {
          onSelectInteractableRef.current(hitId);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (
        inLobbyRef.current ||
        briefingActiveRef.current ||
        isLaunchingRef.current ||
        focusedInteractableRef.current
      ) {
        hoveredRoom = null;
        hoveredInteractableRef.current = null;
        hoveredCargoIdRef.current = null;
        renderer.domElement.style.cursor = 'default';
        return;
      }

      if (isDraggingLook && activeRoomRef.current !== 'overview') {
        const moveX = e.clientX - lastPointerPos.x;
        const moveY = e.clientY - lastPointerPos.y;
        lastPointerPos = { x: e.clientX, y: e.clientY };

        fpYawRef.current -= moveX * 0.0055;
        fpPitchRef.current = THREE.MathUtils.clamp(
          fpPitchRef.current - moveY * 0.0045,
          -1.15,
          1.35,
        );
        return;
      }

      if (e.target !== renderer.domElement) {
        hoveredRoom = null;
        hoveredInteractableRef.current = null;
        hoveredCargoIdRef.current = null;
        return;
      }

      const now = performance.now();
      if (now - lastHoverCheck < 45) return;
      lastHoverCheck = now;

      updateNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointerNdc, camera);

      if (activeRoomRef.current === 'overview') {
        hoveredInteractableRef.current = null;
        hoveredCargoIdRef.current = null;
        const hits = raycaster.intersectObjects(spaceBase.clickTargets, false);
        if (hits.length > 0) {
          hoveredRoom = (hits[0].object.userData.roomId as RoomId) ?? null;
          renderer.domElement.style.cursor = 'pointer';
        } else {
          hoveredRoom = null;
          renderer.domElement.style.cursor = 'grab';
        }
      } else {
        hoveredRoom = null;
        const cargoHit = tryPickCargoAt(pointerNdc);
        hoveredCargoIdRef.current = cargoHit;
        const hitId = pickActiveRoomInteractable();
        hoveredInteractableRef.current = hitId;
        renderer.domElement.style.cursor = hitId || cargoHit ? 'pointer' : 'grab';
      }
    };

    const onPointerCancel = () => {
      isDraggingLook = false;
      if (isRightHoldBeam) {
        isRightHoldBeam = false;
        releaseCarryCargo();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointercancel', onPointerCancel);

    // Resize Observer
    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let uiSyncTimer = 0;
    let explodedVal = 0;
    let cargoImpactCooldown = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updateProjectedOverlays() {
      if (inLobbyRef.current || briefingActiveRef.current || isLaunchingRef.current) {
        setMarkers((prev) => (prev.length > 0 ? [] : prev));
        setHoverBadge((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        setCargoHud(null);
        return;
      }

      const w = container?.clientWidth || window.innerWidth;
      const h = container?.clientHeight || window.innerHeight;

      if (activeRoomRef.current === 'overview') {
        setHoverBadge((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        setCargoHud(null);

        const nextMarkers: ProjectedMarker[] = [];
        for (const room of ROOMS) {
          if (room.id === 'overview') continue;

          _projVec.set(room.center[0], room.id === 'hangar' ? 14.5 : 8.8, room.center[2]);
          _projVec.project(camera);
          if (_projVec.z > 1) continue;

          const sx = ((_projVec.x + 1) * 0.5) * w;
          const sy = ((-_projVec.y + 1) * 0.5) * h;
          if (sx < 60 || sx > w - 60 || sy < 75 || sy > h - 130) continue;

          nextMarkers.push({
            id: room.id,
            label: room.shortLabel,
            accentColor: room.accentColorHex,
            locked: !canAccessRoom(room.id, activeRoleRef.current),
            x: sx,
            y: sy,
          });
        }
        setMarkers(nextMarkers);
      } else {
        setMarkers((prev) => (prev.length > 0 ? [] : prev));

        const hoverId = hoveredInteractableRef.current;
        if (hoverId && spaceBase.getInteractableAnchor(hoverId, _projVec)) {
          const item = spaceBase.interactableRegistry[hoverId];
          _projVec.project(camera);
          if (item && _projVec.z <= 1) {
            const sx = THREE.MathUtils.clamp(((_projVec.x + 1) * 0.5) * w, 130, w - 130);
            const sy = THREE.MathUtils.clamp(((-_projVec.y + 1) * 0.5) * h, 88, h - 130);
            setHoverBadge({
              id: hoverId,
              label: item.label,
              accentColor: ROOM_MAP[item.roomId].accentColorHex,
              x: sx,
              y: sy,
              visible: true,
            });
          } else {
            setHoverBadge((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          }
        } else {
          setHoverBadge((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        }

        // Update tractor-beam / cargo HUD status
        const carriedId = carriedCargoIdRef.current;
        const aimId = hoveredCargoIdRef.current;
        const displayId = carriedId ?? aimId;
        if (displayId && spaceBase.cargoObjects[displayId]) {
          const obj = spaceBase.cargoObjects[displayId];
          const synced = cargoStatesRef.current[displayId];
          setCargoHud({
            mode: carriedId ? 'carrying' : 'aiming',
            cargoId: displayId,
            name: obj.def.name,
            accentHex: obj.def.accentHex,
            integrity: synced ? synced.integrity : obj.integrity,
            delivered: synced ? synced.delivered : obj.delivered,
          });
        } else {
          setCargoHud(null);
        }
      }
    }

    function updateFirstPersonMovement(delta: number) {
      const roomDef = ROOM_MAP[activeRoomRef.current];
      const fp = roomDef.firstPerson;
      if (!fp) return;

      // Q / R optional keyboard yaw rotation (E is freed for Tractor Beam!)
      const turnSpeed = 2.05;
      if (keys['KeyQ']) {
        fpYawRef.current += turnSpeed * delta;
        fpTransitionRef.current = false;
      }
      if (keys['KeyR']) {
        fpYawRef.current -= turnSpeed * delta;
        fpTransitionRef.current = false;
      }

      const isSprinting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
      const moveSpeed = isSprinting ? 9.1 : 5.5;

      // WASD / Arrow keys horizontal movement
      const forwardInput =
        (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
        (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
      const strafeInput =
        (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
        (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);

      const yaw = fpYawRef.current;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);

      _moveVec.set(
        fx * forwardInput + rx * strafeInput,
        0,
        fz * forwardInput + rz * strafeInput,
      );
      if (_moveVec.lengthSq() > 0) {
        _moveVec.normalize().multiplyScalar(moveSpeed);
        fpTransitionRef.current = false;
      }

      // Smooth velocity damping
      const velAlpha = 1 - Math.exp(-14 * delta);
      fpVelRef.current.lerp(_moveVec, velAlpha);

      let nextX = fpPosRef.current.x + fpVelRef.current.x * delta;
      let nextZ = fpPosRef.current.z + fpVelRef.current.z * delta;

      // Invisible Room Outer Wall Collision (circle around room center)
      const cx = roomDef.center[0];
      const cz = roomDef.center[2];
      const dxRoom = nextX - cx;
      const dzRoom = nextZ - cz;
      const distRoom = Math.hypot(dxRoom, dzRoom);
      if (distRoom > fp.walkRadius && distRoom > 0.0001) {
        const scale = fp.walkRadius / distRoom;
        nextX = cx + dxRoom * scale;
        nextZ = cz + dzRoom * scale;
      }

      const currRelFloor = fpPosRef.current.y - EYE_HEIGHT - GROUND_FLOOR_Y;
      const mezz = fp.mezzanine;
      const isElevated = mezz ? currRelFloor > mezz.elevation * 0.55 : false;

      // Ground-floor obstacle collisions
      if (!isElevated) {
        for (const obs of fp.obstacles) {
          const dxObs = nextX - obs.x;
          const dzObs = nextZ - obs.z;
          const distObs = Math.hypot(dxObs, dzObs);
          const minD = obs.radius + 0.38;
          if (distObs < minD) {
            if (distObs > 0.0001) {
              const push = minD / distObs;
              nextX = obs.x + dxObs * push;
              nextZ = obs.z + dzObs * push;
            } else {
              nextZ = obs.z + minD;
            }
          }
        }
      }

      // Two-Level Mezzanine + Ramp Height & Railing Safety Constraints
      let targetFloorY = GROUND_FLOOR_Y;
      if (mezz) {
        let lx = nextX - cx;
        let lz = nextZ - cz;
        const rampZStart = mezz.rampZStart ?? mezz.zMax;
        const openWidth = mezz.sideCatwalkWidth ?? mezz.rampWidth;

        if (isElevated) {
          lx = THREE.MathUtils.clamp(lx, -mezz.xHalfWidth + 0.35, mezz.xHalfWidth - 0.35);

          if (Math.abs(lx) < mezz.xHalfWidth - openWidth + 0.25 && lz > mezz.zMax - 0.35) {
            lz = mezz.zMax - 0.35;
          }

          if (
            mezz.sideCatwalkWidth &&
            lz >= mezz.zMax - 0.1 &&
            lz <= rampZStart + 0.1 &&
            Math.abs(lx) < mezz.xHalfWidth - mezz.sideCatwalkWidth + 0.35
          ) {
            lx =
              (lx >= 0 ? 1 : -1) *
              (mezz.xHalfWidth - mezz.sideCatwalkWidth + 0.35);
          }

          if (
            currRelFloor > 0.45 &&
            lz >= rampZStart &&
            lz <= mezz.rampZEnd &&
            Math.abs(lx) < mezz.xHalfWidth - mezz.rampWidth + 0.3
          ) {
            lx =
              (lx >= 0 ? 1 : -1) * (mezz.xHalfWidth - mezz.rampWidth + 0.3);
          }

          nextX = cx + lx;
          nextZ = cz + lz;
        }

        const inRampX =
          Math.abs(lx) >= mezz.xHalfWidth - mezz.rampWidth - 0.15 &&
          Math.abs(lx) <= mezz.xHalfWidth + 0.35;
        const inRampZ = lz >= rampZStart && lz <= mezz.rampZEnd;
        const inCatwalkX = mezz.sideCatwalkWidth
          ? Math.abs(lx) >= mezz.xHalfWidth - mezz.sideCatwalkWidth &&
            Math.abs(lx) <= mezz.xHalfWidth + 0.35
          : false;
        const inCatwalkZ = mezz.sideCatwalkWidth
          ? lz >= mezz.zMax && lz <= rampZStart
          : false;
        const onMezzDeck = lz <= mezz.zMax + 0.15 && Math.abs(lx) <= mezz.xHalfWidth + 0.25;

        if (inRampX && inRampZ) {
          const t = THREE.MathUtils.clamp(
            (mezz.rampZEnd - lz) / Math.max(0.01, mezz.rampZEnd - rampZStart),
            0,
            1,
          );
          targetFloorY = GROUND_FLOOR_Y + t * mezz.elevation;
        } else if (isElevated && (onMezzDeck || (inCatwalkX && inCatwalkZ))) {
          targetFloorY = GROUND_FLOOR_Y + mezz.elevation;
        }
      }

      const nextY = THREE.MathUtils.damp(
        fpPosRef.current.y,
        targetFloorY + EYE_HEIGHT,
        18,
        delta,
      );
      fpPosRef.current.set(nextX, nextY, nextZ);

      // R.E.P.O.-style tactile head-bob, synced footsteps, and camera tilt/roll inertia
      const horizSpeed = Math.hypot(fpVelRef.current.x, fpVelRef.current.z);
      const speedNorm = THREE.MathUtils.clamp(horizSpeed / 6.0, 0, 1.35);
      if (horizSpeed > 0.65 && !fpTransitionRef.current) {
        walkPhaseRef.current += horizSpeed * delta * (isSprinting ? 1.55 : 1.75);
        const stepWave = Math.sin(walkPhaseRef.current * 2);
        if (stepWave < -0.78 && lastStepSignRef.current >= -0.78) {
          soundFx.playFootstep(isSprinting);
        }
        lastStepSignRef.current = stepWave;
      } else {
        lastStepSignRef.current = 1;
      }

      const bobY = Math.sin(walkPhaseRef.current * 2) * (isSprinting ? 0.052 : 0.032) * speedNorm;
      const bobX = Math.cos(walkPhaseRef.current) * 0.022 * speedNorm;

      const yawDelta = fpYawRef.current - prevFpYawRef.current;
      prevFpYawRef.current = fpYawRef.current;
      const yawVel = delta > 0.001 ? yawDelta / delta : 0;
      const targetRoll =
        THREE.MathUtils.clamp(-strafeInput * 0.024 + yawVel * 0.0085, -0.055, 0.055);
      fpRollRef.current = THREE.MathUtils.damp(fpRollRef.current, targetRoll, 11, delta);
      impactShakeRef.current = THREE.MathUtils.damp(impactShakeRef.current, 0, 14, delta);
      const shakeOffset =
        impactShakeRef.current > 0.001
          ? (Math.random() - 0.5) * impactShakeRef.current
          : 0;

      // Smoothly position & orient First-Person camera
      if (fpTransitionRef.current) {
        const flyAlpha = 1 - Math.exp(-6.5 * delta);
        camera.position.lerp(fpPosRef.current, flyAlpha);
        camera.rotation.x = THREE.MathUtils.damp(camera.rotation.x, fpPitchRef.current, 7, delta);
        camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, fpYawRef.current, 7, delta);
        camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, 0, 7, delta);
        if (camera.position.distanceTo(fpPosRef.current) < 0.05) {
          fpTransitionRef.current = false;
        }
      } else {
        camera.position.set(
          fpPosRef.current.x + rx * bobX + shakeOffset,
          fpPosRef.current.y + bobY + shakeOffset * 0.7,
          fpPosRef.current.z + rz * bobX,
        );
        camera.rotation.set(
          THREE.MathUtils.clamp(
            fpPitchRef.current + shakeOffset * 0.35 + tabletAnimRef.current.pitchOffset,
            -1.25,
            1.38,
          ),
          fpYawRef.current,
          fpRollRef.current,
          'YXZ',
        );
      }
    }

    function updateCargoPhysics(elapsed: number, delta: number, inFirstPerson: boolean) {
      if (cargoImpactCooldown > 0) {
        cargoImpactCooldown = Math.max(0, cargoImpactCooldown - delta);
      }
      const isSprinting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);
      const carriedId = carriedCargoIdRef.current;
      const currentRoom = activeRoomRef.current;
      const roomDef = ROOM_MAP[currentRoom];
      const fp = roomDef?.firstPerson;

      let activeBeamStart: THREE.Vector3 | null = null;
      let activeBeamEnd: THREE.Vector3 | null = null;
      let activeIntegrity = 100;

      for (const cargo of Object.values(spaceBase.cargoObjects)) {
        const synced = cargoStatesRef.current[cargo.def.id];
        if (synced) {
          cargo.integrity = synced.integrity;
          cargo.delivered = synced.delivered;
          cargo.riskPenaltyPct = synced.riskPenaltyPct;
        }

        // Update integrity LED strip color (green -> amber -> red)
        if (cargo.integrity >= 70) {
          cargo.integrityMat.color.copy(_colorGreen);
          cargo.integrityMat.emissive.copy(_colorGreen);
        } else if (cargo.integrity >= 35) {
          cargo.integrityMat.color.copy(_colorAmber);
          cargo.integrityMat.emissive.copy(_colorAmber);
        } else {
          cargo.integrityMat.color.copy(_colorRed);
          cargo.integrityMat.emissive.copy(_colorRed);
        }

        const isCarried = carriedId === cargo.def.id && inFirstPerson && !focusedInteractableRef.current;

        // Visibility: hide in overview / lobby / launch? Actually keep cargo visible inside rooms!
        cargo.group.visible = !isLaunchingRef.current;

        if (cargo.delivered) {
          const [px, py, pz] = HANGAR_ASSEMBLY_PAD_POS;
          cargo.position.set(
            px + cargo.def.padSlotOffset[0],
            py + cargo.def.padSlotOffset[1],
            pz + cargo.def.padSlotOffset[2],
          );
          cargo.velocity.set(0, 0, 0);
          cargo.group.position.copy(cargo.position);
          cargo.visualGroup.rotation.set(0, 0, 0);
          continue;
        }

        if (isCarried) {
          camera.getWorldDirection(_camForward);
          _camRight.crossVectors(_camForward, _camUp).normalize();

          // Target levitation position 2.55m ahead of player visor with slight downward offset
          _cargoTarget.copy(camera.position).addScaledVector(_camForward, 2.55);
          _cargoTarget.y = Math.max(GROUND_FLOOR_Y + 0.45, _cargoTarget.y - 0.24 + Math.sin(elapsed * 3.1) * 0.045);

          const weight = cargo.def.weight;
          const kSpring = 46 / weight;
          _cargoForce.subVectors(_cargoTarget, cargo.position).multiplyScalar(kSpring);
          cargo.velocity.addScaledVector(_cargoForce, delta);
          const damp = Math.exp(-9.2 * delta);
          cargo.velocity.multiplyScalar(damp);

          cargo.position.addScaledVector(cargo.velocity, delta);

          // Weight sway rotation
          cargo.visualGroup.rotation.z = THREE.MathUtils.clamp(-cargo.velocity.x * 0.06, -0.28, 0.28);
          cargo.visualGroup.rotation.x = THREE.MathUtils.clamp(cargo.velocity.z * 0.06, -0.28, 0.28);
          cargo.visualGroup.rotation.y += delta * 0.45;

          // Floor & Wall/Obstacle Collision Fragility Check
          if (fp) {
            let hitWall = false;
            let impactSpeed = cargo.velocity.length() + (isSprinting ? 2.8 : 0);

            if (cargo.position.y < GROUND_FLOOR_Y + 0.05) {
              cargo.position.y = GROUND_FLOOR_Y + 0.05;
              if (cargo.velocity.y < -2.4) {
                hitWall = true;
                impactSpeed = Math.max(impactSpeed, Math.abs(cargo.velocity.y));
              }
              cargo.velocity.y = Math.max(0, cargo.velocity.y * -0.25);
            }

            const cx = roomDef.center[0];
            const cz = roomDef.center[2];
            const dxRoom = cargo.position.x - cx;
            const dzRoom = cargo.position.z - cz;
            const distRoom = Math.hypot(dxRoom, dzRoom);
            const maxR = fp.walkRadius - cargo.def.radius * 0.5;
            if (distRoom > maxR && distRoom > 0.001) {
              const s = maxR / distRoom;
              cargo.position.x = cx + dxRoom * s;
              cargo.position.z = cz + dzRoom * s;
              hitWall = true;
              cargo.velocity.x *= -0.4;
              cargo.velocity.z *= -0.4;
            }

            if (cargo.position.y < GROUND_FLOOR_Y + 2.2) {
              for (const obs of fp.obstacles) {
                const dxO = cargo.position.x - obs.x;
                const dzO = cargo.position.z - obs.z;
                const dO = Math.hypot(dxO, dzO);
                const minO = obs.radius + cargo.def.radius;
                if (dO < minO && dO > 0.001) {
                  const push = minO / dO;
                  cargo.position.x = obs.x + dxO * push;
                  cargo.position.z = obs.z + dzO * push;
                  hitWall = true;
                  cargo.velocity.x *= -0.45;
                  cargo.velocity.z *= -0.45;
                }
              }
            }

            // Sprint careless jolt check: sprinting while holding very fragile cargo can bump/jolt it!
            if (hitWall && cargoImpactCooldown <= 0 && impactSpeed > 2.35) {
              cargoImpactCooldown = 0.55;
              const severity = THREE.MathUtils.clamp((impactSpeed - 1.8) / 6.5, 0.3, 1.0);
              const dmg = Math.max(5, Math.min(26, Math.round(severity * 18 * cargo.def.fragility)));
              const prevInt = cargo.integrity;
              const nextInt = Math.max(0, prevInt - dmg);
              const targetRiskPenalty = Math.round(
                ((100 - nextInt) / 100) * cargo.def.riskPenaltyOnBreak,
              );
              const riskDelta = Math.max(0, targetRiskPenalty - cargo.riskPenaltyPct);

              cargo.integrity = nextInt;
              cargo.riskPenaltyPct += riskDelta;

              _sparkPos.copy(cargo.position);
              _sparkPos.y += 0.25;
              spaceBase.impactSparks.trigger(_sparkPos, severity);
              soundFx.playImpactThud(severity);
              impactShakeRef.current = 0.048 * severity;
              onCargoDamagedRef.current(cargo.def.id, nextInt, riskDelta);
            }
          }

          // Check Hangar Assembly Pad magnetic lock-in delivery!
          if (currentRoom === 'hangar') {
            const [px, py, pz] = HANGAR_ASSEMBLY_PAD_POS;
            const dPad = Math.hypot(cargo.position.x - px, cargo.position.z - pz);
            if (dPad <= HANGAR_ASSEMBLY_PAD_RADIUS + 0.25 && cargo.position.y <= py + 2.0) {
              cargo.delivered = true;
              cargo.position.set(
                px + cargo.def.padSlotOffset[0],
                py + cargo.def.padSlotOffset[1],
                pz + cargo.def.padSlotOffset[2],
              );
              cargo.velocity.set(0, 0, 0);
              cargo.visualGroup.rotation.set(0, 0, 0);
              carriedCargoIdRef.current = null;
              beamToggleGrabRef.current = false;
              soundFx.stopTractorHum();
              soundFx.playDeliveryChime();
              _sparkPos.copy(cargo.position);
              _sparkPos.y += 0.35;
              spaceBase.impactSparks.trigger(_sparkPos, 0.65);
              onCargoDeliveredRef.current(cargo.def.id);
              cargo.group.position.copy(cargo.position);
              continue;
            }
          }

          soundFx.updateTractorHum(cargo.velocity.length(), cargo.integrity);

          // Beam start (from reaching floating spherical right hand when visible, else camera offset)
          if (fpHands.group.visible) {
            fpHands.getRightEmitterWorldPos(_beamStart);
          } else {
            _beamStart
              .copy(camera.position)
              .addScaledVector(_camForward, 0.55)
              .addScaledVector(_camRight, 0.38);
            _beamStart.y -= 0.28;
          }
          _beamEnd.copy(cargo.position);
          _beamEnd.y += 0.32;
          activeBeamStart = _beamStart;
          activeBeamEnd = _beamEnd;
          activeIntegrity = cargo.integrity;
        } else {
          // Gravity settle onto room floor when released
          if (cargo.position.y > GROUND_FLOOR_Y + 0.005) {
            cargo.velocity.y -= 16 * delta;
            cargo.position.addScaledVector(cargo.velocity, delta);
            if (cargo.position.y <= GROUND_FLOOR_Y) {
              if (cargo.velocity.y < -4.2 && cargoImpactCooldown <= 0) {
                cargoImpactCooldown = 0.45;
                const sev = THREE.MathUtils.clamp(Math.abs(cargo.velocity.y) / 9, 0.25, 0.85);
                soundFx.playImpactThud(sev * 0.75);
              }
              cargo.position.y = GROUND_FLOOR_Y;
              cargo.velocity.set(0, 0, 0);
            }
          } else {
            cargo.velocity.multiplyScalar(Math.exp(-10 * delta));
            cargo.position.addScaledVector(cargo.velocity, delta);
            cargo.position.y = GROUND_FLOOR_Y;
          }
          cargo.visualGroup.rotation.x = THREE.MathUtils.damp(cargo.visualGroup.rotation.x, 0, 8, delta);
          cargo.visualGroup.rotation.z = THREE.MathUtils.damp(cargo.visualGroup.rotation.z, 0, 8, delta);

          // Even when released near Hangar pad, snap if sitting inside pad zone
          if (
            currentRoom === 'hangar' &&
            Math.hypot(
              cargo.position.x - HANGAR_ASSEMBLY_PAD_POS[0],
              cargo.position.z - HANGAR_ASSEMBLY_PAD_POS[2],
            ) <= HANGAR_ASSEMBLY_PAD_RADIUS
          ) {
            cargo.delivered = true;
            soundFx.playDeliveryChime();
            onCargoDeliveredRef.current(cargo.def.id);
          }
        }

        cargo.group.position.copy(cargo.position);
      }

      if (activeBeamStart && activeBeamEnd) {
        spaceBase.tractorBeam.update(true, activeBeamStart, activeBeamEnd, elapsed, activeIntegrity);
      } else {
        spaceBase.tractorBeam.update(false, _beamStart, _beamEnd, elapsed, 100);
        soundFx.stopTractorHum();
      }
    }

    function tick() {
      if (disposed) return;

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      if (isLaunchingRef.current) {
        launchElapsedRef.current += delta;
      }

      const isLaunchingNow = !inLobbyRef.current && isLaunchingRef.current;

      if (isLaunchingNow && !prevLaunchingLoopRef.current) {
        spaceBase.launchCinematic.setActive(
          true,
          difficultyRef.current,
          launchModeRef.current ?? 'phase1_pad_fire',
        );
      } else if (!isLaunchingNow && prevLaunchingLoopRef.current) {
        spaceBase.launchCinematic.setActive(false, difficultyRef.current);
        spaceBase.skyDome.visible = true;
        if (scene.background instanceof THREE.Color) {
          scene.background.setHex(0x93c5fd);
        }
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.setHex(0xbae6fd);
          scene.fog.density = 0.0016;
        }
        spaceBase.rocket.resetFlightState();
        fpSnapNextRef.current = true;
      }
      prevLaunchingLoopRef.current = isLaunchingNow;

      const isBriefing = !inLobbyRef.current && !isLaunchingNow && briefingActiveRef.current;
      let briefingSceneNow: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1;
      if (isBriefing) {
        briefingElapsedRef.current += delta;
        const bt = briefingElapsedRef.current;
        briefingSceneNow =
          bt < 4.0
            ? 1
            : bt < 8.0
              ? 2
              : bt < 12.0
                ? 3
                : bt < 16.0
                  ? 4
                  : bt < 20.0
                    ? 5
                    : bt < 24.5
                      ? 6
                      : 7;
      }
      const isOpeningLiftoff = isBriefing && briefingSceneNow === 7 && briefingElapsedRef.current < 31.5;

      if (isOpeningLiftoff && !prevOpeningLiftoffRef.current) {
        spaceBase.launchCinematic.setActive(true, difficultyRef.current);
      } else if (!isOpeningLiftoff && prevOpeningLiftoffRef.current) {
        spaceBase.launchCinematic.setActive(false, difficultyRef.current);
        spaceBase.rocket.resetFlightState();
        spaceBase.gantryArm.rotation.y = 0;
        for (const [id, group] of Object.entries(spaceBase.rocket.moduleGroups)) {
          group.userData.currentScale = installedSetRef.current.has(id) ? 1 : 0.001;
        }
        fpSnapNextRef.current = true;
      }
      prevOpeningLiftoffRef.current = isOpeningLiftoff;

      if (!isLaunchingNow && !isOpeningLiftoff) {
        const targetFov = inLobbyRef.current
          ? lobbyStageModeRef.current === 'singleplayer'
            ? 42
            : 48
          : isBriefing
            ? briefingSceneNow === 1
              ? 58
              : briefingSceneNow === 2 || briefingSceneNow === 6
                ? 48
                : 52
            : activeRoomRef.current === 'overview'
              ? 28
              : 64;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, delta);
          camera.updateProjectionMatrix();
        }
      }

      const showHeroCharacter =
        inLobbyRef.current && lobbyStageModeRef.current === 'singleplayer';
      lobbyHero.setRole(activeRoleRef.current);
      lobbyHero.update(elapsed, delta, showHeroCharacter);

      heroSpotLight.intensity = THREE.MathUtils.damp(
        heroSpotLight.intensity,
        showHeroCharacter ? 44 : 0,
        8,
        delta,
      );
      heroRimLight.intensity = THREE.MathUtils.damp(
        heroRimLight.intensity,
        showHeroCharacter ? 14 : 0,
        8,
        delta,
      );
      heroFillLight.intensity = THREE.MathUtils.damp(
        heroFillLight.intensity,
        showHeroCharacter ? 5.5 : 0,
        8,
        delta,
      );
      if (showHeroCharacter) {
        heroRimLight.color.set(ROLE_MAP[activeRoleRef.current].colorHex);
      }

      if (inLobbyRef.current && !prevInLobbyLoop) {
        // Snap camera cleanly inside the Rocket Hangar when returning to Lobby from gameplay
        camera.position.set(12.2, 4.7, 7.6);
        camera.lookAt(0, 4.9, 0);
      }
      prevInLobbyLoop = inLobbyRef.current;

      const isMeetingCine =
        !inLobbyRef.current &&
        !isLaunchingNow &&
        !isBriefing &&
        meetingCinematicActiveRef.current;

      if (inLobbyRef.current) {
        controls.enabled = false;
        if (lobbyStageModeRef.current === 'singleplayer') {
          _targetCamPos.set(
            0.18 + Math.sin(elapsed * 0.42) * 0.08,
            GROUND_FLOOR_Y + 1.48 + Math.cos(elapsed * 0.34) * 0.035,
            17.5,
          );
          _targetLookAt.set(0.22, GROUND_FLOOR_Y + 1.22, 12.6);
          const alpha = 1 - Math.exp(-5.4 * delta);
          camera.position.lerp(_targetCamPos, alpha);
          _lookMat.lookAt(camera.position, _targetLookAt, _camUp);
          _targetQuat.setFromRotationMatrix(_lookMat);
          camera.quaternion.slerp(_targetQuat, alpha);
        } else {
          const orbitAngle = elapsed * 0.085 + 0.55;
          _targetLookAt.set(0, 4.9, 0);
          _targetCamPos.set(
            Math.cos(orbitAngle) * 14.3,
            4.7 + Math.sin(elapsed * 0.18) * 0.72,
            Math.sin(orbitAngle) * 14.3,
          );
          const alpha = 1 - Math.exp(-3.8 * delta);
          camera.position.lerp(_targetCamPos, alpha);
          _lookMat.lookAt(camera.position, _targetLookAt, _camUp);
          _targetQuat.setFromRotationMatrix(_lookMat);
          camera.quaternion.slerp(_targetQuat, alpha);
        }
      } else if (isLaunchingNow) {
        controls.enabled = false;
        const telemetry = spaceBase.launchCinematic.update(
          launchElapsedRef.current,
          delta,
          launchModeRef.current ?? 'phase1_pad_fire',
          difficultyRef.current,
          camera,
          spaceBase.rocket,
          spaceBase.gantryArm,
          scene,
          spaceBase.skyDome,
        );
        if (uiSyncTimer >= 0.055) {
          setLaunchTelemetry(telemetry);
        }
        if (telemetry.finished && !launchCompletedFiredRef.current) {
          launchCompletedFiredRef.current = true;
          onCompleteLaunchCinematicRef.current();
        }
      } else if (isBriefing) {
        controls.enabled = false;
        const t = briefingElapsedRef.current;

        const applyBriefingShot = (
          sceneNum: 1 | 2 | 3 | 4 | 5 | 6 | 7,
          startT: number,
          durationT: number,
          startPos: [number, number, number],
          endPos: [number, number, number],
          startLook: [number, number, number],
          endLook: [number, number, number],
          dampRate = 3.8,
        ) => {
          const u = THREE.MathUtils.clamp((t - startT) / durationT, 0, 1);
          const e = u * u * (3 - 2 * u);
          if (briefingCutSceneRef.current !== sceneNum) {
            briefingCutSceneRef.current = sceneNum;
            setBriefingScene(sceneNum);
            camera.position.set(...startPos);
            camera.lookAt(...startLook);
          }
          _targetCamPos.set(
            THREE.MathUtils.lerp(startPos[0], endPos[0], e),
            THREE.MathUtils.lerp(startPos[1], endPos[1], e),
            THREE.MathUtils.lerp(startPos[2], endPos[2], e),
          );
          _targetLookAt.set(
            THREE.MathUtils.lerp(startLook[0], endLook[0], e),
            THREE.MathUtils.lerp(startLook[1], endLook[1], e),
            THREE.MathUtils.lerp(startLook[2], endLook[2], e),
          );
          const alpha = 1 - Math.exp(-dampRate * delta);
          camera.position.lerp(_targetCamPos, alpha);
          _lookMat.lookAt(camera.position, _targetLookAt, _camUp);
          _targetQuat.setFromRotationMatrix(_lookMat);
          camera.quaternion.slerp(_targetQuat, alpha);
        };

        if (t >= 31.5) {
          briefingActiveRef.current = false;
          if (prevOpeningLiftoffRef.current) {
            prevOpeningLiftoffRef.current = false;
            spaceBase.launchCinematic.setActive(false, difficultyRef.current);
            spaceBase.rocket.resetFlightState();
            spaceBase.gantryArm.rotation.y = 0;
            for (const [id, group] of Object.entries(spaceBase.rocket.moduleGroups)) {
              group.userData.currentScale = installedSetRef.current.has(id) ? 1 : 0.001;
            }
            fpSnapNextRef.current = true;
          }
          onCompleteBriefingRef.current();
        } else if (briefingSceneNow === 1) {
          // Scene 1 (0.0..4.0s): General Hangar + Target Planet Hologram wide sweeping shot
          applyBriefingShot(
            1,
            0.0,
            4.0,
            [13.8, 7.6, 14.2],
            [-11.8, 8.4, 13.8],
            [0, 4.4, -2.5],
            [0, 5.2, -3.5],
            3.6,
          );
        } else if (briefingSceneNow === 2) {
          // Scene 2 (4.0..8.0s): The Mechanic working near propulsion nozzles & structural bay
          applyBriefingShot(
            2,
            4.0,
            4.0,
            [5.2, 2.75, 5.2],
            [3.4, 2.45, 3.85],
            [0.95, 2.15, 0.95],
            [0.95, 2.25, 0.95],
            3.8,
          );
        } else if (briefingSceneNow === 3) {
          // Scene 3 (8.0..12.0s): The Engineer in Flight & Avionics room
          const [cx, , cz] = ROOM_MAP['pilot'].center;
          applyBriefingShot(
            3,
            8.0,
            4.0,
            [cx + 5.2, 3.1, cz + 6.4],
            [cx + 0.9, 1.95, cz + 3.0],
            [cx + 0.6, 1.45, cz - 1.0],
            [cx + 0.8, 1.4, cz - 1.2],
            3.8,
          );
        } else if (briefingSceneNow === 4) {
          // Scene 4 (12.0..16.0s): The Scientist in Science & Payload lab
          const [cx, , cz] = ROOM_MAP['science'].center;
          applyBriefingShot(
            4,
            12.0,
            4.0,
            [cx - 4.4, 3.0, cz + 6.2],
            [cx + 0.6, 1.9, cz + 2.9],
            [cx + 0.7, 1.45, cz - 1.0],
            [cx + 0.85, 1.4, cz - 1.2],
            3.8,
          );
        } else if (briefingSceneNow === 5) {
          // Scene 5 (16.0..20.0s): The Program Manager in Command & Budget office
          const [cx, , cz] = ROOM_MAP['finance'].center;
          applyBriefingShot(
            5,
            16.0,
            4.0,
            [cx + 4.8, 3.05, cz + 6.2],
            [cx + 0.7, 1.95, cz + 3.1],
            [cx + 0.6, 1.45, cz - 1.0],
            [cx + 0.8, 1.4, cz - 1.2],
            3.8,
          );
        } else if (briefingSceneNow === 6) {
          // Scene 6 (20.0..24.5s): Smooth handoff into the player's exact selected role room up close
          const roleRoom = ROOM_MAP[ROLE_MAP[activeRoleRef.current].roomId];
          const [cx, , cz] = roleRoom.center;
          applyBriefingShot(
            6,
            20.0,
            4.5,
            [cx - 1.8, 2.45, cz + 5.0],
            [cx + 0.85, 1.62, cz + 1.65],
            [cx + 0.65, 1.4, cz - 1.15],
            [cx + 0.88, 1.38, cz - 1.28],
            3.9,
          );
        } else {
          // Scene 7 (24.5..31.5s): Fully Assembled Rocket Ignition & Liftoff Preview
          if (briefingCutSceneRef.current !== 7) {
            briefingCutSceneRef.current = 7;
            setBriefingScene(7);
          }
          spaceBase.launchCinematic.updateOpeningLiftoff(
            t - 24.5,
            delta,
            difficultyRef.current,
            camera,
            spaceBase.rocket,
            spaceBase.gantryArm,
            scene,
            spaceBase.skyDome,
          );
        }
      } else if (isMeetingCine) {
        controls.enabled = false;
        meetingElapsedRef.current += delta;
        const mt = meetingElapsedRef.current;
        const seqNow: 1 | 2 | 3 = mt < 3.5 ? 1 : mt < 7.0 ? 2 : 3;
        if (meetingSeqRef.current !== seqNow) {
          meetingSeqRef.current = seqNow;
          setMeetingSeq(seqNow);
        }

        const [mx, , mz] = ROOM_MAP['meeting'].center;
        if (seqNow === 1) {
          const u = THREE.MathUtils.clamp(mt / 3.5, 0, 1);
          _targetCamPos.set(
            mx + THREE.MathUtils.lerp(-2.2, 2.4, u),
            GROUND_FLOOR_Y + 2.0,
            mz + THREE.MathUtils.lerp(4.4, 5.2, u),
          );
          _targetLookAt.set(mx, GROUND_FLOOR_Y + 1.45, mz + 9.4);
        } else if (seqNow === 2) {
          const u = THREE.MathUtils.clamp((mt - 3.5) / 3.5, 0, 1);
          _targetCamPos.set(
            mx + THREE.MathUtils.lerp(6.4, 7.6, u),
            GROUND_FLOOR_Y + 3.25,
            mz + THREE.MathUtils.lerp(7.2, 3.6, u),
          );
          _targetLookAt.set(mx, GROUND_FLOOR_Y + 1.35, mz + 1.2);
        } else {
          const u = THREE.MathUtils.clamp((mt - 7.0) / 3.5, 0, 1);
          _targetCamPos.set(
            mx + THREE.MathUtils.lerp(-4.8, 3.6, u),
            GROUND_FLOOR_Y + 2.85,
            mz + THREE.MathUtils.lerp(-3.6, -4.4, u),
          );
          _targetLookAt.set(mx, GROUND_FLOOR_Y + 1.85, mz + 1.2);
        }
        const mAlpha = 1 - Math.exp(-4.8 * delta);
        camera.position.lerp(_targetCamPos, mAlpha);
        _lookMat.lookAt(camera.position, _targetLookAt, _camUp);
        _targetQuat.setFromRotationMatrix(_lookMat);
        camera.quaternion.slerp(_targetQuat, mAlpha);

        if (mt >= 10.5 && !meetingCompletedFiredRef.current) {
          meetingCompletedFiredRef.current = true;
          onCompleteMeetingCinematicRef.current?.();
        }
      } else if (activeRoomRef.current === 'overview') {
        controls.enabled = true;
        if (overviewFlightRef.current) {
          const ov = ROOM_MAP['overview'];
          _targetLookAt.set(...ov.center);
          _targetCamPos.set(
            ov.center[0] + ov.cameraOffset[0],
            ov.center[1] + ov.cameraOffset[1],
            ov.center[2] + ov.cameraOffset[2],
          );
          const alpha = 1 - Math.exp(-5.5 * delta);
          controls.target.lerp(_targetLookAt, alpha);
          camera.position.lerp(_targetCamPos, alpha);
          if (
            camera.position.distanceTo(_targetCamPos) < 0.12 &&
            controls.target.distanceTo(_targetLookAt) < 0.12
          ) {
            overviewFlightRef.current = false;
          }
        }
        controls.update();
      } else if (hologramProjectorActiveRef.current) {
        controls.enabled = false;
        if (spaceBase.getPilotHologramCameraPose(_targetCamPos, _targetLookAt)) {
          const hAlpha = 1 - Math.exp(-7.2 * delta);
          camera.position.lerp(_targetCamPos, hAlpha);
          _lookMat.lookAt(camera.position, _targetLookAt, _camUp);
          _targetQuat.setFromRotationMatrix(_lookMat);
          camera.quaternion.slerp(_targetQuat, hAlpha);
        }
      } else if (focusedInteractableRef.current) {
        // Micro-cinematic focus mode: lock WASD/drag and smoothly lerp to object pose
        controls.enabled = false;
        if (
          spaceBase.getInteractableCameraPose(
            focusedInteractableRef.current,
            _targetCamPos,
            _targetLookAt,
          )
        ) {
          const focusAlpha = 1 - Math.exp(-7.5 * delta);
          camera.position.lerp(_targetCamPos, focusAlpha);
          _lookMat.lookAt(camera.position, _targetLookAt, _camUp);
          _targetQuat.setFromRotationMatrix(_lookMat);
          camera.quaternion.slerp(_targetQuat, focusAlpha);
        }
      } else {
        controls.enabled = false;
        if (fpSnapNextRef.current) {
          fpSnapNextRef.current = false;
          camera.position.copy(fpPosRef.current);
          camera.rotation.set(fpPitchRef.current, fpYawRef.current, 0, 'YXZ');
        }
        updateFirstPersonMovement(delta);
      }

      const targetExploded = explodedRef.current ? 1 : 0;
      explodedVal = THREE.MathUtils.damp(explodedVal, targetExploded, 7, delta);

      const launchVisualActive = isLaunchingNow || isOpeningLiftoff;

      spaceBase.rocket.updateAnimation(
        elapsed,
        delta,
        isOpeningLiftoff ? ALL_ROCKET_MODULE_IDS : installedSetRef.current,
        explodedVal,
        launchVisualActive,
        isOpeningLiftoff ? 6 : currentPhaseRef.current,
        isOpeningLiftoff,
      );

      const inFirstPerson =
        !inLobbyRef.current &&
        !launchVisualActive &&
        (isBriefing ? true : activeRoomRef.current !== 'overview');
      const inMoodyHangarView = inLobbyRef.current || inFirstPerson;

      // Moody R.E.P.O. Atmospheric Fog, Exterior Dimming & Visor Flashlight Beam
      if (!launchVisualActive) {
        const fogAlpha = 1 - Math.exp(-6.0 * delta);
        const isDarkAlert = inFirstPerson && emergencyAlertRef.current;
        if (inMoodyHangarView) {
          spaceBase.skyDome.visible = false;
          if (scene.background instanceof THREE.Color) {
            scene.background.lerp(isDarkAlert ? _redAlertFog : _indoorMoodBg, fogAlpha);
          }
          if (scene.fog instanceof THREE.FogExp2) {
            scene.fog.color.lerp(isDarkAlert ? _redAlertFog : _indoorMoodFog, fogAlpha);
            const targetFogDensity = isDarkAlert
              ? 0.044
              : inLobbyRef.current
                ? lobbyStageModeRef.current === 'singleplayer'
                  ? 0.031
                  : 0.027
                : 0.024;
            scene.fog.density = THREE.MathUtils.damp(
              scene.fog.density,
              targetFogDensity,
              6,
              delta,
            );
          }
          hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, isDarkAlert ? 0.05 : 0.24, 6, delta);
          keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, isDarkAlert ? 0.05 : 0.3, 6, delta);
          rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, isDarkAlert ? 0.06 : 0.26, 6, delta);
        } else {
          spaceBase.skyDome.visible = true;
          if (scene.background instanceof THREE.Color) {
            scene.background.lerp(_coastalBg, fogAlpha);
          }
          if (scene.fog instanceof THREE.FogExp2) {
            scene.fog.color.lerp(_coastalFog, fogAlpha);
            scene.fog.density = THREE.MathUtils.damp(scene.fog.density, 0.0016, 6, delta);
          }
          hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, 1.05, 6, delta);
          keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, 2.15, 6, delta);
          rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, 0.85, 6, delta);
        }

        // Player diegetic visor beam (tracks look direction with subtle weight lag)
        const visorTargetIntensity =
          inFirstPerson && !isBriefing && !focusedInteractableRef.current
            ? emergencyAlertRef.current
              ? 44
              : 14
            : 0;
        visorLight.intensity = THREE.MathUtils.damp(visorLight.intensity, visorTargetIntensity, 10, delta);
        if (visorLight.intensity > 0.1) {
          camera.getWorldDirection(_camForward);
          _camRight.crossVectors(_camForward, _camUp).normalize();
          visorLight.position.copy(camera.position).addScaledVector(_camRight, 0.16);
          visorLight.position.y -= 0.14;
          _visorTarget.copy(camera.position).addScaledVector(_camForward, 10);
          visorLight.target.position.lerp(_visorTarget, 1 - Math.exp(-16 * delta));
          visorLight.color.setHex(emergencyAlertRef.current ? 0xffe4e6 : 0xe0f2fe);
        }
      } else {
        visorLight.intensity = 0;
        if (isOpeningLiftoff) {
          hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, 1.05, 6, delta);
          keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, 2.15, 6, delta);
          rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, 0.85, 6, delta);
        }
      }

      const showFpHands =
        inFirstPerson &&
        !isBriefing &&
        !isMeetingCine &&
        !hologramProjectorActiveRef.current &&
        activeRoomRef.current !== 'overview' &&
        !focusedInteractableRef.current &&
        !fpTransitionRef.current;

      // Advance 0.45s pocket-draw / 0.35s holster animation & subtle camera head-nod pitch dip
      const tAnim = tabletAnimRef.current;
      if (tAnim.phase === 'drawing') {
        tAnim.rawProgress = Math.min(1, tAnim.rawProgress + delta / 0.45);
        if (tAnim.rawProgress >= 1) {
          tAnim.phase = 'open';
          tAnim.rawProgress = 1;
        }
      } else if (tAnim.phase === 'holstering') {
        tAnim.rawProgress = Math.min(1, tAnim.rawProgress + delta / 0.35);
        if (tAnim.rawProgress >= 1) {
          tAnim.phase = 'idle';
          tAnim.rawProgress = 0;
        }
      }

      let targetNodPitch = 0;
      if (showFpHands) {
        if (tAnim.phase === 'drawing') {
          const dipImpulse = Math.sin(Math.min(1, tAnim.rawProgress / 0.85) * Math.PI) * -0.048;
          const settlePitch = -0.040 * Math.min(1, tAnim.rawProgress / 0.72);
          targetNodPitch = dipImpulse + settlePitch;
        } else if (tAnim.phase === 'open') {
          targetNodPitch = -0.040;
        } else if (tAnim.phase === 'holstering') {
          targetNodPitch = -0.040 * (1 - tAnim.rawProgress);
        }
      }
      tAnim.pitchOffset = THREE.MathUtils.damp(tAnim.pitchOffset, targetNodPitch, 14, delta);

      const fpSpeedNorm = THREE.MathUtils.clamp(
        Math.hypot(fpVelRef.current.x, fpVelRef.current.z) / 5.5,
        0,
        1.3,
      );
      fpHands.update(
        elapsed,
        delta,
        fpSpeedNorm,
        Boolean(carriedCargoIdRef.current),
        activeRoleRef.current,
        showFpHands,
        tAnim,
      );
      if (showFpHands) {
        camera.updateMatrixWorld();
      }

      updateCargoPhysics(elapsed, delta, inFirstPerson);

      spaceBase.updateMeetingCinematic(meetingElapsedRef.current, delta, isMeetingCine);

      const showCrewAvatars =
        inLobbyRef.current || (isBriefing && !isOpeningLiftoff) || isMeetingCine;
      spaceBase.updateDynamicElements(
        elapsed,
        delta,
        inLobbyRef.current ? 'hangar' : activeRoomRef.current,
        hoveredRoom,
        launchVisualActive,
        hoveredInteractableRef.current,
        inMoodyHangarView,
        focusedInteractableRef.current,
        emergencyAlertRef.current,
        camera.position,
        Boolean(carriedCargoIdRef.current),
        showCrewAvatars,
      );

      renderer.render(scene, camera);

      uiSyncTimer += delta;
      if (uiSyncTimer >= 0.06) {
        uiSyncTimer = 0;
        updateProjectedOverlays();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      spaceBaseRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      soundFx.stopTractorHum();
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
      envTarget.dispose();
      mats.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#060911] text-slate-300 p-8">
        <div className="max-w-md text-center border border-slate-800 bg-[#0B101B] rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-white mb-2">
            3D Graphics Engine Paused
          </h2>
          <p className="text-sm text-slate-400">
            Your browser could not initialize a WebGL2 context. Reload the page or enable hardware acceleration.
          </p>
        </div>
      </div>
    );
  }

  const diffCfg = DIFFICULTY_CONFIGS[difficulty];

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={mountRef} className="w-full h-full" />

      {/* Subtle R.E.P.O.-Style Atmospheric Screen-Edge Vignette (Zero backdrop-filter) */}
      {!inLobby && !isLaunching && activeRoom !== 'overview' && (
        <div
          className="pointer-events-none fixed inset-0 z-[5]"
          style={{
            background: emergencyAlert
              ? 'radial-gradient(circle at center, rgba(0,0,0,0) 44%, rgba(69,10,10,0.58) 100%)'
              : 'radial-gradient(circle at center, rgba(0,0,0,0) 52%, rgba(2,4,10,0.62) 100%)',
          }}
        />
      )}

      {/* Emergency Meeting Red Alert Strobe Frame + Banner */}
      {!inLobby && !briefingActive && !isLaunching && emergencyAlert && (
        <>
          <div className="pointer-events-none fixed inset-0 z-10 border-[4px] border-rose-500/80 red-alert-strobe" />
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-auto max-w-[calc(100vw-2rem)]">
            <div className="red-alert-strobe px-3.5 py-1.5 rounded-lg bg-[#2A090E] border border-rose-500 text-rose-100 text-xs font-mono-tabular font-bold tracking-wider uppercase shadow-xl flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>RED ALERT · EMERGENCY BRIEFING IN PROGRESS</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFx.playKeyClick();
                  onCancelRedAlert();
                }}
                className="px-2.5 py-1 rounded bg-white hover:bg-rose-100 text-rose-950 font-display text-[11px] font-bold tracking-normal normal-case shadow cursor-pointer whitespace-nowrap transition-colors"
              >
                🔕 Cancel / Deactivate Red Alert
              </button>
            </div>
          </div>
        </>
      )}

      {/* Diegetic Tractor Beam & Fragile Cargo Integrity Bar */}
      {!inLobby && !briefingActive && !isLaunching && activeRoom !== 'overview' && !focusedInteractable && cargoHud && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 -translate-x-1/2 z-20">
          <div
            className={`px-3.5 py-2 rounded-xl border shadow-2xl min-w-[265px] space-y-1.5 ${
              cargoHud.mode === 'carrying'
                ? 'bg-[#07131D]/95 border-cyan-400/80'
                : 'bg-[#0B101B]/95 border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Magnet
                  className={`w-4 h-4 shrink-0 ${
                    cargoHud.mode === 'carrying' ? 'text-cyan-400' : 'text-slate-300'
                  }`}
                />
                <span className="text-xs font-display font-bold text-white">
                  {cargoHud.name}
                </span>
              </div>
              <span
                className={`font-mono-tabular text-[11px] font-bold ${
                  cargoHud.integrity >= 70
                    ? 'text-emerald-400'
                    : cargoHud.integrity >= 35
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }`}
              >
                {cargoHud.integrity}% INTACT
              </span>
            </div>

            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  cargoHud.integrity >= 70
                    ? 'bg-emerald-400'
                    : cargoHud.integrity >= 35
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                }`}
                style={{ width: `${cargoHud.integrity}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10.5px] font-mono-tabular text-slate-400">
              <span>
                {cargoHud.mode === 'carrying'
                  ? activeRoom === 'hangar'
                    ? 'Guide onto glowing Hangar Assembly Pad'
                    : 'Keep beam active & switch to Rocket Hangar'
                  : 'Hold Right-Click or press E to Tractor Beam'}
              </span>
              {cargoHud.integrity < 50 && (
                <span className="text-rose-400 flex items-center gap-1 ml-2">
                  <ShieldAlert className="w-3 h-3" />
                  FRAGILE
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Projected 3D Room Markers in Aerial Overview */}
      {!inLobby && !briefingActive && !isLaunching && activeRoom === 'overview' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          {markers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectRoom(m.id)}
              style={{
                transform: `translate(${m.x}px, ${m.y}px) translate(-50%, -100%)`,
              }}
              className="pointer-events-auto absolute top-0 left-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0B101B]/95 border border-slate-700/80 hover:border-slate-400 text-xs font-medium text-slate-100 shadow-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <span
                className="w-2 h-2 rounded-xs shrink-0"
                style={{ backgroundColor: m.accentColor }}
              />
              <span>{m.label}</span>
              {m.locked && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}

      {/* Floating Hover Tooltip over Active 3D Object in First Person */}
      {!inLobby && !briefingActive && !isLaunching && activeRoom !== 'overview' && !focusedInteractable && hoverBadge.visible && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          <div
            style={{
              transform: `translate(${hoverBadge.x}px, ${hoverBadge.y}px) translate(-50%, -100%)`,
            }}
            className="absolute top-0 left-0 flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#0B111E]/95 border border-sky-400 text-xs font-semibold text-white shadow-xl whitespace-nowrap"
          >
            <span className="w-2 h-2 rounded-xs shrink-0 bg-sky-400" />
            <span>{hoverBadge.label}</span>
          </div>
        </div>
      )}

      {/* Top-Left Micro-Cinematic Exit Button */}
      {!inLobby && !briefingActive && !isLaunching && !hologramProjectorActive && !meetingCinematicActive && activeRoom !== 'overview' && focusedInteractable && (
        <button
          type="button"
          onClick={onExitFocus}
          className="fixed top-16 left-4 z-50 px-3.5 py-2 rounded-lg bg-[#0B111E] border border-sky-400 hover:border-sky-300 hover:bg-[#111C31] text-xs font-semibold text-white shadow-xl flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <span>🔙 Stand Up / Return (ESC)</span>
        </button>
      )}

      {/* 3D Holographic Trajectory Projector Live HUD */}
      {!inLobby && !briefingActive && !isLaunching && hologramProjectorActive && hologramProjectorConfig && (
        (() => {
          const bodyRadius =
            hologramProjectorConfig.targetBody === 'earth'
              ? 6371
              : hologramProjectorConfig.targetBody === 'moon'
                ? 1737
                : 3390;
          const rp = bodyRadius + hologramProjectorConfig.perigeeKm;
          const ra = bodyRadius + hologramProjectorConfig.apogeeKm;
          const eccentricity = Math.max(0, (ra - rp) / Math.max(1, ra + rp));
          return (
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(94vw,860px)] rounded-2xl bg-[#070E1C]/95 border border-cyan-500/60 p-4 shadow-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center">
                    <Orbit className="w-4 h-4 text-cyan-300" />
                  </div>
                  <div>
                    <div className="text-[10.5px] font-mono-tabular uppercase tracking-widest text-cyan-400 font-bold">
                      3D HOLOGRAPHIC TRAJECTORY PROJECTOR · {hologramProjectorConfig.targetBody.toUpperCase()}
                    </div>
                    <h3 className="font-display text-sm font-bold text-white">
                      Projected Kepler Transfer Ellipse (ECC e = {eccentricity.toFixed(3)})
                    </h3>
                  </div>
                </div>
                <span className="text-[11px] font-mono-tabular px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                  {hologramProjectorConfig.validated ? 'VALIDATED PROFILE' : 'AWAITING ENGINEER SIGN-OFF'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                <div className="rounded-lg bg-[#0B1426] border border-slate-800 p-2">
                  <div className="text-[10px] font-mono-tabular text-slate-400">ALTITUDE</div>
                  <div className="font-mono-tabular font-bold text-white mt-0.5">
                    {hologramProjectorConfig.perigeeKm}–{hologramProjectorConfig.apogeeKm.toLocaleString()} km
                  </div>
                </div>
                <div className="rounded-lg bg-[#0B1426] border border-slate-800 p-2">
                  <div className="text-[10px] font-mono-tabular text-slate-400">INCLINATION</div>
                  <div className="font-mono-tabular font-bold text-sky-300 mt-0.5">
                    {hologramProjectorConfig.inclinationDeg.toFixed(1)}°
                  </div>
                </div>
                <div className="rounded-lg bg-[#0B1426] border border-slate-800 p-2">
                  <div className="text-[10px] font-mono-tabular text-slate-400">COVERAGE</div>
                  <div className="font-mono-tabular font-bold text-emerald-300 mt-0.5">
                    {hologramProjectorConfig.coveragePct}% Ground
                  </div>
                </div>
                <div className="rounded-lg bg-[#0B1426] border border-slate-800 p-2">
                  <div className="text-[10px] font-mono-tabular text-slate-400">COMMS LATENCY</div>
                  <div className="font-mono-tabular font-bold text-cyan-300 mt-0.5">
                    {hologramProjectorConfig.commsLatencyLabel}
                  </div>
                </div>
                <div className="rounded-lg bg-[#0B1426] border border-slate-800 p-2">
                  <div className="text-[10px] font-mono-tabular text-slate-400">FUEL REQUIRED</div>
                  <div className="font-mono-tabular font-bold text-amber-300 mt-0.5">
                    {hologramProjectorConfig.fuelRequiredKg.toLocaleString()} kg
                  </div>
                </div>
                <div className="rounded-lg bg-[#0B1426] border border-slate-800 p-2">
                  <div className="text-[10px] font-mono-tabular text-slate-400">ESTIMATED COST</div>
                  <div className="font-mono-tabular font-bold text-amber-200 mt-0.5">
                    ${hologramProjectorConfig.estimatedCostM}M
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {onCloseHologramProjector && (
                  <button
                    type="button"
                    onClick={onCloseHologramProjector}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Return to Lab
                  </button>
                )}
                {onEditHologramWhiteboard && (
                  <button
                    type="button"
                    onClick={onEditHologramWhiteboard}
                    className="px-3.5 py-2 rounded-lg bg-[#0D1A31] hover:bg-[#132443] border border-sky-500/50 text-xs font-semibold text-sky-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Whiteboard</span>
                  </button>
                )}
                {onValidateHologramMission && (
                  <button
                    type="button"
                    onClick={onValidateHologramMission}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Validate Mission</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* 3-Sequence Urgent Crew Meeting Cinema Overlay */}
      {!inLobby && !briefingActive && !isLaunching && meetingCinematicActive && (
        <>
          <div className="fixed top-0 inset-x-0 h-14 bg-black border-b border-rose-900/70 z-40 flex items-center justify-between px-6">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 red-alert-strobe" />
              <span className="font-mono-tabular text-[11px] font-bold tracking-[0.2em] uppercase text-rose-400">
                URGENT CREW MEETING · GATES ROOM · SEQUENCE {meetingSeq}/3
              </span>
            </div>
            <span className="font-mono-tabular text-[11px] text-slate-400">
              {diffCfg.targetName}
            </span>
          </div>

          <div className="fixed bottom-0 inset-x-0 min-h-24 bg-black border-t border-rose-900/70 z-40 px-6 py-4 flex items-center justify-center">
            <div className="max-w-3xl text-center space-y-1 pr-2 sm:pr-44">
              {meetingSeq === 1 && (
                <p className="text-sm sm:text-base font-medium text-white">
                  &ldquo;SEQUENCE 1 — AIRLOCK BREACH: All 4 specialists pass through the pressurized blast doors into the Gates Room.&rdquo;
                </p>
              )}
              {meetingSeq === 2 && (
                <p className="text-sm sm:text-base font-medium text-white">
                  &ldquo;SEQUENCE 2 — TAKING STATIONS: Crew deploys around the central conference table under Red Alert emergency lighting.&rdquo;
                </p>
              )}
              {meetingSeq === 3 && (
                <p className="text-sm sm:text-base font-medium text-white">
                  &ldquo;SEQUENCE 3 — HOLOGRAPHIC BRIEFING: Specialists lock gaze on the target planet hologram to vote on Gates and risk tolerances.&rdquo;
                </p>
              )}
            </div>

            {onCompleteMeetingCinematic && (
              <button
                type="button"
                onClick={onCompleteMeetingCinematic}
                className="fixed bottom-5 right-5 z-50 px-3.5 py-2 rounded-lg bg-[#111827] border border-rose-500/60 hover:border-rose-400 text-xs font-semibold text-white flex items-center gap-1.5 shadow-xl cursor-pointer whitespace-nowrap"
              >
                <SkipForward className="w-3.5 h-3.5 text-rose-400" />
                <span>Skip to Gates Console</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Mission Briefing Cinema Letterbox Bars + High-Contrast English Subtitles + Skip Intro */}
      {!inLobby && !isLaunching && briefingActive && (
        <>
          <div className="fixed top-0 inset-x-0 h-14 sm:h-16 bg-black border-b border-slate-900 z-40 flex items-center justify-center gap-2.5 px-6">
            <OrbitalMissionLogo className="w-6 h-6 shrink-0" />
            <span className="font-mono-tabular text-[11px] tracking-[0.22em] uppercase text-sky-400">
              ORBITAL MISSION · {briefingScene === 7 ? 'FULL VEHICLE LIFTOFF PREVIEW' : `BRIEFING (${diffCfg.label}) · SCENE ${briefingScene}/6`}
            </span>
          </div>

          <div className="fixed bottom-0 inset-x-0 min-h-24 sm:min-h-28 bg-black border-t border-slate-900 z-40 px-6 py-4 flex items-center justify-center">
            <div className="max-w-4xl text-center space-y-1.5 pr-2 sm:pr-32">
              {briefingScene === 1 && (
                <>
                  <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-sky-400 font-bold">
                    General Hangar · {diffCfg.targetName}
                  </div>
                  <p className="text-sm sm:text-base font-medium text-white leading-snug">
                    &ldquo;MISSION OBJECTIVE: Reach the space destination and bring the entire crew back safely. To achieve this, four specialists are indispensable...&rdquo;
                  </p>
                </>
              )}

              {briefingScene === 2 && (
                <>
                  <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-orange-400 font-bold">
                    The Mechanic · Propulsion, Structure & Assembly
                  </div>
                  <p className="text-sm sm:text-base font-medium text-white leading-snug">
                    &ldquo;MECHANIC: Assembles the airframe, engines, and heat shield. Without their structural precision, the rocket could not withstand liftoff forces or atmospheric reentry.&rdquo;
                  </p>
                </>
              )}

              {briefingScene === 3 && (
                <>
                  <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-blue-400 font-bold">
                    The Engineer · Avionics, Trajectory & Flight Systems
                  </div>
                  <p className="text-sm sm:text-base font-medium text-white leading-snug">
                    &ldquo;ENGINEER: Calibrates power systems, avionics, and orbital trajectory. Without their navigation control, the spacecraft would lose course and deep-space communications.&rdquo;
                  </p>
                </>
              )}

              {briefingScene === 4 && (
                <>
                  <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-emerald-400 font-bold">
                    The Scientist · Payload, Sensors & Research
                  </div>
                  <p className="text-sm sm:text-base font-medium text-white leading-snug">
                    &ldquo;SCIENTIST: Designs exploration instruments and life-support systems. Without their work, the mission would lack scientific purpose and critical data to keep the crew alive.&rdquo;
                  </p>
                </>
              )}

              {briefingScene === 5 && (
                <>
                  <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-yellow-400 font-bold">
                    The Program Manager · Budget, Resources & Approvals
                  </div>
                  <p className="text-sm sm:text-base font-medium text-white leading-snug">
                    &ldquo;PROGRAM MANAGER: Manages the budget, approves critical components, and coordinates the team. Without sound planning, the project would stall before reaching the launch pad.&rdquo;
                  </p>
                </>
              )}

              {briefingScene === 6 && (
                <>
                  <div
                    className="text-xs font-display font-bold tracking-wide uppercase"
                    style={{ color: ROLE_MAP[activeRole].colorHex }}
                  >
                    Your Assigned Station · {ROLE_MAP[activeRole].name}
                  </div>
                  <p className="text-sm sm:text-base font-medium text-white leading-snug">
                    YOUR ASSIGNED STATION: {ROLE_MAP[activeRole].name.toUpperCase()} — {ROLE_MANUAL_GUIDES[activeRole].briefingSubtitle}. Your console and workstation are ready to begin Phase 1.
                  </p>
                </>
              )}

              {briefingScene === 7 && (
                <>
                  <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-orange-400 font-bold">
                    Launch Pad 39A · Full Vehicle Liftoff Preview
                  </div>
                  <p className="text-sm sm:text-base font-medium text-white leading-snug">
                    FULL STACK IGNITION: This is the completely assembled Orbital Mission launch vehicle lifting off for {diffCfg.targetName}. Complete all 6 engineering phases to clear this rocket for flight—Phase 1 begins now!
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onCompleteBriefing}
              className="fixed bottom-5 right-5 z-50 px-3.5 py-2 rounded-lg bg-[#111827] border border-slate-700 hover:border-sky-400 text-xs font-semibold text-slate-200 hover:text-white shadow-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              ⏭️ Skip Intro
            </button>
          </div>
        </>
      )}

      {/* Multi-Camera 3D Rocket Launch Cinematic Overlay */}
      {!inLobby && isLaunching && (
        <>
          {/* Phase 4 / Phase 9 Telemetry Blackout Screen Dim */}
          {launchTelemetry?.blackout && (
            <div className="pointer-events-none fixed inset-0 z-30 bg-black/75 flex items-center justify-center">
              <div className="px-5 py-2.5 rounded-lg border border-rose-500/70 bg-[#180709] text-rose-200 font-mono-tabular text-xs font-bold tracking-widest uppercase">
                LOS · LOSS OF TELEMETRY CARRIER · BUS BLACKOUT
              </div>
            </div>
          )}

          {/* Top Cinema Letterbox Bar */}
          <div className="fixed top-0 inset-x-0 h-14 bg-black border-b border-slate-900 z-40 flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-mono-tabular text-[11px] font-bold tracking-[0.18em] uppercase text-orange-400 whitespace-nowrap">
                FLIGHT SIMULATION · PHASE {currentPhase}/6
              </span>
              <span className="text-slate-600 hidden sm:inline">·</span>
              <span className="font-mono-tabular text-[11px] tracking-wider uppercase text-slate-300 truncate hidden sm:inline">
                {diffCfg.targetName}
              </span>
            </div>

            <div className="px-2.5 py-1 rounded bg-[#0E1729] border border-sky-500/50 text-[11px] font-mono-tabular font-semibold text-sky-300 whitespace-nowrap">
              {launchTelemetry?.cameraLabel ?? 'CAM A · PAD LOW-ANGLE TRACKING'}
            </div>
          </div>

          {/* Live Mission Telemetry Strip (Altitude, Velocity, Stage, Mission Clock T+) */}
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-[min(94vw,820px)] pointer-events-none space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-3 py-2 rounded-xl bg-[#070B14]/95 border border-slate-800 shadow-2xl">
              <div>
                <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                  Mission Clock
                </div>
                <div className="font-mono-tabular text-sm font-bold text-white">
                  {launchTelemetry?.blackout ? 'T+ --:--' : (launchTelemetry?.missionClock ?? 'T-00:02')}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                  Altitude
                </div>
                <div className="font-mono-tabular text-sm font-bold text-sky-300 truncate">
                  {launchTelemetry?.blackout ? '--- NO CARRIER' : (launchTelemetry?.altitudeLabel ?? '0 m')}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                  Velocity
                </div>
                <div className="font-mono-tabular text-sm font-bold text-emerald-300 truncate">
                  {launchTelemetry?.velocityLabel ?? '0 m/s'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                  Stage / Mode
                </div>
                <div className="font-mono-tabular text-xs font-bold text-amber-300 truncate mt-0.5">
                  {launchTelemetry?.stageLabel ?? 'IGNITION SEQUENCE'}
                </div>
              </div>
            </div>

            {launchTelemetry?.alertText && (
              <div className="mx-auto w-fit max-w-full px-4 py-1.5 rounded-lg bg-[#2D090F] border border-rose-500 text-rose-100 font-mono-tabular text-xs font-bold tracking-wide uppercase shadow-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate">{launchTelemetry.alertText}</span>
              </div>
            )}
          </div>

          {/* Bottom Cinema Letterbox Bar + Skip / Return to Base Button */}
          <div className="fixed bottom-0 inset-x-0 h-20 bg-black border-t border-slate-900 z-40 px-6 flex items-center justify-between gap-4">
            <div className="text-xs sm:text-sm font-mono-tabular text-slate-300 truncate pr-44">
              {launchTelemetry?.stageLabel ?? 'LAUNCH SEQUENCE INITIATED'} ·{' '}
              <span className="text-slate-500">
                {(launchTelemetry?.elapsedSec ?? 0).toFixed(1)}s /{' '}
                {(launchTelemetry?.durationSec ?? 10).toFixed(1)}s
              </span>
            </div>

            <button
              type="button"
              onClick={onSkipLaunchCinematic}
              className="fixed bottom-5 right-5 z-50 px-3.5 py-2 rounded-lg bg-[#111827] border border-slate-700 hover:border-sky-400 text-xs font-semibold text-slate-100 hover:text-white shadow-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              ⏭️ Skip / Return to Base
            </button>
          </div>
        </>
      )}
    </div>
  );
}
