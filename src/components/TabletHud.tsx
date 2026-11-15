import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BatteryFull,
  Bot,
  ClipboardList,
  Compass,
  LayoutGrid,
  MapPin,
  Package,
  Radio,
  Send,
  Siren,
  Sparkles,
  Tablet,
  Wifi,
  X,
} from 'lucide-react';
import {
  MINIGAMES_72,
  MINIGAME_MAP,
  MISSION_PHASES_6,
  PHASE_6_MAP,
  getMinigamesForPhase,
  getMinigamesForRoleAndPhase,
} from '../data/minigamesData';
import {
  CARGO_MODULES,
  DIFFICULTY_CONFIGS,
  ROCKET_MODULES,
  ROLES,
  ROLE_MAP,
  ROOM_MAP,
} from '../data/missionData';
import type {
  ActiveConflict,
  BudgetAllocationSummary,
  CargoModuleState,
  DifficultyId,
  MinigameInstanceState,
  MinigameWorkflowStatus,
  MissionPhaseNumber,
  MissionResources,
  OrbitalTrajectoryConfig,
  RoleId,
  RoomId,
  SharedMissionState,
  ThermalReportSummary,
} from '../types/mission';
import {
  ARIA_QUICK_PROMPTS,
  buildAriaGreeting,
  buildAriaResponse,
  type AriaChatMessage,
} from '../utils/ariaCopilot';
import { soundFx } from '../utils/soundFx';
import { AriaRobotAvatar, AriaSquircleIcon } from './AriaRobotAvatar';

type IPadAppId = 'home' | 'tasks' | 'track' | 'aria' | 'alert';

interface TabletHudProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeRole: RoleId;
  activeRoom: RoomId;
  difficulty: DifficultyId;
  currentPhase: MissionPhaseNumber;
  soloTestMode: boolean;
  resources: MissionResources;
  sharedState: SharedMissionState;
  minigameStates: Record<string, MinigameInstanceState>;
  installedModuleIds: string[];
  activeConflicts: ActiveConflict[];
  emergencyAlert: boolean;
  cargoStates?: Record<string, CargoModuleState>;
  explodedView: boolean;
  isLaunching: boolean;
  onOpenMinigame: (code: string) => void;
  onAdvancePhase: (targetPhase?: MissionPhaseNumber) => void;
  onSelectRoom: (roomId: RoomId) => void;
  onToggleExploded: () => void;
  onTriggerLaunch: () => void;
  onResetLaunch: () => void;
  onCallEmergencyMeeting: () => void;
  onCancelRedAlert: () => void;
  orbitalTrajectory?: OrbitalTrajectoryConfig | null;
  thermalReport?: ThermalReportSummary | null;
  budgetAllocation?: BudgetAllocationSummary | null;
}

const STATUS_SHORT: Record<MinigameWorkflowStatus, { label: string; cls: string }> = {
  no_iniciado: { label: 'Not Started', cls: 'text-slate-400 border-slate-700 bg-slate-900' },
  en_progreso: { label: 'In Progress', cls: 'text-sky-300 border-sky-500/50 bg-sky-950/60' },
  pendiente_revision: {
    label: 'In Review',
    cls: 'text-amber-300 border-amber-500/50 bg-amber-950/60',
  },
  validado: { label: 'Validated', cls: 'text-teal-300 border-teal-500/50 bg-teal-950/60' },
  requiere_cambios: {
    label: 'Recalculate',
    cls: 'text-rose-300 border-rose-500/60 bg-rose-950/70',
  },
  confirmado: {
    label: 'Confirmed',
    cls: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60',
  },
};

const STATION_KIND_LABEL: Record<string, string> = {
  computer: 'Workstation',
  whiteboard: 'Whiteboard',
  drawer: 'Field Drawer',
  bench: 'Test Bench',
  comms: 'Comms Desk',
  schedule: 'Master Schedule',
  'meeting-holo': 'Gates Holo Table',
};

export function TabletHud({
  isOpen,
  onOpenChange,
  activeRole,
  activeRoom,
  difficulty,
  currentPhase,
  soloTestMode,
  sharedState,
  minigameStates,
  installedModuleIds,
  activeConflicts,
  emergencyAlert,
  cargoStates = {},
  onOpenMinigame,
  onAdvancePhase,
  onSelectRoom,
  onCallEmergencyMeeting,
  onCancelRedAlert,
  orbitalTrajectory,
  thermalReport,
  budgetAllocation,
}: TabletHudProps) {
  const setIsOpen = onOpenChange;
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isPresented, setIsPresented] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const isMountedRef = useRef(isOpen);
  const [activeApp, setActiveApp] = useState<IPadAppId>('home');
  const [matrixPhase, setMatrixPhase] = useState<MissionPhaseNumber>(currentPhase);
  const [matrixRoleFilter, setMatrixRoleFilter] = useState<RoleId | 'all'>('all');
  const [ariaDraft, setAriaDraft] = useState('');
  const [ariaMessages, setAriaMessages] = useState<AriaChatMessage[]>(() => [
    {
      id: `aria-init-${Date.now()}`,
      sender: 'aria',
      text: buildAriaGreeting({
        activeRole,
        difficulty,
        currentPhase,
        sharedState,
        minigameStates,
        installedModuleIds,
        cargoStates,
      }),
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);
  const [ariaSpeaking, setAriaSpeaking] = useState(false);
  const [ariaGaze, setAriaGaze] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const ariaScrollRef = useRef<HTMLDivElement | null>(null);
  const ariaSpeakingTimerRef = useRef<number | null>(null);
  const [clockText, setClockText] = useState(() =>
    new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }),
  );

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    let closeTimer = 0;

    if (isOpen) {
      setIsClosing(false);
      isMountedRef.current = true;
      setIsMounted(true);
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setIsPresented(true);
        });
      });
    } else if (isMountedRef.current) {
      setIsClosing(true);
      setIsPresented(false);
      closeTimer = window.setTimeout(() => {
        isMountedRef.current = false;
        setIsMounted(false);
        setIsClosing(false);
      }, 350);
    }

    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (closeTimer) window.clearTimeout(closeTimer);
    };
  }, [isOpen, isMountedRef]);

  useEffect(() => {
    setMatrixPhase(currentPhase);
  }, [currentPhase]);

  useEffect(() => {
    if (!isMounted) return;
    const timer = window.setInterval(() => {
      setClockText(
        new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isMounted]);

  useEffect(() => {
    setAriaMessages([
      {
        id: `aria-init-${activeRole}-${currentPhase}-${Date.now()}`,
        sender: 'aria',
        text: buildAriaGreeting({
          activeRole,
          difficulty,
          currentPhase,
          sharedState,
          minigameStates,
          installedModuleIds,
          cargoStates,
        }),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    // Refresh opening briefing when switching role, phase, or campaign
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, currentPhase, difficulty]);

  useEffect(() => {
    if (activeApp === 'aria' && ariaScrollRef.current) {
      ariaScrollRef.current.scrollTop = ariaScrollRef.current.scrollHeight;
    }
  }, [activeApp, ariaMessages]);

  useEffect(() => {
    return () => {
      if (ariaSpeakingTimerRef.current !== null) {
        window.clearTimeout(ariaSpeakingTimerRef.current);
      }
    };
  }, []);

  const handleSendAriaQuery = (rawText: string) => {
    const clean = rawText.trim();
    if (!clean) return;
    soundFx.playKeyClick();
    const nowTime = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const replyText = buildAriaResponse(clean, {
      activeRole,
      difficulty,
      currentPhase,
      sharedState,
      minigameStates,
      installedModuleIds,
      cargoStates,
    });
    setAriaMessages((prev) => [
      ...prev,
      {
        id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        sender: 'user',
        text: clean,
        timestamp: nowTime,
      },
      {
        id: `aria-${Date.now() + 1}-${Math.random().toString(36).slice(2, 5)}`,
        sender: 'aria',
        text: replyText,
        timestamp: nowTime,
      },
    ]);
    setAriaDraft('');
    setAriaSpeaking(true);
    if (ariaSpeakingTimerRef.current !== null) {
      window.clearTimeout(ariaSpeakingTimerRef.current);
    }
    ariaSpeakingTimerRef.current = window.setTimeout(() => {
      setAriaSpeaking(false);
      ariaSpeakingTimerRef.current = null;
    }, 1800);
  };

  const diffCfg = DIFFICULTY_CONFIGS[difficulty];
  const roleDef = ROLE_MAP[activeRole];
  const currentPhaseMeta = PHASE_6_MAP[currentPhase];

  const myPhaseMinigames = getMinigamesForRoleAndPhase(activeRole, currentPhase);
  const myPendingInPhase = myPhaseMinigames.filter(
    (m) => minigameStates[m.code]?.status !== 'confirmado',
  );
  const phaseMinigames = getMinigamesForPhase(currentPhase);
  const phaseConfirmedCount = phaseMinigames.filter(
    (m) => minigameStates[m.code]?.status === 'confirmado',
  ).length;
  const totalConfirmedCount = MINIGAMES_72.filter(
    (m) => minigameStates[m.code]?.status === 'confirmado',
  ).length;

  const recalcCodes = sharedState.recalcRequiredCodes;
  const unresolvedConflicts = activeConflicts.filter((c) => !c.resolved);
  const launcherBadgeCount =
    recalcCodes.length + unresolvedConflicts.length + myPendingInPhase.length;

  const installedModules = ROCKET_MODULES.filter((m) => installedModuleIds.includes(m.id));
  const myCargoList = CARGO_MODULES.filter((def) => def.roleId === activeRole);
  const deliveredCargoCount = CARGO_MODULES.filter(
    (def) => cargoStates[def.id]?.delivered,
  ).length;

  const anexoPassedCount = sharedState.anexoCChecks.filter((c) => c.passed).length;
  const gateCodes = ['G13', 'G23', 'G43', 'G53'];

  const canAdvanceStandard =
    currentPhase < 6 &&
    phaseConfirmedCount >= 10 &&
    (!currentPhaseMeta.gateCode ||
      minigameStates[currentPhaseMeta.gateCode]?.status === 'confirmado');

  if (!isMounted) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Open Mission Tablet"
        className={`fixed bottom-4 right-4 z-30 group flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-[#0C1322] border-2 shadow-2xl transition-colors cursor-pointer ${
          emergencyAlert || recalcCodes.length > 0 || unresolvedConflicts.length > 0
            ? 'border-rose-500 red-alert-strobe'
            : 'border-[#2A374E] hover:border-sky-400'
        }`}
      >
        <div className="relative w-12 h-9 rounded-lg bg-[#070B14] border-2 border-slate-600 flex items-center justify-center px-1.5">
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-slate-600" />
          <Tablet className="w-4 h-4 text-sky-400" />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-emerald-400" />
          {launcherBadgeCount > 0 && (
            <span className="absolute -top-2.5 -right-2.5 min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-slate-950 font-mono-tabular text-[11px] font-bold flex items-center justify-center shadow">
              {launcherBadgeCount}
            </span>
          )}
        </div>
        <div className="text-left pr-1">
          <div className="text-xs font-display font-bold text-white leading-tight">
            Mission Tablet
          </div>
          <div className="text-[10.5px] text-slate-400 font-mono-tabular leading-tight mt-0.5">
            {recalcCodes.length > 0
              ? `${recalcCodes.length} Recalc · P${currentPhase}/6`
              : `${roleDef.shortName} · P${currentPhase}/6 (${myPendingInPhase.length} pending)`}
          </div>
        </div>
      </button>
    );
  }

  return (
    <aside
      aria-label="Mission Control Tablet"
      style={{
        transformOrigin: 'bottom right',
        transform: isPresented
          ? 'translate3d(0px, 0px, 0px) rotate(0deg) scale(1)'
          : isClosing
            ? 'translate3d(28%, 100%, 0px) rotate(-12deg) scale(0.38)'
            : 'translate3d(28%, 100%, 0px) rotate(-10deg) scale(0.42)',
        opacity: isPresented ? 1 : 0,
        transition: isClosing
          ? 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1) 0.08s'
          : 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
      }}
      className={`fixed bottom-4 right-4 z-30 w-[min(960px,calc(100vw-2rem))] h-[min(610px,calc(100vh-5rem))] rounded-[28px] bg-[#141A24] border-[3px] border-[#2E394D] p-2.5 shadow-2xl flex items-stretch gap-2 ${
        isClosing ? 'pointer-events-none' : ''
      }`}
    >
      {/* Left Bezel */}
      <div className="w-4 shrink-0 flex flex-col items-center justify-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#090D16] border border-slate-600 flex items-center justify-center">
          <span className="w-1 h-1 rounded-full bg-sky-500/80" />
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
      </div>

      {/* Screen */}
      <div
        className="flex-1 min-w-0 rounded-[20px] border border-slate-800 flex flex-col overflow-hidden relative"
        style={{
          background:
            'radial-gradient(circle at 80% 18%, rgba(56, 189, 248, 0.16), transparent 46%), radial-gradient(circle at 18% 82%, rgba(99, 102, 241, 0.15), transparent 48%), linear-gradient(155deg, #060913 0%, #0C1426 55%, #070C18 100%)',
        }}
      >
        {/* Top Status Bar */}
        <header className="px-5 py-2 bg-[#070B16]/85 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 text-xs">
            <span className="font-mono-tabular font-semibold text-white">{clockText}</span>
            <span className="text-slate-600">·</span>
            <span
              className="w-2 h-2 rounded-xs shrink-0"
              style={{ backgroundColor: roleDef.colorHex }}
            />
            <span className="font-display font-bold text-slate-100 truncate">
              {roleDef.name}
            </span>
            <span className="text-slate-600 hidden sm:inline">·</span>
            <span className="text-[11px] text-sky-300 hidden sm:inline truncate">
              {diffCfg.targetName}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono-tabular text-slate-300">
            <span className="hidden md:flex items-center gap-1 text-sky-400">
              <Radio className="w-3.5 h-3.5" />
              <span>KA-LINK</span>
            </span>
            <Wifi className="w-3.5 h-3.5 text-slate-200 hidden sm:block" />
            <span className="flex items-center gap-1 text-emerald-400">
              <span>{totalConfirmedCount}/72</span>
              <BatteryFull className="w-4 h-4" />
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Tablet"
              className="ml-1 px-2.5 py-1 rounded-lg bg-[#131C2E] border border-slate-700 hover:border-sky-400 text-slate-200 hover:text-white text-[11px] font-sans font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
          </div>
        </header>

        {/* Active App Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col">
          {activeApp === 'home' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-2">
              <div className="text-center space-y-1 max-w-2xl">
                <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-sky-400">
                  {currentPhaseMeta.code} / 6 · {currentPhaseMeta.title}
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                  {roleDef.roomName} · Personal Console
                </h2>
                <p className="text-xs text-slate-300">
                  {recalcCodes.length > 0
                    ? `Attention: ${recalcCodes.length} mission(s) flagged for recalculation (${recalcCodes.join(', ')}).`
                    : myPendingInPhase.length > 0
                      ? `You have ${myPendingInPhase.length} pending mission(s) in ${currentPhaseMeta.code}. Open them from 'Missions'.`
                      : `Your 3 missions in ${currentPhaseMeta.code} are confirmed (${phaseConfirmedCount}/12 team total).`}
                </p>
              </div>

              {emergencyAlert && (
                <div className="w-full max-w-2xl rounded-2xl border border-rose-500/80 bg-[#2A090E]/95 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                  <div className="flex items-center gap-2 text-xs text-rose-100">
                    <Siren className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="font-semibold">
                      Red Alert Active — Contingency Meeting in the Gates Room
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onCancelRedAlert}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-100 text-rose-950 text-xs font-bold shadow cursor-pointer whitespace-nowrap"
                  >
                    Deactivate Red Alert
                  </button>
                </div>
              )}

              {/* Synced Lab Certifications Strip */}
              <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div
                  className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
                    orbitalTrajectory?.validated
                      ? 'bg-[#0C1D1A] border-emerald-500/45 text-emerald-200'
                      : 'bg-[#0B1222]/90 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="font-semibold">Trajectory</span>
                  <span className="font-mono-tabular font-bold">
                    {orbitalTrajectory?.validated
                      ? `${orbitalTrajectory.perigeeKm}–${orbitalTrajectory.apogeeKm}km`
                      : 'Pending'}
                  </span>
                </div>
                <div
                  className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
                    thermalReport?.certified
                      ? 'bg-[#0C1D1A] border-emerald-500/45 text-emerald-200'
                      : 'bg-[#0B1222]/90 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="font-semibold">Thermal Shield</span>
                  <span className="font-mono-tabular font-bold">
                    {thermalReport?.certified ? 'Certified' : 'Pending'}
                  </span>
                </div>
                <div
                  className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
                    budgetAllocation?.approved
                      ? 'bg-[#0C1D1A] border-emerald-500/45 text-emerald-200'
                      : 'bg-[#0B1222]/90 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="font-semibold">Treasury Budget</span>
                  <span className="font-mono-tabular font-bold">
                    {budgetAllocation?.approved
                      ? `$${budgetAllocation.totalAllocatedM.toFixed(1)}M`
                      : 'Pending'}
                  </span>
                </div>
              </div>

              {/* 4 Main Apps */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
                <button
                  type="button"
                  onClick={() => setActiveApp('tasks')}
                  className="group flex flex-col items-center gap-2.5 cursor-pointer"
                >
                  <div
                    className="relative w-22 h-22 sm:w-24 sm:h-24 rounded-[24px] border border-white/20 shadow-xl flex items-center justify-center transition-transform duration-150 group-hover:scale-105"
                    style={{ background: 'linear-gradient(150deg, #0ea5e9 0%, #2563eb 100%)' }}
                  >
                    <ClipboardList className="w-10 h-10 text-white" />
                    {myPendingInPhase.length > 0 && (
                      <span className="absolute -top-2 -right-2 min-w-[26px] h-[26px] px-1.5 rounded-full bg-rose-500 border-2 border-[#080D1B] text-white font-mono-tabular text-xs font-bold flex items-center justify-center shadow">
                        {myPendingInPhase.length}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-white group-hover:text-sky-300">
                    Missions
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveApp('track')}
                  className="group flex flex-col items-center gap-2.5 cursor-pointer"
                >
                  <div
                    className="relative w-22 h-22 sm:w-24 sm:h-24 rounded-[24px] border border-white/20 shadow-xl flex items-center justify-center transition-transform duration-150 group-hover:scale-105"
                    style={{ background: 'linear-gradient(150deg, #14b8a6 0%, #0f766e 100%)' }}
                  >
                    <Compass className="w-10 h-10 text-white" />
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/45 font-mono-tabular text-[10px] font-bold text-white">
                      P{currentPhase}/6
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-white group-hover:text-teal-300">
                    Schedule
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveApp('aria')}
                  className="group flex flex-col items-center gap-2.5 cursor-pointer"
                >
                  <div
                    className="relative w-22 h-22 sm:w-24 sm:h-24 rounded-[24px] border border-indigo-300/35 shadow-xl flex items-center justify-center overflow-hidden transition-transform duration-150 group-hover:scale-105"
                    style={{
                      background:
                        'linear-gradient(150deg, #6366f1 0%, #7c3aed 55%, #4338ca 100%)',
                    }}
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-1 top-1 h-8 rounded-t-[20px] bg-gradient-to-b from-white/25 to-transparent"
                    />
                    <AriaSquircleIcon className="relative z-10 w-12 h-12 drop-shadow-[0_4px_10px_rgba(15,23,42,0.45)]" />
                  </div>
                  <span className="text-xs font-semibold text-white group-hover:text-indigo-300">
                    A.R.I.A.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveApp('alert')}
                  className="group flex flex-col items-center gap-2.5 cursor-pointer"
                >
                  <div
                    className={`relative w-22 h-22 sm:w-24 sm:h-24 rounded-[24px] border border-white/25 shadow-xl flex items-center justify-center transition-transform duration-150 group-hover:scale-105 ${
                      emergencyAlert || recalcCodes.length > 0 ? 'red-alert-strobe' : ''
                    }`}
                    style={{ background: 'linear-gradient(150deg, #f43f5e 0%, #9f1239 100%)' }}
                  >
                    <Siren className="w-10 h-10 text-white" />
                    {(recalcCodes.length > 0 || unresolvedConflicts.length > 0) && (
                      <span className="absolute -top-2 -right-2 min-w-[26px] h-[26px] px-1.5 rounded-full bg-white border-2 border-rose-700 text-rose-700 font-mono-tabular text-xs font-bold flex items-center justify-center shadow">
                        {recalcCodes.length + unresolvedConflicts.length}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-rose-200 group-hover:text-white">
                    Gates &amp; Alerts
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* APP 1: MISSIONS */}
          {activeApp === 'tasks' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    Missions — {currentPhaseMeta.code}: {currentPhaseMeta.title}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Active role: {roleDef.name} ({3 - myPendingInPhase.length}/3 confirmed in this phase · {phaseConfirmedCount}/12 team total).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeRoom !== roleDef.roomId && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectRoom(roleDef.roomId);
                        setIsOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-600 hover:border-sky-400 text-slate-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-sky-400" />
                      <span>Go to {roleDef.shortName}</span>
                    </button>
                  )}

                  {currentPhase < 6 && (canAdvanceStandard || soloTestMode) && (
                    <button
                      type="button"
                      onClick={() => onAdvancePhase((currentPhase + 1) as MissionPhaseNumber)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Advance to Phase {currentPhase + 1}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                {myPhaseMinigames.map((mg) => {
                  const st = minigameStates[mg.code];
                  const stMeta = STATUS_SHORT[st?.status ?? 'no_iniciado'];
                  return (
                    <div
                      key={mg.code}
                      className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        st?.dirtyNeedsRecalc
                          ? 'bg-[#251016] border-rose-500/65'
                          : st?.status === 'confirmado'
                            ? 'bg-[#0C1D1A] border-emerald-500/45'
                            : 'bg-[#0D1628] border-slate-700/80'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            {mg.code}
                          </span>
                          <span className="font-display font-bold text-sm text-white">
                            {mg.title}
                          </span>
                          <span className={`px-2 py-0.5 rounded border text-[10.5px] font-mono-tabular ${stMeta.cls}`}>
                            {stMeta.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{mg.subtitle}</p>
                        <div className="text-[11px] text-slate-400">
                          Recommended 3D station:{' '}
                          <strong className="text-sky-300">
                            {STATION_KIND_LABEL[mg.stationKind] ?? mg.stationKind}
                          </strong>
                          {mg.dependsOnCodes.length > 0 && (
                            <> · Depends on {mg.dependsOnCodes.join(', ')}</>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenMinigame(mg.code);
                          setIsOpen(false);
                        }}
                        className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Open Mission
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Gate Cooperative Notice if phase has a Gate */}
              {currentPhaseMeta.gateCode && (
                <div className="rounded-xl border border-amber-500/40 bg-[#18140C] p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-display font-bold text-amber-300">
                      Phase {currentPhase} Cooperative Gate: {currentPhaseMeta.gateCode} ·{' '}
                      {MINIGAME_MAP[currentPhaseMeta.gateCode]?.title}
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Requires a vote from all 4 roles (Mechanic, Engineer, Scientist, and Program Manager) to seal the phase.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenMinigame(currentPhaseMeta.gateCode!);
                      setIsOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Open Gate {currentPhaseMeta.gateCode}
                  </button>
                </div>
              )}

              {/* Fragile Physical Cargo */}
              {myCargoList.length > 0 && (
                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-display font-bold text-slate-200 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Fragile Physical Cargo (Tractor Beam: Right Click / E)</span>
                    </h3>
                    <span className="font-mono-tabular text-[11px] text-slate-400">
                      {deliveredCargoCount}/{CARGO_MODULES.length} on Hangar Platform
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {myCargoList.map((cargo) => {
                      const st = cargoStates[cargo.id];
                      const integrity = st?.integrity ?? 100;
                      const delivered = Boolean(st?.delivered);
                      return (
                        <div
                          key={cargo.id}
                          className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
                            delivered
                              ? 'bg-[#0C1D1A] border-emerald-500/40'
                              : 'bg-[#0D1628] border-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {cargo.name}
                            </div>
                            <div className="text-[10.5px] text-slate-400">
                              {delivered
                                ? `Locked on Platform (+${cargo.scienceBonusOnDeliver} Science)`
                                : `In ${ROOM_MAP[cargo.originRoomId].shortLabel}`}
                            </div>
                          </div>
                          <span
                            className={`font-mono-tabular text-[11px] font-bold shrink-0 ${
                              delivered
                                ? 'text-emerald-400'
                                : integrity <= 45
                                  ? 'text-rose-400'
                                  : 'text-cyan-300'
                            }`}
                          >
                            {delivered ? 'Delivered' : `${integrity}%`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* APP 2: SCHEDULE (72 MISSIONS MATRIX) */}
          {activeApp === 'track' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    Full Schedule — 6 Phases × 12 Missions (72 Total)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Click any card to open the corresponding mission and inspect its impact.
                  </p>
                </div>
                <span className="font-mono-tabular text-sm font-bold text-teal-300">
                  {totalConfirmedCount} / 72 Confirmed ({Math.round((totalConfirmedCount / 72) * 100)}%)
                </span>
              </div>

              {/* Phase tabs 1..6 */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {MISSION_PHASES_6.map((ph) => {
                  const list = getMinigamesForPhase(ph.number);
                  const done = list.filter(
                    (m) => minigameStates[m.code]?.status === 'confirmado',
                  ).length;
                  const active = matrixPhase === ph.number;
                  return (
                    <button
                      key={ph.number}
                      type="button"
                      onClick={() => setMatrixPhase(ph.number)}
                      className={`rounded-lg border px-2 py-2 text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-sky-500/20 border-sky-400 text-white'
                          : 'bg-[#09101E] border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10.5px] font-mono-tabular font-bold">
                        <span className="text-sky-300">{ph.code}</span>
                        <span>{done}/12</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {ph.title}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Role Filter + Jump button */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMatrixRoleFilter('all')}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                      matrixRoleFilter === 'all'
                        ? 'bg-slate-800 border-slate-400 text-white'
                        : 'bg-[#09101E] border-slate-800 text-slate-400'
                    }`}
                  >
                    All (12)
                  </button>
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setMatrixRoleFilter(r.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer ${
                        matrixRoleFilter === r.id
                          ? 'bg-slate-800 border-slate-400 text-white'
                          : 'bg-[#09101E] border-slate-800 text-slate-400'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-xs"
                        style={{ backgroundColor: r.colorHex }}
                      />
                      <span>{r.shortName}</span>
                    </button>
                  ))}
                </div>

                {soloTestMode && matrixPhase !== currentPhase && (
                  <button
                    type="button"
                    onClick={() => onAdvancePhase(matrixPhase)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[11px] font-bold cursor-pointer"
                  >
                    Activate {PHASE_6_MAP[matrixPhase].code} (Solo Test)
                  </button>
                )}
              </div>

              {/* 12 Minigames Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {getMinigamesForPhase(matrixPhase)
                  .filter((m) => matrixRoleFilter === 'all' || m.roleId === matrixRoleFilter)
                  .map((mg) => {
                    const st = minigameStates[mg.code];
                    const stMeta = STATUS_SHORT[st?.status ?? 'no_iniciado'];
                    const rDef = ROLE_MAP[mg.roleId];
                    return (
                      <button
                        key={mg.code}
                        type="button"
                        onClick={() => {
                          onOpenMinigame(mg.code);
                          setIsOpen(false);
                        }}
                        className="text-left rounded-xl border border-slate-800 bg-[#0B1222] hover:border-sky-400 p-3 space-y-1.5 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="font-mono-tabular text-xs font-bold"
                            style={{ color: rDef.colorHex }}
                          >
                            {mg.code} · {rDef.shortName}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded border text-[9.5px] font-mono-tabular ${stMeta.cls}`}>
                            {stMeta.label}
                          </span>
                        </div>
                        <div className="text-xs font-display font-bold text-white truncate">
                          {mg.title}
                        </div>
                        <div className="text-[10.5px] text-slate-400 line-clamp-2 leading-snug">
                          {mg.subtitle}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* APP 3: A.R.I.A. VIRTUAL ROBOT COPILOT */}
          {activeApp === 'aria' && (
            <div
              className="flex-1 min-h-0 flex flex-col md:flex-row gap-4"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
                const ny = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
                setAriaGaze({ x: nx, y: ny });
              }}
              onMouseLeave={() => setAriaGaze({ x: 0, y: 0 })}
            >
              {/* Left Stage: Animated Virtual Robot Avatar + Greeting Speech Bubble */}
              <div className="md:w-72 shrink-0 rounded-2xl border border-indigo-500/30 bg-[#070C1B]/90 p-4 flex flex-col items-center justify-between gap-3">
                <div className="w-full flex items-center justify-between text-[11px] font-mono-tabular text-indigo-200/80">
                  <span>A.R.I.A. Copilot</span>
                  <span>{phaseConfirmedCount}/12 Phase {currentPhase}</span>
                </div>

                <AriaRobotAvatar
                  gazeX={ariaGaze.x}
                  gazeY={ariaGaze.y}
                  isSpeaking={ariaSpeaking}
                />

                {/* Prominent Speech Bubble */}
                <div className="relative w-full rounded-xl border border-cyan-400/35 bg-[#0D162D] px-3.5 py-3 shadow-lg">
                  <div
                    aria-hidden="true"
                    className="hidden md:block absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 bg-[#0D162D] border-l border-t border-cyan-400/35"
                  />
                  <div className="font-display text-sm font-bold text-white leading-snug">
                    Hey, how can I help you?
                  </div>
                  <p className="text-[11.5px] text-slate-300 italic leading-snug mt-1">
                    Ask me about your current phase tasks, rocket specs, or mission strategy.
                  </p>
                </div>

                {/* Live Telemetry Snapshot (clean unboxed metadata) */}
                <div className="w-full pt-2 border-t border-slate-800/90 flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
                  <span>Annex C: {anexoPassedCount}/6</span>
                  <span aria-hidden="true">·</span>
                  <span>Mod: {installedModules.length}/12</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      sharedState.riesgoEstado.riskPct > sharedState.riesgoEstado.maxAllowedRiskPct
                        ? 'text-rose-400 font-semibold'
                        : 'text-emerald-400 font-semibold'
                    }
                  >
                    Risk {sharedState.riesgoEstado.riskPct}%
                  </span>
                </div>
              </div>

              {/* Right Panel: Interactive Chat & Quick Prompts */}
              <div className="flex-1 min-w-0 min-h-[260px] flex flex-col rounded-2xl border border-slate-800 bg-[#080E1E]/85 p-3.5 gap-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800 shrink-0">
                  <div className="min-w-0">
                    <h2 className="font-display text-sm sm:text-base font-bold text-white truncate">
                      A.R.I.A. Mission Assistant
                    </h2>
                    <div className="text-[11px] text-slate-400 truncate">
                      {roleDef.name} · {currentPhaseMeta.code}: {currentPhaseMeta.title}
                    </div>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-cyan-300 shrink-0">
                    {myPendingInPhase.length} pending
                  </span>
                </div>

                {/* Scrollable Chat Thread */}
                <div
                  ref={ariaScrollRef}
                  className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1"
                >
                  {ariaMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                        msg.sender === 'aria'
                          ? 'bg-[#0E1830] border border-indigo-500/35 text-slate-100 mr-4'
                          : 'bg-sky-500/15 border border-sky-400/40 text-white ml-8'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-400 mb-1">
                        <span className={msg.sender === 'aria' ? 'text-cyan-300 font-semibold' : ''}>
                          {msg.sender === 'aria' ? 'A.R.I.A.' : roleDef.shortName}
                        </span>
                        <span>{msg.timestamp}</span>
                      </div>
                      {msg.text}
                    </div>
                  ))}
                </div>

                {/* One-Tap Quick-Help Prompts */}
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {ARIA_QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSendAriaQuery(q)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0D162B] border border-indigo-500/35 hover:border-cyan-400 text-[11px] font-medium text-indigo-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{q}</span>
                    </button>
                  ))}
                </div>

                {/* Text Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendAriaQuery(ariaDraft);
                  }}
                  className="flex gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={ariaDraft}
                    onChange={(e) => setAriaDraft(e.target.value)}
                    placeholder="Ask A.R.I.A. anything..."
                    className="flex-1 px-3 py-2 rounded-xl bg-[#050914] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* APP 4: GATES & ALERTS */}
          {activeApp === 'alert' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-white">
                    Cooperative Gates &amp; Recalculation Queue
                  </h2>
                  <p className="text-xs text-slate-400">
                    When a previously confirmed decision changes, dependent missions are flagged here for mandatory recalculation.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {emergencyAlert && (
                    <button
                      type="button"
                      onClick={onCancelRedAlert}
                      className="px-3 py-1.5 rounded-lg bg-white text-rose-950 text-xs font-bold cursor-pointer"
                    >
                      Deactivate Alert
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onCallEmergencyMeeting();
                      setIsOpen(false);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Siren className="w-3.5 h-3.5" />
                    <span>Go to Gates Room</span>
                  </button>
                </div>
              </div>

              {/* 4 Gates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {gateCodes.map((gCode) => {
                  const def = MINIGAME_MAP[gCode];
                  const st = minigameStates[gCode];
                  const approved = st?.status === 'confirmado';
                  return (
                    <button
                      key={gCode}
                      type="button"
                      onClick={() => {
                        onOpenMinigame(gCode);
                        setIsOpen(false);
                      }}
                      className={`text-left rounded-xl border p-3 flex items-center justify-between gap-2 cursor-pointer ${
                        approved
                          ? 'bg-[#0C1D1A] border-emerald-500/45'
                          : 'bg-[#12192A] border-amber-500/45 hover:border-amber-400'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-mono-tabular font-bold text-amber-300">
                          {gCode} · PHASE {def.phaseNumber}
                        </div>
                        <div className="text-sm font-display font-bold text-white">
                          {def.title}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono-tabular font-bold ${
                          approved ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {approved ? 'APPROVED' : 'VOTE'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Recalculation Queue */}
              <div className="rounded-xl border border-slate-800 bg-[#09101E] p-3.5 space-y-2">
                <div className="text-xs font-display font-bold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Missions requiring recalculation ({recalcCodes.length})</span>
                </div>
                {recalcCodes.length === 0 ? (
                  <p className="text-xs text-emerald-300">
                    No desyncs: all confirmed dependencies are up to date.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {recalcCodes.map((rCode) => {
                      const def = MINIGAME_MAP[rCode];
                      return (
                        <div
                          key={rCode}
                          className="rounded-lg border border-rose-500/50 bg-[#231015] px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <div className="text-xs text-rose-100">
                            <strong className="font-mono-tabular mr-1.5">{rCode}</strong>
                            <span>{def?.title ?? rCode}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onOpenMinigame(rCode);
                              setIsOpen(false);
                            }}
                            className="px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 text-[11px] font-bold cursor-pointer"
                          >
                            Recalculate
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Dock */}
        <footer className="px-4 py-2 bg-[#070B16]/90 border-t border-slate-800 flex items-center justify-center gap-4 shrink-0">
          {(
            [
              { id: 'home', label: 'Home', icon: LayoutGrid },
              { id: 'tasks', label: 'Missions', icon: ClipboardList },
              { id: 'track', label: 'Schedule', icon: Compass },
              { id: 'aria', label: 'A.R.I.A.', icon: Bot },
              { id: 'alert', label: 'Gates', icon: Siren },
            ] as const
          ).map((dockItem) => {
            const Icon = dockItem.icon;
            const active = activeApp === dockItem.id;
            return (
              <button
                key={dockItem.id}
                type="button"
                onClick={() => setActiveApp(dockItem.id)}
                className={`px-3 py-1 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{dockItem.label}</span>
              </button>
            );
          })}
        </footer>
      </div>
    </aside>
  );
}
