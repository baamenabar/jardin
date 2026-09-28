from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class Property(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="My Garden", index=True)
    latitude: float = Field(default=40.4168)
    longitude: float = Field(default=-3.7038)
    timezone: str = Field(default="Europe/Madrid")
    north_angle_deg: float = Field(
        default=0.0,
        description="Clockwise rotation angle in degrees from canvas +Y (up) to True North",
    )
    width_m: float = Field(default=30.0, description="Total property width in meters")
    height_m: float = Field(default=40.0, description="Total property height in meters")
    background_image: Optional[str] = Field(default=None)
    background_scale_px_per_m: Optional[float] = Field(default=None)
    background_offset_x: float = Field(default=0.0)
    background_offset_y: float = Field(default=0.0)
    staging_area_x: Optional[float] = Field(default=None, description="X coordinate of plant staging nursery in meters")
    staging_area_y: Optional[float] = Field(default=None, description="Y coordinate of plant staging nursery in meters")
    staging_area_w: Optional[float] = Field(default=None, description="Width of plant staging nursery in meters")
    staging_area_h: Optional[float] = Field(default=None, description="Height of plant staging nursery in meters")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
