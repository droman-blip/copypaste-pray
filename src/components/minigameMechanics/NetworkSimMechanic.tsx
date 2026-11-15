import { useState } from 'react';
import { BatteryCharging, Link2, Radio, Zap } from 'lucide-react';
import type { MinigameDefinition, MinigamePayload } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface Props {
  def: MinigameDefinition;
  payload: MinigamePayload;
  onChange: (next: MinigamePayload) => void;
}

export function NetworkSimMechanic({ def, payload, onChange }: Props) {
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  const toggleNode = (id: string) => {
    soundFx.playKeyClick();
    const active = payload.activeNodes.includes(id);
    if (active) {
      onChange({
        ...payload,
        activeNodes: payload.activeNodes.filter((n) => n !== id),
        links: payload.links.filter(([a, b]) => a !== id && b !== id),
      });
    } else {
      onChange({
        ...payload,
        activeNodes: [...payload.activeNodes, id],
      });
    }
  };

  const handleWireNode = (id: string) => {
    soundFx.playKeyClick();
    if (!payload.activeNodes.includes(id)) {
      onChange({
        ...payload,
        activeNodes: [...payload.activeNodes, id],
      });
    }
    if (!connectFrom) {
      setConnectFrom(id);
      return;
    }
    if (connectFrom === id) {
      setConnectFrom(null);
      return;
    }
    const exists = payload.links.some(
      ([a, b]) => (a === connectFrom && b === id) || (a === id && b === connectFrom),
    );
    const nextLinks = exists
      ? payload.links.filter(
          ([a, b]) => !((a === connectFrom && b === id) || (a === id && b === connectFrom)),
        )
      : [...payload.links, [connectFrom, id] as [string, string]];
    onChange({
      ...payload,
      links: nextLinks,
    });
    setConnectFrom(null);
  };

  const isComms = def.items.some((i) => typeof i.bandwidthMbps === 'number');
  const activeItems = def.items.filter((i) => payload.activeNodes.includes(i.id));
  const genW = activeItems.filter((i) => (i.powerW ?? 0) > 0).reduce((s, i) => s + (i.powerW ?? 0), 0);
  const loadW = activeItems.filter((i) => (i.powerW ?? 0) < 0).reduce((s, i) => s + Math.abs(i.powerW ?? 0), 0);
  const totalMbps = activeItems.reduce((s, i) => s + (i.bandwidthMbps ?? 0), 0);

  // Compute coordinates on SVG canvas
  const positions = def.items.map((item, idx) => {
    const col = idx < 2 ? 95 : idx === 2 ? 260 : 425;
    const row = idx < 2 ? 65 + idx * 105 : idx === 2 ? 120 : 55 + (idx - 3) * 90;
    return { item, x: col, y: row };
  });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            {isComms ? (
              <Radio className="w-4 h-4 text-sky-400" />
            ) : (
              <Zap className="w-4 h-4 text-amber-400" />
            )}
            <span>Interactive Network &amp; Simulation Schematic</span>
          </h3>
          <p className="text-xs text-slate-400">
            Click &quot;Link&quot; on two nodes to add or remove connections. Toggle nodes to balance the system.
          </p>
        </div>

        <div className="font-mono-tabular text-xs font-bold px-3 py-1.5 rounded-lg bg-[#091224] border border-slate-700 text-sky-300">
          {isComms
            ? `${totalMbps} Mbps · ${payload.links.length} links`
            : `Gen +${genW} W / Load -${loadW} W · Net ${genW - loadW >= 0 ? '+' : ''}${genW - loadW} W`}
        </div>
      </div>

      {/* SVG Network Canvas */}
      <div className="rounded-xl border border-slate-800 bg-[#050A14] p-2 overflow-hidden">
        <svg viewBox="0 0 540 230" className="w-full h-48 select-none">
          <defs>
            <pattern id="net-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0f1c33" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="540" height="230" fill="url(#net-grid)" />

          {/* Edges */}
          {payload.links.map(([a, b], idx) => {
            const pa = positions.find((p) => p.item.id === a);
            const pb = positions.find((p) => p.item.id === b);
            if (!pa || !pb) return null;
            return (
              <line
                key={`${a}-${b}-${idx}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke={isComms ? '#38bdf8' : '#facc15'}
                strokeWidth={2.5}
                strokeDasharray="6 4"
              />
            );
          })}

          {/* Nodes */}
          {positions.map(({ item, x, y }) => {
            const active = payload.activeNodes.includes(item.id);
            const isConnecting = connectFrom === item.id;
            const linked = payload.links.some(([a, b]) => a === item.id || b === item.id);
            const fill = !active
              ? '#0f172a'
              : item.powerW && item.powerW > 0
                ? '#0f291e'
                : item.bandwidthMbps
                  ? '#0c233a'
                  : '#111b2e';
            const stroke = isConnecting
              ? '#f43f5e'
              : active && linked
                ? '#38bdf8'
                : active
                  ? '#f59e0b'
                  : '#334155';

            return (
              <g
                key={item.id}
                transform={`translate(${x}, ${y})`}
                onClick={() => handleWireNode(item.id)}
                className="cursor-pointer"
              >
                <rect
                  x={-72}
                  y={-22}
                  width={144}
                  height={44}
                  rx={8}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isConnecting ? 2.5 : 1.6}
                />
                <text
                  x={0}
                  y={-3}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize={10}
                  fontWeight={700}
                >
                  {item.label.slice(0, 22)}
                </text>
                <text
                  x={0}
                  y={12}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize={9}
                >
                  {item.bandwidthMbps
                    ? `${item.bandwidthMbps} Mbps`
                    : typeof item.powerW === 'number'
                      ? `${item.powerW >= 0 ? `+${item.powerW}` : item.powerW} W`
                      : item.category}
                  {!active ? ' (OFF)' : !linked ? ' (UNLINKED)' : ' · OK'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {connectFrom && (
        <div className="text-xs font-mono-tabular text-amber-300 px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-500/40 flex items-center justify-between">
          <span>Wiring mode: select target node to link with &quot;{def.items.find((i) => i.id === connectFrom)?.label}&quot;</span>
          <button
            type="button"
            onClick={() => setConnectFrom(null)}
            className="text-white underline cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Node Controls & Battery / Duty Cycle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {def.items.map((item) => {
          const active = payload.activeNodes.includes(item.id);
          return (
            <div
              key={item.id}
              className={`rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 text-xs ${
                active ? 'bg-[#0A1526] border-slate-700' : 'bg-[#070B14] border-slate-800/80 opacity-75'
              }`}
            >
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">{item.label}</div>
                <div className="text-[10.5px] font-mono-tabular text-slate-400">
                  {item.summary}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleWireNode(item.id)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500/20 border border-slate-600 text-[10.5px] text-sky-300 flex items-center gap-1 cursor-pointer"
                >
                  <Link2 className="w-3 h-3" />
                  <span>Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleNode(item.id)}
                  className={`px-2 py-1 rounded text-[10.5px] font-bold cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 border border-slate-700'
                  }`}
                >
                  {active ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Battery & Duty Cycle Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {!isComms && (
          <div className="rounded-xl border border-slate-800 bg-[#080E1B] p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                <span>Battery Bank (Wh)</span>
              </span>
              <span className="font-mono-tabular font-bold text-emerald-300">
                {payload.batteryWh} Wh
              </span>
            </div>
            <input
              type="range"
              min={800}
              max={3600}
              step={100}
              value={payload.batteryWh}
              onChange={(e) => {
                soundFx.playKeyClick();
                onChange({ ...payload, batteryWh: Number(e.target.value) });
              }}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        )}

        <div className={`rounded-xl border border-slate-800 bg-[#080E1B] p-3 space-y-1.5 ${isComms ? 'sm:col-span-2' : ''}`}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white">Duty Cycle / Window (%)</span>
            <span className="font-mono-tabular font-bold text-sky-300">
              {payload.dutyCyclePct}%
            </span>
          </div>
          <input
            type="range"
            min={40}
            max={100}
            step={5}
            value={payload.dutyCyclePct}
            onChange={(e) => {
              soundFx.playKeyClick();
              onChange({ ...payload, dutyCyclePct: Number(e.target.value) });
            }}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
