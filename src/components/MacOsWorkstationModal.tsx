import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Monitor,
  Plus,
  Power,
  Rocket,
  Siren,
  Wifi,
} from 'lucide-react';
import {
  MINIGAMES_72,
  MISSION_PHASES_6,
  PHASE_6_MAP,
  getMinigamesForRoleAndPhase,
} from '../data/minigamesData';
import {
  CARGO_MODULES,
  DIFFICULTY_CONFIGS,
  ROCKET_MODULES,
  ROLE_MAP,
  ROOM_MAP,
} from '../data/missionData';
import type {
  DifficultyId,
  InteractableId,
  MinigameInstanceState,
  MinigameWorkflowStatus,
  MissionPhaseNumber,
  RoleId,
  SharedMissionState,
} from '../types/mission';
import { soundFx } from '../utils/soundFx';
import type { WhiteboardNote } from './InteractableModal';

type MacAppId = 'workstation' | 'telemetry' | 'notes';

interface MacOsWorkstationModalProps {
  interactableId: InteractableId;
  activeRole: RoleId;
  difficulty: DifficultyId;
  currentPhase: MissionPhaseNumber;
  installedModuleIds: string[];
  sharedState: SharedMissionState;
  minigameStates: Record<string, MinigameInstanceState>;
  cargoStates: Record<string, { integrity: number; delivered: boolean }>;
  whiteboardNotes: Record<string, WhiteboardNote[]>;
  onOpenMinigame: (code: string) => void;
  onCallEmergencyMeeting: () => void;
  onAddWhiteboardNote: (boardId: InteractableId, text: string) => void;
  onToggleWhiteboardNote: (boardId: InteractableId, noteId: string) => void;
  contentTitle: string;
  contentSubtitle: string;
  contentSummary: string;
  contentDataPoints: Array<{ label: string; value: string }>;
  onClose: () => void;
}

const APP_META: Record<MacAppId, { label: string; shortLabel: string }> = {
  workstation: { label: 'Mission Workstation', shortLabel: 'Workstation' },
  telemetry: { label: 'Shared State & Annex C', shortLabel: 'Annex C' },
  notes: { label: 'Engineering Notes', shortLabel: 'Notes' },
};

const STATUS_LABEL: Record<MinigameWorkflowStatus, { text: string; cls: string }> = {
  no_iniciado: { text: 'Not Started', cls: 'text-slate-400 border-slate-700 bg-slate-900' },
  en_progreso: { text: 'In Progress', cls: 'text-sky-300 border-sky-500/50 bg-sky-950/60' },
  pendiente_revision: {
    text: 'In Review',
    cls: 'text-amber-300 border-amber-500/50 bg-amber-950/60',
  },
  validado: { text: 'Validated', cls: 'text-teal-300 border-teal-500/50 bg-teal-950/60' },
  requiere_cambios: {
    text: 'Recalc Required',
    cls: 'text-rose-300 border-rose-500/60 bg-rose-950/70',
  },
  confirmado: {
    text: 'Confirmed',
    cls: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60',
  },
};

export function MacOsWorkstationModal({
  interactableId,
  activeRole,
  difficulty,
  currentPhase,
  installedModuleIds,
  sharedState,
  minigameStates,
  cargoStates,
  whiteboardNotes,
  onOpenMinigame,
  onCallEmergencyMeeting,
  onAddWhiteboardNote,
  onToggleWhiteboardNote,
  contentTitle,
  contentDataPoints,
  onClose,
}: MacOsWorkstationModalProps) {
  const [activeApp, setActiveApp] = useState<MacAppId>('workstation');
  const [openApps, setOpenApps] = useState<MacAppId[]>(['workstation']);
  const [minimizedApps, setMinimizedApps] = useState<MacAppId[]>([]);
  const [expandedApp, setExpandedApp] = useState<boolean>(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedPhaseTab, setSelectedPhaseTab] = useState<MissionPhaseNumber>(currentPhase);
  const [clockLabel, setClockLabel] = useState(() =>
    new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }),
  );

  const [noteDraft, setNoteDraft] = useState('');

  const diffCfg = DIFFICULTY_CONFIGS[difficulty];
  const roleDef = ROLE_MAP[activeRole];

  useEffect(() => {
    setSelectedPhaseTab(currentPhase);
  }, [currentPhase]);

  useEffect(() => {
    setActiveApp('workstation');
    setOpenApps(['workstation']);
    setMinimizedApps([]);
    setExpandedApp(false);
    setOpenMenu(null);
    setNoteDraft('');
  }, [interactableId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockLabel(
        new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  const launchOrFocusApp = (appId: MacAppId) => {
    soundFx.playKeyClick();
    setOpenMenu(null);
    setOpenApps((prev) => (prev.includes(appId) ? prev : [...prev, appId]));
    setMinimizedApps((prev) => prev.filter((id) => id !== appId));
    setActiveApp(appId);
  };

  const closeWindow = (appId: MacAppId) => {
    soundFx.playKeyClick();
    const nextOpen = openApps.filter((id) => id !== appId);
    setOpenApps(nextOpen);
    setMinimizedApps((prev) => prev.filter((id) => id !== appId));
    const nextVisible = nextOpen.filter((id) => !minimizedApps.includes(id));
    if (nextVisible.length > 0) {
      setActiveApp(nextVisible[nextVisible.length - 1]);
    }
  };

  const minimizeWindow = (appId: MacAppId) => {
    soundFx.playKeyClick();
    setMinimizedApps((prev) => (prev.includes(appId) ? prev : [...prev, appId]));
  };

  const handleAddNote = (e: FormEvent) => {
    e.preventDefault();
    const clean = noteDraft.trim();
    if (!clean) return;
    soundFx.playKeyClick();
    onAddWhiteboardNote(interactableId, clean);
    setNoteDraft('');
  };

  const isWindowVisible = openApps.includes(activeApp) && !minimizedApps.includes(activeApp);
  const currentPhaseMeta = PHASE_6_MAP[selectedPhaseTab];
  const rolePhaseMinigames = getMinigamesForRoleAndPhase(activeRole, selectedPhaseTab);
  const myTotalConfirmed = MINIGAMES_72.filter(
    (m) => m.roleId === activeRole && minigameStates[m.code]?.status === 'confirmado',
  ).length;
  const stationNotes = whiteboardNotes[interactableId] ?? [];

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center p-2.5 sm:p-5 bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl flex flex-col items-center">
        <div className="w-full rounded-[22px] bg-gradient-to-b from-[#d8dee6] via-[#a7b2c0] to-[#7c8798] p-[3px] shadow-[0_28px_70px_rgba(0,0,0,0.75)]">
          <div className="w-full rounded-[19px] bg-[#06080f] overflow-hidden flex flex-col border border-black/80">
            <div className="h-3.5 bg-[#04060c] flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 border border-slate-600" />
            </div>

            <div
              className="relative mx-2 sm:mx-2.5 rounded-lg overflow-hidden border border-slate-800 flex flex-col h-[68vh] min-h-[450px] max-h-[680px]"
              style={{
                background:
                  'radial-gradient(circle at 20% 22%, rgba(56, 189, 248, 0.24), transparent 44%), radial-gradient(circle at 82% 28%, rgba(168, 85, 247, 0.22), transparent 46%), radial-gradient(circle at 54% 84%, rgba(249, 115, 22, 0.14), transparent 46%), linear-gradient(155deg, #030712 0%, #071124 48%, #040814 100%)',
              }}
              onClick={() => {
                if (openMenu) setOpenMenu(null);
              }}
            >
              {/* Top Menu Bar */}
              <header className="relative z-20 h-7 px-3 bg-[#09101f]/90 border-b border-white/10 flex items-center justify-between text-[11.5px] text-slate-200 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFx.playKeyClick();
                      setOpenMenu((m) => (m === 'nasa' ? null : 'nasa'));
                    }}
                    className="flex items-center gap-1 font-bold text-white hover:text-sky-300 cursor-pointer shrink-0"
                  >
                    <Rocket className="w-3.5 h-3.5 text-sky-400" />
                    <span>AERO-OS</span>
                  </button>

                  <span className="font-bold text-white truncate">
                    {isWindowVisible ? APP_META[activeApp].shortLabel : 'Finder'}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 font-mono-tabular text-[11px]">
                  <span className="hidden md:inline font-sans font-semibold" style={{ color: roleDef.colorHex }}>
                    {roleDef.shortName} ({myTotalConfirmed}/18)
                  </span>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <Wifi className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">KA-LINK</span>
                  </span>
                  <span className="text-slate-200">{clockLabel}</span>
                </div>
              </header>

              {/* Desktop Workspace */}
              <div
                className={`relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center ${
                  expandedApp ? 'p-1.5 pb-16' : 'p-3 sm:p-5 pb-16'
                }`}
              >
                {!isWindowVisible ? (
                  <div className="rounded-2xl border border-white/15 bg-[#0b1324]/88 px-6 py-5 text-center space-y-3 max-w-sm shadow-2xl">
                    <div className="text-xs font-mono-tabular uppercase tracking-wider text-sky-300">
                      Workstation Idle
                    </div>
                    <p className="text-xs text-slate-300">
                      Select an application from the bottom Dock or step away from the desk.
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => launchOrFocusApp('workstation')}
                        className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold cursor-pointer"
                      >
                        Open Workstation
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium cursor-pointer"
                      >
                        Stand Up
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`w-full h-full flex flex-col rounded-xl border border-white/15 bg-[#0b1222]/92 shadow-[0_24px_60px_rgba(0,0,0,0.68)] overflow-hidden transition-all ${
                      expandedApp ? 'max-w-full' : 'max-w-4xl'
                    }`}
                  >
                    {/* Traffic Lights Bar */}
                    <div className="h-9 px-3.5 bg-[#121c33]/95 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-2 shrink-0 group">
                        <button
                          type="button"
                          onClick={() => closeWindow(activeApp)}
                          aria-label="Close window"
                          className="w-3.5 h-3.5 rounded-full bg-[#ff5f57] border border-[#e0443e] flex items-center justify-center text-[9px] font-bold text-black/75 cursor-pointer"
                        >
                          <span className="opacity-0 group-hover:opacity-100 leading-none">×</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => minimizeWindow(activeApp)}
                          aria-label="Minimize window"
                          className="w-3.5 h-3.5 rounded-full bg-[#febc2e] border border-[#d89e24] flex items-center justify-center text-[9px] font-bold text-black/75 cursor-pointer"
                        >
                          <span className="opacity-0 group-hover:opacity-100 leading-none">−</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playKeyClick();
                            setExpandedApp((v) => !v);
                          }}
                          aria-label="Expand window"
                          className="w-3.5 h-3.5 rounded-full bg-[#28c840] border border-[#1aab29] flex items-center justify-center text-[9px] font-bold text-black/75 cursor-pointer"
                        >
                          <span className="opacity-0 group-hover:opacity-100 leading-none">+</span>
                        </button>
                      </div>

                      <span className="text-xs font-display font-semibold text-white truncate">
                        {APP_META[activeApp].label} — {contentTitle}
                      </span>

                      <span className="font-mono-tabular text-[10px] text-slate-400 shrink-0 hidden sm:block">
                        {diffCfg.badge.toUpperCase()}
                      </span>
                    </div>

                    {/* Window Scrollable Content */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                      {activeApp === 'workstation' && (
                        <div className="space-y-4">
                          {/* Recalc alert if any */}
                          {sharedState.recalcRequiredCodes.length > 0 && (
                            <div className="rounded-lg border border-rose-500/60 bg-rose-950/90 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-100">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                <span>
                                  <strong>Pending recalculation:</strong>{' '}
                                  {sharedState.recalcRequiredCodes.join(', ')} require re-verification.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={onCallEmergencyMeeting}
                                className="px-3 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Siren className="w-3.5 h-3.5" />
                                <span>Gates Room</span>
                              </button>
                            </div>
                          )}

                          {/* Phase selector 1..6 */}
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                            {MISSION_PHASES_6.map((ph) => {
                              const list = getMinigamesForRoleAndPhase(activeRole, ph.number);
                              const done = list.filter(
                                (m) => minigameStates[m.code]?.status === 'confirmado',
                              ).length;
                              const selected = selectedPhaseTab === ph.number;
                              return (
                                <button
                                  key={ph.number}
                                  type="button"
                                  onClick={() => setSelectedPhaseTab(ph.number)}
                                  className={`rounded-lg border px-2 py-2 text-left transition-colors cursor-pointer ${
                                    selected
                                      ? 'bg-sky-500/20 border-sky-400 text-white'
                                      : 'bg-[#080F1D] border-slate-800 text-slate-300 hover:border-slate-600'
                                  }`}
                                >
                                  <div className="flex items-center justify-between font-mono-tabular text-[10.5px] font-bold">
                                    <span className="text-sky-300">{ph.code}</span>
                                    <span>{done}/3</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {ph.title}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="rounded-lg border border-slate-800 bg-[#08101E] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-display font-bold text-white">
                                {currentPhaseMeta.code}: {currentPhaseMeta.title}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {currentPhaseMeta.focus}
                              </div>
                            </div>
                            {currentPhaseMeta.gateCode && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenMinigame(currentPhaseMeta.gateCode!);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 hover:bg-amber-500/30 text-amber-200 text-xs font-bold cursor-pointer"
                              >
                                Open Gate {currentPhaseMeta.gateCode}
                              </button>
                            )}
                          </div>

                          {/* Role Minigames for Selected Phase */}
                          <div className="space-y-2.5">
                            {rolePhaseMinigames.map((mg) => {
                              const st = minigameStates[mg.code];
                              const stMeta = STATUS_LABEL[st?.status ?? 'no_iniciado'];
                              return (
                                <div
                                  key={mg.code}
                                  className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    st?.dirtyNeedsRecalc
                                      ? 'bg-[#251016] border-rose-500/65'
                                      : st?.status === 'confirmado'
                                        ? 'bg-[#0C1D1A] border-emerald-500/45'
                                        : 'bg-[#0A1324] border-slate-700/80'
                                  }`}
                                >
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700"
                                        style={{ color: roleDef.colorHex }}
                                      >
                                        {mg.code}
                                      </span>
                                      <h4 className="font-display font-bold text-sm text-white">
                                        {mg.title}
                                      </h4>
                                      <span className={`px-2 py-0.5 rounded border text-[10px] font-mono-tabular ${stMeta.cls}`}>
                                        {stMeta.text}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-300">{mg.subtitle}</p>
                                    <p className="text-[11px] text-slate-400 leading-snug">
                                      {mg.mechanicSummary}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onOpenMinigame(mg.code);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shrink-0 cursor-pointer"
                                  >
                                    Open Console {mg.code}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {activeApp === 'telemetry' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="rounded-lg border border-slate-800 bg-[#080F1D] p-2.5">
                              <div className="text-[10px] text-slate-400">Total Mass</div>
                              <div className="font-mono-tabular text-sm font-bold text-white">
                                {sharedState.masaVolumen.totalMassKg.toLocaleString()} kg
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-800 bg-[#080F1D] p-2.5">
                              <div className="text-[10px] text-slate-400">Power Margin</div>
                              <div className="font-mono-tabular text-sm font-bold text-sky-400">
                                +{sharedState.energia.netMarginW} W
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-800 bg-[#080F1D] p-2.5">
                              <div className="text-[10px] text-slate-400">Science / Δv</div>
                              <div className="font-mono-tabular text-sm font-bold text-emerald-400">
                                {sharedState.objetivos.scienceScore} pts · {sharedState.riesgoEstado.deltaVMps} m/s
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-800 bg-[#080F1D] p-2.5">
                              <div className="text-[10px] text-slate-400">3D Hangar</div>
                              <div className="font-mono-tabular text-sm font-bold text-amber-300">
                                {installedModuleIds.length}/12 Modules
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-xs font-display font-bold text-white">
                              Cross-Domain Annex C Checklist
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {sharedState.anexoCChecks.map((ax) => (
                                <div
                                  key={ax.id}
                                  className={`rounded-lg border p-2.5 text-xs ${
                                    ax.passed
                                      ? 'bg-[#0C1D1A] border-emerald-500/40 text-emerald-200'
                                      : 'bg-[#201016] border-rose-500/50 text-rose-200'
                                  }`}
                                >
                                  <div className="font-semibold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>{ax.label}</span>
                                  </div>
                                  <div className="text-[11px] font-mono-tabular opacity-85 mt-0.5">
                                    {ax.detail}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-xs font-display font-bold text-white">
                              3D Modules &amp; Fragile Cargo
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                              {ROCKET_MODULES.map((mod) => {
                                const inst = installedModuleIds.includes(mod.id);
                                return (
                                  <div
                                    key={mod.id}
                                    className={`px-2.5 py-1.5 rounded border ${
                                      inst
                                        ? 'bg-[#0C1D1A] border-emerald-500/40 text-emerald-200'
                                        : 'bg-[#090F1C] border-slate-800 text-slate-500'
                                    }`}
                                  >
                                    {mod.name}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Fragile cargo delivered to Hangar:{' '}
                              {CARGO_MODULES.filter((c) => cargoStates[c.id]?.delivered).length}/
                              {CARGO_MODULES.length} (in {ROOM_MAP[roleDef.roomId].shortLabel})
                            </div>
                          </div>
                        </div>
                      )}

                      {activeApp === 'notes' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {contentDataPoints.map((dp) => (
                              <div
                                key={dp.label}
                                className="rounded-lg border border-slate-800 bg-[#080F1D] px-3 py-2 flex items-center justify-between text-xs"
                              >
                                <span className="text-slate-400">{dp.label}</span>
                                <span className="font-mono-tabular font-bold text-white">
                                  {dp.value}
                                </span>
                              </div>
                            ))}
                          </div>

                          <form onSubmit={handleAddNote} className="flex gap-2">
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Add a quick engineering note to the station..."
                              className="flex-1 px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                            />
                            <button
                              type="submit"
                              className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                          </form>

                          <div className="space-y-1.5">
                            {stationNotes.map((note) => (
                              <button
                                key={note.id}
                                type="button"
                                onClick={() => onToggleWhiteboardNote(interactableId, note.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer ${
                                  note.checked
                                    ? 'bg-[#0C1D1A] border-emerald-500/40 text-emerald-300 line-through'
                                    : 'bg-[#080F1D] border-slate-800 text-slate-200'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>{note.text}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* macOS Floating Dock */}
              <div className="relative z-20 pb-2.5 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto px-3 py-1.5 rounded-2xl bg-[#0B1222]/85 border border-white/15 shadow-2xl flex items-center gap-2">
                  {(
                    [
                      { id: 'workstation', label: 'Workstation', icon: Monitor, color: '#38bdf8' },
                      { id: 'telemetry', label: 'Annex C', icon: Activity, color: '#22c55e' },
                      { id: 'notes', label: 'Notes', icon: FileText, color: '#f59e0b' },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = activeApp === item.id && isWindowVisible;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => launchOrFocusApp(item.id)}
                        title={item.label}
                        className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-transform hover:-translate-y-0.5 cursor-pointer ${
                          active
                            ? 'bg-white/15 border-white/30 text-white'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" style={{ color: item.color }} />
                        <span className="hidden sm:inline">{item.label}</span>
                      </button>
                    );
                  })}
                  <div className="w-px h-5 bg-white/15 mx-0.5" />
                  <button
                    type="button"
                    onClick={onClose}
                    title="Step away from desk"
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 hover:bg-rose-500/25 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Exit</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
