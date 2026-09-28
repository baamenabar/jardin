import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, col

from app.database import get_session
from app.models.plant import PlantSpecies
from app.schemas.entities import (
    PlantSpeciesCreate,
    PlantSpeciesRead,
    PlantSpeciesUpdate,
)
from app.services.enrichment import enrich_plant_with_llm

router = APIRouter(prefix="/plants", tags=["Plant Catalog"])


class EnrichRequest(BaseModel):
    query: str
    auto_save: bool = False


@router.get("", response_model=List[PlantSpeciesRead])
def list_plants(
    query: Optional[str] = Query(default=None, description="Search botanical or common name"),
    bloom_month: Optional[int] = Query(default=None, ge=1, le=12, description="Filter by active bloom month"),
    sun_requirement: Optional[str] = Query(default=None, description="full_sun, partial_shade, full_shade"),
    session: Session = Depends(get_session),
):
    """Search and list plant species in the catalog."""
    statement = select(PlantSpecies)
    if query:
        statement = statement.where(
            (col(PlantSpecies.botanical_name).ilike(f"%{query}%"))
            | (col(PlantSpecies.common_name).ilike(f"%{query}%"))
            | (col(PlantSpecies.variety).ilike(f"%{query}%"))
        )
    if sun_requirement:
        statement = statement.where(PlantSpecies.sun_requirement == sun_requirement)

    plants = session.exec(statement).all()
    results = []
    for p in plants:
        # Check bloom month if provided
        if bloom_month is not None:
            if p.bloom_start_month <= p.bloom_end_month:
                if not (p.bloom_start_month <= bloom_month <= p.bloom_end_month):
                    continue
            else:
                if not (bloom_month >= p.bloom_start_month or bloom_month <= p.bloom_end_month):
                    continue

        try:
            colors = json.loads(p.bloom_colors)
        except Exception:
            colors = ["#967BB6"]

        results.append(
            PlantSpeciesRead(
                id=p.id,
                botanical_name=p.botanical_name,
                common_name=p.common_name,
                variety=p.variety,
                mature_height_m=p.mature_height_m,
                mature_spread_m=p.mature_spread_m,
                bloom_start_month=p.bloom_start_month,
                bloom_end_month=p.bloom_end_month,
                bloom_colors=colors,
                foliage_type=p.foliage_type,
                sun_requirement=p.sun_requirement,
                watering_needs=p.watering_needs,
                hardiness_zone=p.hardiness_zone,
                notes=p.notes,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )
    return results


@router.post("", response_model=PlantSpeciesRead, status_code=201)
def create_plant(plant_in: PlantSpeciesCreate, session: Session = Depends(get_session)):
    """Add a new plant species to the catalog."""
    plant = PlantSpecies(
        botanical_name=plant_in.botanical_name,
        common_name=plant_in.common_name,
        variety=plant_in.variety,
        mature_height_m=plant_in.mature_height_m,
        mature_spread_m=plant_in.mature_spread_m,
        bloom_start_month=plant_in.bloom_start_month,
        bloom_end_month=plant_in.bloom_end_month,
        bloom_colors=json.dumps(plant_in.bloom_colors),
        foliage_type=plant_in.foliage_type,
        sun_requirement=plant_in.sun_requirement,
        watering_needs=plant_in.watering_needs,
        hardiness_zone=plant_in.hardiness_zone,
        notes=plant_in.notes,
    )
    session.add(plant)
    session.commit()
    session.refresh(plant)

    return PlantSpeciesRead(
        id=plant.id,
        botanical_name=plant.botanical_name,
        common_name=plant.common_name,
        variety=plant.variety,
        mature_height_m=plant.mature_height_m,
        mature_spread_m=plant.mature_spread_m,
        bloom_start_month=plant.bloom_start_month,
        bloom_end_month=plant.bloom_end_month,
        bloom_colors=plant_in.bloom_colors,
        foliage_type=plant.foliage_type,
        sun_requirement=plant.sun_requirement,
        watering_needs=plant.watering_needs,
        hardiness_zone=plant.hardiness_zone,
        notes=plant.notes,
        created_at=plant.created_at,
        updated_at=plant.updated_at,
    )


@router.post("/enrich", response_model=PlantSpeciesCreate)
async def enrich_plant(request: EnrichRequest, session: Session = Depends(get_session)):
    """Use Nous Hermes / LLM to automatically generate botanical metadata for a plant."""
    enriched = await enrich_plant_with_llm(query=request.query)
    if not enriched:
        raise HTTPException(status_code=500, detail="Failed to enrich botanical data")

    if request.auto_save:
        create_plant(enriched, session=session)

    return enriched


@router.put("/{plant_id}", response_model=PlantSpeciesRead)
def update_plant(
    plant_id: int,
    plant_in: PlantSpeciesUpdate,
    session: Session = Depends(get_session),
):
    """Update a plant species record."""
    plant = session.get(PlantSpecies, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    update_dict = plant_in.model_dump(exclude_unset=True)
    if "bloom_colors" in update_dict and update_dict["bloom_colors"] is not None:
        plant.bloom_colors = json.dumps(update_dict.pop("bloom_colors"))

    for key, val in update_dict.items():
        setattr(plant, key, val)

    plant.updated_at = datetime.now(timezone.utc)
    session.add(plant)
    session.commit()
    session.refresh(plant)

    return PlantSpeciesRead(
        id=plant.id,
        botanical_name=plant.botanical_name,
        common_name=plant.common_name,
        variety=plant.variety,
        mature_height_m=plant.mature_height_m,
        mature_spread_m=plant.mature_spread_m,
        bloom_start_month=plant.bloom_start_month,
        bloom_end_month=plant.bloom_end_month,
        bloom_colors=json.loads(plant.bloom_colors),
        foliage_type=plant.foliage_type,
        sun_requirement=plant.sun_requirement,
        watering_needs=plant.watering_needs,
        hardiness_zone=plant.hardiness_zone,
        notes=plant.notes,
        created_at=plant.created_at,
        updated_at=plant.updated_at,
    )


@router.delete("/{plant_id}", status_code=204)
def delete_plant(plant_id: int, session: Session = Depends(get_session)):
    """Delete a plant species from catalog."""
    plant = session.get(PlantSpecies, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    session.delete(plant)
    session.commit()
    return None
