import { MINIGAMES_72, PHASE_6_MAP } from '../data/minigamesData';
import {
  CARGO_MODULES,
  DIFFICULTY_CONFIGS,
  ROLE_MANUAL_GUIDES,
  ROLE_MAP,
  ROOM_MAP,
} from '../data/missionData';
import type {
  CargoModuleState,
  DifficultyId,
  MinigameInstanceState,
  MissionPhaseNumber,
  RoleId,
  SharedMissionState,
} from '../types/mission';

export interface AriaContext {
  activeRole: RoleId;
  difficulty: DifficultyId;
  currentPhase: MissionPhaseNumber;
  sharedState: SharedMissionState;
  minigameStates: Record<string, MinigameInstanceState>;
  installedModuleIds?: string[];
  cargoStates?: Record<string, CargoModuleState>;
}

export interface AriaChatMessage {
  id: string;
  sender: 'aria' | 'user';
  text: string;
  timestamp: string;
}

export const ARIA_QUICK_PROMPTS = [
  "What's my next task?",
  'Check mission risks',
  'Explain current phase',
  'Rocket specs & Annex C',
] as const;

export function buildAriaGreeting(ctx: AriaContext): string {
  const roleDef = ROLE_MAP[ctx.activeRole];
  const diffCfg = DIFFICULTY_CONFIGS[ctx.difficulty];
  const phaseMeta = PHASE_6_MAP[ctx.currentPhase];
  const myPhaseMissions = MINIGAMES_72.filter(
    (m) => m.phaseNumber === ctx.currentPhase && m.roleId === ctx.activeRole,
  );
  const pending = myPhaseMissions.filter(
    (m) => ctx.minigameStates[m.code]?.status !== 'confirmado',
  );
  const dirtyCount = ctx.sharedState.recalcRequiredCodes.length;

  const lines: string[] = [
    `Hey, how can I help you?`,
    `Ask me about your current phase tasks, rocket specs, or mission strategy.`,
    `Active profile: ${roleDef.name} · ${diffCfg.label} (${diffCfg.targetName}) · ${phaseMeta.code}: ${phaseMeta.title}.`,
  ];

  if (dirtyCount > 0) {
    lines.push(
      `Priority alert: ${dirtyCount} mission(s) require recalculation (${ctx.sharedState.recalcRequiredCodes.join(', ')}) after a shared state change.`,
    );
  } else if (pending.length > 0) {
    const next = pending[0];
    lines.push(
      `Next task in ${phaseMeta.code}: "${next.code} · ${next.title}" (${pending.length}/3 remaining for your role).`,
    );
  } else {
    lines.push(
      `All 3 of your ${phaseMeta.code} missions are confirmed. Coordinate with your crew or vote on Gate ${phaseMeta.gateCode ?? 'next'}.`,
    );
  }

  return lines.join('\n\n');
}

export function buildAriaResponse(rawQuery: string, ctx: AriaContext): string {
  const q = rawQuery.trim().toLowerCase();
  const roleDef = ROLE_MAP[ctx.activeRole];
  const roleGuide = ROLE_MANUAL_GUIDES[ctx.activeRole];
  const diffCfg = DIFFICULTY_CONFIGS[ctx.difficulty];
  const phaseMeta = PHASE_6_MAP[ctx.currentPhase];
  const myPhaseMissions = MINIGAMES_72.filter(
    (m) => m.phaseNumber === ctx.currentPhase && m.roleId === ctx.activeRole,
  );
  const pending = myPhaseMissions.filter(
    (m) => ctx.minigameStates[m.code]?.status !== 'confirmado',
  );
  const phaseAll = MINIGAMES_72.filter((m) => m.phaseNumber === ctx.currentPhase);
  const phaseConfirmed = phaseAll.filter(
    (m) => ctx.minigameStates[m.code]?.status === 'confirmado',
  ).length;

  // 1. Role & Strategy / Explain Current Phase
  if (
    q.includes('phase') ||
    q.includes('explain') ||
    q.includes('strategy') ||
    q.includes('role') ||
    q.includes('responsibility') ||
    q.includes('objective') ||
    q.includes('goal')
  ) {
    const bullets = roleGuide.whyTeamNeedsYou.map((line, i) => `${i + 1}. ${line}`).join('\n');
    const gateNote = phaseMeta.gateCode
      ? `Phase Gate: ${phaseMeta.gateCode} requires unanimous approval from all 4 roles in the Gates Room before advancing cleanly.`
      : `Confirm all 12 team missions in ${phaseMeta.code} to build clean telemetry for the next gate.`;

    return [
      `${phaseMeta.code}: ${phaseMeta.title} (${phaseConfirmed}/${phaseAll.length} team missions confirmed)`,
      `Phase focus: ${phaseMeta.focus}`,
      `${roleDef.name} Focus — "${roleDef.focusQuestion}"\n${bullets}`,
      `${gateNote}\n${roleGuide.meetingCoordination}`,
    ].join('\n\n');
  }

  // 2. Mission Risks & Alerts
  if (q.includes('risk') || q.includes('alert') || q.includes('recalc') || q.includes('danger')) {
    const dirty = ctx.sharedState.recalcRequiredCodes;
    const failedAnnex = ctx.sharedState.anexoCChecks.filter((a) => !a.passed);
    const riskPct = ctx.sharedState.riesgoEstado.riskPct;
    const maxRiskPct = ctx.sharedState.riesgoEstado.maxAllowedRiskPct;
    const healthPct = ctx.sharedState.riesgoEstado.vehicleHealthPct;
    const riskHeader =
      riskPct > maxRiskPct
        ? `Risk Alert: ${riskPct}% exceeds the ${maxRiskPct}% safe threshold (Vehicle Health: ${healthPct}%).`
        : `Nominal Risk Profile: ${riskPct}% / ${maxRiskPct}% max (Vehicle Health: ${healthPct}%).`;

    const recalcLine =
      dirty.length > 0
        ? `Pending Recalculations (${dirty.length}): ${dirty.join(', ')}. Re-open and validate these missions to clear dependency drift.`
        : `Dependency Integrity: All confirmed missions are synchronized with zero recalculation alerts.`;

    const annexLines =
      failedAnnex.length === 0
        ? 'Annex C Audit: All 6 cross-cutting pillars are currently passing.'
        : `Failing Annex C Pillars (${failedAnnex.length}/6):\n${failedAnnex
            .map((f) => `• ${f.domain}: ${f.label} (${f.detail})`)
            .join('\n')}`;

    return [riskHeader, recalcLine, annexLines].join('\n\n');
  }

  // 3. Rocket Specs, Telemetry & Annex C
  if (
    q.includes('rocket') ||
    q.includes('spec') ||
    q.includes('annex') ||
    q.includes('mass') ||
    q.includes('power') ||
    q.includes('budget') ||
    q.includes('delta') ||
    q.includes('cargo') ||
    q.includes('module') ||
    q.includes('gate') ||
    q.includes('launch') ||
    q.includes('ready')
  ) {
    const installedCount = ctx.installedModuleIds?.length ?? 0;
    const deliveredCargo = ctx.cargoStates
      ? CARGO_MODULES.filter((c) => ctx.cargoStates?.[c.id]?.delivered).length
      : 0;
    const failed = ctx.sharedState.anexoCChecks.filter((a) => !a.passed);
    const gates = ctx.sharedState.riesgoEstado.gatesApproved;
    const { masaVolumen, energia, comunicaciones, presupuestoCalendario, riesgoEstado, objetivos } =
      ctx.sharedState;

    const specsSummary = [
      `Vehicle Telemetry (${diffCfg.targetName}):`,
      `• Mass & Volume: ${masaVolumen.totalMassKg.toLocaleString()} / ${masaVolumen.maxMassKg.toLocaleString()} kg · ${masaVolumen.occupiedVolumeM3}/${masaVolumen.maxVolumeM3} m³`,
      `• Power & RF: ${energia.netMarginW >= 0 ? `+${energia.netMarginW}` : energia.netMarginW} W margin · ${comunicaciones.downlinkMbps} Mbps Ka-link`,
      `• Delta-v & Science: ${riesgoEstado.deltaVMps}/${riesgoEstado.minDeltaVMps} m/s · ${objetivos.scienceScore}/${objetivos.minScienceRequired} pts`,
      `• Budget & Schedule: $${presupuestoCalendario.allocatedBudgetM}M/$${presupuestoCalendario.maxBudgetM}M · ${presupuestoCalendario.plannedDurationDays}/${presupuestoCalendario.maxScheduleDays} days`,
      `• Hangar Integration: ${installedCount}/12 3D modules · ${deliveredCargo}/${CARGO_MODULES.length} cargo delivered · Gates ${gates.length}/4`,
    ].join('\n');

    const annexSummary =
      failed.length === 0
        ? 'Annex C Audit: All 6 cross-cutting pillars are green for launch.'
        : `Annex C Gaps (${failed.length} failing):\n${failed
            .map((f) => `• ${f.domain}: ${f.label} — ${f.detail}`)
            .join('\n')}`;

    return [specsSummary, annexSummary].join('\n\n');
  }

  // 4. Next Task / Pending Missions (and general default)
  if (pending.length > 0) {
    const taskLines = pending.map(
      (m, idx) =>
        `${idx + 1}. ${m.code} · "${m.title}" — ${m.mechanicSummary} (Station: ${ROOM_MAP[roleDef.roomId].shortLabel})`,
    );
    return [
      `Immediate Tasks in ${phaseMeta.code} (${phaseConfirmed}/${phaseAll.length} team missions confirmed):`,
      taskLines.join('\n'),
      `Open any mission from the "Missions" tab on this tablet or your Workstation console, then run "Check / Simulate" before confirming.`,
    ].join('\n\n');
  }

  const dirty = ctx.sharedState.recalcRequiredCodes;
  if (dirty.length > 0) {
    return [
      `Your ${phaseMeta.code} missions are confirmed, but ${dirty.length} mission(s) flagged Recalculation Required: ${dirty.join(', ')}.`,
      `Open them from the "Gates" tab on this tablet to re-validate shared parameters.`,
    ].join('\n\n');
  }

  return [
    `All ${myPhaseMissions.length} of your ${phaseMeta.code} missions are confirmed (${phaseConfirmed}/12 team total).`,
    `Review the other roles' progress in the "Schedule" tab or convene in the Briefing Room to vote on Gate ${phaseMeta.gateCode ?? 'current'}.`,
  ].join('\n\n');
}
