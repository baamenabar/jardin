import React, { useState, useEffect } from 'react';
import { Sun, Moon, Calendar, Play, Pause } from 'lucide-react';
import { SunPosition } from '../types/garden';

interface TimeControlsProps {
  selectedDate: string; // YYYY-MM-DD
  selectedTime: string; // HH:MM
  selectedMonth: number; // 1-12
  sunPosition?: SunPosition | null;
  bloomingCount: number;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onMonthChange: (month: number) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const TimeControls: React.FC<TimeControlsProps> = ({
  selectedDate,
  selectedTime,
  selectedMonth,
  sunPosition,
  bloomingCount,
  onDateChange,
  onTimeChange,
  onMonthChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Parse time to minutes from 00:00 (0 mins) to 23:45 (1425 mins)
  const [hours, minutes] = (selectedTime || '12:00').split(':').map((v) => parseInt(v, 10) || 0);
  const currentTotalMinutes = isNaN(hours * 60 + minutes) ? 720 : hours * 60 + minutes;

  // Animation loop when play is pressed
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      let nextMinutes = Math.floor(currentTotalMinutes / 15) * 15 + 15;
      if (nextMinutes > 24 * 60 - 15) {
        nextMinutes = 0; // loop back to 00:00
      }
      const h = Math.floor(nextMinutes / 60);
      const m = nextMinutes % 60;
      onTimeChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }, 400);
    return () => clearInterval(interval);
  }, [isPlaying, currentTotalMinutes, onTimeChange]);

  const handleTimeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalMinutes = Number(e.target.value);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    onTimeChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = Number(e.target.value);
    onMonthChange(newMonth);
    const [yearStr, , dayStr] = selectedDate.split('-');
    const now = new Date();
    const year = parseInt(yearStr, 10) || now.getFullYear();
    const day = parseInt(dayStr, 10) || now.getDate();
    const maxDays = new Date(year, newMonth, 0).getDate();
    const clampedDay = Math.min(day, maxDays);
    onDateChange(`${year}-${String(newMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`);
  };

  const setSolsticePreset = (preset: 'summer' | 'winter' | 'equinox' | 'today') => {
    const year = selectedDate.split('-')[0] || String(new Date().getFullYear());
    if (preset === 'summer') {
      onDateChange(`${year}-06-21`);
      onMonthChange(6);
    } else if (preset === 'winter') {
      onDateChange(`${year}-12-21`);
      onMonthChange(12);
    } else if (preset === 'equinox') {
      onDateChange(`${year}-03-21`);
      onMonthChange(3);
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      onDateChange(`${y}-${m}-${d}`);
      onMonthChange(now.getMonth() + 1);
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      onTimeChange(`${hh}:${mm}`);
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur border-b border-garden-border px-4 py-2.5 z-20 flex flex-wrap items-center justify-between gap-4 text-xs select-none text-garden-text shadow-xs">
      {/* Brand & Solar Badges */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌿</span>
          <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-[#24522f] to-[#407a4a] bg-clip-text text-transparent">
            Jardín OS
          </span>
        </div>

        {sunPosition && (
          <div className="flex items-center gap-2 bg-garden-subtle px-2.5 py-1 rounded-full border border-garden-border text-garden-text">
            {sunPosition.is_daylight ? (
              <Sun className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
            )}
            <span className="font-mono text-[11px] font-medium">
              {sunPosition.elevation_deg}° alt · {sunPosition.azimuth_deg}° az
            </span>
          </div>
        )}
      </div>

      {/* Time-of-Day Shadow Scrubber */}
      <div className="flex items-center gap-3 bg-garden-subtle px-3 py-1.5 rounded-lg border border-garden-border">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause Solar Sweep' : 'Play Solar Sweep'}
          className="p-1 rounded hover:bg-garden-borderSubtle text-amber-600 transition"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <span className="font-mono text-xs font-bold text-amber-800 w-12 text-center">
          {selectedTime}
        </span>

        <input
          type="range"
          min={0}
          max={24 * 60 - 15}
          step={15}
          value={currentTotalMinutes}
          onChange={handleTimeSliderChange}
          className="w-36 md:w-52 accent-amber-500 cursor-pointer"
        />
        <span className="text-garden-textMuted text-[10px] font-medium">Shadows</span>
      </div>

      {/* Seasonal Month Bloom Scrubber */}
      <div className="flex items-center gap-2 bg-garden-subtle px-3 py-1.5 rounded-lg border border-garden-border">
        <Calendar className="w-3.5 h-3.5 text-emerald-700" />
        <select
          value={selectedMonth}
          onChange={handleMonthSelect}
          className="bg-transparent font-medium text-emerald-800 focus:outline-none cursor-pointer"
        >
          {MONTH_NAMES.map((name, idx) => (
            <option key={name} value={idx + 1} className="bg-white text-garden-text">
              {name}
            </option>
          ))}
        </select>
        <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium">
          {bloomingCount} blooming
        </span>
      </div>

      {/* Solstice Shortcuts */}
      <div className="hidden lg:flex items-center gap-1">
        <button
          onClick={() => setSolsticePreset('today')}
          className="px-2 py-1 rounded bg-white hover:bg-garden-subtle text-garden-text border border-garden-border transition text-[11px] shadow-2xs"
        >
          Today
        </button>
        <button
          onClick={() => setSolsticePreset('summer')}
          className="px-2 py-1 rounded bg-white hover:bg-garden-subtle text-amber-700 border border-garden-border transition text-[11px] shadow-2xs font-medium"
        >
          Jun 21 Solstice
        </button>
        <button
          onClick={() => setSolsticePreset('equinox')}
          className="px-2 py-1 rounded bg-white hover:bg-garden-subtle text-emerald-700 border border-garden-border transition text-[11px] shadow-2xs font-medium"
        >
          Mar 21 Equinox
        </button>
        <button
          onClick={() => setSolsticePreset('winter')}
          className="px-2 py-1 rounded bg-white hover:bg-garden-subtle text-indigo-700 border border-garden-border transition text-[11px] shadow-2xs font-medium"
        >
          Dec 21 Solstice
        </button>
      </div>
    </header>
  );
};
