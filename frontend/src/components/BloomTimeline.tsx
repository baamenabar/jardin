import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { PlantBloomState } from '../types/garden';

interface BloomTimelineProps {
  currentMonth: number; // 1-12
  plants: PlantBloomState[];
  onSelectMonth: (month: number) => void;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const BloomTimeline: React.FC<BloomTimelineProps> = ({
  currentMonth,
  plants,
  onSelectMonth,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Deduplicate species for the timeline view
  const speciesMap = new Map<number, PlantBloomState>();
  plants.forEach((p) => {
    if (!speciesMap.has(p.species_id)) {
      speciesMap.set(p.species_id, p);
    }
  });
  const uniqueSpecies = Array.from(speciesMap.values());
  const bloomingCount = plants.filter((p) => p.is_blooming).length;

  return (
    <div className="bg-white/95 border-t border-garden-border select-none text-xs transition-all duration-200 text-garden-text shadow-sm">
      {/* Collapsible Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-garden-subtle transition"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-rose-500" />
          <span className="font-bold text-garden-text text-xs">Seasonal Bloom Calendar</span>
          <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold">
            {bloomingCount} blooming in {MONTH_LABELS[currentMonth - 1]}
          </span>
          <span className="text-[11px] text-garden-textMuted hidden md:inline">
            ({uniqueSpecies.length} total species)
          </span>
        </div>

        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-garden-textMuted hover:text-garden-text transition"
        >
          <span>{isExpanded ? 'Collapse Timeline' : 'Expand Gantt Chart'}</span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Gantt Chart Body */}
      {isExpanded && (
        <div className="p-3 pt-0 border-t border-garden-border bg-garden-surface animate-in slide-in-from-bottom-2 duration-150">
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-garden-border text-[11px] text-garden-textMuted">
                  <th className="py-1 px-2 font-medium w-56">Plant Species</th>
                  {MONTH_LABELS.map((m, idx) => {
                    const monthNum = idx + 1;
                    const isSelected = monthNum === currentMonth;
                    return (
                      <th
                        key={m}
                        onClick={() => onSelectMonth(monthNum)}
                        className={`py-1 text-center cursor-pointer transition rounded ${
                          isSelected
                            ? 'bg-rose-100 text-rose-800 font-bold border-b-2 border-rose-500'
                            : 'hover:bg-garden-subtle hover:text-garden-text'
                        }`}
                      >
                        {m}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-garden-borderSubtle">
                {uniqueSpecies.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-4 text-center text-garden-textMuted italic">
                      No plants placed yet. Add plants to your garden beds or teich to see their bloom schedule!
                    </td>
                  </tr>
                ) : (
                  uniqueSpecies.map((plant) => {
                    const start = plant.bloom_start_month;
                    const end = plant.bloom_end_month;
                    const flowerColor = plant.bloom_colors[0] || '#967BB6';

                    return (
                      <tr key={plant.species_id} className="hover:bg-garden-subtle transition">
                        <td className="py-1 px-2">
                          <div className="font-medium text-garden-text truncate max-w-[200px]">
                            {plant.common_name}{' '}
                            {plant.variety && (
                              <span className="text-[10px] text-garden-textMuted">'{plant.variety}'</span>
                            )}
                          </div>
                          <div className="text-[10px] text-garden-textLight italic truncate max-w-[200px]">
                            {plant.botanical_name}
                          </div>
                        </td>

                        {MONTH_LABELS.map((_, idx) => {
                          const m = idx + 1;
                          let isMonthBlooming = false;
                          if (start <= end) {
                            isMonthBlooming = m >= start && m <= end;
                          } else {
                            isMonthBlooming = m >= start || m <= end;
                          }

                          return (
                            <td
                              key={m}
                              onClick={() => onSelectMonth(m)}
                              className={`p-1 cursor-pointer transition text-center ${
                                m === currentMonth ? 'bg-rose-50/70' : ''
                              }`}
                            >
                              {isMonthBlooming ? (
                                <div
                                  className="h-3.5 rounded-md shadow-xs border border-white/40 flex items-center justify-center text-[8px] font-bold text-white transition hover:scale-105"
                                  style={{ backgroundColor: flowerColor }}
                                  title={`${plant.common_name} blooming in ${MONTH_LABELS[idx]}`}
                                >
                                  🌸
                                </div>
                              ) : (
                                <div className="h-3.5 rounded-md bg-garden-subtle/80 border border-garden-borderSubtle" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
