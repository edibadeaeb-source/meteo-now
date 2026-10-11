"""Project the app's shared forecast into the native widget contract.

Do not fetch another current-weather provider here: condition, temperature and
day/night must describe the same snapshot that /api/weather/forecast returns.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from weather_service import number


def condition(code, night=False):
    code = number(code)
    if code is None or not code.is_integer():
        return 'nor', 'Stare indisponibilă'
    code = int(code)
    if code == 0:
        return ('luna' if night else 'soare'), 'Senin'
    if code in (1, 2):
        return 'partial', 'Parțial noros'
    if code == 3:
        return 'nor', 'Noros'
    if code in (45, 48):
        return 'ceata', 'Ceață'
    if code in (51, 53, 55, 56, 57):
        return 'burnita', 'Burniță'
    if code in (61, 63, 65, 66, 67):
        return 'ploaie', 'Ploaie'
    if code in (68, 69):
        return 'lapovita', 'Lapoviță'
    if code in (71, 73, 75, 77):
        return 'ninsoare', 'Ninsoare'
    if code in (80, 81, 82):
        return 'ploaie', 'Averse'
    if code in (85, 86):
        return 'ninsoare', 'Averse de ninsoare'
    if code in (95, 96, 99):
        return 'furtuna', 'Furtună'
    return 'nor', 'Stare indisponibilă'


def current_widget(forecast, now):
    current = forecast['current']
    temperature = number(current.get('temperature_2m'))
    if temperature is None:
        raise ValueError('No current temperature in shared forecast')
    sources = forecast.get('weather_sources') or {}
    try:
        tz = ZoneInfo(forecast['timezone'])
    except (KeyError, TypeError, ValueError):
        tz = timezone(timedelta(seconds=number(forecast.get('utc_offset_seconds')) or 0))
    local_now = datetime.fromtimestamp(now, tz)
    daily = forecast.get('daily') or {}
    today = local_now.date().isoformat()

    def solar(field):
        try:
            index = daily['time'].index(today)
            value = datetime.fromisoformat(daily[field][index])
            return value.replace(tzinfo=tz) if value.tzinfo is None else value.astimezone(tz)
        except (KeyError, ValueError, IndexError, TypeError):
            return None

    rise, setting = solar('sunrise'), solar('sunset')
    is_day = current.get('is_day')
    if is_day not in (0, 1):
        is_day = int(rise <= local_now < setting) if rise and setting else None
    night = is_day == 0
    icon, description = condition(current.get('weather_code'), night)
    # Rain/snow/thunder/fog stay visible even during the golden-hour window.
    if icon in ('furtuna', 'ploaie', 'burnita', 'ninsoare', 'lapovita', 'ceata'):
        theme = {'burnita': 'ploaie', 'lapovita': 'ninsoare'}.get(icon, icon)
    elif icon == 'nor':
        theme = 'noapte' if night else 'noros'
    elif any(abs((local_now - event).total_seconds()) <= 4500
             for event in (rise, setting) if event is not None):
        theme = 'apus'
    else:
        theme = 'noapte' if night else 'zi'

    updated = local_now
    try:
        updated = datetime.fromisoformat(sources['retrieved_at'].replace('Z', '+00:00')).astimezone(tz)
    except (KeyError, AttributeError, ValueError, TypeError):
        pass
    rounded = lambda field: None if number(current.get(field)) is None else round(number(current[field]))
    return {
        'temp': round(temperature, 1), 'tempText': f'{round(temperature)}°',
        'resimtit': rounded('apparent_temperature'),
        'umiditate': rounded('relative_humidity_2m'),
        'vant': rounded('wind_speed_10m'),  # Already km/h in the shared contract.
        'icon': icon, 'descriere': description, 'fundal': theme,
        'weatherCode': current.get('weather_code'), 'isDay': is_day,
        'actualizat': updated.strftime('%H:%M'),
        'updatedAt': sources.get('retrieved_at'), 'timezone': forecast.get('timezone'),
        'dateSalvate': bool(sources.get('stale')),
        'weatherSources': {key: sources[key] for key in (
            'revision', 'current', 'current_condition', 'current_condition_time',
            'current_fields', 'retrieved_at', 'today', 'stale', 'fallback') if key in sources},
    }
