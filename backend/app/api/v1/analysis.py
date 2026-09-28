from datetime import datetime, date, time
from typing import Optional
import zoneinfo
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models.property import Property
from app.models.obstacle import Obstacle
from app.models.bed import GardenBed
from app.models.placement import PlantPlacement
from app.models.plant import PlantSpecies
from app.api.v1.property import get_or_create_default_property
from app.schemas.analysis import (
    InstantShadowsResponse,
    DailySunlightResponse,
    MonthlyBloomResponse,
)
from app.services.shadows import (
    calculate_instant_shadows,
    calculate_daily_sunlight_analysis,
)
from app.services.blooms import calculate_monthly_bloom_states

router = APIRouter(prefix="/analysis", tags=["Solar, Shadows & Bloom Analysis"])


@router.get("/shadows", response_model=InstantShadowsResponse)
def get_instant_shadows(
    date_str: Optional[str] = Query(default=None, description="YYYY-MM-DD (defaults to today)"),
    time_str: Optional[str] = Query(default=None, description="HH:MM (defaults to current time or 13:00)"),
    session: Session = Depends(get_session),
):
    """
    Calculate real-time shadow projection polygons for all obstacles
    at a specific date and time on the property canvas.
    """
    prop = get_or_create_default_property(session)
    tz = zoneinfo.ZoneInfo(prop.timezone)
    now = datetime.now(tz)

    if date_str:
        d = date.fromisoformat(date_str)
    else:
        d = now.date()

    if time_str:
        parts = [int(p) for p in time_str.split(":")]
        t = time(hour=parts[0], minute=parts[1])
    else:
        t = now.time()

    target_dt = datetime.combine(d, t, tzinfo=tz)

    obstacles = session.exec(select(Obstacle).where(Obstacle.property_id == prop.id)).all()
    return calculate_instant_shadows(prop, obstacles, target_dt)


@router.get("/sunlight", response_model=DailySunlightResponse)
def get_daily_sunlight(
    date_str: Optional[str] = Query(default=None, description="Target date YYYY-MM-DD (defaults to today)"),
    step_minutes: int = Query(default=30, ge=15, le=60, description="Simulation time-step in minutes"),
    session: Session = Depends(get_session),
):
    """
    Calculate accumulated sunlight hours and classification (Full Sun / Partial / Shade)
    for all garden beds on the target date.
    """
    prop = get_or_create_default_property(session)
    tz = zoneinfo.ZoneInfo(prop.timezone)
    target_date = date.fromisoformat(date_str) if date_str else datetime.now(tz).date()

    obstacles = session.exec(select(Obstacle).where(Obstacle.property_id == prop.id)).all()
    beds = session.exec(select(GardenBed).where(GardenBed.property_id == prop.id)).all()

    return calculate_daily_sunlight_analysis(
        property_obj=prop,
        obstacles=obstacles,
        beds=beds,
        target_date=target_date,
        step_minutes=step_minutes,
    )


@router.get("/blooms", response_model=MonthlyBloomResponse)
def get_monthly_blooms(
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Month 1 to 12 (defaults to current month)"),
    session: Session = Depends(get_session),
):
    """
    Get active blooming plants, flower hex colors, and canopy states
    for the specified month across all garden beds.
    """
    prop = get_or_create_default_property(session)
    tz = zoneinfo.ZoneInfo(prop.timezone)
    target_month = month if month is not None else datetime.now(tz).month

    bed_ids = session.exec(select(GardenBed.id).where(GardenBed.property_id == prop.id)).all()
    query = (
        select(PlantPlacement, PlantSpecies)
        .join(PlantSpecies, PlantPlacement.species_id == PlantSpecies.id)
        .where(
            (PlantPlacement.bed_id == None) | (PlantPlacement.bed_id.in_(bed_ids))
        )
    )
    placements = session.exec(query).all()

    return calculate_monthly_bloom_states(placements, target_month=target_month)
