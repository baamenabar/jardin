import json
from datetime import datetime, date
import zoneinfo
from shapely.geometry import Polygon
import pytest

from app.models.property import Property
from app.models.obstacle import Obstacle
from app.models.bed import GardenBed
from app.services.shadows import (
    project_shadow_polygon,
    calculate_instant_shadows,
    calculate_daily_sunlight_analysis,
)


def test_project_shadow_geometry():
    # Square building 10m x 10m, height 6m
    # Sun elevation 45 degrees -> length ratio = 1.0 -> shadow length = 6m
    # Shadow angle 0 degrees (pointing UP / -Y)
    coords = [[0, 0], [10, 0], [10, 10], [0, 10]]
    shadow = project_shadow_polygon(
        base_coords=coords,
        height_m=6.0,
        shadow_angle_deg=0.0,  # UP
        elevation_deg=45.0,
    )

    assert shadow is not None
    assert isinstance(shadow, Polygon)
    assert shadow.is_valid
    # The base is 10x10 = 100m2. Shadow extends 6m in -Y direction.
    # Total shadow area is 10m * (10m + 6m) = 160m2.
    assert pytest.approx(shadow.area, rel=1e-2) == 160.0


def test_instant_shadows():
    prop = Property(
        id=1,
        name="Test Garden",
        latitude=40.4168,
        longitude=-3.7038,
        north_angle_deg=0.0,
        timezone="Europe/Madrid",
    )
    house = Obstacle(
        id=1,
        property_id=1,
        name="House",
        type="house",
        polygon_coords=json.dumps([[10, 15], [20, 15], [20, 25], [10, 25]]),
        height_m=6.0,
        opacity=1.0,
    )

    # Noon in Madrid
    dt = datetime(2026, 6, 21, 14, 0, tzinfo=zoneinfo.ZoneInfo("Europe/Madrid"))
    result = calculate_instant_shadows(prop, [house], dt)

    assert result.sun.is_daylight is True
    assert len(result.shadows) == 1
    assert result.shadows[0].obstacle_name == "House"
    assert result.total_shadow_area_m2 > 100.0


def test_adjacent_obstacles_shadows_union():
    prop = Property(
        id=1,
        name="Test Garden",
        latitude=40.4168,
        longitude=-3.7038,
        north_angle_deg=0.0,
        timezone="Europe/Madrid",
    )
    house1 = Obstacle(
        id=1,
        property_id=1,
        name="House 1",
        type="house",
        polygon_coords=json.dumps([[0, 15], [10, 15], [10, 25], [0, 25]]),
        height_m=6.0,
        opacity=1.0,
    )
    house2 = Obstacle(
        id=2,
        property_id=1,
        name="House 2",
        type="house",
        polygon_coords=json.dumps([[10, 15], [20, 15], [20, 25], [10, 25]]),
        height_m=6.0,
        opacity=1.0,
    )

    # 10:00 AM in Madrid: sun projects shadows diagonally
    dt = datetime(2026, 6, 21, 10, 0, tzinfo=zoneinfo.ZoneInfo("Europe/Madrid"))
    r1 = calculate_instant_shadows(prop, [house1], dt)
    r2 = calculate_instant_shadows(prop, [house2], dt)
    r_both = calculate_instant_shadows(prop, [house1, house2], dt)

    # Individual shadows would naively sum to ~385 m2, but overlapping/adjacent union is ~297 m2
    assert r_both.total_shadow_area_m2 < (r1.total_shadow_area_m2 + r2.total_shadow_area_m2)
    # The two adjacent houses must be unioned into a single shadow polygon
    assert len(r_both.shadows) == 1
    assert "House 1" in r_both.shadows[0].obstacle_name
    assert "House 2" in r_both.shadows[0].obstacle_name


def test_overlapping_shadows_different_opacity():
    prop = Property(
        id=1,
        name="Test Garden",
        latitude=40.4168,
        longitude=-3.7038,
        north_angle_deg=0.0,
        timezone="Europe/Madrid",
    )
    house = Obstacle(
        id=1,
        property_id=1,
        name="House",
        type="house",
        polygon_coords=json.dumps([[0, 15], [10, 15], [10, 25], [0, 25]]),
        height_m=6.0,
        opacity=1.0,
    )
    tree = Obstacle(
        id=2,
        property_id=1,
        name="Tree",
        type="tree",
        polygon_coords=json.dumps([[5, 12], [9, 12], [9, 16], [5, 16]]),
        height_m=5.0,
        opacity=0.7,
    )

    dt = datetime(2026, 6, 21, 10, 0, tzinfo=zoneinfo.ZoneInfo("Europe/Madrid"))
    res = calculate_instant_shadows(prop, [house, tree], dt)

    assert len(res.shadows) == 2
    # Check that the two shadows do not overlap (tree shadow was subtracted from house shadow)
    poly_house = Polygon(res.shadows[0].polygon_coords)
    poly_tree = Polygon(res.shadows[1].polygon_coords)
    assert pytest.approx(poly_house.intersection(poly_tree).area, abs=1e-3) == 0.0


def test_daily_sunlight_analysis():
    prop = Property(
        id=1,
        name="Test Garden",
        latitude=40.4168,
        longitude=-3.7038,
        north_angle_deg=0.0,
        timezone="Europe/Madrid",
    )
    # House at Y=15 to 25, height 8m
    house = Obstacle(
        id=1,
        property_id=1,
        name="Main House",
        type="house",
        polygon_coords=json.dumps([[10, 15], [20, 15], [20, 25], [10, 25]]),
        height_m=8.0,
    )

    # Bed 1: Far south (front garden) at Y=32 to 36 (well exposed to southern sun)
    sunny_bed = GardenBed(
        id=1,
        property_id=1,
        name="Front Sunny Bed",
        zone="front_garden",
        polygon_coords=json.dumps([[10, 32], [20, 32], [20, 36], [10, 36]]),
    )

    # Bed 2: Immediately north of the 8m house at Y=11 to 14 (shaded by house when sun is in south)
    shady_bed = GardenBed(
        id=2,
        property_id=1,
        name="North Behind House",
        zone="back_garden",
        polygon_coords=json.dumps([[10, 11], [20, 11], [20, 14], [10, 14]]),
    )

    analysis = calculate_daily_sunlight_analysis(
        property_obj=prop,
        obstacles=[house],
        beds=[sunny_bed, shady_bed],
        target_date=date(2026, 6, 21),
        step_minutes=30,
    )

    assert len(analysis.beds) == 2
    sunny_stat = next(b for b in analysis.beds if b.bed_id == 1)
    shady_stat = next(b for b in analysis.beds if b.bed_id == 2)

    # Sunny bed should get significantly more direct sun than the bed directly behind the 8m tall house!
    assert sunny_stat.direct_sun_hours > shady_stat.direct_sun_hours
    assert sunny_stat.classification in ["full_sun", "partial_shade"]
