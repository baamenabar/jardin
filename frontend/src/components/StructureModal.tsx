import React, { useState, useEffect } from 'react';
import {
  Home,
  Trees,
  Shield,
  Warehouse,
  Building2,
  Trash2,
  X,
  Maximize2,
  Footprints,
  Table,
  Armchair,
  Tent,
  Recycle,
  Fence,
  BrickWall,
} from 'lucide-react';
import { Obstacle, StructureType } from '../types/garden';

interface StructureModalProps {
  isOpen: boolean;
  structure: Obstacle | null;
  onClose: () => void;
  onSave: (data: Partial<Obstacle>) => void;
  onDelete?: (id: number) => void;
}

const STRUCTURE_ICONS: Record<StructureType, React.ReactNode> = {
  house: <Home className="w-4 h-4 text-sky-600" />,
  neighbor_house: <Building2 className="w-4 h-4 text-purple-600" />,
  shed: <Warehouse className="w-4 h-4 text-amber-600" />,
  fence: <Fence className="w-4 h-4 text-stone-600" />,
  wall: <BrickWall className="w-4 h-4 text-stone-500" />,
  tree: <Trees className="w-4 h-4 text-emerald-600" />,
  paved_sidewalk: <Footprints className="w-4 h-4 text-stone-500" />,
  table: <Table className="w-4 h-4 text-amber-700" />,
  bench: <Armchair className="w-4 h-4 text-amber-800" />,
  chair: <Armchair className="w-4 h-4 text-amber-600" />,
  terrace_cover: <Tent className="w-4 h-4 text-sky-700" />,
  compost_pile: <Recycle className="w-4 h-4 text-emerald-800" />,
  custom: <Building2 className="w-4 h-4 text-stone-600" />,
};

export const StructureModal: React.FC<StructureModalProps> = ({
  isOpen,
  structure,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<StructureType>('house');
  const [heightM, setHeightM] = useState<number>(6.5);
  const [opacity, setOpacity] = useState<number>(1.0);
  const [widthM, setWidthM] = useState<number>(6.0);
  const [lengthM, setLengthM] = useState<number>(8.0);

  useEffect(() => {
    if (structure) {
      setName(structure.name);
      setType(structure.type);
      setHeightM(structure.height_m);
      setOpacity(structure.opacity);

      // Compute bounding box dimensions from coordinates
      if (structure.polygon_coords && structure.polygon_coords.length >= 3) {
        const xs = structure.polygon_coords.map((p) => p[0]);
        const ys = structure.polygon_coords.map((p) => p[1]);
        const w = Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10;
        const l = Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10;
        setWidthM(Math.max(w, 0.05));
        setLengthM(Math.max(l, 0.05));
      }
    } else {
      setName('Garden Shed');
      setType('shed');
      setHeightM(2.6);
      setOpacity(1.0);
      setWidthM(3.5);
      setLengthM(2.5);
    }
  }, [structure, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let newCoords = structure?.polygon_coords;
    if (newCoords && newCoords.length >= 3) {
      const xs = newCoords.map((p) => p[0]);
      const ys = newCoords.map((p) => p[1]);
      const oldW = Math.max(...xs) - Math.min(...xs);
      const oldL = Math.max(...ys) - Math.min(...ys);
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const cy = ys.reduce((a, b) => a + b, 0) / ys.length;

      if (oldW > 0.01 && oldL > 0.01 && (Math.abs(oldW - widthM) > 0.01 || Math.abs(oldL - lengthM) > 0.01)) {
        const scaleX = widthM / oldW;
        const scaleY = lengthM / oldL;
        newCoords = newCoords.map(([x, y]) => [
          Math.round((cx + (x - cx) * scaleX) * 100) / 100,
          Math.round((cy + (y - cy) * scaleY) * 100) / 100,
        ]);
      }
    }

    onSave({
      name,
      type,
      height_m: Number(heightM),
      opacity: Number(opacity),
      ...(newCoords ? { polygon_coords: newCoords } : {}),
    });
    onClose();
  };

  const handleTypeSelect = (newType: StructureType) => {
    setType(newType);
    if (!structure) {
      if (newType === 'house') {
        setName('Main Residence');
        setHeightM(6.5);
        setWidthM(12.0);
        setLengthM(9.0);
        setOpacity(1.0);
      } else if (newType === 'neighbor_house') {
        setName("Neighbor's House");
        setHeightM(8.0);
        setWidthM(14.0);
        setLengthM(10.0);
        setOpacity(1.0);
      } else if (newType === 'shed') {
        setName('Garden Shed');
        setHeightM(2.6);
        setWidthM(3.5);
        setLengthM(2.5);
        setOpacity(1.0);
      } else if (newType === 'fence') {
        setName('Boundary Fence');
        setHeightM(1.8);
        setWidthM(15.0);
        setLengthM(0.1);
        setOpacity(0.9);
      } else if (newType === 'wall') {
        setName('Garden Wall');
        setHeightM(1.5);
        setWidthM(10.0);
        setLengthM(0.2);
        setOpacity(1.0);
      } else if (newType === 'tree') {
        setName('Shade Tree');
        setHeightM(6.0);
        setWidthM(5.0);
        setLengthM(5.0);
        setOpacity(0.7);
      } else if (newType === 'paved_sidewalk') {
        setName('Paved Sidewalk');
        setHeightM(0.05);
        setWidthM(1.2);
        setLengthM(6.0);
        setOpacity(1.0);
      } else if (newType === 'table') {
        setName('Outdoor Table');
        setHeightM(0.75);
        setWidthM(1.8);
        setLengthM(1.0);
        setOpacity(0.9);
      } else if (newType === 'bench') {
        setName('Garden Bench');
        setHeightM(0.85);
        setWidthM(1.5);
        setLengthM(0.6);
        setOpacity(0.9);
      } else if (newType === 'chair') {
        setName('Garden Chair');
        setHeightM(0.85);
        setWidthM(0.6);
        setLengthM(0.6);
        setOpacity(0.8);
      } else if (newType === 'terrace_cover') {
        setName('Terrace Cover / Pergola');
        setHeightM(2.8);
        setWidthM(4.0);
        setLengthM(3.0);
        setOpacity(0.5);
      } else if (newType === 'compost_pile') {
        setName('Compost Pile');
        setHeightM(1.0);
        setWidthM(1.5);
        setLengthM(1.5);
        setOpacity(1.0);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-garden-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-xs text-garden-text">
        <div className="flex items-center justify-between px-5 py-4 border-b border-garden-border bg-garden-subtle/50">
          <div className="flex items-center gap-2">
            {STRUCTURE_ICONS[type]}
            <div>
              <h3 className="font-bold text-garden-text text-sm">
                {structure ? 'Edit Structure Dimensions' : 'Add Shadow-Casting Structure'}
              </h3>
              <p className="text-[11px] text-garden-textMuted">
                Configure structure footprint dimensions and shadow height
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-garden-textLight hover:text-garden-text hover:bg-garden-subtle transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Structure Type Presets */}
          <div>
            <label className="block text-garden-textMuted font-medium mb-1.5">Structure Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'house', label: 'Own House', icon: <Home className="w-3.5 h-3.5 text-sky-600" /> },
                { id: 'neighbor_house', label: 'Neighbor', icon: <Building2 className="w-3.5 h-3.5 text-purple-600" /> },
                { id: 'shed', label: 'Shed / Garage', icon: <Warehouse className="w-3.5 h-3.5 text-amber-600" /> },
                { id: 'paved_sidewalk', label: 'Paved Sidewalk', icon: <Footprints className="w-3.5 h-3.5 text-stone-500" /> },
                { id: 'terrace_cover', label: 'Terrace Cover', icon: <Tent className="w-3.5 h-3.5 text-sky-700" /> },
                { id: 'compost_pile', label: 'Compost Pile', icon: <Recycle className="w-3.5 h-3.5 text-emerald-800" /> },
                { id: 'table', label: 'Table', icon: <Table className="w-3.5 h-3.5 text-amber-700" /> },
                { id: 'bench', label: 'Bench', icon: <Armchair className="w-3.5 h-3.5 text-amber-800" /> },
                { id: 'chair', label: 'Chair', icon: <Armchair className="w-3.5 h-3.5 text-amber-600" /> },
                { id: 'fence', label: 'Fence', icon: <Fence className="w-3.5 h-3.5 text-stone-600" /> },
                { id: 'wall', label: 'Stone Wall', icon: <BrickWall className="w-3.5 h-3.5 text-stone-500" /> },
                { id: 'tree', label: 'Tree', icon: <Trees className="w-3.5 h-3.5 text-emerald-600" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTypeSelect(item.id as StructureType)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition ${
                    type === item.id
                      ? 'bg-sky-50 border-garden-sky text-sky-900 font-semibold shadow-2xs'
                      : 'bg-garden-subtle/50 border-garden-border text-garden-textMuted hover:border-garden-accent/40 hover:text-garden-text'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-garden-textMuted font-medium mb-1">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-3 py-2 text-garden-text focus:outline-none focus:bg-white focus:border-garden-sky"
            />
          </div>

          {/* Footprint Dimensions (Width and Length in meters) */}
          <div className="p-3.5 bg-garden-subtle/40 border border-garden-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-garden-text flex items-center gap-1.5">
                <Maximize2 className="w-4 h-4 text-garden-sky" />
                Footprint Dimensions (Ground Size)
              </span>
              <span className="text-[10px] text-garden-textMuted font-mono">
                {widthM}m × {lengthM}m ({(widthM * lengthM).toFixed(1)} m²)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-garden-textMuted block mb-1">Width (East-West meters)</label>
                <input
                  type="number"
                  step="any"
                  min="0.05"
                  max="500"
                  value={widthM}
                  onChange={(e) => setWidthM(Number(e.target.value))}
                  className="w-full bg-white border border-garden-border rounded-lg px-2.5 py-1.5 text-garden-text font-mono focus:border-garden-sky focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-garden-textMuted block mb-1">Length (North-South meters)</label>
                <input
                  type="number"
                  step="any"
                  min="0.05"
                  max="500"
                  value={lengthM}
                  onChange={(e) => setLengthM(Number(e.target.value))}
                  className="w-full bg-white border border-garden-border rounded-lg px-2.5 py-1.5 text-garden-text font-mono focus:border-garden-sky focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-garden-textMuted">
              💡 Tip: You can also drag the corners directly on the canvas to resize the structure visually!
            </p>
          </div>

          {/* Height in Meters */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-garden-textMuted font-medium">Height for Shadow Projection</label>
              <span className="font-mono font-semibold text-amber-700">{heightM} meters</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="20.0"
              step="0.05"
              value={heightM}
              onChange={(e) => setHeightM(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-garden-textMuted mt-0.5">
              <span>Fence (1.8m)</span>
              <span>Shed (2.6m)</span>
              <span>House (6.5m)</span>
              <span>2-Story (8.5m)</span>
            </div>
          </div>

          {/* Shadow Opacity */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-garden-textMuted font-medium">Shadow Density / Opacity</label>
              <span className="font-mono text-garden-text">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-garden-sky cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-garden-border">
            {structure && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete '${structure.name}'?`)) {
                    onDelete(structure.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 py-1.5 px-2.5 rounded hover:bg-rose-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-garden-border text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-garden-sky hover:bg-[#3d6e9f] font-medium text-white transition shadow-xs"
              >
                Save Dimensions
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
