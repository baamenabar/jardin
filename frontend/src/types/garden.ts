export interface Property {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  north_angle_deg: number;
  width_m: number;
  height_m: number;
  background_image?: string | null;
  background_scale_px_per_m?: number | null;
  background_offset_x: number;
  background_offset_y: number;
  staging_area_x?: number | null;
  staging_area_y?: number | null;
  staging_area_w?: number | null;
  staging_area_h?: number | null;
}

export type StructureType =
  | 'house'
  | 'neighbor_house'
  | 'shed'
  | 'fence'
  | 'wall'
  | 'tree'
  | 'paved_sidewalk'
  | 'table'
  | 'bench'
  | 'chair'
  | 'terrace_cover'
  | 'compost_pile'
  | 'custom';

export type WorkflowMode = 'setup' | 'staging' | 'gardening';

export interface Obstacle {
  id: number;
  property_id: number;
  name: string;
  type: StructureType;
  polygon_coords: number[][]; // [[x1, y1], [x2, y2], ...] in meters
  height_m: number;
  opacity: number;
}

export type SurfaceType = 'soil' | 'terrace' | 'pond' | 'lawn' | 'gravel' | 'planter';

export interface GardenBed {
  id: number;
  property_id: number;
  name: string;
  zone: 'front_garden' | 'back_garden' | 'terrace' | 'water' | 'patio' | 'side_yard' | 'other';
  surface_type: SurfaceType;
  polygon_coords: number[][];
  soil_type?: string | null;
  color: string;
}

export interface PlantSpecies {
  id: number;
  botanical_name: string;
  common_name: string;
  variety?: string | null;
  mature_height_m: number;
  mature_spread_m: number;
  bloom_start_month: number;
  bloom_end_month: number;
  bloom_colors: string[];
  foliage_type: string;
  sun_requirement: 'full_sun' | 'partial_shade' | 'full_shade';
  watering_needs: 'low' | 'medium' | 'high';
  hardiness_zone?: string | null;
  notes?: string | null;
}

export type ContainerType = 'ground' | 'pot' | 'terracotta_planter' | 'pond_basket' | 'staging';

export interface PlantPlacement {
  id: number;
  bed_id?: number | null;
  species_id: number;
  x: number;
  y: number;
  current_height_m?: number | null;
  current_spread_m?: number | null;
  container_type: ContainerType;
  planted_date?: string | null;
  last_pruned_date?: string | null;
  last_fertilized_date?: string | null;
  notes?: string | null;
  species?: PlantSpecies | null;
}

export interface SunPosition {
  azimuth_deg: number;
  elevation_deg: number;
  canvas_shadow_angle_deg: number;
  is_daylight: boolean;
}

export interface ShadowPolygon {
  obstacle_id: number;
  obstacle_name: string;
  polygon_coords: number[][];
  opacity: number;
  holes?: number[][][];
}

export interface InstantShadowsResponse {
  timestamp_iso: string;
  sun: SunPosition;
  shadows: ShadowPolygon[];
  total_shadow_area_m2: number;
}

export interface HourlySunExposure {
  time_str: string;
  elevation_deg: number;
  is_sunlit: boolean;
}

export interface BedSunlightStat {
  bed_id: number;
  bed_name: string;
  zone: string;
  surface_type: SurfaceType;
  direct_sun_hours: number;
  classification: 'full_sun' | 'partial_shade' | 'full_shade';
  hourly_curve: HourlySunExposure[];
}

export interface DailySunlightResponse {
  date_iso: string;
  sunrise_time?: string | null;
  sunset_time?: string | null;
  daylight_hours: number;
  beds: BedSunlightStat[];
}

export interface PlantBloomState {
  placement_id: number;
  species_id: number;
  bed_id?: number | null;
  botanical_name: string;
  common_name: string;
  variety?: string | null;
  x: number;
  y: number;
  spread_m: number;
  height_m: number;
  is_blooming: boolean;
  bloom_colors: string[];
  foliage_type: string;
  bloom_start_month: number;
  bloom_end_month: number;
  container_type: ContainerType;
  planted_date?: string | null;
  last_pruned_date?: string | null;
  last_fertilized_date?: string | null;
  notes?: string | null;
}

export interface MonthlyBloomResponse {
  month: number;
  month_name: string;
  total_plants: number;
  blooming_plants_count: number;
  plants: PlantBloomState[];
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}
