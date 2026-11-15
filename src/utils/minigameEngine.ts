import { MINIGAMES_72, MINIGAME_MAP, PHASE_6_MAP } from '../data/minigamesData';
import { DIFFICULTY_CONFIGS, LAUNCH_CINEMATIC_DURATIONS } from '../data/missionData';
import type {
  ActiveConflict,
  CargoModuleState,
  DifficultyId,
  LaunchFailureMode,
  LaunchOutcome,
  MetricDelta,
  MinigameDefinition,
  MinigameInstanceState,
  MinigamePayload,
  MinigameValidationResult,
  MissionPhaseNumber,
  MissionResources,
  RoleId,
  SharedMissionState,
  ValidationCriterion,
} from '../types/mission';

function createInitialInstance(def: MinigameDefinition): MinigameInstanceState {
  return {
    code: def.code,
    status: 'no_iniciado',
    dirtyNeedsRecalc: false,
    draftPayload: JSON.parse(JSON.stringify(def.defaultPayload)) as MinigamePayload,
    confirmedPayload: null,
    undoStack: [],
    lastValidation: null,
    history: [],
    comments: [],
    updatedAt: '00:00:00',
  };
}

export function createInitialMinigameStates(): Record<string, MinigameInstanceState> {
  const map: Record<string, MinigameInstanceState> = {};
  for (const def of MINIGAMES_72) {
    map[def.code] = createInitialInstance(def);
  }
  return map;
}

export function getEffectivePayload(
  states: Record<string, MinigameInstanceState>,
  code: string,
): MinigamePayload {
  const st = states[code];
  if (st?.confirmedPayload) return st.confirmedPayload;
  if (st?.draftPayload) return st.draftPayload;
  return MINIGAME_MAP[code].defaultPayload;
}

export function isConfirmed(
  states: Record<string, MinigameInstanceState>,
  code: string,
): boolean {
  return states[code]?.status === 'confirmado';
}

export function computeSharedMissionState(
  states: Record<string, MinigameInstanceState>,
  difficulty: DifficultyId,
  cargoStates: Record<string, CargoModuleState>,
): SharedMissionState {
  const diff = DIFFICULTY_CONFIGS[difficulty];

  let cargoRiskPenalty = 0;
  let cargoSciBonus = 0;
  for (const st of Object.values(cargoStates)) {
    cargoRiskPenalty += st.riskPenaltyPct;
    if (st.delivered && st.integrity > 0) {
      cargoSciBonus += 4;
    }
  }

  // 1. Objetivos y ciencia
  const c11P = getEffectivePayload(states, 'C11');
  const c12P = getEffectivePayload(states, 'C12');
  const c21P = getEffectivePayload(states, 'C21');
  const c22P = getEffectivePayload(states, 'C22');
  const c23P = getEffectivePayload(states, 'C23');
  const c31P = getEffectivePayload(states, 'C31');
  const c41P = getEffectivePayload(states, 'C41');
  const a11P = getEffectivePayload(states, 'A11');
  const a13P = getEffectivePayload(states, 'A13');

  const c11Items = MINIGAME_MAP['C11'].items.filter((i) => c11P.selectedIds.includes(i.id));
  const c12Items = MINIGAME_MAP['C12'].items.filter((i) => c12P.selectedIds.includes(i.id));
  const c21Items = MINIGAME_MAP['C21'].items.filter((i) => c21P.selectedIds.includes(i.id));
  const c22Items = MINIGAME_MAP['C22'].items.filter((i) => c22P.selectedIds.includes(i.id));
  const c41Items = MINIGAME_MAP['C41'].items.filter((i) => c41P.selectedIds.includes(i.id));

  let scienceScore = 0;
  if (isConfirmed(states, 'C11')) scienceScore += c11Items.reduce((s, i) => s + (i.sciencePts ?? 0), 0) * 0.4;
  if (isConfirmed(states, 'C12')) scienceScore += c12Items.reduce((s, i) => s + (i.sciencePts ?? 0), 0) * 0.35;
  if (isConfirmed(states, 'C21')) scienceScore += c21Items.reduce((s, i) => s + (i.sciencePts ?? 0), 0) * 0.45;
  if (isConfirmed(states, 'C22')) scienceScore += c22Items.reduce((s, i) => s + (i.sciencePts ?? 0), 0) * 0.4;
  if (isConfirmed(states, 'C41')) scienceScore += c41Items.reduce((s, i) => s + (i.sciencePts ?? 0), 0) * 0.5;
  if (isConfirmed(states, 'C53')) scienceScore += 14;
  if (isConfirmed(states, 'A11')) scienceScore += a11P.zones.length * 4;
  if (isConfirmed(states, 'A13')) scienceScore += a13P.reportFindings.length * 5;
  scienceScore = Math.round(scienceScore + cargoSciBonus);

  const selectedObjLabel =
    c11Items[0]?.label ?? 'No primary objective confirmed (C11)';
  const primaryExp =
    c21Items[0]?.label ?? 'Primary experiment pending (C21)';
  const coveragePct = Math.min(
    100,
    MINIGAME_MAP['C23'].items
      .filter((i) => c23P.zones.includes(i.id))
      .reduce((s, i) => s + (i.coveragePct ?? 18), 0),
  );
  const precisionErr =
    Math.abs(c31P.offsetValue - 3) * 1.4 +
    Math.abs(c31P.gainValue - 1.85) * 16 +
    Math.abs(c31P.filterValue - 60) * 0.35;
  const precisionPct = Math.max(40, Math.min(99, Math.round(100 - precisionErr)));

  // 2. Masa y Volumen
  const m11Items = MINIGAME_MAP['M11'].items.filter((i) =>
    getEffectivePayload(states, 'M11').placedItems.some((p) => p.id === i.id),
  );
  const m41Items = MINIGAME_MAP['M41'].items.filter((i) =>
    getEffectivePayload(states, 'M41').placedItems.some((p) => p.id === i.id),
  );
  const baseMass = isConfirmed(states, 'M41')
    ? m41Items.reduce((s, i) => s + (i.massKg ?? 0), 0)
    : m11Items.reduce((s, i) => s + (i.massKg ?? 0), 0);
  const instMass = isConfirmed(states, 'C41')
    ? c41Items.reduce((s, i) => s + (i.massKg ?? 0), 0)
    : c12Items.reduce((s, i) => s + (i.massKg ?? 0), 0);
  const totalMassKg = Math.round(baseMass + instMass * 0.45);

  const m12Items = MINIGAME_MAP['M12'].items.filter((i) =>
    getEffectivePayload(states, 'M12').placedItems.some((p) => p.id === i.id),
  );
  const occupiedVolumeM3 = Number(
    Math.max(1.8, m12Items.reduce((s, i) => s + (i.volumeM3 ?? 1.1), 0)).toFixed(1),
  );

  const m41Placed = getEffectivePayload(states, 'M41').placedItems;
  const avgX =
    m41Placed.length > 0
      ? m41Placed.reduce((s, p) => s + (p.x + 1 - 3), 0) / m41Placed.length
      : 0;
  const cgOffsetMm = Math.round(Math.abs(avgX) * 10);
  const m33P = getEffectivePayload(states, 'M33*');
  const structuralMarginFactor = Number(
    (
      1.12 +
      (m33P.dampingLevel / 100) * 0.25 +
      m33P.appliedFixes.length * 0.09 +
      (isConfirmed(states, 'M52') ? 0.08 : 0)
    ).toFixed(2),
  );

  // 3. Power & Energy
  const i41P = getEffectivePayload(states, 'I41');
  const i21P = getEffectivePayload(states, 'I21');
  const activeEnergyDef = isConfirmed(states, 'I41') ? MINIGAME_MAP['I41'] : MINIGAME_MAP['I21'];
  const activeEnergyPayload = isConfirmed(states, 'I41') ? i41P : i21P;
  let generationW = 0;
  let consumptionW = 0;
  for (const nodeId of activeEnergyPayload.activeNodes) {
    const node = activeEnergyDef.items.find((it) => it.id === nodeId);
    if (!node || typeof node.powerW !== 'number') continue;
    if (node.powerW > 0) generationW += node.powerW;
    if (node.powerW < 0) consumptionW += Math.abs(node.powerW);
  }
  const m43P = getEffectivePayload(states, 'M43');
  if (isConfirmed(states, 'M43')) {
    const angleCos = Math.cos((m43P.panelAngleDeg * Math.PI) / 180);
    generationW += Math.round(m43P.panelAreaM2 * 4 * angleCos);
  }
  const netMarginW = generationW - consumptionW;
  const batteryWh = isConfirmed(states, 'I41') ? i41P.batteryWh : i21P.batteryWh;
  const eclipseAutonomyHours = Number((batteryWh / Math.max(120, consumptionW * 0.6)).toFixed(1));

  // 4. Data & Storage
  const c13P = getEffectivePayload(states, 'C13');
  const c32P = getEffectivePayload(states, 'C32');
  const rawGB = isConfirmed(states, 'C32')
    ? Object.values(c32P.allocations).reduce((a, b) => a + b, 0)
    : Object.values(c13P.allocations).reduce((a, b) => a + b, 0);
  const compRatio = isConfirmed(states, 'C32') ? c32P.policyRatio : c13P.policyRatio;
  const generatedGB = Math.round(rawGB * (1 - compRatio / 100));
  const i13P = getEffectivePayload(states, 'I13');
  const storageCapacityGB = Object.values(i13P.allocations).reduce((a, b) => a + b, 0);

  const c52P = getEffectivePayload(states, 'C52');
  const c52Err =
    Math.abs(c52P.offsetValue - 2) * 1.4 +
    Math.abs(c52P.gainValue - 1.9) * 15 +
    Math.abs(c52P.filterValue - 66) * 0.3;
  const dataQualityPct = Math.max(50, Math.min(99, Math.round(100 - c52Err)));

  // 5. Communications
  const commsDef = isConfirmed(states, 'I43') ? MINIGAME_MAP['I43'] : MINIGAME_MAP['I22'];
  const commsPayload = isConfirmed(states, 'I43')
    ? getEffectivePayload(states, 'I43')
    : getEffectivePayload(states, 'I22');
  const activeCommsItems = commsDef.items.filter((i) => commsPayload.activeNodes.includes(i.id));
  const downlinkMbps = activeCommsItems.reduce((s, i) => s + (i.bandwidthMbps ?? 0), 0);
  const groundStationsCount = activeCommsItems.filter((i) => i.category === 'Ground').length;
  const windowMinutesPerDay = groundStationsCount * 38;
  const packetSuccessPct = isConfirmed(states, 'I51') ? 99 : isConfirmed(states, 'I43') ? 95 : 88;

  // 6. Budget & Schedule
  const g41P = getEffectivePayload(states, 'G41');
  const g11P = getEffectivePayload(states, 'G11');
  const budSource = isConfirmed(states, 'G41') ? g41P : g11P;
  const baseAlloc = Object.values(budSource.allocations).reduce((a, b) => a + b, 0);
  const contingencyReserveM = Math.round((baseAlloc * budSource.policyRatio) / 100);
  const allocatedBudgetM = baseAlloc + contingencyReserveM;

  const g42P = getEffectivePayload(states, 'G42');
  const g12P = getEffectivePayload(states, 'G12');
  const schedTasks = isConfirmed(states, 'G42') ? g42P.tasks : g12P.tasks;
  const plannedDurationDays = schedTasks.reduce(
    (maxD, t) => Math.max(maxD, t.startDay + t.durationDays - 1),
    0,
  );
  const criticalSlackDays = diff.maxScheduleDays - plannedDurationDays;

  // 7. Riesgo, Δv y Estado
  const g21Mit = getEffectivePayload(states, 'G21').mitigatedIds.length;
  const g33Mit = getEffectivePayload(states, 'G33').mitigatedIds.length;
  const g52Mit = getEffectivePayload(states, 'G52').mitigatedIds.length;
  const o11Fixes = getEffectivePayload(states, 'O11*').appliedFixes.length;
  const o16Fixes = getEffectivePayload(states, 'O16*').appliedFixes.length;
  const o17Fixes = getEffectivePayload(states, 'O17*').appliedFixes.length;

  let riskPct = diff.baseRiskPct + 14 + cargoRiskPenalty;
  riskPct -= g21Mit * 2 + g33Mit * 2 + g52Mit * 2;
  if (isConfirmed(states, 'M33*')) riskPct -= 4;
  if (isConfirmed(states, 'I52')) riskPct -= 2;
  if (isConfirmed(states, 'I53')) riskPct -= 2;
  riskPct -= (o11Fixes + o16Fixes + o17Fixes);
  riskPct = Math.max(4, Math.min(85, Math.round(riskPct)));

  const i42P = getEffectivePayload(states, 'I42');
  const dryRefKg = Math.max(1400, totalMassKg * 0.52);
  const deltaVMps = Math.round(445 * 9.81 * Math.log((dryRefKg + i42P.propellantKg) / dryRefKg));

  const gatesApproved = ['G13', 'G23', 'G43', 'G53'].filter((g) => isConfirmed(states, g));
  const recalcRequiredCodes = Object.values(states)
    .filter((s) => s.dirtyNeedsRecalc)
    .map((s) => s.code);

  const openAnomalies = Math.max(0, 4 - (isConfirmed(states, 'G52') ? g52Mit : 0));
  const resolvedAnomalies = g52Mit + o11Fixes;
  const vehicleHealthPct = Math.max(
    45,
    Math.min(100, 100 - Math.max(0, riskPct - diff.maxAllowedRiskPct) - openAnomalies * 4),
  );

  // Annex C Cross-Cutting Validations
  const anexoCChecks = [
    {
      id: 'ax-science',
      domain: 'Science & Objectives',
      label: `Science return >= ${diff.minSciencePts} pts`,
      passed: scienceScore >= diff.minSciencePts && isConfirmed(states, 'C11'),
      detail: `${scienceScore} / ${diff.minSciencePts} pts · Coverage ${coveragePct}%`,
    },
    {
      id: 'ax-mass-vol',
      domain: 'Mass & Volume',
      label: `Mass <= ${diff.maxMassKg.toLocaleString()} kg & Volume <= ${diff.maxVolumeM3} m³`,
      passed: totalMassKg <= diff.maxMassKg && occupiedVolumeM3 <= diff.maxVolumeM3,
      detail: `${totalMassKg.toLocaleString()} kg · ${occupiedVolumeM3} m³ · CoG ±${cgOffsetMm} mm`,
    },
    {
      id: 'ax-power',
      domain: 'Power & Autonomy',
      label: 'Net power balance >= +25 W & >= 4.0h eclipse',
      passed: netMarginW >= 25 && eclipseAutonomyHours >= 4.0,
      detail: `+${netMarginW} W margin · ${batteryWh} Wh (${eclipseAutonomyHours} h)`,
    },
    {
      id: 'ax-data-comms',
      domain: 'Data & Comms',
      label: `SSR Memory >= Data & Downlink >= ${diff.minCommsMbps} Mbps`,
      passed: storageCapacityGB >= generatedGB && downlinkMbps >= diff.minCommsMbps,
      detail: `${generatedGB}/${storageCapacityGB} GB · ${downlinkMbps} Mbps (${groundStationsCount} DSN)`,
    },
    {
      id: 'ax-budget-time',
      domain: 'Budget & Schedule',
      label: `Cost <= $${diff.maxBudgetM}M & Schedule <= ${diff.maxScheduleDays} days`,
      passed: allocatedBudgetM <= diff.maxBudgetM && criticalSlackDays >= 0,
      detail: `$${allocatedBudgetM}/${diff.maxBudgetM}M (UFE $${contingencyReserveM}M) · Slack ${criticalSlackDays}d`,
    },
    {
      id: 'ax-risk-gates',
      domain: 'Risk & Authorization',
      label: `Risk <= ${diff.maxAllowedRiskPct}%, Δv >= ${diff.minDeltaVMps} m/s & G53 GO`,
      passed:
        riskPct <= diff.maxAllowedRiskPct &&
        deltaVMps >= diff.minDeltaVMps &&
        gatesApproved.includes('G53'),
      detail: `${riskPct}% risk · Δv ${deltaVMps} m/s · Gates ${gatesApproved.length}/4`,
    },
  ];

  return {
    objetivos: {
      selectedObjectiveLabel: selectedObjLabel,
      primaryExperiment: primaryExp,
      secondaryExperimentsCount: c22Items.length,
      instrumentsCount: isConfirmed(states, 'C41') ? c41Items.length : c12Items.length,
      scienceScore,
      minScienceRequired: diff.minSciencePts,
      precisionPct,
      coveragePct,
      discoveriesPublished: isConfirmed(states, 'A13') ? a13P.reportFindings.length : 0,
    },
    masaVolumen: {
      totalMassKg,
      maxMassKg: diff.maxMassKg,
      occupiedVolumeM3,
      maxVolumeM3: diff.maxVolumeM3,
      cgOffsetMm,
      structuralMarginFactor,
    },
    energia: {
      generationW,
      consumptionW,
      netMarginW,
      batteryWh,
      eclipseAutonomyHours,
    },
    datos: {
      generatedGB,
      storageCapacityGB,
      capturedObservations: isConfirmed(states, 'A11') ? a11P.zones.length : 0,
      dataQualityPct,
    },
    comunicaciones: {
      downlinkMbps,
      minRequiredMbps: diff.minCommsMbps,
      windowMinutesPerDay,
      groundStationsCount,
      packetSuccessPct,
    },
    presupuestoCalendario: {
      allocatedBudgetM,
      maxBudgetM: diff.maxBudgetM,
      contingencyReserveM,
      plannedDurationDays,
      maxScheduleDays: diff.maxScheduleDays,
      criticalSlackDays,
    },
    riesgoEstado: {
      riskPct,
      maxAllowedRiskPct: diff.maxAllowedRiskPct,
      openAnomalies,
      resolvedAnomalies,
      gatesApproved,
      vehicleHealthPct,
      deltaVMps,
      minDeltaVMps: diff.minDeltaVMps,
    },
    recalcRequiredCodes,
    anexoCChecks,
  };
}

export function evaluateMinigame(
  def: MinigameDefinition,
  payload: MinigamePayload,
  missionState: SharedMissionState,
  difficulty: DifficultyId,
): MinigameValidationResult {
  const diff = DIFFICULTY_CONFIGS[difficulty];
  const criteria: ValidationCriterion[] = [];
  const deltas: MetricDelta[] = [];

  if (def.mechanicFamily === 'cards_priority') {
    const selected = def.items.filter((i) => payload.selectedIds.includes(i.id));
    const totalSci = selected.reduce((s, i) => s + (i.sciencePts ?? 0), 0);
    const totalMass = selected.reduce((s, i) => s + (i.massKg ?? 0), 0);
    const totalPower = selected.reduce((s, i) => s + (i.powerW ?? 0), 0);
    const needMin = def.code === 'C41' || def.code === 'C42' ? 3 : 2;
    const minSci = def.code === 'C11' ? 40 : def.code === 'C41' ? 75 : def.code === 'C22' ? 22 : 45;

    criteria.push({
      id: 'count',
      label: `Minimum selection (${needMin} items)`,
      passed: selected.length >= needMin && selected.length <= 3,
      severity: 'blocker',
      detail:
        selected.length >= needMin && selected.length <= 3
          ? `${selected.length} active cards in priority order (#1: ${selected[0]?.label ?? '-'}).`
          : `You selected ${selected.length}. You must select between ${needMin} and 3 compatible cards.`,
    });
    criteria.push({
      id: 'sci-yield',
      label: `Science return >= ${minSci} pts`,
      passed: totalSci >= minSci,
      severity: 'blocker',
      detail:
        totalSci >= minSci
          ? `Combined science yield: ${totalSci} pts.`
          : `Only ${totalSci} pts total (need ${minSci - totalSci} more pts to validate objectives).`,
    });
    if (totalPower > 220) {
      criteria.push({
        id: 'pwr-warn',
        label: 'High power demand',
        passed: false,
        severity: 'warning',
        detail: `This selection demands ${totalPower} W; coordinate solar expansion with Engineering/Management.`,
      });
    } else {
      criteria.push({
        id: 'pwr-ok',
        label: 'Preliminary power envelope',
        passed: true,
        severity: 'warning',
        detail: `Estimated demand of ${totalPower} W and ${totalMass} kg within margin.`,
      });
    }
    deltas.push(
      { metric: 'Science return', before: `${missionState.objetivos.scienceScore}`, after: `${Math.max(missionState.objetivos.scienceScore, totalSci)}`, unit: 'pts', improved: true },
      { metric: 'Instrument load', before: '0', after: `${totalMass}`, unit: 'kg', improved: totalMass <= 240 },
    );
  } else if (def.mechanicFamily === 'allocation_compare') {
    const sum = Object.values(payload.allocations).reduce((a, b) => a + b, 0);
    const minReserve = def.code === 'G41' ? 12 : 15;
    const isBudget = def.code.startsWith('G') && def.code !== 'G22';
    const netValue = isBudget ? Math.round(sum * (1 + payload.policyRatio / 100)) : sum;
    const cap = isBudget ? diff.maxBudgetM : def.code === 'O12*' ? 110 : 95;

    if (def.code === 'G22') {
      const hasSel = Boolean(payload.selectedOptionId);
      criteria.push({
        id: 'cfg-sel',
        label: 'Candidate architecture selected',
        passed: hasSel,
        severity: 'blocker',
        detail: hasSel
          ? `Winning concept selected (${def.items.find((i) => i.id === payload.selectedOptionId)?.label ?? payload.selectedOptionId}).`
          : 'You must pick one of the 3 compared configurations.',
      });
      criteria.push({
        id: 'weights-sum',
        label: 'Multi-criteria weight sum >= 80%',
        passed: sum >= 80 && sum <= 120,
        severity: 'blocker',
        detail: `Current total weight: ${sum}% (target 80%–120%).`,
      });
    } else {
      criteria.push({
        id: 'cap-check',
        label: `Total allocated within cap (<= ${cap} ${def.unitPrimary})`,
        passed: netValue <= cap && sum >= 30,
        severity: 'blocker',
        detail:
          netValue <= cap
            ? `Consolidated total: ${netValue} ${def.unitPrimary} vs ${cap} limit.`
            : `Exceeds limit (${cap}) by ${netValue - cap} ${def.unitPrimary}. Reduce an allocation or adjust policy.`,
      });
      criteria.push({
        id: 'reserve-check',
        label: `Minimum reserve / compression >= ${minReserve}%`,
        passed: payload.policyRatio >= minReserve,
        severity: 'blocker',
        detail:
          payload.policyRatio >= minReserve
            ? `Safety margin configured at ${payload.policyRatio}%.`
            : `${payload.policyRatio}% margin is insufficient (minimum ${minReserve}% required to absorb contingencies).`,
      });
      if (Object.values(payload.allocations).some((v) => v < 6)) {
        criteria.push({
          id: 'starve-warn',
          label: 'Line item below critical allocation',
          passed: false,
          severity: 'warning',
          detail: 'At least one line item has fewer than 6 units; this may slow down downstream testing.',
        });
      }
    }
    deltas.push({
      metric: isBudget ? 'Total budget' : 'Allocated volume / quota',
      before: `${isBudget ? missionState.presupuestoCalendario.allocatedBudgetM : missionState.datos.generatedGB}`,
      after: `${netValue}`,
      unit: def.unitPrimary,
      improved: netValue <= cap,
    });
  } else if (def.mechanicFamily === 'network_sim') {
    const activeItems = def.items.filter((i) => payload.activeNodes.includes(i.id));
    const genW = activeItems.filter((i) => (i.powerW ?? 0) > 0).reduce((s, i) => s + (i.powerW ?? 0), 0);
    const loadW = activeItems.filter((i) => (i.powerW ?? 0) < 0).reduce((s, i) => s + Math.abs(i.powerW ?? 0), 0);
    const netW = genW - loadW;
    const totalMbps = activeItems.reduce((s, i) => s + (i.bandwidthMbps ?? 0), 0);
    const isComms = def.items.some((i) => typeof i.bandwidthMbps === 'number');
    const linkedNodes = new Set(payload.links.flatMap(([a, b]) => [a, b]));
    const allLinked = activeItems.every((i) => linkedNodes.has(i.id));

    criteria.push({
      id: 'net-nodes',
      label: `All active nodes wired (${activeItems.length}/${def.items.length})`,
      passed: activeItems.length >= Math.min(4, def.items.length) && allLinked,
      severity: 'blocker',
      detail:
        activeItems.length >= Math.min(4, def.items.length) && allLinked
          ? `${payload.links.length} active links with zero isolated nodes.`
          : 'Critical nodes are powered off or disconnected from the bus/antenna.',
    });

    if (isComms) {
      const minMbps = def.code === 'I12' ? 18 : def.code === 'I43' ? 34 : 26;
      criteria.push({
        id: 'comms-rate',
        label: `Link throughput >= ${minMbps} Mbps`,
        passed: totalMbps >= minMbps,
        severity: 'blocker',
        detail:
          totalMbps >= minMbps
            ? `Combined bandwidth ${totalMbps} Mbps at ${payload.dutyCyclePct}% duty cycle.`
            : `Data rate (${totalMbps} Mbps) is below ${minMbps} Mbps and will saturate the downlink queue.`,
      });
    } else if (def.code === 'I33') {
      const autonomyH = Number((payload.batteryWh / Math.max(120, loadW * 0.7)).toFixed(1));
      criteria.push({
        id: 'autonomy',
        label: 'Eclipse autonomy >= 6.0 h',
        passed: autonomyH >= 6.0,
        severity: 'blocker',
        detail: `${autonomyH} h available with ${payload.batteryWh} Wh bank under ${loadW} W safe-bus load.`,
      });
    } else if (def.code === 'I23') {
      criteria.push({
        id: 'bus-all',
        label: 'Full integration of all 5 avionics modules',
        passed: activeItems.length === def.items.length && payload.links.length >= 4,
        severity: 'blocker',
        detail: `${activeItems.length}/5 subsystems linked to the SpaceWire OBC.`,
      });
    } else {
      criteria.push({
        id: 'pwr-bal',
        label: 'Positive net power margin >= +40 W',
        passed: netW >= 40,
        severity: 'blocker',
        detail:
          netW >= 40
            ? `Generation ${genW} W vs Load ${loadW} W -> Margin +${netW} W.`
            : `Insufficient margin (${netW} W). Enable auxiliary panels or tune load duty cycle.`,
      });
    }

    deltas.push({
      metric: isComms ? 'Bandwidth' : 'Power margin',
      before: `${isComms ? missionState.comunicaciones.downlinkMbps : missionState.energia.netMarginW}`,
      after: `${isComms ? totalMbps : netW}`,
      unit: isComms ? 'Mbps' : 'W',
      improved: true,
    });
  } else if (def.mechanicFamily === 'timeline_gantt') {
    let depErrors = 0;
    const taskMap = new Map(payload.tasks.map((t) => [t.id, t]));
    for (const t of payload.tasks) {
      if (t.dependsOn) {
        const prev = taskMap.get(t.dependsOn);
        if (prev && t.startDay < prev.startDay + prev.durationDays) {
          depErrors += 1;
        }
      }
    }
    const endDay = payload.tasks.reduce((m, t) => Math.max(m, t.startDay + t.durationDays - 1), 0);
    const maxSpan = def.code === 'G12' ? 230 : def.code === 'G42' ? 75 : 165;
    const slack = maxSpan - endDay;

    criteria.push({
      id: 'gantt-deps',
      label: 'Logical precedence with zero invalid overlaps',
      passed: depErrors === 0,
      severity: 'blocker',
      detail:
        depErrors === 0
          ? 'All sequential dependencies start after their predecessor finishes.'
          : `Detected ${depErrors} dependent task overlap(s); shift start dates to the right.`,
    });
    criteria.push({
      id: 'gantt-slack',
      label: `Duration <= ${maxSpan} days (slack >= 8 days)`,
      passed: slack >= 8,
      severity: 'blocker',
      detail:
        slack >= 8
          ? `Ends on day ${endDay} · Protective slack of ${slack} days.`
          : `Insufficient slack (${slack} d). Compress durations or pull tasks earlier without breaking dependencies.`,
    });
    deltas.push({
      metric: 'Planned horizon',
      before: `${missionState.presupuestoCalendario.plannedDurationDays}`,
      after: `${endDay}`,
      unit: 'days',
      improved: slack >= 8,
    });
  } else if (def.mechanicFamily === 'coop_voting_gate') {
    const roleEntries = Object.entries(payload.votes) as Array<[RoleId, { vote: string; note: string }]>;
    const pendingCount = roleEntries.filter(([, v]) => v.vote === 'pending').length;
    const approveCount = roleEntries.filter(([, v]) => v.vote === 'approve').length;
    const allHaveNotes = roleEntries.every(([, v]) => v.note.trim().length >= 5);

    criteria.push({
      id: 'gate-quorum',
      label: 'Votes cast by all 4 departments',
      passed: pendingCount === 0,
      severity: 'blocker',
      detail:
        pendingCount === 0
          ? `Full quorum (4/4 roles recorded).`
          : `${pendingCount} vote(s) still pending at the cooperative table.`,
    });
    criteria.push({
      id: 'gate-pass',
      label: 'Approval consensus >= 3 favorable votes',
      passed: approveCount >= 3 && Boolean(payload.compromiseId),
      severity: 'blocker',
      detail:
        approveCount >= 3
          ? `Approved by ${approveCount}/4 roles under agreement "${def.items.find((i) => i.id === payload.compromiseId)?.label ?? payload.compromiseId}".`
          : `Only ${approveCount}/4 favorable votes; review objections or adjust the compromise.`,
    });
    if (!allHaveNotes) {
      criteria.push({
        id: 'gate-notes',
        label: 'Justification logged by all roles',
        passed: false,
        severity: 'warning',
        detail: 'Every role is advised to record a brief justification note.',
      });
    }
    deltas.push({
      metric: 'Gates approved',
      before: `${missionState.riesgoEstado.gatesApproved.length}`,
      after: `${Math.min(4, missionState.riesgoEstado.gatesApproved.length + (approveCount >= 3 ? 1 : 0))}`,
      unit: 'gates',
      improved: true,
    });
  } else if (def.mechanicFamily === 'risk_incident_matrix') {
    const mitCount = payload.mitigatedIds.length;
    const minMit = def.code === 'O14*' ? 4 : 3;
    const rawRisk = def.items.reduce((s, i) => s + (i.riskDeltaPct ?? 5), 0);
    const reducedRisk = def.items
      .filter((i) => payload.mitigatedIds.includes(i.id))
      .reduce((s, i) => s + (i.riskDeltaPct ?? 5), 0);
    const residual = Math.max(4, rawRisk - reducedRisk + 6);

    criteria.push({
      id: 'mit-count',
      label: `Controls/closures applied >= ${minMit}/${def.items.length}`,
      passed: mitCount >= minMit,
      severity: 'blocker',
      detail:
        mitCount >= minMit
          ? `${mitCount} items mitigated or verified with evidence.`
          : `Only ${mitCount} mitigated; critical residual risks continue blocking validation.`,
    });
    criteria.push({
      id: 'risk-cap',
      label: `Local residual risk <= 18%`,
      passed: residual <= 18,
      severity: 'blocker',
      detail: `Calculated residual risk: ${residual}% (-${reducedRisk}% reduction).`,
    });
    deltas.push({
      metric: 'Risk index',
      before: `${missionState.riesgoEstado.riskPct}%`,
      after: `${Math.max(4, missionState.riesgoEstado.riskPct - Math.round(reducedRisk * 0.4))}%`,
      unit: '%',
      improved: true,
    });
  } else if (def.mechanicFamily === 'spatial_mass_assembly') {
    // 6x4 bay grid collision and CoG check
    const grid = Array.from({ length: 4 }, () => Array<string | null>(6).fill(null));
    let outOfBounds = false;
    let collisions = 0;
    let sumMass = 0;
    let weightedX = 0;

    for (const p of payload.placedItems) {
      const item = def.items.find((i) => i.id === p.id);
      if (!item) continue;
      const w = p.rotated ? (item.heightCells ?? 1) : (item.widthCells ?? 1);
      const h = p.rotated ? (item.widthCells ?? 1) : (item.heightCells ?? 1);
      const m = item.massKg ?? 100;
      sumMass += m;
      weightedX += (p.x + w / 2 - 3) * m;
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const gx = p.x + dx;
          const gy = p.y + dy;
          if (gx < 0 || gx >= 6 || gy < 0 || gy >= 4) {
            outOfBounds = true;
          } else if (grid[gy][gx] !== null) {
            collisions += 1;
          } else {
            grid[gy][gx] = p.id;
          }
        }
      }
    }

    const cgMm = sumMass > 0 ? Math.round((Math.abs(weightedX) / sumMass) * 18) : 0;
    const allPlaced = payload.placedItems.length >= def.items.length;

    criteria.push({
      id: 'bay-fit',
      label: `All modules placed (${payload.placedItems.length}/${def.items.length}) with zero collisions`,
      passed: allPlaced && !outOfBounds && collisions === 0,
      severity: 'blocker',
      detail:
        allPlaced && !outOfBounds && collisions === 0
          ? `Valid geometric fit inside 6×4 bay (${sumMass} kg assembled).`
          : `Missing parts (${def.items.length - payload.placedItems.length}), ${collisions} overlap(s), or out-of-bounds placement.`,
    });
    criteria.push({
      id: 'bay-cog',
      label: 'Center of Gravity (CoG) offset <= 18 mm',
      passed: cgMm <= 18,
      severity: 'blocker',
      detail:
        cgMm <= 18
          ? `Lateral CoG balanced within ±${cgMm} mm of thrust axis.`
          : `Imbalance of ±${cgMm} mm (> 18 mm); shift heavy modules toward the opposite side.`,
    });

    if (def.code === 'M43') {
      const solarOk = payload.panelAreaM2 >= 16 && payload.panelAngleDeg <= 25;
      criteria.push({
        id: 'solar-spec',
        label: 'Surface area >= 16 m² & tilt <= 25°',
        passed: solarOk,
        severity: 'blocker',
        detail: `${payload.panelAreaM2} m² deployed at ${payload.panelAngleDeg}° incidence.`,
      });
    }
    deltas.push({
      metric: 'CoG offset',
      before: `${missionState.masaVolumen.cgOffsetMm}`,
      after: `${cgMm}`,
      unit: 'mm',
      improved: cgMm <= 18,
    });
  } else if (def.mechanicFamily === 'signal_orbital_globe') {
    if (def.code === 'I42') {
      const dryKg = Math.max(1400, missionState.masaVolumen.totalMassKg * 0.52);
      const calcDv = Math.round(445 * 9.81 * Math.log((dryKg + payload.propellantKg) / dryKg));
      criteria.push({
        id: 'dv-check',
        label: `Calculated Δv >= ${diff.minDeltaVMps.toLocaleString()} m/s`,
        passed: calcDv >= diff.minDeltaVMps,
        severity: 'blocker',
        detail:
          calcDv >= diff.minDeltaVMps
            ? `${payload.propellantKg} kg propellant delivers ${calcDv.toLocaleString()} m/s (+${calcDv - diff.minDeltaVMps} m/s margin).`
            : `Δv of ${calcDv.toLocaleString()} m/s is insufficient for ${diff.targetName}. Increase propellant or reduce dry mass.`,
      });
      deltas.push({
        metric: 'Orbital Delta-V',
        before: `${missionState.riesgoEstado.deltaVMps}`,
        after: `${calcDv}`,
        unit: 'm/s',
        improved: calcDv >= diff.minDeltaVMps,
      });
    } else if (def.code === 'C23' || def.code === 'A11') {
      const cov = Math.min(
        100,
        def.items
          .filter((i) => payload.zones.includes(i.id))
          .reduce((s, i) => s + (i.coveragePct ?? 20), 0),
      );
      criteria.push({
        id: 'cov-zones',
        label: `Coverage >= 70% (${payload.zones.length} zones)`,
        passed: payload.zones.length >= 4 && cov >= 70,
        severity: 'blocker',
        detail:
          cov >= 70
            ? `${cov}% global coverage secured across ${payload.zones.length} key regions.`
            : `Current coverage is ${cov}% (< 70%); activate at least 4 strategic regions on the globe.`,
      });
      deltas.push({
        metric: 'Orbital coverage',
        before: `${missionState.objetivos.coveragePct}%`,
        after: `${cov}%`,
        unit: '%',
        improved: cov >= 70,
      });
    } else {
      const targetOffset = def.code === 'C31' ? 4 : 2;
      const targetGain = 1.9;
      const targetFilter = 65;
      const errPct = Math.round(
        Math.abs(payload.offsetValue - targetOffset) * 1.4 +
          Math.abs(payload.gainValue - targetGain) * 15 +
          Math.abs(payload.filterValue - targetFilter) * 0.3,
      );
      const qualityPct = Math.max(40, Math.min(99, 100 - errPct));
      criteria.push({
        id: 'sig-quality',
        label: 'Spectral / signal alignment >= 85%',
        passed: qualityPct >= 85,
        severity: 'blocker',
        detail:
          qualityPct >= 85
            ? `Optimal calibration at ${qualityPct}% (residual error ${errPct}%).`
            : `Current quality is ${qualityPct}% (< 85%). Tune Offset (~${targetOffset}), Gain (~${targetGain}x), and Filter (~${targetFilter} Hz).`,
      });
      if (def.code === 'C53' || def.code === 'A12' || def.code === 'A13') {
        const minFindings = def.code === 'A12' ? 2 : 3;
        criteria.push({
          id: 'rep-evid',
          label: `Linked evidence items >= ${minFindings}`,
          passed: payload.reportFindings.length >= minFindings,
          severity: 'blocker',
          detail: `${payload.reportFindings.length}/${def.items.length} certified evidence items.`,
        });
      }
      deltas.push({
        metric: 'Signal quality',
        before: `${missionState.datos.dataQualityPct}%`,
        after: `${qualityPct}%`,
        unit: '%',
        improved: qualityPct >= 85,
      });
    }
  } else if (def.mechanicFamily === 'diagnostics_vibration') {
    const nodes = def.items.filter((i) => i.category === 'Node');
    const fixes = def.items.filter((i) => i.category !== 'Node');
    const probedAll = nodes.every((n) => payload.probedNodes.includes(n.id));
    const appliedEnough = payload.appliedFixes.length >= Math.min(2, fixes.length);
    const dampOk = payload.dampingLevel >= 60;

    criteria.push({
      id: 'diag-probe',
      label: `Full node diagnostics (${payload.probedNodes.length}/${nodes.length})`,
      passed: probedAll,
      severity: 'blocker',
      detail: probedAll
        ? 'All telemetry and load checkpoints have been inspected.'
        : 'Run diagnostic probes on pending nodes to locate every anomaly.',
    });
    criteria.push({
      id: 'diag-fix',
      label: `Fixes applied >= ${Math.min(2, fixes.length)} & damping >= 60%`,
      passed: appliedEnough && dampOk,
      severity: 'blocker',
      detail:
        appliedEnough && dampOk
          ? `${payload.appliedFixes.length} active measures · Stability/damping at ${payload.dampingLevel}%.`
          : `Apply remaining fixes (${payload.appliedFixes.length}/${Math.min(2, fixes.length)}) or raise stabilization (${payload.dampingLevel}% -> 60%).`,
    });
    deltas.push({
      metric: 'Health / Safety',
      before: `${missionState.riesgoEstado.vehicleHealthPct}%`,
      after: `${Math.min(100, missionState.riesgoEstado.vehicleHealthPct + 6)}%`,
      unit: '%',
      improved: appliedEnough && dampOk,
    });
  }

  const blockers = criteria.filter((c) => c.severity === 'blocker' && !c.passed).map((c) => c.detail);
  const warnings = criteria.filter((c) => c.severity === 'warning' && !c.passed).map((c) => c.detail);
  const passed = blockers.length === 0;

  return {
    passed,
    blockers,
    warnings,
    criteria,
    deltas,
    summaryText: passed
      ? `Validation passed: ${criteria.filter((c) => c.passed).length} criteria verified with positive impact.`
      : `Validation blocked: ${blockers[0] ?? 'Review mandatory criteria.'}`,
  };
}

export function getUnlocked3DModulesFromMinigames(
  states: Record<string, MinigameInstanceState>,
): string[] {
  const unlocked = new Set<string>();
  for (const def of MINIGAMES_72) {
    if (isConfirmed(states, def.code) && def.unlocks3DModules) {
      for (const m of def.unlocks3DModules) {
        unlocked.add(m);
      }
    }
  }
  return Array.from(unlocked);
}

export function getMissionResourcesFromSharedState(
  shared: SharedMissionState,
): MissionResources {
  return {
    budgetM: Math.max(0, shared.presupuestoCalendario.maxBudgetM - shared.presupuestoCalendario.allocatedBudgetM),
    maxBudgetM: shared.presupuestoCalendario.maxBudgetM,
    massKg: shared.masaVolumen.totalMassKg,
    maxMassKg: shared.masaVolumen.maxMassKg,
    powerW: shared.energia.netMarginW,
    sciencePts: shared.objetivos.scienceScore,
    maxSciencePts: shared.objetivos.minScienceRequired + 60,
    minScienceRequired: shared.objetivos.minScienceRequired,
    riskPct: shared.riesgoEstado.riskPct,
    maxAllowedRiskPct: shared.riesgoEstado.maxAllowedRiskPct,
  };
}

export function evaluateLaunchOutcome6(
  difficulty: DifficultyId,
  shared: SharedMissionState,
  minigameStates: Record<string, MinigameInstanceState>,
  currentPhase: MissionPhaseNumber,
  activeConflicts: ActiveConflict[],
): LaunchOutcome {
  const diff = DIFFICULTY_CONFIGS[difficulty];
  const phaseMeta = PHASE_6_MAP[currentPhase];
  const metricsSnapshot = getMissionResourcesFromSharedState(shared);

  const openConflicts = activeConflicts.filter((c) => !c.resolved);
  const gatesConfirmed = shared.riesgoEstado.gatesApproved;
  const phase5Done = gatesConfirmed.includes('G53') || currentPhase >= 6;
  const g13Done = gatesConfirmed.includes('G13');
  const g23Done = gatesConfirmed.includes('G23');
  const g43Done = gatesConfirmed.includes('G43');

  const passedChecks: string[] = [];
  const failureReasons: string[] = [];

  for (const ax of shared.anexoCChecks) {
    if (ax.passed) {
      passedChecks.push(`${ax.domain}: ${ax.detail}`);
    } else {
      failureReasons.push(`${ax.domain} out of spec: ${ax.detail}`);
    }
  }

  if (openConflicts.length > 0) {
    failureReasons.push(
      `${openConflicts.length} item(s) require recalculation or resolution in the Briefing Room.`,
    );
  }

  const pickFailureMode = (): LaunchFailureMode => {
    if (currentPhase <= 1 || !g13Done) return 'phase1_pad_fire';
    if (shared.riesgoEstado.deltaVMps < shared.riesgoEstado.minDeltaVMps || !g23Done) {
      return 'phase2_pad_crash';
    }
    if (shared.masaVolumen.totalMassKg > shared.masaVolumen.maxMassKg || shared.masaVolumen.structuralMarginFactor < 1.35) {
      return 'phase3_maxq_buckle';
    }
    if (shared.energia.netMarginW < 0 || shared.comunicaciones.downlinkMbps < shared.comunicaciones.minRequiredMbps) {
      return 'phase4_blackout';
    }
    if (shared.objetivos.scienceScore < shared.objetivos.minScienceRequired) {
      return 'phase5_payload_loss';
    }
    if (shared.riesgoEstado.riskPct > shared.riesgoEstado.maxAllowedRiskPct || !g43Done) {
      return 'phase6_reentry_burn';
    }
    if (!phase5Done || openConflicts.length > 0) {
      return 'phase9_rough_descent';
    }
    return 'phase10_success';
  };

  const mode = pickFailureMode();
  const success = mode === 'phase10_success' && failureReasons.length === 0;

  if (success) {
    return {
      success: true,
      failureMode: 'phase10_success',
      destinationName: diff.targetName,
      currentPhase,
      phaseTitle: phaseMeta.title,
      headline: `MISSION ACCOMPLISHED — ${diff.targetName.toUpperCase()}`,
      rootCauseHeadline: `Gate G53 clearance validated and all 6 Annex C pillars in green.`,
      narrative: `All critical design, verification, and integration missions passed cooperative review. The launch vehicle completed ascent, orbital insertion at ${diff.targetName}, science return (${shared.objetivos.scienceScore} pts), and safe recovery.`,
      finalAltitudeLabel:
        difficulty === 'easy'
          ? '412 km Orbit + Safe Splashdown'
          : difficulty === 'medium'
            ? 'Lunar Surface + Safe Return'
            : 'Martian Orbit + Safe Return',
      peakVelocityLabel:
        difficulty === 'easy' ? '7,820 m/s' : difficulty === 'medium' ? '10,940 m/s' : '12,680 m/s',
      durationSec: LAUNCH_CINEMATIC_DURATIONS.phase10_success,
      passedChecks,
      failureReasons: [],
      metricsSnapshot,
    };
  }

  return {
    success: false,
    failureMode: mode,
    destinationName: diff.targetName,
    currentPhase,
    phaseTitle: phaseMeta.title,
    headline: `SIMULATION FAILED AT ${phaseMeta.code} · ${phaseMeta.title.toUpperCase()}`,
    rootCauseHeadline: failureReasons[0] ?? 'Missing Gate G53 approval or Annex C clearance.',
    narrative: `The launch simulation evaluated the Shared Mission State at ${phaseMeta.code}. Complete and confirm pending missions (including Gates G13, G23, G43, and G53) and resolve red Annex C alerts before attempting final launch.`,
    finalAltitudeLabel:
      mode === 'phase1_pad_fire'
        ? '0 m (Pad Abort)'
        : mode === 'phase3_maxq_buckle'
          ? '200 m (Max-Q Failure)'
          : mode === 'phase4_blackout'
            ? '68 km (Bus Blackout)'
            : '175 km (Mission Incomplete)',
    peakVelocityLabel: `${Math.min(10480, shared.riesgoEstado.deltaVMps).toLocaleString()} m/s`,
    durationSec: LAUNCH_CINEMATIC_DURATIONS[mode],
    passedChecks,
    failureReasons:
      failureReasons.length > 0
        ? failureReasons
        : [`Complete verification and Gate G53 before attempting final launch.`],
    metricsSnapshot,
  };
}
