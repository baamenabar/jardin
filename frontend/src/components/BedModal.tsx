import React, { useState, useEffect } from 'react';
import { Droplet, Grid, Sprout, Trees, Trash2, X, Maximize2 } from 'lucide-react';
import { GardenBed, SurfaceType, Property } from '../types/garden';

interface BedModalProps {
  isOpen: boolean;
  bed: GardenBed | null;
  property?: Property | null;
  onClose: () => void;
  onSave: (id: number, data: Partial<GardenBed>) => void;
  onCreate?: (data: Omit<GardenBed, 'id' | 'property_id'>) => void;
  onDelete: (id: number) => void;
}

const SURFACE_ICONS: Record<SurfaceType, React.ReactNode> = {
  pond: <Droplet className="w-4 h-4 text-sky-600" />,
  terrace: <Grid className="w-4 h-4 text-stone-600" />,
  soil: <Sprout className="w-4 h-4 text-amber-600" />,
  lawn: <Trees className="w-4 h-4 text-emerald-600" />,
  gravel: <Grid className="w-4 h-4 text-stone-500" />,
  planter: <Sprout className="w-4 h-4 text-amber-700" />,
};

const DEFAULT_NAMES: Record<SurfaceType, { name: string; zone: string }> = {
  terrace: { name: 'Paved Stone Terrace', zone: 'terrace' },
  soil: { name: 'Planting Bed', zone: 'back_garden' },
  pond: { name: 'Gartenteich (Pond)', zone: 'water' },
  lawn: { name: 'Lawn Area', zone: 'back_garden' },
  gravel: { name: 'Gravel Terrace / Path', zone: 'terrace' },
  planter: { name: 'Raised Planter Bed', zone: 'back_garden' },
};

export const BedModal: React.FC<BedModalProps> = ({
  isOpen,
  bed,
  property,
  onClose,
  onSave,
  onCreate,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [surfaceType, setSurfaceType] = useState<SurfaceType>('terrace');
  const [zone, setZone] = useState<string>('terrace');
  const [soilType, setSoilType] = useState<string>('');
  const [widthM, setWidthM] = useState<number>(5.0);
  const [depthM, setDepthM] = useState<number>(3.0);

  useEffect(() => {
    if (bed) {
      setName(bed.name);
      setSurfaceType(bed.surface_type || 'soil');
      setZone(bed.zone);
      setSoilType(bed.soil_type || '');

      // Compute bounding box dimensions from coordinates
      if (bed.polygon_coords && bed.polygon_coords.length >= 3) {
        const xs = bed.polygon_coords.map((p) => p[0]);
        const ys = bed.polygon_coords.map((p) => p[1]);
        const w = Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10;
        const d = Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10;
        setWidthM(Math.max(w, 0.1));
        setDepthM(Math.max(d, 0.1));
      }
    } else {
      // Default creation settings (Stone Terrace)
      setName(DEFAULT_NAMES.terrace.name);
      setSurfaceType('terrace');
      setZone(DEFAULT_NAMES.terrace.zone);
      setSoilType('');
      setWidthM(5.0);
      setDepthM(3.0);
    }
  }, [bed, isOpen]);

  if (!isOpen) return null;

  const handleSurfaceChange = (st: SurfaceType) => {
    setSurfaceType(st);
    if (!bed) {
      const isDefault = Object.values(DEFAULT_NAMES).some((d) => d.name === name) || name === '';
      if (isDefault) {
        setName(DEFAULT_NAMES[st]?.name || '');
        setZone(DEFAULT_NAMES[st]?.zone || 'back_garden');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!bed) {
      // Create new orthogonal bed / terrace centered on the property lot
      const lotW = property?.width_m ?? 20;
      const lotH = property?.height_m ?? 15;
      const cx = Math.round((lotW / 2) * 100) / 100;
      const cy = Math.round((lotH / 2) * 100) / 100;
      const halfW = widthM / 2;
      const halfD = depthM / 2;

      const x1 = Math.max(0, Math.round((cx - halfW) * 100) / 100);
      const x2 = Math.min(lotW, Math.round((cx + halfW) * 100) / 100);
      const y1 = Math.max(0, Math.round((cy - halfD) * 100) / 100);
      const y2 = Math.min(lotH, Math.round((cy + halfD) * 100) / 100);

      const rectCoords = [
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
      ];

      if (onCreate) {
        onCreate({
          name: name.trim() || DEFAULT_NAMES[surfaceType]?.name || 'New Area',
          surface_type: surfaceType,
          zone: zone as any,
          soil_type: soilType || null,
          polygon_coords: rectCoords,
          color: surfaceType === 'terrace' ? '#64748b' : surfaceType === 'pond' ? '#0284c7' : '#5C3B1E',
        });
      }
      onClose();
      return;
    }

    // Check if dimensions changed; if so, scale polygon around centroid
    let newCoords = bed.polygon_coords;
    if (newCoords && newCoords.length >= 3) {
      const xs = newCoords.map((p) => p[0]);
      const ys = newCoords.map((p) => p[1]);
      const oldW = Math.max(...xs) - Math.min(...xs);
      const oldD = Math.max(...ys) - Math.min(...ys);
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const cy = ys.reduce((a, b) => a + b, 0) / ys.length;

      if (oldW > 0.1 && oldD > 0.1 && (Math.abs(oldW - widthM) > 0.1 || Math.abs(oldD - depthM) > 0.1)) {
        const scaleX = widthM / oldW;
        const scaleY = depthM / oldD;
        newCoords = newCoords.map(([x, y]) => [
          Math.round((cx + (x - cx) * scaleX) * 100) / 100,
          Math.round((cy + (y - cy) * scaleY) * 100) / 100,
        ]);
      }
    }

    onSave(bed.id, {
      name: name.trim(),
      surface_type: surfaceType,
      zone: zone as any,
      soil_type: soilType || null,
      polygon_coords: newCoords,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-garden-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-xs text-garden-text">
        {/* Header */}
        <div className="p-4 border-b border-garden-border flex items-center justify-between bg-garden-subtle/50">
          <div className="flex items-center gap-2">
            {SURFACE_ICONS[surfaceType]}
            <div>
              <h3 className="font-bold text-sm text-garden-text">
                {bed ? 'Edit' : 'Add'} {surfaceType === 'pond' ? 'Teich (Pond)' : surfaceType === 'terrace' ? 'Stone Terrace' : surfaceType === 'lawn' ? 'Lawn Area' : surfaceType === 'gravel' ? 'Gravel Terrace' : surfaceType === 'planter' ? 'Raised Planter' : 'Garden Bed'}
              </h3>
              <p className="text-[11px] text-garden-textMuted">
                {bed ? 'Adjust surface material, dimensions, or zone location' : 'Create an orthogonal terrace, planting bed, or pond with exact dimensions'}
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
          {/* Surface Type Presets */}
          <div>
            <label className="block text-garden-textMuted font-medium mb-1.5">Surface Material</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'pond', label: 'Teich (Pond)', icon: <Droplet className="w-3.5 h-3.5 text-sky-600" /> },
                { id: 'terrace', label: 'Stone Terrace', icon: <Grid className="w-3.5 h-3.5 text-stone-600" /> },
                { id: 'soil', label: 'Planting Bed', icon: <Sprout className="w-3.5 h-3.5 text-amber-600" /> },
                { id: 'lawn', label: 'Lawn / Grass', icon: <Trees className="w-3.5 h-3.5 text-emerald-600" /> },
                { id: 'gravel', label: 'Gravel Path', icon: <Grid className="w-3.5 h-3.5 text-stone-500" /> },
                { id: 'planter', label: 'Planter Bed', icon: <Sprout className="w-3.5 h-3.5 text-amber-700" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSurfaceChange(item.id as SurfaceType)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition ${
                    surfaceType === item.id
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
            <label className="block text-garden-textMuted font-medium mb-1">Name / Label</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-3 py-2 text-garden-text focus:outline-none focus:bg-white focus:border-garden-sky"
            />
          </div>

          {/* Dimensions: Width and Depth */}
          <div className="p-3.5 bg-garden-subtle/40 border border-garden-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-garden-text flex items-center gap-1.5">
                <Maximize2 className="w-4 h-4 text-garden-sky" />
                Dimensions (Width & Depth)
              </span>
              <span className="text-[10px] text-garden-textMuted font-mono">
                {widthM}m × {depthM}m ({(widthM * depthM).toFixed(1)} m²)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-garden-textMuted block mb-1">Width (meters)</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max="500"
                  value={widthM}
                  onChange={(e) => setWidthM(Number(e.target.value))}
                  className="w-full bg-white border border-garden-border rounded-lg px-2.5 py-1.5 text-garden-text font-mono focus:border-garden-sky focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-garden-textMuted block mb-1">Depth / Length (meters)</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max="500"
                  value={depthM}
                  onChange={(e) => setDepthM(Number(e.target.value))}
                  className="w-full bg-white border border-garden-border rounded-lg px-2.5 py-1.5 text-garden-text font-mono focus:border-garden-sky focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-garden-textMuted">
              💡 Tip: You can also drag the vertex handles directly on the canvas to freely reshape individual corners!
            </p>
          </div>

          {/* Zone & Substrate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-garden-textMuted font-medium mb-1">Garden Zone</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-2.5 py-1.5 text-garden-text focus:outline-none focus:bg-white focus:border-garden-sky"
              >
                <option value="front_garden">Front Garden</option>
                <option value="back_garden">Back Garden</option>
                <option value="terrace">Terrace / Patio</option>
                <option value="water">Teich / Water Zone</option>
                <option value="side_yard">Side Yard</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-garden-textMuted font-medium mb-1">Substrate / Soil</label>
              <input
                type="text"
                placeholder="e.g. aquatic silt, loam, sand"
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full bg-garden-subtle/50 border border-garden-border rounded-lg px-2.5 py-1.5 text-garden-text focus:outline-none focus:bg-white focus:border-garden-sky"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-garden-border">
            {bed ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete '${bed.name}'? Plants inside will be moved to the staging nursery.`)) {
                    onDelete(bed.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 py-1.5 px-2.5 rounded hover:bg-rose-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Area</span>
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
                {bed ? 'Save Changes' : 'Create Area'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
