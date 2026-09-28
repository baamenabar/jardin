import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Sparkles,
  Settings,
  RefreshCw,
  Eye,
  Layers,
  Sprout,
  Compass,
  Undo2,
} from 'lucide-react';
import {
  Property,
  Obstacle,
  GardenBed,
  PlantSpecies,
  PlantPlacement,
  InstantShadowsResponse,
  DailySunlightResponse,
  MonthlyBloomResponse,
  WorkflowMode,
} from './types/garden';
import { api } from './services/api';
import { TimeControls } from './components/TimeControls';
import { GardenCanvas } from './components/GardenCanvas';
import { BloomTimeline } from './components/BloomTimeline';
import { StructureModal } from './components/StructureModal';
import { BedModal } from './components/BedModal';
import { AgentChatSidebar } from './components/AgentChatSidebar';
import { PlantCatalogModal } from './components/PlantCatalogModal';
import { PlantInspectorModal } from './components/PlantInspectorModal';
import { PlantsSidePanel } from './components/PlantsSidePanel';
import { PropertySettingsModal } from './components/PropertySettingsModal';

type MovementUndoAction =
  | {
      type: 'plant';
      id: number;
      name?: string;
      prev: { x: number; y: number; bed_id?: number | null };
      next: { x: number; y: number; bed_id?: number | null };
    }
  | {
      type: 'structure';
      id: number;
      name?: string;
      prevCoords: number[][];
      nextCoords: number[][];
    }
  | {
      type: 'bed';
      id: number;
      name?: string;
      prevCoords: number[][];
      nextCoords: number[][];
    }
  | {
      type: 'lot';
      prevSize: { width_m: number; height_m: number };
      nextSize: { width_m: number; height_m: number };
    };

// Helper to get current local date, month, and time
const getInitialDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${day}`,
    month,
    time: `${hours}:${minutes}`,
  };
};

export const App: React.FC = () => {
  // Workflow Mode: 'setup' (hardscape/beds) | 'staging' (plants movable, commit) | 'gardening' (care/prune/enjoy)
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('setup');

  // Core Domain State
  const [property, setProperty] = useState<Property | null>(null);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [plants, setPlants] = useState<PlantSpecies[]>([]);
  const [placements, setPlacements] = useState<PlantPlacement[]>([]);

  // Simulation & Analysis State (initializes to current date and time)
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialDateTime().date);
  const [selectedTime, setSelectedTime] = useState<string>(() => getInitialDateTime().time);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => getInitialDateTime().month);
  const [shadowResponse, setShadowResponse] = useState<InstantShadowsResponse | null>(null);
  const [bloomResponse, setBloomResponse] = useState<MonthlyBloomResponse | null>(null);
  const [sunlightData, setSunlightData] = useState<DailySunlightResponse | null>(null);

  // Modals & Panels State
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState<boolean>(false);
  const [isBedModalOpen, setIsBedModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [focusedEntity, setFocusedEntity] = useState<{
    type: 'plant';
    id: number;
    x: number;
    y: number;
    timestamp: number;
  } | null>(null);

  const handleLocatePlant = (placement: PlantPlacement) => {
    setFocusedEntity({
      type: 'plant',
      id: placement.id,
      x: placement.x,
      y: placement.y,
      timestamp: Date.now(),
    });
  };

  // Active Selected Entities for Modals
  const [selectedPlacement, setSelectedPlacement] = useState<PlantPlacement | null>(null);
  const [editingStructure, setEditingStructure] = useState<Obstacle | null>(null);
  const [editingBed, setEditingBed] = useState<GardenBed | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Movement Undo Stack (Up to 5 movements)
  const [undoStack, setUndoStack] = useState<MovementUndoAction[]>([]);
  const [undoToast, setUndoToast] = useState<string | null>(null);

  const pushUndoAction = useCallback((action: MovementUndoAction) => {
    // Keep at most 5 movements in history
    setUndoStack((prev) => [...prev.slice(-4), action]);
  }, []);

  // Load All Garden Data
  const loadAllData = useCallback(async () => {
    try {
      const [prop, obsList, bedList, plantList, placeList] = await Promise.all([
        api.getProperty(),
        api.listObstacles(),
        api.listBeds(),
        api.listPlants(),
        api.listPlacements(),
      ]);

      let stagingX = prop.staging_area_x;
      let stagingY = prop.staging_area_y;
      let stagingW = prop.staging_area_w;
      let stagingH = prop.staging_area_h;

      if (stagingX === undefined || stagingX === null) {
        try {
          const cached = localStorage.getItem('jardin_staging_area');
          if (cached) {
            const parsed = JSON.parse(cached);
            stagingX = parsed.x;
            stagingY = parsed.y;
            stagingW = parsed.w;
            stagingH = parsed.h;
          }
        } catch (e) {}
      }

      if (stagingX === undefined || stagingX === null) {
        stagingX = 22.0;
        stagingY = 9.0;
        stagingW = 4.5;
        stagingH = 4.0;
      }

      setProperty({
        ...prop,
        staging_area_x: stagingX,
        staging_area_y: stagingY,
        staging_area_w: stagingW,
        staging_area_h: stagingH,
      });
      setObstacles(obsList);
      setBeds(bedList);
      setPlants(plantList);
      setPlacements(placeList);
    } catch (err) {
      console.error('Failed loading garden data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch Shadows when Date, Time, or North orientation changes
  const updateShadows = useCallback(async () => {
    try {
      const res = await api.getShadows(selectedDate, selectedTime);
      setShadowResponse(res);
    } catch (err) {
      console.error('Failed fetching shadows:', err);
    }
  }, [selectedDate, selectedTime]);

  // Fetch Blooms when Month changes
  const updateBlooms = useCallback(async () => {
    try {
      const res = await api.getBlooms(selectedMonth);
      setBloomResponse(res);
    } catch (err) {
      console.error('Failed fetching blooms:', err);
    }
  }, [selectedMonth]);

  // Fetch Daily Sunlight Analysis
  const updateSunlight = useCallback(async () => {
    try {
      const res = await api.getSunlight(selectedDate);
      setSunlightData(res);
    } catch (err) {
      console.error('Failed fetching sunlight:', err);
    }
  }, [selectedDate]);

  // Synchronized Date and Month Handlers (Keeps shadow simulation, bloom calendar, and solar analysis aligned)
  const handleDateChange = useCallback((newDate: string) => {
    setSelectedDate(newDate);
    const parts = newDate.split('-');
    if (parts.length >= 2) {
      const m = parseInt(parts[1], 10);
      if (!isNaN(m) && m >= 1 && m <= 12) {
        setSelectedMonth(m);
      }
    }
  }, []);

  const handleMonthChange = useCallback((newMonth: number) => {
    setSelectedMonth(newMonth);
    setSelectedDate((prevDate) => {
      const [yearStr, , dayStr] = prevDate.split('-');
      const now = new Date();
      const year = parseInt(yearStr, 10) || now.getFullYear();
      const day = parseInt(dayStr, 10) || now.getDate();
      const maxDays = new Date(year, newMonth, 0).getDate();
      const clampedDay = Math.min(day, maxDays);
      return `${year}-${String(newMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    });
  }, []);

  // Initial Boot
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Reactive Simulation Updates
  useEffect(() => {
    updateShadows();
  }, [updateShadows, property?.north_angle_deg, property?.latitude, property?.longitude]);

  useEffect(() => {
    updateBlooms();
  }, [updateBlooms, placements]);

  useEffect(() => {
    updateSunlight();
  }, [updateSunlight, obstacles, beds]);

  // Handle Undo Last Movement
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    const remaining = undoStack.length - 1;
    setUndoStack((prev) => prev.slice(0, -1));

    try {
      if (action.type === 'plant') {
        await api.updatePlacement(action.id, {
          x: action.prev.x,
          y: action.prev.y,
          bed_id: action.prev.bed_id ?? undefined,
        });
        setPlacements((prev) =>
          prev.map((p) =>
            p.id === action.id
              ? {
                  ...p,
                  x: action.prev.x,
                  y: action.prev.y,
                  bed_id: action.prev.bed_id ?? p.bed_id,
                }
              : p
          )
        );
        updateBlooms();
        setUndoToast(`Undid move of ${action.name || 'plant'} (${remaining}/5 in history)`);
      } else if (action.type === 'structure') {
        await api.updateObstacle(action.id, { polygon_coords: action.prevCoords });
        setObstacles((prev) =>
          prev.map((o) =>
            o.id === action.id ? { ...o, polygon_coords: action.prevCoords } : o
          )
        );
        updateShadows();
        updateSunlight();
        setUndoToast(`Undid movement of ${action.name || 'structure'} (${remaining}/5 in history)`);
      } else if (action.type === 'bed') {
        await api.updateBed(action.id, { polygon_coords: action.prevCoords });
        setBeds((prev) =>
          prev.map((b) =>
            b.id === action.id ? { ...b, polygon_coords: action.prevCoords } : b
          )
        );
        loadAllData();
        updateSunlight();
        setUndoToast(`Undid movement of ${action.name || 'bed'} (${remaining}/5 in history)`);
      } else if (action.type === 'lot') {
        const updated = await api.updateProperty(action.prevSize);
        setProperty(updated);
        updateShadows();
        updateSunlight();
        setUndoToast(`Undid lot resize (${remaining}/5 in history)`);
      }
    } catch (err) {
      console.error('Failed to undo movement:', err);
    }
  }, [undoStack, updateBlooms, updateShadows, updateSunlight, loadAllData]);

  // Toast Auto-Dismiss
  useEffect(() => {
    if (!undoToast) return;
    const timer = setTimeout(() => setUndoToast(null), 2500);
    return () => clearTimeout(timer);
  }, [undoToast]);

  // Keyboard shortcut: Cmd+Z (Mac) or Ctrl+Z (Windows/Linux) to undo last 5 movements
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const activeEl = document.activeElement;
        const tag = activeEl?.tagName.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          (activeEl as HTMLElement)?.isContentEditable
        ) {
          return;
        }

        // Don't intercept if an editing modal is open
        if (
          isStructureModalOpen ||
          isBedModalOpen ||
          isCatalogOpen ||
          isInspectorOpen ||
          isSettingsOpen
        ) {
          return;
        }

        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    isStructureModalOpen,
    isBedModalOpen,
    isCatalogOpen,
    isInspectorOpen,
    isSettingsOpen,
  ]);

  // Handlers for Structure Management
  const handleSelectStructure = (structure: Obstacle) => {
    setEditingStructure(structure);
    setIsStructureModalOpen(true);
  };

  const handleSaveStructure = async (data: Partial<Obstacle>) => {
    if (editingStructure) {
      await api.updateObstacle(editingStructure.id, data);
    } else {
      await api.createObstacle(data as any);
    }
    loadAllData();
    updateShadows();
    updateSunlight();
  };

  const handleDeleteStructure = async (id: number) => {
    await api.deleteObstacle(id);
    loadAllData();
    updateShadows();
    updateSunlight();
  };

  const handleMoveStructure = async (id: number, newCoords: number[][]) => {
    const existing = obstacles.find((o) => o.id === id);
    if (existing && JSON.stringify(existing.polygon_coords) !== JSON.stringify(newCoords)) {
      pushUndoAction({
        type: 'structure',
        id,
        name: existing.name,
        prevCoords: existing.polygon_coords,
        nextCoords: newCoords,
      });
    }

    // Optimistically update local state immediately so shape never snaps back
    setObstacles((prev) =>
      prev.map((o) => (o.id === id ? { ...o, polygon_coords: newCoords } : o))
    );
    try {
      await api.updateObstacle(id, { polygon_coords: newCoords });
    } catch (err) {
      console.error('Failed to move structure:', err);
      loadAllData();
    }
    updateShadows();
    updateSunlight();
  };

  const handleCreateStructure = async (data: Omit<Obstacle, 'id' | 'property_id'>) => {
    await api.createObstacle(data);
    loadAllData();
    updateShadows();
    updateSunlight();
  };

  // Handlers for Bed / Pond / Terrace Management
  const handleSelectBed = (bed: GardenBed) => {
    setEditingBed(bed);
    setIsBedModalOpen(true);
  };

  const handleUpdateBed = async (id: number, data: Partial<GardenBed>) => {
    if (data.polygon_coords) {
      const existing = beds.find((b) => b.id === id);
      if (existing && JSON.stringify(existing.polygon_coords) !== JSON.stringify(data.polygon_coords)) {
        pushUndoAction({
          type: 'bed',
          id,
          name: existing.name,
          prevCoords: existing.polygon_coords,
          nextCoords: data.polygon_coords,
        });
      }
    }

    // Optimistically update local state immediately
    setBeds((prev) => prev.map((b) => (b.id === id ? { ...b, ...data } : b)));
    try {
      await api.updateBed(id, data);
    } catch (err) {
      console.error('Failed to update bed:', err);
      loadAllData();
    }
    updateSunlight();
  };

  const handleDeleteBed = async (id: number) => {
    await api.deleteBed(id);
    loadAllData();
    updateSunlight();
  };

  const handleCreateBed = async (data: Omit<GardenBed, 'id' | 'property_id'>) => {
    await api.createBed(data);
    loadAllData();
    updateSunlight();
  };

  // Handlers for Plant Management & Moving
  const handleSelectPlant = (placement: PlantPlacement) => {
    setSelectedPlacement(placement);
    setIsInspectorOpen(true);
  };

  const handleMovePlant = async (
    placementId: number,
    newX: number,
    newY: number,
    newBedId?: number | null
  ) => {
    const existing = placements.find((p) => p.id === placementId);
    if (
      existing &&
      (existing.x !== newX || existing.y !== newY || (existing.bed_id ?? null) !== (newBedId ?? null))
    ) {
      pushUndoAction({
        type: 'plant',
        id: placementId,
        name: existing.species?.common_name || 'Plant',
        prev: { x: existing.x, y: existing.y, bed_id: existing.bed_id },
        next: { x: newX, y: newY, bed_id: newBedId },
      });
    }

    // Determine if dropped into staging nursery bay
    const stagingX = property?.staging_area_x ?? 22.0;
    const stagingY = property?.staging_area_y ?? 9.0;
    const stagingW = property?.staging_area_w ?? 4.5;
    const stagingH = property?.staging_area_h ?? 4.0;
    const inStagingNursery =
      newX >= stagingX &&
      newX <= stagingX + stagingW &&
      newY >= stagingY &&
      newY <= stagingY + stagingH;

    let targetContainerType = existing?.container_type;
    if (inStagingNursery) {
      targetContainerType = 'staging';
    } else if (newBedId) {
      const bed = beds.find((b) => b.id === newBedId);
      if (bed?.surface_type === 'pond') {
        targetContainerType = 'pond_basket';
      } else if (targetContainerType === 'staging') {
        targetContainerType = 'ground';
      }
    }

    const nextBedId = newBedId !== undefined ? newBedId : null;

    // Optimistically update local state immediately
    setPlacements((prev) =>
      prev.map((p) =>
        p.id === placementId
          ? {
              ...p,
              x: newX,
              y: newY,
              bed_id: nextBedId,
              container_type: targetContainerType || p.container_type,
            }
          : p
      )
    );
    try {
      await api.updatePlacement(placementId, {
        x: newX,
        y: newY,
        bed_id: nextBedId,
        container_type: targetContainerType,
      });
    } catch (err) {
      console.error('Failed to move plant:', err);
      loadAllData();
    }
    updateBlooms();
  };

  const handleUpdatePlacement = async (id: number, data: Partial<PlantPlacement>) => {
    let payload = { ...data };
    if (payload.bed_id === undefined) {
      payload.bed_id = null;
    }
    // If moving to staging nursery (bed_id is null and container_type is staging), position inside the staging nursery
    if (payload.bed_id === null && payload.container_type === 'staging') {
      const sX = property?.staging_area_x ?? 22.0;
      const sY = property?.staging_area_y ?? 9.0;
      const otherStaged = placements.filter(
        (p) => p.id !== id && (!p.planted_date || p.container_type === 'staging')
      );
      const idx = otherStaged.length;
      const col = idx % 3;
      const row = Math.floor(idx / 3) % 3;
      payload.x = Math.round((sX + 0.8 + col * 1.3) * 10) / 10;
      payload.y = Math.round((sY + 1.0 + row * 1.3) * 10) / 10;
    }
    await api.updatePlacement(id, payload);
    await loadAllData();
    updateBlooms();
  };

  const handleDeletePlacement = async (id: number) => {
    await api.deletePlacement(id);
    loadAllData();
  };

  // Staging new plant from catalog into open space
  const handleStagePlant = async (speciesId: number, targetBedId?: number) => {
    let posX = 3.0;
    let posY = 3.0;
    let assignedBedId = targetBedId;

    if (targetBedId) {
      const b = beds.find((bed) => bed.id === targetBedId);
      if (b && b.polygon_coords.length) {
        posX = b.polygon_coords[0][0] + 1;
        posY = b.polygon_coords[0][1] + 1;
      }
    } else {
      // Place neatly inside the Staging Nursery Bay wherever it is positioned
      const sX = property?.staging_area_x ?? 22.0;
      const sY = property?.staging_area_y ?? 9.0;
      const stagedList = placements.filter((p) => !p.planted_date || p.container_type === 'staging');
      const idx = stagedList.length;
      const col = idx % 3;
      const row = Math.floor(idx / 3) % 3;
      posX = Math.round((sX + 0.8 + col * 1.3) * 10) / 10;
      posY = Math.round((sY + 1.0 + row * 1.3) * 10) / 10;
    }

    const species = plants.find((p) => p.id === speciesId);
    await api.createPlacement({
      species_id: speciesId,
      bed_id: assignedBedId ?? undefined,
      container_type: 'staging',
      x: posX,
      y: posY,
      current_height_m: species?.mature_height_m,
      current_spread_m: species?.mature_spread_m,
      planted_date: undefined, // left unset until user plants & commits
      notes: 'Staged for planting.',
    });
    loadAllData();
  };

  const handleCommitStagedPlants = async () => {
    const staged = placements.filter((p) => !p.planted_date || p.container_type === 'staging');
    if (staged.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    await Promise.all(
      staged.map((p) =>
        api.updatePlacement(p.id, {
          planted_date: todayStr,
          container_type: p.container_type === 'staging' ? 'ground' : p.container_type,
          notes: p.notes ? `${p.notes} (Planted ${todayStr})` : `Planted on ${todayStr}`,
        })
      )
    );
    await loadAllData();
  };

  const handleDeleteEntity = async (type: 'structure' | 'bed' | 'plant', id: number) => {
    if (type === 'structure') {
      await handleDeleteStructure(id);
    } else if (type === 'bed') {
      await handleDeleteBed(id);
    } else if (type === 'plant') {
      await handleDeletePlacement(id);
    }
  };

  const handleSavePropertySettings = async (data: Partial<Property>) => {
    const updated = await api.updateProperty(data);
    setProperty(updated);
    updateShadows();
    updateSunlight();
  };

  const handleResizeLot = async (newWidth: number, newHeight: number) => {
    if (property && (property.width_m !== newWidth || property.height_m !== newHeight)) {
      pushUndoAction({
        type: 'lot',
        prevSize: { width_m: property.width_m, height_m: property.height_m },
        nextSize: { width_m: newWidth, height_m: newHeight },
      });
    }
    await handleSavePropertySettings({ width_m: newWidth, height_m: newHeight });
  };

  const handleUpdateStagingArea = async (x: number, y: number, w: number, h: number) => {
    if (property) {
      setProperty({
        ...property,
        staging_area_x: x,
        staging_area_y: y,
        staging_area_w: w,
        staging_area_h: h,
      });
    }
    try {
      localStorage.setItem('jardin_staging_area', JSON.stringify({ x, y, w, h }));
    } catch (e) {}
    try {
      await api.updateProperty({
        staging_area_x: x,
        staging_area_y: y,
        staging_area_w: w,
        staging_area_h: h,
      } as any);
    } catch (err) {
      console.error('Failed to persist staging area coordinates to backend:', err);
    }
  };

  if (isLoading || !property) {
    return (
      <div className="flex items-center justify-center h-screen bg-garden-bg text-garden-text">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-garden-accent" />
          <span className="font-medium text-sm">Loading Jardín Garden OS...</span>
        </div>
      </div>
    );
  }

  const stagedCount = placements.filter((p) => !p.planted_date || p.container_type === 'staging').length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-garden-bg text-garden-text">
      {/* Top Header & Simulation Scrubber */}
      <div className="relative">
        <TimeControls
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          selectedMonth={selectedMonth}
          sunPosition={shadowResponse?.sun}
          bloomingCount={bloomResponse?.blooming_plants_count || 0}
          onDateChange={handleDateChange}
          onTimeChange={setSelectedTime}
          onMonthChange={handleMonthChange}
        />
        {/* Settings Gear in Header */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Garden Lot & Solar Settings (North Orientation, Dimensions, GPS)"
          className="absolute right-4 top-2.5 p-1.5 rounded-lg bg-white/90 hover:bg-white text-garden-text hover:text-garden-accent border border-garden-border shadow-xs transition flex items-center gap-1 text-xs"
        >
          <Compass className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden md:inline font-medium">Lot & North</span>
        </button>
      </div>

      {/* Workflow Mode Switcher Bar */}
      <div className="bg-white/95 border-b border-garden-border px-4 py-2 flex items-center justify-between shadow-2xs z-20 backdrop-blur-xs select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-garden-textMuted mr-1 hidden sm:inline">
            Mode:
          </span>
          <div className="flex items-center bg-garden-subtle/80 p-0.5 rounded-xl border border-garden-border text-xs">
            <button
              onClick={() => setWorkflowMode('setup')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                workflowMode === 'setup'
                  ? 'bg-white text-stone-900 shadow-xs border border-garden-border font-bold'
                  : 'text-garden-textMuted hover:text-garden-text'
              }`}
            >
              <span>🏗️</span>
              <span>1. Setup & Hardscape</span>
            </button>
            <button
              onClick={() => setWorkflowMode('staging')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                workflowMode === 'staging'
                  ? 'bg-emerald-50 text-emerald-900 shadow-xs border border-emerald-300 font-bold'
                  : 'text-garden-textMuted hover:text-garden-text'
              }`}
            >
              <span>🌿</span>
              <span>2. Plant Staging</span>
              {stagedCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-mono font-bold">
                  {stagedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setWorkflowMode('gardening')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                workflowMode === 'gardening'
                  ? 'bg-amber-50 text-amber-900 shadow-xs border border-amber-300 font-bold'
                  : 'text-garden-textMuted hover:text-garden-text'
              }`}
            >
              <span>🌸</span>
              <span>3. Gardening & Care</span>
            </button>
          </div>
        </div>

        {/* Mode-Specific Status / Actions */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo last movement (Cmd+Z or Ctrl+Z)"
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition text-xs border ${
              undoStack.length > 0
                ? 'bg-white hover:bg-garden-subtle text-garden-text border-garden-border shadow-2xs cursor-pointer'
                : 'opacity-40 text-garden-textMuted border-transparent cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
            {undoStack.length > 0 && (
              <span className="text-[10px] text-amber-800 font-mono font-bold">
                ({undoStack.length}/5)
              </span>
            )}
          </button>

          {workflowMode === 'setup' && (
            <span className="text-garden-textMuted text-[11px] hidden md:inline">
              📐 Lot boundaries, structures & planting areas editable. Plants are locked.
            </span>
          )}
          {workflowMode === 'staging' && (
            <div className="flex items-center gap-2">
              <span className="text-garden-textMuted text-[11px] hidden md:inline">
                🌿 Position plants on beds. Structures and areas are locked.
              </span>
              {stagedCount > 0 && (
                <button
                  onClick={handleCommitStagedPlants}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition text-xs"
                >
                  <span>🌱</span>
                  <span>Plant & Commit Changes ({stagedCount})</span>
                </button>
              )}
            </div>
          )}
          {workflowMode === 'gardening' && (
            <span className="text-garden-textMuted text-[11px] hidden md:inline">
              ✂️ Click any plant to prune, fertilize, water, or log notes. Layout is locked.
            </span>
          )}
        </div>
      </div>

      {/* Main Workspace (Side Panels + Canvas) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Collapsible Plant Inventory Panel */}
        <PlantsSidePanel
          isOpen={isInventoryOpen}
          placements={placements}
          beds={beds}
          onClose={() => setIsInventoryOpen(false)}
          onSelectPlant={(p) => {
            setSelectedPlacement(p);
            setIsInspectorOpen(true);
          }}
          onOpenCatalog={() => setIsCatalogOpen(true)}
          onLocatePlant={handleLocatePlant}
        />

        {/* Center Canvas Area */}
        <div className="flex-1 relative h-full">
          <GardenCanvas
            property={property}
            obstacles={obstacles}
            beds={beds}
            placements={placements}
            shadows={shadowResponse?.shadows || []}
            bloomPlants={bloomResponse?.plants || []}
            sunlightData={sunlightData}
            workflowMode={workflowMode}
            focusedEntity={focusedEntity}
            onSelectStructure={handleSelectStructure}
            onSelectBed={handleSelectBed}
            onSelectPlant={handleSelectPlant}
            onMovePlant={handleMovePlant}
            onMoveStructure={handleMoveStructure}
            onUpdateBed={handleUpdateBed}
            onResizeLot={handleResizeLot}
            onCreateStructure={handleCreateStructure}
            onCreateBed={handleCreateBed}
            onDeleteEntity={handleDeleteEntity}
            onCommitStagedPlants={handleCommitStagedPlants}
            onOpenCatalog={() => setIsCatalogOpen(true)}
            onOpenInventory={() => setIsInventoryOpen(true)}
            onUndo={handleUndo}
            canUndo={undoStack.length > 0}
            onUpdateStagingArea={handleUpdateStagingArea}
          />

          {/* Floating Action Dock (Bottom Right) */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
            {workflowMode === 'staging' && stagedCount > 0 && (
              <button
                onClick={handleCommitStagedPlants}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-1.5 text-xs transition animate-pulse"
              >
                <span>🌱</span>
                <span>Plant & Commit ({stagedCount})</span>
              </button>
            )}

            <button
              onClick={() => setIsInventoryOpen(!isInventoryOpen)}
              className={`px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 text-xs font-semibold transition ${
                isInventoryOpen
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-garden-accent hover:bg-garden-accentHover text-white'
              }`}
            >
              <Sprout className="w-4 h-4" />
              <span>Plant Inventory ({placements.length})</span>
            </button>

            {workflowMode !== 'setup' && (
              <button
                onClick={() => setIsCatalogOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-[#d96b7d] to-[#b35e88] hover:from-[#cb5f71] hover:to-[#a25178] font-semibold text-white rounded-xl shadow-md flex items-center gap-2 text-xs transition"
              >
                <span>🌸</span>
                <span>Catalog & Stage</span>
              </button>
            )}


            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-2.5 rounded-xl shadow-md transition flex items-center gap-1.5 text-xs font-semibold ${
                isChatOpen
                  ? 'bg-white text-sky-800 border border-sky-300'
                  : 'bg-gradient-to-r from-[#4d73b0] to-[#595ca6] hover:from-[#44669e] hover:to-[#4e5196] text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Hermes</span>
            </button>
          </div>
        </div>

        {/* Right Collapsible Chat Sidebar */}
        <AgentChatSidebar
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onRefreshData={() => {
            loadAllData();
            updateShadows();
            updateSunlight();
          }}
        />
      </div>

      {/* Bottom Seasonal Bloom Timeline */}
      <BloomTimeline
        currentMonth={selectedMonth}
        plants={bloomResponse?.plants || []}
        onSelectMonth={handleMonthChange}
      />

      {/* Modals & Inspectors */}
      <StructureModal
        isOpen={isStructureModalOpen}
        structure={editingStructure}
        onClose={() => {
          setIsStructureModalOpen(false);
          setEditingStructure(null);
        }}
        onSave={handleSaveStructure}
        onDelete={handleDeleteStructure}
      />

      <BedModal
        isOpen={isBedModalOpen}
        bed={editingBed}
        property={property}
        onClose={() => {
          setIsBedModalOpen(false);
          setEditingBed(null);
        }}
        onSave={handleUpdateBed}
        onCreate={handleCreateBed}
        onDelete={handleDeleteBed}
      />

      <PlantCatalogModal
        isOpen={isCatalogOpen}
        plants={plants}
        beds={beds}
        onClose={() => setIsCatalogOpen(false)}
        onPlantAdded={loadAllData}
        onStagePlant={handleStagePlant}
      />

      <PlantInspectorModal
        isOpen={isInspectorOpen}
        placement={selectedPlacement}
        beds={beds}
        onClose={() => {
          setIsInspectorOpen(false);
          setSelectedPlacement(null);
        }}
        onSave={handleUpdatePlacement}
        onDelete={handleDeletePlacement}
      />

      {property && (
        <PropertySettingsModal
          isOpen={isSettingsOpen}
          property={property}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSavePropertySettings}
        />
      )}

      {/* Undo Toast Notification */}
      {undoToast && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-stone-900/90 text-white text-xs px-3.5 py-2 rounded-xl shadow-xl backdrop-blur-sm flex items-center gap-2 pointer-events-none">
          <Undo2 className="w-3.5 h-3.5 text-amber-400" />
          <span>{undoToast}</span>
        </div>
      )}
    </div>
  );
};

export default App;
