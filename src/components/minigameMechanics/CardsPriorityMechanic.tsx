import { ArrowDown, ArrowUp, Check, Plus, Sparkles } from 'lucide-react';
import type { MinigameDefinition, MinigamePayload } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface Props {
  def: MinigameDefinition;
  payload: MinigamePayload;
  onChange: (next: MinigamePayload) => void;
}

export function CardsPriorityMechanic({ def, payload, onChange }: Props) {
  const toggleCard = (id: string) => {
    soundFx.playKeyClick();
    const exists = payload.selectedIds.includes(id);
    if (exists) {
      onChange({
        ...payload,
        selectedIds: payload.selectedIds.filter((x) => x !== id),
        priorityOrder: payload.priorityOrder.filter((x) => x !== id),
      });
    } else if (payload.selectedIds.length < 3) {
      onChange({
        ...payload,
        selectedIds: [...payload.selectedIds, id],
        priorityOrder: [...payload.priorityOrder, id],
      });
    }
  };

  const movePriority = (id: string, dir: -1 | 1) => {
    soundFx.playKeyClick();
    const idx = payload.priorityOrder.indexOf(id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= payload.priorityOrder.length) return;
    const nextOrder = [...payload.priorityOrder];
    const tmp = nextOrder[idx];
    nextOrder[idx] = nextOrder[swapIdx];
    nextOrder[swapIdx] = tmp;
    onChange({
      ...payload,
      priorityOrder: nextOrder,
      selectedIds: nextOrder,
    });
  };

  const selectedItems = payload.priorityOrder
    .map((id) => def.items.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white">
            Selection &amp; Priority Catalog (Max. 3 cards)
          </h3>
          <p className="text-xs text-slate-400">
            Click to add or remove cards and adjust their priority ranking #1–#3.
          </p>
        </div>
        <span className="font-mono-tabular text-xs font-bold text-sky-300">
          {selectedItems.length} / 3 active
        </span>
      </div>

      {/* Priority Ranking Slots */}
      <div className="rounded-xl border border-slate-800 bg-[#080E1B] p-3 space-y-2">
        <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400">
          Active Priority Order
        </div>
        {selectedItems.length === 0 ? (
          <div className="text-xs text-slate-500 py-2">
            Select at least 2 cards from the catalog below to rank.
          </div>
        ) : (
          <div className="space-y-1.5">
            {selectedItems.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-lg border border-emerald-500/40 bg-[#0B1C19] px-3 py-2 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{item.label}</div>
                    <div className="text-[10.5px] font-mono-tabular text-slate-400">
                      {item.category}
                      {item.sciencePts ? ` · +${item.sciencePts} pts` : ''}
                      {item.massKg ? ` · ${item.massKg} kg` : ''}
                      {item.powerW ? ` · ${item.powerW} W` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => movePriority(item.id, -1)}
                    disabled={idx === 0}
                    className="p-1 rounded border border-slate-700 bg-slate-900 hover:border-sky-400 disabled:opacity-30 cursor-pointer"
                    title="Move up priority"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-slate-200" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePriority(item.id, 1)}
                    disabled={idx === selectedItems.length - 1}
                    className="p-1 rounded border border-slate-700 bg-slate-900 hover:border-sky-400 disabled:opacity-30 cursor-pointer"
                    title="Move down priority"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-slate-200" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidate Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {def.items.map((item) => {
          const active = payload.selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleCard(item.id)}
              className={`text-left rounded-xl border p-3 transition-colors cursor-pointer space-y-2 ${
                active
                  ? 'bg-[#0C1D1A] border-emerald-500/70'
                  : 'bg-[#09101E] border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10.5px] font-mono-tabular uppercase tracking-wider text-sky-400">
                    {item.category}
                  </div>
                  <div className="text-xs font-display font-bold text-white mt-0.5">
                    {item.label}
                  </div>
                </div>
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${
                    active
                      ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {active ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-300 leading-snug">{item.summary}</p>
              <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] font-mono-tabular text-slate-300">
                {typeof item.sciencePts === 'number' && (
                  <span className="text-emerald-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> +{item.sciencePts} pts
                  </span>
                )}
                {typeof item.massKg === 'number' && <span>{item.massKg} kg</span>}
                {typeof item.powerW === 'number' && <span>{item.powerW} W</span>}
                {typeof item.dataGB === 'number' && <span>{item.dataGB} GB/d</span>}
                {typeof item.costM === 'number' && <span className="text-amber-300">${item.costM}M</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
