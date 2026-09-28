import json
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models.obstacle import Obstacle
from app.api.v1.property import get_or_create_default_property
from app.schemas.entities import ObstacleCreate, ObstacleRead, ObstacleUpdate

router = APIRouter(prefix="/obstacles", tags=["Obstacles"])


@router.get("", response_model=List[ObstacleRead])
def list_obstacles(session: Session = Depends(get_session)):
    """List all obstacles (house, fences, walls, trees) on the property."""
    prop = get_or_create_default_property(session)
    obstacles = session.exec(select(Obstacle).where(Obstacle.property_id == prop.id)).all()
    results = []
    for obs in obstacles:
        try:
            coords = json.loads(obs.polygon_coords)
        except Exception:
            coords = []
        results.append(
            ObstacleRead(
                id=obs.id,
                property_id=obs.property_id,
                name=obs.name,
                type=obs.type,
                polygon_coords=coords,
                height_m=obs.height_m,
                opacity=obs.opacity,
                created_at=obs.created_at,
                updated_at=obs.updated_at,
            )
        )
    return results


@router.post("", response_model=ObstacleRead, status_code=201)
def create_obstacle(obstacle_in: ObstacleCreate, session: Session = Depends(get_session)):
    """Create a new obstacle (e.g. house, fence, tree) for shadow calculations."""
    prop = get_or_create_default_property(session)
    p_id = obstacle_in.property_id or prop.id

    obs = Obstacle(
        property_id=p_id,
        name=obstacle_in.name,
        type=obstacle_in.type,
        polygon_coords=json.dumps(obstacle_in.polygon_coords),
        height_m=obstacle_in.height_m,
        opacity=obstacle_in.opacity,
    )
    session.add(obs)
    session.commit()
    session.refresh(obs)

    return ObstacleRead(
        id=obs.id,
        property_id=obs.property_id,
        name=obs.name,
        type=obs.type,
        polygon_coords=obstacle_in.polygon_coords,
        height_m=obs.height_m,
        opacity=obs.opacity,
        created_at=obs.created_at,
        updated_at=obs.updated_at,
    )


@router.put("/{obstacle_id}", response_model=ObstacleRead)
def update_obstacle(
    obstacle_id: int,
    obstacle_in: ObstacleUpdate,
    session: Session = Depends(get_session),
):
    """Update an obstacle's vertices, height, or opacity."""
    obs = session.get(Obstacle, obstacle_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Obstacle not found")

    if obstacle_in.name is not None:
        obs.name = obstacle_in.name
    if obstacle_in.type is not None:
        obs.type = obstacle_in.type
    if obstacle_in.polygon_coords is not None:
        obs.polygon_coords = json.dumps(obstacle_in.polygon_coords)
    if obstacle_in.height_m is not None:
        obs.height_m = obstacle_in.height_m
    if obstacle_in.opacity is not None:
        obs.opacity = obstacle_in.opacity

    obs.updated_at = datetime.now(timezone.utc)
    session.add(obs)
    session.commit()
    session.refresh(obs)

    return ObstacleRead(
        id=obs.id,
        property_id=obs.property_id,
        name=obs.name,
        type=obs.type,
        polygon_coords=json.loads(obs.polygon_coords),
        height_m=obs.height_m,
        opacity=obs.opacity,
        created_at=obs.created_at,
        updated_at=obs.updated_at,
    )


@router.delete("/{obstacle_id}", status_code=204)
def delete_obstacle(obstacle_id: int, session: Session = Depends(get_session)):
    """Delete an obstacle from the property."""
    obs = session.get(Obstacle, obstacle_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Obstacle not found")
    session.delete(obs)
    session.commit()
    return None
