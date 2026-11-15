import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Activity,
  CheckCircle2,
  Compass,
  Flame,
  Globe2,
  Moon,
  Sparkles,
  X,
} from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../../data/missionData';
import type { DifficultyId, OrbitalTrajectoryConfig, TargetBodyId } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface OrbitalWhiteboardModalProps {
  difficulty: DifficultyId;
  initialConfig: OrbitalTrajectoryConfig | null;
  onProject3DHologram: (config: OrbitalTrajectoryConfig) => void;
  onClose: () => void;
}

interface BodyPhysicsSpec {
  id: TargetBodyId;
  tabLabel: string;
  bodyName: string;
  radiusKm: number;
  muKm3S2: number;
  minPeriKm: number;
  maxPeriKm: number;
  minApoKm: number;
  maxApoKm: number;
  defaultPeriKm: number;
  defaultApoKm: number;
  defaultIncDeg: number;
  latencyBaseLabel: string;
  bodyFill: string;
  bodyStroke: string;
  accentHex: string;
}

const BODY_SPECS: Record<TargetBodyId, BodyPhysicsSpec> = {
  earth: {
    id: 'earth',
    tabLabel: '1. LEO',
    bodyName: 'Earth (LEO)',
    radiusKm: 6371,
    muKm3S2: 398600,
    minPeriKm: 220,
    maxPeriKm: 1200,
    minApoKm: 320,
    maxApoKm: 2400,
    defaultPeriKm: 412,
    defaultApoKm: 580,
    defaultIncDeg: 51.6,
    latencyBaseLabel: '18 ms',
    bodyFill: '#0284c7',
    bodyStroke: '#38bdf8',
    accentHex: '#22c55e',
  },
  moon: {
    id: 'moon',
    tabLabel: '2. Moon',
    bodyName: 'Lunar Orbit',
    radiusKm: 1737,
    muKm3S2: 4905,
    minPeriKm: 80,
    maxPeriKm: 900,
    minApoKm: 150,
    maxApoKm: 2200,
    defaultPeriKm: 140,
    defaultApoKm: 680,
    defaultIncDeg: 88.0,
    latencyBaseLabel: '1.28 s',
    bodyFill: '#94a3b8',
    bodyStroke: '#e2e8f0',
    accentHex: '#38bdf8',
  },
  mars: {
    id: 'mars',
    tabLabel: '3. Mars',
    bodyName: 'Mars Transfer Orbit',
    radiusKm: 3390,
    muKm3S2: 42828,
    minPeriKm: 180,
    maxPeriKm: 1400,
    minApoKm: 300,
    maxApoKm: 3200,
    defaultPeriKm: 280,
    defaultApoKm: 1450,
    defaultIncDeg: 74.2,
    latencyBaseLabel: '7.4 min',
    bodyFill: '#c2410c',
    bodyStroke: '#fb923c',
    accentHex: '#f97316',
  },
};

export function computeOrbitalMetrics(
  targetBody: TargetBodyId,
  perigeeAltKm: number,
  apogeeAltKm: number,
  inclinationDeg: number,
  difficulty: DifficultyId,
  validated: boolean,
): OrbitalTrajectoryConfig {
  const spec = BODY_SPECS[targetBody];
  const pKm = Math.min(perigeeAltKm, apogeeAltKm);
  const aKmAlt = Math.max(perigeeAltKm, apogeeAltKm);

  const rp = spec.radiusKm + pKm;
  const ra = spec.radiusKm + aKmAlt;
  const aSemi = (rp + ra) / 2;

  // Vis-Viva equation: v = sqrt(mu * (2/r - 1/a))
  const vp = Math.sqrt(spec.muKm3S2 * (2 / rp - 1 / aSemi));
  const va = Math.sqrt(spec.muKm3S2 * (2 / ra - 1 / aSemi));

  // Circular reference speed at rp + plane-change penalty
  const vCirc = Math.sqrt(spec.muKm3S2 / rp);
  const transferMarginDv = Math.abs(vp - vCirc) + (targetBody === 'earth' ? 3.25 : targetBody === 'moon' ? 4.45 : 5.38);
  const planeChangePenalty = Math.abs(inclinationDeg - 28.5) * 0.011;
  const deltaVKms = Number((transferMarginDv + planeChangePenalty).toFixed(2));

  // Tsiolkovsky Rocket Equation: m_fuel = m_dry * (exp(dv / (Isp * g0)) - 1)
  const diffCfg = DIFFICULTY_CONFIGS[difficulty];
  const mDryKg = Math.round(diffCfg.maxMassKg * 0.34);
  const ispG0 = 4.42; // km/s effective (LH2/LOX ~450s Isp)
  const propellantKg = Math.round(mDryKg * (Math.exp(deltaVKms / ispG0) - 1) * 0.58);

  // Kepler's Third Law: T = 2*pi * sqrt(a^3 / mu) in hours
  const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(aSemi, 3) / spec.muKm3S2);
  const periodHours = Number((periodSec / 3600).toFixed(2));

  // Coverage (%) scales with apogee visibility & inclination sweep
  const incFactor = Math.min(1, inclinationDeg / 85);
  const altFactor = Math.min(1, aKmAlt / (spec.maxApoKm * 0.72));
  const coveragePct = Math.round(52 + incFactor * 28 + altFactor * 18);

  // Cost scaling tied to propellant & mission budget
  const baseMissionCost = Math.round(diffCfg.maxBudgetM * 0.56);
  const estimatedCostM = Number(
    Math.min(diffCfg.maxBudgetM, baseMissionCost + propellantKg * 0.0042 + (aKmAlt - pKm) * 0.003).toFixed(1),
  );

  return {
    targetBody,
    perigeeKm: Math.round(pKm),
    apogeeKm: Math.round(aKmAlt),
    inclinationDeg: Number(inclinationDeg.toFixed(1)),
    perigeeVelKms: Number(vp.toFixed(2)),
    apogeeVelKms: Number(va.toFixed(2)),
    periodHours,
    deltaVKms,
    fuelRequiredKg: propellantKg,
    coveragePct: Math.min(99, coveragePct),
    commsLatencyLabel: spec.latencyBaseLabel,
    estimatedCostM,
    validated,
  };
}

export function OrbitalWhiteboardModal({
  difficulty,
  initialConfig,
  onProject3DHologram,
  onClose,
}: OrbitalWhiteboardModalProps) {
  const defaultBody = initialConfig?.targetBody ?? DIFFICULTY_CONFIGS[difficulty].targetBody;
  const [selectedBody, setSelectedBody] = useState<TargetBodyId>(defaultBody);
  const spec = BODY_SPECS[selectedBody];

  const [perigeeKm, setPerigeeKm] = useState<number>(
    initialConfig?.targetBody === defaultBody ? initialConfig.perigeeKm : spec.defaultPeriKm,
  );
  const [apogeeKm, setApogeeKm] = useState<number>(
    initialConfig?.targetBody === defaultBody ? initialConfig.apogeeKm : spec.defaultApoKm,
  );
  const [inclinationDeg, setInclinationDeg] = useState<number>(
    initialConfig?.targetBody === defaultBody ? initialConfig.inclinationDeg : spec.defaultIncDeg,
  );
  const [draggingHandle, setDraggingHandle] = useState<'perigee' | 'apogee' | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleSelectBodyTab = (bodyId: TargetBodyId) => {
    soundFx.playKeyClick();
    setSelectedBody(bodyId);
    const nextSpec = BODY_SPECS[bodyId];
    setPerigeeKm(nextSpec.defaultPeriKm);
    setApogeeKm(nextSpec.defaultApoKm);
    setInclinationDeg(nextSpec.defaultIncDeg);
  };

  const metrics = useMemo(
    () =>
      computeOrbitalMetrics(
        selectedBody,
        perigeeKm,
        apogeeKm,
        inclinationDeg,
        difficulty,
        Boolean(initialConfig?.validated),
      ),
    [apogeeKm, difficulty, inclinationDeg, initialConfig?.validated, perigeeKm, selectedBody],
  );

  // SVG Geometry Mapping (ViewBox 560 x 320, Planet center at 245, 160)
  const cx = 245;
  const cy = 160;
  const planetScreenR = 36;
  const periNorm = (perigeeKm - spec.minPeriKm) / Math.max(1, spec.maxPeriKm - spec.minPeriKm);
  const apoNorm = (apogeeKm - spec.minApoKm) / Math.max(1, spec.maxApoKm - spec.minApoKm);

  const periScreenDist = planetScreenR + 28 + periNorm * 72; // 64..136 left of center
  const apoScreenDist = planetScreenR + 58 + apoNorm * 170; // 94..264 right of center

  const semiMajorPx = (periScreenDist + apoScreenDist) / 2;
  const ellipseCenterX = cx + (apoScreenDist - periScreenDist) / 2;
  const focalOffsetPx = Math.abs(ellipseCenterX - cx);
  const semiMinorPx = Math.max(46, Math.sqrt(Math.max(1, semiMajorPx * semiMajorPx - focalOffsetPx * focalOffsetPx)));

  const perigeeHandleX = cx - periScreenDist;
  const apogeeHandleX = cx + apoScreenDist;

  const updateDragFromClient = (clientX: number, handle: 'perigee' | 'apogee') => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const viewX = ((clientX - rect.left) / Math.max(1, rect.width)) * 560;

    if (handle === 'perigee') {
      const dist = Math.max(planetScreenR + 28, Math.min(planetScreenR + 100, cx - viewX));
      const norm = (dist - (planetScreenR + 28)) / 72;
      const nextPeri = Math.round(spec.minPeriKm + norm * (spec.maxPeriKm - spec.minPeriKm));
      setPerigeeKm(Math.min(nextPeri, apogeeKm - 20));
    } else {
      const dist = Math.max(planetScreenR + 58, Math.min(planetScreenR + 228, viewX - cx));
      const norm = (dist - (planetScreenR + 58)) / 170;
      const nextApo = Math.round(spec.minApoKm + norm * (spec.maxApoKm - spec.minApoKm));
      setApogeeKm(Math.max(nextApo, perigeeKm + 20));
    }
  };

  const handleSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingHandle) return;
    updateDragFromClient(e.clientX, draggingHandle);
  };

  const handleStopDrag = () => {
    if (draggingHandle) {
      setDraggingHandle(null);
      soundFx.playKeyClick();
    }
  };

  const handleProjectClick = () => {
    soundFx.playHoloProject();
    onProject3DHologram({
      ...metrics,
      validated: initialConfig?.validated ?? false,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#F8FAFC] text-slate-900 border-[8px] border-slate-500 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Whiteboard Header */}
        <header className="px-5 py-3.5 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow">
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-mono-tabular font-bold uppercase tracking-widest text-blue-700">
                SYSTEMS &amp; FLIGHT LAB · INTERACTIVE ORBITAL WHITEBOARD
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950 truncate">
                Transfer Ellipse &amp; Astrodynamics Calculator
              </h2>
            </div>
          </div>

          {/* Target Body Tabs (1. LEO / 2. Moon / 3. Mars) */}
          <div className="flex items-center gap-1.5 bg-slate-200 p-1 rounded-xl border border-slate-300">
            {(['earth', 'moon', 'mars'] as TargetBodyId[]).map((bodyId) => {
              const s = BODY_SPECS[bodyId];
              const active = selectedBody === bodyId;
              const isCampaignTarget = DIFFICULTY_CONFIGS[difficulty].targetBody === bodyId;
              const Icon = bodyId === 'earth' ? Globe2 : bodyId === 'moon' ? Moon : Flame;
              return (
                <button
                  key={bodyId}
                  type="button"
                  onClick={() => handleSelectBodyTab(bodyId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow'
                      : 'text-slate-700 hover:bg-white/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: active ? s.accentHex : undefined }} />
                  <span>{s.tabLabel}</span>
                  {isCampaignTarget && (
                    <span className="px-1 py-0.2 rounded bg-sky-500/20 text-[9px] font-mono-tabular text-sky-300">
                      TARGET
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Orbital Whiteboard"
            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Main Whiteboard Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 bg-[#F1F5F9]">
          {/* LEFT 7 COLS: Interactive Orbital Ellipse Canvas + Sliders */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="rounded-xl border-2 border-slate-300 bg-white p-3 shadow-inner space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono-tabular font-bold text-slate-700 uppercase tracking-wider">
                  Drag Apogee (rₐ) &amp; Perigee (rₚ) Handles on Ellipse
                </span>
                <span className="font-mono-tabular text-[11px] text-blue-700 font-semibold">
                  {spec.bodyName} · R = {spec.radiusKm.toLocaleString()} km
                </span>
              </div>

              <svg
                ref={svgRef}
                viewBox="0 0 560 320"
                onPointerMove={handleSvgPointerMove}
                onPointerUp={handleStopDrag}
                onPointerLeave={handleStopDrag}
                className="w-full h-auto rounded-lg border border-slate-200 bg-[#070D19] select-none touch-none"
              >
                {/* Blueprint Grid */}
                <defs>
                  <pattern id="wbGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path
                      d="M 28 0 L 0 0 0 28"
                      fill="none"
                      stroke="rgba(56, 189, 248, 0.12)"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="560" height="320" fill="url(#wbGrid)" />

                {/* Apsides Line */}
                <line
                  x1={perigeeHandleX}
                  y1={cy}
                  x2={apogeeHandleX}
                  y2={cy}
                  stroke="rgba(148, 163, 184, 0.35)"
                  strokeDasharray="5 5"
                  strokeWidth="1.5"
                />

                {/* Elliptical Transfer Orbit */}
                <ellipse
                  cx={ellipseCenterX}
                  cy={cy}
                  rx={semiMajorPx}
                  ry={semiMinorPx}
                  fill="rgba(56, 189, 248, 0.06)"
                  stroke="#38BDF8"
                  strokeWidth="2.5"
                  strokeDasharray="7 4"
                />

                {/* Central Planet Body */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={planetScreenR + 6}
                  fill="none"
                  stroke={spec.bodyStroke}
                  strokeOpacity="0.28"
                  strokeWidth="3"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={planetScreenR}
                  fill={spec.bodyFill}
                  stroke={spec.bodyStroke}
                  strokeWidth="2"
                />
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  className="fill-white text-[11px] font-bold font-mono"
                >
                  {selectedBody.toUpperCase()}
                </text>

                {/* Radius callouts */}
                <text
                  x={(cx + perigeeHandleX) / 2}
                  y={cy - 10}
                  textAnchor="middle"
                  className="fill-emerald-300 text-[10px] font-mono"
                >
                  rₚ = {(spec.radiusKm + perigeeKm).toLocaleString()} km
                </text>
                <text
                  x={(cx + apogeeHandleX) / 2}
                  y={cy - 10}
                  textAnchor="middle"
                  className="fill-amber-300 text-[10px] font-mono"
                >
                  rₐ = {(spec.radiusKm + apogeeKm).toLocaleString()} km
                </text>

                {/* Draggable Perigee Handle */}
                <g
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                    setDraggingHandle('perigee');
                  }}
                  className="cursor-ew-resize"
                >
                  <circle cx={perigeeHandleX} cy={cy} r={18} fill="rgba(34, 197, 94, 0.18)" />
                  <circle
                    cx={perigeeHandleX}
                    cy={cy}
                    r={9}
                    fill="#22C55E"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />
                  <text
                    x={perigeeHandleX}
                    y={cy + 28}
                    textAnchor="middle"
                    className="fill-emerald-300 text-[11px] font-bold font-mono"
                  >
                    PERIGEE {perigeeKm} km
                  </text>
                </g>

                {/* Draggable Apogee Handle */}
                <g
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                    setDraggingHandle('apogee');
                  }}
                  className="cursor-ew-resize"
                >
                  <circle cx={apogeeHandleX} cy={cy} r={18} fill="rgba(249, 115, 22, 0.18)" />
                  <circle
                    cx={apogeeHandleX}
                    cy={cy}
                    r={9}
                    fill="#F97316"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />
                  <text
                    x={apogeeHandleX}
                    y={cy + 28}
                    textAnchor="middle"
                    className="fill-amber-300 text-[11px] font-bold font-mono"
                  >
                    APOGEE {apogeeKm} km
                  </text>
                </g>
              </svg>

              {/* Fine Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <label className="block space-y-1 text-xs">
                  <div className="flex justify-between font-mono-tabular font-semibold text-slate-700">
                    <span>Perigee (rₚ)</span>
                    <span className="text-emerald-700">{perigeeKm} km</span>
                  </div>
                  <input
                    type="range"
                    min={spec.minPeriKm}
                    max={Math.min(spec.maxPeriKm, apogeeKm - 20)}
                    value={perigeeKm}
                    onChange={(e) => setPerigeeKm(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </label>

                <label className="block space-y-1 text-xs">
                  <div className="flex justify-between font-mono-tabular font-semibold text-slate-700">
                    <span>Apogee (rₐ)</span>
                    <span className="text-orange-600">{apogeeKm} km</span>
                  </div>
                  <input
                    type="range"
                    min={Math.max(spec.minApoKm, perigeeKm + 20)}
                    max={spec.maxApoKm}
                    value={apogeeKm}
                    onChange={(e) => setApogeeKm(Number(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                </label>

                <label className="block space-y-1 text-xs">
                  <div className="flex justify-between font-mono-tabular font-semibold text-slate-700">
                    <span>Inclination (i)</span>
                    <span className="text-blue-700">{inclinationDeg.toFixed(1)}°</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={98}
                    step={0.5}
                    value={inclinationDeg}
                    onChange={(e) => setInclinationDeg(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLS: Live Equations + Telemetry Readout + Project 3D Hologram CTA */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3">
            <div className="space-y-3">
              {/* Live Physics Equations */}
              <div className="rounded-xl border border-slate-300 bg-white p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-blue-800">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>Live Astrodynamics Equations</span>
                </div>

                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 space-y-0.5">
                  <div className="text-[10px] font-mono-tabular uppercase text-blue-700 font-bold">
                    Vis-Viva Velocity (v = √[μ(2/r − 1/a)])
                  </div>
                  <div className="font-mono-tabular text-xs font-bold text-slate-900">
                    vₚ = {metrics.perigeeVelKms} km/s · vₐ = {metrics.apogeeVelKms} km/s
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 space-y-0.5">
                  <div className="text-[10px] font-mono-tabular uppercase text-amber-800 font-bold">
                    Tsiolkovsky Propellant (m_fuel = m₀(1 − e^(−Δv / Iₛₚg₀)))
                  </div>
                  <div className="font-mono-tabular text-xs font-bold text-slate-900">
                    Δv = {metrics.deltaVKms} km/s → m_fuel = {metrics.fuelRequiredKg.toLocaleString()} kg
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 space-y-0.5">
                  <div className="text-[10px] font-mono-tabular uppercase text-emerald-800 font-bold">
                    Kepler Orbital Period (T = 2π√[a³ / μ])
                  </div>
                  <div className="font-mono-tabular text-xs font-bold text-slate-900">
                    T = {metrics.periodHours} hrs ({Math.round(metrics.periodHours * 60)} min)
                  </div>
                </div>
              </div>

              {/* Mission Telemetry Preview */}
              <div className="rounded-xl border border-slate-300 bg-white p-3.5 space-y-2 shadow-sm">
                <div className="text-xs font-display font-bold uppercase tracking-wider text-slate-700">
                  Projected Hologram Telemetry
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-500">Altitude</div>
                    <div className="font-mono-tabular font-bold text-slate-900">
                      {metrics.perigeeKm} × {metrics.apogeeKm} km
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-500">Inclination</div>
                    <div className="font-mono-tabular font-bold text-blue-700">
                      {metrics.inclinationDeg}°
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-500">Coverage</div>
                    <div className="font-mono-tabular font-bold text-emerald-700">
                      {metrics.coveragePct}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-500">Comms Latency</div>
                    <div className="font-mono-tabular font-bold text-slate-900">
                      {metrics.commsLatencyLabel}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-500">Fuel Required</div>
                    <div className="font-mono-tabular font-bold text-orange-600">
                      {metrics.fuelRequiredKg.toLocaleString()} kg
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-500">Estimated Cost</div>
                    <div className="font-mono-tabular font-bold text-slate-900">
                      ${metrics.estimatedCostM}M
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Project 3D Hologram CTA */}
            <div className="space-y-2">
              {initialConfig?.validated && (
                <div className="rounded-lg border border-emerald-400 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Current orbital trajectory validated in Mission Tablet.</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleProjectClick}
                className="w-full py-3.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Project 3D Hologram</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
