import json
import math
from datetime import datetime, date, time, timedelta
from typing import List, Optional, Tuple, Dict, Any
import zoneinfo

from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.ops import unary_union

from app.models.property import Property
from app.models.obstacle import Obstacle
from app.models.bed import GardenBed
from app.schemas.analysis import (
    SunPosition,
    ShadowPolygon,
    InstantShadowsResponse,
    BedSunlightStat,
    HourlySunExposure,
    DailySunlightResponse,
)
from app.services.solar import get_sun_position, get_daylight_times


def parse_polygon_coords(coords_json_or_list: Any) -> List[List[float]]:
    """Helper to parse JSON string or python list of coordinates."""
    if isinstance(coords_json_or_list, str):
        try:
            return json.loads(coords_json_or_list)
        except Exception:
            return []
    elif isinstance(coords_json_or_list, list):
        return coords_json_or_list
    return []


def project_shadow_polygon(
    base_coords: List[List[float]],
    height_m: float,
    shadow_angle_deg: float,
    elevation_deg: float,
    max_length_ratio: float = 15.0,
) -> Optional[Polygon]:
    """
    Project a 2D obstacle polygon into its ground cast shadow polygon.
    
    Coordinates use canvas conventions:
      - X increases to the right
      - Y increases downwards
      - shadow_angle_deg: direction shadow points (0=UP, 90=RIGHT, 180=DOWN, 270=LEFT)
    """
    if len(base_coords) < 3 or elevation_deg <= 0.5 or height_m <= 0.0:
        return None

    # Calculate shadow length ratio: L = h / tan(elevation)
    elev_rad = math.radians(elevation_deg)
    length_ratio = min(1.0 / math.tan(elev_rad), max_length_ratio)
    total_length = height_m * length_ratio

    angle_rad = math.radians(shadow_angle_deg)
    # dx = L * sin(angle), dy = -L * cos(angle) (UP is -Y)
    dx = total_length * math.sin(angle_rad)
    dy = -total_length * math.cos(angle_rad)

    # Base vertices
    base_points = [(float(pt[0]), float(pt[1])) for pt in base_coords]
    base_poly = Polygon(base_points)
    if not base_poly.is_valid:
        base_poly = base_poly.buffer(0)

    # Projected top vertices
    top_points = [(x + dx, y + dy) for x, y in base_points]
    top_poly = Polygon(top_points)
    if not top_poly.is_valid:
        top_poly = top_poly.buffer(0)

    # Construct side quad polygons connecting each edge of the base to the top
    side_quads = []
    n = len(base_points)
    for i in range(n):
        p1 = base_points[i]
        p2 = base_points[(i + 1) % n]
        p2_top = top_points[(i + 1) % n]
        p1_top = top_points[i]
        quad = Polygon([p1, p2, p2_top, p1_top])
        if quad.is_valid and not quad.is_empty:
            side_quads.append(quad)

    all_polys = [base_poly, top_poly] + side_quads
    shadow_union = unary_union(all_polys)
    if not shadow_union.is_valid:
        shadow_union = shadow_union.buffer(0)

    return shadow_union


def extract_polygons(geom: Any) -> List[Polygon]:
    """Recursively extract all valid non-empty 2D polygons with positive area from a geometry."""
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom] if geom.area > 0.01 else []
    if isinstance(geom, MultiPolygon):
        return [p for p in geom.geoms if not p.is_empty and p.area > 0.01]
    if hasattr(geom, "geoms"):
        result: List[Polygon] = []
        for g in geom.geoms:
            result.extend(extract_polygons(g))
        return result
    return []


def calculate_instant_shadows(
    property_obj: Property,
    obstacles: List[Obstacle],
    dt: datetime,
) -> InstantShadowsResponse:
    """Calculate cast shadows of all obstacles on a property at a specific datetime,
    unioning adjacent and overlapping shadows so they do not add up."""
    azimuth, elevation, shadow_angle, is_daylight = get_sun_position(
        latitude=property_obj.latitude,
        longitude=property_obj.longitude,
        dt=dt,
        north_angle_deg=property_obj.north_angle_deg,
        tz_str=property_obj.timezone,
    )

    sun_pos = SunPosition(
        azimuth_deg=round(azimuth, 2),
        elevation_deg=round(elevation, 2),
        canvas_shadow_angle_deg=round(shadow_angle, 2),
        is_daylight=is_daylight,
    )

    shadow_results: List[ShadowPolygon] = []
    total_area = 0.0

    if is_daylight:
        opacity_groups: Dict[float, List[Tuple[Obstacle, Polygon]]] = {}
        all_shadow_geoms: List[Polygon] = []

        for obs in obstacles:
            coords = parse_polygon_coords(obs.polygon_coords)
            if not coords:
                continue
            shadow_geom = project_shadow_polygon(
                base_coords=coords,
                height_m=obs.height_m,
                shadow_angle_deg=shadow_angle,
                elevation_deg=elevation,
            )
            if shadow_geom is not None and not shadow_geom.is_empty:
                op = round(float(obs.opacity if obs.opacity is not None else 1.0), 2)
                opacity_groups.setdefault(op, []).append((obs, shadow_geom))
                all_shadow_geoms.append(shadow_geom)

        if all_shadow_geoms:
            total_union = unary_union(all_shadow_geoms)
            if not total_union.is_valid:
                total_union = total_union.buffer(0)
            total_area = total_union.area

        # Process from highest opacity to lowest so darker shadows take precedence
        accumulated_mask = None
        for op in sorted(opacity_groups.keys(), reverse=True):
            group_items = opacity_groups[op]
            geoms = [g for _, g in group_items]
            merged = unary_union(geoms)
            if not merged.is_valid:
                merged = merged.buffer(0)

            # Subtract any higher-opacity shadow regions so shadows do not add up
            if accumulated_mask is not None and not accumulated_mask.is_empty:
                diff = merged.difference(accumulated_mask)
            else:
                diff = merged

            if not diff.is_valid:
                diff = diff.buffer(0)

            if accumulated_mask is None:
                accumulated_mask = merged
            else:
                accumulated_mask = unary_union([accumulated_mask, merged])
                if not accumulated_mask.is_valid:
                    accumulated_mask = accumulated_mask.buffer(0)

            polys = extract_polygons(diff)

            for p in polys:
                poly_coords = [[round(x, 2), round(y, 2)] for x, y in p.exterior.coords]
                holes = None
                if p.interiors:
                    holes = [
                        [[round(x, 2), round(y, 2)] for x, y in interior.coords]
                        for interior in p.interiors
                    ]

                # Identify matching obstacles for this shadow polygon
                matching_obs = [
                    obs for obs, s_geom in group_items
                    if p.intersection(s_geom).area > 0.01
                ]
                if not matching_obs:
                    matching_obs = [
                        obs for obs, s_geom in group_items
                        if p.intersects(s_geom)
                    ]

                if len(matching_obs) == 1:
                    obs_id = matching_obs[0].id or 0
                    obs_name = matching_obs[0].name
                elif len(matching_obs) > 1:
                    obs_id = matching_obs[0].id or 0
                    obs_name = ", ".join(o.name for o in matching_obs)
                else:
                    obs_id = group_items[0][0].id or 0
                    obs_name = group_items[0][0].name

                shadow_results.append(
                    ShadowPolygon(
                        obstacle_id=obs_id,
                        obstacle_name=obs_name,
                        polygon_coords=poly_coords,
                        opacity=op,
                        holes=holes,
                    )
                )

    return InstantShadowsResponse(
        timestamp_iso=dt.isoformat(),
        sun=sun_pos,
        shadows=shadow_results,
        total_shadow_area_m2=round(total_area, 2),
    )


def calculate_daily_sunlight_analysis(
    property_obj: Property,
    obstacles: List[Obstacle],
    beds: List[GardenBed],
    target_date: date,
    step_minutes: int = 30,
) -> DailySunlightResponse:
    """
    Calculate accumulated sunlight hours and classification (Full Sun / Partial / Shade)
    for all garden beds on a given target date.
    """
    tz = zoneinfo.ZoneInfo(property_obj.timezone)
    sunrise, sunset, daylight_hours = get_daylight_times(
        latitude=property_obj.latitude,
        longitude=property_obj.longitude,
        target_date=target_date,
        tz_str=property_obj.timezone,
    )

    # Pre-parse beds into Shapely polygons
    bed_geoms = []
    for bed in beds:
        coords = parse_polygon_coords(bed.polygon_coords)
        if len(coords) >= 3:
            p = Polygon([(float(x), float(y)) for x, y in coords])
            if not p.is_valid:
                p = p.buffer(0)
            bed_geoms.append((bed, p))

    # If no sunrise or daylight, return 0 sun for all
    if not sunrise or not sunset or daylight_hours <= 0:
        bed_stats = [
            BedSunlightStat(
                bed_id=bed.id or 0,
                bed_name=bed.name,
                zone=bed.zone,
                direct_sun_hours=0.0,
                classification="full_shade",
                hourly_curve=[],
            )
            for bed, _ in bed_geoms
        ]
        return DailySunlightResponse(
            date_iso=target_date.isoformat(),
            sunrise_time=None,
            sunset_time=None,
            daylight_hours=0.0,
            beds=bed_stats,
        )

    # Prepare tracking structures for each bed
    sun_hours_accumulated: Dict[int, float] = {bed.id or 0: 0.0 for bed, _ in bed_geoms}
    hourly_curves: Dict[int, List[HourlySunExposure]] = {bed.id or 0: [] for bed, _ in bed_geoms}

    # Step through time from sunrise to sunset
    current_time = sunrise
    step_delta = timedelta(minutes=step_minutes)
    step_fraction_hours = step_minutes / 60.0

    while current_time <= sunset:
        azimuth, elevation, shadow_angle, is_daylight = get_sun_position(
            latitude=property_obj.latitude,
            longitude=property_obj.longitude,
            dt=current_time,
            north_angle_deg=property_obj.north_angle_deg,
            tz_str=property_obj.timezone,
        )

        time_str = current_time.strftime("%H:%M")

        if not is_daylight or elevation <= 1.0:
            for bed, _ in bed_geoms:
                b_id = bed.id or 0
                hourly_curves[b_id].append(
                    HourlySunExposure(time_str=time_str, elevation_deg=round(elevation, 1), is_sunlit=False)
                )
            current_time += step_delta
            continue

        # Generate union of all obstacle shadows at this moment
        step_shadow_polys = []
        for obs in obstacles:
            coords = parse_polygon_coords(obs.polygon_coords)
            if not coords:
                continue
            s_geom = project_shadow_polygon(
                base_coords=coords,
                height_m=obs.height_m,
                shadow_angle_deg=shadow_angle,
                elevation_deg=elevation,
            )
            if s_geom is not None and not s_geom.is_empty:
                step_shadow_polys.append(s_geom)

        step_shadow_union = unary_union(step_shadow_polys) if step_shadow_polys else None

        # Check each bed against the composite shadow
        for bed, bed_poly in bed_geoms:
            b_id = bed.id or 0
            if bed_poly.area <= 0:
                continue

            if step_shadow_union is None or step_shadow_union.is_empty:
                # Completely unshaded
                sunlit_fraction = 1.0
            else:
                try:
                    sunlit_area = bed_poly.difference(step_shadow_union).area
                    sunlit_fraction = max(0.0, min(1.0, sunlit_area / bed_poly.area))
                except Exception:
                    sunlit_fraction = 0.5

            is_mostly_sunlit = sunlit_fraction >= 0.5
            sun_hours_accumulated[b_id] += sunlit_fraction * step_fraction_hours
            hourly_curves[b_id].append(
                HourlySunExposure(
                    time_str=time_str,
                    elevation_deg=round(elevation, 1),
                    is_sunlit=is_mostly_sunlit,
                )
            )

        current_time += step_delta

    # Assemble final bed statistics
    bed_stats = []
    for bed, _ in bed_geoms:
        b_id = bed.id or 0
        total_sun = round(sun_hours_accumulated.get(b_id, 0.0), 1)
        if total_sun >= 6.0:
            classification = "full_sun"
        elif total_sun >= 3.0:
            classification = "partial_shade"
        else:
            classification = "full_shade"

        bed_stats.append(
            BedSunlightStat(
                bed_id=b_id,
                bed_name=bed.name,
                zone=bed.zone,
                direct_sun_hours=total_sun,
                classification=classification,
                hourly_curve=hourly_curves.get(b_id, []),
            )
        )

    return DailySunlightResponse(
        date_iso=target_date.isoformat(),
        sunrise_time=sunrise.strftime("%H:%M"),
        sunset_time=sunset.strftime("%H:%M"),
        daylight_hours=round(daylight_hours, 1),
        beds=bed_stats,
    )
