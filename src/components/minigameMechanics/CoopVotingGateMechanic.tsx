import { CheckCircle2, Users, XCircle } from 'lucide-react';
import { ROLES } from '../../data/missionData';
import type { MinigameDefinition, MinigamePayload, RoleId } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface Props {
  def: MinigameDefinition;
  payload: MinigamePayload;
  onChange: (next: MinigamePayload) => void;
}

export function CoopVotingGateMechanic({ def, payload, onChange }: Props) {
  const setVote = (roleId: RoleId, vote: 'approve' | 'reject') => {
    soundFx.playKeyClick();
    onChange({
      ...payload,
      votes: {
        ...payload.votes,
        [roleId]: {
          ...payload.votes[roleId],
          vote,
        },
      },
    });
  };

  const setNote = (roleId: RoleId, note: string) => {
    onChange({
      ...payload,
      votes: {
        ...payload.votes,
        [roleId]: {
          ...payload.votes[roleId],
          note,
        },
      },
    });
  };

  const approveCount = ROLES.filter((r) => payload.votes[r.id]?.vote === 'approve').length;
  const votedCount = ROLES.filter((r) => payload.votes[r.id]?.vote !== 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Cooperative Review · Gate {def.code}</span>
          </h3>
          <p className="text-xs text-slate-400">
            Select the technical baseline agreement and collect all 4 department votes with rationale.
          </p>
        </div>
        <span className="font-mono-tabular text-xs font-bold text-cyan-300">
          {approveCount} GO · {votedCount}/4 voted
        </span>
      </div>

      {/* Compromise / Decision Baseline Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {def.items.map((item) => {
          const picked = payload.compromiseId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundFx.playKeyClick();
                onChange({ ...payload, compromiseId: item.id });
              }}
              className={`text-left rounded-xl border p-3 cursor-pointer transition-colors space-y-1 ${
                picked
                  ? 'bg-[#0C212A] border-cyan-400'
                  : 'bg-[#080F1D] border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-display font-bold text-white">{item.label}</span>
                {picked && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
              </div>
              <p className="text-[11px] text-slate-300">{item.summary}</p>
            </button>
          );
        })}
      </div>

      {/* 4 Department Votes */}
      <div className="space-y-2">
        {ROLES.map((role) => {
          const entry = payload.votes[role.id] ?? { vote: 'pending', note: '' };
          return (
            <div
              key={role.id}
              className="rounded-xl border border-slate-800 bg-[#080E1B] p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: role.colorHex }}
                  />
                  <span className="text-xs font-display font-bold text-white">{role.name}</span>
                  <span className="text-[10.5px] font-mono-tabular text-slate-400">
                    ({role.focusQuestion})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVote(role.id, 'approve')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      entry.vote === 'approve'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve (GO)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVote(role.id, 'reject')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      entry.vote === 'reject'
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-rose-400'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Flag Issue</span>
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={entry.note}
                onChange={(e) => setNote(role.id, e.target.value)}
                placeholder={`${role.shortName} verdict...`}
                className="w-full px-2.5 py-1.5 rounded bg-[#050912] border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
