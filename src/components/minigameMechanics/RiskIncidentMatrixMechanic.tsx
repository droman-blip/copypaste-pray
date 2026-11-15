import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { MinigameDefinition, MinigamePayload } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface Props {
  def: MinigameDefinition;
  payload: MinigamePayload;
  onChange: (next: MinigamePayload) => void;
}

export function RiskIncidentMatrixMechanic({ def, payload, onChange }: Props) {
  const toggleMitigation = (id: string) => {
    soundFx.playKeyClick();
    const exists = payload.mitigatedIds.includes(id);
    onChange({
      ...payload,
      mitigatedIds: exists
        ? payload.mitigatedIds.filter((x) => x !== id)
        : [...payload.mitigatedIds, id],
    });
  };

  const setSeverity = (id: string, sev: 'baja' | 'media' | 'alta' | 'critica') => {
    soundFx.playKeyClick();
    onChange({
      ...payload,
      severityOverrides: {
        ...payload.severityOverrides,
        [id]: sev,
      },
    });
  };

  const totalReduced = def.items
    .filter((i) => payload.mitigatedIds.includes(i.id))
    .reduce((s, i) => s + (i.riskDeltaPct ?? 5), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>5×5 Risk, Incident &amp; Evidence Matrix</span>
          </h3>
          <p className="text-xs text-slate-400">
            Classify severity and activate verified mitigations to reduce residual risk.
          </p>
        </div>
        <span className="font-mono-tabular text-xs font-bold text-emerald-300">
          {payload.mitigatedIds.length}/{def.items.length} mitigated (-{totalReduced}% risk)
        </span>
      </div>

      {/* Interactive Risk Heatmap Preview */}
      <div className="rounded-xl border border-slate-800 bg-[#060B15] p-3">
        <div className="text-[10.5px] font-mono-tabular uppercase tracking-wider text-slate-400 mb-2">
          Probability × Impact Map (Green = Mitigated · Red = Active)
        </div>
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 25 }).map((_, cellIdx) => {
            const row = Math.floor(cellIdx / 5); // 0 top (high prob) .. 4 bottom
            const col = cellIdx % 5; // 0 left .. 4 right (high impact)
            const dangerScore = (4 - row) + col;
            const bg =
              dangerScore >= 6
                ? 'bg-rose-950/60 border-rose-500/30'
                : dangerScore >= 4
                  ? 'bg-amber-950/50 border-amber-500/30'
                  : 'bg-emerald-950/40 border-emerald-500/20';

            const itemHere = def.items.find((_item, i) => {
              const targetRow = (i * 2) % 4;
              const targetCol = 4 - (i % 3);
              return row === targetRow && col === targetCol;
            });

            const mitigated = itemHere ? payload.mitigatedIds.includes(itemHere.id) : false;

            return (
              <div
                key={cellIdx}
                className={`h-8 rounded border flex items-center justify-center text-[10px] font-mono-tabular ${bg}`}
              >
                {itemHere ? (
                  <button
                    type="button"
                    onClick={() => toggleMitigation(itemHere.id)}
                    title={itemHere.label}
                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                      mitigated
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {itemHere.id.slice(0, 5)}
                  </button>
                ) : (
                  <span className="text-slate-700">·</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk / Incident Rows */}
      <div className="space-y-2">
        {def.items.map((item) => {
          const mitigated = payload.mitigatedIds.includes(item.id);
          const sev = payload.severityOverrides[item.id] ?? 'alta';

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-3 transition-colors space-y-2 ${
                mitigated
                  ? 'bg-[#0B1B18] border-emerald-500/50'
                  : 'bg-[#170C10] border-rose-500/40'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-display font-bold text-white">
                    {item.label}
                    <span className="ml-2 text-[10.5px] font-mono-tabular text-sky-400">
                      [{item.category}]
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">{item.summary}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={sev}
                    onChange={(e) =>
                      setSeverity(item.id, e.target.value as 'baja' | 'media' | 'alta' | 'critica')
                    }
                    className="px-2 py-1 rounded bg-[#080D17] border border-slate-700 text-[11px] font-mono-tabular text-slate-200 cursor-pointer"
                  >
                    <option value="baja">Sev: Low</option>
                    <option value="media">Sev: Medium</option>
                    <option value="alta">Sev: High</option>
                    <option value="critica">Sev: Critical</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => toggleMitigation(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      mitigated
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{mitigated ? 'Mitigated / Closed' : 'Apply Control'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
