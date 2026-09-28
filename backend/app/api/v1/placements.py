import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models.placement import PlantPlacement
from app.models.plant import PlantSpecies
from app.schemas.entities import (
    PlantPlacementCreate,
    PlantPlacementRead,
    PlantPlacementUpdate,
    PlantSpeciesRead,
)

router = APIRouter(prefix="/placements", tags=["Plant Placements & Care"])


def _to_read_dto(placement: PlantPlacement, species: Optional[PlantSpecies]) -> PlantPlacementRead:
    species_dto = None
    if species:
        try:
            colors = json.loads(species.bloom_colors)
        except Exception:
            colors = ["#967BB6"]
        species_dto = PlantSpeciesRead(
            id=species.id,
            botanical_name=species.botanical_name,
            common_name=species.common_name,
            variety=species.variety,
            mature_height_m=species.mature_height_m,
            mature_spread_m=species.mature_spread_m,
            bloom_start_month=species.bloom_start_month,
            bloom_end_month=species.bloom_end_month,
            bloom_colors=colors,
            foliage_type=species.foliage_type,
            sun_requirement=species.sun_requirement,
            watering_needs=species.watering_needs,
            hardiness_zone=species.hardiness_zone,
            notes=species.notes,
            created_at=species.created_at,
            updated_at=species.updated_at,
        )

    return PlantPlacementRead(
        id=placement.id,
        bed_id=placement.bed_id,
        species_id=placement.species_id,
        x=placement.x,
        y=placement.y,
        current_height_m=placement.current_height_m,
        current_spread_m=placement.current_spread_m,
        container_type=placement.container_type or "ground",
        planted_date=placement.planted_date,
        last_pruned_date=placement.last_pruned_date,
        last_fertilized_date=placement.last_fertilized_date,
        notes=placement.notes,
        species=species_dto,
        created_at=placement.created_at,
        updated_at=placement.updated_at,
    )


@router.get("", response_model=List[PlantPlacementRead])
def list_placements(
    bed_id: Optional[int] = Query(default=None, description="Filter placements by bed ID"),
    session: Session = Depends(get_session),
):
    """List all placed or staged plants, joined with species metadata and maintenance dates."""
    query = select(PlantPlacement, PlantSpecies).join(
        PlantSpecies, PlantPlacement.species_id == PlantSpecies.id
    )
    if bed_id is not None:
        query = query.where(PlantPlacement.bed_id == bed_id)

    results = session.exec(query).all()
    return [_to_read_dto(placement, species) for placement, species in results]


@router.post("", response_model=PlantPlacementRead, status_code=201)
def create_placement(placement_in: PlantPlacementCreate, session: Session = Depends(get_session)):
    """Place or stage a plant in a bed or planter container."""
    species = session.get(PlantSpecies, placement_in.species_id)
    if not species:
        raise HTTPException(status_code=404, detail="Plant species not found")

    placement = PlantPlacement(
        bed_id=placement_in.bed_id,
        species_id=placement_in.species_id,
        x=placement_in.x,
        y=placement_in.y,
        current_height_m=placement_in.current_height_m or species.mature_height_m,
        current_spread_m=placement_in.current_spread_m or species.mature_spread_m,
        container_type=placement_in.container_type or "ground",
        planted_date=placement_in.planted_date or datetime.now().strftime("%Y-%m-%d"),
        last_pruned_date=placement_in.last_pruned_date,
        last_fertilized_date=placement_in.last_fertilized_date,
        notes=placement_in.notes,
    )
    session.add(placement)
    session.commit()
    session.refresh(placement)

    return _to_read_dto(placement, species)


@router.put("/{placement_id}", response_model=PlantPlacementRead)
def update_placement(
    placement_id: int,
    placement_in: PlantPlacementUpdate,
    session: Session = Depends(get_session),
):
    """Move a plant to new (x, y) coordinates, move between beds, or log pruning/fertilizer."""
    placement = session.get(PlantPlacement, placement_id)
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found")

    update_dict = placement_in.model_dump(exclude_unset=True)
    for key, val in update_dict.items():
        setattr(placement, key, val)

    placement.updated_at = datetime.now(timezone.utc)
    session.add(placement)
    session.commit()
    session.refresh(placement)

    species = session.get(PlantSpecies, placement.species_id)
    return _to_read_dto(placement, species)


@router.delete("/{placement_id}", status_code=204)
def remove_placement(placement_id: int, session: Session = Depends(get_session)):
    """Remove / dig up a plant placement from the garden."""
    placement = session.get(PlantPlacement, placement_id)
    if not placement:
        raise HTTPException(status_code=404, detail="Placement not found")
    session.delete(placement)
    session.commit()
    return None
