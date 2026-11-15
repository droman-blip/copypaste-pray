import { Search, Wrench } from 'lucide-react';
import type { MinigameDefinition, MinigamePayload } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface Props {
  def: MinigameDefinition;
  payload: MinigamePayload;
  onChange: (next: MinigamePayload) => void;
}

export function DiagnosticsVibrationMechanic({ def, payload, onChange }: Props) {
  const nodes = def.items.filter((i) => i.category === 'Node');
  const fixes = def.items.filter((i) => i.category !== 'Node');

  const toggleProbe = (id: string) => {
    soundFx.playKeyClick();
    if (payload.probedNodes.includes(id)) return;
    onChange({
      ...payload,
      probedNodes: [...payload.probedNodes, id],
    });
  };

  const toggleFix = (id: string) => {
    soundFx.playKeyClick();
    const exists = payload.appliedFixes.includes(id);
    onChange({
      ...payload,
      appliedFixes: exists
        ? payload.appliedFixes.filter((f) => f !== id)
        : [...payload.appliedFixes, id],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>Active Diagnostics, Vibration &amp; Repair</span>
          </h3>
          <p className="text-xs text-slate-400">
            1) Probe each subsystem node to identify the fault. 2) Apply fixes and raise stabilization damping.
          </p>
        </div>
        <span className="font-mono-tabular text-xs font-bold text-amber-300">
          Probes {payload.probedNodes.length}/{nodes.length} · Fixes {payload.appliedFixes.length}/{fixes.length}
        </span>
      </div>

      {/* Diagnostic Nodes */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400">
          Step 1 · Inspection &amp; Probing Points
        </div>
        <div className="grid grid-cols-1 gap-2">
          {nodes.map((node) => {
            const probed = payload.probedNodes.includes(node.id);
            return (
              <div
                key={node.id}
                className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2 ${
                  probed
                    ? 'bg-[#0E182B] border-sky-500/50'
                    : 'bg-[#090F1C] border-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-display font-bold text-white">{node.label}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {probed ? `Diagnosis: ${node.summary}` : 'Click "Probe Node" to sample node telemetry.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleProbe(node.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    probed
                      ? 'bg-sky-500/20 border border-sky-400/50 text-sky-200'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{probed ? 'Inspected' : 'Probe Node'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Repair / Mitigation Actions */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400">
          Step 2 · Corrective Actions / Spares
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fixes.map((fix) => {
            const active = payload.appliedFixes.includes(fix.id);
            return (
              <button
                key={fix.id}
                type="button"
                onClick={() => toggleFix(fix.id)}
                className={`text-left rounded-xl border p-3 cursor-pointer transition-colors space-y-1 ${
                  active
                    ? 'bg-[#0C1D1A] border-emerald-500/70'
                    : 'bg-[#09101E] border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-display font-bold text-white">{fix.label}</span>
                  <span
                    className={`text-[10.5px] font-mono-tabular font-bold ${
                      active ? 'text-emerald-300' : 'text-slate-400'
                    }`}
                  >
                    {active ? 'APPLIED' : 'APPLY'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">{fix.summary}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Damping / Stabilization Level */}
      <div className="rounded-xl border border-slate-800 bg-[#080E1B] p-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="font-semibold text-white">
            Damping / Active Stabilization Level (%)
          </span>
          <span
            className={`font-mono-tabular font-bold ${
              payload.dampingLevel >= 60 ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
            {payload.dampingLevel}% (Min. 60%)
          </span>
        </div>
        <input
          type="range"
          min={20}
          max={100}
          step={5}
          value={payload.dampingLevel}
          onChange={(e) => {
            soundFx.playKeyClick();
            onChange({ ...payload, dampingLevel: Number(e.target.value) });
          }}
          className="w-full accent-emerald-400 cursor-pointer"
        />
      </div>
    </div>
  );
}
