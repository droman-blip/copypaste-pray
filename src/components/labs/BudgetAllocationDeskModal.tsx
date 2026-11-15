import { useMemo, useState, type DragEvent } from 'react';
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../../data/missionData';
import type { BudgetAllocationSummary, DifficultyId } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface BudgetAllocationDeskModalProps {
  difficulty: DifficultyId;
  initialSummary: BudgetAllocationSummary | null;
  onApproveBudget: (summary: BudgetAllocationSummary) => void;
  onClose: () => void;
}

interface DepartmentContractSpec {
  id: 'DEPT-01' | 'DEPT-02' | 'DEPT-03' | 'DEPT-04';
  title: string;
  accentHex: string;
  lineItems: Array<{ label: string; costM: number }>;
  requiredM: number;
}

function getDepartmentSpecs(difficulty: DifficultyId): DepartmentContractSpec[] {
  // Exact sums divisible cleanly by 0.5 ($500k bundles)
  if (difficulty === 'easy') {
    // $150M max -> $132.0M allocated ($18M UFE reserve)
    return [
      {
        id: 'DEPT-01',
        title: 'Rocket Structure & Propulsion',
        accentHex: '#F97316',
        lineItems: [
          { label: 'Core Tank + Nozzle Assembly', costM: 34.0 },
          { label: 'Solid Boosters & Interstage', costM: 18.5 },
        ],
        requiredM: 52.5,
      },
      {
        id: 'DEPT-02',
        title: 'Science Payload & Instruments',
        accentHex: '#22C55E',
        lineItems: [
          { label: 'Multispectral Optics & Spectrometer', costM: 21.0 },
          { label: 'Microgravity Test Enclosure', costM: 9.5 },
        ],
        requiredM: 30.5,
      },
      {
        id: 'DEPT-03',
        title: 'Mission Supplies & Fuel',
        accentHex: '#38BDF8',
        lineItems: [
          { label: 'Subcooled LH2 / LOX Propellant', costM: 19.5 },
          { label: 'Crew Consumables & Thermal Shield', costM: 8.0 },
        ],
        requiredM: 27.5,
      },
      {
        id: 'DEPT-04',
        title: 'Ground Ops & Comms',
        accentHex: '#EAB308',
        lineItems: [
          { label: 'Pad 39A Umbilical & Range Safety', costM: 13.0 },
          { label: 'Ka/S-Band Telemetry Array', costM: 8.5 },
        ],
        requiredM: 21.5,
      },
    ];
  }

  if (difficulty === 'hard') {
    // $80M max -> $71.0M allocated ($9M reserve)
    return [
      {
        id: 'DEPT-01',
        title: 'Rocket Structure & Propulsion',
        accentHex: '#F97316',
        lineItems: [
          { label: 'Cryo Deep-Space Engine Cluster', costM: 19.5 },
          { label: 'Orthogrid Lightweight Core Stage', costM: 10.5 },
        ],
        requiredM: 30.0,
      },
      {
        id: 'DEPT-02',
        title: 'Science Payload & Instruments',
        accentHex: '#22C55E',
        lineItems: [
          { label: 'Mars Analytical Spectrometer', costM: 11.5 },
          { label: 'Atmospheric Entry Sensor Suite', costM: 6.0 },
        ],
        requiredM: 17.5,
      },
      {
        id: 'DEPT-03',
        title: 'Mission Supplies & Fuel',
        accentHex: '#38BDF8',
        lineItems: [
          { label: 'Densified Transfer Propellant', costM: 9.5 },
          { label: 'Ceramic Carbon Ablator Tiles', costM: 4.5 },
        ],
        requiredM: 14.0,
      },
      {
        id: 'DEPT-04',
        title: 'Ground Ops & Comms',
        accentHex: '#EAB308',
        lineItems: [
          { label: 'DSN Deep-Space Antenna Booking', costM: 6.0 },
          { label: 'Launch Control & Contingency Ops', costM: 3.5 },
        ],
        requiredM: 9.5,
      },
    ];
  }

  // Medium ($100M max -> $88.0M allocated, $12M UFE reserve)
  return [
    {
      id: 'DEPT-01',
      title: 'Rocket Structure & Propulsion',
      accentHex: '#F97316',
      lineItems: [
        { label: 'Lunar Stage Core & Engine Cluster', costM: 24.5 },
        { label: 'Carbon Interstage & RCS Ring', costM: 12.0 },
      ],
      requiredM: 36.5,
    },
    {
      id: 'DEPT-02',
      title: 'Science Payload & Instruments',
      accentHex: '#22C55E',
      lineItems: [
        { label: 'Polar Water-Ice Spectrometer', costM: 14.0 },
        { label: 'Microgravity Assay Module', costM: 7.5 },
      ],
      requiredM: 21.5,
    },
    {
      id: 'DEPT-03',
      title: 'Mission Supplies & Fuel',
      accentHex: '#38BDF8',
      lineItems: [
        { label: 'TLI Cryogenic Fuel & Oxidizer', costM: 12.5 },
        { label: 'Titanium/Ceramic Heat Shielding', costM: 5.5 },
      ],
      requiredM: 18.0,
    },
    {
      id: 'DEPT-04',
      title: 'Ground Ops & Comms',
      accentHex: '#EAB308',
      lineItems: [
        { label: 'Pad 39A Support & Telemetry', costM: 7.5 },
        { label: 'Lunar Ka-Band Relay Window', costM: 4.5 },
      ],
      requiredM: 12.0,
    },
  ];
}

export function BudgetAllocationDeskModal({
  difficulty,
  initialSummary,
  onApproveBudget,
  onClose,
}: BudgetAllocationDeskModalProps) {
  const diffCfg = DIFFICULTY_CONFIGS[difficulty];
  const deptSpecs = useMemo(() => getDepartmentSpecs(difficulty), [difficulty]);
  const totalRequiredM = useMemo(
    () => deptSpecs.reduce((acc, d) => acc + d.requiredM, 0),
    [deptSpecs],
  );

  const [trays, setTrays] = useState<Record<string, number>>(
    () =>
      initialSummary?.departmentTotalsM ?? {
        'DEPT-01': 0,
        'DEPT-02': 0,
        'DEPT-03': 0,
        'DEPT-04': 0,
      },
  );
  const [showSpecsAndCalc, setShowSpecsAndCalc] = useState(false);
  const [dragOverDept, setDragOverDept] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string>('');

  // Working NASA-CALC MC-24 digital calculator state
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState<number | null>(null);
  const [calcOp, setCalcOp] = useState<'+' | '-' | '*' | '/' | null>(null);
  const [calcFresh, setCalcFresh] = useState(true);

  const totalAllocatedM = useMemo(
    () => Number(Object.values(trays).reduce((sum, v) => sum + v, 0).toFixed(1)),
    [trays],
  );
  const treasuryRemainingM = Number((diffCfg.maxBudgetM - totalAllocatedM).toFixed(1));

  const adjustTray = (deptId: string, deltaM: number) => {
    soundFx.playCashSnap();
    setValidationMessage('');
    setTrays((prev) => {
      const current = prev[deptId] ?? 0;
      const next = Number((current + deltaM).toFixed(1));
      if (next < 0) return prev;
      if (deltaM > 0 && totalAllocatedM + deltaM > diffCfg.maxBudgetM + 0.01) {
        setValidationMessage('Treasury ceiling reached! Remove bills from a tray before adding more.');
        return prev;
      }
      return { ...prev, [deptId]: next };
    });
  };

  const handleDropBundle = (e: DragEvent<HTMLDivElement>, deptId: string) => {
    e.preventDefault();
    setDragOverDept(null);
    const val = Number(e.dataTransfer.getData('text/plain'));
    if (val === 1 || val === 0.5) {
      adjustTray(deptId, val);
    }
  };

  const handleCalcPress = (key: string) => {
    soundFx.playKeyClick();
    if (key === 'C') {
      setCalcDisplay('0');
      setCalcPrev(null);
      setCalcOp(null);
      setCalcFresh(true);
      return;
    }
    if (key === '⌫') {
      setCalcDisplay((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    if (key === '+' || key === '-' || key === '×' || key === '÷') {
      const mappedOp = key === '×' ? '*' : key === '÷' ? '/' : key;
      const num = Number(calcDisplay);
      if (calcPrev !== null && calcOp && !calcFresh) {
        const res =
          calcOp === '+'
            ? calcPrev + num
            : calcOp === '-'
              ? calcPrev - num
              : calcOp === '*'
                ? calcPrev * num
                : num !== 0
                  ? calcPrev / num
                  : 0;
        const formatted = String(Number(res.toFixed(2)));
        setCalcPrev(Number(formatted));
        setCalcDisplay(formatted);
      } else {
        setCalcPrev(num);
      }
      setCalcOp(mappedOp);
      setCalcFresh(true);
      return;
    }
    if (key === '=') {
      if (calcPrev === null || !calcOp) return;
      const num = Number(calcDisplay);
      const res =
        calcOp === '+'
          ? calcPrev + num
          : calcOp === '-'
            ? calcPrev - num
            : calcOp === '*'
              ? calcPrev * num
              : num !== 0
                ? calcPrev / num
                : 0;
      setCalcDisplay(String(Number(res.toFixed(2))));
      setCalcPrev(null);
      setCalcOp(null);
      setCalcFresh(true);
      return;
    }
    if (key === '.') {
      if (calcFresh) {
        setCalcDisplay('0.');
        setCalcFresh(false);
      } else if (!calcDisplay.includes('.')) {
        setCalcDisplay((prev) => `${prev}.`);
      }
      return;
    }
    // Digit
    if (calcFresh || calcDisplay === '0') {
      setCalcDisplay(key);
      setCalcFresh(false);
    } else {
      setCalcDisplay((prev) => (prev.length < 10 ? prev + key : prev));
    }
  };

  const handleApproveSign = () => {
    const mismatches: string[] = [];
    for (const dept of deptSpecs) {
      const cur = trays[dept.id] ?? 0;
      if (Math.abs(cur - dept.requiredM) > 0.05) {
        const diff = cur < dept.requiredM ? 'underfunded' : 'over-allocated';
        mismatches.push(
          `${dept.id} (${dept.title}): $${cur.toFixed(1)}M is ${diff} (Contract requires $${dept.requiredM.toFixed(1)}M)`,
        );
      }
    }

    if (mismatches.length > 0) {
      soundFx.playImpactThud(0.45);
      setValidationMessage(mismatches[0]);
      return;
    }

    soundFx.playDeliveryChime();
    onApproveBudget({
      approved: true,
      totalAllocatedM,
      departmentTotalsM: trays,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-6xl max-h-[92vh] bg-[#0B101B] text-slate-100 border border-yellow-500/45 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="px-5 py-3.5 bg-[#080C15] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/20 border border-yellow-400/50 text-yellow-300 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10.5px] font-mono-tabular uppercase tracking-widest text-yellow-400 font-bold">
                FINANCE &amp; CONTRACTS OFFICE · BUDGET ALLOCATION DESK
              </div>
              <h2 className="font-display text-lg font-bold text-white">
                Program Treasury &amp; Department Contract Funding ({diffCfg.label})
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundFx.playKeyClick();
                setShowSpecsAndCalc((v) => !v);
              }}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                showSpecsAndCalc
                  ? 'bg-yellow-500 text-slate-950 border-yellow-300'
                  : 'bg-[#121A2B] border-yellow-500/50 text-yellow-200 hover:bg-[#192338]'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>Open Price Specs &amp; Calculator</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Budget Desk"
              className="p-1.5 rounded-lg border border-slate-700 bg-[#101829] hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Expandable Price Specs & NASA-CALC MC-24 Drawer */}
          {showSpecsAndCalc && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-2xl border border-yellow-500/40 bg-[#070B13] p-4">
              {/* Price Specs */}
              <div className="lg:col-span-8 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-yellow-300">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Itemized Contractor Invoices (Sum each tray using NASA-CALC)</span>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-slate-400">
                    Mission Ceiling: ${diffCfg.maxBudgetM}M · Contracts Total: ${totalRequiredM.toFixed(1)}M
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {deptSpecs.map((dept) => (
                    <div
                      key={dept.id}
                      className="rounded-xl border border-slate-800 bg-[#0D1422] p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span style={{ color: dept.accentHex }}>{dept.id}</span>
                        <span className="text-white truncate ml-2">{dept.title}</span>
                      </div>
                      <ul className="space-y-1 text-[11px] font-mono-tabular text-slate-300">
                        {dept.lineItems.map((li) => (
                          <li key={li.label} className="flex justify-between gap-2">
                            <span className="text-slate-400 truncate">{li.label}</span>
                            <span className="text-emerald-300 font-semibold shrink-0">
                              ${li.costM.toFixed(1)}M
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* NASA-CALC MC-24 Digital Calculator */}
              <div className="lg:col-span-4 rounded-xl border border-slate-700 bg-[#141C2B] p-3 space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono-tabular uppercase tracking-widest text-slate-400">
                  <span>NASA-CALC MC-24</span>
                  <span className="text-emerald-400">ONLINE</span>
                </div>
                <div className="rounded-lg bg-[#091914] border border-emerald-500/40 px-3 py-2 text-right font-mono-tabular text-xl font-bold text-emerald-300 shadow-inner">
                  {calcOp && calcPrev !== null && (
                    <div className="text-[10px] text-emerald-500/80">
                      {calcPrev} {calcOp}
                    </div>
                  )}
                  <div>{calcDisplay}</div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 font-mono-tabular text-xs font-bold">
                  {['C', '⌫', '÷', '×', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.'].map(
                    (k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleCalcPress(k)}
                        className={`py-2 rounded-lg border transition-colors cursor-pointer ${
                          k === '='
                            ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950 border-yellow-300 col-span-1'
                            : k === 'C' || k === '⌫'
                              ? 'bg-rose-950/70 hover:bg-rose-900 text-rose-200 border-rose-500/40'
                              : ['+', '-', '×', '÷'].includes(k)
                                ? 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-600'
                                : k === '0'
                                  ? 'bg-[#0B111E] hover:bg-slate-800 text-white border-slate-700 col-span-2'
                                  : 'bg-[#0B111E] hover:bg-slate-800 text-white border-slate-700'
                        }`}
                      >
                        {k}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TOTAL TREASURY SCALE + Draggable Cash Bundles */}
          <div className="rounded-2xl border border-slate-700 bg-[#0D1422] p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10.5px] font-mono-tabular uppercase tracking-widest text-yellow-400 font-bold">
                TOTAL TREASURY SCALE
              </div>
              <div className="flex flex-wrap items-baseline gap-4">
                <div>
                  <span className="text-xs text-slate-400">Remaining Treasury: </span>
                  <span className="font-mono-tabular text-xl font-bold text-emerald-400">
                    ${treasuryRemainingM.toFixed(1)}M
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Allocated to Trays: </span>
                  <span className="font-mono-tabular text-base font-bold text-white">
                    ${totalAllocatedM.toFixed(1)}M / ${diffCfg.maxBudgetM}M
                  </span>
                </div>
              </div>
            </div>

            {/* Draggable Cash Stacks */}
            <div className="flex flex-wrap items-center gap-3">
              <div
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', '1')}
                className="px-4 py-2.5 rounded-xl bg-emerald-700/90 hover:bg-emerald-600 border-2 border-emerald-300/70 text-white font-mono-tabular text-xs font-bold flex items-center gap-2 shadow-lg cursor-grab active:cursor-grabbing select-none"
              >
                <Banknote className="w-4 h-4 text-emerald-200" />
                <span>Drag $1.0M Stack</span>
              </div>

              <div
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', '0.5')}
                className="px-4 py-2.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 border-2 border-amber-200/70 text-slate-950 font-mono-tabular text-xs font-bold flex items-center gap-2 shadow-lg cursor-grab active:cursor-grabbing select-none"
              >
                <Banknote className="w-4 h-4 text-slate-900" />
                <span>Drag $500k Stack</span>
              </div>
            </div>
          </div>

          {/* 4 Department Drop Trays (DEPT-01 to DEPT-04) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {deptSpecs.map((dept) => {
              const allocated = trays[dept.id] ?? 0;
              const isDropTarget = dragOverDept === dept.id;
              const millionCount = Math.floor(allocated);
              const hasHalf = Math.round((allocated - millionCount) * 2) > 0;
              const exactMatch = Math.abs(allocated - dept.requiredM) < 0.05;

              return (
                <div
                  key={dept.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDept(dept.id);
                  }}
                  onDragLeave={() => setDragOverDept(null)}
                  onDrop={(e) => handleDropBundle(e, dept.id)}
                  style={{
                    borderColor: isDropTarget
                      ? '#FACC15'
                      : exactMatch && initialSummary?.approved
                        ? '#22C55E'
                        : `${dept.accentHex}66`,
                  }}
                  className={`rounded-2xl border-2 p-3.5 flex flex-col justify-between gap-3 transition-all ${
                    isDropTarget ? 'bg-yellow-500/15 scale-[1.01]' : 'bg-[#080D17]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular font-bold">
                      <span style={{ color: dept.accentHex }}>{dept.id}</span>
                      <span className="text-slate-400">DROP ZONE</span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-white mt-0.5 leading-snug">
                      {dept.title}
                    </h3>
                  </div>

                  {/* Tray Cash Pile */}
                  <div className="min-h-20 rounded-xl bg-[#04070E] border border-slate-800 p-2.5 flex flex-col justify-between">
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: Math.min(18, millionCount) }).map((_, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-emerald-600/80 border border-emerald-300/40 text-[9px] font-mono-tabular font-bold text-white"
                        >
                          $1M
                        </span>
                      ))}
                      {millionCount > 18 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-900 text-[9px] font-mono-tabular text-emerald-200">
                          +{millionCount - 18}x$1M
                        </span>
                      )}
                      {hasHalf && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/85 border border-amber-200/50 text-[9px] font-mono-tabular font-bold text-slate-950">
                          $500k
                        </span>
                      )}
                      {allocated === 0 && (
                        <span className="text-[11px] text-slate-600 italic">
                          Drop $1.0M / $500k bundles here...
                        </span>
                      )}
                    </div>

                    <div className="pt-2 flex items-baseline justify-between border-t border-slate-800/80 mt-2">
                      <span className="text-[10.5px] font-mono-tabular text-slate-400">
                        TRAY TOTAL
                      </span>
                      <span className="font-mono-tabular text-lg font-bold text-white">
                        ${allocated.toFixed(1)}M
                      </span>
                    </div>
                  </div>

                  {/* Quick Click Adjustments */}
                  <div className="grid grid-cols-4 gap-1 text-[11px] font-mono-tabular font-bold">
                    <button
                      type="button"
                      onClick={() => adjustTray(dept.id, 1)}
                      className="py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/45 border border-emerald-500/40 text-emerald-200 flex items-center justify-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>$1M</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTray(dept.id, 0.5)}
                      className="py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/40 text-amber-200 flex items-center justify-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>.5M</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTray(dept.id, -0.5)}
                      className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center gap-0.5 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                      <span>.5M</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTray(dept.id, -1)}
                      className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center gap-0.5 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                      <span>$1M</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {validationMessage && (
            <div className="rounded-xl border border-rose-500/60 bg-rose-950/60 px-4 py-2.5 text-xs text-rose-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationMessage}</span>
            </div>
          )}

          {initialSummary?.approved && !validationMessage && (
            <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/45 px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Contracts signed at {initialSummary.timestamp}: ${initialSummary.totalAllocatedM.toFixed(1)}M authorized across DEPT-01 through DEPT-04.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 bg-[#080C15] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundFx.playKeyClick();
              setTrays({ 'DEPT-01': 0, 'DEPT-02': 0, 'DEPT-03': 0, 'DEPT-04': 0 });
              setValidationMessage('');
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-700 bg-[#0E1525] hover:border-slate-500 text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear All Trays</span>
          </button>

          <button
            type="button"
            onClick={handleApproveSign}
            className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-display font-bold text-sm tracking-wide flex items-center gap-2 shadow-lg cursor-pointer transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>APPROVE &amp; SIGN BUDGET</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
