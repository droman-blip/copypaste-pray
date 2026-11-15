import type {
  CargoModuleDef,
  DepartmentMessage,
  DifficultyConfig,
  DifficultyId,
  InteractableContent,
  InteractableId,
  LaunchFailureMode,
  RocketModule,
  RoleDefinition,
  RoleId,
  RoomDefinition,
  RoomId,
} from '../types/mission';

export const GROUND_FLOOR_Y = 0.63;
export const EYE_HEIGHT = 1.75;

export const DIFFICULTY_CONFIGS: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'EASY · LEO',
    badge: 'Earth Orbit (LEO)',
    targetBody: 'earth',
    targetName: 'Earth Orbit (LEO)',
    subtitle: '412 km orbital insertion, science payload validation, and ocean recovery.',
    maxMassKg: 6500,
    maxVolumeM3: 11.5,
    maxBudgetM: 150,
    minSciencePts: 40,
    maxScienceDisplay: 140,
    minDeltaVMps: 3200,
    minCommsMbps: 24,
    maxScheduleDays: 240,
    baseRiskPct: 5,
    maxAllowedRiskPct: 26,
    briefingObjective:
      'Complete the 6 cooperative phases (72 missions) to design, verify, and operate an Earth Orbit (LEO) mission within margins.',
  },
  medium: {
    id: 'medium',
    label: 'MEDIUM · THE MOON',
    badge: 'The Moon',
    targetBody: 'moon',
    targetName: 'The Moon',
    subtitle: 'Translunar injection, polar survey, high Δv budget, and Earth return.',
    maxMassKg: 5000,
    maxVolumeM3: 9.5,
    maxBudgetM: 100,
    minSciencePts: 75,
    maxScienceDisplay: 160,
    minDeltaVMps: 4500,
    minCommsMbps: 28,
    maxScheduleDays: 225,
    baseRiskPct: 8,
    maxAllowedRiskPct: 22,
    briefingObjective:
      'Pass all 4 cooperative Gates (G13, G23, G43, G53) and validate all 6 Annex C pillars to reach The Moon and return safely.',
  },
  hard: {
    id: 'hard',
    label: 'HARD · MARS',
    badge: 'Mars Expedition',
    targetBody: 'mars',
    targetName: 'Mars Expedition',
    subtitle: 'Interplanetary transfer, strict mass cap, DSN links, and anomaly recovery.',
    maxMassKg: 3800,
    maxVolumeM3: 8.0,
    maxBudgetM: 80,
    minSciencePts: 100,
    maxScienceDisplay: 180,
    minDeltaVMps: 5400,
    minCommsMbps: 34,
    maxScheduleDays: 215,
    baseRiskPct: 12,
    maxAllowedRiskPct: 18,
    briefingObjective:
      'Orchestrate tight mass, power, data, budget, and resilience limits to complete the Mars Expedition.',
  },
};

export const ROLES: RoleDefinition[] = [
  {
    id: 'systems',
    pdfRoleLabel: 'Mechanic (Propulsion, Structure & Assembly)',
    name: 'Mechanic',
    shortName: 'Mechanic',
    roomId: 'systems',
    roomName: 'Mechanical & Structures Workshop',
    colorHex: '#F97316',
    colorNumber: 0xf97316,
    accentBgClass: 'bg-orange-500',
    accentTextClass: 'text-orange-400',
    accentBorderClass: 'border-orange-500/40',
    focusQuestion: 'Does it fit, balance, and hold up?',
    specialty: 'Propulsion, Structure & Assembly (M* / O15*–O17*)',
    description:
      'Calculates mass and center of gravity, fits modules inside the fairing, runs vibration tests M33*/M52, and executes maintenance/repairs O15*–O17*.',
  },
  {
    id: 'pilot',
    pdfRoleLabel: 'Engineer (Avionics, Trajectory & Flight Systems)',
    name: 'Engineer',
    shortName: 'Engineer',
    roomId: 'pilot',
    roomName: 'Engineering, Power & Link Center',
    colorHex: '#3B82F6',
    colorNumber: 0x3b82f6,
    accentBgClass: 'bg-blue-500',
    accentTextClass: 'text-blue-400',
    accentBorderClass: 'border-blue-500/40',
    focusQuestion: 'How do we power, fly, and link?',
    specialty: 'Avionics, Trajectory & Flight Systems (I* / B11–B12)',
    description:
      'Designs solar/battery grids, S/Ka DSN links, SSR storage, orbital Δv budget, power/SW debugging, and on-orbit operations.',
  },
  {
    id: 'science',
    pdfRoleLabel: 'Scientist (Payload, Sensors & Research)',
    name: 'Scientist',
    shortName: 'Scientist',
    roomId: 'science',
    roomName: 'Science & Payload Lab',
    colorHex: '#22C55E',
    colorNumber: 0x22c55e,
    accentBgClass: 'bg-emerald-500',
    accentTextClass: 'text-emerald-400',
    accentBorderClass: 'border-emerald-500/40',
    focusQuestion: 'What do we discover and at what quality?',
    specialty: 'Payload, Sensors & Research (C* / A11–A13)',
    description:
      'Formulates hypotheses and experiments, selects instruments, calibrates ground SNR/signal, and leads orbital observations and discoveries.',
  },
  {
    id: 'finance',
    pdfRoleLabel: 'Program Manager (Budget, Resources & Approvals)',
    name: 'Program Manager',
    shortName: 'Program Manager',
    roomId: 'finance',
    roomName: 'Program Management & Budget Center',
    colorHex: '#EAB308',
    colorNumber: 0xeab308,
    accentBgClass: 'bg-yellow-500',
    accentTextClass: 'text-yellow-400',
    accentBorderClass: 'border-yellow-500/40',
    focusQuestion: 'Is it viable in cost, schedule, and risk?',
    specialty: 'Budget, Resources & Approvals (G* / O11*–O14*)',
    description:
      'Coordinates budget lines and UFE reserves, critical path schedule, risk mitigation, Gate voting, and emergency operations.',
  },
];

export const ROLE_MAP: Record<RoleId, RoleDefinition> = ROLES.reduce(
  (acc, r) => {
    acc[r.id] = r;
    return acc;
  },
  {} as Record<RoleId, RoleDefinition>,
);

function makeRoleRoomObstacles(cx: number, cz: number) {
  return [
    { x: cx, z: cz - 0.8, radius: 2.1 },
    { x: cx - 4.6, z: cz + 3.3, radius: 1.6 },
    { x: cx + 4.6, z: cz + 3.3, radius: 2.0 },
    { x: cx - 4.8, z: cz - 1.8, radius: 1.7 },
    { x: cx + 4.8, z: cz - 1.8, radius: 1.7 },
    { x: cx, z: cz - 8.8, radius: 1.8 },
  ];
}

export const ROOMS: RoomDefinition[] = [
  {
    id: 'overview',
    name: 'Facility Map — Space Operations Complex',
    shortLabel: '3D Map',
    type: 'overview',
    accentColorHex: '#38BDF8',
    center: [0, 3.0, -4],
    cameraOffset: [78, 68, 78],
    description:
      'Aerial overview of the space complex with 6 connected facilities spanning all 6 program phases.',
  },
  {
    id: 'hangar',
    name: 'Rocket Hangar (VAB)',
    shortLabel: 'Rocket Hangar',
    type: 'common',
    accentColorHex: '#38BDF8',
    center: [0, 4.5, 0],
    cameraOffset: [30, 24, 30],
    firstPerson: {
      spawn: [0, GROUND_FLOOR_Y + EYE_HEIGHT, 14.5],
      initialYaw: 0,
      initialPitch: 0.22,
      walkRadius: 18.8,
      obstacles: [
        { x: 0, z: 0, radius: 6.4 },
        { x: -4.6, z: -3.2, radius: 2.0 },
        { x: -5.2, z: -3.6, radius: 1.6 },
        { x: 5.2, z: -3.6, radius: 1.6 },
        { x: 8.4, z: 5.2, radius: 1.8 },
        { x: -8.6, z: 5.4, radius: 1.8 },
      ],
      mezzanine: {
        elevation: 3.0,
        zMin: -17.0,
        zMax: -8.5,
        xHalfWidth: 14.2,
        rampWidth: 3.2,
        rampZStart: 2.5,
        rampZEnd: 10.0,
        sideCatwalkWidth: 3.2,
      },
    },
    description:
      'Vertical assembly hangar with stage inspection, 6-phase master schedule, launch console, and cargo assembly pad.',
  },
  {
    id: 'meeting',
    name: 'Briefing Room & Cooperative Gates',
    shortLabel: 'Gates Room',
    type: 'common',
    accentColorHex: '#06B6D4',
    center: [0, 2.2, -46],
    cameraOffset: [24, 20, 24],
    firstPerson: {
      spawn: [0, GROUND_FLOOR_Y + EYE_HEIGHT, -46 + 9.2],
      initialYaw: 0,
      initialPitch: -0.04,
      walkRadius: 12.2,
      obstacles: [{ x: 0, z: -46 + 1.2, radius: 4.1 }],
      mezzanine: {
        elevation: 2.6,
        zMin: -11.4,
        zMax: -4.8,
        xHalfWidth: 10.6,
        rampWidth: 3.0,
        rampZEnd: 3.2,
      },
    },
    description:
      'Holographic room for cooperative Gate votes (G13, G23, G43, G53), O13* emergency drills, and cross-team audits.',
  },
  {
    id: 'systems',
    name: 'Mechanical & Structures Workshop',
    shortLabel: 'Mechanic',
    type: 'private',
    ownerRole: 'systems',
    accentColorHex: '#F97316',
    center: [-44, 2.2, -28],
    cameraOffset: [23, 19, 23],
    firstPerson: {
      spawn: [-44, GROUND_FLOOR_Y + EYE_HEIGHT, -28 + 8.6],
      initialYaw: 0,
      initialPitch: -0.05,
      walkRadius: 11.7,
      obstacles: makeRoleRoomObstacles(-44, -28),
      mezzanine: {
        elevation: 2.6,
        zMin: -11.0,
        zMax: -4.6,
        xHalfWidth: 10.2,
        rampWidth: 3.0,
        rampZEnd: 3.2,
      },
    },
    description:
      'Mechanic station: mass balances M11/M41, fairing fit M12/M32, vibration tests M33*/M52, and repairs O15*–O17*.',
  },
  {
    id: 'finance',
    name: 'Program Management & Budget Center',
    shortLabel: 'Program Manager',
    type: 'private',
    ownerRole: 'finance',
    accentColorHex: '#EAB308',
    center: [-44, 2.2, 28],
    cameraOffset: [23, 19, 23],
    firstPerson: {
      spawn: [-44, GROUND_FLOOR_Y + EYE_HEIGHT, 28 + 8.6],
      initialYaw: 0,
      initialPitch: -0.05,
      walkRadius: 11.7,
      obstacles: makeRoleRoomObstacles(-44, 28),
      mezzanine: {
        elevation: 2.6,
        zMin: -11.0,
        zMax: -4.6,
        xHalfWidth: 10.2,
        rampWidth: 3.0,
        rampZEnd: 3.2,
      },
    },
    description:
      'Program Manager office: budget allocation G11/G31/G41, Gantt charts G12/G32/G42, risk matrix G21/G33, and ops O11*–O14*.',
  },
  {
    id: 'science',
    name: 'Science & Payload Lab',
    shortLabel: 'Scientist',
    type: 'private',
    ownerRole: 'science',
    accentColorHex: '#22C55E',
    center: [44, 2.2, -28],
    cameraOffset: [23, 19, 23],
    firstPerson: {
      spawn: [44, GROUND_FLOOR_Y + EYE_HEIGHT, -28 + 8.6],
      initialYaw: 0,
      initialPitch: -0.05,
      walkRadius: 11.7,
      obstacles: makeRoleRoomObstacles(44, -28),
      mezzanine: {
        elevation: 2.6,
        zMin: -11.0,
        zMax: -4.6,
        xHalfWidth: 10.2,
        rampWidth: 3.0,
        rampZEnd: 3.2,
      },
    },
    description:
      'Scientist cleanroom: hypotheses C11, instruments C12/C41, coverage C23, calibration C51–C53, and orbital findings A11–A13.',
  },
  {
    id: 'pilot',
    name: 'Engineering, Power & Link Center',
    shortLabel: 'Engineer',
    type: 'private',
    ownerRole: 'pilot',
    accentColorHex: '#3B82F6',
    center: [44, 2.2, 28],
    cameraOffset: [23, 19, 23],
    firstPerson: {
      spawn: [44, GROUND_FLOOR_Y + EYE_HEIGHT, 28 + 8.6],
      initialYaw: 0,
      initialPitch: -0.05,
      walkRadius: 11.7,
      obstacles: makeRoleRoomObstacles(44, 28),
      mezzanine: {
        elevation: 2.6,
        zMin: -11.0,
        zMax: -4.6,
        xHalfWidth: 10.2,
        rampWidth: 3.0,
        rampZEnd: 3.2,
      },
    },
    description:
      'Engineer station: power grids I11/I21/I41, DSN links I12/I22/I43, SSR memory I13, Δv I42, verification I51–I53, and ops B11–B12.',
  },
];

export const ROOM_MAP: Record<RoomId, RoomDefinition> = ROOMS.reduce(
  (acc, room) => {
    acc[room.id] = room;
    return acc;
  },
  {} as Record<RoomId, RoomDefinition>,
);

export const ROCKET_MODULES: RocketModule[] = [
  {
    id: 'sys-solid-boosters',
    roleId: 'systems',
    name: 'S-1 Solid Rocket Boosters',
    category: 'Solid Propulsion',
    description: 'Unlocked upon confirming orbital and propellant budget I42.',
    costM: 14,
    massKg: 950,
    powerW: -10,
    sciencePts: 5,
    riskPct: 4,
  },
  {
    id: 'sys-cryo-engine',
    roleId: 'systems',
    name: 'Advanced Cryogenic Cluster',
    category: 'Liquid Propulsion',
    description: 'Unlocked upon validating propellant and Δv in I42.',
    costM: 26,
    massKg: 1300,
    powerW: -20,
    sciencePts: 10,
    riskPct: 11,
  },
  {
    id: 'sys-rcs-structure',
    roleId: 'systems',
    name: 'Structural Ring & RCS',
    category: 'Structure',
    description: 'Unlocked upon confirming preliminary structure M13.',
    costM: 12,
    massKg: 320,
    powerW: -15,
    sciencePts: 5,
    riskPct: -6,
  },
  {
    id: 'fin-solar-standard',
    roleId: 'finance',
    name: 'Conceptual Solar Wings',
    category: 'Power',
    description: 'Unlocked upon confirming power architecture I21.',
    costM: 10,
    massKg: 260,
    powerW: 95,
    sciencePts: 0,
    riskPct: 2,
  },
  {
    id: 'fin-solar-heavy',
    roleId: 'finance',
    name: 'Quad Final Solar Array',
    category: 'High Power',
    description: 'Unlocked upon confirming total power I41 and solar panels M43.',
    costM: 20,
    massKg: 520,
    powerW: 215,
    sciencePts: 5,
    riskPct: 4,
  },
  {
    id: 'fin-thermal-shield',
    roleId: 'finance',
    name: 'Certified Thermal Shield',
    category: 'Protection',
    description: 'Unlocked upon approving baseline changes at Gate G43.',
    costM: 14,
    massKg: 340,
    powerW: 25,
    sciencePts: 5,
    riskPct: -8,
  },
  {
    id: 'sci-spectrometer',
    roleId: 'science',
    name: 'IR Mass Spectrometer',
    category: 'Instrument',
    description: 'Unlocked upon confirming initial instruments C12.',
    costM: 15,
    massKg: 400,
    powerW: -35,
    sciencePts: 35,
    riskPct: 3,
  },
  {
    id: 'sci-hd-camera',
    roleId: 'science',
    name: 'HD-200 Orbital Telescope',
    category: 'Optics',
    description: 'Unlocked upon confirming final instruments C41.',
    costM: 18,
    massKg: 360,
    powerW: -40,
    sciencePts: 40,
    riskPct: 4,
  },
  {
    id: 'sci-microgravity-lab',
    roleId: 'science',
    name: 'Microgravity BioLab',
    category: 'Biology',
    description: 'Unlocked upon confirming final flight payload C41.',
    costM: 22,
    massKg: 650,
    powerW: -55,
    sciencePts: 50,
    riskPct: 6,
  },
  {
    id: 'plt-sband-link',
    roleId: 'pilot',
    name: 'S-Band Telemetry Mast',
    category: 'Communications',
    description: 'Unlocked upon confirming communications design I22.',
    costM: 9,
    massKg: 190,
    powerW: -20,
    sciencePts: 10,
    riskPct: -4,
  },
  {
    id: 'plt-kaband-dish',
    roleId: 'pilot',
    name: 'Ka-Band Parabolic Dish',
    category: 'Deep-Space Link',
    description: 'Unlocked upon confirming final communications I43.',
    costM: 20,
    massKg: 390,
    powerW: -45,
    sciencePts: 25,
    riskPct: 3,
  },
  {
    id: 'plt-abort-guidance',
    roleId: 'pilot',
    name: 'Autonomous Guidance & Escape Tower',
    category: 'Safety',
    description: 'Unlocked upon confirming final mass & layout M41.',
    costM: 16,
    massKg: 230,
    powerW: -30,
    sciencePts: 15,
    riskPct: -9,
  },
];

export const MODULE_MAP: Record<string, RocketModule> = ROCKET_MODULES.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<string, RocketModule>,
);

export function canAccessRoom(roomId: RoomId, roleId: RoleId): boolean {
  if (roomId === 'overview' || roomId === 'hangar' || roomId === 'meeting') {
    return true;
  }
  const room = ROOM_MAP[roomId];
  return room.ownerRole === roleId;
}

export const LAUNCH_CINEMATIC_DURATIONS: Record<LaunchFailureMode, number> = {
  phase1_pad_fire: 8.5,
  phase2_pad_crash: 9.0,
  phase3_maxq_buckle: 9.5,
  phase4_blackout: 9.5,
  phase5_payload_loss: 10.0,
  phase6_reentry_burn: 10.5,
  phase7_nav_miss: 10.5,
  phase8_early_meco: 10.0,
  phase9_rough_descent: 11.0,
  phase10_success: 18.0,
};

export const INITIAL_DEPT_MESSAGES: DepartmentMessage[] = [
  {
    id: 'msg-init-1',
    fromRole: 'science',
    toRole: 'pilot',
    senderName: 'Scientist',
    text: 'C11 objectives and C12 instruments ready for power sizing in I11 and data sizing in C13/I13.',
    timestamp: '00:01:00',
  },
  {
    id: 'msg-init-2',
    fromRole: 'systems',
    toRole: 'finance',
    senderName: 'Mechanic',
    text: 'Reviewing preliminary mass M11 and fairing layout M12 ahead of cooperative Gate G13.',
    timestamp: '00:01:30',
  },
  {
    id: 'msg-init-3',
    fromRole: 'finance',
    toRole: 'all',
    senderName: 'Program Manager',
    text: 'Complete your 3 Phase 1 missions. Once all 12 in each phase are confirmed, we validate in the Briefing Room (Gates G13/G23/G43/G53).',
    timestamp: '00:02:00',
  },
];

export const INTERACTABLES_MAP: Record<InteractableId, InteractableContent> = {
  // === MECHANICAL & STRUCTURES WORKSHOP (systems) ===
  'sys-computer': {
    id: 'sys-computer',
    roomId: 'systems',
    kind: 'computer',
    hoverLabel: 'Mechanical CAD Station · Mass, Volume & Repair',
    title: 'Structural CAD & Mechanical Telemetry Station',
    subtitle: 'Mechanic · Missions M* & O15*–O17*',
    summary: 'Access all structure, center of gravity, solar deployment, and fault-diagnostics missions.',
    dataPoints: [
      { label: 'Domains', value: 'Mass (kg), Volume (m³), CoG (mm)' },
      { label: 'Critical Challenges', value: 'M33*, O15*, O16*, O17*' },
    ],
  },
  'sys-drawer': {
    id: 'sys-drawer',
    roomId: 'systems',
    kind: 'drawer',
    hoverLabel: 'Technical Drawer · Mechanic & Structure Manual',
    title: 'Field Dossier · Mechanic',
    subtitle: 'Phases 1–6 Guide & Structural Rules',
    summary: 'Inspect fairing tolerances, center-of-gravity limits, and missions assigned to this station.',
    dataPoints: [
      { label: 'Safety Factor', value: '>= 1.35x (Target 1.40x)' },
      { label: 'CoG Offset', value: '<= 18 mm lateral' },
    ],
  },
  'sys-whiteboard': {
    id: 'sys-whiteboard',
    roomId: 'systems',
    kind: 'whiteboard',
    hoverLabel: 'Max-Q Loads, Vibration & Structure Whiteboard',
    title: 'Structural Dynamics & Notes Whiteboard',
    subtitle: 'Mechanic · Criteria M13, M23, M33*, M43, M52, O17*',
    summary: 'Structural formulas and direct launch access to design, vibration, and solar panel missions.',
    dataPoints: [
      { label: 'Max-Q Pressure', value: '32.4 kPa @ T+68s' },
      { label: 'M33* Damping', value: '>= 60% Required' },
    ],
    formulas: [
      'Safety Factor = Ultimate Load / Limit Load >= 1.40',
      'CoG_x = Σ(m_i · x_i) / Σ(m_i) <= ±18 mm',
      'Solar Power ∝ Area (m²) · cos(θ)',
    ],
  },
  'sys-comms': {
    id: 'sys-comms',
    roomId: 'systems',
    kind: 'comms',
    hoverLabel: 'Inter-Department Radio · Mechanic',
    title: 'Mechanical Coordination Channel',
    subtitle: 'Comms with Scientist, Engineer & Program Manager',
    summary: 'Coordinate mass caps with Scientist & Engineer and structural changes ahead of each Gate.',
    dataPoints: [
      { label: 'Hangar Link', value: 'ACTIVE' },
      { label: 'Gates Channel', value: 'G13 / G23 / G43 / G53' },
    ],
  },
  'sys-bench': {
    id: 'sys-bench',
    roomId: 'systems',
    kind: 'bench',
    hoverLabel: 'Mass Scale, Assembly & Test Bench M11/M21/M31/M41/M51',
    title: 'Mechanical Integration & Mass Balance Bench',
    subtitle: 'Physical assembly, mass scale & O15* maintenance',
    summary: 'Run your mass-balance, 3D modular builder, and sequential assembly missions here.',
    dataPoints: [
      { label: 'Bench Missions', value: 'M11, M21, M31, M41, M51, O15*' },
      { label: 'Fairing Clearance', value: '6×4 m Verification' },
    ],
  },
  'sys-manuals': {
    id: 'sys-manuals',
    roomId: 'systems',
    kind: 'manuals',
    hoverLabel: 'NASA-STD-5001 Standards & Glossary Shelf',
    title: 'Structural Standards Library',
    subtitle: 'Vibration, Coupling & Repair Standards',
    summary: 'Review Annex B/C causal criteria and mechanical acceptance rules.',
    dataPoints: [{ label: 'Standard', value: 'NASA-STD-5001B' }],
    manualSections: [
      { code: 'MEC-01', heading: 'Volumetric Fit & Clearance', body: 'No module may intrude into the fairing dynamic deformation zone (>85% occupancy).' },
      { code: 'MEC-02', heading: 'Vibration Validation M33* & M52', body: 'All critical nodes (interstage, optics, thrust skirt) must be probed and damped.' },
    ],
  },

  // === PROGRAM MANAGEMENT & BUDGET CENTER (finance) ===
  'fin-computer': {
    id: 'fin-computer',
    roomId: 'finance',
    kind: 'computer',
    hoverLabel: 'Manager Terminal · Budget, Risk & Operations',
    title: 'Program, Finance & Risk Console',
    subtitle: 'Program Manager · Missions G* & O11*–O14*',
    summary: 'Manage G11/G31/G41 budgets, G22 trade study comparator, G51 test oversight, and O11*/O14* anomalies.',
    dataPoints: [
      { label: 'Minimum UFE Reserve', value: '>= 12–15% Budget' },
      { label: 'Cooperative Gates', value: 'G13, G23, G43, G53' },
    ],
  },
  'fin-drawer': {
    id: 'fin-drawer',
    roomId: 'finance',
    kind: 'drawer',
    hoverLabel: 'Manager Drawer · Program & Cost Guide',
    title: 'Program Manager Executive Dossier',
    subtitle: 'Viability, Slack & Voting Rules',
    summary: 'Review your responsibilities across all 6 phases and the Gate approval checklist.',
    dataPoints: [
      { label: 'Missions / Phase', value: '3 assigned + cooperative Gate' },
      { label: 'Key Criterion', value: 'Zero open critical blockers' },
    ],
  },
  'fin-whiteboard': {
    id: 'fin-whiteboard',
    roomId: 'finance',
    kind: 'whiteboard',
    hoverLabel: 'G21/G33 Risk & G52 Incident Whiteboard',
    title: 'Risk Matrix & Priorities Whiteboard',
    subtitle: 'Program Manager · G21, G33, G52, O12*',
    summary: 'Inspect and launch risk mitigation, NCR incident closure, and activity prioritization missions directly.',
    dataPoints: [
      { label: 'Matrix', value: '5×5 Likelihood × Impact' },
      { label: 'Target', value: 'Risk <= Difficulty Cap' },
    ],
    formulas: [
      'Free Budget = Cap - (Allocated + UFE Reserve)',
      'Critical Slack = Max Schedule - Critical Path End >= 10 d',
    ],
  },
  'fin-comms': {
    id: 'fin-comms',
    roomId: 'finance',
    kind: 'comms',
    hoverLabel: 'Program Manager Radio Terminal',
    title: 'Program Communications Desk',
    subtitle: 'Review Summons & Engineering Change Requests',
    summary: 'Broadcast budget priorities, convene Gate votes, and coordinate anomaly responses.',
    dataPoints: [{ label: 'Network', value: '4 Connected Divisions' }],
  },
  'fin-bench': {
    id: 'fin-bench',
    roomId: 'finance',
    kind: 'bench',
    hoverLabel: 'Audit & Evidence Traceability Desk',
    title: 'Audit & Quality Assurance Desk',
    subtitle: 'Test Oversight & Documentation Sign-off',
    summary: 'Inspect traceability across confirmed decisions, invalidated dependencies, and test evidence.',
    dataPoints: [{ label: 'Standard', value: 'NPR 7120.5F' }],
  },
  'fin-manuals': {
    id: 'fin-manuals',
    roomId: 'finance',
    kind: 'manuals',
    hoverLabel: 'Governance & Gate Rules Shelf',
    title: 'Program Governance & Control Manual',
    subtitle: 'G13/G23/G43/G53 Voting Protocols',
    summary: 'Regulations for cooperative resolution, ECR change management, and final evaluation O14*.',
    dataPoints: [{ label: 'Gate Quorum', value: '4 votes recorded (>=3 GO)' }],
    manualSections: [
      { code: 'GES-01', heading: 'Mandatory UFE Reserve', body: 'Keeping at least 12–15% unallocated absorbs Phase 4 changes and repairs.' },
      { code: 'GES-02', heading: 'NCR Incident Closure', body: 'GO cannot be signed at G53 while critical NCR incidents remain open in G52.' },
    ],
  },

  // === SCIENCE & PAYLOAD LAB (science) ===
  'sci-computer': {
    id: 'sci-computer',
    roomId: 'science',
    kind: 'computer',
    hoverLabel: 'Scientist Workstation · Data, Signal & Ops A11',
    title: 'Science, Coverage & Spectrometry Console',
    subtitle: 'Scientist · Missions C* & A11–A13',
    summary: 'Manage C13 data quotas, C23 orbital coverage, C31 precision, C52 quality, and A11 observations.',
    dataPoints: [
      { label: 'Domains', value: 'Science (pts), Data (GB), SNR (%)' },
      { label: 'Operations', value: 'A11, A12, A13 in Phase 6' },
    ],
  },
  'sci-drawer': {
    id: 'sci-drawer',
    roomId: 'science',
    kind: 'drawer',
    hoverLabel: 'Lab Drawer · C* Hypotheses & Protocols',
    title: 'Campaign Science Notebook',
    subtitle: 'Scientist · C11/C21/C42 Selection & C53/A13 Validation',
    summary: 'Review phase objectives and launch hypothesis cards, priority rankings, and final reports.',
    dataPoints: [
      { label: 'Science Target', value: 'By difficulty (40–100+ pts)' },
      { label: 'Min Coverage', value: '>= 70% target zones' },
    ],
  },
  'sci-whiteboard': {
    id: 'sci-whiteboard',
    roomId: 'science',
    kind: 'whiteboard',
    hoverLabel: 'Science Objectives & Spectral Bands Whiteboard',
    title: 'Science Yield & Windows Whiteboard',
    subtitle: 'Scientist · Coverage & Data Equations',
    summary: 'Coordinate instrument electrical power and downlink demands with the crew.',
    dataPoints: [{ label: 'Spectral Band', value: '280 – 2,400 nm UV/IR' }],
    formulas: [
      'Net Data (GB/d) = Raw Data · (1 - Compression%)',
      'Signal Quality >= 85% (Offset, Gain, Filter)',
    ],
  },
  'sci-comms': {
    id: 'sci-comms',
    roomId: 'science',
    kind: 'comms',
    hoverLabel: 'Scientist Link Console',
    title: 'Science Coordination Channel',
    subtitle: 'Link with Engineer & Mechanic',
    summary: 'Broadcast mass, power, and DSN window requirements for your experiments.',
    dataPoints: [{ label: 'Priority', value: 'Payload & Data' }],
  },
  'sci-bench': {
    id: 'sci-bench',
    roomId: 'science',
    kind: 'bench',
    hoverLabel: 'Optical & Calibration Bench C12/C22/C32/C41/C51/A12',
    title: 'Optical & Sensor Calibration Bench',
    subtitle: 'Instrument Integration & Spectral Analysis',
    summary: 'Run C12/C41 instrument selection, C51 calibration, and A12 spectral plot analysis here.',
    dataPoints: [{ label: 'Cleanroom', value: 'ISO Class 5' }],
  },
  'sci-manuals': {
    id: 'sci-manuals',
    roomId: 'science',
    kind: 'manuals',
    hoverLabel: 'Science Protocols Shelf',
    title: 'Methodology & Calibration Archive',
    subtitle: 'Science & Coverage Criteria',
    summary: 'Consult compression formulas, SNR ratios, and experimental validation rules C53.',
    dataPoints: [{ label: 'Protocol', value: 'CCSDS / COSPAR' }],
    manualSections: [
      { code: 'SCI-01', heading: 'Traceability Hypothesis -> Instrument -> Report', body: 'Each A13 discovery must be backed by A12 measurements and C41 instruments.' },
      { code: 'SCI-02', heading: 'Science vs Link Balance', body: 'Higher resolution raises GB/day; confirm with the Engineer that I32/I43 downlink handles it.' },
    ],
  },

  // === ENGINEERING, POWER & LINK CENTER (pilot) ===
  'plt-computer': {
    id: 'plt-computer',
    roomId: 'pilot',
    kind: 'computer',
    hoverLabel: 'Engineer Station · Power, Bus & Software',
    title: 'Power, Avionics Bus & B11 Operations Console',
    subtitle: 'Engineer · Missions I* & B11–B12',
    summary: 'Design I11/I31/I41 power grids, I23 SpaceWire bus, I53 flight SW debugging, and B11 orbital ops.',
    dataPoints: [
      { label: 'Domains', value: 'Watts (W), Wh, Mbps, Δv (m/s)' },
      { label: 'Operations', value: 'B11 Power · B12 Comms' },
    ],
  },
  'plt-drawer': {
    id: 'plt-drawer',
    roomId: 'pilot',
    kind: 'drawer',
    hoverLabel: 'Engineer Drawer · Autonomy & Trajectory',
    title: 'Systems & Flight Engineering Notebook',
    subtitle: 'Engineer · I33 Autonomy & Phases 1–6 Manual',
    summary: 'Review I33 eclipse calculations, flight requirements, and your 3 missions per phase.',
    dataPoints: [
      { label: 'Eclipse Autonomy', value: '>= 6.0 hours (I33)' },
      { label: 'Power Margin', value: '>= +40 W nominal' },
    ],
  },
  'plt-whiteboard': {
    id: 'plt-whiteboard',
    roomId: 'pilot',
    kind: 'whiteboard',
    hoverLabel: 'Trajectory Δv & Power Balance Whiteboard',
    title: 'Orbital Dynamics & Power Whiteboard',
    subtitle: 'Engineering · Tsiolkovsky Equation & Links',
    summary: 'Check minimum Δv by destination and electrical/RF redundancy rules.',
    dataPoints: [
      { label: 'LEO / Moon / Mars', value: '3,200 / 4,500 / 5,400 m/s' },
    ],
    formulas: [
      'Δv = Isp · 9.81 · ln((m_dry + m_prop) / m_dry)',
      'Autonomy (h) = Battery (Wh) / Critical Load (W)',
      'Daily Throughput (GB) = Σ(Mbps · window_s / 8000)',
    ],
  },
  'plt-comms': {
    id: 'plt-comms',
    roomId: 'pilot',
    kind: 'comms',
    hoverLabel: 'DSN Ground Network & Link Station I12/I22/I32/I43/I51/B12',
    title: 'Communications & Ground Link Center',
    subtitle: 'S/Ka Antennas, DSN Windows & Packet Tests',
    summary: 'Launch antenna sizing, DSN ground stations, bandwidth, and B12 downlink missions.',
    dataPoints: [{ label: 'Ground Network', value: 'Madrid · Goldstone · Canberra' }],
  },
  'plt-bench': {
    id: 'plt-bench',
    roomId: 'pilot',
    kind: 'bench',
    hoverLabel: 'Power, Memory, Propellant & Diagnostics Bench',
    title: 'Electrical & Propulsion Simulation Bench',
    subtitle: 'Memory I13, Power I21, Propellant I42, Check I52',
    summary: 'Run SSR storage, eclipse profile, Tsiolkovsky Δv calculator, and I52 bench test here.',
    dataPoints: [{ label: 'Ref Isp', value: '445 s Cryogenic' }],
  },
  'plt-manuals': {
    id: 'plt-manuals',
    roomId: 'pilot',
    kind: 'manuals',
    hoverLabel: 'Engineering & Link Rules Shelf',
    title: 'Flight Engineering & Power Manual',
    subtitle: 'Autonomy, Δv & FDIR Criteria',
    summary: 'Technical reference on battery sizing, S/Ka antennas, and fault recovery.',
    dataPoints: [{ label: 'Code', value: 'ENG-CCSDS-2026' }],
    manualSections: [
      { code: 'ENG-01', heading: 'RF Redundancy Rule', body: 'Every mission must pair a Ka-Band science downlink with an omnidirectional S-Band backup.' },
      { code: 'ENG-02', heading: 'I42 Propellant Margin', body: 'Include at least 6% extra reserve above the nominal destination Δv.' },
    ],
  },

  // === ROCKET HANGAR (11) ===
  'hng-nozzles': {
    id: 'hng-nozzles',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: 'Main Nozzles & Thrust Skirt (I42 / M21)',
    title: 'Main Propulsion & Nozzles Section',
    subtitle: 'Rocket Hangar · Stage 1',
    summary: '3D inspection of regenerative nozzles linked to I42 propellant sizing and M51 assembly.',
    dataPoints: [
      { label: 'Core Thrust', value: '7.6 MN' },
      { label: 'Related Missions', value: 'I42 · M33* · M51' },
    ],
  },
  'hng-fuel-tank': {
    id: 'hng-fuel-tank',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: 'Cryo Core Tank & Solar Mounts (M11 / M43 / I21)',
    title: 'Al-Li 2195 Core Tank & Solar Array Mount',
    subtitle: 'Rocket Hangar · Core Fuselage',
    summary: 'Structural core body carrying the solar wings designed in I21/I41/M43.',
    dataPoints: [
      { label: 'Material', value: 'Al-Li 2195 Orthogrid' },
      { label: 'Related Missions', value: 'M11 · I21 · M43' },
    ],
  },
  'hng-interstage': {
    id: 'hng-interstage',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: 'Composite Interstage & RCS Ring (M13 / M33* / M52)',
    title: 'Carbon Interstage & Separation Ring',
    subtitle: 'Rocket Hangar · Max-Q Critical Zone',
    summary: 'Section subjected to M33* vibration testing and M52 structural verification.',
    dataPoints: [
      { label: 'Separation', value: 'Pneumatic Non-Pyro' },
      { label: 'Related Missions', value: 'M13 · M33* · M42 · M52' },
    ],
  },
  'hng-oxidizer-tank': {
    id: 'hng-oxidizer-tank',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: 'Service Bay & Instruments (C12 / C41 / M53)',
    title: 'Upper Stage & Instrument Rack',
    subtitle: 'Rocket Hangar · Stage 2',
    summary: 'Houses spectrometers, bio-lab, and instruments calibrated in C51–C53 and integrated in M53.',
    dataPoints: [
      { label: 'Instruments', value: 'C12 · C41 · M22 · M53' },
    ],
  },
  'hng-avionics': {
    id: 'hng-avionics',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: 'Avionics Ring & Ka Antenna (I23 / I43 / I53)',
    title: 'SpaceWire Avionics Ring & Ka Gimbal',
    subtitle: 'Rocket Hangar · Flight Brain',
    summary: 'Integrates the I23 bus, I43 Ka link, and I53 verified flight software.',
    dataPoints: [
      { label: 'Architecture', value: 'OBC RAD750 + SSR + Ka' },
    ],
  },
  'hng-fairing': {
    id: 'hng-fairing',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: 'Aerodynamic Fairing & Envelope (M12 / M32 / C41)',
    title: 'Composite Fairing & Escape Tower',
    subtitle: 'Rocket Hangar · Payload Volume',
    summary: 'Protects the volume allocated in M12/M32 and the C41 HD telescope.',
    dataPoints: [
      { label: 'Fairing Diameter', value: '5.2 m Composite' },
    ],
  },
  'hng-umbilical': {
    id: 'hng-umbilical',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: 'Umbilical Service Tower',
    title: 'Launch Tower & Umbilical Arm',
    subtitle: 'Rocket Hangar · Pad Link',
    summary: 'Supplies ground power, purge gas, and telemetry link until retraction at T-0.',
    dataPoints: [
      { label: 'Retraction', value: '0.8 s at Ignition' },
    ],
  },
  'hng-pad-console': {
    id: 'hng-pad-console',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: 'Pad 39A Launch Console (Simulate Launch)',
    title: 'Terminal Launch Console',
    subtitle: 'Rocket Hangar · Annex C Audit & Simulation',
    summary: 'Verifies all 6 Annex C pillars and Gate G53, then launches the 3D flight simulation.',
    dataPoints: [
      { label: 'Authorization', value: 'Gate G53 GO/NO-GO' },
    ],
  },
  'hng-cryo-pipes': {
    id: 'hng-cryo-pipes',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: 'LOX/LH2 Cryogenic Spheres (I42)',
    title: 'Cryogenic Spheres & Fill Manifold',
    subtitle: 'Rocket Hangar · Propellant',
    summary: 'Feeds propellant sized in the I42 orbital Δv calculator.',
    dataPoints: [
      { label: 'Flow Rate', value: '1,420 kg/s Cryogenic' },
    ],
  },
  'hng-crane': {
    id: 'hng-crane',
    roomId: 'hangar',
    kind: 'hangar-part',
    hoverLabel: '120T Integration Bridge Crane (M51)',
    title: 'High-Bay Overhead Crane',
    subtitle: 'Rocket Hangar · M51/M53 Assembly',
    summary: 'Positions stages and instruments for M51 assembly and M53 payload mating.',
    dataPoints: [
      { label: 'Capacity', value: '120 Metric Tons' },
    ],
  },
  'hng-schedule': {
    id: 'hng-schedule',
    roomId: 'hangar',
    kind: 'schedule',
    hoverLabel: 'Master Gantt Schedule · Phases 1–6 (G12 / G32 / G42)',
    title: 'Master Schedule — 6 Phases & 72 Missions Program',
    subtitle: 'Hangar · Integrated Planning & Critical Path',
    summary: 'Inspect full 6-phase progress, all 72 missions, schedule slack, and launch any pending task.',
    dataPoints: [
      { label: 'Horizon', value: '6 Phases · 72 Missions' },
      { label: 'Gates', value: 'G13 · G23 · G43 · G53' },
    ],
  },

  // === BRIEFING ROOM (1) ===
  'mtg-holo': {
    id: 'mtg-holo',
    roomId: 'meeting',
    kind: 'meeting-holo',
    hoverLabel: 'Holographic Table · Gates G13/G23/G43/G53 & Recalculations',
    title: 'Briefing Room · Cooperative Gates & Cross-Recalculation',
    subtitle: 'Briefing Room · Multidisciplinary Decisions',
    summary: 'Run Gate votes (G13, G23, G43, G53), inspect shared-state recalculations, and resolve O13* emergencies.',
    dataPoints: [
      { label: 'Quorum', value: '4 Specialties' },
      { label: 'Validation', value: 'Annex C · 6 Pillars' },
    ],
  },
};

export interface RoleManualGuide {
  briefingSubtitle: string;
  globalResponsibility: string;
  whyTeamNeedsYou: string[];
  meetingCoordination: string;
}

export const ROLE_MANUAL_GUIDES: Record<RoleId, RoleManualGuide> = {
  systems: {
    briefingSubtitle: 'Mass, Fairing Volume, Structure & Maintenance (M* / O15*–O17*)',
    globalResponsibility:
      'You ensure the entire spacecraft fits physically inside the fairing, keeps its Center of Gravity balanced, and survives launch and operational vibration loads.',
    whyTeamNeedsYou: [
      'Every Science instrument or Engineering battery adds mass (kg) and volume (m³) into your M11–M41 models.',
      'M33* and M52 vibration tests prevent structural failure at Max-Q.',
      'In Phase 6 you monitor physical health, run spare-part repairs O16*, and resolve structural faults O17*.',
    ],
    meetingCoordination:
      'Join every Gate (G13, G23, G43, G53) to verify team changes stay within the physical envelope.',
  },
  finance: {
    briefingSubtitle: 'Budget, Schedule, Risk, Gates & Operations (G* / O11*–O14*)',
    globalResponsibility:
      'You orchestrate financial resources ($M), the day-by-day schedule, the risk matrix, and cooperative reviews to keep the entire program viable.',
    whyTeamNeedsYou: [
      'Your UFE reserve (12–15%) shields the team during G43 change requests and G21/G33 mitigations.',
      'You oversee test closure G51 and NCR incidents G52 before authorizing launch at G53.',
      'In Phase 6 you clear O11* anomalies, prioritize O12* tasks, and lead O13* emergencies through O14* evaluation.',
    ],
    meetingCoordination:
      'Convene the Briefing Room at the end of Phases 1, 2, 4, and 5 to vote on G13, G23, G43, and G53.',
  },
  science: {
    briefingSubtitle: 'Objectives, Instruments, Coverage, Calibration & Findings (C* / A11–A13)',
    globalResponsibility:
      'You define the scientific purpose of the mission: selecting hypotheses, sizing data, calibrating sensors, and publishing orbital discoveries.',
    whyTeamNeedsYou: [
      'Without enough science return (pts) and coverage (>=70%), the mission misses its core objective.',
      'Your daily data volume (GB/day) in C13/C32 directly drives I13 storage and I32/I43 downlink.',
      'In Phase 5 you calibrate offset/gain/filter C51–C53, and in Phase 6 you capture and publish findings A11–A13.',
    ],
    meetingCoordination:
      'Negotiate trade-offs between optical resolution, power demand (W), and instrument mass in every phase.',
  },
  pilot: {
    briefingSubtitle: 'Power, Comms, Memory, Δv & Software (I* / B11–B12)',
    globalResponsibility:
      'You guarantee solar/battery electrical supply, SSR storage, Earth-spacecraft DSN links, Δv propellant, and flight software.',
    whyTeamNeedsYou: [
      'A power deficit in I21/I41 or low eclipse autonomy in I33 causes an orbital bus blackout.',
      'You compute real orbital Δv (I42) via Tsiolkovsky to reach the mission target.',
      'In Phase 5 you debug electrical I52 and software I53 faults; in Phase 6 you manage B11 power and B12 packets.',
    ],
    meetingCoordination:
      'Flag whenever science instruments or mechanical reinforcements exceed solar or Mbps link capacity.',
  },
};

export interface TechnicalGlossaryEntry {
  term: string;
  unitOrRange: string;
  accentHex: string;
  explanation: string;
  whyVitalForMoonReturn: string;
}

export const TECHNICAL_GLOSSARY: TechnicalGlossaryEntry[] = [
  {
    term: 'Total Mass & Center of Gravity',
    unitOrRange: 'kg / ±18 mm CoG',
    accentHex: '#F97316',
    explanation: 'Dry mass plus propellant computed by Mechanic in M11/M31/M41.',
    whyVitalForMoonReturn: 'Exceeding the mass cap prevents reaching target Δv or ruptures joints at Max-Q.',
  },
  {
    term: 'Power Balance & Autonomy',
    unitOrRange: 'Net W (>= +25 W) / h eclipse',
    accentHex: '#38BDF8',
    explanation: 'Solar generation minus simultaneous loads plus Li-Ion battery reserve (Wh) calibrated by Engineer.',
    whyVitalForMoonReturn: 'Keeps telemetry, thermal control, and sensors alive through every orbital eclipse.',
  },
  {
    term: 'Data & DSN Link',
    unitOrRange: 'GB vs SSR · Mbps (>= 24–34 Mbps)',
    accentHex: '#22C55E',
    explanation: 'Balance between daily science capture C13/C32 by Scientist and S/Ka downlink I32/I43 by Engineer.',
    whyVitalForMoonReturn: 'If capture rate exceeds downlink capacity, buffers overflow and discoveries are lost.',
  },
  {
    term: 'UFE Reserve & Critical Slack',
    unitOrRange: '$M (UFE >= 12%) · Days (>= 10d)',
    accentHex: '#EAB308',
    explanation: 'Financial and schedule cushion managed by Program Manager to absorb changes.',
    whyVitalForMoonReturn: 'Prevents budget freezes in Phase 4 (G43) and missed launch windows in Phase 5.',
  },
  {
    term: 'Residual Risk & Gates G13–G53',
    unitOrRange: '% risk · 4 Gates GO',
    accentHex: '#EF4444',
    explanation: 'Combined risk level after G21/G33/G52 mitigations and M33*/I52/I53/M52 verification tests.',
    whyVitalForMoonReturn: 'Only with all 4 Gates approved and risk under cap is launch cleared as safe.',
  },
];

export const HANGAR_ASSEMBLY_PAD_POS: [number, number, number] = [0, GROUND_FLOOR_Y, 9.2];
export const HANGAR_ASSEMBLY_PAD_RADIUS = 2.4;

export const CARGO_MODULES: CargoModuleDef[] = [
  {
    id: 'cargo-cryo-cell',
    name: 'Cryogenic Propulsion Cell',
    shortLabel: 'Cryo Cell',
    variant: 'cryo-cell',
    roleId: 'systems',
    originRoomId: 'systems',
    accentHex: '#F97316',
    accentNumber: 0xf97316,
    weight: 1.35,
    fragility: 1.15,
    riskPenaltyOnBreak: 8,
    scienceBonusOnDeliver: 4,
    spawnLocalPos: [2.6, GROUND_FLOOR_Y, 6.4],
    padSlotOffset: [-1.45, 0.14, -0.45],
    radius: 0.46,
    description: 'Pressurized LH2 unit. Transport smoothly to the Hangar without hitting walls.',
  },
  {
    id: 'cargo-thermal-crate',
    name: 'Ceramic Thermal Shield Panel',
    shortLabel: 'Thermal Shield',
    variant: 'thermal-crate',
    roleId: 'systems',
    originRoomId: 'systems',
    accentHex: '#FB923C',
    accentNumber: 0xfb923c,
    weight: 1.48,
    fragility: 1.25,
    riskPenaltyOnBreak: 7,
    scienceBonusOnDeliver: 3,
    spawnLocalPos: [-2.6, GROUND_FLOOR_Y, 6.4],
    padSlotOffset: [-0.72, 0.14, 0.55],
    radius: 0.48,
    description: 'PICA-X ablative tiles. Impacts lower structural integrity and increase risk.',
  },
  {
    id: 'cargo-budget-case',
    name: 'Encrypted Authorization Briefcase',
    shortLabel: 'Auth Briefcase',
    variant: 'budget-case',
    roleId: 'finance',
    originRoomId: 'finance',
    accentHex: '#EAB308',
    accentNumber: 0xeab308,
    weight: 1.0,
    fragility: 0.9,
    riskPenaltyOnBreak: 5,
    scienceBonusOnDeliver: 3,
    spawnLocalPos: [2.6, GROUND_FLOOR_Y, 6.4],
    padSlotOffset: [0.0, 0.14, -0.58],
    radius: 0.42,
    description: 'Cryptographic launch keys for Gate G53 clearance at the Hangar.',
  },
  {
    id: 'cargo-sample-canister',
    name: 'Sterile Instrument Canister',
    shortLabel: 'Science Canister',
    variant: 'sample-canister',
    roleId: 'science',
    originRoomId: 'science',
    accentHex: '#22C55E',
    accentNumber: 0x22c55e,
    weight: 1.15,
    fragility: 1.35,
    riskPenaltyOnBreak: 6,
    scienceBonusOnDeliver: 8,
    spawnLocalPos: [-2.6, GROUND_FLOOR_Y, 6.4],
    padSlotOffset: [0.75, 0.14, 0.55],
    radius: 0.42,
    description: 'Calibrated optical canister. Deliver intact to the Hangar for +8 Science bonus.',
  },
  {
    id: 'cargo-avionics-core',
    name: 'Inertial Avionics Core',
    shortLabel: 'Avionics Core',
    variant: 'avionics-core',
    roleId: 'pilot',
    originRoomId: 'pilot',
    accentHex: '#3B82F6',
    accentNumber: 0x3b82f6,
    weight: 1.2,
    fragility: 1.25,
    riskPenaltyOnBreak: 9,
    scienceBonusOnDeliver: 5,
    spawnLocalPos: [2.6, GROUND_FLOOR_Y, 6.4],
    padSlotOffset: [1.45, 0.14, -0.45],
    radius: 0.44,
    description: 'Gyroscopes and star tracker. Collisions decalibrate guidance and raise risk.',
  },
];

export const CARGO_MAP: Record<string, CargoModuleDef> = CARGO_MODULES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, CargoModuleDef>,
);
