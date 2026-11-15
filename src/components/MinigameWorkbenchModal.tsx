import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileCheck2,
  History,
  ListChecks,
  MessageSquare,
  Play,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Sliders,
  Sparkles,
  Undo2,
  X,
  XCircle,
} from 'lucide-react';
import { MINIGAME_MAP, PHASE_6_MAP } from '../data/minigamesData';
import { DIFFICULTY_CONFIGS, ROLE_MAP } from '../data/missionData';
import type {
  DifficultyId,
  MinigameInstanceState,
  MinigamePayload,
  MinigameValidationResult,
  MinigameWorkflowStatus,
  MissionStateDomain,
  RoleId,
  SharedMissionState,
} from '../types/mission';
import { evaluateMinigame } from '../utils/minigameEngine';
import { soundFx } from '../utils/soundFx';
import { AllocationCompareMechanic } from './minigameMechanics/AllocationCompareMechanic';
import { CardsPriorityMechanic } from './minigameMechanics/CardsPriorityMechanic';
import { CoopVotingGateMechanic } from './minigameMechanics/CoopVotingGateMechanic';
import { DiagnosticsVibrationMechanic } from './minigameMechanics/DiagnosticsVibrationMechanic';
import { NetworkSimMechanic } from './minigameMechanics/NetworkSimMechanic';
import { RiskIncidentMatrixMechanic } from './minigameMechanics/RiskIncidentMatrixMechanic';
import { SignalOrbitalGlobeMechanic } from './minigameMechanics/SignalOrbitalGlobeMechanic';
import { SpatialMassAssemblyMechanic } from './minigameMechanics/SpatialMassAssemblyMechanic';
import { TimelineGanttMechanic } from './minigameMechanics/TimelineGanttMechanic';

interface MinigameWorkbenchModalProps {
  code: string;
  instanceState: MinigameInstanceState;
  allStates: Record<string, MinigameInstanceState>;
  sharedState: SharedMissionState;
  activeRole: RoleId;
  playerName: string;
  difficulty: DifficultyId;
  onSaveDraft: (code: string, nextPayload: MinigamePayload, undoStack: MinigamePayload[]) => void;
  onSimulate: (
    code: string,
    nextPayload: MinigamePayload,
    undoStack: MinigamePayload[],
    validation: MinigameValidationResult,
  ) => void;
  onRequestReview: (
    code: string,
    nextPayload: MinigamePayload,
    undoStack: MinigamePayload[],
    validation: MinigameValidationResult,
  ) => void;
  onConfirm: (
    code: string,
    nextPayload: MinigamePayload,
    justification: string,
    validation: MinigameValidationResult,
  ) => void;
  onRevertVersion: (code: string, historyEntryId: string) => void;
  onAddComment: (code: string, text: string) => void;
  onOpenMinigame: (otherCode: string) => void;
  onClose: () => void;
}

const STATUS_META: Record<
  MinigameWorkflowStatus,
  { label: string; badgeClass: string }
> = {
  no_iniciado: {
    label: 'Not Started',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-600',
  },
  en_progreso: {
    label: 'In Progress',
    badgeClass: 'bg-sky-950/90 text-sky-300 border-sky-500/60',
  },
  pendiente_revision: {
    label: 'Pending Review',
    badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-500/60',
  },
  validado: {
    label: 'Validated',
    badgeClass: 'bg-teal-950/90 text-teal-300 border-teal-500/60',
  },
  requiere_cambios: {
    label: 'Needs Recalc',
    badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-500/70',
  },
  confirmado: {
    label: 'Confirmed',
    badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/70',
  },
};

const DOMAIN_LABELS: Record<MissionStateDomain, string> = {
  objetivos: 'Objectives & Science',
  masaVolumen: 'Mass & Volume',
  energia: 'Power',
  datos: 'Data & SSR',
  comunicaciones: 'Communications',
  presupuestoCalendario: 'Budget / Schedule',
  riesgoEstado: 'Risk / Δv / Health',
};

export function MinigameWorkbenchModal({
  code,
  instanceState,
  allStates,
  sharedState,
  activeRole,
  difficulty,
  onSaveDraft,
  onSimulate,
  onRequestReview,
  onConfirm,
  onRevertVersion,
  onAddComment,
  onOpenMinigame,
  onClose,
}: MinigameWorkbenchModalProps) {
  const def = MINIGAME_MAP[code];
  const phaseMeta = PHASE_6_MAP[def.phaseNumber];
  const ownerRole = ROLE_MAP[def.roleId];
  const diffCfg = DIFFICULTY_CONFIGS[difficulty];

  const [workingPayload, setWorkingPayload] = useState<MinigamePayload>(() =>
    JSON.parse(JSON.stringify(instanceState.draftPayload)) as MinigamePayload,
  );
  const [undoStack, setUndoStack] = useState<MinigamePayload[]>(instanceState.undoStack);
  const [guidedMode, setGuidedMode] = useState(true);
  const [showStepDrawer, setShowStepDrawer] = useState(true);
  const [rightTab, setRightTab] = useState<'validation' | 'history' | 'comments'>('validation');
  const [liveValidation, setLiveValidation] = useState<MinigameValidationResult | null>(
    instanceState.lastValidation,
  );
  const [showConfirmBox, setShowConfirmBox] = useState(false);
  const [justification, setJustification] = useState('');
  const [commentDraft, setCommentDraft] = useState('');

  useEffect(() => {
    setWorkingPayload(
      JSON.parse(JSON.stringify(instanceState.draftPayload)) as MinigamePayload,
    );
    setUndoStack(instanceState.undoStack);
    setLiveValidation(
      instanceState.lastValidation ??
        evaluateMinigame(def, instanceState.draftPayload, sharedState, difficulty),
    );
    setShowConfirmBox(false);
    setJustification('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, instanceState.updatedAt]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const evaluatedNow = useMemo(
    () => evaluateMinigame(def, workingPayload, sharedState, difficulty),
    [def, difficulty, sharedState, workingPayload],
  );

  const displayValidation = liveValidation ?? evaluatedNow;

  const handlePayloadChange = (next: MinigamePayload) => {
    setUndoStack((prev) => [...prev.slice(-14), workingPayload]);
    setWorkingPayload(next);
    setLiveValidation(evaluateMinigame(def, next, sharedState, difficulty));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    soundFx.playKeyClick();
    const prevPayload = undoStack[undoStack.length - 1];
    const nextStack = undoStack.slice(0, -1);
    setUndoStack(nextStack);
    setWorkingPayload(prevPayload);
    setLiveValidation(evaluateMinigame(def, prevPayload, sharedState, difficulty));
  };

  const handleReset = () => {
    soundFx.playKeyClick();
    const fresh = JSON.parse(JSON.stringify(def.defaultPayload)) as MinigamePayload;
    setUndoStack((prev) => [...prev.slice(-14), workingPayload]);
    setWorkingPayload(fresh);
    setLiveValidation(evaluateMinigame(def, fresh, sharedState, difficulty));
  };

  const handleSimulateClick = () => {
    soundFx.playKeyClick();
    const res = evaluateMinigame(def, workingPayload, sharedState, difficulty);
    setLiveValidation(res);
    onSimulate(code, workingPayload, undoStack, res);
    setRightTab('validation');
  };

  const handleConfirmSubmit = (e: FormEvent) => {
    e.preventDefault();
    const res = evaluateMinigame(def, workingPayload, sharedState, difficulty);
    setLiveValidation(res);
    if (!res.passed) {
      setRightTab('validation');
      return;
    }
    soundFx.playKeyClick();
    const cleanNote =
      justification.trim() ||
      `Validated by ${ROLE_MAP[activeRole].shortName} (${res.summaryText})`;
    onConfirm(code, workingPayload, cleanNote, res);
    setShowConfirmBox(false);
  };

  const handlePostComment = (e: FormEvent) => {
    e.preventDefault();
    const clean = commentDraft.trim();
    if (!clean) return;
    soundFx.playKeyClick();
    onAddComment(code, clean);
    setCommentDraft('');
  };

  const statusInfo = STATUS_META[instanceState.status];
  const unmetDeps = def.dependsOnCodes.filter(
    (depCode) => allStates[depCode]?.status !== 'confirmado',
  );

  const renderDomainMetric = (domain: MissionStateDomain) => {
    if (domain === 'objetivos') {
      return {
        label: 'Objectives & Science',
        value: `${sharedState.objetivos.scienceScore} / ${sharedState.objetivos.minScienceRequired} pts`,
        sub: `Coverage ${sharedState.objetivos.coveragePct}% · Precision ${sharedState.objetivos.precisionPct}%`,
        ok: sharedState.objetivos.scienceScore >= sharedState.objetivos.minScienceRequired,
      };
    }
    if (domain === 'masaVolumen') {
      return {
        label: 'Mass & Volume',
        value: `${sharedState.masaVolumen.totalMassKg.toLocaleString()} / ${sharedState.masaVolumen.maxMassKg.toLocaleString()} kg`,
        sub: `${sharedState.masaVolumen.occupiedVolumeM3} / ${sharedState.masaVolumen.maxVolumeM3} m³ · CoG ±${sharedState.masaVolumen.cgOffsetMm} mm`,
        ok:
          sharedState.masaVolumen.totalMassKg <= sharedState.masaVolumen.maxMassKg &&
          sharedState.masaVolumen.occupiedVolumeM3 <= sharedState.masaVolumen.maxVolumeM3,
      };
    }
    if (domain === 'energia') {
      return {
        label: 'Electrical Power',
        value: `${sharedState.energia.netMarginW >= 0 ? '+' : ''}${sharedState.energia.netMarginW} W margin`,
        sub: `Gen ${sharedState.energia.generationW} W · ${sharedState.energia.eclipseAutonomyHours} h eclipse`,
        ok: sharedState.energia.netMarginW >= 25 && sharedState.energia.eclipseAutonomyHours >= 4,
      };
    }
    if (domain === 'datos') {
      return {
        label: 'Data & SSR Memory',
        value: `${sharedState.datos.generatedGB} / ${sharedState.datos.storageCapacityGB} GB`,
        sub: `Signal quality ${sharedState.datos.dataQualityPct}%`,
        ok: sharedState.datos.storageCapacityGB >= sharedState.datos.generatedGB,
      };
    }
    if (domain === 'comunicaciones') {
      return {
        label: 'RF Communications',
        value: `${sharedState.comunicaciones.downlinkMbps} / ${sharedState.comunicaciones.minRequiredMbps} Mbps`,
        sub: `${sharedState.comunicaciones.groundStationsCount} DSN · ${sharedState.comunicaciones.packetSuccessPct}% delivery`,
        ok: sharedState.comunicaciones.downlinkMbps >= sharedState.comunicaciones.minRequiredMbps,
      };
    }
    if (domain === 'presupuestoCalendario') {
      return {
        label: 'Budget & Schedule',
        value: `$${sharedState.presupuestoCalendario.allocatedBudgetM}M / $${sharedState.presupuestoCalendario.maxBudgetM}M`,
        sub: `UFE $${sharedState.presupuestoCalendario.contingencyReserveM}M · Slack ${sharedState.presupuestoCalendario.criticalSlackDays}d`,
        ok:
          sharedState.presupuestoCalendario.allocatedBudgetM <=
            sharedState.presupuestoCalendario.maxBudgetM &&
          sharedState.presupuestoCalendario.criticalSlackDays >= 0,
      };
    }
    return {
      label: 'Risk, Δv & Health',
      value: `${sharedState.riesgoEstado.riskPct}% risk · Δv ${sharedState.riesgoEstado.deltaVMps} m/s`,
      sub: `Health ${sharedState.riesgoEstado.vehicleHealthPct}% · Gates ${sharedState.riesgoEstado.gatesApproved.length}/4`,
      ok:
        sharedState.riesgoEstado.riskPct <= sharedState.riesgoEstado.maxAllowedRiskPct &&
        sharedState.riesgoEstado.deltaVMps >= sharedState.riesgoEstado.minDeltaVMps,
    };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[1340px] h-[min(92vh,840px)] bg-[#080D18] border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* TOP BAR: Code, Title, Phase, Role, Status, Mode Toggle, Close */}
        <header className="px-4 sm:px-5 py-3 bg-[#0B1222] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="px-2.5 py-1 rounded-lg border font-mono-tabular text-xs font-bold shrink-0"
              style={{
                backgroundColor: `${ownerRole.colorHex}1F`,
                borderColor: `${ownerRole.colorHex}66`,
                color: ownerRole.colorHex,
              }}
            >
              {def.code}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular text-slate-400">
                <span className="text-sky-400 font-bold">{phaseMeta.code}</span>
                <span>·</span>
                <span style={{ color: ownerRole.colorHex }} className="font-semibold">
                  {ownerRole.name}
                </span>
                <span>·</span>
                <span>{diffCfg.targetName}</span>
                {def.isGateReview && (
                  <>
                    <span>·</span>
                    <span className="text-amber-300 font-bold">COOPERATIVE GATE</span>
                  </>
                )}
              </div>
              <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                {def.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`px-2.5 py-1 rounded-md border text-[11px] font-mono-tabular font-bold ${statusInfo.badgeClass}`}
            >
              {statusInfo.label}
            </span>

            <button
              type="button"
              onClick={() => {
                soundFx.playKeyClick();
                setGuidedMode((v) => !v);
              }}
              className={`px-2.5 py-1 rounded-md border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                guidedMode
                  ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{guidedMode ? 'Guided Mode' : 'Advanced Mode'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close workbench"
              className="p-1.5 rounded-lg border border-slate-700 bg-[#101829] hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* RECALCULATION WARNING BANNER */}
        {instanceState.dirtyNeedsRecalc && (
          <div className="px-4 py-2 bg-rose-950/90 border-b border-rose-500/60 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-100 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Recalculation required:</strong> An upstream mission that{' '}
                <strong>{def.code}</strong> depends on was modified. Verify values and reconfirm.
              </span>
            </div>
            <button
              type="button"
              onClick={handleSimulateClick}
              className="px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-[11px] cursor-pointer"
            >
              Check Now
            </button>
          </div>
        )}

        {/* 3-COLUMN WORKBENCH BODY */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT PANEL (3 cols): Context, Dependencies, Inherited Shared State */}
          <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#070B14] overflow-y-auto p-3.5 space-y-3.5">
            <div className="space-y-1">
              <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-sky-400 font-bold">
                Mission Context
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{def.subtitle}</p>
              <p className="text-[11px] text-slate-400 leading-snug">{def.mechanicSummary}</p>
            </div>

            {/* Dependencies */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400 font-bold">
                Upstream Dependencies ({def.dependsOnCodes.length})
              </div>
              {def.dependsOnCodes.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-[#0B111E] px-2.5 py-2 text-[11px] text-slate-400">
                  No prerequisites; you can start this from the beginning of {phaseMeta.code}.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {def.dependsOnCodes.map((depCode) => {
                    const depDef = MINIGAME_MAP[depCode];
                    const depSt = allStates[depCode];
                    const done = depSt?.status === 'confirmado';
                    return (
                      <button
                        key={depCode}
                        type="button"
                        onClick={() => onOpenMinigame(depCode)}
                        className={`w-full text-left rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                          done
                            ? 'bg-[#0C1D1A] border-emerald-500/40 text-emerald-200 hover:border-emerald-400'
                            : 'bg-[#171214] border-amber-500/40 text-amber-200 hover:border-amber-400'
                        }`}
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-mono-tabular font-bold mr-1.5">{depCode}</span>
                          <span className="truncate">{depDef?.title ?? depCode}</span>
                        </div>
                        <span className="font-mono-tabular text-[10px] shrink-0 flex items-center gap-0.5">
                          {done ? 'OK' : 'Open'}
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </button>
                    );
                  })}
                  {unmetDeps.length > 0 && (
                    <p className="text-[10.5px] text-amber-300/90 leading-snug">
                      Note: {unmetDeps.length} dependency(ies) unconfirmed; you can simulate in draft and confirm once ready.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Inherited Shared State Domains */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400 font-bold">
                Inherited Shared State
              </div>
              <div className="space-y-1.5">
                {def.impactDomains.map((dom) => {
                  const m = renderDomainMetric(dom);
                  return (
                    <div
                      key={dom}
                      className={`rounded-lg border px-2.5 py-2 space-y-0.5 ${
                        m.ok
                          ? 'bg-[#0A1322] border-slate-800'
                          : 'bg-[#1D1016] border-rose-500/45'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] text-slate-400">{m.label}</span>
                        <span
                          className={`text-[10px] font-mono-tabular font-bold ${
                            m.ok ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {m.ok ? 'IN RANGE' : 'OUT'}
                        </span>
                      </div>
                      <div className="font-mono-tabular text-xs font-bold text-white">
                        {m.value}
                      </div>
                      <div className="text-[10px] text-slate-400">{m.sub}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Domain Impact Tags + Rules Summary */}
            <div className="rounded-lg border border-slate-800 bg-[#0A111D] p-2.5 space-y-1.5">
              <div className="text-[10.5px] font-mono-tabular uppercase tracking-wider text-slate-400 font-bold">
                Acceptance Rules ({def.code})
              </div>
              <ul className="space-y-1 text-[11px] text-slate-300 leading-snug">
                {def.acceptanceRulesDesc.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-sky-400 font-mono-tabular">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-1 text-[10px] font-mono-tabular text-slate-500">
                Impacts: {def.impactDomains.map((d) => DOMAIN_LABELS[d]).join(', ')}
              </div>
            </div>
          </aside>

          {/* CENTER PANEL (6 cols): Interactive Mechanic + Guided Stepper */}
          <section className="lg:col-span-6 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#090E1A] overflow-y-auto p-4 space-y-4">
            {guidedMode && showStepDrawer && (
              <div className="rounded-xl border border-sky-500/35 bg-[#0C172B] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-display font-bold text-sky-300">
                    <Compass className="w-4 h-4 shrink-0" />
                    <span>Step-by-Step Guide ({def.code})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStepDrawer(false)}
                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    Hide guide
                  </button>
                </div>
                <ol className="space-y-1 text-xs text-slate-200">
                  {def.stepByStepGuide.map((stepText, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-snug">
                      <span className="font-mono-tabular text-[11px] font-bold text-sky-400 shrink-0">
                        {idx + 1}.
                      </span>
                      <span>{stepText}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Interactive Playable Mechanic */}
            <div className="rounded-xl border border-slate-800 bg-[#070B14] p-4">
              {def.mechanicFamily === 'cards_priority' && (
                <CardsPriorityMechanic
                  def={def}
                  payload={workingPayload}
                  onChange={handlePayloadChange}
                />
              )}
              {def.mechanicFamily === 'allocation_compare' && (
                <AllocationCompareMechanic
                  def={def}
                  payload={workingPayload}
                  onChange={handlePayloadChange}
                />
              )}
              {def.mechanicFamily === 'network_sim' && (
                <NetworkSimMechanic
                  def={def}
                  payload={workingPayload}
                  onChange={handlePayloadChange}
                />
              )}
              {def.mechanicFamily === 'timeline_gantt' && (
                <TimelineGanttMechanic
                  def={def}
                  payload={workingPayload}
                  onChange={handlePayloadChange}
                />
              )}
              {def.mechanicFamily === 'coop_voting_gate' && (
                <CoopVotingGateMechanic
                  def={def}
                  payload={workingPayload}
                  onChange={handlePayloadChange}
                />
              )}
              {def.mechanicFamily === 'risk_incident_matrix' && (
                <RiskIncidentMatrixMechanic
                  def={def}
                  payload={workingPayload}
                  onChange={handlePayloadChange}
                />
              )}
              {def.mechanicFamily === 'spatial_mass_assembly' && (
                <SpatialMassAssemblyMechanic
                  def={def}
                  payload={workingPayload}
                  onChange={handlePayloadChange}
                />
              )}
              {def.mechanicFamily === 'signal_orbital_globe' && (
                <SignalOrbitalGlobeMechanic
                  def={def}
                  payload={workingPayload}
                  sharedState={sharedState}
                  difficulty={difficulty}
                  onChange={handlePayloadChange}
                />
              )}
              {def.mechanicFamily === 'diagnostics_vibration' && (
                <DiagnosticsVibrationMechanic
                  def={def}
                  payload={workingPayload}
                  onChange={handlePayloadChange}
                />
              )}
            </div>
          </section>

          {/* RIGHT PANEL (3 cols): Deltas, Causal Validation, Version History, Comments */}
          <aside className="lg:col-span-3 bg-[#070B14] flex flex-col min-h-0 overflow-hidden">
            {/* Sub-tabs */}
            <div className="grid grid-cols-3 border-b border-slate-800 bg-[#0A101D] shrink-0">
              <button
                type="button"
                onClick={() => setRightTab('validation')}
                className={`py-2.5 px-2 text-[11px] font-semibold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                  rightTab === 'validation'
                    ? 'border-sky-400 text-sky-300 bg-[#0D1628]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Validation</span>
              </button>
              <button
                type="button"
                onClick={() => setRightTab('history')}
                className={`py-2.5 px-2 text-[11px] font-semibold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                  rightTab === 'history'
                    ? 'border-sky-400 text-sky-300 bg-[#0D1628]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({instanceState.history.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRightTab('comments')}
                className={`py-2.5 px-2 text-[11px] font-semibold flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
                  rightTab === 'comments'
                    ? 'border-sky-400 text-sky-300 bg-[#0D1628]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Notes ({instanceState.comments.length})</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
              {rightTab === 'validation' && (
                <>
                  {/* Overall result banner */}
                  <div
                    className={`rounded-lg border p-3 space-y-1 ${
                      displayValidation.passed
                        ? 'bg-[#0C1F1A] border-emerald-500/50 text-emerald-200'
                        : 'bg-[#221015] border-rose-500/50 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {displayValidation.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span>
                        {displayValidation.passed
                          ? 'Simulation Passed — Ready to Confirm'
                          : 'Blockers Detected'}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90 leading-snug">
                      {displayValidation.summaryText}
                    </p>
                  </div>

                  {/* Before / After Deltas */}
                  {displayValidation.deltas.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10.5px] font-mono-tabular uppercase tracking-wider text-slate-400 font-bold">
                        Estimated Delta (Before → After)
                      </div>
                      {displayValidation.deltas.map((d, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-800 bg-[#0B1220] px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-slate-300 truncate">{d.metric}</span>
                          <span className="font-mono-tabular font-bold flex items-center gap-1 shrink-0">
                            <span className="text-slate-500">{d.before}</span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span className={d.improved ? 'text-emerald-400' : 'text-amber-300'}>
                              {d.after} {d.unit}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Causal Criteria (Blockers vs Warnings) */}
                  <div className="space-y-1.5">
                    <div className="text-[10.5px] font-mono-tabular uppercase tracking-wider text-slate-400 font-bold">
                      Causal Criteria Breakdown
                    </div>
                    {displayValidation.criteria.map((c) => {
                      const isBlockerFail = !c.passed && c.severity === 'blocker';
                      const isWarnFail = !c.passed && c.severity === 'warning';
                      return (
                        <div
                          key={c.id}
                          className={`rounded-lg border px-2.5 py-2 space-y-1 ${
                            c.passed
                              ? 'bg-[#0B171B] border-emerald-500/30'
                              : isBlockerFail
                                ? 'bg-[#1F0F15] border-rose-500/50'
                                : 'bg-[#1B170D] border-amber-500/45'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 text-[11px] font-semibold">
                            <span className="flex items-center gap-1.5 text-white">
                              {c.passed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : isWarnFail ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              ) : (
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              )}
                              <span>{c.label}</span>
                            </span>
                            <span
                              className={`font-mono-tabular text-[9.5px] uppercase shrink-0 ${
                                c.passed
                                  ? 'text-emerald-400'
                                  : isBlockerFail
                                    ? 'text-rose-400'
                                    : 'text-amber-300'
                              }`}
                            >
                              {c.passed ? 'PASS' : c.severity === 'blocker' ? 'BLOCKER' : 'WARNING'}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-300 leading-snug">{c.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {rightTab === 'history' && (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-400">
                    Saved and confirmed versions of <strong>{def.code}</strong>. You can revert to any previous version.
                  </div>
                  {instanceState.history.length === 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-[#0B111E] p-3 text-xs text-slate-400">
                      No versions recorded for this mission yet.
                    </div>
                  ) : (
                    instanceState.history.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-slate-800 bg-[#0B1220] p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono-tabular">
                          <span className="font-bold text-sky-400">v{entry.version}</span>
                          <span className="text-slate-400">{entry.timestamp}</span>
                        </div>
                        <div className="text-xs font-semibold text-white">{entry.summary}</div>
                        <div className="text-[11px] text-slate-300 italic">
                          &ldquo;{entry.justification}&rdquo;
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span
                            className="text-[10.5px] font-medium"
                            style={{ color: ROLE_MAP[entry.authorRole].colorHex }}
                          >
                            {entry.authorName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              soundFx.playKeyClick();
                              onRevertVersion(code, entry.id);
                            }}
                            className="px-2 py-0.5 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-[10.5px] text-slate-200 font-semibold cursor-pointer"
                          >
                            Revert
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {rightTab === 'comments' && (
                <div className="space-y-3">
                  <form onSubmit={handlePostComment} className="flex gap-1.5">
                    <input
                      type="text"
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Review note for the team..."
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  <div className="space-y-2">
                    {instanceState.comments.length === 0 ? (
                      <div className="rounded-lg border border-slate-800 bg-[#0B111E] p-3 text-xs text-slate-400">
                        No comments yet. Log team agreements or change requests here.
                      </div>
                    ) : (
                      instanceState.comments.map((cm) => (
                        <div
                          key={cm.id}
                          className="rounded-lg border border-slate-800 bg-[#0B1220] p-2.5 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span
                              className="font-semibold"
                              style={{ color: ROLE_MAP[cm.authorRole].colorHex }}
                            >
                              {cm.authorName}
                            </span>
                            <span className="font-mono-tabular text-slate-500">{cm.timestamp}</span>
                          </div>
                          <p className="text-xs text-slate-200 leading-snug">{cm.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* CONFIRMATION JUSTIFICATION POPOVER BAR */}
        {showConfirmBox && (
          <form
            onSubmit={handleConfirmSubmit}
            className="px-4 py-2.5 bg-[#0C1D1A] border-t border-emerald-500/50 flex flex-wrap items-center gap-2.5 shrink-0"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={`Brief confirmation rationale for ${def.code} (optional)...`}
              className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-[#07110F] border border-emerald-500/40 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              Seal &amp; Publish Version
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmBox(false)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-600 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </form>
        )}

        {/* BOTTOM ACTION BAR */}
        <footer className="px-4 py-2.5 bg-[#0B1222] border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGuidedMode(true);
                setShowStepDrawer((v) => !v);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-[#0F172A] hover:border-slate-500 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ListChecks className="w-3.5 h-3.5 text-sky-400" />
              <span>Step-by-step</span>
            </button>

            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                undoStack.length > 0
                  ? 'border-slate-700 bg-[#0F172A] hover:border-slate-500 text-slate-200 cursor-pointer'
                  : 'border-slate-800 bg-slate-900/60 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-[#0F172A] hover:border-slate-500 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundFx.playKeyClick();
                onSaveDraft(code, workingPayload, undoStack);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-600 bg-[#101A2E] hover:border-slate-400 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-slate-300" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateClick}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate / Check</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFx.playKeyClick();
                const res = evaluateMinigame(def, workingPayload, sharedState, difficulty);
                setLiveValidation(res);
                onRequestReview(code, workingPayload, undoStack, res);
              }}
              className="px-3 py-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Request Review</span>
            </button>

            <button
              type="button"
              disabled={!evaluatedNow.passed}
              onClick={() => {
                soundFx.playKeyClick();
                setShowConfirmBox(true);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                evaluatedNow.passed
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirm Decision</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
