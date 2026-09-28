from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class Obstacle(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    property_id: int = Field(foreign_key="property.id", index=True)
    name: str = Field(description="E.g. Main House, North Fence, Garage, Oak Tree")
    type: str = Field(
        default="house",
        description="Type of obstacle: house, fence, wall, shed, tree, custom",
    )
    polygon_coords: str = Field(
        description="JSON encoded list of 2D coordinates [[x1, y1], [x2, y2], ...] in meters",
    )
    height_m: float = Field(
        default=3.0,
        description="Height of the obstacle in meters for shadow projection",
    )
    opacity: float = Field(
        default=1.0,
        description="Shadow opacity (1.0 = solid structure, 0.6 = dappled tree canopy)",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
