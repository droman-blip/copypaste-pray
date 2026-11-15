import { useState } from 'react';
import { Box, RotateCw, Scale, Sun } from 'lucide-react';
import type { MinigameDefinition, MinigamePayload } from '../../types/mission';
import { soundFx } from '../../utils/soundFx';

interface Props {
  def: MinigameDefinition;
  payload: MinigamePayload;
  onChange: (next: MinigamePayload) => void;
}

export function SpatialMassAssemblyMechanic({ def, payload, onChange }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string>(def.items[0]?.id ?? '');

  // Build 6x4 occupancy check
  const grid: Array<Array<{ id: string; color: string; conflict: boolean } | null>> =
    Array.from({ length: 4 }, () => Array(6).fill(null));

  let collisions = 0;
  let totalMassKg = 0;
  let weightedX = 0;

  for (const placed of payload.placedItems) {
    const item = def.items.find((i) => i.id === placed.id);
    if (!item) continue;
    const w = placed.rotated ? (item.heightCells ?? 1) : (item.widthCells ?? 1);
    const h = placed.rotated ? (item.widthCells ?? 1) : (item.heightCells ?? 1);
    const m = item.massKg ?? 100;
    totalMassKg += m;
    weightedX += (placed.x + w / 2 - 3) * m;

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const gx = placed.x + dx;
        const gy = placed.y + dy;
        if (gx >= 0 && gx < 6 && gy >= 0 && gy < 4) {
          const prev = grid[gy][gx];
          if (prev) {
            collisions += 1;
            grid[gy][gx] = { id: placed.id, color: '#ef4444', conflict: true };
          } else {
            grid[gy][gx] = {
              id: placed.id,
              color: item.colorHex ?? '#38bdf8',
              conflict: false,
            };
          }
        }
      }
    }
  }

  const cgOffsetMm = totalMassKg > 0 ? Math.round((Math.abs(weightedX) / totalMassKg) * 18) : 0;

  const placeAtCell = (gx: number, gy: number) => {
    const item = def.items.find((i) => i.id === selectedItemId);
    if (!item) return;
    soundFx.playKeyClick();
    const existing = payload.placedItems.find((p) => p.id === selectedItemId);
    const rotated = existing?.rotated ?? false;
    const w = rotated ? (item.heightCells ?? 1) : (item.widthCells ?? 1);
    const h = rotated ? (item.widthCells ?? 1) : (item.heightCells ?? 1);
    const clampedX = Math.max(0, Math.min(6 - w, gx));
    const clampedY = Math.max(0, Math.min(4 - h, gy));

    const nextPlaced = payload.placedItems.some((p) => p.id === selectedItemId)
      ? payload.placedItems.map((p) =>
          p.id === selectedItemId ? { ...p, x: clampedX, y: clampedY } : p,
        )
      : [...payload.placedItems, { id: selectedItemId, x: clampedX, y: clampedY, rotated: false }];

    onChange({ ...payload, placedItems: nextPlaced });
  };

  const rotateItem = (id: string) => {
    soundFx.playKeyClick();
    const item = def.items.find((i) => i.id === id);
    if (!item) return;
    const nextPlaced = payload.placedItems.map((p) => {
      if (p.id !== id) return p;
      const nextRot = !p.rotated;
      const w = nextRot ? (item.heightCells ?? 1) : (item.widthCells ?? 1);
      const h = nextRot ? (item.widthCells ?? 1) : (item.heightCells ?? 1);
      return {
        ...p,
        rotated: nextRot,
        x: Math.min(p.x, 6 - w),
        y: Math.min(p.y, 4 - h),
      };
    });
    onChange({ ...payload, placedItems: nextPlaced });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <Box className="w-4 h-4 text-orange-400" />
            <span>6×4 m Spatial Bay · Mass, Volume &amp; Center of Gravity</span>
          </h3>
          <p className="text-xs text-slate-400">
            Select a module below and click a bay cell to place or center it.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono-tabular text-xs font-bold">
          <span className="text-white">{totalMassKg.toLocaleString()} kg</span>
          <span className={cgOffsetMm <= 18 ? 'text-emerald-400' : 'text-rose-400'}>
            CoG ±{cgOffsetMm} mm
          </span>
          {collisions > 0 && <span className="text-rose-400">{collisions} collisions</span>}
        </div>
      </div>

      {/* CoG Balance Gauge */}
      <div className="rounded-xl border border-slate-800 bg-[#080E1B] p-2.5 flex items-center gap-3">
        <Scale className="w-4 h-4 text-orange-400 shrink-0" />
        <div className="flex-1">
          <div className="flex justify-between text-[10.5px] font-mono-tabular text-slate-400 mb-1">
            <span>Port (-X)</span>
            <span className={cgOffsetMm <= 18 ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
              Centerline (CoG ±{cgOffsetMm} mm / Max ±18 mm)
            </span>
            <span>Starboard (+X)</span>
          </div>
          <div className="relative h-2 rounded-full bg-slate-800">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-500" />
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-white ${
                cgOffsetMm <= 18 ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
              style={{
                left: `calc(${Math.max(8, Math.min(92, 50 + (weightedX / Math.max(1, totalMassKg)) * 18))}% - 6px)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 6x4 Packing / Assembly Grid */}
      <div className="rounded-xl border border-slate-700 bg-[#050912] p-3">
        <div className="grid grid-cols-6 gap-1.5">
          {grid.map((row, gy) =>
            row.map((cell, gx) => {
              const isSelectedOwner = cell?.id === selectedItemId;
              return (
                <button
                  key={`${gx}-${gy}`}
                  type="button"
                  onClick={() => placeAtCell(gx, gy)}
                  className={`h-11 rounded-md border text-[10px] font-mono-tabular font-bold transition-transform hover:scale-[1.03] cursor-pointer flex items-center justify-center ${
                    cell
                      ? isSelectedOwner
                        ? 'border-white text-slate-950'
                        : 'border-slate-900/70 text-slate-950'
                      : 'bg-[#0B1222] border-slate-800 text-slate-600 hover:border-sky-400/60'
                  }`}
                  style={cell ? { backgroundColor: cell.conflict ? '#ef4444' : cell.color } : undefined}
                >
                  {cell ? (cell.conflict ? 'COL!' : cell.id.split('-')[1]?.toUpperCase() ?? cell.id) : `${gx},${gy}`}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* Module Selector & Rotation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {def.items.map((item) => {
          const placed = payload.placedItems.find((p) => p.id === item.id);
          const selected = selectedItemId === item.id;
          const w = placed?.rotated ? (item.heightCells ?? 1) : (item.widthCells ?? 1);
          const h = placed?.rotated ? (item.widthCells ?? 1) : (item.heightCells ?? 1);

          return (
            <div
              key={item.id}
              onClick={() => {
                soundFx.playKeyClick();
                setSelectedItemId(item.id);
              }}
              className={`rounded-lg border p-2.5 flex items-center justify-between gap-2 cursor-pointer ${
                selected
                  ? 'bg-[#101C33] border-sky-400'
                  : 'bg-[#080E1B] border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-xs shrink-0"
                  style={{ backgroundColor: item.colorHex ?? '#38bdf8' }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{item.label}</div>
                  <div className="text-[10.5px] font-mono-tabular text-slate-400">
                    {w}×{h} cells · {item.massKg ? `${item.massKg} kg` : `${item.volumeM3 ?? 1.2} m³`}
                    {placed ? ` @ (${placed.x},${placed.y})` : ' · Unplaced'}
                  </div>
                </div>
              </div>
              {placed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    rotateItem(item.id);
                  }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10.5px] text-white flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Rotate</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Extra Solar Deployment Controls for M43 / M13 */}
      {(def.code === 'M43' || def.code === 'M13') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl border border-amber-500/35 bg-[#121008] p-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-amber-200 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" />
                <span>Solar Array Area (m²)</span>
              </span>
              <span className="font-mono-tabular font-bold text-amber-300">{payload.panelAreaM2} m²</span>
            </div>
            <input
              type="range"
              min={8}
              max={28}
              value={payload.panelAreaM2}
              onChange={(e) => {
                soundFx.playKeyClick();
                onChange({ ...payload, panelAreaM2: Number(e.target.value) });
              }}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-amber-200">Solar Tilt Angle (°)</span>
              <span className="font-mono-tabular font-bold text-amber-300">{payload.panelAngleDeg}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={45}
              value={payload.panelAngleDeg}
              onChange={(e) => {
                soundFx.playKeyClick();
                onChange({ ...payload, panelAngleDeg: Number(e.target.value) });
              }}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
