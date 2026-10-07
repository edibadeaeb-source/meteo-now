"""Build a complete app forecast from MET when ancillary Open-Meteo is unavailable.

Unknown UV/visibility/probabilities remain null, never invented zeroes.
Solar times and the location's civil timezone are calculated locally.
"""
import math
from bisect import bisect_right
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from astral import Observer
from astral.sun import sunrise, sunset, elevation
from tzfpy import get_tz


def met_baseline(met, current, lat, lon, now, code_for, number, origin="MET Norway"):
    points = []
    for p in (met or {}).get('properties', {}).get('timeseries', []):
        try:
            stamp = datetime.fromisoformat(p['time'].replace('Z', '+00:00')).timestamp()
            if number(p['data']['instant']['details'].get('air_temperature')) is not None:
                points.append((stamp, p['data']))
        except (KeyError, TypeError, ValueError):
            pass
    points.sort(key=lambda p: p[0])
    if len(points) < 2 or not points[0][0] - 5400 <= now <= points[-1][0]:
        raise RuntimeError('No recent MET forecast')
    name = get_tz(lon, lat)
    try:
        tz = ZoneInfo(name)
    except (ValueError, KeyError):
        tz = timezone(timedelta(seconds=(current or {}).get('timezone', 0)))
        name = None
    observer = Observer(latitude=lat, longitude=lon)
    stamps = [p[0] for p in points]
    def local(t):
        return datetime.fromtimestamp(t, tz)
    def solar(day, fn):
        try:
            return fn(observer, date=day, tzinfo=tz).isoformat(timespec='minutes')[:16]
        except ValueError:  # Polar day/night: no invented 06:00/18:00 sunrise/set.
            return None
    def daylight(t):
        return int(elevation(observer, datetime.fromtimestamp(t, timezone.utc)) >= -.833)
    def values(t):
        i = max(0, bisect_right(stamps, t)-1)
        i = min(i, len(points)-2)
        a, b = points[i], points[i+1]
        da, db = a[1]['instant']['details'], b[1]['instant']['details']
        fraction = min(1, max(0, (t-a[0])/(b[0]-a[0])))
        def field(k, scale=1):
            va, vb = number(da.get(k)), number(db.get(k))
            if va is None: return None
            return round((va if vb is None else va+(vb-va)*fraction)*scale, 2)
        interval = a[1].get('next_1_hours') or a[1].get('next_3_hours') or a[1].get('next_6_hours') or {}
        details = interval.get('details', {})
        code = interval.get('summary',{}).get('weather_code')
        if code is None: code = code_for(interval.get('summary', {}).get('symbol_code'))
        if code is None:
            clouds = field('cloud_area_fraction')
            code = 3 if clouds is None or clouds >= 85 else 2 if clouds >= 35 else 1 if clouds >= 10 else 0
        period = 1 if a[1].get('next_1_hours') else 3 if a[1].get('next_3_hours') else 6
        amount = number(details.get('precipitation_amount'))
        amount = None if amount is None else round(amount/period, 3)
        return dict(temperature_2m=field('air_temperature'), weather_code=code,
                    apparent_temperature=field('apparent_air_temperature'),
                    relative_humidity_2m=field('relative_humidity'),
                    surface_pressure=field('air_pressure_at_sea_level'),
                    wind_speed_10m=field('wind_speed', 3.6), wind_gusts_10m=field('wind_speed_of_gust',3.6),
                    wind_direction_10m=field('wind_from_direction'),
                    precipitation=amount, rain=0 if code in (71,73,75,85,86) else amount,
                    showers=0, snowfall=0, is_day=daylight(t),
                    precipitation_probability=number(details.get('probability_of_precipitation')),
                    visibility=None, uv_index=None)
    hourly = {k: [] for k in values(now)}
    hourly['time'] = []
    t = math.ceil(points[0][0]/3600)*3600
    while t < points[-1][0] and t < now + 10*86400:
        v = values(t)
        hourly['time'].append(local(t).isoformat(timespec='minutes'))
        for k in v: hourly[k].append(v[k])
        t += 3600
    today = local(now).date()
    dates = sorted(set(iso[:10] for iso in hourly['time'] if iso[:10] >= today.isoformat()))
    daily = {k: [] for k in ('time','temperature_2m_min','temperature_2m_max','weather_code',
             'sunrise','sunset','uv_index_max','precipitation_sum','precipitation_probability_max',
             'wind_speed_10m_max','wind_gusts_10m_max')}
    partial = []
    for date in dates:
        day = datetime.fromisoformat(date).date()
        indices = [i for i, iso in enumerate(hourly['time']) if iso[:10] == date]
        start = datetime.combine(day, datetime.min.time(), tzinfo=tz).timestamp()
        end = datetime.combine(day+timedelta(days=1), datetime.min.time(), tzinfo=tz).timestamp()
        full = len(indices) == round((end-start)/3600)
        if day != today and not full: continue  # Do not pad a missing final day with fictitious values.
        if not full: partial.append(date)
        def aggregate(k, fn):
            nums = [hourly[k][i] for i in indices if hourly[k][i] is not None]
            return round(fn(nums), 2) if nums else None
        temperatures = [hourly['temperature_2m'][i] for i in indices]
        # Include MET's native six-hour extrema, where the interval stays in this day.
        for stamp, record in points:
            if local(stamp).date() == day and local(stamp+6*3600-1).date() == day:
                temperatures.extend(v for k in ('air_temperature_min','air_temperature_max')
                    if (v := number(record.get('next_6_hours',{}).get('details',{}).get(k))) is not None)
        observed=number((current or {}).get('main',{}).get('temp'))
        observed_at=number((current or {}).get('dt'))
        if day==today and observed is not None and observed_at is not None and -300<=now-observed_at<=5400:
            temperatures.append(observed)
        daily['time'].append(date)
        daily['temperature_2m_min'].append(round(min(temperatures),1))
        daily['temperature_2m_max'].append(round(max(temperatures),1))
        daily['weather_code'].append(max(hourly['weather_code'][i] for i in indices))
        daily['sunrise'].append(solar(day,sunrise)); daily['sunset'].append(solar(day,sunset))
        daily['uv_index_max'].append(None)
        daily['precipitation_sum'].append(aggregate('precipitation',sum))
        daily['precipitation_probability_max'].append(aggregate('precipitation_probability',max))
        daily['wind_speed_10m_max'].append(aggregate('wind_speed_10m',max))
        daily['wind_gusts_10m_max'].append(aggregate('wind_gusts_10m',max))
    if not daily['time']: raise RuntimeError('No covered MET forecast days')
    c = values(now); c['time'] = local(now).isoformat(timespec='minutes')[:16]
    return dict(latitude=lat,longitude=lon,timezone=name,
                utc_offset_seconds=int(local(now).utcoffset().total_seconds()),
                timezone_abbreviation=local(now).tzname(),current=c,hourly=hourly,daily=daily,
                _baseline_source=origin,_partial_days=partial)


def owm_baseline(forecast,current,lat,lon,now,code_for,number,owm_code):
    points=[]
    rows=list((forecast or {}).get('list',[]))
    if current and number(current.get('dt')) is not None and -300<=now-current['dt']<=5400:
        rows.insert(0,current)
    for row in rows:
        stamp=number(row.get('dt')); main=row.get('main',{}); wind=row.get('wind',{})
        if stamp is None or number(main.get('temp')) is None: continue
        weather=(row.get('weather') or [{}])[0]
        code=owm_code(weather.get('id',804))
        amount=sum(float((row.get(k) or {}).get('3h',0)) for k in ('rain','snow'))
        probability=number(row.get('pop'))
        details=dict(air_temperature=main['temp'],apparent_air_temperature=main.get('feels_like'),
            relative_humidity=main.get('humidity'),air_pressure_at_sea_level=main.get('pressure'),
            wind_speed=wind.get('speed'),wind_speed_of_gust=wind.get('gust'),wind_from_direction=wind.get('deg'),
            cloud_area_fraction=(row.get('clouds') or {}).get('all'))
        points.append(dict(time=datetime.fromtimestamp(stamp,timezone.utc).isoformat(),
            data=dict(instant=dict(details=details),next_3_hours=dict(summary=dict(weather_code=code),
                details=dict(precipitation_amount=amount,probability_of_precipitation=
                    None if probability is None else round(probability*100,1))))))
    return met_baseline(dict(properties=dict(timeseries=points)),current,lat,lon,now,
                        code_for,number,origin='OpenWeather')
