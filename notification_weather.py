"""Only fresh, dated forecasts may become a new weather notification."""
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def forecast_time(value, data):
    """Interpret naive provider hours in the city, preserving explicit offsets."""
    try:
        moment = datetime.fromisoformat(value.replace('Z', '+00:00'))
        try:
            tz = ZoneInfo(data['timezone'])
        except (KeyError, ValueError):
            if 'utc_offset_seconds' in data:
                tz = timezone(timedelta(seconds=float(data['utc_offset_seconds'])))
            elif moment.tzinfo is not None:
                tz = moment.tzinfo
            else:
                return None
        return moment.replace(tzinfo=tz) if moment.tzinfo is None else moment.astimezone(tz)
    except (AttributeError, KeyError, TypeError, ValueError, OverflowError):
        return None


def fresh_forecast(data, now):
    sources = data.get('weather_sources') or {}
    if sources.get('stale') is not False:
        return False
    try:
        retrieved = datetime.fromisoformat(sources['retrieved_at'].replace('Z', '+00:00'))
        if retrieved.tzinfo is None or not -300 <= now - retrieved.timestamp() <= 1800:
            return False
        current = data.get('current') or {}
        condition = forecast_time(sources.get('current_condition_time') or current['time'], data)
        return condition is not None and -300 <= now - condition.timestamp() <= 5400
    except (KeyError, TypeError, ValueError, OverflowError):
        return False


def summary_indices(data, evening):
    """Locate today/tomorrow by date, including forecasts without yesterday."""
    try:
        today = (data.get('weather_sources') or {}).get('today') or data['current']['time'][:10]
        day = datetime.fromisoformat(today).date()
        target = day + timedelta(days=1 if evening else 0)
        dates = (data.get('daily') or {})['time']
        index = dates.index(target.isoformat())
        previous = (target - timedelta(days=1)).isoformat()
        return index, dates.index(previous) if previous in dates else None
    except (KeyError, ValueError, TypeError):
        return None


def finite(value):
    try:
        return value is not None and math.isfinite(float(value))
    except (TypeError, ValueError, OverflowError):
        return False
