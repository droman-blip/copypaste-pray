import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  FlaskConical,
  RefreshCw,
  ShieldAlert,
  Snowflake,
  X,
} from 'lucide-react';
import type { DifficultyId, ThermalReportSummary } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface ThermalMaterialLabModalProps {
  difficulty: DifficultyId;
  initialSummary: ThermalReportSummary | null;
  onSubmitReport: (summary: ThermalReportSummary) => void;
  onClose: () => void;
}

interface MaterialSpec {
  id: string;
  name: string;
  meltC: number;
  baseHex: string;
  alloyNote: string;
}

const REFERENCE_MATERIALS: MaterialSpec[] = [
  {
    id: 'aluminum',
    name: 'Aerospace Aluminum',
    meltC: 660,
    baseHex: '#94A3B8',
    alloyNote: 'Lightweight fuselage frame; softens rapidly above 600 °C.',
  },
  {
    id: 'steel',
    name: 'Structural Iron / Steel',
    meltC: 1538,
    baseHex: '#64748B',
    alloyNote: 'High tensile strength but fails just short of 1,600 °C reentry peak.',
  },
  {
    id: 'titanium',
    name: 'Titanium Alloy',
    meltC: 1668,
    baseHex: '#A78BFA',
    alloyNote: 'High-strength aerospace alloy exceeding 1,600 °C sustained stress.',
  },
  {
    id: 'ceramic',
    name: 'Ceramic / Carbon Composite',
    meltC: 2700,
    baseHex: '#334155',
    alloyNote: 'Extreme thermal protection tile rated for deep-space reentry.',
  },
];

const SAMPLE_LABELS = ['Sample A', 'Sample B', 'Sample C', 'Sample D'] as const;

// Consistent mapping of unknown samples so every material is represented
const SAMPLE_ASSIGNMENT: Record<string, string> = {
  'Sample A': 'steel',
  'Sample B': 'ceramic',
  'Sample C': 'aluminum',
  'Sample D': 'titanium',
};

export function ThermalMaterialLabModal({
  difficulty,
  initialSummary,
  onSubmitReport,
  onClose,
}: ThermalMaterialLabModalProps) {
  const requirementC = difficulty === 'hard' ? 1800 : 1600;

  const [activeSample, setActiveSample] = useState<string>('Sample A');
  const [sampleTemps, setSampleTemps] = useState<Record<string, number>>({
    'Sample A': 22,
    'Sample B': 22,
    'Sample C': 22,
    'Sample D': 22,
  });
  const [meltLogs, setMeltLogs] = useState<Record<string, number>>(
    () => initialSummary?.testedMeltTemps ?? {},
  );
  const [meltedSamples, setMeltedSamples] = useState<Record<string, boolean>>({});
  const [torchFiring, setTorchFiring] = useState(false);
  const [guesses, setGuesses] = useState<Record<string, string>>({
    'Sample A': '',
    'Sample B': '',
    'Sample C': '',
    'Sample D': '',
  });
  const [selectedShield, setSelectedShield] = useState<string>(
    initialSummary?.selectedShieldMaterial || 'Ceramic / Carbon Composite',
  );
  const [submitError, setSubmitError] = useState('');

  const torchFiringRef = useRef(false);
  torchFiringRef.current = torchFiring;
  const activeSampleRef = useRef(activeSample);
  activeSampleRef.current = activeSample;

  const currentTemp = Math.round(sampleTemps[activeSample] ?? 22);
  const isMelted = Boolean(meltedSamples[activeSample]);
  const recordedMelt = meltLogs[activeSample];

  const startTorch = useCallback(() => {
    soundFx.unlock();
    if (meltedSamples[activeSampleRef.current]) return;
    setTorchFiring(true);
    soundFx.startLaserTorch();
  }, [meltedSamples]);

  const stopTorch = useCallback(() => {
    setTorchFiring(false);
    soundFx.stopLaserTorch();
  }, []);

  useEffect(() => {
    return () => {
      soundFx.stopLaserTorch();
    };
  }, []);

  // Keyboard Spacebar support for firing blowtorch
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startTorch();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        stopTorch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onClose, startTorch, stopTorch]);

  // Continuous heating / ambient cooling simulation loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const sampleKey = activeSampleRef.current;
      const matId = SAMPLE_ASSIGNMENT[sampleKey];
      const mat = REFERENCE_MATERIALS.find((m) => m.id === matId)!;

      setSampleTemps((prev) => {
        const cur = prev[sampleKey] ?? 22;
        if (torchFiringRef.current) {
          // Climb faster at lower temperatures so ceramic 2700C doesn't take forever (~4.5s)
          const rate = cur < 800 ? 480 : cur < 1700 ? 540 : 620;
          const next = Math.min(2850, cur + rate * dt);

          if (next >= mat.meltC) {
            torchFiringRef.current = false;
            setTorchFiring(false);
            soundFx.stopLaserTorch();
            soundFx.playImpactThud(0.85);
            setMeltedSamples((mPrev) => ({ ...mPrev, [sampleKey]: true }));
            setMeltLogs((lPrev) => ({ ...lPrev, [sampleKey]: mat.meltC }));
            return { ...prev, [sampleKey]: mat.meltC };
          }
          return { ...prev, [sampleKey]: next };
        }
        // Gentle ambient cooling when torch is off and not locked at failure
        if (cur > 24 && !meltedSamples[sampleKey]) {
          return { ...prev, [sampleKey]: Math.max(22, cur - 140 * dt) };
        }
        return prev;
      });

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [meltedSamples]);

  const handleCoolRestore = () => {
    stopTorch();
    soundFx.playDrawerSlide(false);
    setMeltedSamples((prev) => ({ ...prev, [activeSample]: false }));
    setSampleTemps((prev) => ({ ...prev, [activeSample]: 22 }));
  };

  const getIncandescenceStyle = (tempC: number, melted: boolean) => {
    if (melted) {
      return {
        background: 'radial-gradient(circle at 50% 45%, #fef08a 0%, #ef4444 45%, #450a0a 100%)',
        boxShadow: '0 0 36px rgba(239, 68, 68, 0.75)',
      };
    }
    if (tempC >= 1600) {
      return {
        background: 'linear-gradient(135deg, #fef9c3 0%, #f97316 55%, #b91c1c 100%)',
        boxShadow: '0 0 32px rgba(251, 146, 60, 0.75)',
      };
    }
    if (tempC >= 900) {
      return {
        background: 'linear-gradient(135deg, #fb923c 0%, #dc2626 55%, #7f1d1d 100%)',
        boxShadow: '0 0 24px rgba(220, 38, 38, 0.6)',
      };
    }
    if (tempC >= 400) {
      return {
        background: 'linear-gradient(135deg, #991b1b 0%, #475569 75%)',
        boxShadow: '0 0 14px rgba(239, 68, 68, 0.35)',
      };
    }
    return {
      background: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
    };
  };

  const testedCount = Object.keys(meltLogs).length;
  const allCorrectlyIdentified = useMemo(
    () =>
      SAMPLE_LABELS.every(
        (label) => guesses[label] === SAMPLE_ASSIGNMENT[label],
      ),
    [guesses],
  );

  const handleSubmit = () => {
    setSubmitError('');
    if (testedCount < 4) {
      setSubmitError(
        `Thermally test all 4 unknown blocks with the laser blowtorch first (${testedCount}/4 recorded).`,
      );
      return;
    }
    if (!allCorrectlyIdentified) {
      setSubmitError(
        'One or more Sample ID classifications do not match your recorded meltdown temperatures. Cross-check the Reference Datasheets.',
      );
      return;
    }
    const shieldMat = REFERENCE_MATERIALS.find((m) => m.name === selectedShield);
    if (!shieldMat || shieldMat.meltC < requirementC) {
      setSubmitError(
        `${selectedShield} melts below the mission threshold (>= ${requirementC.toLocaleString()} °C). Select a qualifying alloy.`,
      );
      return;
    }

    soundFx.playDeliveryChime();
    onSubmitReport({
      certified: true,
      requirementC,
      selectedShieldMaterial: selectedShield,
      testedCount,
      testedMeltTemps: meltLogs,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopTorch();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#080E1B] text-slate-100 border border-emerald-500/45 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="px-5 py-3.5 bg-[#060B15] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 flex items-center justify-center shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10.5px] font-mono-tabular uppercase tracking-widest text-emerald-400 font-bold">
                MATERIAL LAB · LASER BLOWTORCH THERMAL STRESS RIG
              </div>
              <h2 className="font-display text-lg font-bold text-white">
                Thermal Stress &amp; Ablation Identification Lab
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/60 text-amber-200 font-mono-tabular text-xs font-bold">
              Requirement: &ge; {requirementC.toLocaleString()} °C
            </div>
            <button
              type="button"
              onClick={() => {
                stopTorch();
                onClose();
              }}
              aria-label="Close Material Lab"
              className="p-1.5 rounded-lg border border-slate-700 bg-[#101829] hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT 7 COLS: Test Chamber, Laser Torch & Sample Blocks */}
          <div className="lg:col-span-7 space-y-3">
            {/* Sample Selector Tabs */}
            <div className="grid grid-cols-4 gap-2">
              {SAMPLE_LABELS.map((label) => {
                const active = activeSample === label;
                const meltT = meltLogs[label];
                const isSampleMelted = Boolean(meltedSamples[label]);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      stopTorch();
                      soundFx.playKeyClick();
                      setActiveSample(label);
                    }}
                    className={`rounded-xl border px-3 py-2 text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 text-white shadow'
                        : 'bg-[#0B1322] border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{label}</span>
                      {meltT !== undefined && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <div className="font-mono-tabular text-[10.5px] mt-0.5 text-slate-400">
                      {isSampleMelted
                        ? `FAILED @ ${meltT}°C`
                        : meltT !== undefined
                          ? `Logged: ${meltT}°C`
                          : 'Untested'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Interactive Laser Blowtorch Chamber */}
            <div
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                if (e.button === 2) {
                  e.preventDefault();
                  startTorch();
                }
              }}
              onPointerUp={(e) => {
                if (e.button === 2) stopTorch();
              }}
              onPointerLeave={() => {
                if (torchFiring) stopTorch();
              }}
              className="relative rounded-2xl border border-slate-700 bg-[#050811] p-5 overflow-hidden select-none"
            >
              {/* Pyrometer Top Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-slate-400">
                    Optical Pyrometer · {activeSample}
                  </div>
                  <div
                    className={`font-mono-tabular text-3xl font-bold ${
                      isMelted
                        ? 'text-rose-400'
                        : currentTemp >= requirementC
                          ? 'text-emerald-400'
                          : currentTemp >= 700
                            ? 'text-orange-400'
                            : 'text-sky-300'
                    }`}
                  >
                    {currentTemp.toLocaleString()} °C
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                    Thermal Margin Check
                  </div>
                  <div
                    className={`text-xs font-mono-tabular font-bold ${
                      recordedMelt !== undefined && recordedMelt >= requirementC
                        ? 'text-emerald-400'
                        : recordedMelt !== undefined
                          ? 'text-rose-400'
                          : 'text-slate-300'
                    }`}
                  >
                    {recordedMelt !== undefined
                      ? recordedMelt >= requirementC
                        ? `QUALIFIES (${recordedMelt}°C >= ${requirementC}°C)`
                        : `FAILS SPEC (${recordedMelt}°C < ${requirementC}°C)`
                      : 'Hold Torch to find critical failure temp'}
                  </div>
                </div>
              </div>

              {/* Heat Progress Bar */}
              <div className="relative h-2.5 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden mb-6">
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${Math.min(100, (currentTemp / 2800) * 100)}%`,
                    background:
                      'linear-gradient(90deg, #38bdf8 0%, #f59e0b 45%, #ef4444 75%, #fef08a 100%)',
                  }}
                />
                {/* Threshold Marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white"
                  style={{ left: `${(requirementC / 2800) * 100}%` }}
                  title={`Requirement: ${requirementC}°C`}
                />
              </div>

              {/* Laser Nozzle + Refractory Block Stage */}
              <div className="relative h-44 flex items-center justify-between px-4 sm:px-10 rounded-xl bg-gradient-to-b from-[#0A1120] to-[#070B14] border border-slate-800/90">
                {/* Left: Laser Blowtorch Emitter Nozzle */}
                <div className="relative flex items-center z-10">
                  <div className="w-20 h-11 rounded-l-lg bg-slate-800 border-2 border-slate-600 flex items-center justify-center shadow-lg">
                    <span className="font-mono-tabular text-[10px] font-bold text-slate-300">
                      LASER-20kW
                    </span>
                  </div>
                  <div className="w-6 h-7 bg-amber-600 border-y-2 border-r-2 border-amber-400 rounded-r-md" />
                </div>

                {/* Plasma Torch Beam */}
                {torchFiring && (
                  <div
                    className="absolute left-28 right-1/2 mr-8 h-3 rounded-full animate-pulse z-10"
                    style={{
                      background:
                        'linear-gradient(90deg, #38bdf8 0%, #fef08a 55%, #f97316 100%)',
                      boxShadow: '0 0 22px #38bdf8, 0 0 42px #f97316',
                    }}
                  />
                )}

                {/* Right: Sample Material Cube on Refractory Stand */}
                <div className="relative flex flex-col items-center z-10">
                  <div
                    className="relative w-28 h-24 rounded-lg border-2 border-white/20 flex items-center justify-center transition-all duration-150 overflow-hidden"
                    style={getIncandescenceStyle(currentTemp, isMelted)}
                  >
                    <span className="font-display font-bold text-sm text-white drop-shadow">
                      {activeSample}
                    </span>

                    {/* Structural Crack / Meltdown SVG */}
                    {isMelted && (
                      <svg
                        viewBox="0 0 100 100"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      >
                        <path
                          d="M22 10 L44 38 L32 56 L58 88 M72 15 L52 46 L76 74"
                          stroke="#111827"
                          strokeWidth="4.5"
                          fill="none"
                          strokeLinecap="round"
                        />
                        <path
                          d="M22 10 L44 38 L32 56 L58 88 M72 15 L52 46 L76 74"
                          stroke="#FEF08A"
                          strokeWidth="1.5"
                          fill="none"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </div>
                  {/* Refractory Pedestal */}
                  <div className="w-36 h-4 rounded-t-sm bg-slate-700 border-t border-slate-500 mt-1" />
                </div>
              </div>

              {/* Meltdown Alert Overlay Banner */}
              {isMelted && recordedMelt !== undefined && (
                <div className="mt-3 rounded-xl border border-rose-500/80 bg-rose-950/75 px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-mono-tabular font-bold text-rose-100">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    STRUCTURAL MELTDOWN: Thermal failure recorded at {recordedMelt.toLocaleString()} °C
                  </span>
                </div>
              )}

              {/* Torch Controls */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isMelted}
                  onPointerDown={startTorch}
                  onPointerUp={stopTorch}
                  onPointerLeave={stopTorch}
                  className={`flex-1 min-w-[220px] py-3 px-4 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isMelted
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : torchFiring
                        ? 'bg-orange-500 text-slate-950 ring-2 ring-amber-300 cursor-pointer'
                        : 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span>
                    {torchFiring
                      ? 'Firing Laser Blowtorch...'
                      : 'Fire Torch [Hold / Right-Click / Space]'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCoolRestore}
                  className="px-4 py-3 rounded-xl bg-[#0F172A] border border-slate-600 hover:border-cyan-400 text-cyan-200 text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Snowflake className="w-4 h-4 text-cyan-400" />
                  <span>Cool / Restore Sample</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLS: Reference Datasheets + Classification & Certification */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3">
            <div className="space-y-3">
              {/* Reference Material Datasheets */}
              <div className="rounded-xl border border-slate-800 bg-[#0B1322] p-3.5 space-y-2">
                <div className="text-xs font-display font-bold uppercase tracking-wider text-emerald-400">
                  Reference Material Datasheets
                </div>
                <div className="space-y-1.5">
                  {REFERENCE_MATERIALS.map((mat) => {
                    const passesReq = mat.meltC >= requirementC;
                    return (
                      <div
                        key={mat.id}
                        className="rounded-lg border border-slate-800 bg-[#070C17] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white">{mat.name}</div>
                          <div className="text-[10.5px] text-slate-400 truncate">
                            {mat.alloyNote}
                          </div>
                        </div>
                        <span
                          className={`font-mono-tabular text-xs font-bold shrink-0 px-2 py-0.5 rounded border ${
                            passesReq
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                              : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {mat.meltC.toLocaleString()} °C
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sample Identification Form */}
              <div className="rounded-xl border border-slate-800 bg-[#0B1322] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-display font-bold uppercase tracking-wider text-white">
                    Identify Unknown Blocks ({testedCount}/4 Tested)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      stopTorch();
                      setMeltLogs({});
                      setMeltedSamples({});
                      setSampleTemps({ 'Sample A': 22, 'Sample B': 22, 'Sample C': 22, 'Sample D': 22 });
                      setGuesses({ 'Sample A': '', 'Sample B': '', 'Sample C': '', 'Sample D': '' });
                      setSubmitError('');
                    }}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset Rig</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SAMPLE_LABELS.map((label) => {
                    const logT = meltLogs[label];
                    return (
                      <label key={label} className="block space-y-1 text-xs">
                        <div className="flex justify-between text-[11px] font-mono-tabular">
                          <span className="text-slate-300 font-bold">{label}</span>
                          <span className={logT ? 'text-amber-300' : 'text-slate-500'}>
                            {logT ? `${logT}°C` : 'Pending'}
                          </span>
                        </div>
                        <select
                          value={guesses[label]}
                          onChange={(e) => {
                            setSubmitError('');
                            setGuesses((prev) => ({ ...prev, [label]: e.target.value }));
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#070C17] border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400"
                        >
                          <option value="">-- Select Material --</option>
                          {REFERENCE_MATERIALS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>

                <label className="block space-y-1 pt-1 text-xs">
                  <span className="text-[11px] font-mono-tabular text-slate-300 uppercase">
                    Recommended Heat Shield Alloy (&ge; {requirementC.toLocaleString()} °C)
                  </span>
                  <select
                    value={selectedShield}
                    onChange={(e) => setSelectedShield(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[#070C17] border border-slate-700 text-xs text-emerald-300 font-semibold focus:outline-none focus:border-emerald-400"
                  >
                    {REFERENCE_MATERIALS.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.meltC.toLocaleString()} °C)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              {submitError && (
                <div className="rounded-lg border border-rose-500/60 bg-rose-950/60 px-3 py-2 text-xs text-rose-200 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {initialSummary?.certified && !submitError && (
                <div className="rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Certified Shield: <strong>{initialSummary.selectedShieldMaterial}</strong>
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>SUBMIT THERMAL REPORT TO ENGINEER &amp; COMPLETE TASK</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
