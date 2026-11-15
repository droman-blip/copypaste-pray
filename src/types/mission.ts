export type RoleId = 'systems' | 'finance' | 'science' | 'pilot';

export type DifficultyId = 'easy' | 'medium' | 'hard';

export type TargetBodyId = 'earth' | 'moon' | 'mars';

export type RoomId =
  | 'overview'
  | 'hangar'
  | 'meeting'
  | 'systems'
  | 'finance'
  | 'science'
  | 'pilot';

export interface DifficultyConfig {
  id: DifficultyId;
  label: string;
  badge: string;
  targetBody: TargetBodyId;
  targetName: string;
  subtitle: string;
  maxMassKg: number;
  maxVolumeM3: number;
  maxBudgetM: number;
  minSciencePts: number;
  maxScienceDisplay: number;
  minDeltaVMps: number;
  minCommsMbps: number;
  maxScheduleDays: number;
  baseRiskPct: number;
  maxAllowedRiskPct: number;
  briefingObjective: string;
}

export interface RoleDefinition {
  id: RoleId;
  pdfRoleLabel: string;
  name: string;
  shortName: string;
  roomId: Exclude<RoomId, 'overview' | 'hangar' | 'meeting'>;
  roomName: string;
  colorHex: string;
  colorNumber: number;
  accentBgClass: string;
  accentTextClass: string;
  accentBorderClass: string;
  focusQuestion: string;
  specialty: string;
  description: string;
}

export interface RoomObstacle {
  x: number;
  z: number;
  radius: number;
}

export interface MezzanineBounds {
  elevation: number;
  zMin: number;
  zMax: number;
  xHalfWidth: number;
  rampWidth: number;
  rampZStart?: number;
  rampZEnd: number;
  sideCatwalkWidth?: number;
}

export interface RoomFirstPersonConfig {
  spawn: [number, number, number];
  initialYaw: number;
  initialPitch: number;
  walkRadius: number;
  obstacles: RoomObstacle[];
  mezzanine?: MezzanineBounds;
}

export interface RoomDefinition {
  id: RoomId;
  name: string;
  shortLabel: string;
  type: 'overview' | 'common' | 'private';
  ownerRole?: RoleId;
  accentColorHex: string;
  center: [number, number, number];
  cameraOffset: [number, number, number];
  firstPerson?: RoomFirstPersonConfig;
  description: string;
}

export interface RocketModule {
  id: string;
  roleId: RoleId;
  name: string;
  category: string;
  description: string;
  costM: number;
  massKg: number;
  powerW: number;
  sciencePts: number;
  riskPct: number;
}

export interface MissionResources {
  budgetM: number;
  maxBudgetM: number;
  massKg: number;
  maxMassKg: number;
  powerW: number;
  sciencePts: number;
  maxSciencePts: number;
  minScienceRequired: number;
  riskPct: number;
  maxAllowedRiskPct: number;
}

export interface MissionLogEntry {
  id: string;
  timestamp: string;
  playerName: string;
  roleId: RoleId;
  action: 'install' | 'remove' | 'launch' | 'join' | 'mission' | 'finance' | 'comms' | 'alert';
  message: string;
}

export type InteractableId =
  // 6 in Mechanical & Structures Workshop (systems)
  | 'sys-computer'
  | 'sys-drawer'
  | 'sys-whiteboard'
  | 'sys-comms'
  | 'sys-bench'
  | 'sys-manuals'
  // 6 in Program Management & Budget Center (finance)
  | 'fin-computer'
  | 'fin-drawer'
  | 'fin-whiteboard'
  | 'fin-comms'
  | 'fin-bench'
  | 'fin-manuals'
  // 6 in Science & Payload Lab (science)
  | 'sci-computer'
  | 'sci-drawer'
  | 'sci-whiteboard'
  | 'sci-comms'
  | 'sci-bench'
  | 'sci-manuals'
  // 6 in Engineering, Power & Link Center (pilot)
  | 'plt-computer'
  | 'plt-drawer'
  | 'plt-whiteboard'
  | 'plt-comms'
  | 'plt-bench'
  | 'plt-manuals'
  // 11 in Rocket Hangar (hangar)
  | 'hng-nozzles'
  | 'hng-fuel-tank'
  | 'hng-oxidizer-tank'
  | 'hng-interstage'
  | 'hng-fairing'
  | 'hng-avionics'
  | 'hng-umbilical'
  | 'hng-pad-console'
  | 'hng-cryo-pipes'
  | 'hng-crane'
  | 'hng-schedule'
  // 1 in Briefing & Negotiation Room (meeting)
  | 'mtg-holo';

export type InteractableKind =
  | 'computer'
  | 'drawer'
  | 'whiteboard'
  | 'comms'
  | 'bench'
  | 'manuals'
  | 'hangar-part'
  | 'schedule'
  | 'meeting-holo';

export interface InteractableContent {
  id: InteractableId;
  roomId: Exclude<RoomId, 'overview'>;
  kind: InteractableKind;
  hoverLabel: string;
  title: string;
  subtitle: string;
  summary: string;
  dataPoints: Array<{ label: string; value: string }>;
  moduleIdsForInstall?: string[];
  formulas?: string[];
  manualSections?: Array<{ code: string; heading: string; body: string }>;
}

export interface DepartmentMessage {
  id: string;
  fromRole: RoleId;
  toRole: RoleId | 'all';
  senderName: string;
  text: string;
  timestamp: string;
}

// =========================================================================
// 6-PHASE COOPERATIVE MISSION ARCHITECTURE (72 MINIGAMES FROM PDF GUIDE)
// =========================================================================

export type MissionPhaseNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface MissionPhase6 {
  number: MissionPhaseNumber;
  code: string;
  title: string;
  englishName: string;
  gateCode: string | null;
  targetDays: number;
  startDayOffset: number;
  focus: string;
  description: string;
}

export type MinigameWorkflowStatus =
  | 'no_iniciado'
  | 'en_progreso'
  | 'pendiente_revision'
  | 'validado'
  | 'requiere_cambios'
  | 'confirmado';

export type MinigameMechanicFamily =
  | 'cards_priority'
  | 'allocation_compare'
  | 'network_sim'
  | 'timeline_gantt'
  | 'coop_voting_gate'
  | 'risk_incident_matrix'
  | 'spatial_mass_assembly'
  | 'signal_orbital_globe'
  | 'diagnostics_vibration';

export type MissionStateDomain =
  | 'objetivos'
  | 'masaVolumen'
  | 'energia'
  | 'datos'
  | 'comunicaciones'
  | 'presupuestoCalendario'
  | 'riesgoEstado';

export interface MinigameOptionItem {
  id: string;
  label: string;
  category: string;
  summary: string;
  massKg?: number;
  volumeM3?: number;
  powerW?: number;
  dataGB?: number;
  bandwidthMbps?: number;
  sciencePts?: number;
  costM?: number;
  days?: number;
  riskDeltaPct?: number;
  coveragePct?: number;
  widthCells?: number;
  heightCells?: number;
  colorHex?: string;
}

export interface MinigamePayload {
  // Family 1: cards_priority
  selectedIds: string[];
  priorityOrder: string[];
  // Family 2: allocation_compare
  allocations: Record<string, number>;
  selectedOptionId: string;
  policyRatio: number; // e.g. compression or contingency %
  // Family 3: network_sim
  activeNodes: string[];
  links: Array<[string, string]>;
  batteryWh: number;
  dutyCyclePct: number;
  // Family 4: timeline_gantt
  tasks: Array<{
    id: string;
    label: string;
    startDay: number;
    durationDays: number;
    dependsOn?: string;
    critical?: boolean;
  }>;
  // Family 5: coop_voting_gate
  votes: Record<RoleId, { vote: 'approve' | 'reject' | 'pending'; note: string }>;
  compromiseId: string;
  // Family 6: risk_incident_matrix
  mitigatedIds: string[];
  severityOverrides: Record<string, 'baja' | 'media' | 'alta' | 'critica'>;
  // Family 7: spatial_mass_assembly
  placedItems: Array<{
    id: string;
    x: number;
    y: number;
    rotated?: boolean;
  }>;
  panelAngleDeg: number;
  panelAreaM2: number;
  // Family 8: signal_orbital_globe
  zones: string[];
  offsetValue: number;
  gainValue: number;
  filterValue: number;
  propellantKg: number;
  targetDeltaVMps: number;
  reportFindings: string[];
  // Family 9: diagnostics_vibration
  probedNodes: string[];
  appliedFixes: string[];
  dampingLevel: number;
}

export interface ValidationCriterion {
  id: string;
  label: string;
  passed: boolean;
  severity: 'blocker' | 'warning';
  detail: string;
}

export interface MetricDelta {
  metric: string;
  before: string;
  after: string;
  unit: string;
  improved: boolean;
}

export interface MinigameValidationResult {
  passed: boolean;
  blockers: string[];
  warnings: string[];
  criteria: ValidationCriterion[];
  deltas: MetricDelta[];
  summaryText: string;
}

export interface MinigameHistoryEntry {
  id: string;
  version: number;
  timestamp: string;
  authorName: string;
  authorRole: RoleId;
  summary: string;
  justification: string;
  snapshotPayload: MinigamePayload;
}

export interface MinigameComment {
  id: string;
  timestamp: string;
  authorName: string;
  authorRole: RoleId;
  text: string;
}

export interface MinigameDefinition {
  code: string; // e.g. 'C11', 'M33*', 'O17*'
  phaseNumber: MissionPhaseNumber;
  roleId: RoleId;
  roleLabel: string;
  title: string;
  subtitle: string;
  mechanicSummary: string;
  mechanicFamily: MinigameMechanicFamily;
  stationKind: 'drawer' | 'whiteboard' | 'computer' | 'bench' | 'comms' | 'schedule' | 'meeting-holo';
  impactDomains: MissionStateDomain[];
  dependsOnCodes: string[];
  isGateReview?: boolean;
  isCriticalChallenge?: boolean;
  stepByStepGuide: string[];
  acceptanceRulesDesc: string[];
  items: MinigameOptionItem[];
  defaultPayload: MinigamePayload;
  unlocks3DModules?: string[];
  unitPrimary: string;
}

export interface MinigameInstanceState {
  code: string;
  status: MinigameWorkflowStatus;
  dirtyNeedsRecalc: boolean;
  draftPayload: MinigamePayload;
  confirmedPayload: MinigamePayload | null;
  undoStack: MinigamePayload[];
  lastValidation: MinigameValidationResult | null;
  history: MinigameHistoryEntry[];
  comments: MinigameComment[];
  updatedAt: string;
}

export interface SharedMissionState {
  objetivos: {
    selectedObjectiveLabel: string;
    primaryExperiment: string;
    secondaryExperimentsCount: number;
    instrumentsCount: number;
    scienceScore: number;
    minScienceRequired: number;
    precisionPct: number;
    coveragePct: number;
    discoveriesPublished: number;
  };
  masaVolumen: {
    totalMassKg: number;
    maxMassKg: number;
    occupiedVolumeM3: number;
    maxVolumeM3: number;
    cgOffsetMm: number;
    structuralMarginFactor: number;
  };
  energia: {
    generationW: number;
    consumptionW: number;
    netMarginW: number;
    batteryWh: number;
    eclipseAutonomyHours: number;
  };
  datos: {
    generatedGB: number;
    storageCapacityGB: number;
    capturedObservations: number;
    dataQualityPct: number;
  };
  comunicaciones: {
    downlinkMbps: number;
    minRequiredMbps: number;
    windowMinutesPerDay: number;
    groundStationsCount: number;
    packetSuccessPct: number;
  };
  presupuestoCalendario: {
    allocatedBudgetM: number;
    maxBudgetM: number;
    contingencyReserveM: number;
    plannedDurationDays: number;
    maxScheduleDays: number;
    criticalSlackDays: number;
  };
  riesgoEstado: {
    riskPct: number;
    maxAllowedRiskPct: number;
    openAnomalies: number;
    resolvedAnomalies: number;
    gatesApproved: string[];
    vehicleHealthPct: number;
    deltaVMps: number;
    minDeltaVMps: number;
  };
  recalcRequiredCodes: string[];
  anexoCChecks: Array<{
    id: string;
    domain: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
}

export interface ActiveConflict {
  id: string;
  code: string;
  phaseNumber: number;
  sourceRole: RoleId;
  title: string;
  affectedRoles: [RoleId, RoleId];
  severity: 'warning' | 'critical';
  description: string;
  resolved: boolean;
  resolvedAt?: string;
}

export type LaunchFailureMode =
  | 'phase1_pad_fire'
  | 'phase2_pad_crash'
  | 'phase3_maxq_buckle'
  | 'phase4_blackout'
  | 'phase5_payload_loss'
  | 'phase6_reentry_burn'
  | 'phase7_nav_miss'
  | 'phase8_early_meco'
  | 'phase9_rough_descent'
  | 'phase10_success';

export interface LaunchTelemetrySnapshot {
  elapsedSec: number;
  durationSec: number;
  missionClock: string;
  altitudeLabel: string;
  velocityLabel: string;
  stageLabel: string;
  cameraId: 'A' | 'B' | 'C';
  cameraLabel: string;
  alertText: string | null;
  blackout: boolean;
  finished: boolean;
}

export interface LaunchOutcome {
  success: boolean;
  failureMode: LaunchFailureMode;
  destinationName: string;
  currentPhase: number;
  phaseTitle: string;
  headline: string;
  rootCauseHeadline: string;
  narrative: string;
  finalAltitudeLabel: string;
  peakVelocityLabel: string;
  durationSec: number;
  passedChecks: string[];
  failureReasons: string[];
  metricsSnapshot: MissionResources;
}

export type CargoVariant =
  | 'cryo-cell'
  | 'thermal-crate'
  | 'budget-case'
  | 'sample-canister'
  | 'avionics-core';

export interface CargoModuleDef {
  id: string;
  name: string;
  shortLabel: string;
  variant: CargoVariant;
  roleId: RoleId;
  originRoomId: RoomId;
  accentHex: string;
  accentNumber: number;
  weight: number;
  fragility: number;
  riskPenaltyOnBreak: number;
  scienceBonusOnDeliver: number;
  spawnLocalPos: [number, number, number];
  padSlotOffset: [number, number, number];
  radius: number;
  description: string;
}

export interface CargoModuleState {
  id: string;
  integrity: number; // 0..100
  delivered: boolean;
  riskPenaltyPct: number;
}

export interface OrbitalTrajectoryConfig {
  targetBody: TargetBodyId;
  perigeeKm: number;
  apogeeKm: number;
  inclinationDeg: number;
  perigeeVelKms: number;
  apogeeVelKms: number;
  periodHours: number;
  deltaVKms: number;
  fuelRequiredKg: number;
  coveragePct: number;
  commsLatencyLabel: string;
  estimatedCostM: number;
  validated: boolean;
}

export interface ThermalReportSummary {
  certified: boolean;
  requirementC: number;
  selectedShieldMaterial: string;
  testedCount: number;
  testedMeltTemps: Record<string, number>;
  timestamp?: string;
}

export interface BudgetAllocationSummary {
  approved: boolean;
  totalAllocatedM: number;
  departmentTotalsM: Record<string, number>;
  timestamp?: string;
}
