import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models.bed import GardenBed
from app.models.placement import PlantPlacement
from app.api.v1.property import get_or_create_default_property
from app.schemas.entities import GardenBedCreate, GardenBedRead, GardenBedUpdate

router = APIRouter(prefix="/beds", tags=["Garden Beds & Surfaces"])


@router.get("", response_model=List[GardenBedRead])
def list_beds(
    zone: Optional[str] = Query(default=None, description="Filter by zone: front_garden, back_garden, terrace, water, etc."),
    surface_type: Optional[str] = Query(default=None, description="Filter by surface: soil, terrace, pond, gravel, lawn, planter"),
    session: Session = Depends(get_session),
):
    """List garden beds, paved terraces, ponds, or planter zones."""
    prop = get_or_create_default_property(session)
    query = select(GardenBed).where(GardenBed.property_id == prop.id)
    if zone:
        query = query.where(GardenBed.zone == zone)
    if surface_type:
        query = query.where(GardenBed.surface_type == surface_type)

    beds = session.exec(query).all()
    results = []
    for b in beds:
        try:
            coords = json.loads(b.polygon_coords)
        except Exception:
            coords = []
        results.append(
            GardenBedRead(
                id=b.id,
                property_id=b.property_id,
                name=b.name,
                zone=b.zone,
                surface_type=b.surface_type or "soil",
                polygon_coords=coords,
                soil_type=b.soil_type,
                color=b.color,
                created_at=b.created_at,
                updated_at=b.updated_at,
            )
        )
    return results


@router.post("", response_model=GardenBedRead, status_code=201)
def create_bed(bed_in: GardenBedCreate, session: Session = Depends(get_session)):
    """Create a new planting bed, stone terrace, or pond polygon."""
    prop = get_or_create_default_property(session)
    p_id = bed_in.property_id or prop.id

    bed = GardenBed(
        property_id=p_id,
        name=bed_in.name,
        zone=bed_in.zone,
        surface_type=bed_in.surface_type or "soil",
        polygon_coords=json.dumps(bed_in.polygon_coords),
        soil_type=bed_in.soil_type,
        color=bed_in.color,
    )
    session.add(bed)
    session.commit()
    session.refresh(bed)

    return GardenBedRead(
        id=bed.id,
        property_id=bed.property_id,
        name=bed.name,
        zone=bed.zone,
        surface_type=bed.surface_type,
        polygon_coords=bed_in.polygon_coords,
        soil_type=bed.soil_type,
        color=bed.color,
        created_at=bed.created_at,
        updated_at=bed.updated_at,
    )


@router.put("/{bed_id}", response_model=GardenBedRead)
def update_bed(
    bed_id: int,
    bed_in: GardenBedUpdate,
    session: Session = Depends(get_session),
):
    """Update bed or surface vertices, surface_type, zone, or color."""
    bed = session.get(GardenBed, bed_id)
    if not bed:
        raise HTTPException(status_code=404, detail="Garden bed not found")

    if bed_in.name is not None:
        bed.name = bed_in.name
    if bed_in.zone is not None:
        bed.zone = bed_in.zone
    if bed_in.surface_type is not None:
        bed.surface_type = bed_in.surface_type
    if bed_in.polygon_coords is not None:
        bed.polygon_coords = json.dumps(bed_in.polygon_coords)
    if bed_in.soil_type is not None:
        bed.soil_type = bed_in.soil_type
    if bed_in.color is not None:
        bed.color = bed_in.color

    bed.updated_at = datetime.now(timezone.utc)
    session.add(bed)
    session.commit()
    session.refresh(bed)

    return GardenBedRead(
        id=bed.id,
        property_id=bed.property_id,
        name=bed.name,
        zone=bed.zone,
        surface_type=bed.surface_type,
        polygon_coords=json.loads(bed.polygon_coords),
        soil_type=bed.soil_type,
        color=bed.color,
        created_at=bed.created_at,
        updated_at=bed.updated_at,
    )


@router.delete("/{bed_id}", status_code=204)
def delete_bed(bed_id: int, session: Session = Depends(get_session)):
    """Delete a bed or surface zone, moving associated plants to staging nursery."""
    bed = session.get(GardenBed, bed_id)
    if not bed:
        raise HTTPException(status_code=404, detail="Garden bed not found")

    placements = session.exec(select(PlantPlacement).where(PlantPlacement.bed_id == bed_id)).all()
    for p in placements:
        p.bed_id = None
        session.add(p)
    session.flush()

    session.delete(bed)
    session.commit()
    return None
