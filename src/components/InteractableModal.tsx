import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileText,
  Flame,
  Orbit,
  Play,
  Plus,
  Radio,
  Send,
  Siren,
  X,
  XCircle,
} from 'lucide-react';
import {
  MINIGAMES_72,
  MINIGAME_MAP,
  MISSION_PHASES_6,
  PHASE_6_MAP,
  getMinigamesForPhase,
} from '../data/minigamesData';
import {
  DIFFICULTY_CONFIGS,
  INTERACTABLES_MAP,
  ROCKET_MODULES,
  ROLE_MANUAL_GUIDES,
  ROLE_MAP,
  ROLES,
  ROOM_MAP,
  TECHNICAL_GLOSSARY,
} from '../data/missionData';
import type {
  ActiveConflict,
  CargoModuleState,
  DepartmentMessage,
  DifficultyId,
  InteractableId,
  MinigameDefinition,
  MinigameInstanceState,
  MinigameWorkflowStatus,
  MissionPhaseNumber,
  MissionResources,
  RoleId,
  SharedMissionState,
} from '../types/mission';
import { soundFx } from '../utils/soundFx';
import { ComponentDossierModal } from './ComponentDossierModal';
import { MacOsWorkstationModal } from './MacOsWorkstationModal';

export interface WhiteboardNote {
  id: string;
  text: string;
  checked: boolean;
}

interface InteractableModalProps {
  interactableId: InteractableId;
  activeRole: RoleId;
  difficulty: DifficultyId;
  currentPhase: MissionPhaseNumber;
  installedModuleIds: string[];
  sharedState: SharedMissionState;
  minigameStates: Record<string, MinigameInstanceState>;
  activeConflicts: ActiveConflict[];
  emergencyAlert: boolean;
  resources: MissionResources;
  cargoStates: Record<string, CargoModuleState>;
  departmentMessages: DepartmentMessage[];
  whiteboardNotes: Record<string, WhiteboardNote[]>;
  explodedView: boolean;
  isLaunching: boolean;
  onOpenMinigame: (code: string) => void;
  onCallEmergencyMeeting: () => void;
  onCancelRedAlert: () => void;
  onSendMessage: (toRole: RoleId | 'all', text: string) => void;
  onAddWhiteboardNote: (boardId: InteractableId, text: string) => void;
  onToggleWhiteboardNote: (boardId: InteractableId, noteId: string) => void;
  onToggleExploded: () => void;
  onTriggerLaunch: () => void;
  onResetLaunch: () => void;
  onOpenCustomLab?: (lab: 'orbital-wb' | 'thermal-lab' | 'budget-desk') => void;
  onClose: () => void;
}

const STATUS_BADGE: Record<MinigameWorkflowStatus, { label: string; cls: string }> = {
  no_iniciado: { label: 'Not Started', cls: 'bg-slate-800 text-slate-300 border-slate-600' },
  en_progreso: { label: 'In Progress', cls: 'bg-sky-900/70 text-sky-200 border-sky-500/60' },
  pendiente_revision: {
    label: 'In Review',
    cls: 'bg-amber-900/70 text-amber-200 border-amber-500/60',
  },
  validado: { label: 'Validated', cls: 'bg-teal-900/70 text-teal-200 border-teal-500/60' },
  requiere_cambios: {
    label: 'Recalculation',
    cls: 'bg-rose-900/80 text-rose-200 border-rose-500/70',
  },
  confirmado: {
    label: 'Confirmed',
    cls: 'bg-emerald-900/70 text-emerald-200 border-emerald-500/60',
  },
};

export function InteractableModal({
  interactableId,
  activeRole,
  difficulty,
  currentPhase,
  installedModuleIds,
  sharedState,
  minigameStates,
  activeConflicts,
  emergencyAlert,
  resources,
  cargoStates,
  departmentMessages,
  whiteboardNotes,
  explodedView,
  isLaunching,
  onOpenMinigame,
  onCallEmergencyMeeting,
  onCancelRedAlert,
  onSendMessage,
  onAddWhiteboardNote,
  onToggleWhiteboardNote,
  onToggleExploded,
  onTriggerLaunch,
  onResetLaunch,
  onOpenCustomLab,
  onClose,
}: InteractableModalProps) {
  const [msgTarget, setMsgTarget] = useState<RoleId | 'all'>('all');
  const [msgDraft, setMsgDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [drawerTab, setDrawerTab] = useState<'resumen' | 'misiones' | 'glosario'>('resumen');
  const [roadmapPhaseFilter, setRoadmapPhaseFilter] = useState<MissionPhaseNumber | 'all'>(
    currentPhase,
  );

  useEffect(() => {
    setMsgDraft('');
    setNoteDraft('');
    setDrawerTab('resumen');
    setRoadmapPhaseFilter(currentPhase);
  }, [interactableId, currentPhase]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const content = INTERACTABLES_MAP[interactableId];
  const roomDef = ROOM_MAP[content.roomId];
  const diffCfg = DIFFICULTY_CONFIGS[difficulty];

  const getStationMinigames = (
    stationKind: MinigameDefinition['stationKind'],
    ownerRole?: RoleId,
  ): MinigameDefinition[] => {
    const targetRole = ownerRole ?? activeRole;
    const inCurrentPhase = MINIGAMES_72.filter(
      (m) =>
        m.stationKind === stationKind &&
        m.phaseNumber === currentPhase &&
        (stationKind === 'schedule' || stationKind === 'meeting-holo' || m.roleId === targetRole),
    );
    if (inCurrentPhase.length > 0) return inCurrentPhase;
    return MINIGAMES_72.filter(
      (m) =>
        m.stationKind === stationKind &&
        (stationKind === 'schedule' || stationKind === 'meeting-holo' || m.roleId === targetRole),
    ).slice(0, 4);
  };

  const handleSendComms = (e: FormEvent) => {
    e.preventDefault();
    const clean = msgDraft.trim();
    if (!clean) return;
    soundFx.playKeyClick();
    onSendMessage(msgTarget, clean);
    setMsgDraft('');
  };

  const handleAddNote = (e: FormEvent) => {
    e.preventDefault();
    const clean = noteDraft.trim();
    if (!clean) return;
    onAddWhiteboardNote(interactableId, clean);
    setNoteDraft('');
  };

  const renderStationMinigameCards = (
    list: MinigameDefinition[],
    lightTheme = false,
  ) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-2">
        <div
          className={`text-[11px] font-mono-tabular font-bold uppercase tracking-wider ${
            lightTheme ? 'text-sky-800' : 'text-sky-400'
          }`}
        >
          MISSIONS AVAILABLE AT THIS STATION ({PHASE_6_MAP[currentPhase].code})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {list.map((mg) => {
            const st = minigameStates[mg.code];
            const badge = STATUS_BADGE[st?.status ?? 'no_iniciado'];
            const rDef = ROLE_MAP[mg.roleId];
            return (
              <div
                key={mg.code}
                className={`rounded-lg border p-3 flex flex-col justify-between gap-2 ${
                  lightTheme
                    ? 'bg-white border-stone-300 text-slate-900'
                    : 'bg-[#091224] border-slate-700/80 text-white'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="font-mono-tabular text-xs font-bold"
                      style={{ color: rDef.colorHex }}
                    >
                      {mg.code} · P{mg.phaseNumber}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-mono-tabular ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="font-display font-bold text-xs">{mg.title}</div>
                  <p className={`text-[11px] leading-snug ${lightTheme ? 'text-slate-600' : 'text-slate-400'}`}>
                    {mg.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playKeyClick();
                    onClose();
                    onOpenMinigame(mg.code);
                  }}
                  className="w-full py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Open {mg.code}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // =========================================================================
  // MODE 1: DRAWER -> HANDWRITTEN LINED NOTEBOOK PAPER
  // =========================================================================
  if (content.kind === 'drawer') {
    const drawerRole: RoleId = roomDef.ownerRole ?? activeRole;
    const roleDef = ROLE_MAP[drawerRole];
    const roleGuide = ROLE_MANUAL_GUIDES[drawerRole];
    const roleAllMinigames = MINIGAMES_72.filter((m) => m.roleId === drawerRole);
    const filteredRoleMinigames =
      roadmapPhaseFilter === 'all'
        ? roleAllMinigames
        : roleAllMinigames.filter((m) => m.phaseNumber === roadmapPhaseFilter);
    const drawerStationGames = getStationMinigames('drawer', drawerRole);

    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 pt-20 bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-3xl handwritten-paper text-slate-900 border-2 border-stone-400 rounded-xl shadow-2xl overflow-hidden max-h-[84vh] flex flex-col">
          <div className="pl-14 pr-5 py-3.5 bg-[#f2ead6]/95 border-b border-stone-300 flex flex-wrap items-start justify-between gap-3 shrink-0">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-mono-tabular font-bold uppercase tracking-wider text-stone-600">
                <FileText className="w-3.5 h-3.5 text-red-700 shrink-0" />
                <span>Role Field Manual · {roleDef.name}</span>
              </div>
              <h2 className="font-handwriting text-2xl sm:text-3xl font-bold text-slate-950 leading-none">
                {content.title}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-block px-2 py-0.5 border-2 border-red-700 text-red-700 font-mono-tabular text-[10px] font-bold tracking-widest uppercase -rotate-2">
                6 PHASES
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-stone-400 bg-white hover:bg-stone-100 text-slate-900 text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Back to Lab</span>
              </button>
            </div>
          </div>

          <nav className="pl-14 pr-5 py-2 bg-[#ebe1c9]/95 border-b border-stone-300 grid grid-cols-3 gap-2 shrink-0">
            {(
              [
                { id: 'resumen', label: 'Role Briefing' },
                { id: 'misiones', label: 'Your Missions' },
                { id: 'glosario', label: 'Annex C Glossary' },
              ] as const
            ).map((tab) => {
              const selected = drawerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    soundFx.playPaperRustle();
                    setDrawerTab(tab.id);
                  }}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer truncate border ${
                    selected
                      ? 'bg-[#0F172A] text-white border-slate-900 shadow'
                      : 'bg-white/80 text-stone-700 border-stone-300 hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="pl-14 pr-6 py-4 overflow-y-auto space-y-4">
            {renderStationMinigameCards(drawerStationGames, true)}

            {drawerTab === 'resumen' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-stone-300/90 bg-white/75 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: roleDef.colorHex }}
                      />
                      <span className="font-handwriting font-bold text-xl text-slate-950">
                        {roleDef.name} — {roleGuide.briefingSubtitle}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono-tabular font-semibold px-2 py-0.5 rounded bg-stone-200 text-stone-800">
                      Destination: {diffCfg.targetName}
                    </span>
                  </div>
                  <p className="font-handwriting text-lg text-slate-900 leading-snug">
                    {roleGuide.globalResponsibility}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="rounded-lg border border-stone-300/90 bg-white/70 p-3.5 space-y-2">
                    <h3 className="text-xs font-display font-bold uppercase tracking-wider text-slate-900">
                      Why the team relies on you
                    </h3>
                    <ul className="space-y-1.5">
                      {roleGuide.whyTeamNeedsYou.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 font-handwriting text-lg text-slate-800 leading-tight"
                        >
                          <span
                            className="w-2 h-2 rounded-xs mt-2 shrink-0"
                            style={{ backgroundColor: roleDef.colorHex }}
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-stone-300/90 bg-white/70 p-3.5 space-y-2">
                    <h3 className="text-xs font-display font-bold uppercase tracking-wider text-slate-900">
                      Gates Room Coordination
                    </h3>
                    <p className="font-handwriting text-lg text-slate-800 leading-tight">
                      {roleGuide.meetingCoordination}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {drawerTab === 'misiones' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRoadmapPhaseFilter('all')}
                    className={`px-2 py-1 rounded text-xs font-semibold border cursor-pointer ${
                      roadmapPhaseFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-stone-700 border-stone-300'
                    }`}
                  >
                    All (18)
                  </button>
                  {MISSION_PHASES_6.map((ph) => (
                    <button
                      key={ph.number}
                      type="button"
                      onClick={() => setRoadmapPhaseFilter(ph.number)}
                      className={`px-2 py-1 rounded text-xs font-semibold border cursor-pointer ${
                        roadmapPhaseFilter === ph.number
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-stone-700 border-stone-300'
                      }`}
                    >
                      P{ph.number}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {filteredRoleMinigames.map((mg) => {
                    const st = minigameStates[mg.code];
                    const confirmed = st?.status === 'confirmado';
                    return (
                      <div
                        key={mg.code}
                        className="rounded-lg border border-stone-300 bg-white/90 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono-tabular font-bold text-slate-900">
                              {mg.code} · PHASE {mg.phaseNumber}
                            </span>
                            <span className="font-bold text-slate-950">{mg.title}</span>
                          </div>
                          <div className="text-[11px] text-stone-600">{mg.subtitle}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenMinigame(mg.code);
                          }}
                          className={`px-3 py-1 rounded text-xs font-bold cursor-pointer ${
                            confirmed
                              ? 'bg-emerald-600 text-white'
                              : 'bg-sky-600 hover:bg-sky-500 text-white'
                          }`}
                        >
                          {confirmed ? 'Review' : 'Play'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {drawerTab === 'glosario' && (
              <div className="space-y-2.5">
                {TECHNICAL_GLOSSARY.map((entry) => (
                  <div
                    key={entry.term}
                    className="rounded-lg border border-stone-300 bg-white/85 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-handwriting font-bold text-xl text-slate-950">
                        {entry.term}
                      </span>
                      <span className="font-mono-tabular text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {entry.unitOrRange}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">{entry.explanation}</p>
                    <p className="text-[11px] text-stone-700 font-semibold">
                      {entry.whyVitalForMoonReturn}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODE 2: HANGAR SCHEDULE -> 6-PHASE INTERACTIVE MASTER GANTT CHART
  // =========================================================================
  if (content.kind === 'schedule') {
    const ganttMinigames = ['G12', 'C33', 'G32', 'C43', 'G42'].map((c) => MINIGAME_MAP[c]);
    const totalConfirmed = MINIGAMES_72.filter(
      (m) => minigameStates[m.code]?.status === 'confirmado',
    ).length;

    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 pt-20 bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-4xl bg-[#F8FAFC] text-slate-900 border-[8px] border-slate-500 rounded-xl shadow-2xl overflow-hidden max-h-[84vh] flex flex-col">
          <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-300 flex items-start justify-between gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 mb-0.5">
                <CalendarRange className="w-4 h-4 shrink-0" />
                <span>6-Phase Master Schedule · {diffCfg.targetName}</span>
              </div>
              <h2 className="font-display text-lg font-bold text-slate-950">{content.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Schedule"
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-lg border border-slate-300 bg-white p-2.5">
                <div className="text-[10.5px] font-semibold uppercase text-slate-500">Active Phase</div>
                <div className="font-mono-tabular text-base font-bold text-sky-700">
                  Phase {currentPhase} / 6
                </div>
              </div>
              <div className="rounded-lg border border-slate-300 bg-white p-2.5">
                <div className="text-[10.5px] font-semibold uppercase text-slate-500">72 Progress</div>
                <div className="font-mono-tabular text-base font-bold text-emerald-700">
                  {totalConfirmed} / 72
                </div>
              </div>
              <div className="rounded-lg border border-slate-300 bg-white p-2.5">
                <div className="text-[10.5px] font-semibold uppercase text-slate-500">Critical Slack</div>
                <div className="font-mono-tabular text-base font-bold text-slate-900">
                  {sharedState.presupuestoCalendario.criticalSlackDays} days
                </div>
              </div>
              <div className="rounded-lg border border-slate-300 bg-white p-2.5">
                <div className="text-[10.5px] font-semibold uppercase text-slate-500">Recalculations</div>
                <div
                  className={`font-mono-tabular text-base font-bold ${
                    sharedState.recalcRequiredCodes.length > 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {sharedState.recalcRequiredCodes.length} Pending
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-300 bg-white divide-y divide-slate-200">
              {MISSION_PHASES_6.map((ph) => {
                const list = getMinigamesForPhase(ph.number);
                const done = list.filter(
                  (m) => minigameStates[m.code]?.status === 'confirmado',
                ).length;
                const isCurrent = ph.number === currentPhase;
                const gateDone = ph.gateCode
                  ? minigameStates[ph.gateCode]?.status === 'confirmado'
                  : true;
                return (
                  <div
                    key={ph.number}
                    className={`px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
                      isCurrent ? 'bg-sky-50' : 'bg-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono-tabular text-[10px] font-bold ${
                            isCurrent
                              ? 'bg-sky-600 text-white'
                              : done === 12
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {ph.code}
                        </span>
                        <span className="font-bold text-slate-950">{ph.title}</span>
                        {ph.gateCode && (
                          <span
                            className={`font-mono-tabular text-[10px] font-bold ${
                              gateDone ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            Gate {ph.gateCode} {gateDone ? 'OK' : 'Pending'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{ph.focus}</div>
                    </div>

                    <div className="font-mono-tabular font-bold text-slate-800">
                      {done}/12 · {ph.targetDays}d
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Schedule Planning Missions (Gantt)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {ganttMinigames.map((mg) => (
                  <button
                    key={mg.code}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMinigame(mg.code);
                    }}
                    className="text-left rounded-lg border border-slate-300 bg-white hover:border-sky-500 p-2.5 cursor-pointer"
                  >
                    <div className="text-xs font-mono-tabular font-bold text-sky-700">
                      {mg.code} · Phase {mg.phaseNumber}
                    </div>
                    <div className="text-xs font-bold text-slate-900">{mg.title}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODE 3: WHITEBOARD -> SHARED FORMULAS + NOTES + STATION MINIGAMES
  // =========================================================================
  if (content.kind === 'whiteboard') {
    const notes = whiteboardNotes[interactableId] ?? [];
    const ownerRole = roomDef.ownerRole ?? activeRole;
    const wbGames = getStationMinigames('whiteboard', ownerRole);

    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 pt-20 bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-3xl bg-[#F8FAFC] text-slate-900 border-[8px] border-slate-400 rounded-xl shadow-2xl overflow-hidden max-h-[82vh] flex flex-col">
          <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-300 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-0.5">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: roomDef.accentColorHex }}
                />
                <span>{content.subtitle}</span>
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900">{content.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close whiteboard"
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {onOpenCustomLab && (interactableId === 'plt-whiteboard' || interactableId === 'sys-whiteboard') && (
              <div className="rounded-xl border border-sky-500/40 bg-sky-950/15 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-display font-bold text-sky-900">
                    Interactive Orbital Trajectory &amp; 3D Hologram Whiteboard
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Drag Apogee ($r_a$) &amp; Perigee ($r_p$), evaluate Kepler / Tsiolkovsky equations, and project into 3D.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCustomLab('orbital-wb');
                  }}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Orbit className="w-4 h-4" />
                  <span>Open Interactive Orbital Whiteboard</span>
                </button>
              </div>
            )}

            {onOpenCustomLab && interactableId === 'fin-whiteboard' && (
              <div className="rounded-xl border border-amber-500/45 bg-amber-50 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-display font-bold text-amber-950">
                    Finance &amp; Contracts Interactive Budget Desk
                  </div>
                  <p className="text-[11px] text-amber-900/80">
                    Review itemized contractor invoices with NASA-CALC MC-24 and allocate treasury cash trays.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCustomLab('budget-desk');
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Open Budget Allocation Desk</span>
                </button>
              </div>
            )}

            {renderStationMinigameCards(wbGames, true)}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-300 bg-white p-3.5 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Campaign Equations &amp; Tolerances
                </div>
                {content.formulas && (
                  <ul className="space-y-1">
                    {content.formulas.map((f, i) => (
                      <li
                        key={i}
                        className="font-mono-tabular text-xs font-semibold text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded border border-blue-200"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-slate-300 bg-white p-3.5 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Reference Data
                </div>
                {content.dataPoints.map((dp) => (
                  <div
                    key={dp.label}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200 text-xs"
                  >
                    <span className="text-slate-600">{dp.label}</span>
                    <span className="font-mono-tabular font-bold text-slate-900">{dp.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write agreement or parameter on the whiteboard..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            </form>

            <div className="space-y-1.5">
              {notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onToggleWhiteboardNote(interactableId, n.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer ${
                    n.checked
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800 line-through'
                      : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{n.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODE 4: COMPUTER WORKSTATION -> MACOS STUDIO DISPLAY
  // =========================================================================
  if (content.kind === 'computer') {
    return (
      <MacOsWorkstationModal
        interactableId={interactableId}
        activeRole={activeRole}
        difficulty={difficulty}
        currentPhase={currentPhase}
        installedModuleIds={installedModuleIds}
        sharedState={sharedState}
        minigameStates={minigameStates}
        cargoStates={cargoStates}
        whiteboardNotes={whiteboardNotes}
        onOpenMinigame={onOpenMinigame}
        onCallEmergencyMeeting={onCallEmergencyMeeting}
        onAddWhiteboardNote={onAddWhiteboardNote}
        onToggleWhiteboardNote={onToggleWhiteboardNote}
        contentTitle={content.title}
        contentSubtitle={content.subtitle}
        contentSummary={content.summary}
        contentDataPoints={content.dataPoints}
        onClose={onClose}
      />
    );
  }

  // =========================================================================
  // MODE 5: HANGAR ROCKET PART -> 3D CAD STUDIO INSPECTOR DOSSIER
  // =========================================================================
  if (content.kind === 'hangar-part') {
    return (
      <ComponentDossierModal
        interactableId={interactableId}
        activeRole={activeRole}
        difficulty={difficulty}
        currentPhase={currentPhase}
        installedModuleIds={installedModuleIds}
        activeConflicts={activeConflicts}
        cargoStates={cargoStates}
        resources={resources}
        explodedView={explodedView}
        isLaunching={isLaunching}
        onToggleExploded={onToggleExploded}
        onTriggerLaunch={onTriggerLaunch}
        onResetLaunch={onResetLaunch}
        onCallEmergencyMeeting={onCallEmergencyMeeting}
        onClose={onClose}
      />
    );
  }

  // =========================================================================
  // MODE 6: MEETING ROOM HOLOGRAPHIC TABLE -> GATES & RECALC & ANEXO C
  // =========================================================================
  if (content.kind === 'meeting-holo') {
    const gateCodes = ['G13', 'G23', 'G43', 'G53'];
    const recalcCodes = sharedState.recalcRequiredCodes;

    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 pt-20 bg-black/55"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-4xl bg-[#0B111E] border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden max-h-[84vh] flex flex-col text-slate-100">
          <div className="px-5 py-4 bg-[#08101E] border-b border-slate-800 flex items-start justify-between gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono-tabular uppercase tracking-wider text-cyan-400 mb-0.5">
                <Siren className="w-3.5 h-3.5" />
                <span>Holographic Cooperative Decision Room</span>
              </div>
              <h2 className="font-display text-lg font-bold text-white">{content.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              {emergencyAlert && (
                <button
                  type="button"
                  onClick={onCancelRedAlert}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-100 text-rose-950 text-xs font-bold cursor-pointer"
                >
                  Deactivate Alert
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close holographic table"
                className="p-1.5 rounded-lg border border-slate-700 bg-[#101829] hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-5 overflow-y-auto space-y-5">
            {/* 4 Cooperative Gates */}
            <div className="space-y-2">
              <div className="text-xs font-display font-bold text-white uppercase tracking-wider">
                4-Role Decision Gates (G13, G23, G43, G53)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {gateCodes.map((gCode) => {
                  const def = MINIGAME_MAP[gCode];
                  const st = minigameStates[gCode];
                  const approved = st?.status === 'confirmado';
                  return (
                    <div
                      key={gCode}
                      className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
                        approved
                          ? 'bg-[#0C1D1A] border-emerald-500/50'
                          : 'bg-[#10172A] border-amber-500/45'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono-tabular font-bold text-amber-300">
                          {gCode} · PHASE {def.phaseNumber}
                        </div>
                        <div className="text-sm font-display font-bold text-white truncate">
                          {def.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{def.subtitle}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenMinigame(gCode);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer ${
                          approved
                            ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        }`}
                      >
                        {approved ? 'Approved' : 'Vote Gate'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recalc queue */}
            {recalcCodes.length > 0 && (
              <div className="rounded-xl border border-rose-500/60 bg-rose-950/35 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Pending Recalculations from Modified Dependencies ({recalcCodes.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recalcCodes.map((rCode) => (
                    <button
                      key={rCode}
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenMinigame(rCode);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Recalculate {rCode}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Annex C live checklist */}
            <div className="space-y-2">
              <div className="text-xs font-display font-bold text-white uppercase tracking-wider">
                Global Annex C Audit ({sharedState.anexoCChecks.filter((a) => a.passed).length}/6)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sharedState.anexoCChecks.map((ax) => (
                  <div
                    key={ax.id}
                    className={`rounded-lg border px-3 py-2 flex items-start justify-between gap-2 ${
                      ax.passed
                        ? 'bg-[#0C1D1A] border-emerald-500/40'
                        : 'bg-[#1F1016] border-rose-500/50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{ax.label}</div>
                      <div className="text-[11px] font-mono-tabular text-slate-300">
                        {ax.detail}
                      </div>
                    </div>
                    {ax.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODE 7: TEST BENCH / COMMS / MANUALS
  // =========================================================================
  const ownerRole = roomDef.ownerRole ?? activeRole;
  const stationGames =
    content.kind === 'bench'
      ? getStationMinigames('bench', ownerRole)
      : content.kind === 'comms'
        ? getStationMinigames('comms', ownerRole)
        : [];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 pt-20 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl bg-[#0B111E] border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-[82vh] flex flex-col">
        <div className="px-5 py-4 bg-[#080D18] border-b border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono-tabular uppercase tracking-wider text-sky-400 mb-1">
              {content.kind === 'comms' ? (
                <Radio className="w-3.5 h-3.5" />
              ) : content.kind === 'manuals' ? (
                <BookOpen className="w-3.5 h-3.5" />
              ) : (
                <Activity className="w-3.5 h-3.5" />
              )}
              <span>{content.subtitle}</span>
            </div>
            <h2 className="font-display text-lg font-bold text-white">{content.title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="p-1.5 rounded-lg border border-slate-700 bg-[#101829] hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {onOpenCustomLab && (interactableId === 'sci-bench' || interactableId === 'sys-bench') && (
            <div className="rounded-xl border border-orange-500/45 bg-[#1C0F08] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-orange-400 font-bold">
                  Material Stress Simulation
                </div>
                <div className="text-sm font-display font-bold text-white mt-0.5">
                  Thermal Stress &amp; Material Lab (Laser Blowtorch)
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Stress-test unknown heat shield samples with the laser blowtorch and cross-reference datasheets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCustomLab('thermal-lab');
                }}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                <span>Launch Laser Blowtorch Rig</span>
              </button>
            </div>
          )}

          {onOpenCustomLab && interactableId === 'plt-bench' && (
            <div className="rounded-xl border border-cyan-500/45 bg-[#081524] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-cyan-400 font-bold">
                  3D Holographic Trajectory Table
                </div>
                <div className="text-sm font-display font-bold text-white mt-0.5">
                  Orbital Whiteboard &amp; Trajectory Projector
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Edit Apogee/Perigee orbital parameters and project live Kepler transfer orbits onto this table.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCustomLab('orbital-wb');
                }}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Orbit className="w-4 h-4" />
                <span>Open Orbital Whiteboard</span>
              </button>
            </div>
          )}

          {onOpenCustomLab && interactableId === 'fin-bench' && (
            <div className="rounded-xl border border-amber-500/45 bg-[#1A1407] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-amber-400 font-bold">
                  Department Treasury Workbench
                </div>
                <div className="text-sm font-display font-bold text-white mt-0.5">
                  Budget Allocation Desk &amp; NASA-CALC MC-24
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Audit contractor invoices across DEPT-01..DEPT-04 and distribute cash stacks into department trays.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCustomLab('budget-desk');
                }}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                <span>Open Budget Allocation Desk</span>
              </button>
            </div>
          )}

          {renderStationMinigameCards(stationGames, false)}

          <p className="text-sm text-slate-300 leading-relaxed">{content.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {content.dataPoints.map((dp) => (
              <div
                key={dp.label}
                className="rounded-lg border border-slate-800 bg-[#080D17] px-3 py-2.5"
              >
                <div className="text-[11px] text-slate-400">{dp.label}</div>
                <div className="font-mono-tabular text-xs font-semibold text-white mt-0.5">
                  {dp.value}
                </div>
              </div>
            ))}
          </div>

          {content.kind === 'comms' && (
            <div className="pt-2 space-y-3 border-t border-slate-800">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-300">
                Interdepartmental Coordination Channel
              </h3>

              <form onSubmit={handleSendComms} className="flex flex-col sm:flex-row gap-2">
                <select
                  value={msgTarget}
                  onChange={(e) => setMsgTarget(e.target.value as RoleId | 'all')}
                  aria-label="Recipient"
                  className="px-3 py-2 rounded-lg bg-[#080D17] border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="all">All Divisions</option>
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={msgDraft}
                  onChange={(e) => setMsgDraft(e.target.value)}
                  placeholder="Send alert about mass, link, budget, or Gate..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[#080D17] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Transmit</span>
                </button>
              </form>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {departmentMessages.map((msg) => {
                  const fromColor = ROLE_MAP[msg.fromRole].colorHex;
                  return (
                    <div
                      key={msg.id}
                      className="rounded-lg border border-slate-800 bg-[#080D17] px-3 py-2 space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold" style={{ color: fromColor }}>
                          {msg.senderName} → {msg.toRole === 'all' ? 'All' : ROLE_MAP[msg.toRole].shortName}
                        </span>
                        <span className="font-mono-tabular text-slate-500">{msg.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-200">{msg.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {content.kind === 'manuals' && content.manualSections && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Reference Standards · {ROCKET_MODULES.length} 3D Modules</span>
              </div>
              {content.manualSections.map((sec) => (
                <div
                  key={sec.code}
                  className="rounded-lg border border-slate-800 bg-[#080D17] p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tabular text-[11px] font-bold text-sky-400">
                      {sec.code}
                    </span>
                    <h4 className="font-display text-xs font-semibold text-white">
                      {sec.heading}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{sec.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
