"""Optional precipitation probability; never infer it from rainfall/cloudiness."""
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET


def intervals(content):
    rows = []
    for item in ET.fromstring(content).findall('./forecast/time'):
        precip = item.find('precipitation')
        try:
            start = datetime.fromisoformat(item.attrib['from'].replace('Z', '+00:00'))
            end = datetime.fromisoformat(item.attrib['to'].replace('Z', '+00:00'))
            start = start.replace(tzinfo=timezone.utc) if start.tzinfo is None else start
            end = end.replace(tzinfo=timezone.utc) if end.tzinfo is None else end
            p = float(precip.attrib['probability'])
            if 0 <= p <= 1 and 0 < (end-start).total_seconds() <= 21600:
                rows.append([start.timestamp(), end.timestamp(), round(p*100)])
        except (ValueError, KeyError, TypeError, AttributeError):
            continue
    return sorted(rows)


def supplement(data, rows):
    try:
        tz = ZoneInfo(data['timezone'])
    except (KeyError, ValueError):
        tz = timezone(timedelta(seconds=data.get('utc_offset_seconds', 0)))
    hourly, daily = data['hourly'], data['daily']
    values = hourly.setdefault('precipitation_probability', [None]*len(hourly['time']))
    sources = data['weather_sources'].setdefault('precipitation_probability', {})
    provenance = sources.setdefault('hourly', [None]*len(hourly['time']))
    for i, iso in enumerate(hourly['time']):
        if i >= len(values) or values[i] is not None:
            continue
        t = datetime.fromisoformat(iso.replace('Z', '+00:00'))
        stamp = (t.replace(tzinfo=tz) if t.tzinfo is None else t).timestamp()
        for start, end, probability in rows:
            if start <= stamp < end:
                values[i], provenance[i] = probability, 'OpenWeather'
                break
    daily_values = daily.setdefault('precipitation_probability_max', [None]*len(daily['time']))
    daily_sources = sources.setdefault('daily', [None]*len(daily['time']))
    for i, day in enumerate(daily['time']):
        if daily_values[i] is not None:
            continue
        known = [values[k] for k, t in enumerate(hourly['time'])
                 if t[:10] == day and values[k] is not None]
        if known:
            daily_values[i] = max(known)
            daily_sources[i] = 'OpenWeather'
    sources['note'] = 'OpenWeather probabilities apply to the native forecast interval, usually three hours; daily values are the highest covered interval probability, not their sum.'
    sources['intervals'] = rows
