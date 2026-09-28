from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ---------------- Property Schemas ----------------
class PropertyBase(BaseModel):
    name: str = "My Garden"
    latitude: float = 40.4168
    longitude: float = -3.7038
    timezone: str = "Europe/Madrid"
    north_angle_deg: float = Field(
        default=0.0,
        description="Clockwise rotation from canvas +Y (up) to True North",
    )
    width_m: float = 30.0
    height_m: float = 40.0
    background_image: Optional[str] = None
    background_scale_px_per_m: Optional[float] = None
    background_offset_x: float = 0.0
    background_offset_y: float = 0.0
    staging_area_x: Optional[float] = None
    staging_area_y: Optional[float] = None
    staging_area_w: Optional[float] = None
    staging_area_h: Optional[float] = None


class PropertyCreate(PropertyBase):
    pass


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    north_angle_deg: Optional[float] = None
    width_m: Optional[float] = None
    height_m: Optional[float] = None
    background_image: Optional[str] = None
    background_scale_px_per_m: Optional[float] = None
    background_offset_x: Optional[float] = None
    background_offset_y: Optional[float] = None
    staging_area_x: Optional[float] = None
    staging_area_y: Optional[float] = None
    staging_area_w: Optional[float] = None
    staging_area_h: Optional[float] = None


class PropertyRead(PropertyBase):
    id: int
    created_at: datetime
    updated_at: datetime


# ---------------- Obstacle Schemas ----------------
class ObstacleBase(BaseModel):
    name: str
    type: str = Field(
        default="house",
        description="house, neighbor_house, shed, fence, wall, tree, paved_sidewalk, table, bench, chair, terrace_cover, compost_pile, custom",
    )
    polygon_coords: List[List[float]] = Field(
        description="2D vertices [[x1, y1], [x2, y2], ...] in meters"
    )
    height_m: float = 3.0
    opacity: float = 1.0


class ObstacleCreate(ObstacleBase):
    property_id: Optional[int] = None


class ObstacleUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    polygon_coords: Optional[List[List[float]]] = None
    height_m: Optional[float] = None
    opacity: Optional[float] = None


class ObstacleRead(ObstacleBase):
    id: int
    property_id: int
    created_at: datetime
    updated_at: datetime


# ---------------- Garden Bed Schemas ----------------
class GardenBedBase(BaseModel):
    name: str
    zone: str = Field(default="front_garden", description="front_garden, back_garden, terrace, water, patio, side_yard, other")
    surface_type: str = Field(
        default="soil",
        description="soil (planting bed), terrace (gray stone pavers), pond (teich/water), gravel, lawn, planter",
    )
    polygon_coords: List[List[float]] = Field(
        description="2D vertices [[x1, y1], [x2, y2], ...] in meters"
    )
    soil_type: Optional[str] = None
    color: str = "#8B5A2B"


class GardenBedCreate(GardenBedBase):
    property_id: Optional[int] = None


class GardenBedUpdate(BaseModel):
    name: Optional[str] = None
    zone: Optional[str] = None
    surface_type: Optional[str] = None
    polygon_coords: Optional[List[List[float]]] = None
    soil_type: Optional[str] = None
    color: Optional[str] = None


class GardenBedRead(GardenBedBase):
    id: int
    property_id: int
    created_at: datetime
    updated_at: datetime


# ---------------- Plant Species Schemas ----------------
class PlantSpeciesBase(BaseModel):
    botanical_name: str
    common_name: str
    variety: Optional[str] = None
    mature_height_m: float = 0.6
    mature_spread_m: float = 0.6
    bloom_start_month: int = Field(default=6, ge=1, le=12)
    bloom_end_month: int = Field(default=8, ge=1, le=12)
    bloom_colors: List[str] = Field(default=["#967BB6"])
    foliage_type: str = "perennial"
    sun_requirement: str = "full_sun"
    watering_needs: str = "low"
    hardiness_zone: Optional[str] = None
    notes: Optional[str] = None


class PlantSpeciesCreate(PlantSpeciesBase):
    pass


class PlantSpeciesUpdate(BaseModel):
    botanical_name: Optional[str] = None
    common_name: Optional[str] = None
    variety: Optional[str] = None
    mature_height_m: Optional[float] = None
    mature_spread_m: Optional[float] = None
    bloom_start_month: Optional[int] = Field(default=None, ge=1, le=12)
    bloom_end_month: Optional[int] = Field(default=None, ge=1, le=12)
    bloom_colors: Optional[List[str]] = None
    foliage_type: Optional[str] = None
    sun_requirement: Optional[str] = None
    watering_needs: Optional[str] = None
    hardiness_zone: Optional[str] = None
    notes: Optional[str] = None


class PlantSpeciesRead(PlantSpeciesBase):
    id: int
    created_at: datetime
    updated_at: datetime


# ---------------- Plant Placement (Instance) Schemas ----------------
class PlantPlacementBase(BaseModel):
    bed_id: Optional[int] = None
    species_id: int
    x: float = 0.0
    y: float = 0.0
    current_height_m: Optional[float] = None
    current_spread_m: Optional[float] = None
    container_type: str = "ground"
    planted_date: Optional[str] = None
    last_pruned_date: Optional[str] = None
    last_fertilized_date: Optional[str] = None
    notes: Optional[str] = None


class PlantPlacementCreate(PlantPlacementBase):
    pass


class PlantPlacementUpdate(BaseModel):
    bed_id: Optional[int] = None
    species_id: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None
    current_height_m: Optional[float] = None
    current_spread_m: Optional[float] = None
    container_type: Optional[str] = None
    planted_date: Optional[str] = None
    last_pruned_date: Optional[str] = None
    last_fertilized_date: Optional[str] = None
    notes: Optional[str] = None


class PlantPlacementRead(PlantPlacementBase):
    id: int
    species: Optional[PlantSpeciesRead] = None
    created_at: datetime
    updated_at: datetime
