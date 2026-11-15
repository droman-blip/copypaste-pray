import type { InteractableId, RoleId } from '../types/mission';

export type CadBlueprintVariant =
  | 'nozzles'
  | 'fuel-tank'
  | 'interstage'
  | 'oxidizer-tank'
  | 'avionics'
  | 'fairing'
  | 'umbilical'
  | 'pad-console'
  | 'cryo-pipes'
  | 'crane';

export interface RocketComponentSpec {
  interactableId: InteractableId;
  subsystemCode: string;
  owningRoleId: RoleId;
  cadVariant: CadBlueprintVariant;
  cadTitle: string;
  cadScaleNote: string;
  materialAlloy: string;
  dryMassKg: string;
  capacityLabel: string;
  operatingTempLimits: string;
  operatingPressureLimits: string;
  thrustOrPowerLabel: string;
  scienceYieldLabel: string;
  riskContributionLabel: string;
  upgradePhaseNumber: number;
  upgradePhaseLabel: string;
  relatedModuleIds: string[];
  relatedCargoId: string;
  survivalNotes: string[];
}

export const ROCKET_COMPONENT_SPECS: Record<string, RocketComponentSpec> = {
  'hng-nozzles': {
    interactableId: 'hng-nozzles',
    subsystemCode: 'PROP-S1-NOZ-01',
    owningRoleId: 'systems',
    cadVariant: 'nozzles',
    cadTitle: 'REGENERATIVELY COOLED ENGINE CLUSTER CROSS-SECTION',
    cadScaleNote: 'SCALE 1:20 · SECTION A-A · EXPANSION RATIO 69:1',
    materialAlloy: 'Inconel 718 / NARloy-Z Copper Liner',
    dryMassKg: '1,420 kg (Base Cluster)',
    capacityLabel: '2,650 kg/s Combined Propellant Flow',
    operatingTempLimits: '20 K (-253 °C) Jacket / 3,580 K Core',
    operatingPressureLimits: '258 bar Chamber / 412 bar Turbopump',
    thrustOrPowerLabel: '7,600 kN Sea-Level Thrust (-30 W TVC)',
    scienceYieldLabel: '+5 to +15 Sci pts (via Telemetry Upgrades)',
    riskContributionLabel: '+4% to +11% Thermal Load (Mitigated in PH-02)',
    upgradePhaseNumber: 2,
    upgradePhaseLabel: 'Phase 2 · Propulsion Architecture',
    relatedModuleIds: ['sys-solid-boosters', 'sys-cryo-engine'],
    relatedCargoId: 'cargo-cryo-cell',
    survivalNotes: [
      'Generates 100% of liftoff impulse; thrust-to-weight < 1.25 causes an immediate Pad 39A settle-back stall.',
      'Upgraded by S-1 Twin Solid Boosters (Systems) and Advanced Cryo Engine Cluster once Finance authorizes hardware.',
      'High-chamber-pressure injector options trigger Acoustic Resonance conflicts with Science optics requiring Briefing Room vibration dampers.',
    ],
  },
  'hng-fuel-tank': {
    interactableId: 'hng-fuel-tank',
    subsystemCode: 'STR-CORE-LH2-02',
    owningRoleId: 'systems',
    cadVariant: 'fuel-tank',
    cadTitle: 'CORE STAGE AL-LI 2195 ORTHOGRID TANK & SOLAR MOUNT',
    cadScaleNote: 'SCALE 1:40 · CIRCUMFERENTIAL WELD RIB PROFILE',
    materialAlloy: 'Aluminum-Lithium 2195 Orthogrid + SOFI Foam',
    dryMassKg: '1,840 kg (Core Dry Shell)',
    capacityLabel: '418,000 L Subcooled LH2 / Core Feed',
    operatingTempLimits: '19.5 K (-253.6 °C) Internal / 420 K Skin',
    operatingPressureLimits: '3.4 bar Ullage / 6.2 bar Burst Proof',
    thrustOrPowerLabel: '+95 W to +240 W Solar Array Interfaces',
    scienceYieldLabel: 'Baseline Structural Carrier (0 Sci direct)',
    riskContributionLabel: '-8% Reentry Risk w/ Gold Kapton Thermal Wrap',
    upgradePhaseNumber: 3,
    upgradePhaseLabel: 'Phase 3 · Structural & Mass Budget',
    relatedModuleIds: ['fin-solar-standard', 'fin-solar-heavy', 'fin-thermal-shield'],
    relatedCargoId: 'cargo-thermal-crate',
    survivalNotes: [
      'Serves as primary structural spine during Max-Q aerodynamic shear (~T+68s) and hosts the Program Manager solar wing hinges.',
      'Ultra-thin orthogrid tank reductions trim dry mass toward Mars limits but heighten buckling risk unless Phase 3 checks pass.',
      'Delivering undamaged Ceramic Thermal Shield Tiles to the Assembly Pad bolsters reentry survival margins.',
    ],
  },
  'hng-interstage': {
    interactableId: 'hng-interstage',
    subsystemCode: 'STR-INT-RCS-03',
    owningRoleId: 'systems',
    cadVariant: 'interstage',
    cadTitle: 'CARBON-COMPOSITE INTERSTAGE & PNEUMATIC SEPARATION RING',
    cadScaleNote: 'SCALE 1:25 · RING FRAME + QUAD RCS THRUSTER PODS',
    materialAlloy: 'IM7/8552 Carbon-Epoxy Honeycomb + Ti-6Al-4V',
    dryMassKg: '320 kg (With RCS Attitude Collar)',
    capacityLabel: '4 × 450 N Cold-Gas & Hydrazine Attitude Pods',
    operatingTempLimits: '180 K to 560 K (-93 °C to +287 °C)',
    operatingPressureLimits: '210 bar N2 Pneumatic Pusher Bottles',
    thrustOrPowerLabel: '1.8 kN Attitude Torque / -15 W Valve Solenoids',
    scienceYieldLabel: '+5 Sci pts (Clean Stage Separation Window)',
    riskContributionLabel: '-6% Flight Risk upon RCS Ring Integration',
    upgradePhaseNumber: 3,
    upgradePhaseLabel: 'Phase 3 · Structural & Mass Budget',
    relatedModuleIds: ['sys-rcs-structure'],
    relatedCargoId: 'cargo-thermal-crate',
    survivalNotes: [
      'Absorbs bending moments between Stage 1 and Stage 2 during pitch-over maneuvers and guarantees zero re-contact during MECO staging.',
      'Installing the RCS Attitude & Thrust Ring stabilizes supersonic roll oscillations and lowers overall launch failure risk by 6%.',
      'Over-aggressive overtime cuts in Finance can squeeze non-destructive ultrasonic weld inspections across this joint.',
    ],
  },
  'hng-oxidizer-tank': {
    interactableId: 'hng-oxidizer-tank',
    subsystemCode: 'PAY-STG2-LOX-04',
    owningRoleId: 'science',
    cadVariant: 'oxidizer-tank',
    cadTitle: 'UPPER STAGE SERVICE BAY & INSTRUMENT RACK CUTAWAY',
    cadScaleNote: 'SCALE 1:30 · PAYLOAD BAY SERVICE MODULE',
    materialAlloy: 'Al-Li 2099 / Beryllium Optical Bench Mounts',
    dryMassKg: '960 kg + Science Rack Modules',
    capacityLabel: '112,000 L Subcooled LOX + 3 Payload Bays',
    operatingTempLimits: '90.2 K (-183 °C) LOX / 293 K Clean Bay',
    operatingPressureLimits: '4.1 bar Tank / 1.01 bar Lab Containment',
    thrustOrPowerLabel: '-35 W to -90 W Combined Payload Draw',
    scienceYieldLabel: '+35 to +85 Sci pts (Spectrometer & Micro Lab)',
    riskContributionLabel: '+2% to +6% Power/Thermal Load Balance',
    upgradePhaseNumber: 5,
    upgradePhaseLabel: 'Phase 5 · Payload & Science',
    relatedModuleIds: ['sci-spectrometer', 'sci-microgravity-lab'],
    relatedCargoId: 'cargo-sample-canister',
    survivalNotes: [
      'Carries orbital insertion oxidizer and external analytical bays housing the Deep-Space Mass Spectrometer and Microgravity Bio-Lab.',
      'If net spacecraft wattage drops below 0 W, payload thermal heaters shut down in orbital eclipse, spoiling biological samples.',
      'Delivering the Sealed Lunar Sample Canister intact to the Hangar Assembly Pad awards a direct +8 Science Return bonus.',
    ],
  },
  'hng-avionics': {
    interactableId: 'hng-avionics',
    subsystemCode: 'GNC-AVN-IMU-05',
    owningRoleId: 'pilot',
    cadVariant: 'avionics',
    cadTitle: 'TRIPLE-MODULAR AVIONICS RING & KA-BAND GIMBAL SCHEMATIC',
    cadScaleNote: 'SCALE 1:18 · RAD-HARD VOTING ARCHITECTURE',
    materialAlloy: 'Gold-Plated Al 6061-T6 Chassis / Rad-Hard Silicon',
    dryMassKg: '390 kg (Ring + Ka-Band Gimbal)',
    capacityLabel: '3× Ring-Laser Gyros + 622 Mbps Ka-Band Trunk',
    operatingTempLimits: '253 K to 328 K (-20 °C to +55 °C)',
    operatingPressureLimits: '1.0 bar Hermetic Dry-Nitrogen Enclosure',
    thrustOrPowerLabel: '-45 W Peak RF Downlink & Guidance Draw',
    scienceYieldLabel: '+25 Sci pts (High-Rate Telemetry Return)',
    riskContributionLabel: '-9% Navigation Risk w/ Autonomous Abort',
    upgradePhaseNumber: 4,
    upgradePhaseLabel: 'Phase 4 · Power & Avionics',
    relatedModuleIds: ['plt-kaband-dish', 'plt-abort-guidance'],
    relatedCargoId: 'cargo-avionics-core',
    survivalNotes: [
      'Runs 200 Hz closed-loop guidance voting; losing two of three redundant lanes sends the upper stage off its entry corridor.',
      'Ka-Band high-gain dish boosts science telemetry delivery by +25 pts but requires Finance power contracts to cover -45 W.',
      'Rough handling of the Avionics Guidance Core cargo module during tractor-beam transit misaligns optical gyros and elevates Risk (%).',
    ],
  },
  'hng-fairing': {
    interactableId: 'hng-fairing',
    subsystemCode: 'STR-FRG-LES-06',
    owningRoleId: 'science',
    cadVariant: 'fairing',
    cadTitle: 'OGIVE ACOUSTIC PAYLOAD FAIRING & LAUNCH ESCAPE TOWER',
    cadScaleNote: 'SCALE 1:35 · CLAMSHELL & CREW ESCAPE ENVELOPE',
    materialAlloy: 'Carbon-Cyanate Ester Composite + Cork TPS',
    dryMassKg: '580 kg (Shroud + Escape Lattice)',
    capacityLabel: '5.2 m Diameter Dynamic Clean Payload Volume',
    operatingTempLimits: '220 K to 1,450 K Peak Ascent Aeroheating',
    operatingPressureLimits: '142 dB Max Acoustic Attenuation',
    thrustOrPowerLabel: '1,250 kN Solid Abort Motor (0.2s Ignition)',
    scienceYieldLabel: '+40 Sci pts (Houses HD Orbital Telescope)',
    riskContributionLabel: '-4% to -9% Crew Survival Recovery',
    upgradePhaseNumber: 6,
    upgradePhaseLabel: 'Phase 6 · Life Support & Thermal',
    relatedModuleIds: ['sci-hd-camera', 'plt-sband-link', 'plt-abort-guidance'],
    relatedCargoId: 'cargo-sample-canister',
    survivalNotes: [
      'Shields precision HD telescope optics and crew return hardware against aerodynamic pressure, salt spray, and plasma heating.',
      'The top S-Band Mast and Mode I Launch Escape Tower remain armed from T-0 until solid booster burnout to save crew during ascent aborts.',
      'Heavy telescope mirror conflicts in Science must be mitigated with fairing acoustic blanketing before Phase 9.',
    ],
  },
  'hng-umbilical': {
    interactableId: 'hng-umbilical',
    subsystemCode: 'GND-TWR-UMB-07',
    owningRoleId: 'pilot',
    cadVariant: 'umbilical',
    cadTitle: 'SERVICE GANTRY TOWER & T-0 RETRACTING UMBILICAL ARM',
    cadScaleNote: 'SCALE 1:60 · STRUCTURAL TRUSS & SWING KINEMATICS',
    materialAlloy: 'ASTM A992 Structural Steel + Gold Kapton Sleeve',
    dryMassKg: '42,500 kg (Fixed Launch Structure)',
    capacityLabel: '400 VDC Ground Bus + N2 Purge + Crew Access',
    operatingTempLimits: '260 K to 1,800 K Plume Deflection',
    operatingPressureLimits: '280 bar Hydraulic Quick-Disconnect',
    thrustOrPowerLabel: '0.8 s Clearance Swing Torque',
    scienceYieldLabel: 'Enables Pre-Launch Sensor Calibration',
    riskContributionLabel: 'Pad Hold-Down Interlock Protection',
    upgradePhaseNumber: 8,
    upgradePhaseLabel: 'Phase 8 · Ground Systems & Fueling',
    relatedModuleIds: ['plt-sband-link', 'fin-thermal-shield'],
    relatedCargoId: 'cargo-budget-case',
    survivalNotes: [
      'Feeds conditioned purge nitrogen, chilled avionics power, and crew cabin telemetry until T-00:00 ignition hold-down release.',
      'Gold-foil Kapton arm must swing clear in under 0.8 seconds at liftoff; delayed retraction threatens upper stage collision.',
      'Phase 8 Ground Systems decisions calibrate hold-down clamps and rain-fade weather clearance.',
    ],
  },
  'hng-pad-console': {
    interactableId: 'hng-pad-console',
    subsystemCode: 'OPS-PAD39A-LC-08',
    owningRoleId: 'pilot',
    cadVariant: 'pad-console',
    cadTitle: 'PAD 39A TERMINAL LAUNCH CONTROL & GO/NO-GO MATRIX',
    cadScaleNote: 'SYSTEM BLOCK · TELEMETRY TRUNK & ABORT INTERLOCKS',
    materialAlloy: 'MIL-STD-810G Anodized Aluminum / Dual-Fiber Ring',
    dryMassKg: '185 kg (Floor-Mounted Blast-Hardened Desk)',
    capacityLabel: '10 Gbps Redundant Launch Control Telemetry',
    operatingTempLimits: '283 K to 318 K (Climate Controlled Bay)',
    operatingPressureLimits: 'IP65 Positive Overpressure Shelter',
    thrustOrPowerLabel: '240 W Station Draw (Ground Grid)',
    scienceYieldLabel: 'Validates Full Flight Readiness Matrix',
    riskContributionLabel: 'Prevents Unverified Countdown Commits',
    upgradePhaseNumber: 10,
    upgradePhaseLabel: 'Phase 10 · Final Flight Readiness',
    relatedModuleIds: ['plt-abort-guidance', 'sys-rcs-structure'],
    relatedCargoId: 'cargo-budget-case',
    survivalNotes: [
      'Direct terminal ignition interface for launching the integrated rocket at any campaign milestone to stress-test survival.',
      'Checks four critical gates before safe orbit & return: Mass <= Ceiling, Net Power >= 0 W, Science >= Minimum, Risk <= Survival Cap.',
      'Unresolved Red Alert conflicts in the Briefing Room force critical failure cascades during countdown simulation.',
    ],
  },
  'hng-cryo-pipes': {
    interactableId: 'hng-cryo-pipes',
    subsystemCode: 'GND-CRYO-MAN-09',
    owningRoleId: 'finance',
    cadVariant: 'cryo-pipes',
    cadTitle: 'VACUUM-JACKETED CRYO SPHERES & FAST-FILL MANIFOLD',
    cadScaleNote: 'SCALE 1:45 · P&ID FLUID ROUTING DIAGRAM',
    materialAlloy: '304L Stainless Inner Sphere / Copper Transfer Lines',
    dryMassKg: '18,400 kg (Dual Tank Farm)',
    capacityLabel: '1,420 kg/s Fast-Fill Cryogenic Transfer',
    operatingTempLimits: '19 K (-254 °C) LH2 / 90 K (-183 °C) LOX',
    operatingPressureLimits: '18 bar Subcooled Manifold Head',
    thrustOrPowerLabel: '-25 W Closed-Loop Reliquefier Draw (Pad)',
    scienceYieldLabel: 'Protects Boil-Off Mass Margins',
    riskContributionLabel: 'Prevents Early MECO Cutoff in PH-08',
    upgradePhaseNumber: 8,
    upgradePhaseLabel: 'Phase 8 · Ground Systems & Fueling',
    relatedModuleIds: ['sys-cryo-engine', 'fin-thermal-shield'],
    relatedCargoId: 'cargo-cryo-cell',
    survivalNotes: [
      'Keeps liquid hydrogen and oxygen densified right up to T-30s pressurization; boil-off bubbles cause premature engine cutoff (MECO).',
      'Program Manager contracts govern cryo boil-off recovery vs. fast-turnaround schedule costs.',
      'Transporting the Cryogenic Fuel Cell cargo canister intact to the Assembly Pad verifies manifold leak seals.',
    ],
  },
  'hng-crane': {
    interactableId: 'hng-crane',
    subsystemCode: 'VAB-CRN-HOIST-10',
    owningRoleId: 'finance',
    cadVariant: 'crane',
    cadTitle: 'HIGH-BAY 120-TON OVERHEAD BRIDGE CRANE & TROLLEY',
    cadScaleNote: 'SCALE 1:80 · TROLLEY GIRDER & LASER ALIGNMENT',
    materialAlloy: 'High-Tensile Structural Steel Bridge Box Girder',
    dryMassKg: '34,000 kg (Span + Dual Hoist Trolley)',
    capacityLabel: '120 Metric Ton Precision Vertical Lift',
    operatingTempLimits: '273 K to 323 K High-Bay Ambient',
    operatingPressureLimits: '±1.5 mm Laser Interferometer Positioning',
    thrustOrPowerLabel: '480 V Three-Phase High-Bay Bus',
    scienceYieldLabel: 'Zero-Shock Payload Fairing Integration',
    riskContributionLabel: 'Prevents Structural Micro-Fractures',
    upgradePhaseNumber: 9,
    upgradePhaseLabel: 'Phase 9 · Pre-Launch Integration',
    relatedModuleIds: ['sys-rcs-structure', 'fin-solar-heavy', 'sci-microgravity-lab'],
    relatedCargoId: 'cargo-thermal-crate',
    survivalNotes: [
      'Mates Stage 2, the Payload Bay, and the Fairing over the Stage 1 core without inducing side-wall shear stress.',
      'Finance overtime shifts control inspection turnaround speed during crane stacking operations in Phases 4 through 9.',
      'Requires clear high-bay clearance before umbilical swing verification.',
    ],
  },
};
