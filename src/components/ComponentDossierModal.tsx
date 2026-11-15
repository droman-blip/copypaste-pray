import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Flame,
  Gauge,
  Layers,
  Lock,
  Move3d,
  PackageCheck,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  ShieldAlert,
  Siren,
  Wrench,
  X,
} from 'lucide-react';
import { ROCKET_COMPONENT_SPECS } from '../data/componentDossierData';
import {
  CARGO_MAP,
  DIFFICULTY_CONFIGS,
  INTERACTABLES_MAP,
  MODULE_MAP,
  ROLE_MAP,
} from '../data/missionData';
import { createMaterialLibrary } from '../three/materials';
import { buildRocketPartPreview } from '../three/rocketPartPreviewBuilder';
import type {
  ActiveConflict,
  CargoModuleState,
  DifficultyId,
  InteractableId,
  MissionResources,
  RoleId,
} from '../types/mission';
import { soundFx } from '../utils/soundFx';

interface ComponentDossierModalProps {
  interactableId: InteractableId;
  activeRole: RoleId;
  difficulty: DifficultyId;
  currentPhase: number;
  installedModuleIds: string[];
  activeConflicts: ActiveConflict[];
  cargoStates: Record<string, CargoModuleState>;
  resources: MissionResources;
  explodedView: boolean;
  isLaunching: boolean;
  onToggleExploded: () => void;
  onTriggerLaunch: () => void;
  onResetLaunch: () => void;
  onCallEmergencyMeeting: () => void;
  onClose: () => void;
}

function detectStudioSoftwareWebGL(): boolean {
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

export function ComponentDossierModal({
  interactableId,
  activeRole,
  difficulty,
  currentPhase,
  installedModuleIds,
  activeConflicts,
  cargoStates,
  resources,
  explodedView,
  isLaunching,
  onToggleExploded,
  onTriggerLaunch,
  onResetLaunch,
  onCallEmergencyMeeting,
  onClose,
}: ComponentDossierModalProps) {
  const [peek3D, setPeek3D] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [studioWebglError, setStudioWebglError] = useState(false);

  const studioMountRef = useRef<HTMLDivElement | null>(null);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const resetCameraFnRef = useRef<(() => void) | null>(null);

  const content = INTERACTABLES_MAP[interactableId];
  const spec = ROCKET_COMPONENT_SPECS[interactableId] ?? ROCKET_COMPONENT_SPECS['hng-fuel-tank'];
  const ownerRole = ROLE_MAP[spec.owningRoleId];
  const diffCfg = DIFFICULTY_CONFIGS[difficulty];

  const relatedModules = spec.relatedModuleIds
    .map((id) => MODULE_MAP[id])
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  const installedCount = relatedModules.filter((m) => installedModuleIds.includes(m.id)).length;
  const anyInstalled = installedCount > 0;

  const relatedCargo = CARGO_MAP[spec.relatedCargoId];
  const cargoState = cargoStates[spec.relatedCargoId] ?? {
    id: spec.relatedCargoId,
    integrity: 100,
    delivered: false,
    riskPenaltyPct: 0,
  };

  const phaseReached = currentPhase >= spec.upgradePhaseNumber;
  const statusLabel = anyInstalled
    ? `Installed (${installedCount}/${relatedModules.length} Modules)`
    : phaseReached
      ? `Phase ${spec.upgradePhaseNumber} Active — Upgrade Ready`
      : `Awaiting Phase ${spec.upgradePhaseNumber}`;

  const matchingConflicts = activeConflicts.filter(
    (c) =>
      !c.resolved &&
      (c.sourceRole === spec.owningRoleId || c.affectedRoles.includes(spec.owningRoleId)),
  );

  // =========================================================================
  // INTERACTIVE 3D STUDIO COMPONENT VIEWPORT
  // =========================================================================
  useEffect(() => {
    if (peek3D) return;
    const container = studioMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectStudioSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setStudioWebglError(true);
      return;
    }

    setStudioWebglError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(
      Math.max(1, container.clientWidth),
      Math.max(1, container.clientHeight),
    );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050a14);
    scene.fog = new THREE.FogExp2(0x050a14, 0.042);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const mats = createMaterialLibrary(renderer, isSoftwareGl);
    const rig = buildRocketPartPreview(spec.cadVariant, ownerRole.colorHex, mats);
    scene.add(rig.root);

    // Subtle dark studio grid disc at base level (-0.34)
    const studioGrid = new THREE.GridHelper(16, 24, 0x1e3a5f, 0x0e192b);
    studioGrid.position.y = -0.345;
    scene.add(studioGrid);

    // Studio 3-Point Lighting (Warm Key + Cool Fill + Role Accent Rim)
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0b1120, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(5.5, 8.5, 6.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(ownerRole.colorHex, 1.45);
    rimLight.position.set(-6.0, 4.2, -5.5);
    scene.add(rimLight);

    const studioSpot = new THREE.SpotLight(0xe0f2fe, 22, 18, 0.55, 0.65, 1.1);
    studioSpot.position.set(0, 7.2, 2.5);
    studioSpot.target.position.set(0, rig.recommendedTargetY, 0);
    scene.add(studioSpot);
    scene.add(studioSpot.target);

    const aspect = Math.max(0.4, container.clientWidth / Math.max(1, container.clientHeight));
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 80);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 10.5;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minPolarAngle = 0.2;

    const resetCamera = () => {
      camera.position.set(
        rig.recommendedDistance * 0.72,
        rig.recommendedTargetY + rig.recommendedDistance * 0.34,
        rig.recommendedDistance * 0.85,
      );
      controls.target.set(0, rig.recommendedTargetY, 0);
      controls.update();
    };
    resetCamera();
    resetCameraFnRef.current = resetCamera;

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let disposed = false;
    let rafId = 0;
    let swTimerId: number | null = null;
    let prevTime = performance.now();
    const startTime = prevTime;

    const afterDraw = (fn: () => void) => {
      if (swTimerId !== null) window.clearTimeout(swTimerId);
      swTimerId = window.setTimeout(fn, 24);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const delta = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      const elapsed = (now - startTime) / 1000;
      prevTime = now;

      rig.animate(elapsed, delta, autoRotateRef.current);
      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      resetCameraFnRef.current = null;
      window.cancelAnimationFrame(rafId);
      if (swTimerId !== null) window.clearTimeout(swTimerId);
      resizeObserver.disconnect();
      controls.dispose();
      rig.disposeLocalResources();
      studioGrid.geometry.dispose();
      if (Array.isArray(studioGrid.material)) {
        studioGrid.material.forEach((m) => m.dispose());
      } else {
        studioGrid.material.dispose();
      }
      mats.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [peek3D, spec.cadVariant, ownerRole.colorHex]);

  if (peek3D) {
    return (
      <div className="fixed bottom-5 left-5 z-40 pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            soundFx.playKeyClick();
            setPeek3D(false);
          }}
          className="px-4 py-2.5 rounded-lg bg-[#0B1220] border border-sky-400/70 text-sky-100 text-xs font-semibold shadow-2xl flex items-center gap-2 hover:bg-[#111C31] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-sky-400" />
          <span>Return to 3D Engineering Inspection Tab</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-slate-200 text-xs font-semibold shadow-xl hover:bg-slate-800 cursor-pointer"
        >
          Close Tab
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-black/70">
      {/* Full-Screen Interactive 3D Component Inspection Browser Tab */}
      <div className="w-full h-full max-w-[1440px] bg-[#060B15] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Browser Tab Chrome Header */}
        <div className="bg-[#0B1322] border-b border-slate-800 px-3 pt-2 flex items-end justify-between gap-3 shrink-0">
          <div className="flex items-end gap-2 min-w-0">
            <div className="px-4 py-2 rounded-t-lg bg-[#060B15] border-t border-l border-r border-slate-700 flex items-center gap-2.5 min-w-0 max-w-lg">
              <Rocket className="w-3.5 h-3.5 shrink-0" style={{ color: ownerRole.colorHex }} />
              <span className="text-xs font-medium text-white truncate">
                {content.title} — 3D Engineering Inspection
              </span>
              <button
                type="button"
                onClick={() => {
                  soundFx.playKeyClick();
                  onClose();
                }}
                aria-label="Close 3D component inspection tab"
                className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <span className="hidden lg:inline-block pb-2 text-[11px] font-mono-tabular text-slate-500">
              nasa-vab://3d-studio/{spec.subsystemCode.toLowerCase()}
            </span>
          </div>

          <div className="pb-2 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                soundFx.playKeyClick();
                setPeek3D(true);
              }}
              className="px-3 py-1.5 rounded-md border border-sky-500/45 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">View on Pad 39A</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playKeyClick();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-md bg-slate-100 hover:bg-white text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Close 3D Tab &amp; Return</span>
            </button>
          </div>
        </div>

        {/* Main Split Studio Body: Left/Center 65% Interactive 3D Viewport | Right 35% Telemetry Specs */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* LEFT / CENTER ~65%: LIVE 3D STUDIO TURNTABLE VIEWPORT (Zero backdrop-filter) */}
          <div className="relative h-[44vh] lg:h-full lg:w-[65%] bg-[#050A14] border-b lg:border-b-0 lg:border-r border-slate-800 shrink-0">
            {studioWebglError ? (
              <div className="w-full h-full flex items-center justify-center p-6 text-center text-slate-400 text-xs">
                WebGL2 3D studio preview unavailable on this device. Review technical specifications on the right panel.
              </div>
            ) : (
              <div ref={studioMountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
            )}

            {/* Minimal Top-Left Corner Telemetry Stamp (pointer-events-none, zero obstruction) */}
            <div className="pointer-events-none absolute top-3.5 left-3.5 flex flex-wrap items-center gap-2">
              <span
                className="px-2.5 py-1 rounded-md font-mono-tabular text-[11px] font-bold text-slate-950 shadow"
                style={{ backgroundColor: ownerRole.colorHex }}
              >
                {ownerRole.shortName}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[#0A1324] border border-slate-700/90 font-mono-tabular text-[11px] text-sky-300 shadow">
                {spec.subsystemCode}
              </span>
              <span
                className={`px-2.5 py-1 rounded-md bg-[#0A1324] border font-mono-tabular text-[11px] font-bold shadow ${
                  anyInstalled
                    ? 'border-emerald-500/60 text-emerald-300'
                    : 'border-amber-500/60 text-amber-300'
                }`}
              >
                {anyInstalled ? 'INTEGRATED ON VEHICLE' : 'STAGED / READY'}
              </span>
            </div>

            {/* Minimal Bottom Studio Controls Strip (zero backdrop-filter) */}
            <div className="absolute bottom-3.5 left-3.5 right-3.5 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="px-3 py-1.5 rounded-lg bg-[#0A1220] border border-slate-700/90 text-[11px] font-mono-tabular text-slate-300 flex items-center gap-2 shadow-lg">
                <Move3d className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Drag to Orbit 360° · Scroll to Zoom</span>
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playKeyClick();
                    setAutoRotate((v) => !v);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0A1220] border border-slate-700 hover:border-sky-400 text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  {autoRotate ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-sky-400" />
                      <span>Pause Spin</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Resume Spin</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playKeyClick();
                    resetCameraFnRef.current?.();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0A1220] border border-slate-700 hover:border-sky-400 text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Reset Angle</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT ~35%: ENGINEERING TELEMETRY & SPECIFICATIONS PANEL */}
          <div className="flex-1 lg:w-[35%] overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#070C17]">
            {/* Title & Summary */}
            <div className="space-y-1.5 pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-400">
                <span>{spec.cadTitle}</span>
              </div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-white leading-tight">
                {content.title}
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">{content.summary}</p>
            </div>

            {/* Live Integration & Structural Integrity Bar */}
            <div className="rounded-xl border border-slate-800 bg-[#0B1220] p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular">
                <span className="text-slate-400">STATUS · {diffCfg.label.toUpperCase()}</span>
                <span className={anyInstalled ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                  {statusLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular">
                <span className="text-slate-400">STRUCTURAL INTEGRITY</span>
                <span
                  className={`font-bold ${
                    cargoState.integrity >= 80
                      ? 'text-emerald-400'
                      : cargoState.integrity >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}
                >
                  {cargoState.integrity}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full ${
                    cargoState.integrity >= 80
                      ? 'bg-emerald-500'
                      : cargoState.integrity >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${cargoState.integrity}%` }}
                />
              </div>
            </div>

            {/* 8-Metric Aerospace Telemetry Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-sky-400" />
                  <span>Technical Specifications</span>
                </h2>
                <span className="font-mono-tabular text-[10.5px] text-slate-400">
                  {spec.upgradePhaseLabel}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                {[
                  { label: 'Dry Mass', value: spec.dryMassKg, tone: 'text-white' },
                  {
                    label: 'Propellant Flow / Cap.',
                    value: spec.capacityLabel,
                    tone: 'text-sky-300',
                  },
                  {
                    label: 'Operating Temp',
                    value: spec.operatingTempLimits,
                    tone: 'text-cyan-300',
                  },
                  {
                    label: 'Chamber Pressure',
                    value: spec.operatingPressureLimits,
                    tone: 'text-slate-100',
                  },
                  {
                    label: 'Specific Impulse / Thrust',
                    value: spec.thrustOrPowerLabel,
                    tone: 'text-amber-300',
                  },
                  {
                    label: 'Science Yield',
                    value: spec.scienceYieldLabel,
                    tone: 'text-emerald-300',
                  },
                  {
                    label: 'Thermal Margin / Risk',
                    value: spec.riskContributionLabel,
                    tone: 'text-rose-300',
                  },
                  {
                    label: 'Material Alloy',
                    value: spec.materialAlloy,
                    tone: 'text-white',
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border border-slate-800 bg-[#0B1220] px-3 py-2 space-y-0.5"
                  >
                    <div className="text-[10.5px] text-slate-400">{metric.label}</div>
                    <div className={`font-mono-tabular text-[11.5px] font-semibold ${metric.tone}`}>
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked Tractor Beam Cargo */}
            {relatedCargo && (
              <div className="rounded-lg border border-slate-800 bg-[#0B1220] px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <PackageCheck
                    className={`w-4 h-4 shrink-0 ${
                      cargoState.delivered ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{relatedCargo.name}</div>
                    <div className="font-mono-tabular text-[10.5px] text-slate-400">
                      {cargoState.delivered
                        ? `Secured on Assembly Pad (${cargoState.integrity}%)`
                        : `Pending Pad Delivery (${cargoState.integrity}% Intact)`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dependent Hardware Upgrades */}
            <div className="rounded-xl border border-slate-800 bg-[#0B1220] p-3.5 space-y-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-200">
                Dependent Hardware Modules
              </h3>
              <div className="space-y-1.5">
                {relatedModules.map((mod) => {
                  const installed = installedModuleIds.includes(mod.id);
                  const modRole = ROLE_MAP[mod.roleId];
                  return (
                    <div
                      key={mod.id}
                      className={`rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 text-xs ${
                        installed
                          ? 'border-emerald-500/45 bg-emerald-950/20'
                          : 'border-slate-800 bg-[#070C17]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{mod.name}</div>
                        <div className="text-[10.5px] font-mono-tabular text-slate-400">
                          {modRole.shortName} · +{mod.massKg} kg ·{' '}
                          {mod.powerW >= 0 ? `+${mod.powerW} W` : `${mod.powerW} W`}
                          {activeRole === 'finance' ? ` · $${mod.costM}M` : ''}
                        </div>
                      </div>
                      {installed ? (
                        <span className="font-mono-tabular text-[10.5px] font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Installed
                        </span>
                      ) : (
                        <span className="font-mono-tabular text-[10.5px] text-slate-400 flex items-center gap-1 shrink-0">
                          <Lock className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subsystem Survival Notes */}
            <div className="rounded-xl border border-slate-800 bg-[#0B1220] p-3.5 space-y-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-sky-400" />
                <span>Engineering Notes &amp; Survival</span>
              </h3>
              <ul className="space-y-1.5">
                {spec.survivalNotes.map((note, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg border border-slate-800/90 bg-[#070C17] px-2.5 py-2 text-[11.5px] text-slate-300 leading-snug flex items-start gap-2"
                  >
                    <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 shrink-0 mt-0.5">
                      0{idx + 1}
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Active Cross-Department Conflicts */}
            {matchingConflicts.length > 0 && (
              <div className="rounded-xl border border-rose-500/60 bg-rose-950/30 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-display font-bold text-rose-200">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Active Conflicts Affecting {ownerRole.shortName}</span>
                </div>
                {matchingConflicts.map((conf) => (
                  <div key={conf.id} className="space-y-1.5 text-[11px] text-rose-100">
                    <div className="flex items-start gap-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{conf.title}</span>
                    </div>
                    <p className="text-rose-200/85">{conf.description}</p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playKeyClick();
                    onCallEmergencyMeeting();
                  }}
                  className="w-full py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Siren className="w-3.5 h-3.5" />
                  <span>Resolve in Briefing Room</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Engineering Action Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#0B1322] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-mono-tabular text-slate-300">
            <span>
              Mass: <strong className="text-white">{resources.massKg.toLocaleString()}</strong> /{' '}
              {resources.maxMassKg.toLocaleString()} kg
            </span>
            <span>
              Risk:{' '}
              <strong
                className={
                  resources.riskPct > resources.maxAllowedRiskPct
                    ? 'text-rose-400'
                    : 'text-amber-300'
                }
              >
                {resources.riskPct}%
              </strong>{' '}
              (Max {resources.maxAllowedRiskPct}%)
            </span>
            <span>
              Parts: <strong className="text-emerald-400">{installedModuleIds.length} / 12</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundFx.playKeyClick();
                onToggleExploded();
              }}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                explodedView
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-[#101A2E] border-slate-700 text-slate-200 hover:border-slate-500'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{explodedView ? 'Collapse Stages' : 'Exploded View'}</span>
            </button>

            {!isLaunching ? (
              <button
                type="button"
                onClick={() => {
                  soundFx.playKeyClick();
                  onTriggerLaunch();
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>INITIATE ROCKET LAUNCH</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundFx.playKeyClick();
                  onResetLaunch();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Launch Pad</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
