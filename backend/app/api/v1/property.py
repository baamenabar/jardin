import shutil
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models.property import Property
from app.schemas.entities import PropertyRead, PropertyUpdate

router = APIRouter(prefix="/property", tags=["Property"])


def get_or_create_default_property(session: Session) -> Property:
    prop = session.exec(select(Property)).first()
    if not prop:
        prop = Property(
            name="My Garden",
            latitude=settings.DEFAULT_LATITUDE,
            longitude=settings.DEFAULT_LONGITUDE,
            timezone=settings.DEFAULT_TIMEZONE,
            north_angle_deg=0.0,
            width_m=30.0,
            height_m=40.0,
            staging_area_x=22.0,
            staging_area_y=9.0,
            staging_area_w=4.5,
            staging_area_h=4.0,
        )
        session.add(prop)
        session.commit()
        session.refresh(prop)
    return prop


@router.get("", response_model=PropertyRead)
def get_property(session: Session = Depends(get_session)):
    """Get the active property layout configuration, orientation, and dimensions."""
    return get_or_create_default_property(session)


@router.put("", response_model=PropertyRead)
def update_property(update_data: PropertyUpdate, session: Session = Depends(get_session)):
    """Update property boundaries, geographical coordinates, or True North orientation."""
    prop = get_or_create_default_property(session)
    data_dict = update_data.model_dump(exclude_unset=True)
    for key, value in data_dict.items():
        setattr(prop, key, value)
    prop.updated_at = datetime.now(timezone.utc)
    session.add(prop)
    session.commit()
    session.refresh(prop)
    return prop


@router.post("/background")
async def upload_background_image(
    file: UploadFile = File(...),
    scale_px_per_m: Optional[float] = None,
    session: Session = Depends(get_session),
):
    """Upload an aerial or satellite photo to use as a canvas tracing layer."""
    prop = get_or_create_default_property(session)
    file_ext = Path(file.filename).suffix if file.filename else ".png"
    target_filename = f"aerial_background_{prop.id}{file_ext}"
    target_path = settings.MEDIA_DIR / target_filename

    with target_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    prop.background_image = f"/media/{target_filename}"
    if scale_px_per_m is not None:
        prop.background_scale_px_per_m = scale_px_per_m
    prop.updated_at = datetime.now(timezone.utc)
    session.add(prop)
    session.commit()
    session.refresh(prop)

    return {
        "status": "success",
        "background_image": prop.background_image,
        "background_scale_px_per_m": prop.background_scale_px_per_m,
    }
