import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Home,
  Warehouse,
  Building2,
  Trees,
  Sprout,
  Move,
  Droplet,
  Grid,
  Maximize2,
  Trash2,
  Edit3,
  Footprints,
  Table,
  Armchair,
  Tent,
  Recycle,
  Sparkles,
  Undo2,
  Square,
  Plus,
  Minus,
  Fence,
  BrickWall,
  RefreshCw,
} from 'lucide-react';
import {
  Property,
  Obstacle,
  GardenBed,
  PlantBloomState,
  PlantPlacement,
  ShadowPolygon,
  DailySunlightResponse,
  WorkflowMode,
} from '../types/garden';

interface GardenCanvasProps {
  property: Property;
  obstacles: Obstacle[];
  beds: GardenBed[];
  placements: PlantPlacement[];
  shadows: ShadowPolygon[];
  bloomPlants: PlantBloomState[];
  sunlightData?: DailySunlightResponse | null;
  workflowMode?: WorkflowMode;
  onSelectStructure: (obstacle: Obstacle) => void;
  onSelectBed: (bed: GardenBed) => void;
  onSelectPlant: (placement: PlantPlacement) => void;
  onMovePlant: (placementId: number, newX: number, newY: number, newBedId?: number | null) => void;
  onMoveStructure: (obstacleId: number, newCoords: number[][]) => void;
  onUpdateBed: (bedId: number, data: Partial<GardenBed>) => void;
  onResizeLot: (newWidth: number, newHeight: number) => void;
  onCreateStructure: (structure: Omit<Obstacle, 'id' | 'property_id'>) => void;
  onCreateBed: (bed: Omit<GardenBed, 'id' | 'property_id'>) => void;
  onDeleteEntity?: (type: 'structure' | 'bed' | 'plant', id: number) => void;
  onCommitStagedPlants?: () => void;
  onOpenCatalog?: () => void;
  onOpenInventory?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  focusedEntity?: { type: 'plant'; id: number; x: number; y: number; timestamp: number } | null;
  onUpdateStagingArea?: (x: number, y: number, w: number, h: number) => void;
}

type ToolMode =
  | 'select'
  | 'draw_house'
  | 'draw_neighbor'
  | 'draw_shed'
  | 'draw_fence'
  | 'draw_wall'
  | 'draw_sidewalk'
  | 'draw_table'
  | 'draw_bench'
  | 'draw_chair'
  | 'draw_terrace_cover'
  | 'draw_compost'
  | 'draw_terrace'
  | 'draw_bed'
  | 'poly_bed'
  | 'poly_terrace'
  | 'poly_pond';

type SelectedEntity =
  | { type: 'structure'; id: number }
  | { type: 'bed'; id: number }
  | { type: 'plant'; id: number }
  | { type: 'staging_nursery'; id?: number }
  | null;

export type EdgeSide = 'top' | 'bottom' | 'left' | 'right';

export interface RectBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  isRect: boolean;
}

export type DraggedItem = {
  type: 'plant' | 'structure' | 'bed' | 'vertex' | 'edge_handle' | 'lot_corner' | 'staging_nursery';
  id?: number;
  vertexIndex?: number;
  edgeSide?: EdgeSide;
  startMeter: { x: number; y: number };
  currentMeter: { x: number; y: number };
  initialCoords?: number[][];
  initialPlantPos?: { x: number; y: number };
  initialLotSize?: { w: number; h: number };
  initialBounds?: RectBounds;
};

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function getRectBounds(coords: number[][]): RectBounds | null {
  if (!coords || coords.length !== 4) return null;
  const xs = coords.map((p) => p[0]);
  const ys = coords.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 0.1 || h < 0.1) return null;

  const EPS = 0.08;

  // Each of the 4 points must be near one of the 4 bounds corners
  for (const [x, y] of coords) {
    const nearX = Math.abs(x - minX) < EPS || Math.abs(x - maxX) < EPS;
    const nearY = Math.abs(y - minY) < EPS || Math.abs(y - maxY) < EPS;
    if (!nearX || !nearY) return null;
  }

  // Check each edge: consecutive vertices must be axis-aligned
  for (let i = 0; i < 4; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % 4];
    const dx = Math.abs(p1[0] - p2[0]);
    const dy = Math.abs(p1[1] - p2[1]);
    const isEdgeAxisAligned = dx < EPS || dy < EPS;
    if (!isEdgeAxisAligned) return null;
  }

  return { minX, maxX, minY, maxY, isRect: true };
}

export function computeUpdatedRectCoords(
  initialCoords: number[][],
  initialBounds: RectBounds,
  handleType: 'edge' | 'vertex',
  handleDetail: { side?: EdgeSide; vertexIndex?: number },
  currentMeter: { x: number; y: number }
): number[][] {
  const midX = (initialBounds.minX + initialBounds.maxX) / 2;
  const midY = (initialBounds.minY + initialBounds.maxY) / 2;
  const MIN_SIZE = 0.05; // 5 cm minimum size allows realistic thin fences and walls

  let newMinX = initialBounds.minX;
  let newMaxX = initialBounds.maxX;
  let newMinY = initialBounds.minY;
  let newMaxY = initialBounds.maxY;

  if (handleType === 'edge') {
    const side = handleDetail.side;
    if (side === 'top') {
      newMinY = Math.min(currentMeter.y, initialBounds.maxY - MIN_SIZE);
    } else if (side === 'bottom') {
      newMaxY = Math.max(currentMeter.y, initialBounds.minY + MIN_SIZE);
    } else if (side === 'left') {
      newMinX = Math.min(currentMeter.x, initialBounds.maxX - MIN_SIZE);
    } else if (side === 'right') {
      newMaxX = Math.max(currentMeter.x, initialBounds.minX + MIN_SIZE);
    }
  } else if (handleType === 'vertex') {
    const vIdx = handleDetail.vertexIndex ?? 0;
    const v = initialCoords[vIdx] || [midX, midY];
    const isLeft = v[0] < midX;
    const isTop = v[1] < midY;

    if (isLeft) {
      newMinX = Math.min(currentMeter.x, initialBounds.maxX - MIN_SIZE);
    } else {
      newMaxX = Math.max(currentMeter.x, initialBounds.minX + MIN_SIZE);
    }

    if (isTop) {
      newMinY = Math.min(currentMeter.y, initialBounds.maxY - MIN_SIZE);
    } else {
      newMaxY = Math.max(currentMeter.y, initialBounds.minY + MIN_SIZE);
    }
  }

  return initialCoords.map(([px, py]) => [
    px < midX ? newMinX : newMaxX,
    py < midY ? newMinY : newMaxY,
  ]);
}

function getTransformedCoords(
  entityCoords: number[][],
  entityId: number,
  entityType: 'bed' | 'structure' | 'staging_nursery',
  selectedEntity: SelectedEntity,
  draggedItem: DraggedItem | null
): number[][] {
  if (!draggedItem) return entityCoords;

  if (
    draggedItem.type === entityType &&
    (draggedItem.id ?? 0) === entityId &&
    draggedItem.initialCoords
  ) {
    const dx = draggedItem.currentMeter.x - draggedItem.startMeter.x;
    const dy = draggedItem.currentMeter.y - draggedItem.startMeter.y;
    return draggedItem.initialCoords.map((pt) => [pt[0] + dx, pt[1] + dy]);
  }

  const selectedId = selectedEntity?.id ?? 0;
  if (
    selectedEntity?.type === entityType &&
    selectedId === entityId &&
    (draggedItem.id ?? 0) === entityId
  ) {
    if (
      draggedItem.type === 'edge_handle' &&
      draggedItem.initialCoords &&
      draggedItem.initialBounds &&
      draggedItem.edgeSide
    ) {
      return computeUpdatedRectCoords(
        draggedItem.initialCoords,
        draggedItem.initialBounds,
        'edge',
        { side: draggedItem.edgeSide },
        draggedItem.currentMeter
      );
    }

    if (
      draggedItem.type === 'vertex' &&
      draggedItem.initialCoords &&
      draggedItem.vertexIndex !== undefined
    ) {
      if (draggedItem.initialBounds) {
        return computeUpdatedRectCoords(
          draggedItem.initialCoords,
          draggedItem.initialBounds,
          'vertex',
          { vertexIndex: draggedItem.vertexIndex },
          draggedItem.currentMeter
        );
      }
      return draggedItem.initialCoords.map((pt, idx) =>
        idx === draggedItem.vertexIndex
          ? [draggedItem.currentMeter.x, draggedItem.currentMeter.y]
          : pt
      );
    }
  }

  return entityCoords;
}

const renderSelectionHandles = (
  ctx: CanvasRenderingContext2D,
  coords: number[][],
  meterToScreen: (x: number, y: number) => { x: number; y: number },
  accentColor: string = '#2563eb'
) => {
  const rectBounds = getRectBounds(coords);

  if (rectBounds) {
    const midX = (rectBounds.minX + rectBounds.maxX) / 2;
    const midY = (rectBounds.minY + rectBounds.maxY) / 2;

    const topScreen = meterToScreen(midX, rectBounds.minY);
    const bottomScreen = meterToScreen(midX, rectBounds.maxY);
    const leftScreen = meterToScreen(rectBounds.minX, midY);
    const rightScreen = meterToScreen(rectBounds.maxX, midY);

    const drawPillHandle = (cx: number, cy: number, w: number, h: number) => {
      const r = Math.min(w, h) / 2;
      ctx.save();
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
      } else {
        ctx.rect(cx - w / 2, cy - h / 2, w, h);
      }
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner subtle highlight grip line
      ctx.beginPath();
      if (w > h) {
        ctx.moveTo(cx - 3, cy);
        ctx.lineTo(cx + 3, cy);
      } else {
        ctx.moveTo(cx, cy - 3);
        ctx.lineTo(cx, cy + 3);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };

    // Top & Bottom (horizontal pills)
    drawPillHandle(topScreen.x, topScreen.y, 18, 7);
    drawPillHandle(bottomScreen.x, bottomScreen.y, 18, 7);

    // Left & Right (vertical pills)
    drawPillHandle(leftScreen.x, leftScreen.y, 7, 18);
    drawPillHandle(rightScreen.x, rightScreen.y, 7, 18);

    // Corner handles (circles)
    coords.forEach(([vx, vy]) => {
      const vp = meterToScreen(vx, vy);
      ctx.save();
      ctx.beginPath();
      ctx.arc(vp.x, vp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(vp.x, vp.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.restore();
    });
  } else {
    // Non-orthogonal polygon: standard vertex handles
    coords.forEach(([vx, vy]) => {
      const vp = meterToScreen(vx, vy);
      ctx.save();
      ctx.beginPath();
      ctx.arc(vp.x, vp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    });
  }
};

export const GardenCanvas: React.FC<GardenCanvasProps> = ({
  property,
  obstacles,
  beds,
  placements,
  shadows,
  bloomPlants,
  sunlightData,
  workflowMode = 'setup',
  onSelectStructure,
  onSelectBed,
  onSelectPlant,
  onMovePlant,
  onMoveStructure,
  onUpdateBed,
  onResizeLot,
  onCreateStructure,
  onCreateBed,
  onDeleteEntity,
  onCommitStagedPlants,
  onOpenCatalog,
  onOpenInventory,
  onUndo,
  canUndo = false,
  focusedEntity,
  onUpdateStagingArea,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport Transform (Pan and Zoom)
  const [zoom, setZoom] = useState<number>(22); // pixels per meter
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 100, y: 70 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Center view on focused entity when requested
  useEffect(() => {
    if (focusedEntity && canvasRef.current) {
      const cx = canvasRef.current.clientWidth / 2;
      const cy = canvasRef.current.clientHeight / 2;
      const targetZoom = Math.max(zoom, 32);
      setZoom(targetZoom);
      setPan({
        x: cx - focusedEntity.x * targetZoom,
        y: cy - focusedEntity.y * targetZoom,
      });
      setSelectedEntity({ type: 'plant', id: focusedEntity.id });
    }
  }, [focusedEntity]);

  // Selection & Active Tool
  const [activeTool, setActiveTool] = useState<ToolMode>('select');
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [canvasCursor, setCanvasCursor] = useState<string>('default');

  // Dragging Objects or Reshaping Vertices
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);

  // Irregular Multi-Point Polygon Drawing
  const [polyVertices, setPolyVertices] = useState<number[][]>([]);
  const [currentMouseMeter, setCurrentMouseMeter] = useState<{ x: number; y: number } | null>(null);

  // Quick Box Dragging
  const [boxStartMeter, setBoxStartMeter] = useState<{ x: number; y: number } | null>(null);

  // Layer Toggles
  const [showShadows, setShowShadows] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showPlants, setShowPlants] = useState<boolean>(true);
  const [showStructures, setShowStructures] = useState<boolean>(true);
  const [showBeds, setShowBeds] = useState<boolean>(true);
  const [hoveredPlant, setHoveredPlant] = useState<PlantBloomState | null>(null);

  // Active Staging Area Nursery Coordinates (defaults to open lawn at x: 22.0, y: 9.0)
  const stagingX = property.staging_area_x ?? 22.0;
  const stagingY = property.staging_area_y ?? 9.0;
  const stagingW = property.staging_area_w ?? 4.5;
  const stagingH = property.staging_area_h ?? 4.0;

  const stagingBaseCoords = [
    [stagingX, stagingY],
    [stagingX + stagingW, stagingY],
    [stagingX + stagingW, stagingY + stagingH],
    [stagingX, stagingY + stagingH],
  ];

  const activeStagingCoords = getTransformedCoords(
    stagingBaseCoords,
    0,
    'staging_nursery',
    selectedEntity,
    draggedItem
  );

  // Merge all placements with bloom analysis states so every plant (staged, unassigned, or in beds) is always rendered and interactive
  const effectivePlants: PlantBloomState[] = useMemo(() => {
    const bloomMap = new Map((bloomPlants || []).map((b) => [b.placement_id, b]));
    return (placements || []).map((pl) => {
      const b = bloomMap.get(pl.id);
      const spread_m = pl.current_spread_m || pl.species?.mature_spread_m || b?.spread_m || 0.6;
      const height_m = pl.current_height_m || pl.species?.mature_height_m || b?.height_m || 0.6;
      return {
        placement_id: pl.id,
        species_id: pl.species_id,
        bed_id: pl.bed_id,
        botanical_name: pl.species?.botanical_name || b?.botanical_name || '',
        common_name: pl.species?.common_name || b?.common_name || 'Plant',
        variety: pl.species?.variety || b?.variety,
        x: pl.x,
        y: pl.y,
        spread_m,
        height_m,
        is_blooming: b ? b.is_blooming : false,
        bloom_colors: b ? b.bloom_colors : (pl.species?.bloom_colors || ['#967BB6']),
        foliage_type: pl.species?.foliage_type || b?.foliage_type || 'perennial',
        bloom_start_month: pl.species?.bloom_start_month || b?.bloom_start_month || 6,
        bloom_end_month: pl.species?.bloom_end_month || b?.bloom_end_month || 8,
        container_type: pl.container_type || b?.container_type || 'ground',
        planted_date: pl.planted_date,
        last_pruned_date: pl.last_pruned_date,
        last_fertilized_date: pl.last_fertilized_date,
        notes: pl.notes,
      };
    });
  }, [placements, bloomPlants]);

  // Clear selections when switching modes if not applicable
  useEffect(() => {
    if (workflowMode === 'staging' && selectedEntity && selectedEntity.type !== 'plant' && selectedEntity.type !== 'staging_nursery') {
      setSelectedEntity(null);
    } else if (workflowMode === 'setup' && selectedEntity && selectedEntity.type === 'plant') {
      setSelectedEntity(null);
    } else if (workflowMode === 'gardening') {
      setSelectedEntity(null);
    }
  }, [workflowMode]);

  // Keyboard shortcut: Delete / Backspace to delete selected entity
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEntity && onDeleteEntity) {
        if (selectedEntity.type === 'staging_nursery') return;
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        onDeleteEntity(selectedEntity.type, selectedEntity.id);
        setSelectedEntity(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntity, onDeleteEntity]);

  // Transform helpers: screen coords <-> meter coords
  const screenToMeter = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom,
    }),
    [pan, zoom]
  );

  const meterToScreen = useCallback(
    (mx: number, my: number) => ({
      x: mx * zoom + pan.x,
      y: my * zoom + pan.y,
    }),
    [pan, zoom]
  );

  // Auto-fit canvas when property dimensions change
  const fitToLot = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const padding = 80;
    const availableW = canvas.clientWidth - padding * 2;
    const availableH = canvas.clientHeight - padding * 2;
    const scaleX = availableW / property.width_m;
    const scaleY = availableH / property.height_m;
    const bestZoom = Math.max(4, Math.min(scaleX, scaleY, 40));
    setZoom(bestZoom);
    setPan({
      x: (canvas.clientWidth - property.width_m * bestZoom) / 2,
      y: (canvas.clientHeight - property.height_m * bestZoom) / 2,
    });
  }, [property.width_m, property.height_m]);

  useEffect(() => {
    fitToLot();
  }, [fitToLot]);

  const handleZoomIn = () => {
    if (!canvasRef.current) return;
    const newZoom = Math.min(1000, zoom * 1.35);
    const cx = canvasRef.current.clientWidth / 2;
    const cy = canvasRef.current.clientHeight / 2;
    setPan({
      x: cx - (cx - pan.x) * (newZoom / zoom),
      y: cy - (cy - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    if (!canvasRef.current) return;
    const newZoom = Math.max(4, zoom / 1.35);
    const cx = canvasRef.current.clientWidth / 2;
    const cy = canvasRef.current.clientHeight / 2;
    setPan({
      x: cx - (cx - pan.x) * (newZoom / zoom),
      y: cy - (cy - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  const getScaleBar = (currentZoom: number) => {
    if (currentZoom >= 500) {
      return { label: '5 cm', widthPx: 0.05 * currentZoom };
    } else if (currentZoom >= 250) {
      return { label: '10 cm', widthPx: 0.1 * currentZoom };
    } else if (currentZoom >= 100) {
      return { label: '25 cm', widthPx: 0.25 * currentZoom };
    } else if (currentZoom >= 45) {
      return { label: '50 cm', widthPx: 0.5 * currentZoom };
    } else if (currentZoom >= 18) {
      return { label: '1 m', widthPx: 1.0 * currentZoom };
    } else if (currentZoom >= 8) {
      return { label: '2 m', widthPx: 2.0 * currentZoom };
    } else {
      return { label: '5 m', widthPx: 5.0 * currentZoom };
    }
  };

  // Point in Polygon Test
  const pointInPoly = (x: number, y: number, pts: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0],
        yi = pts[i][1];
      const xj = pts[j][0],
        yj = pts[j][1];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const findBedAtCoordinates = (x: number, y: number): GardenBed | null => {
    for (const bed of beds) {
      if (!bed.polygon_coords || bed.polygon_coords.length < 3) continue;
      if (pointInPoly(x, y, bed.polygon_coords)) return bed;
    }
    return null;
  };

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // 1. Clear background (soft light garden drafting table)
    ctx.fillStyle = '#ebf2e9';
    ctx.fillRect(0, 0, width, height);

    // 2. Render Property Lot & Lawn
    let lotW = property.width_m;
    let lotH = property.height_m;
    if (draggedItem && draggedItem.type === 'lot_corner' && draggedItem.initialLotSize) {
      const dx = draggedItem.currentMeter.x - draggedItem.startMeter.x;
      const dy = draggedItem.currentMeter.y - draggedItem.startMeter.y;
      lotW = Math.max(5, Math.round((draggedItem.initialLotSize.w + dx) * 10) / 10);
      lotH = Math.max(5, Math.round((draggedItem.initialLotSize.h + dy) * 10) / 10);
    }

    const propTopLeft = meterToScreen(0, 0);
    const propWidthPx = lotW * zoom;
    const propHeightPx = lotH * zoom;

    // Grass color (sunlit garden lawn from Image 2)
    ctx.fillStyle = '#98b85b';
    ctx.fillRect(propTopLeft.x, propTopLeft.y, propWidthPx, propHeightPx);

    // Adaptive architectural grid lines
    if (zoom >= 400) {
      // 5cm fine grid for miniature plants, small pots, and paving detail
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= lotW + 0.001; x += 0.05) {
        if (Math.abs((x * 10) % 1) < 0.01) continue;
        const p1 = meterToScreen(x, 0);
        const p2 = meterToScreen(x, lotH);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      for (let y = 0; y <= lotH + 0.001; y += 0.05) {
        if (Math.abs((y * 10) % 1) < 0.01) continue;
        const p1 = meterToScreen(0, y);
        const p2 = meterToScreen(lotW, y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    if (zoom >= 120) {
      // 10cm sub-grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.75;
      for (let x = 0; x <= lotW + 0.001; x += 0.1) {
        if (Math.abs((x * 2) % 1) < 0.01) continue;
        const p1 = meterToScreen(x, 0);
        const p2 = meterToScreen(x, lotH);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      for (let y = 0; y <= lotH + 0.001; y += 0.1) {
        if (Math.abs((y * 2) % 1) < 0.01) continue;
        const p1 = meterToScreen(0, y);
        const p2 = meterToScreen(lotW, y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    if (zoom >= 45) {
      // 50cm grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 0.85;
      for (let x = 0; x <= lotW + 0.001; x += 0.5) {
        if (Math.abs(x % 1) < 0.01) continue;
        const p1 = meterToScreen(x, 0);
        const p2 = meterToScreen(x, lotH);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      for (let y = 0; y <= lotH + 0.001; y += 0.5) {
        if (Math.abs(y % 1) < 0.01) continue;
        const p1 = meterToScreen(0, y);
        const p2 = meterToScreen(lotW, y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // 1-meter main architectural grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.2;
    for (let x = 0; x <= lotW + 0.001; x += 1) {
      const p1 = meterToScreen(x, 0);
      const p2 = meterToScreen(x, lotH);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let y = 0; y <= lotH + 0.001; y += 1) {
      const p1 = meterToScreen(0, y);
      const p2 = meterToScreen(lotW, y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Property Boundary Border
    ctx.strokeStyle = '#6f8a54';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(propTopLeft.x, propTopLeft.y, propWidthPx, propHeightPx);

    // Dimension Rulers & Labels
    // Top Dimension Banner
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(propTopLeft.x + propWidthPx / 2 - 60, propTopLeft.y - 24, 120, 20);
    ctx.strokeStyle = '#a4b89e';
    ctx.strokeRect(propTopLeft.x + propWidthPx / 2 - 60, propTopLeft.y - 24, 120, 20);
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#233527';
    ctx.fillText(`↔ Lot ${lotW}m`, propTopLeft.x + propWidthPx / 2, propTopLeft.y - 10);

    // Left Dimension Banner
    ctx.save();
    ctx.translate(propTopLeft.x - 24, propTopLeft.y + propHeightPx / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(-60, -10, 120, 20);
    ctx.strokeStyle = '#a4b89e';
    ctx.strokeRect(-60, -10, 120, 20);
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#233527';
    ctx.fillText(`↕ Lot ${lotH}m`, 0, 4);
    ctx.restore();

    // Draggable Lot Corner Handle (Bottom-Right)
    const lotCorner = meterToScreen(lotW, lotH);
    ctx.beginPath();
    ctx.arc(lotCorner.x, lotCorner.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#407a4a';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '9px monospace';
    ctx.fillStyle = '#233527';
    ctx.fillText('📐 Resize Lot', lotCorner.x + 36, lotCorner.y + 4);

    // Compass North Indicator
    ctx.save();
    const compassPos = meterToScreen(lotW - 2.5, 2.5);
    ctx.translate(compassPos.x, compassPos.y);
    ctx.rotate((property.north_angle_deg * Math.PI) / 180);
    ctx.strokeStyle = '#c94838';
    ctx.fillStyle = '#c94838';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, -16);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(0, -18);
    ctx.lineTo(5, -6);
    ctx.fill();
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -22);
    ctx.restore();

    // 2.5 Render Designated Plant Staging Nursery (visible in setup mode, staging mode, or when staged plants exist)
    const stagedCount = placements.filter((p) => !p.planted_date || p.container_type === 'staging').length;
    if (workflowMode === 'setup' || workflowMode === 'staging' || stagedCount > 0) {
      const xs = activeStagingCoords.map((p) => p[0]);
      const ys = activeStagingCoords.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const sp1 = meterToScreen(minX, minY);
      const spW = (maxX - minX) * zoom;
      const spH = (maxY - minY) * zoom;

      const isSelected = selectedEntity?.type === 'staging_nursery';

      ctx.save();
      // Light terracotta/wooden deck nursery mat
      ctx.fillStyle = isSelected ? 'rgba(254, 243, 199, 0.92)' : 'rgba(247, 240, 228, 0.88)';
      ctx.fillRect(sp1.x, sp1.y, spW, spH);

      // Wooden slats texture
      ctx.strokeStyle = 'rgba(195, 168, 138, 0.4)';
      ctx.lineWidth = 1;
      for (let sy = minY + 0.6; sy < maxY; sy += 0.6) {
        const slat1 = meterToScreen(minX, sy);
        const slat2 = meterToScreen(maxX, sy);
        ctx.beginPath();
        ctx.moveTo(slat1.x, slat1.y);
        ctx.lineTo(slat2.x, slat2.y);
        ctx.stroke();
      }

      // Dashed border (selected = solid blue/amber, unselected = dashed amber)
      ctx.strokeStyle = isSelected ? '#2563eb' : '#d97706';
      if (!isSelected) {
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
      } else {
        ctx.lineWidth = 2.5;
      }
      ctx.strokeRect(sp1.x, sp1.y, spW, spH);
      ctx.setLineDash([]);

      // Label banner
      ctx.fillStyle = isSelected ? '#1d4ed8' : '#b45309';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`📦 Staging Nursery (${stagedCount} staged)`, sp1.x + 8, sp1.y + 16);
      ctx.font = '9px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = isSelected ? '#1e40af' : '#92400e';
      ctx.fillText(
        workflowMode === 'setup'
          ? '↔/↕ Drag to move or resize staging area'
          : 'Drag plants here to stage, or to beds to plant',
        sp1.x + 8,
        sp1.y + 28
      );
      ctx.restore();

      // Render selection handles if selected in setup or staging mode
      if (isSelected) {
        renderSelectionHandles(ctx, activeStagingCoords, meterToScreen, '#2563eb');
      }
    }

    // 3. Render Garden Beds & Hardscape Surfaces (Beds, Terrace Pavers, Teich Pond)
    if (showBeds) {
      beds.forEach((bed) => {
        let coords = getTransformedCoords(bed.polygon_coords, bed.id, 'bed', selectedEntity, draggedItem);
        if (!coords || coords.length < 3) return;

        ctx.beginPath();
        const start = meterToScreen(coords[0][0], coords[0][1]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < coords.length; i++) {
          const pt = meterToScreen(coords[i][0], coords[i][1]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        const isSelected = selectedEntity?.type === 'bed' && selectedEntity.id === bed.id;

        if (bed.surface_type === 'terrace') {
          // --- Light Warm Stone Paver Terrace ---
          ctx.fillStyle = '#dedad0';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#b3aba0';
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();

          // Interlocking paver pattern inside
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = 'rgba(165, 155, 145, 0.45)';
          ctx.lineWidth = 1;
          const minX = Math.min(...coords.map((p) => p[0]));
          const maxX = Math.max(...coords.map((p) => p[0]));
          const minY = Math.min(...coords.map((p) => p[1]));
          const maxY = Math.max(...coords.map((p) => p[1]));

          for (let gx = minX; gx <= maxX; gx += 0.8) {
            const p1 = meterToScreen(gx, minY);
            const p2 = meterToScreen(gx, maxY);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          for (let gy = minY; gy <= maxY; gy += 0.8) {
            const p1 = meterToScreen(minX, gy);
            const p2 = meterToScreen(maxX, gy);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          ctx.restore();
        } else if (bed.surface_type === 'pond') {
          // --- Teich (Pond & Swamp) - Impressionist Water-Lily Blue ---
          ctx.fillStyle = '#6ba3d6'; // Impressionist water blue from Image 2
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#457f9e'; // Shoreline
          ctx.lineWidth = isSelected ? 3.5 : 2.5;
          ctx.stroke();

          // Ripple rings
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1;
          const cx = coords.reduce((a, b) => a + b[0], 0) / coords.length;
          const cy = coords.reduce((a, b) => a + b[1], 0) / coords.length;
          const center = meterToScreen(cx, cy);
          for (let r = 8; r <= 36; r += 8) {
            ctx.beginPath();
            ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          // --- Soil Bed - Warm Earth Loam ---
          ctx.fillStyle = bed.zone === 'front_garden' ? '#855e3e' : '#734e32';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : 'rgba(125, 80, 50, 0.85)';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        }

        // Zone Label
        const centroidX = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
        const centroidY = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;
        const centerPt = meterToScreen(centroidX, centroidY);

        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(bed.name, centerPt.x, centerPt.y - 4);

        // If selected: render vertex and edge drag handles (only in Setup mode)
        if (isSelected && workflowMode === 'setup') {
          renderSelectionHandles(ctx, coords, meterToScreen, '#2563eb');
        }

        // Sunlight Heatmap Overlay
        if (showHeatmap && sunlightData) {
          const stat = sunlightData.beds.find((b) => b.bed_id === bed.id);
          if (stat) {
            ctx.font = '9px monospace';
            if (stat.classification === 'full_sun') {
              ctx.fillStyle = '#d97706';
              ctx.fillText(`☀️ ${stat.direct_sun_hours}h Full Sun`, centerPt.x, centerPt.y + 9);
            } else if (stat.classification === 'partial_shade') {
              ctx.fillStyle = '#15803d';
              ctx.fillText(`⛅ ${stat.direct_sun_hours}h Partial`, centerPt.x, centerPt.y + 9);
            } else {
              ctx.fillStyle = '#2563eb';
              ctx.fillText(`☁️ ${stat.direct_sun_hours}h Shade`, centerPt.x, centerPt.y + 9);
            }
          }
        }
      });
    }

    // 4. Render Real-Time Projected Shadows (Luminous Cool Indigo Shadow from Sunny Art)
    if (showShadows && shadows && shadows.length > 0) {
      shadows.forEach((shadow) => {
        if (!shadow.polygon_coords || shadow.polygon_coords.length < 3) return;

        ctx.beginPath();
        const start = meterToScreen(shadow.polygon_coords[0][0], shadow.polygon_coords[0][1]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < shadow.polygon_coords.length; i++) {
          const pt = meterToScreen(shadow.polygon_coords[i][0], shadow.polygon_coords[i][1]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        if (shadow.holes && shadow.holes.length > 0) {
          shadow.holes.forEach((hole) => {
            if (!hole || hole.length < 3) return;
            const hStart = meterToScreen(hole[0][0], hole[0][1]);
            ctx.moveTo(hStart.x, hStart.y);
            for (let i = 1; i < hole.length; i++) {
              const hPt = meterToScreen(hole[i][0], hole[i][1]);
              ctx.lineTo(hPt.x, hPt.y);
            }
            ctx.closePath();
          });
        }

        ctx.fillStyle = `rgba(35, 55, 85, ${0.28 * shadow.opacity})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(35, 55, 85, ${0.12 * shadow.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // 5. Render Physical Structures (House, Neighbor, Shed, Fences, Trees)
    if (showStructures) {
      obstacles.forEach((obs) => {
        let coords = getTransformedCoords(obs.polygon_coords, obs.id, 'structure', selectedEntity, draggedItem);
        if (!coords || coords.length < 3) return;

        ctx.beginPath();
        const start = meterToScreen(coords[0][0], coords[0][1]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < coords.length; i++) {
          const pt = meterToScreen(coords[i][0], coords[i][1]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        const isSelected = selectedEntity?.type === 'structure' && selectedEntity.id === obs.id;

        if (obs.type === 'house') {
          ctx.fillStyle = '#ded5c5';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#e5aa42' : '#7b8f9e';
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();
        } else if (obs.type === 'neighbor_house') {
          ctx.fillStyle = '#8f8da0';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#e5aa42' : '#69677b';
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();
        } else if (obs.type === 'shed') {
          ctx.fillStyle = '#bd804d';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#8c562b';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        } else if (obs.type === 'fence' || obs.type === 'wall') {
          ctx.fillStyle = '#a89a88';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#786958';
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();
        } else if (obs.type === 'tree') {
          ctx.fillStyle = 'rgba(65, 118, 54, 0.85)';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#7dbf68';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        } else if (obs.type === 'paved_sidewalk') {
          ctx.fillStyle = '#dedad0';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#a8a296';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        } else if (obs.type === 'table') {
          ctx.fillStyle = '#b88652';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#7d5229';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        } else if (obs.type === 'bench') {
          ctx.fillStyle = '#9e6738';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#613b19';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        } else if (obs.type === 'chair') {
          ctx.fillStyle = '#c28653';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#855127';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        } else if (obs.type === 'terrace_cover') {
          ctx.fillStyle = 'rgba(189, 168, 145, 0.65)';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#735e47';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        } else if (obs.type === 'compost_pile') {
          ctx.fillStyle = '#4a3728';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#2b1e15';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#a89a88';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#786958';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        }

        // Label
        const centroidX = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
        const centroidY = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;
        const centerPt = meterToScreen(centroidX, centroidY);

        const isLightBg = obs.type === 'house' || obs.type === 'paved_sidewalk' || obs.type === 'terrace_cover';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = isLightBg ? '#233527' : '#ffffff';
        ctx.fillText(obs.name, centerPt.x, centerPt.y - 3);
        ctx.font = '9px monospace';
        ctx.fillStyle = isLightBg ? '#576b5a' : '#fff6eb';
        ctx.fillText(`${obs.height_m}m tall`, centerPt.x, centerPt.y + 10);

        // If selected: render vertex and edge drag handles (only in Setup mode)
        if (isSelected && workflowMode === 'setup') {
          const accent = obs.type === 'house' || obs.type === 'neighbor_house' ? '#e5aa42' : '#2563eb';
          renderSelectionHandles(ctx, coords, meterToScreen, accent);
        }
      });
    }

    // 6. Render Blooming Plants & Pots
    if (showPlants && effectivePlants) {
      effectivePlants.forEach((p) => {
        let posX = p.x;
        let posY = p.y;

        if (draggedItem && draggedItem.type === 'plant' && draggedItem.id === p.placement_id) {
          const dx = draggedItem.currentMeter.x - draggedItem.startMeter.x;
          const dy = draggedItem.currentMeter.y - draggedItem.startMeter.y;
          posX += dx;
          posY += dy;
        }

        const pt = meterToScreen(posX, posY);
        const radiusPx = (p.spread_m / 2) * zoom;
        const isSelected = selectedEntity?.type === 'plant' && selectedEntity.id === p.placement_id;

        const placement = placements.find((pl) => pl.id === p.placement_id);
        const isStaged = !placement?.planted_date || placement?.container_type === 'staging';

        // Container Rim if in a pot
        if (p.container_type === 'pot' || p.container_type === 'terracotta_planter') {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(radiusPx + 4, 8), 0, Math.PI * 2);
          ctx.fillStyle = '#c85e38';
          ctx.fill();
          ctx.strokeStyle = '#f5c0a8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (p.container_type === 'pond_basket') {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(radiusPx + 3, 7), 0, Math.PI * 2);
          ctx.strokeStyle = '#457f9e';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Distinct dashed ring for staged plants awaiting commit
        if (isStaged) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(radiusPx + 4, 9), 0, Math.PI * 2);
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        // Plant Spread Circle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(radiusPx, 3), 0, Math.PI * 2);

        if (p.is_blooming) {
          const flowerColor = p.bloom_colors[0] || '#967BB6';
          ctx.fillStyle = flowerColor;
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#ffffff';
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();

          // Blooming aura
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(radiusPx + 3, 6), 0, Math.PI * 2);
          ctx.strokeStyle = `${flowerColor}99`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = isStaged ? '#4f7d4b' : '#407a4a';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#2563eb' : '#68a373';
          ctx.lineWidth = isSelected ? 3 : 1;
          ctx.stroke();
        }

        // Center dot
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.min(2, Math.max(radiusPx / 4, 1)), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // High-zoom plant identity & diameter label
        if (radiusPx >= 14) {
          ctx.font = radiusPx >= 28 ? 'bold 11px sans-serif' : 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
          ctx.shadowBlur = 3;
          ctx.fillText(p.common_name, pt.x, pt.y + 3);
          ctx.shadowBlur = 0;

          if (radiusPx >= 35) {
            ctx.font = '9px monospace';
            ctx.fillStyle = '#fef08a';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 2;
            const spreadLabel = p.spread_m >= 1 ? `${p.spread_m}m` : `${Math.round(p.spread_m * 100)}cm`;
            ctx.fillText(`Ø ${spreadLabel}`, pt.x, pt.y + 16);
            ctx.shadowBlur = 0;
          }
        }

        if (isStaged) {
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#b45309';
          ctx.fillText('🌱 Staged', pt.x, pt.y + Math.max(radiusPx, 4) + 10);
        }
      });
    }

    // 7. Render Multi-Point Irregular Polygon Drawing Preview
    if (polyVertices.length > 0) {
      ctx.beginPath();
      const first = meterToScreen(polyVertices[0][0], polyVertices[0][1]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < polyVertices.length; i++) {
        const pt = meterToScreen(polyVertices[i][0], polyVertices[i][1]);
        ctx.lineTo(pt.x, pt.y);
      }
      if (currentMouseMeter) {
        const mousePt = meterToScreen(currentMouseMeter.x, currentMouseMeter.y);
        ctx.lineTo(mousePt.x, mousePt.y);
      }

      ctx.strokeStyle = '#2d7a42';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw vertex handles
      polyVertices.forEach((v) => {
        const vp = meterToScreen(v[0], v[1]);
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#2d7a42';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      });
    }

    // 8. Render Quick Box Dragging Preview
    if (boxStartMeter && currentMouseMeter && activeTool.startsWith('draw_')) {
      const p1 = meterToScreen(boxStartMeter.x, boxStartMeter.y);
      const p2 = meterToScreen(currentMouseMeter.x, currentMouseMeter.y);
      const rx = Math.min(p1.x, p2.x);
      const ry = Math.min(p1.y, p2.y);
      const rw = Math.abs(p1.x - p2.x);
      const rh = Math.abs(p1.y - p2.y);

      const stroke =
        activeTool === 'draw_terrace'
          ? '#78716c'
          : activeTool === 'draw_bed'
          ? '#15803d'
          : activeTool === 'draw_fence'
          ? '#8c562b'
          : activeTool === 'draw_wall'
          ? '#786958'
          : '#487eb3';
      const fill =
        activeTool === 'draw_terrace'
          ? 'rgba(120, 113, 108, 0.22)'
          : activeTool === 'draw_bed'
          ? 'rgba(34, 197, 94, 0.2)'
          : activeTool === 'draw_fence'
          ? 'rgba(189, 128, 77, 0.25)'
          : activeTool === 'draw_wall'
          ? 'rgba(168, 154, 136, 0.25)'
          : 'rgba(72, 126, 179, 0.15)';

      ctx.strokeStyle = stroke;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.fillStyle = fill;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }
  }, [
    property,
    obstacles,
    beds,
    shadows,
    bloomPlants,
    sunlightData,
    zoom,
    pan,
    showShadows,
    showHeatmap,
    showPlants,
    showStructures,
    showBeds,
    selectedEntity,
    draggedItem,
    polyVertices,
    currentMouseMeter,
    boxStartMeter,
    activeTool,
    meterToScreen,
  ]);

  // Mouse / Touch Interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 0. Middle Click (mousewheel, button 1): Pan ONLY, never select or move elements
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Only primary (left) button can select, draw, or move elements
    if (e.button !== 0) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const meterPos = screenToMeter(e.clientX - rect.left, e.clientY - rect.top);

    if (activeTool === 'select') {
      // 1. GARDENING MODE: All layout and plant positions are locked!
      // Clicking a plant opens the care & maintenance inspector immediately.
      if (workflowMode === 'gardening') {
        const clickedPlant = effectivePlants.find((p) => {
          const dx = p.x - meterPos.x;
          const dy = p.y - meterPos.y;
          return Math.sqrt(dx * dx + dy * dy) <= Math.max(p.spread_m / 2, 8 / zoom);
        });
        if (clickedPlant) {
          const placement = placements.find((p) => p.id === clickedPlant.placement_id);
          if (placement) onSelectPlant(placement);
          return;
        }
        setSelectedEntity(null);
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        return;
      }

      // 2. PLANT STAGING MODE: Lot, structures, and beds are LOCKED!
      // ONLY plants can be selected and dragged between beds and staging nursery.
      if (workflowMode === 'staging') {
        const clickedPlant = effectivePlants.find((p) => {
          const dx = p.x - meterPos.x;
          const dy = p.y - meterPos.y;
          return Math.sqrt(dx * dx + dy * dy) <= Math.max(p.spread_m / 2, 8 / zoom);
        });

        if (clickedPlant) {
          setSelectedEntity({ type: 'plant', id: clickedPlant.placement_id });
          setDraggedItem({
            type: 'plant',
            id: clickedPlant.placement_id,
            startMeter: meterPos,
            currentMeter: meterPos,
            initialPlantPos: { x: clickedPlant.x, y: clickedPlant.y },
          });
          return;
        }

        // In staging mode, if not clicking a plant, check if clicked Staging Nursery
        if (pointInPoly(meterPos.x, meterPos.y, activeStagingCoords)) {
          setSelectedEntity({ type: 'staging_nursery', id: 0 });
          setDraggedItem({
            type: 'staging_nursery',
            id: 0,
            startMeter: meterPos,
            currentMeter: meterPos,
            initialCoords: activeStagingCoords,
          });
          return;
        }

        setSelectedEntity(null);
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        return;
      }

      // 3. SETUP & HARDSCAPE MODE: Lot, structures, and planting areas are editable.
      // Plants are LOCKED against dragging so user doesn't displace them while configuring structures.

      // 0. Check if clicked the Lot Resize Handle (at width_m, height_m)
      const lotDist = Math.sqrt(
        Math.pow(meterPos.x - property.width_m, 2) + Math.pow(meterPos.y - property.height_m, 2)
      );
      if (lotDist <= Math.min(0.5, 14 / zoom)) {
        setDraggedItem({
          type: 'lot_corner',
          startMeter: meterPos,
          currentMeter: meterPos,
          initialLotSize: { w: property.width_m, h: property.height_m },
        });
        return;
      }

      // 1. Check if clicking an Edge or Corner Handle on the currently selected structure, bed, or staging nursery
      if (
        selectedEntity &&
        (selectedEntity.type === 'structure' ||
          selectedEntity.type === 'bed' ||
          selectedEntity.type === 'staging_nursery')
      ) {
        let activeCoords: number[][] | undefined;
        if (selectedEntity.type === 'structure') {
          activeCoords = obstacles.find((o) => o.id === selectedEntity.id)?.polygon_coords;
        } else if (selectedEntity.type === 'bed') {
          activeCoords = beds.find((b) => b.id === selectedEntity.id)?.polygon_coords;
        } else if (selectedEntity.type === 'staging_nursery') {
          activeCoords = activeStagingCoords;
        }

        if (activeCoords && activeCoords.length >= 3) {
          const hitRadius = Math.min(0.5, 14 / zoom);
          const rectBounds = getRectBounds(activeCoords);

          if (rectBounds) {
            const midX = (rectBounds.minX + rectBounds.maxX) / 2;
            const midY = (rectBounds.minY + rectBounds.maxY) / 2;

            const edgeHandles: { side: EdgeSide; x: number; y: number }[] = [
              { side: 'top', x: midX, y: rectBounds.minY },
              { side: 'bottom', x: midX, y: rectBounds.maxY },
              { side: 'left', x: rectBounds.minX, y: midY },
              { side: 'right', x: rectBounds.maxX, y: midY },
            ];

            let closestEdge: { side: EdgeSide; dist: number } | null = null;
            for (const edge of edgeHandles) {
              const d = Math.hypot(meterPos.x - edge.x, meterPos.y - edge.y);
              if (d <= hitRadius && (!closestEdge || d < closestEdge.dist)) {
                closestEdge = { side: edge.side, dist: d };
              }
            }

            let closestCorner: { index: number; dist: number } | null = null;
            for (let i = 0; i < activeCoords.length; i++) {
              const [vx, vy] = activeCoords[i];
              const d = Math.hypot(meterPos.x - vx, meterPos.y - vy);
              if (d <= hitRadius && (!closestCorner || d < closestCorner.dist)) {
                closestCorner = { index: i, dist: d };
              }
            }

            if (closestCorner && (!closestEdge || closestCorner.dist <= closestEdge.dist)) {
              setDraggedItem({
                type: 'vertex',
                id: selectedEntity.id,
                vertexIndex: closestCorner.index,
                startMeter: meterPos,
                currentMeter: meterPos,
                initialCoords: activeCoords,
                initialBounds: rectBounds,
              });
              return;
            } else if (closestEdge) {
              setDraggedItem({
                type: 'edge_handle',
                id: selectedEntity.id,
                edgeSide: closestEdge.side,
                startMeter: meterPos,
                currentMeter: meterPos,
                initialCoords: activeCoords,
                initialBounds: rectBounds,
              });
              return;
            }
          } else {
            // Non-orthogonal shape (e.g. irregular polygon or 5+ point pond)
            let closestCorner: { index: number; dist: number } | null = null;
            for (let i = 0; i < activeCoords.length; i++) {
              const [vx, vy] = activeCoords[i];
              const d = Math.hypot(meterPos.x - vx, meterPos.y - vy);
              if (d <= hitRadius && (!closestCorner || d < closestCorner.dist)) {
                closestCorner = { index: i, dist: d };
              }
            }
            if (closestCorner) {
              setDraggedItem({
                type: 'vertex',
                id: selectedEntity.id,
                vertexIndex: closestCorner.index,
                startMeter: meterPos,
                currentMeter: meterPos,
                initialCoords: activeCoords,
              });
              return;
            }
          }
        }
      }

      // In setup mode, check if clicked the Staging Nursery Bay! (Checked before beds so it can be grabbed even if underneath a bed)
      if (pointInPoly(meterPos.x, meterPos.y, activeStagingCoords)) {
        setSelectedEntity({ type: 'staging_nursery', id: 0 });
        setDraggedItem({
          type: 'staging_nursery',
          id: 0,
          startMeter: meterPos,
          currentMeter: meterPos,
          initialCoords: activeStagingCoords,
        });
        return;
      }

      // In setup mode, check if clicked a structure
      const clickedObs = obstacles.find((obs) => {
        if (!obs.polygon_coords || obs.polygon_coords.length < 3) return false;
        return pointInPoly(meterPos.x, meterPos.y, obs.polygon_coords);
      });

      if (clickedObs) {
        setSelectedEntity({ type: 'structure', id: clickedObs.id });
        setDraggedItem({
          type: 'structure',
          id: clickedObs.id,
          startMeter: meterPos,
          currentMeter: meterPos,
          initialCoords: clickedObs.polygon_coords,
        });
        return;
      }

      // In setup mode, check if clicked a Bed, Pond (Teich), or Terrace!
      const clickedBed = beds.find((bed) => {
        if (!bed.polygon_coords || bed.polygon_coords.length < 3) return false;
        return pointInPoly(meterPos.x, meterPos.y, bed.polygon_coords);
      });

      if (clickedBed) {
        setSelectedEntity({ type: 'bed', id: clickedBed.id });
        setDraggedItem({
          type: 'bed',
          id: clickedBed.id,
          startMeter: meterPos,
          currentMeter: meterPos,
          initialCoords: clickedBed.polygon_coords,
        });
        return;
      }

      // Empty ground deselects and pans canvas
      setSelectedEntity(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (activeTool.startsWith('poly_')) {
      // Add vertex to irregular polygon
      setPolyVertices([...polyVertices, [round2(meterPos.x), round2(meterPos.y)]]);
    } else if (activeTool.startsWith('draw_')) {
      // Start box drag
      setBoxStartMeter(meterPos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const meterPos = screenToMeter(e.clientX - rect.left, e.clientY - rect.top);
    setCurrentMouseMeter(meterPos);

    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      setCanvasCursor('grabbing');
      return;
    }

    if (draggedItem) {
      setDraggedItem({ ...draggedItem, currentMeter: meterPos });

      if (draggedItem.type === 'edge_handle') {
        setCanvasCursor(
          draggedItem.edgeSide === 'top' || draggedItem.edgeSide === 'bottom'
            ? 'ns-resize'
            : 'ew-resize'
        );
      } else if (draggedItem.type === 'vertex') {
        if (
          draggedItem.initialBounds &&
          draggedItem.initialCoords &&
          draggedItem.vertexIndex !== undefined
        ) {
          const v = draggedItem.initialCoords[draggedItem.vertexIndex];
          const midX = (draggedItem.initialBounds.minX + draggedItem.initialBounds.maxX) / 2;
          const midY = (draggedItem.initialBounds.minY + draggedItem.initialBounds.maxY) / 2;
          const isTop = v[1] < midY;
          const isLeft = v[0] < midX;
          setCanvasCursor((isTop && isLeft) || (!isTop && !isLeft) ? 'nwse-resize' : 'nesw-resize');
        } else {
          setCanvasCursor('crosshair');
        }
      } else if (draggedItem.type === 'lot_corner') {
        setCanvasCursor('nwse-resize');
      } else if (
        draggedItem.type === 'plant' ||
        draggedItem.type === 'structure' ||
        draggedItem.type === 'bed' ||
        draggedItem.type === 'staging_nursery'
      ) {
        setCanvasCursor('move');
      }
      return;
    }

    // Check plant hover
    if (showPlants && effectivePlants) {
      const found = effectivePlants.find((p) => {
        const dx = p.x - meterPos.x;
        const dy = p.y - meterPos.y;
        return Math.sqrt(dx * dx + dy * dy) <= Math.max(p.spread_m / 2, 8 / zoom);
      });
      setHoveredPlant(found || null);
    }

    // Update hover cursor when not dragging
    if (activeTool !== 'select') {
      setCanvasCursor('crosshair');
      return;
    }

    // 0. Lot Resize Handle hover
    const lotDist = Math.hypot(meterPos.x - property.width_m, meterPos.y - property.height_m);
    if (lotDist <= Math.min(0.5, 14 / zoom)) {
      setCanvasCursor('nwse-resize');
      return;
    }

    // 1. Check hover over handles of selected entity
    if (selectedEntity) {
      let activeCoords: number[][] | undefined;
      if (selectedEntity.type === 'structure') {
        activeCoords = obstacles.find((o) => o.id === selectedEntity.id)?.polygon_coords;
      } else if (selectedEntity.type === 'bed') {
        activeCoords = beds.find((b) => b.id === selectedEntity.id)?.polygon_coords;
      } else if (selectedEntity.type === 'staging_nursery') {
        activeCoords = activeStagingCoords;
      }

      if (activeCoords && activeCoords.length >= 3) {
        const hitRadius = Math.min(0.5, 14 / zoom);
        const rectBounds = getRectBounds(activeCoords);

        if (rectBounds) {
          const midX = (rectBounds.minX + rectBounds.maxX) / 2;
          const midY = (rectBounds.minY + rectBounds.maxY) / 2;

          // Check corner handles first
          for (let i = 0; i < activeCoords.length; i++) {
            const [vx, vy] = activeCoords[i];
            if (Math.hypot(meterPos.x - vx, meterPos.y - vy) <= hitRadius) {
              const isTop = vy < midY;
              const isLeft = vx < midX;
              setCanvasCursor((isTop && isLeft) || (!isTop && !isLeft) ? 'nwse-resize' : 'nesw-resize');
              return;
            }
          }

          // Check edge handles
          const edgeHandles: { side: EdgeSide; x: number; y: number; cursor: string }[] = [
            { side: 'top', x: midX, y: rectBounds.minY, cursor: 'ns-resize' },
            { side: 'bottom', x: midX, y: rectBounds.maxY, cursor: 'ns-resize' },
            { side: 'left', x: rectBounds.minX, y: midY, cursor: 'ew-resize' },
            { side: 'right', x: rectBounds.maxX, y: midY, cursor: 'ew-resize' },
          ];

          for (const edge of edgeHandles) {
            if (Math.hypot(meterPos.x - edge.x, meterPos.y - edge.y) <= hitRadius) {
              setCanvasCursor(edge.cursor);
              return;
            }
          }
        } else {
          for (let i = 0; i < activeCoords.length; i++) {
            const [vx, vy] = activeCoords[i];
            if (Math.hypot(meterPos.x - vx, meterPos.y - vy) <= hitRadius) {
              setCanvasCursor('crosshair');
              return;
            }
          }
        }

        // Inside selected entity?
        if (pointInPoly(meterPos.x, meterPos.y, activeCoords)) {
          setCanvasCursor('move');
          return;
        }
      }
    }

    // 2. Check hover over plants
    if (showPlants && effectivePlants) {
      const overPlant = effectivePlants.some((p) => {
        const dx = p.x - meterPos.x;
        const dy = p.y - meterPos.y;
        return Math.hypot(dx, dy) <= Math.max(p.spread_m / 2, 8 / zoom);
      });
      if (overPlant) {
        setCanvasCursor('pointer');
        return;
      }
    }

    // 3. Check hover over structures
    if (showStructures) {
      const overObs = obstacles.some(
        (obs) =>
          obs.polygon_coords &&
          obs.polygon_coords.length >= 3 &&
          pointInPoly(meterPos.x, meterPos.y, obs.polygon_coords)
      );
      if (overObs) {
        setCanvasCursor('pointer');
        return;
      }
    }

    // 4. Check hover over beds
    if (showBeds) {
      const overBed = beds.some(
        (b) =>
          b.polygon_coords &&
          b.polygon_coords.length >= 3 &&
          pointInPoly(meterPos.x, meterPos.y, b.polygon_coords)
      );
      if (overBed) {
        setCanvasCursor('pointer');
        return;
      }
    }

    // 5. Check hover over Staging Nursery in setup or staging mode
    if (
      (workflowMode === 'setup' || workflowMode === 'staging') &&
      pointInPoly(meterPos.x, meterPos.y, activeStagingCoords)
    ) {
      setCanvasCursor('move');
      return;
    }

    setCanvasCursor('default');
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (draggedItem) {
      const dx = draggedItem.currentMeter.x - draggedItem.startMeter.x;
      const dy = draggedItem.currentMeter.y - draggedItem.startMeter.y;
      const movedDistance = Math.sqrt(dx * dx + dy * dy);
      const movedDistancePx = movedDistance * zoom;

      if (draggedItem.type === 'lot_corner' && draggedItem.initialLotSize) {
        // Finished resizing lot (require at least 3px drag)
        if (movedDistancePx >= 3) {
          const newW = Math.max(5, Math.round((draggedItem.initialLotSize.w + dx) * 10) / 10);
          const newH = Math.max(5, Math.round((draggedItem.initialLotSize.h + dy) * 10) / 10);
          onResizeLot(newW, newH);
        }
      } else if (
        draggedItem.type === 'edge_handle' &&
        draggedItem.initialCoords &&
        draggedItem.initialBounds &&
        draggedItem.edgeSide
      ) {
        if (movedDistancePx >= 3) {
          const newCoords = computeUpdatedRectCoords(
            draggedItem.initialCoords,
            draggedItem.initialBounds,
            'edge',
            { side: draggedItem.edgeSide },
            draggedItem.currentMeter
          ).map(([x, y]) => [round2(x), round2(y)]);

          if (selectedEntity?.type === 'structure') {
            onMoveStructure(selectedEntity.id, newCoords);
          } else if (selectedEntity?.type === 'bed') {
            onUpdateBed(selectedEntity.id, { polygon_coords: newCoords });
          } else if (selectedEntity?.type === 'staging_nursery' && onUpdateStagingArea) {
            const xs = newCoords.map((p) => p[0]);
            const ys = newCoords.map((p) => p[1]);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            onUpdateStagingArea(minX, minY, round2(maxX - minX), round2(maxY - minY));
          }
        }
      } else if (
        draggedItem.type === 'vertex' &&
        draggedItem.initialCoords &&
        draggedItem.vertexIndex !== undefined
      ) {
        if (movedDistancePx >= 3) {
          let newCoords: number[][];
          if (draggedItem.initialBounds) {
            newCoords = computeUpdatedRectCoords(
              draggedItem.initialCoords,
              draggedItem.initialBounds,
              'vertex',
              { vertexIndex: draggedItem.vertexIndex },
              draggedItem.currentMeter
            ).map(([x, y]) => [round2(x), round2(y)]);
          } else {
            newCoords = draggedItem.initialCoords.map((pt, idx) =>
              idx === draggedItem.vertexIndex
                ? [round2(draggedItem.currentMeter.x), round2(draggedItem.currentMeter.y)]
                : pt
            );
          }

          if (selectedEntity?.type === 'structure') {
            onMoveStructure(selectedEntity.id, newCoords);
          } else if (selectedEntity?.type === 'bed') {
            onUpdateBed(selectedEntity.id, { polygon_coords: newCoords });
          } else if (selectedEntity?.type === 'staging_nursery' && onUpdateStagingArea) {
            const xs = newCoords.map((p) => p[0]);
            const ys = newCoords.map((p) => p[1]);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            onUpdateStagingArea(minX, minY, round2(maxX - minX), round2(maxY - minY));
          }
        }
      } else if (movedDistancePx < 4) {
        // Was a click! (less than 4 screen pixels moved)
        if (draggedItem.type === 'structure') {
          const obs = obstacles.find((o) => o.id === draggedItem.id);
          if (obs) onSelectStructure(obs);
        } else if (draggedItem.type === 'bed') {
          const bed = beds.find((b) => b.id === draggedItem.id);
          if (bed) onSelectBed(bed);
        } else if (draggedItem.type === 'plant') {
          const placement = placements.find((p) => p.id === draggedItem.id);
          if (placement) onSelectPlant(placement);
        } else if (draggedItem.type === 'staging_nursery') {
          setSelectedEntity({ type: 'staging_nursery', id: 0 });
        }
      } else {
        // Was an intentional drag (>= 4 screen pixels moved)
        if (draggedItem.type === 'plant' && draggedItem.initialPlantPos && draggedItem.id) {
          const newX = round2(draggedItem.initialPlantPos.x + dx);
          const newY = round2(draggedItem.initialPlantPos.y + dy);
          const landingBed = findBedAtCoordinates(newX, newY);
          onMovePlant(draggedItem.id, newX, newY, landingBed?.id ?? null);
        } else if (draggedItem.type === 'structure' && draggedItem.initialCoords && draggedItem.id) {
          const newCoords = draggedItem.initialCoords.map((pt) => [
            round2(pt[0] + dx),
            round2(pt[1] + dy),
          ]);
          onMoveStructure(draggedItem.id, newCoords);
        } else if (draggedItem.type === 'bed' && draggedItem.initialCoords && draggedItem.id) {
          const newCoords = draggedItem.initialCoords.map((pt) => [
            round2(pt[0] + dx),
            round2(pt[1] + dy),
          ]);
          onUpdateBed(draggedItem.id, { polygon_coords: newCoords });
        } else if (draggedItem.type === 'staging_nursery' && draggedItem.initialCoords && onUpdateStagingArea) {
          const newCoords = draggedItem.initialCoords.map((pt) => [
            round2(pt[0] + dx),
            round2(pt[1] + dy),
          ]);
          const xs = newCoords.map((p) => p[0]);
          const ys = newCoords.map((p) => p[1]);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          onUpdateStagingArea(minX, minY, round2(maxX - minX), round2(maxY - minY));
        }
      }

      setDraggedItem(null);
      return;
    }

    // Finish box drag
    if (boxStartMeter && currentMouseMeter && activeTool.startsWith('draw_')) {
      const minX = Math.min(boxStartMeter.x, currentMouseMeter.x);
      const maxX = Math.max(boxStartMeter.x, currentMouseMeter.x);
      const minY = Math.min(boxStartMeter.y, currentMouseMeter.y);
      const maxY = Math.max(boxStartMeter.y, currentMouseMeter.y);

      const width = maxX - minX;
      const height = maxY - minY;

      const isLinear =
        activeTool === 'draw_fence' ||
        activeTool === 'draw_wall' ||
        activeTool === 'draw_sidewalk';
      const isValidSize = isLinear
        ? Math.max(width, height) >= 0.2 && Math.min(width, height) >= 0.04
        : Math.max(width, height) >= 0.25 && Math.min(width, height) >= 0.1;

      if (isValidSize) {
        const coords = [
          [round2(minX), round2(minY)],
          [round2(maxX), round2(minY)],
          [round2(maxX), round2(maxY)],
          [round2(minX), round2(maxY)],
        ];

        if (activeTool === 'draw_house') {
          onCreateStructure({ name: 'Main Residence', type: 'house', polygon_coords: coords, height_m: 6.5, opacity: 1.0 });
        } else if (activeTool === 'draw_neighbor') {
          onCreateStructure({ name: "Neighbor's House", type: 'neighbor_house', polygon_coords: coords, height_m: 8.0, opacity: 1.0 });
        } else if (activeTool === 'draw_shed') {
          onCreateStructure({ name: 'Garden Shed', type: 'shed', polygon_coords: coords, height_m: 2.6, opacity: 1.0 });
        } else if (activeTool === 'draw_fence') {
          onCreateStructure({ name: 'Boundary Fence', type: 'fence', polygon_coords: coords, height_m: 1.8, opacity: 0.9 });
        } else if (activeTool === 'draw_wall') {
          onCreateStructure({ name: 'Garden Wall', type: 'wall', polygon_coords: coords, height_m: 1.5, opacity: 1.0 });
        } else if (activeTool === 'draw_sidewalk') {
          onCreateStructure({ name: 'Paved Sidewalk', type: 'paved_sidewalk', polygon_coords: coords, height_m: 0.05, opacity: 1.0 });
        } else if (activeTool === 'draw_table') {
          onCreateStructure({ name: 'Outdoor Table', type: 'table', polygon_coords: coords, height_m: 0.75, opacity: 0.9 });
        } else if (activeTool === 'draw_bench') {
          onCreateStructure({ name: 'Garden Bench', type: 'bench', polygon_coords: coords, height_m: 0.85, opacity: 0.9 });
        } else if (activeTool === 'draw_chair') {
          onCreateStructure({ name: 'Garden Chair', type: 'chair', polygon_coords: coords, height_m: 0.85, opacity: 0.8 });
        } else if (activeTool === 'draw_terrace_cover') {
          onCreateStructure({ name: 'Terrace Cover / Pergola', type: 'terrace_cover', polygon_coords: coords, height_m: 2.8, opacity: 0.5 });
        } else if (activeTool === 'draw_compost') {
          onCreateStructure({ name: 'Compost Pile', type: 'compost_pile', polygon_coords: coords, height_m: 1.0, opacity: 1.0 });
        } else if (activeTool === 'draw_terrace') {
          onCreateBed({
            name: 'Paved Stone Terrace',
            zone: 'terrace',
            surface_type: 'terrace',
            polygon_coords: coords,
            color: '#64748b',
          });
        } else if (activeTool === 'draw_bed') {
          onCreateBed({
            name: 'Rectangular Planting Bed',
            zone: 'back_garden',
            surface_type: 'soil',
            polygon_coords: coords,
            color: '#5C3B1E',
          });
        }
      }

      setBoxStartMeter(null);
      setActiveTool('select');
    }
  };

  const handleDoubleClick = () => {
    // Finish irregular multi-point polygon
    if (polyVertices.length >= 3) {
      if (activeTool === 'poly_bed') {
        onCreateBed({
          name: 'Custom Planting Bed',
          zone: 'back_garden',
          surface_type: 'soil',
          polygon_coords: polyVertices,
          color: '#5C3B1E',
        });
      } else if (activeTool === 'poly_terrace') {
        onCreateBed({
          name: 'Paved Stone Terrace',
          zone: 'terrace',
          surface_type: 'terrace',
          polygon_coords: polyVertices,
          color: '#64748b',
        });
      } else if (activeTool === 'poly_pond') {
        onCreateBed({
          name: 'Gartenteich (Pond & Swamp)',
          zone: 'water',
          surface_type: 'pond',
          polygon_coords: polyVertices,
          color: '#0284c7',
        });
      }
    }
    setPolyVertices([]);
    setActiveTool('select');
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.max(4, Math.min(1000, zoom * zoomFactor));

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setPan({
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  // Get selected object info for on-canvas floating action toolbar
  const getSelectedInfo = () => {
    if (!selectedEntity) return null;
    if (selectedEntity.type === 'structure') {
      const obs = obstacles.find((o) => o.id === selectedEntity.id);
      if (!obs) return null;
      const coords = getTransformedCoords(obs.polygon_coords, obs.id, 'structure', selectedEntity, draggedItem);
      const xs = coords.map((p) => p[0]);
      const ys = coords.map((p) => p[1]);
      const w = Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10;
      const h = Math.round((Math.max(...ys) - Math.min(...ys)) * 10) / 10;
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const minY = Math.min(...ys);
      const pos = meterToScreen(cx, minY);
      return {
        name: obs.name,
        type: obs.type,
        dimensions: `${w}m × ${h}m (height ${obs.height_m}m)`,
        screenPos: pos,
        onEdit: () => onSelectStructure(obs),
      };
    } else if (selectedEntity.type === 'bed') {
      const bed = beds.find((b) => b.id === selectedEntity.id);
      if (!bed) return null;
      const coords = getTransformedCoords(bed.polygon_coords, bed.id, 'bed', selectedEntity, draggedItem);
      const xs = coords.map((p) => p[0]);
      const ys = coords.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const w = Math.round((maxX - minX) * 10) / 10;
      const h = Math.round((maxY - minY) * 10) / 10;
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const pos = meterToScreen(cx, minY);
      const isOrthogonal = getRectBounds(coords) !== null;
      return {
        name: bed.name,
        type: bed.surface_type,
        dimensions: `${w}m × ${h}m (${bed.surface_type})`,
        screenPos: pos,
        isOrthogonal,
        onEdit: () => onSelectBed(bed),
        onSquareUp: () => {
          const rectCoords = [
            [round2(minX), round2(minY)],
            [round2(maxX), round2(minY)],
            [round2(maxX), round2(maxY)],
            [round2(minX), round2(maxY)],
          ];
          onUpdateBed(bed.id, { polygon_coords: rectCoords });
        },
      };
    } else if (selectedEntity.type === 'staging_nursery') {
      const xs = activeStagingCoords.map((p) => p[0]);
      const ys = activeStagingCoords.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const w = Math.round((maxX - minX) * 10) / 10;
      const h = Math.round((maxY - minY) * 10) / 10;
      const cx = (minX + maxX) / 2;
      const pos = meterToScreen(cx, minY);
      return {
        name: '📦 Staging Nursery',
        type: 'staging_nursery',
        dimensions: `${w}m × ${h}m`,
        screenPos: pos,
        onReset: () => {
          if (onUpdateStagingArea) {
            onUpdateStagingArea(22.0, 9.0, 4.5, 4.0);
          }
        },
      };
    }
    return null;
  };

  const selectedInfo = getSelectedInfo();
  const scaleBar = getScaleBar(zoom);

  return (
    <div className="relative w-full h-full overflow-hidden bg-garden-bg select-none">
      {/* Left Vertical Floating Tool Palette */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-white/95 backdrop-blur-md border border-garden-border p-2 rounded-2xl shadow-xl text-xs text-garden-text w-44 max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-thin">
        {workflowMode === 'setup' && (
          <>
            {/* General Mode & Action */}
            <div className="flex flex-col gap-1 pb-1 border-b border-garden-border/80">
              <button
                onClick={() => {
                  setActiveTool('select');
                  setPolyVertices([]);
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg transition font-medium flex items-center gap-2 ${
                  activeTool === 'select'
                    ? 'bg-garden-sky text-white shadow-xs'
                    : 'text-garden-text hover:bg-garden-subtle'
                }`}
              >
                <Move className="w-3.5 h-3.5 shrink-0" />
                <span>Move & Edit</span>
              </button>

              {onUndo && (
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="Undo last movement (Cmd+Z or Ctrl+Z)"
                  className={`w-full px-2.5 py-1.5 rounded-lg transition font-medium flex items-center gap-2 text-[11px] ${
                    canUndo
                      ? 'text-garden-text hover:bg-garden-subtle cursor-pointer'
                      : 'text-garden-textMuted/40 cursor-not-allowed'
                  }`}
                >
                  <Undo2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Undo</span>
                </button>
              )}
            </div>

            {/* Grounds & Beds Section */}
            <div className="flex flex-col gap-1 pt-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-garden-textMuted px-1">
                Grounds & Beds
              </span>

              <button
                onClick={() => {
                  setActiveTool('draw_bed');
                  setPolyVertices([]);
                }}
                title="Drag to draw an orthogonal rectangular planting bed."
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_bed'
                    ? 'bg-emerald-200 text-emerald-900 border border-emerald-500 font-bold shadow-xs'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Sprout className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>+ Rect Bed</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('poly_bed');
                  setPolyVertices([]);
                }}
                title="Click points to draw an irregular planting bed. Double click to finish."
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'poly_bed'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-400 font-semibold'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Sprout className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>+ Poly Bed</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('draw_terrace');
                  setPolyVertices([]);
                }}
                title="Drag to draw a rectangular orthogonal stone paver terrace."
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_terrace'
                    ? 'bg-stone-300 text-stone-900 border border-stone-500 font-bold shadow-xs'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Grid className="w-3.5 h-3.5 text-stone-700 shrink-0" />
                <span>+ Rect Terrace</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('poly_terrace');
                  setPolyVertices([]);
                }}
                title="Click points to draw an irregular stone terrace with pavers. Double click to finish."
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'poly_terrace'
                    ? 'bg-stone-200 text-stone-800 border border-stone-400 font-semibold'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Grid className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span>+ Poly Terrace</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('poly_pond');
                  setPolyVertices([]);
                }}
                title="Click points to draw a Teich (pond & swamp margin). Double click to finish."
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'poly_pond'
                    ? 'bg-sky-100 text-sky-800 border border-sky-400 font-semibold'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Droplet className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>+ Teich</span>
              </button>
            </div>

            {/* Fencing & Structures Section */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-garden-border/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-garden-textMuted px-1">
                Fencing & Structures
              </span>

              <button
                onClick={() => {
                  setActiveTool('draw_fence');
                  setPolyVertices([]);
                }}
                title="Drag to draw a boundary fence."
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_fence'
                    ? 'bg-amber-100 text-amber-900 border border-amber-500 font-semibold shadow-xs'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Fence className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>+ Fence</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('draw_wall');
                  setPolyVertices([]);
                }}
                title="Drag to draw a stone wall."
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_wall'
                    ? 'bg-stone-200 text-stone-900 border border-stone-500 font-semibold shadow-xs'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <BrickWall className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                <span>+ Wall</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('draw_house');
                  setPolyVertices([]);
                }}
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_house'
                    ? 'bg-sky-100 text-sky-800 border border-sky-400 font-semibold'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Home className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>+ House</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('draw_shed');
                  setPolyVertices([]);
                }}
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_shed'
                    ? 'bg-amber-100 text-amber-800 border border-amber-400 font-semibold'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Warehouse className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>+ Shed</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('draw_sidewalk');
                  setPolyVertices([]);
                }}
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_sidewalk'
                    ? 'bg-stone-200 text-stone-800 border border-stone-400 font-semibold'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Footprints className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                <span>+ Sidewalk</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('draw_terrace_cover');
                  setPolyVertices([]);
                }}
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_terrace_cover'
                    ? 'bg-sky-100 text-sky-800 border border-sky-400 font-semibold'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Tent className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                <span>+ Pergola</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('draw_table');
                  setPolyVertices([]);
                }}
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_table'
                    ? 'bg-amber-100 text-amber-800 border border-amber-400 font-semibold'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Table className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>+ Table</span>
              </button>

              <button
                onClick={() => {
                  setActiveTool('draw_bench');
                  setPolyVertices([]);
                }}
                className={`w-full px-2 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  activeTool === 'draw_bench'
                    ? 'bg-amber-100 text-amber-800 border border-amber-400 font-semibold'
                    : 'text-garden-textMuted hover:bg-garden-subtle hover:text-garden-text'
                }`}
              >
                <Armchair className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                <span>+ Bench</span>
              </button>
            </div>
          </>
        )}

        {workflowMode === 'staging' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg font-semibold border border-emerald-200">
              <Sprout className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Plant Staging</span>
            </div>
            {onOpenCatalog && (
              <button
                onClick={onOpenCatalog}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-garden-text border border-garden-border flex items-center gap-2 transition font-medium"
              >
                <span>🌸</span>
                <span>Add from Catalog</span>
              </button>
            )}
            {onOpenInventory && (
              <button
                onClick={onOpenInventory}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-garden-text border border-garden-border flex items-center gap-2 transition font-medium"
              >
                <Sprout className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Inventory</span>
              </button>
            )}
            {onCommitStagedPlants && (
              <button
                onClick={onCommitStagedPlants}
                className="w-full px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-xs transition"
              >
                <span>🌱</span>
                <span>Plant & Commit</span>
              </button>
            )}
            {onUndo && (
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo last movement (Cmd+Z or Ctrl+Z)"
                className={`w-full px-2.5 py-1.5 rounded-lg transition flex items-center gap-2 text-[11px] ${
                  canUndo
                    ? 'bg-white hover:bg-emerald-50 text-garden-text border border-garden-border cursor-pointer shadow-2xs font-medium'
                    : 'text-garden-textMuted/40 border border-transparent cursor-not-allowed'
                }`}
              >
                <Undo2 className="w-3.5 h-3.5 shrink-0" />
                <span>Undo</span>
              </button>
            )}
          </div>
        )}

        {workflowMode === 'gardening' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-900 rounded-lg font-semibold border border-amber-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Gardening Mode</span>
            </div>
            <span className="text-garden-textMuted text-[11px] leading-relaxed">
              Click any plant to prune, feed, water, and inspect care history.
            </span>
          </div>
        )}
      </div>

      {/* Irregular Polygon In-Progress Instructions Banner */}
      {polyVertices.length > 0 && (
        <div className="absolute top-3 left-52 z-10 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl shadow-md flex items-center gap-3 text-xs text-emerald-900">
          <span>Click to add vertices ({polyVertices.length} points). Double-click to close polygon!</span>
          <button
            onClick={handleDoubleClick}
            className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold transition shadow-2xs"
          >
            Finish
          </button>
          <button
            onClick={() => setPolyVertices([])}
            className="text-emerald-700 hover:text-emerald-900 font-medium"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Floating Action Bar above Selected Structure or Bed */}
      {selectedInfo && (
        <div
          className="absolute z-20 bg-white/95 border border-sky-400 p-1.5 rounded-xl shadow-xl backdrop-blur flex items-center gap-2 text-xs"
          style={{
            left: Math.max(10, Math.min(window.innerWidth - 300, selectedInfo.screenPos.x - 120)),
            top: Math.max(70, selectedInfo.screenPos.y - 45),
          }}
        >
          <div className="font-bold text-garden-text flex items-center gap-1 px-1">
            <span>{selectedInfo.name}</span>
            <span className="text-[10px] text-garden-sky font-mono font-medium">({selectedInfo.dimensions})</span>
          </div>
          {selectedInfo.onEdit && (
            <button
              onClick={selectedInfo.onEdit}
              className="px-2 py-1 bg-garden-sky hover:bg-[#3d6e9f] text-white rounded-lg font-medium flex items-center gap-1 transition shadow-2xs"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit Dimensions</span>
            </button>
          )}
          {selectedInfo.onReset && (
            <button
              onClick={selectedInfo.onReset}
              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-medium flex items-center gap-1 transition shadow-2xs"
              title="Reset Staging Nursery to open lawn (x: 22m, y: 9m)"
            >
              <RefreshCw className="w-3 h-3 text-amber-600" />
              <span>Reset Pos</span>
            </button>
          )}
          {selectedInfo.onSquareUp && !selectedInfo.isOrthogonal && (
            <button
              onClick={selectedInfo.onSquareUp}
              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-medium flex items-center gap-1 transition shadow-2xs"
              title="Convert irregular polygon terrace/bed into a clean orthogonal rectangle"
            >
              <Square className="w-3 h-3 text-amber-600" />
              <span>Square Up</span>
            </button>
          )}
          {onDeleteEntity && selectedEntity && selectedEntity.type !== 'staging_nursery' && (
            <button
              onClick={() => {
                if (confirm(`Delete '${selectedInfo.name}'?`)) {
                  onDeleteEntity(selectedEntity.type, selectedEntity.id);
                  setSelectedEntity(null);
                }
              }}
              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-medium flex items-center gap-1 transition shadow-2xs"
              title="Delete this item"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}

      {/* Layer Visibility Toggles (Top Right) */}
      <div className="absolute top-3 right-32 z-10 flex items-center gap-1 bg-white/92 backdrop-blur-md border border-garden-border p-1.5 rounded-xl shadow-md text-xs">
        <button
          onClick={() => setShowShadows(!showShadows)}
          className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[11px] ${
            showShadows ? 'bg-garden-subtle text-amber-800 font-semibold border border-garden-border' : 'text-garden-textLight hover:text-garden-text'
          }`}
        >
          <span>🌑 Shadows</span>
        </button>

        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[11px] ${
            showHeatmap ? 'bg-amber-50 border border-amber-300 text-amber-800 font-semibold' : 'text-garden-textLight hover:text-garden-text'
          }`}
        >
          <span>☀️ Sun Heatmap</span>
        </button>

        <button
          onClick={() => setShowPlants(!showPlants)}
          className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[11px] ${
            showPlants ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 font-semibold' : 'text-garden-textLight hover:text-garden-text'
          }`}
        >
          <span>🌸 Plants & Pots</span>
        </button>

        <button
          onClick={() => setShowStructures(!showStructures)}
          className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[11px] ${
            showStructures ? 'bg-sky-50 border border-sky-300 text-sky-800 font-semibold' : 'text-garden-textLight hover:text-garden-text'
          }`}
        >
          <span>🏠 Structures</span>
        </button>
      </div>

      {/* Bottom Controls: Zoom Controls & Metric Scale Bar + Dragging Instruction Hint */}
      <div className="absolute bottom-3 left-52 z-10 flex flex-col items-start gap-2 pointer-events-none">
        {/* Zoom Controls & Metric Scale Bar */}
        <div className="pointer-events-auto flex items-center gap-2 bg-white/92 backdrop-blur-md border border-garden-border px-2.5 py-1.5 rounded-xl shadow-md text-xs text-garden-text">
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              title="Zoom out (scroll wheel down)"
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-garden-subtle text-garden-text font-bold transition cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-center font-semibold text-garden-text min-w-[54px]">
              {Math.round(zoom)} px/m
            </span>
            <button
              onClick={handleZoomIn}
              title="Zoom in (scroll wheel up, up to 1000 px/m)"
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-garden-subtle text-garden-text font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fitToLot}
              title="Fit entire property to view"
              className="ml-1 px-2 py-0.5 rounded text-[11px] text-garden-sky hover:bg-sky-50 font-semibold transition cursor-pointer border border-sky-200"
            >
              Fit
            </button>
          </div>

          <div className="h-4 w-px bg-garden-border" />

          {/* Dynamic Architectural Scale Ruler */}
          <div className="flex flex-col items-center px-1">
            <span className="text-[10px] font-mono font-medium text-garden-textMuted leading-none mb-0.5">
              {scaleBar.label}
            </span>
            <div
              className="h-1.5 border-l-2 border-r-2 border-b-2 border-stone-600 rounded-b-xs transition-all"
              style={{ width: `${Math.max(12, Math.round(scaleBar.widthPx))}px` }}
            />
          </div>
        </div>

        {/* Dragging Instruction Hint */}
        <div className="pointer-events-auto bg-white/90 backdrop-blur border border-garden-border px-3 py-1.5 rounded-xl text-[11px] text-garden-textMuted shadow-xs max-w-xl">
          {workflowMode === 'setup' && (
            <span>🏗️ <strong className="text-garden-text">Garden Setup:</strong> Click any structure, bed, or pond to select it. Drag side handles ↔/↕ or corner handles to resize. Drag bottom-right corner 📐 to resize lot!</span>
          )}
          {workflowMode === 'staging' && (
            <span>🌿 <strong className="text-garden-text">Plant Staging:</strong> Drag plants freely into beds or pots. Staged plants have dashed amber rings. Click "Plant & Commit" to finalize!</span>
          )}
          {workflowMode === 'gardening' && (
            <span>🌸 <strong className="text-garden-text">Gardening Mode:</strong> Click any plant to prune, fertilize, water, record growth, or enjoy blooms. Layout is locked.</span>
          )}
        </div>
      </div>

      {/* Main HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          try {
            const raw = e.dataTransfer.getData('text/plain');
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.type === 'plant' && data.id) {
              const rect = e.currentTarget.getBoundingClientRect();
              const meterPos = screenToMeter(e.clientX - rect.left, e.clientY - rect.top);
              const newX = round2(meterPos.x);
              const newY = round2(meterPos.y);
              const landingBed = findBedAtCoordinates(newX, newY);
              onMovePlant(data.id, newX, newY, landingBed?.id ?? null);
            }
          } catch (err) {
            console.error('Failed to handle canvas drop:', err);
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onAuxClick={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
        onMouseLeave={() => {
          setIsPanning(false);
          setDraggedItem(null);
          setCanvasCursor('default');
        }}
        style={{ cursor: isPanning ? 'grabbing' : canvasCursor }}
        className="w-full h-full"
      />
    </div>
  );
};
