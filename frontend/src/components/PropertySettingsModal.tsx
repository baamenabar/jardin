import React, { useState, useEffect } from 'react';
import { Compass, MapPin, X, Navigation } from 'lucide-react';
import { Property } from '../types/garden';

interface PropertySettingsModalProps {
  isOpen: boolean;
  property: Property;
  onClose: () => void;
  onSave: (data: Partial<Property>) => void;
}

const CITY_PRESETS = [
  { name: 'Berlin, Germany', lat: 52.52, lon: 13.405, tz: 'Europe/Berlin' },
  { name: 'Madrid, Spain', lat: 40.4168, lon: -3.7038, tz: 'Europe/Madrid' },
  { name: 'London, UK', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  { name: 'Paris, France', lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' },
  { name: 'Zurich, Switzerland', lat: 47.3769, lon: 8.5417, tz: 'Europe/Zurich' },
  { name: 'New York, USA', lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
];

export const PropertySettingsModal: React.FC<PropertySettingsModalProps> = ({
  isOpen,
  property,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(property.name);
  const [widthM, setWidthM] = useState(property.width_m);
  const [heightM, setHeightM] = useState(property.height_m);
  const [northAngle, setNorthAngle] = useState(property.north_angle_deg);
  const [latitude, setLatitude] = useState(property.latitude);
  const [longitude, setLongitude] = useState(property.longitude);
  const [timezone, setTimezone] = useState(property.timezone);

  useEffect(() => {
    if (property) {
      setName(property.name);
      setWidthM(property.width_m);
      setHeightM(property.height_m);
      setNorthAngle(property.north_angle_deg);
      setLatitude(property.latitude);
      setLongitude(property.longitude);
      setTimezone(property.timezone);
    }
  }, [property, isOpen]);

  if (!isOpen) return null;

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Math.round(pos.coords.latitude * 10000) / 10000);
        setLongitude(Math.round(pos.coords.longitude * 10000) / 10000);
      },
      (err) => {
        alert(`Could not get location: ${err.message}`);
      }
    );
  };

  const handlePresetSelect = (preset: typeof CITY_PRESETS[0]) => {
    setLatitude(preset.lat);
    setLongitude(preset.lon);
    setTimezone(preset.tz);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      width_m: Number(widthM),
      height_m: Number(heightM),
      north_angle_deg: Number(northAngle),
      latitude: Number(latitude),
      longitude: Number(longitude),
      timezone,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-garden-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-xs text-garden-text">
        {/* Header */}
        <div className="p-4 border-b border-garden-border flex items-center justify-between bg-garden-subtle/50">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-garden-sky" />
            <div>
              <h3 className="font-bold text-sm text-garden-text">Garden Lot & Solar Settings</h3>
              <p className="text-[11px] text-garden-textMuted">
                Configure lot dimensions, GPS coordinates, and True North orientation
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
          {/* Garden Name */}
          <div>
            <label className="block text-garden-textMuted font-medium mb-1">Garden Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-3 py-2 text-garden-text focus:outline-none focus:bg-white focus:border-garden-sky"
            />
          </div>

          {/* Lot Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-garden-textMuted font-medium mb-1">Lot Width (meters)</label>
              <input
                type="number"
                step="any"
                min="1"
                max="500"
                value={widthM}
                onChange={(e) => setWidthM(Number(e.target.value))}
                className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-3 py-2 text-garden-text focus:outline-none focus:bg-white focus:border-garden-sky font-mono"
              />
            </div>
            <div>
              <label className="block text-garden-textMuted font-medium mb-1">Lot Length / Depth (meters)</label>
              <input
                type="number"
                step="any"
                min="1"
                max="500"
                value={heightM}
                onChange={(e) => setHeightM(Number(e.target.value))}
                className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-3 py-2 text-garden-text focus:outline-none focus:bg-white focus:border-garden-sky font-mono"
              />
            </div>
          </div>

          {/* True North Orientation with Rotating Compass */}
          <div className="p-3.5 bg-garden-subtle/40 border border-garden-border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-garden-text flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-rose-500" />
                True North Orientation
              </span>
              <span className="font-mono font-bold text-rose-600">{northAngle}°</span>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={northAngle}
                onChange={(e) => setNorthAngle(Number(e.target.value))}
                className="flex-1 accent-rose-500 cursor-pointer"
              />

              {/* Rotating Compass Indicator */}
              <div className="w-12 h-12 rounded-full border border-garden-border bg-white flex items-center justify-center relative shadow-inner shrink-0">
                <div
                  className="w-1 h-8 rounded-full transition-transform"
                  style={{
                    transform: `rotate(${northAngle}deg)`,
                    background: 'linear-gradient(to bottom, #ef4444 50%, #94a3b8 50%)',
                  }}
                />
                <span className="absolute top-0.5 text-[8px] font-bold text-rose-600">N</span>
              </div>
            </div>
            <p className="text-[10px] text-garden-textMuted mt-2">
              Rotate until the red needle matches True North relative to your property plan (0° = North is top).
            </p>
          </div>

          {/* Geographical Coordinates */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-garden-textMuted font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                Geographic Coordinates (for Sun Position)
              </label>
              <button
                type="button"
                onClick={handleUseLocation}
                className="text-garden-sky hover:text-[#3d6e9f] flex items-center gap-1 text-[11px] font-medium transition"
              >
                <Navigation className="w-3 h-3" />
                <span>My Location</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <span className="text-[10px] text-garden-textMuted block mb-0.5">Latitude</span>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(Number(e.target.value))}
                  className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-3 py-1.5 text-garden-text font-mono focus:bg-white focus:border-garden-sky"
                />
              </div>
              <div>
                <span className="text-[10px] text-garden-textMuted block mb-0.5">Longitude</span>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(Number(e.target.value))}
                  className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-3 py-1.5 text-garden-text font-mono focus:bg-white focus:border-garden-sky"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[10px] text-garden-textMuted self-center mr-1">Presets:</span>
              {CITY_PRESETS.map((city) => (
                <button
                  key={city.name}
                  type="button"
                  onClick={() => handlePresetSelect(city)}
                  className="text-[10px] px-2 py-0.5 rounded bg-white hover:bg-garden-subtle text-garden-text border border-garden-border transition shadow-2xs font-medium"
                >
                  {city.name.split(',')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-garden-border">
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
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
