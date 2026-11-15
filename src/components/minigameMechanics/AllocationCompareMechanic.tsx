import { CheckCircle2, SlidersHorizontal } from 'lucide-react';
import type { MinigameDefinition, MinigamePayload } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface Props {
  def: MinigameDefinition;
  payload: MinigamePayload;
  onChange: (next: MinigamePayload) => void;
}

export function AllocationCompareMechanic({ def, payload, onChange }: Props) {
  const isCompare = def.code === 'G22';
  const isBudget = def.code.startsWith('G') && !isCompare;
  const totalAlloc = Object.values(payload.allocations).reduce((a, b) => a + b, 0);
  const reserveValue = isBudget ? Math.round((totalAlloc * payload.policyRatio) / 100) : 0;
  const netValue = isBudget
    ? totalAlloc + reserveValue
    : Math.round(totalAlloc * (def.code.startsWith('C') ? 1 - payload.policyRatio / 100 : 1));

  const setBucket = (id: string, val: number) => {
    soundFx.playKeyClick();
    onChange({
      ...payload,
      allocations: {
        ...payload.allocations,
        [id]: Math.max(2, Math.min(70, val)),
      },
    });
  };

  const setPolicy = (val: number) => {
    soundFx.playKeyClick();
    onChange({
      ...payload,
      policyRatio: Math.max(0, Math.min(45, val)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-sky-400" />
            <span>
              {isCompare
                ? 'Multi-Criteria Architecture Comparator'
                : `Resource Allocation (${def.unitPrimary})`}
            </span>
          </h3>
          <p className="text-xs text-slate-400">{def.mechanicSummary}</p>
        </div>
        <div className="text-right font-mono-tabular">
          <div className="text-xs font-bold text-white">
            {isCompare ? 'Weight Total' : 'Net Total'}: {netValue} {isCompare ? '%' : def.unitPrimary}
          </div>
          {isBudget && (
            <div className="text-[11px] text-amber-300">
              UFE Reserve: ${reserveValue}M ({payload.policyRatio}%)
            </div>
          )}
        </div>
      </div>

      {/* Candidate Selection for G22 */}
      {isCompare && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {def.items.map((item) => {
            const picked = payload.selectedOptionId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundFx.playKeyClick();
                  onChange({ ...payload, selectedOptionId: item.id });
                }}
                className={`text-left rounded-xl border p-3 cursor-pointer transition-colors space-y-1.5 ${
                  picked
                    ? 'bg-[#0C1D24] border-sky-400'
                    : 'bg-[#09101E] border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-display font-bold text-white">{item.label}</span>
                  {picked && <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">{item.summary}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Allocation Sliders */}
      <div className="space-y-2.5">
        {def.items.map((item) => {
          const val = payload.allocations[item.id] ?? 20;
          const pct = Math.min(100, Math.round((val / 65) * 100));
          return (
            <div
              key={item.id}
              className="rounded-xl border border-slate-800 bg-[#080E1B] p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-white">{item.label}</div>
                  <div className="text-[11px] text-slate-400">{item.summary}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBucket(item.id, val - 2)}
                    className="w-6 h-6 rounded border border-slate-700 bg-slate-900 hover:border-sky-400 text-xs font-bold text-white cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono-tabular text-xs font-bold text-sky-300 w-16 text-center">
                    {val} {isCompare ? '%' : def.unitPrimary}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBucket(item.id, val + 2)}
                    className="w-6 h-6 rounded border border-slate-700 bg-slate-900 hover:border-sky-400 text-xs font-bold text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={2}
                max={65}
                value={val}
                onChange={(e) => setBucket(item.id, Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Policy Slider (Reserve / Compression / Buffer) */}
      <div className="rounded-xl border border-amber-500/35 bg-[#121008] p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-display font-bold text-amber-200">
            {isBudget
              ? 'UFE Contingency Reserve (%)'
              : def.code.startsWith('C')
                ? 'Lossless Compression Policy (%)'
                : 'Operational Margin / Buffer (%)'}
          </span>
          <span className="font-mono-tabular font-bold text-amber-300">
            {payload.policyRatio}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={40}
          value={payload.policyRatio}
          onChange={(e) => setPolicy(Number(e.target.value))}
          className="w-full accent-amber-400 cursor-pointer"
        />
        <p className="text-[11px] text-amber-100/80">
          {isBudget
            ? 'Keep >= 12–15% UFE reserve to absorb engineering change requests and repairs.'
            : 'Tune the safety margin to balance usable capacity and transmission rate.'}
        </p>
      </div>
    </div>
  );
}
