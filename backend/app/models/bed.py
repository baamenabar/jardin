from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class GardenBed(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    property_id: int = Field(foreign_key="property.id", index=True)
    name: str = Field(description="Name of the zone, e.g. Front Border, Teich / Pond, Stone Terrace")
    zone: str = Field(
        default="front_garden",
        description="Zone identifier: front_garden, back_garden, side_yard, patio, terrace, water, other",
        index=True,
    )
    surface_type: str = Field(
        default="soil",
        description="Surface rendering: soil (bed), terrace (gray stone pavers), pond (teich/water), gravel, lawn, planter",
    )
    polygon_coords: str = Field(
        description="JSON encoded list of 2D coordinates [[x1, y1], [x2, y2], ...] in meters",
    )
    soil_type: Optional[str] = Field(default=None, description="clay, sandy, loam, aquatic, gravel, etc.")
    color: str = Field(default="#8B5A2B", description="Hex color or styling hint")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
