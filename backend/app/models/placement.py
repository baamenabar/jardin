from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class PlantPlacement(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    bed_id: Optional[int] = Field(default=None, foreign_key="gardenbed.id", index=True)
    species_id: int = Field(foreign_key="plantspecies.id", index=True)
    x: float = Field(default=0.0, description="X coordinate in meters relative to property origin")
    y: float = Field(default=0.0, description="Y coordinate in meters relative to property origin")
    current_height_m: Optional[float] = Field(
        default=None,
        description="Current measured height (defaults to mature height if None)",
    )
    current_spread_m: Optional[float] = Field(
        default=None,
        description="Current measured spread (defaults to mature spread if None)",
    )
    container_type: str = Field(
        default="ground",
        description="Placement medium: ground, pot, terracotta_planter, pond_basket, staging",
    )
    planted_date: Optional[str] = Field(default=None, description="ISO date YYYY-MM-DD")
    last_pruned_date: Optional[str] = Field(default=None, description="ISO date YYYY-MM-DD of last pruning")
    last_fertilized_date: Optional[str] = Field(default=None, description="ISO date YYYY-MM-DD of last fertilizer")
    notes: Optional[str] = Field(default=None, description="Care notes, health status, or specimen nickname")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
