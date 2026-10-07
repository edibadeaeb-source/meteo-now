"""Free weather sources, normalised to the app's existing forecast format.

OpenWeather supplies current conditions; MET Norway supplies covered future
hours/days. Open-Meteo supplies past/today daily extrema, solar/UV/probability
fields and a fallback. Every substituted field retains its provenance.
"""
from bisect import bisect_right
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from contextlib import contextmanager
from pathlib import Path
import hashlib
import json
import os
import math
import threading
import time
from collections import OrderedDict

import requests

UA = 'MeteoNow/2026.10.07 https://meteo-now.onrender.com/privacy.html'
CURRENT = ('temperature_2m,apparent_temperature,relative_humidity_2m,is_day,'
           'precipitation,rain,showers,snowfall,weather_code,surface_pressure,'
           'wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index')
HOURLY = ('temperature_2m,weather_code,precipitation_probability,precipitation,'
          'rain,showers,snowfall,wind_speed_10m,wind_gusts_10m,visibility,is_day')
DAILY = ('weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,'
         'uv_index_max,precipitation_sum,precipitation_probability_max,'
         'wind_speed_10m_max,wind_gusts_10m_max')


def number(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def city_date(data, stamp):
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(data['timezone'])
    except Exception:
        tz = timezone(timedelta(seconds=data.get('utc_offset_seconds', 0)))
    return datetime.fromtimestamp(stamp, tz).strftime('%Y-%m-%d')


def owm_code(code, clouds=0):
    code = int(code)
    if 200 <= code < 300:
        return 95
    if 300 <= code < 400:
        return 55 if code in (302, 312, 314) else 51
    if 500 <= code < 600:
        return 66 if code == 511 else 82 if code >= 520 else {500: 61, 501: 63}.get(code, 65)
    if 600 <= code < 700:
        return 68 if code in (611, 612, 613, 615, 616) else 85 if code >= 620 else {600: 71, 601: 73}.get(code, 75)
    if code == 800:
        return 0
    if code in (801, 802, 803, 804):
        return {801: 1, 802: 2, 803: 2, 804: 3}[code]
    if code in (701, 721, 741):
        return 45
    return None  # Smoke/dust/tornado are not silently relabelled as fair weather.


def met_code(symbol):
    symbol = str(symbol).split('_')[0]
    if 'thunder' in symbol:
        return 95
    if 'sleet' in symbol:
        return 69 if symbol.startswith('heavy') else 68
    for kind, light, medium, heavy in [('snow', 71, 73, 75), ('rain', 61, 63, 65)]:
        if kind in symbol:
            code = light if symbol.startswith('light') else heavy if symbol.startswith('heavy') else medium
            if 'showers' in symbol:
                return (85 if code != 75 else 86) if kind == 'snow' else (80 if code == 61 else 82 if code == 65 else 81)
            return code
    return {'clearsky': 0, 'fair': 1, 'partlycloudy': 2, 'cloudy': 3, 'fog': 45}.get(symbol)


class WeatherService:
    def __init__(self, key='', get=None, clock=time.time, cache_dir=None):
        self.key, self.get, self.clock = key, get, clock
        self.cache, self.met_cache = OrderedDict(), OrderedDict()
        self.current_cache = OrderedDict()
        self.lock = threading.RLock()
        self.slots = [threading.Lock() for _ in range(32)]
        self.met_slots = [threading.Lock() for _ in range(32)]
        self.current_slots = [threading.Lock() for _ in range(32)]
        self.met_backoff = 0
        self.met_request_lock = threading.Lock()
        self.met_next_request = 0
        self.cache_dir = Path(cache_dir) if cache_dir else None
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def coordinates(lat, lon):
        lat, lon = number(lat), number(lon)
        if lat is None or lon is None or not -90 <= lat <= 90 or not -180 <= lon <= 180:
            raise ValueError('Coordonate invalide')
        return round(lat, 4), round(lon, 4)

    def _store(self, cache, key, value):
        with self.lock:
            cache[key] = value
            cache.move_to_end(key)
            while len(cache) > 256:
                cache.popitem(last=False)

    def _json(self, url, params):
        response = (self.get or requests.get)(url, params=params, timeout=14, headers={'User-Agent': UA})
        response.raise_for_status()
        return response.json()

    def _owm(self, lat, lon):
        key = (lat, lon)
        with self.current_slots[hash(key) % len(self.current_slots)]:
            with self.lock:
                cached = self.current_cache.get(key)
            if cached and self.clock() - cached[0] < 120:
                return cached[1]
            if not self.key:
                return None
            data = self._json('https://api.openweathermap.org/data/2.5/weather', {
                'lat': lat, 'lon': lon, 'appid': self.key, 'units': 'metric'})
            self._store(self.current_cache, key, (self.clock(), data))
            return data

    def current_summary(self, lat, lon):
        """Temperature bubbles do not download ten days of three forecasts."""
        lat, lon = self.coordinates(lat, lon)
        with self.lock:
            cached = self.cache.get((lat, lon))
        if cached and self.clock() - cached[0] < 120:
            return {'current': deepcopy(cached[1]['current']), 'weather_sources': cached[1]['weather_sources']['current']}
        try:
            data = self._owm(lat, lon)
            stamp = number(data.get('dt'))
            temp = number(data.get('main', {}).get('temp'))
            if temp is not None and stamp is not None and -300 <= self.clock() - stamp <= 5400:
                return {'current': {'temperature_2m': temp}, 'weather_sources': 'OpenWeather'}
        except (TypeError, AttributeError, RuntimeError, requests.RequestException):
            pass
        data = self._json('https://api.open-meteo.com/v1/forecast', {
            'latitude': lat, 'longitude': lon, 'current': 'temperature_2m'})
        return {'current': data.get('current'), 'weather_sources': 'Open-Meteo'}

    def _met(self, lat, lon):
        # Share Expires/Last-Modified across production workers, outside public files.
        with self._disk_lock(lat, lon) as file:
            if file and file.exists():
                try:
                    cached = json.loads(file.read_text(encoding='utf8'))
                    if isinstance(cached.get('data', {}).get('properties', {}).get('timeseries'), list):
                        self._store(self.met_cache, (lat, lon), cached)
                except (OSError, ValueError, TypeError, AttributeError):
                    pass
            if self.cache_dir:
                try:
                    with self.lock:
                        self.met_backoff = max(self.met_backoff, float((self.cache_dir/'backoff').read_text()))
                except (OSError, ValueError):
                    pass
            result = self._met_memory(lat, lon)
            if file:
                with self.lock:
                    cached = self.met_cache.get((lat, lon))
                if cached:
                    tmp = file.with_suffix('.tmp')
                    tmp.write_text(json.dumps(cached), encoding='utf8')
                    os.replace(tmp, file)
                    files = sorted(self.cache_dir.glob('*.json'), key=lambda p: p.stat().st_mtime)
                    for old in files[:-256]:
                        if old != file:
                            try:
                                old.unlink()
                            except OSError:
                                pass
            return result

    @contextmanager
    def _disk_lock(self, lat, lon):
        if not self.cache_dir:
            yield None
            return
        key = hashlib.sha256(f'{lat:.4f},{lon:.4f}'.encode()).hexdigest()
        with (self.cache_dir/f'slot-{int(key[:4],16)%32}.lock').open('a+b') as lockfile:
            if os.name == 'nt':
                import msvcrt
                if not lockfile.tell():
                    lockfile.write(b'0');lockfile.flush()
                lockfile.seek(0);msvcrt.locking(lockfile.fileno(), msvcrt.LK_LOCK, 1)
            else:
                import fcntl
                fcntl.flock(lockfile, fcntl.LOCK_EX)
            try:
                yield self.cache_dir/(key+'.json')
            finally:
                if os.name == 'nt':
                    lockfile.seek(0);msvcrt.locking(lockfile.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(lockfile, fcntl.LOCK_UN)

    def _met_memory(self, lat, lon):
        key = (lat, lon)
        with self.met_slots[hash(key) % len(self.met_slots)]:
            with self.lock:
                cached = self.met_cache.get(key)
                backoff = self.met_backoff
            now = self.clock()
            if cached and now < cached['expires']:
                return cached['data']
            if now < backoff:
                return None
            headers = {'User-Agent': UA}
            if cached and cached.get('modified'):
                headers['If-Modified-Since'] = cached['modified']
            # Two production workers: at most 16 MET requests/second combined,
            # including a burst of distinct coordinates from the city map.
            with self.met_request_lock:
                delay = self.met_next_request - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
                self.met_next_request = time.monotonic() + .125
            r = (self.get or requests.get)('https://api.met.no/weatherapi/locationforecast/2.0/complete',
                         params={'lat': f'{lat:.4f}', 'lon': f'{lon:.4f}'}, headers=headers, timeout=14)
            if r.status_code == 429:
                retry = r.headers.get('Retry-After', '600')
                try:
                    until = now + max(600, float(retry))
                except ValueError:
                    try:
                        until = max(now + 600, parsedate_to_datetime(retry).timestamp())
                    except (ValueError, TypeError):
                        until = now + 600
                with self.lock:
                    self.met_backoff = until
                if self.cache_dir:
                    (self.cache_dir/'backoff').write_text(str(until))
                return None
            if r.status_code != 304:
                r.raise_for_status()
            data = cached['data'] if r.status_code == 304 and cached else r.json()
            if not data.get('properties', {}).get('timeseries'):
                raise ValueError('Prognoza MET indisponibilă')
            try:
                expires = max(now + 60, parsedate_to_datetime(r.headers['Expires']).timestamp())
            except (KeyError, ValueError, TypeError):
                expires = now + 600
            self._store(self.met_cache, key, {'data': data, 'expires': expires,
                         'modified': r.headers.get('Last-Modified') or (cached or {}).get('modified')})
            return data

    def forecast(self, lat, lon):
        lat, lon = self.coordinates(lat, lon)
        key = (lat, lon)
        with self.slots[hash(key) % len(self.slots)]:
            with self.lock:
                cached = self.cache.get(key)
            if cached and self.clock() - cached[0] < 120:
                data = deepcopy(cached[1])
                data['weather_sources']['today'] = city_date(data, self.clock())
                return data
            jobs = {
                'base': lambda: self._json('https://api.open-meteo.com/v1/forecast', {
                    'latitude': lat, 'longitude': lon, 'current': CURRENT, 'hourly': HOURLY,
                    'daily': DAILY, 'forecast_days': 10, 'past_days': 1, 'timezone': 'auto'}),
                'met': lambda: self._met(lat, lon),
            }
            if self.key:
                jobs['current'] = lambda: self._owm(lat, lon)
            results = {}
            with ThreadPoolExecutor(max_workers=3) as pool:
                pending = {name: pool.submit(call) for name, call in jobs.items()}
                for name, future in pending.items():
                    try:
                        results[name] = future.result()
                    except Exception:
                        results[name] = None
            base = results.get('base')
            if not base or not all(isinstance(base.get(k), dict) for k in ('current', 'hourly', 'daily')):
                # Old data is only a bounded offline fallback, never another city's cache.
                if cached and self.clock() - cached[0] < 1800:
                    data = deepcopy(cached[1])
                    data['weather_sources']['stale'] = True
                    data['weather_sources']['today'] = city_date(data, self.clock())
                    return data
                raise RuntimeError('Datele meteo nu sunt disponibile momentan')
            data = normalise(base, results.get('met'), results.get('current'), self.clock())
            self._store(self.cache, key, (self.clock(), data))
            return deepcopy(data)


def normalise(base, met, current, now):
    data = deepcopy(base)
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(data['timezone'])
    except Exception:
        tz = timezone(timedelta(seconds=data.get('utc_offset_seconds', 0)))
    def epoch(iso):
        value = datetime.fromisoformat(iso.replace('Z', '+00:00'))
        return value.replace(tzinfo=tz).timestamp() if value.tzinfo is None else value.timestamp()
    def local(stamp):
        return datetime.fromtimestamp(stamp, tz).strftime('%Y-%m-%dT%H:%M')
    sources = {'current': 'Open-Meteo', 'hourly': [], 'daily': [], 'ancillary': 'Open-Meteo',
               'ancillary_fields': ['uv_index', 'uv_index_max', 'precipitation_probability',
                                    'precipitation_probability_max', 'visibility', 'sunrise', 'sunset', 'is_day'],
               'forecast_fields': ['temperature_2m', 'weather_code', 'precipitation'],
               'wind_note': 'MET Norway where supplied; Open-Meteo otherwise',
               'hourly_note': 'MET six-hour intervals are interpolated; precipitation is an hourly mean',
               'retrieved_at': datetime.fromtimestamp(now, timezone.utc).isoformat(), 'stale': False}
    data['weather_sources'] = sources
    h, d = data['hourly'], data['daily']
    sources['hourly'] = ['Open-Meteo'] * len(h.get('time', []))
    sources['daily'] = ['Open-Meteo'] * len(d.get('time', []))
    points = []
    for p in (met or {}).get('properties', {}).get('timeseries', []):
        try:
            details = p['data']['instant']['details']
            if number(details.get('air_temperature')) is None:
                continue
            points.append((epoch(p['time']), p['data']))
        except (KeyError, ValueError, TypeError):
            continue
    points.sort(key=lambda p: p[0])
    stamps = [p[0] for p in points]
    def interpolate(t, field):
        i = bisect_right(stamps, t) - 1
        if i < 0 or i >= len(points) - 1 or not 0 < stamps[i + 1] - stamps[i] <= 6 * 3600:
            return None
        a, b = (number(points[j][1]['instant']['details'].get(field)) for j in (i, i + 1))
        if a is None or b is None:
            return None
        return a + (b - a) * (t - stamps[i]) / (stamps[i + 1] - stamps[i])
    for i, iso in enumerate(h.get('time', [])):
        t = epoch(iso)
        j = bisect_right(stamps, t) - 1
        temp = interpolate(t, 'air_temperature')
        if temp is None:
            continue
        p = points[j][1]
        interval = p.get('next_1_hours') or p.get('next_6_hours')
        if not interval:
            continue
        code = met_code(interval.get('summary', {}).get('symbol_code'))
        if code is None:
            continue
        h['temperature_2m'][i] = round(temp, 1)
        h['weather_code'][i] = code
        for field, source in [('wind_speed_10m', 'wind_speed'), ('wind_gusts_10m', 'wind_speed_of_gust')]:
            value = interpolate(t, source)
            if value is not None and field in h:
                h[field][i] = round(value * 3.6, 1)
        period = 1 if p.get('next_1_hours') else 6
        rain = number(interval.get('details', {}).get('precipitation_amount'))
        if rain is not None:
            h['precipitation'][i] = round(rain / period, 3)
            # Derived hourly mean for a native six-hour amount; not a rain probability.
            if 'rain' in h:
                h['rain'][i] = 0 if code in (71, 73, 75, 85, 86) else h['precipitation'][i]
            if 'showers' in h:
                h['showers'][i] = 0
            if 'snowfall' in h:
                h['snowfall'][i] = 0  # MET gives water equivalent, not snow depth.
        sources['hourly'][i] = 'MET Norway'
    today = local(now)[:10]
    sources['today'] = today
    for i, date in enumerate(d.get('time', [])):
        indices = [j for j, iso in enumerate(h.get('time', [])) if iso[:10] == date]
        if date <= today or len(indices) < 23 or any(sources['hourly'][j] != 'MET Norway' for j in indices):
            continue  # Today's full-day extrema must include the already elapsed hours.
        temps = [h['temperature_2m'][j] for j in indices]
        for t, p in points:
            next6 = p.get('next_6_hours', {}).get('details', {})
            if local(t)[:10] == date and local(t + 6 * 3600 - 1)[:10] == date:
                temps.extend(v for k in ('air_temperature_min', 'air_temperature_max')
                             if (v := number(next6.get(k))) is not None)
        d['temperature_2m_min'][i], d['temperature_2m_max'][i] = round(min(temps), 1), round(max(temps), 1)
        d['weather_code'][i] = max(h['weather_code'][j] for j in indices)
        d['precipitation_sum'][i] = round(sum(h['precipitation'][j] for j in indices), 1)
        for field in ('wind_speed_10m', 'wind_gusts_10m'):
            if field in h and field + '_max' in d:
                d[field + '_max'][i] = max(h[field][j] for j in indices)
        sources['daily'][i] = 'MET Norway'
    try:
        stamp = number(current.get('dt'))
        main, wind, weather = current['main'], current.get('wind', {}), current['weather'][0]
        code = owm_code(weather['id'])
        if stamp is not None and -300 <= now - stamp <= 5400 and code is not None and number(main.get('temp')) is not None:
            c = data['current']
            c.update(time=local(stamp), temperature_2m=main['temp'], weather_code=code,
                     is_day=0 if str(weather.get('icon', '')).endswith('n') else
                     1 if str(weather.get('icon', '')).endswith('d') else c.get('is_day'))
            for field, value in [('apparent_temperature', main.get('feels_like')),
                                 ('relative_humidity_2m', main.get('humidity')),
                                 ('surface_pressure', main.get('pressure')),
                                 ('wind_speed_10m', number(wind.get('speed'))),
                                 ('wind_gusts_10m', number(wind.get('gust', wind.get('speed')))),
                                 ('wind_direction_10m', wind.get('deg'))]:
                if number(value) is not None:
                    c[field] = round(float(value) * (3.6 if field in ('wind_speed_10m', 'wind_gusts_10m') else 1), 2)
            c['precipitation'] = float(current.get('rain', {}).get('1h', 0)) + float(current.get('snow', {}).get('1h', 0))
            c['rain'], c['showers'], c['snowfall'] = current.get('rain', {}).get('1h', 0), 0, 0
            sources['current'] = 'OpenWeather'
    except (KeyError, TypeError, ValueError, AttributeError):
        pass
    return data
