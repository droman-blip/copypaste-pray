import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MinigameDefinition, MinigamePayload } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface Props {
  def: MinigameDefinition;
  payload: MinigamePayload;
  onChange: (next: MinigamePayload) => void;
}

export function TimelineGanttMechanic({ def, payload, onChange }: Props) {
  const maxSpan = def.code === 'G12' ? 230 : def.code === 'G42' ? 75 : 165;
  const endDay = payload.tasks.reduce((m, t) => Math.max(m, t.startDay + t.durationDays - 1), 0);
  const slack = maxSpan - endDay;
  const taskMap = new Map(payload.tasks.map((t) => [t.id, t]));

  const updateTask = (
    id: string,
    patch: Partial<{ startDay: number; durationDays: number }>,
  ) => {
    soundFx.playKeyClick();
    onChange({
      ...payload,
      tasks: payload.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              startDay: Math.max(1, patch.startDay ?? t.startDay),
              durationDays: Math.max(5, Math.min(90, patch.durationDays ?? t.durationDays)),
            }
          : t,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-400" />
            <span>Gantt Timeline &amp; Critical Path Planner</span>
          </h3>
          <p className="text-xs text-slate-400">
            Shift start dates or adjust durations while avoiding overlaps between dependent tasks.
          </p>
        </div>

        <div className="font-mono-tabular text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 bg-[#091224]">
          End: Day {endDay} / {maxSpan} ·{' '}
          <span className={slack >= 8 ? 'text-emerald-400' : 'text-rose-400'}>
            Slack: {slack}d
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#060B15] p-3 space-y-3">
        {payload.tasks.map((task) => {
          const prev = task.dependsOn ? taskMap.get(task.dependsOn) : undefined;
          const overlap = Boolean(prev && task.startDay < prev.startDay + prev.durationDays);
          const leftPct = Math.min(88, Math.max(0, ((task.startDay - 1) / maxSpan) * 100));
          const widthPct = Math.max(8, Math.min(100 - leftPct, (task.durationDays / maxSpan) * 100));

          return (
            <div
              key={task.id}
              className={`rounded-lg border p-2.5 space-y-2 ${
                overlap
                  ? 'border-rose-500/60 bg-rose-950/20'
                  : 'border-slate-800 bg-[#0A1222]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">
                    {task.label}
                    {prev && (
                      <span className="text-[10.5px] font-mono-tabular text-slate-400 ml-2">
                        (After {prev.label})
                      </span>
                    )}
                  </div>
                  {overlap && (
                    <div className="text-[11px] text-rose-300 font-semibold">
                      Invalid overlap: must start on Day {prev!.startDay + prev!.durationDays} or later.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono-tabular text-[11px] shrink-0">
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { startDay: task.startDay - 4 })}
                    className="p-1 rounded border border-slate-700 bg-slate-900 hover:border-sky-400 text-white cursor-pointer"
                    title="Shift start earlier by 4 days"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sky-300">
                    D{task.startDay}–D{task.startDay + task.durationDays - 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { startDay: task.startDay + 4 })}
                    className="p-1 rounded border border-slate-700 bg-slate-900 hover:border-sky-400 text-white cursor-pointer"
                    title="Shift start later by 4 days"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-slate-600">|</span>

                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { durationDays: task.durationDays - 2 })}
                    className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 hover:border-amber-400 text-white cursor-pointer"
                  >
                    -2d
                  </button>
                  <span className="text-amber-300">{task.durationDays}d</span>
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { durationDays: task.durationDays + 2 })}
                    className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 hover:border-amber-400 text-white cursor-pointer"
                  >
                    +2d
                  </button>
                </div>
              </div>

              {/* Timeline Bar */}
              <div className="relative h-5 rounded bg-[#050811] border border-slate-800/80 overflow-hidden">
                <div
                  className={`absolute top-0.5 bottom-0.5 rounded transition-all flex items-center px-2 text-[10px] font-mono-tabular font-bold ${
                    overlap
                      ? 'bg-rose-500 text-white'
                      : 'bg-sky-500/80 text-slate-950'
                  }`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  {task.durationDays}d
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
