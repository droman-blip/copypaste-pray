import { Activity, Check, Flame, Globe2 } from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../../data/missionData';
import type { DifficultyId, MinigameDefinition, MinigamePayload, SharedMissionState } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface Props {
  def: MinigameDefinition;
  payload: MinigamePayload;
  sharedState: SharedMissionState;
  difficulty: DifficultyId;
  onChange: (next: MinigamePayload) => void;
}

export function SignalOrbitalGlobeMechanic({
  def,
  payload,
  sharedState,
  difficulty,
  onChange,
}: Props) {
  const diff = DIFFICULTY_CONFIGS[difficulty];
  const isDeltaV = def.code === 'I42';
  const isGlobe = def.code === 'C23' || def.code === 'A11';

  const toggleZone = (id: string) => {
    soundFx.playKeyClick();
    const exists = payload.zones.includes(id);
    onChange({
      ...payload,
      zones: exists ? payload.zones.filter((z) => z !== id) : [...payload.zones, id],
    });
  };

  const toggleFinding = (id: string) => {
    soundFx.playKeyClick();
    const exists = payload.reportFindings.includes(id);
    onChange({
      ...payload,
      reportFindings: exists
        ? payload.reportFindings.filter((f) => f !== id)
        : [...payload.reportFindings, id],
    });
  };

  // Mode A: Orbital Δv Tsiolkovsky Calculator (I42)
  if (isDeltaV) {
    const dryKg = Math.max(1400, Math.round(sharedState.masaVolumen.totalMassKg * 0.52));
    const calcDv = Math.round(445 * 9.81 * Math.log((dryKg + payload.propellantKg) / dryKg));
    const marginDv = calcDv - diff.minDeltaVMps;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-sky-400" />
              <span>Tsiolkovsky Orbital Calculator · Δv &amp; Propellant</span>
            </h3>
            <p className="text-xs text-slate-400">
              Tune cryogenic propellant load (Isp 445 s) to exceed the {diff.targetName} requirement.
            </p>
          </div>
          <span
            className={`font-mono-tabular text-xs font-bold px-3 py-1 rounded-lg border ${
              marginDv >= 0
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
            }`}
          >
            Δv {calcDv.toLocaleString()} / {diff.minDeltaVMps.toLocaleString()} m/s
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#060B15] p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono-tabular">
            <div className="rounded-lg border border-slate-800 bg-[#0A1222] p-3">
              <div className="text-slate-400">Effective Dry Mass</div>
              <div className="text-base font-bold text-white mt-0.5">{dryKg.toLocaleString()} kg</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0A1222] p-3">
              <div className="text-slate-400">Loaded Propellant</div>
              <div className="text-base font-bold text-sky-300 mt-0.5">
                {payload.propellantKg.toLocaleString()} kg
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0A1222] p-3">
              <div className="text-slate-400">Δv Margin</div>
              <div
                className={`text-base font-bold mt-0.5 ${
                  marginDv >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {marginDv >= 0 ? `+${marginDv}` : marginDv} m/s
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-white">LOX/LH2 Propellant Mass (kg)</span>
              <span className="font-mono-tabular text-sky-300">{payload.propellantKg} kg</span>
            </div>
            <input
              type="range"
              min={700}
              max={3600}
              step={50}
              value={payload.propellantKg}
              onChange={(e) => {
                soundFx.playKeyClick();
                onChange({ ...payload, propellantKg: Number(e.target.value) });
              }}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          <div className="text-[11px] font-mono-tabular text-slate-400">
            Applied formula: Δv = 445 s × 9.81 m/s² × ln(({dryKg} + {payload.propellantKg}) / {dryKg})
          </div>
        </div>
      </div>
    );
  }

  // Mode B: Globe Zone Coverage Selector (C23, A11)
  if (isGlobe) {
    const covPct = Math.min(
      100,
      def.items
        .filter((i) => payload.zones.includes(i.id))
        .reduce((s, i) => s + (i.coveragePct ?? 20), 0),
    );

    const coords = [
      { cx: 180, cy: 36 },
      { cx: 180, cy: 164 },
      { cx: 112, cy: 100 },
      { cx: 248, cy: 100 },
      { cx: 180, cy: 126 },
    ];

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-emerald-400" />
              <span>Orbital Coverage &amp; Capture Viewer</span>
            </h3>
            <p className="text-xs text-slate-400">
              Select at least 4 target zones on the planet to exceed 70% coverage.
            </p>
          </div>
          <span className="font-mono-tabular text-xs font-bold text-emerald-300">
            Coverage: {covPct}% ({payload.zones.length} zones)
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#050A14] p-3 flex flex-col sm:flex-row items-center gap-4">
          <svg viewBox="0 0 360 200" className="w-full sm:w-64 h-44 shrink-0">
            <circle cx="180" cy="100" r="80" fill="#0b1b34" stroke="#38bdf8" strokeWidth="1.5" />
            <ellipse cx="180" cy="100" rx="80" ry="26" fill="none" stroke="#1e3a5f" strokeDasharray="4 4" />
            <ellipse cx="180" cy="100" rx="28" ry="80" fill="none" stroke="#1e3a5f" strokeDasharray="4 4" />
            {def.items.map((z, idx) => {
              const pt = coords[idx] ?? { cx: 180, cy: 100 };
              const active = payload.zones.includes(z.id);
              return (
                <g
                  key={z.id}
                  onClick={() => toggleZone(z.id)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r={active ? 16 : 12}
                    fill={active ? 'rgba(34,197,94,0.32)' : 'rgba(148,163,184,0.16)'}
                    stroke={active ? '#22c55e' : '#64748b'}
                    strokeWidth={2}
                  />
                  <text
                    x={pt.cx}
                    y={pt.cy + 3}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="9"
                    fontWeight="bold"
                  >
                    Z{idx + 1}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="flex-1 w-full space-y-2">
            {def.items.map((zone, idx) => {
              const active = payload.zones.includes(zone.id);
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => toggleZone(zone.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer ${
                    active
                      ? 'bg-[#0C1D1A] border-emerald-500/60 text-white'
                      : 'bg-[#09101E] border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      Z{idx + 1} · {zone.label}
                    </div>
                    <div className="text-[10.5px] text-slate-400">{zone.summary}</div>
                  </div>
                  <span className="font-mono-tabular text-[11px] font-bold text-emerald-300 shrink-0">
                    +{zone.coveragePct ?? 18}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Mode C: Signal Calibration & Evidence Curve Tuner (C31, C51, C52, C53, A12, A13)
  const targetOffset = def.code === 'C31' ? 4 : 2;
  const targetGain = 1.9;
  const targetFilter = 65;
  const errPct = Math.round(
    Math.abs(payload.offsetValue - targetOffset) * 1.4 +
      Math.abs(payload.gainValue - targetGain) * 15 +
      Math.abs(payload.filterValue - targetFilter) * 0.3,
  );
  const qualityPct = Math.max(40, Math.min(99, 100 - errPct));

  // Generate SVG path for reference vs tuned signal
  const buildWave = (off: number, gain: number, filt: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * 500;
      const baseSin = Math.sin(i * 0.35) * 28 + Math.cos(i * 0.7) * 14;
      const noise = Math.max(0, 65 - filt) * 0.16 * Math.sin(i * 2.1);
      const y = 75 - (baseSin * (gain / 1.9) + (off - 2) * 1.6 + noise);
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${Math.max(10, Math.min(140, y)).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const refPath = buildWave(targetOffset, targetGain, targetFilter);
  const userPath = buildWave(payload.offsetValue, payload.gainValue, payload.filterValue);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Spectral Calibration &amp; Signal Verification</span>
          </h3>
          <p className="text-xs text-slate-400">
            Overlay the measured signal (blue) onto the reference standard (green) keeping error below 15%.
          </p>
        </div>
        <span
          className={`font-mono-tabular text-xs font-bold px-3 py-1 rounded-lg border ${
            qualityPct >= 85
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
          }`}
        >
          Quality: {qualityPct}% (Error {errPct}%)
        </span>
      </div>

      {/* Live Dual Waveform SVG */}
      <div className="rounded-xl border border-slate-800 bg-[#050A14] p-2">
        <svg viewBox="0 0 500 150" className="w-full h-36">
          <line x1="0" y1="75" x2="500" y2="75" stroke="#1e293b" strokeDasharray="4 4" />
          <path d={refPath} fill="none" stroke="#22c55e" strokeWidth="2.5" opacity="0.85" />
          <path d={userPath} fill="none" stroke="#38bdf8" strokeWidth="2.2" />
        </svg>
        <div className="flex items-center justify-between px-2 text-[10.5px] font-mono-tabular text-slate-400">
          <span className="text-emerald-400">— Reference Standard Curve</span>
          <span className="text-sky-400">— Calibrated Sensor Signal</span>
        </div>
      </div>

      {/* Offset / Gain / Filter Tuners */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-lg border border-slate-800 bg-[#080E1B] p-2.5 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Offset</span>
            <span className="font-mono-tabular text-sky-300">{payload.offsetValue} mV</span>
          </div>
          <input
            type="range"
            min={-15}
            max={25}
            value={payload.offsetValue}
            onChange={(e) => {
              soundFx.playKeyClick();
              onChange({ ...payload, offsetValue: Number(e.target.value) });
            }}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#080E1B] p-2.5 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Gain</span>
            <span className="font-mono-tabular text-sky-300">{payload.gainValue.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={2.8}
            step={0.05}
            value={payload.gainValue}
            onChange={(e) => {
              soundFx.playKeyClick();
              onChange({ ...payload, gainValue: Number(e.target.value) });
            }}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#080E1B] p-2.5 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Noise Filter</span>
            <span className="font-mono-tabular text-sky-300">{payload.filterValue} Hz</span>
          </div>
          <input
            type="range"
            min={20}
            max={90}
            value={payload.filterValue}
            onChange={(e) => {
              soundFx.playKeyClick();
              onChange({ ...payload, filterValue: Number(e.target.value) });
            }}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Findings / Test Evidences Checklist */}
      {(def.code === 'C53' || def.code === 'A12' || def.code === 'A13') && (
        <div className="space-y-1.5">
          <div className="text-xs font-display font-bold text-white">
            Report-Linked Evidence &amp; Findings ({payload.reportFindings.length}/{def.items.length})
          </div>
          {def.items.map((item) => {
            const checked = payload.reportFindings.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleFinding(item.id)}
                className={`w-full text-left rounded-lg border px-3 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer ${
                  checked
                    ? 'bg-[#0C1D1A] border-emerald-500/60 text-white'
                    : 'bg-[#080E1B] border-slate-800 text-slate-300'
                }`}
              >
                <div>
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-[10.5px] text-slate-400">{item.summary}</div>
                </div>
                <span
                  className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                    checked ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 border border-slate-700'
                  }`}
                >
                  {checked && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
