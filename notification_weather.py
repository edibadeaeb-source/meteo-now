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


def location_label(name, language='ro'):
    return str(name or '').strip() or ('your area' if language == 'en' else 'zona ta')


def city_title(name, language='ro', emoji='🔔'):
    """One city and one meaningful symbol; details belong in the short body."""
    return f'{location_label(name, language)} {emoji}'


def weather_emoji(code, is_day=True):
    try:
        code = int(code)
    except (TypeError, ValueError, OverflowError):
        return '🌦️'
    if code in (0, 1):
        return ('☀️' if code == 0 else '🌤️') if is_day else '🌙'
    if code == 2:
        return '⛅' if is_day else '☁️'
    if code == 3:
        return '☁️'
    if code in (45, 48):
        # Samsung draws the fog emoji as a framed landscape. Use a clean cloud.
        return '☁️'
    if code in (71, 73, 75, 77, 85, 86):
        return '❄️'
    if code in (95, 96, 99):
        return '⛈️'
    if code in (51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 68, 69, 80, 81, 82):
        return '🌧️'
    return '🌦️'


def event_title(kind, name, language='ro'):
    """Event timing stays in the body, never in the compact city header."""
    symbol = {'rain': '🌧️', 'snow': '❄️', 'storm': '⛈️',
              'fog': '☁️', 'wind': '💨'}.get(kind.split('_')[0], '🌦️')
    return city_title(name, language, symbol)


def warning_title(name, level, language='ro'):
    return city_title(name, language, '⚠️')
