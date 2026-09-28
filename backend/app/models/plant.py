from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class PlantSpecies(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    botanical_name: str = Field(index=True, description="E.g. Lavandula angustifolia")
    common_name: str = Field(index=True, description="E.g. English Lavender")
    variety: Optional[str] = Field(default=None, index=True, description="E.g. Hidcote")
    mature_height_m: float = Field(default=0.6, description="Mature height in meters")
    mature_spread_m: float = Field(default=0.6, description="Mature canopy spread/diameter in meters")
    bloom_start_month: int = Field(default=6, ge=1, le=12, description="Month bloom begins (1-12)")
    bloom_end_month: int = Field(default=8, ge=1, le=12, description="Month bloom ends (1-12)")
    bloom_colors: str = Field(
        default='["#967BB6"]',
        description="JSON encoded list of flower hex colors, e.g. ['#967BB6', '#8A2BE2']",
    )
    foliage_type: str = Field(
        default="perennial",
        description="evergreen, deciduous, perennial, annual, grass, shrub, tree",
    )
    sun_requirement: str = Field(
        default="full_sun",
        description="full_sun (>=6h), partial_shade (3-6h), full_shade (<3h)",
    )
    watering_needs: str = Field(
        default="low",
        description="low, medium, high",
    )
    hardiness_zone: Optional[str] = Field(default=None, description="E.g. USDA Zone 8b")
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
