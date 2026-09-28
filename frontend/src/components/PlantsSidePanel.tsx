import React, { useState } from 'react';
import {
  Sprout,
  Search,
  X,
  Scissors,
  Droplets,
  Plus,
  GripVertical,
  MapPin,
} from 'lucide-react';
import { PlantPlacement, GardenBed } from '../types/garden';

interface PlantsSidePanelProps {
  isOpen: boolean;
  placements: PlantPlacement[];
  beds: GardenBed[];
  onClose: () => void;
  onSelectPlant: (placement: PlantPlacement) => void;
  onOpenCatalog: () => void;
  onLocatePlant?: (placement: PlantPlacement) => void;
}

export const PlantsSidePanel: React.FC<PlantsSidePanelProps> = ({
  isOpen,
  placements,
  beds,
  onClose,
  onSelectPlant,
  onOpenCatalog,
  onLocatePlant,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'ground' | 'pot' | 'pond' | 'staging'>('all');

  if (!isOpen) return null;

  const bedMap = new Map(beds.map((b) => [b.id, b]));

  const filtered = placements.filter((p) => {
    const s = p.species;
    if (!s) return false;

    const matchesQuery =
      s.common_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.botanical_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.variety && s.variety.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesQuery) return false;

    if (filterType === 'all') return true;
    if (filterType === 'ground') return p.container_type === 'ground';
    if (filterType === 'pot') return p.container_type === 'pot' || p.container_type === 'terracotta_planter';
    if (filterType === 'pond') return p.container_type === 'pond_basket';
    if (filterType === 'staging') return !p.bed_id || p.container_type === 'staging';

    return true;
  });

  const getDaysAgo = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const diffMs = new Date().getTime() - new Date(dateStr).getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : 0;
  };

  return (
    <div className="w-80 md:w-88 bg-garden-surface border-r border-garden-border flex flex-col h-full select-none z-30 shadow-xl backdrop-blur text-xs text-garden-text">
      {/* Header */}
      <div className="p-3.5 border-b border-garden-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
            <Sprout className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-garden-text">Garden Specimens</h3>
            <p className="text-[10px] text-garden-textMuted font-mono">
              {placements.length} planted · {beds.length} zones
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

      {/* Search Bar */}
      <div className="p-3 border-b border-garden-border bg-garden-subtle/50">
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-garden-textLight" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by name..."
            className="w-full bg-white border border-garden-border rounded-xl pl-8 pr-3 py-1.5 text-garden-text placeholder-garden-textLight focus:outline-none focus:border-garden-accent"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
          {[
            { id: 'all', label: 'All' },
            { id: 'ground', label: 'In Ground' },
            { id: 'pot', label: 'Pots & Planters' },
            { id: 'pond', label: 'Teich (Pond)' },
            { id: 'staging', label: 'Staging' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterType(pill.id as any)}
              className={`px-2 py-0.5 rounded-full border transition whitespace-nowrap ${
                filterType === pill.id
                  ? 'bg-garden-accent border-garden-accent text-white font-semibold shadow-2xs'
                  : 'bg-white border-garden-border text-garden-textMuted hover:border-garden-accent/40'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tip Banner */}
      <div className="px-3.5 py-1.5 bg-amber-50/80 border-b border-amber-200/60 text-[10px] text-amber-900 flex items-center gap-1.5">
        <span>💡</span>
        <span>Drag any plant card directly onto the canvas to place it!</span>
      </div>

      {/* Plant Specimen List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-garden-textMuted italic">
            No plants found. Click "Add Plant" below to stage or plant new specimens!
          </div>
        ) : (
          filtered.map((placement) => {
            const species = placement.species!;
            const bed = placement.bed_id ? bedMap.get(placement.bed_id) : null;
            const pruneDays = getDaysAgo(placement.last_pruned_date);
            const feedDays = getDaysAgo(placement.last_fertilized_date);
            const flowerColor = species.bloom_colors?.[0] || '#967BB6';

            return (
              <div
                key={placement.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'plant', id: placement.id }));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onSelectPlant(placement)}
                className="bg-white hover:bg-garden-subtle/50 border border-garden-border hover:border-emerald-400 rounded-xl p-3 cursor-grab active:cursor-grabbing transition shadow-2xs group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shrink-0 shadow-2xs"
                      style={{ backgroundColor: flowerColor }}
                    />
                    <div className="font-bold text-garden-text group-hover:text-garden-accent transition truncate max-w-[150px]">
                      {species.common_name}
                      {species.variety && (
                        <span className="text-[10px] text-garden-textMuted font-normal ml-1">
                          '{species.variety}'
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges & Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] px-1.5 py-0.5 rounded border border-garden-border bg-garden-subtle text-garden-textMuted">
                      {placement.container_type === 'pond_basket'
                        ? '💧 Pond'
                        : placement.container_type === 'pot' || placement.container_type === 'terracotta_planter'
                        ? '🪴 Pot'
                        : placement.container_type === 'staging' || !placement.bed_id
                        ? '📦 Staging'
                        : '🌱 Ground'}
                    </span>
                    {onLocatePlant && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLocatePlant(placement);
                        }}
                        title="Locate & center on canvas"
                        className="p-0.5 hover:bg-emerald-100 rounded text-garden-textMuted hover:text-emerald-700 transition"
                      >
                        <MapPin className="w-3 h-3" />
                      </button>
                    )}
                    <GripVertical
                      title="Drag onto canvas"
                      className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 shrink-0"
                    />
                  </div>
                </div>

                <div className="italic text-[10px] text-garden-textLight mb-2 truncate">
                  {species.botanical_name}
                </div>

                {/* Location & Care Badges */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-garden-textMuted">
                  <span className="bg-garden-subtle px-2 py-0.5 rounded border border-garden-border text-garden-text">
                    {bed ? bed.name : 'Staging Area'}
                  </span>

                  {pruneDays !== null && (
                    <span className="bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                      <Scissors className="w-2.5 h-2.5" />
                      {pruneDays}d ago
                    </span>
                  )}

                  {feedDays !== null && (
                    <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                      <Droplets className="w-2.5 h-2.5" />
                      {feedDays}d ago
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Action */}
      <div className="p-3 border-t border-garden-border bg-garden-subtle/50">
        <button
          onClick={onOpenCatalog}
          className="w-full py-2 bg-garden-accent hover:bg-garden-accentHover font-semibold text-white rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Stage New Plant from Catalog</span>
        </button>
      </div>
    </div>
  );
};
