from datetime import datetime, date
import zoneinfo
import pytest
from app.services.solar import get_sun_position, get_daylight_times


def test_sun_position_madrid_summer_solstice_noon():
    # On June 21 at 12:00 UTC (14:00 Madrid CEST), sun is high in the southern sky
    dt = datetime(2026, 6, 21, 14, 0, tzinfo=zoneinfo.ZoneInfo("Europe/Madrid"))
    azimuth, elevation, shadow_angle, is_daylight = get_sun_position(
        latitude=40.4168,
        longitude=-3.7038,
        dt=dt,
        north_angle_deg=0.0,
        tz_str="Europe/Madrid",
    )

    assert is_daylight is True
    # At solar noon in Madrid (~14:15 CEST), elevation is ~73 degrees
    assert 65.0 <= elevation <= 75.0
    # Azimuth should be roughly South (~170 to 190 degrees)
    assert 165.0 <= azimuth <= 195.0
    # Shadow points opposite to sun (North, angle ~ 345 to 15 degrees)
    assert (shadow_angle >= 345.0) or (shadow_angle <= 15.0)


def test_sun_position_night():
    # Midnight
    dt = datetime(2026, 6, 21, 0, 0, tzinfo=zoneinfo.ZoneInfo("Europe/Madrid"))
    azimuth, elevation, shadow_angle, is_daylight = get_sun_position(
        latitude=40.4168,
        longitude=-3.7038,
        dt=dt,
        north_angle_deg=0.0,
        tz_str="Europe/Madrid",
    )

    assert is_daylight is False
    assert elevation < 0.0


def test_daylight_times():
    target_date = date(2026, 6, 21)
    sunrise, sunset, daylight_hours = get_daylight_times(
        latitude=40.4168,
        longitude=-3.7038,
        target_date=target_date,
        tz_str="Europe/Madrid",
    )

    assert sunrise is not None
    assert sunset is not None
    # Madrid has ~15 hours of daylight around summer solstice
    assert 14.5 <= daylight_hours <= 15.5
