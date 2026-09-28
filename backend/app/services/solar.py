import math
from datetime import datetime, date, time
from typing import Optional, Tuple
import zoneinfo
from astral import Observer
from astral.sun import azimuth as astral_azimuth, elevation as astral_elevation, sun


def get_sun_position(
    latitude: float,
    longitude: float,
    dt: datetime,
    north_angle_deg: float = 0.0,
    tz_str: str = "Europe/Madrid",
) -> Tuple[float, float, float, bool]:
    """
    Calculate solar azimuth, elevation, and canvas shadow angle.

    Returns:
        azimuth_deg: Solar azimuth in degrees (0-360, 0=North, 90=East, 180=South, 270=West)
        elevation_deg: Solar elevation in degrees above horizon (-90 to +90)
        canvas_shadow_angle_deg: Angle on canvas along which shadows point (0=UP, 90=RIGHT, 180=DOWN, 270=LEFT)
        is_daylight: True if elevation > 0.0
    """
    # Ensure datetime has timezone info
    if dt.tzinfo is None:
        tz = zoneinfo.ZoneInfo(tz_str)
        dt = dt.replace(tzinfo=tz)

    observer = Observer(latitude=latitude, longitude=longitude)
    
    azimuth = float(astral_azimuth(observer, dt))
    elevation = float(astral_elevation(observer, dt))
    is_daylight = elevation > 0.0

    # Canvas shadow angle:
    # 1. Sun on canvas = (solar_azimuth + north_angle_deg) % 360
    # 2. Shadow points opposite = (sun_canvas + 180) % 360
    sun_canvas = (azimuth + north_angle_deg) % 360.0
    canvas_shadow_angle_deg = (sun_canvas + 180.0) % 360.0

    return azimuth, elevation, canvas_shadow_angle_deg, is_daylight


def get_daylight_times(
    latitude: float,
    longitude: float,
    target_date: date,
    tz_str: str = "Europe/Madrid",
) -> Tuple[Optional[datetime], Optional[datetime], float]:
    """
    Get sunrise, sunset, and daylight duration in hours for a given date.
    """
    tz = zoneinfo.ZoneInfo(tz_str)
    observer = Observer(latitude=latitude, longitude=longitude)
    try:
        s = sun(observer, date=target_date, tzinfo=tz)
        sunrise = s.get("sunrise")
        sunset = s.get("sunset")
        if sunrise and sunset:
            daylight_hours = max(0.0, (sunset - sunrise).total_seconds() / 3600.0)
        else:
            daylight_hours = 0.0
        return sunrise, sunset, daylight_hours
    except Exception:
        # Near polar extremes or calculation edge cases
        return None, None, 0.0
