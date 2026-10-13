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


def city_title(name, language='ro'):
    """Routine updates leave the weather details in the body, like a city header."""
    return location_label(name, language).upper()


def event_title(kind, name, language='ro', ending_soon=False):
    """A complete event headline, without converting a later forecast into 'soon'."""
    place = location_label(name, language)
    if language == 'en':
        soon = ' soon' if ending_soon else ''
        titles = {
            'rain_now': f'Raining now in {place}',
            'rain_start': f'Rain approaching {place}',
            'rain_end': f'Rain is likely to stop{soon} in {place}',
            'snow_now': f'Snowing now in {place}',
            'snow_start': f'Snow approaching {place}',
            'snow_end': f'Snow is likely to stop{soon} in {place}',
            'storm_now': f'Thunderstorms in {place}',
            'storm_start': f'Thunderstorm risk in {place}',
            'fog_now': f'Fog in {place}',
            'fog_start': f'Fog expected in {place}',
            'wind_now': f'Strong winds in {place}',
            'wind_start': f'Strong winds expected in {place}',
        }
    else:
        soon = ' curând' if ending_soon else ''
        titles = {
            'rain_now': f'Plouă acum în {place}',
            'rain_start': f'Se apropie ploaia de {place}',
            'rain_end': f'Ploaia se oprește{soon} în {place}',
            'snow_now': f'Ninge acum în {place}',
            'snow_start': f'Se apropie ninsoarea de {place}',
            'snow_end': f'Ninsoarea se oprește{soon} în {place}',
            'storm_now': f'Furtună în {place}',
            'storm_start': f'Risc de furtună în {place}',
            'fog_now': f'Ceață în {place}',
            'fog_start': f'Se anunță ceață în {place}',
            'wind_now': f'Vânt puternic în {place}',
            'wind_start': f'Se anunță vânt puternic în {place}',
        }
    return titles.get(kind, city_title(name, language))


def warning_title(name, level, language='ro'):
    place = location_label(name, language)
    if language == 'en':
        color = {1: 'Yellow', 2: 'Orange', 3: 'Red'}.get(level)
        return f'{color} weather warning for {place}' if color else f'Weather warning for {place}'
    code = {1: 'Cod galben', 2: 'Cod portocaliu', 3: 'Cod roșu'}.get(level, 'Avertizare meteo')
    return f'{code} pentru {place}'
