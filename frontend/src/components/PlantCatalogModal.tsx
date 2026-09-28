import React, { useState } from 'react';
import { Sparkles, Search, X, Sun, Droplets, Ruler, PackagePlus } from 'lucide-react';
import { PlantSpecies, GardenBed } from '../types/garden';
import { api } from '../services/api';

interface PlantCatalogModalProps {
  isOpen: boolean;
  plants: PlantSpecies[];
  beds: GardenBed[];
  onClose: () => void;
  onPlantAdded: () => void;
  onStagePlant: (speciesId: number, targetBedId?: number) => void;
}

export const PlantCatalogModal: React.FC<PlantCatalogModalProps> = ({
  isOpen,
  plants,
  onClose,
  onPlantAdded,
  onStagePlant,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newPlantQuery, setNewPlantQuery] = useState('');
  const [isEnriching, setIsEnriching] = useState(false);

  if (!isOpen) return null;

  const filteredPlants = plants.filter(
    (p) =>
      p.common_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.botanical_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.variety && p.variety.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleEnrich = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlantQuery.trim() || isEnriching) return;

    setIsEnriching(true);
    try {
      await api.enrichPlant(newPlantQuery, true); // auto-save to catalog
      setNewPlantQuery('');
      onPlantAdded();
    } catch (err: any) {
      alert(`Enrichment failed: ${err.message}`);
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-garden-border rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden text-xs text-garden-text">
        {/* Header */}
        <div className="p-4 border-b border-garden-border flex items-center justify-between bg-garden-subtle/30">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌸</span>
            <div>
              <h3 className="font-bold text-sm text-garden-text">Garden Plant Catalog</h3>
              <p className="text-[11px] text-garden-textMuted">
                Browse cataloged species or use AI to enrich new botanical varieties
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

        {/* AI Quick Enrichment Bar */}
        <div className="p-4 bg-garden-subtle/50 border-b border-garden-border">
          <form onSubmit={handleEnrich} className="flex gap-2">
            <input
              type="text"
              value={newPlantQuery}
              onChange={(e) => setNewPlantQuery(e.target.value)}
              placeholder="Enter any plant name (e.g. 'Salvia Caradonna', 'Japanese Maple', 'Water Lily')..."
              disabled={isEnriching}
              className="flex-1 bg-white border border-garden-border rounded-xl px-3 py-2 text-garden-text placeholder:text-garden-textLight focus:outline-none focus:border-rose-400"
            />
            <button
              type="submit"
              disabled={isEnriching || !newPlantQuery.trim()}
              className="px-4 py-2 bg-gradient-to-r from-[#d96b7d] to-[#b35e88] hover:from-[#cb5f71] hover:to-[#a25178] font-semibold text-white rounded-xl flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isEnriching ? 'Enriching...' : 'Enrich with AI'}</span>
            </button>
          </form>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2.5 bg-white flex items-center justify-between gap-4 border-b border-garden-border">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-garden-textLight" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter catalog by botanical or common name..."
              className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg pl-8 pr-3 py-1.5 text-garden-text focus:outline-none focus:bg-white focus:border-garden-accent"
            />
          </div>
        </div>

        {/* Plant Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-garden-subtle/20">
          {filteredPlants.length === 0 ? (
            <div className="col-span-2 py-8 text-center text-garden-textMuted italic">
              No plants matching "{searchTerm}". Use the AI field above to enrich it!
            </div>
          ) : (
            filteredPlants.map((plant) => (
              <div
                key={plant.id}
                className="bg-white border border-garden-border rounded-xl p-3 flex flex-col justify-between hover:border-garden-border hover:shadow-sm transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <span className="font-bold text-garden-text">{plant.common_name}</span>
                      {plant.variety && (
                        <span className="text-garden-textMuted ml-1 font-normal">'{plant.variety}'</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {plant.bloom_colors.map((c) => (
                        <span
                          key={c}
                          className="w-3 h-3 rounded-full border border-black/10 shadow-2xs"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="italic text-garden-textLight text-[11px] mb-2">{plant.botanical_name}</div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-garden-textMuted font-mono mb-2">
                    <div className="flex items-center gap-1">
                      <Sun className="w-3 h-3 text-amber-500" />
                      <span>{plant.sun_requirement.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Ruler className="w-3 h-3 text-garden-sky" />
                      <span>{plant.mature_height_m}m × {plant.mature_spread_m}m</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-blue-500" />
                      <span>Water: {plant.watering_needs}</span>
                    </div>
                    <div>
                      <span>Blooms: M{plant.bloom_start_month} - M{plant.bloom_end_month}</span>
                    </div>
                  </div>

                  {plant.notes && (
                    <p className="text-[10px] text-garden-textMuted line-clamp-2 mb-3">{plant.notes}</p>
                  )}
                </div>

                {/* Staging Call to Action */}
                <button
                  onClick={() => {
                    onStagePlant(plant.id);
                    onClose();
                  }}
                  className="w-full py-2 bg-garden-accent hover:bg-garden-accentHover text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow-xs"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>Stage to Plant (Ready to Place)</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
