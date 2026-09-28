from typing import List, Optional
from pydantic import BaseModel, Field


class SunPosition(BaseModel):
    azimuth_deg: float = Field(description="Sun azimuth in degrees clockwise from True North (0-360)")
    elevation_deg: float = Field(description="Sun elevation/altitude above horizon in degrees (-90 to +90)")
    canvas_shadow_angle_deg: float = Field(
        description="Angle in degrees on the canvas along which shadows are projected"
    )
    is_daylight: bool


class ShadowPolygon(BaseModel):
    obstacle_id: int
    obstacle_name: str
    polygon_coords: List[List[float]] = Field(
        description="2D polygon coordinates of the projected shadow [[x1, y1], ...]"
    )
    opacity: float
    holes: Optional[List[List[List[float]]]] = Field(
        default=None,
        description="Optional list of interior hole rings [[x1, y1], ...]",
    )


class InstantShadowsResponse(BaseModel):
    timestamp_iso: str = Field(default="")
    sun: SunPosition
    shadows: List[ShadowPolygon]
    total_shadow_area_m2: float


class HourlySunExposure(BaseModel):
    time_str: str
    elevation_deg: float
    is_sunlit: bool


class BedSunlightStat(BaseModel):
    bed_id: int
    bed_name: str
    zone: str
    surface_type: str = "soil"
    direct_sun_hours: float = Field(description="Estimated direct sun hours on the target date")
    classification: str = Field(description="full_sun (>=6h), partial_shade (3-6h), full_shade (<3h)")
    hourly_curve: List[HourlySunExposure]


class DailySunlightResponse(BaseModel):
    date_iso: str
    sunrise_time: Optional[str]
    sunset_time: Optional[str]
    daylight_hours: float
    beds: List[BedSunlightStat]


class PlantBloomState(BaseModel):
    placement_id: int
    species_id: int
    bed_id: Optional[int] = None
    botanical_name: str
    common_name: str
    variety: Optional[str]
    x: float
    y: float
    spread_m: float
    height_m: float
    is_blooming: bool
    bloom_colors: List[str]
    foliage_type: str
    bloom_start_month: int
    bloom_end_month: int
    container_type: str = "ground"
    planted_date: Optional[str] = None
    last_pruned_date: Optional[str] = None
    last_fertilized_date: Optional[str] = None
    notes: Optional[str] = None


class MonthlyBloomResponse(BaseModel):
    month: int = Field(ge=1, le=12)
    month_name: str
    total_plants: int
    blooming_plants_count: int
    plants: List[PlantBloomState]
