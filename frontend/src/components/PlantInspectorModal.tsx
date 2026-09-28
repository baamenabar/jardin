import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { PlantPlacement, GardenBed, ContainerType } from '../types/garden';

interface PlantInspectorModalProps {
  isOpen: boolean;
  placement: PlantPlacement | null;
  beds: GardenBed[];
  onClose: () => void;
  onSave: (id: number, data: Partial<PlantPlacement>) => void;
  onDelete: (id: number) => void;
}

export const PlantInspectorModal: React.FC<PlantInspectorModalProps> = ({
  isOpen,
  placement,
  beds,
  onClose,
  onSave,
  onDelete,
}) => {
  const [containerType, setContainerType] = useState<ContainerType>('ground');
  const [bedId, setBedId] = useState<number | undefined>(undefined);
  const [plantedDate, setPlantedDate] = useState<string>('');
  const [lastPrunedDate, setLastPrunedDate] = useState<string>('');
  const [lastFertilizedDate, setLastFertilizedDate] = useState<string>('');
  const [currentHeightM, setCurrentHeightM] = useState<number>(0.5);
  const [currentSpreadM, setCurrentSpreadM] = useState<number>(0.5);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (placement) {
      setContainerType(placement.container_type || 'ground');
      setBedId(placement.bed_id || undefined);
      setPlantedDate(placement.planted_date || '');
      setLastPrunedDate(placement.last_pruned_date || '');
      setLastFertilizedDate(placement.last_fertilized_date || '');
      setCurrentHeightM(placement.current_height_m || placement.species?.mature_height_m || 0.6);
      setCurrentSpreadM(placement.current_spread_m || placement.species?.mature_spread_m || 0.6);
      setNotes(placement.notes || '');
    }
  }, [placement, isOpen]);

  if (!isOpen || !placement || !placement.species) return null;

  const species = placement.species;
  const todayStr = new Date().toISOString().split('T')[0];

  const handlePruneToday = () => {
    setLastPrunedDate(todayStr);
  };

  const handleFertilizeToday = () => {
    setLastFertilizedDate(todayStr);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(placement.id, {
      container_type: containerType,
      bed_id: bedId !== undefined ? bedId : null,
      planted_date: plantedDate || null,
      last_pruned_date: lastPrunedDate || null,
      last_fertilized_date: lastFertilizedDate || null,
      current_height_m: Number(currentHeightM),
      current_spread_m: Number(currentSpreadM),
      notes: notes || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-garden-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-xs text-garden-text">
        {/* Header with Flower Colors */}
        <div className="p-4 border-b border-garden-border flex items-center justify-between bg-garden-subtle/50">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl border border-black/10 shadow-2xs flex items-center justify-center text-sm"
              style={{ backgroundColor: species.bloom_colors[0] || '#967BB6' }}
            >
              🌸
            </div>
            <div>
              <h3 className="font-bold text-sm text-garden-text flex items-center gap-1.5">
                <span>{species.common_name}</span>
                {species.variety && (
                  <span className="text-garden-textMuted font-normal">'{species.variety}'</span>
                )}
              </h3>
              <p className="text-[11px] text-garden-textMuted italic">{species.botanical_name}</p>
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
          {/* Location & Container Medium */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-garden-textMuted font-medium mb-1">Assigned Bed / Surface</label>
              <select
                value={bedId ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setBedId(val);
                  if (val === undefined) {
                    setContainerType('staging');
                    setPlantedDate('');
                  }
                }}
                className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-2.5 py-1.5 text-garden-text focus:outline-none focus:bg-white focus:border-garden-accent"
              >
                <option value="">🌱 Staging Nursery (Unplanted)</option>
                {beds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.surface_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-garden-textMuted font-medium mb-1">Container / Medium</label>
              <select
                value={containerType}
                onChange={(e) => setContainerType(e.target.value as ContainerType)}
                className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-2.5 py-1.5 text-garden-text focus:outline-none focus:bg-white focus:border-garden-accent"
              >
                <option value="ground">🌱 In Ground (Open Soil)</option>
                <option value="pot">🪴 Terracotta Pot / Planter</option>
                <option value="terracotta_planter">🏺 Large Planter Box</option>
                <option value="pond_basket">💧 Pond Basket / Teich Shelf</option>
                <option value="staging">📦 Staging Area</option>
              </select>
            </div>
          </div>

          {/* Plant Maintenance & Care History */}
          <div className="p-3.5 bg-garden-subtle/40 border border-garden-border rounded-xl space-y-3">
            <span className="font-semibold text-garden-text flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Care & Maintenance History
            </span>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {/* Planted Date */}
              <div>
                <label className="text-garden-textMuted block mb-0.5">Planted Date</label>
                <input
                  type="date"
                  value={plantedDate}
                  onChange={(e) => setPlantedDate(e.target.value)}
                  className="w-full bg-white border border-garden-border rounded px-2 py-1 text-garden-text"
                />
              </div>

              {/* Last Pruned */}
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-garden-textMuted">Last Prune</label>
                  <button
                    type="button"
                    onClick={handlePruneToday}
                    className="text-[9px] text-amber-700 font-semibold hover:underline"
                  >
                    Today
                  </button>
                </div>
                <input
                  type="date"
                  value={lastPrunedDate}
                  onChange={(e) => setLastPrunedDate(e.target.value)}
                  className="w-full bg-white border border-garden-border rounded px-2 py-1 text-garden-text"
                />
              </div>

              {/* Last Fertilized */}
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-garden-textMuted">Last Fed</label>
                  <button
                    type="button"
                    onClick={handleFertilizeToday}
                    className="text-[9px] text-emerald-700 font-semibold hover:underline"
                  >
                    Today
                  </button>
                </div>
                <input
                  type="date"
                  value={lastFertilizedDate}
                  onChange={(e) => setLastFertilizedDate(e.target.value)}
                  className="w-full bg-white border border-garden-border rounded px-2 py-1 text-garden-text"
                />
              </div>
            </div>
          </div>

          {/* Current Measured Growth Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-garden-textMuted font-medium mb-1">
                <span>Current Height</span>
                <span className="font-mono text-garden-sky font-semibold">
                  {currentHeightM >= 1 ? `${currentHeightM}m` : `${Math.round(currentHeightM * 100)}cm`}
                </span>
              </div>
              <input
                type="range"
                min="0.02"
                max={Math.max(species.mature_height_m * 1.5, 3.0)}
                step="0.01"
                value={currentHeightM}
                onChange={(e) => setCurrentHeightM(Number(e.target.value))}
                className="w-full accent-garden-sky cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-garden-textMuted font-medium mb-1">
                <span>Canopy Spread</span>
                <span className="font-mono text-emerald-700 font-semibold">
                  {currentSpreadM >= 1 ? `${currentSpreadM}m` : `${Math.round(currentSpreadM * 100)}cm`}
                </span>
              </div>
              <input
                type="range"
                min="0.02"
                max={Math.max(species.mature_spread_m * 1.5, 3.0)}
                step="0.01"
                value={currentSpreadM}
                onChange={(e) => setCurrentSpreadM(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Specimen Notes */}
          <div>
            <label className="block text-garden-textMuted font-medium mb-1">Specimen Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Needs extra watering during heatwave, or moved from back terrace..."
              className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-3 py-1.5 text-garden-text focus:outline-none focus:bg-white focus:border-garden-accent"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-garden-border">
            <button
              type="button"
              onClick={() => {
                if (confirm(`Dig up and remove this ${species.common_name}?`)) {
                  onDelete(placement.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 py-1.5 px-2.5 rounded hover:bg-rose-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Dig Up / Remove</span>
            </button>

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
                className="px-4 py-1.5 rounded-lg bg-garden-accent hover:bg-garden-accentHover font-medium text-white transition shadow-xs"
              >
                Update Plant
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
