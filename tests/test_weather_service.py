import sys
import pathlib
import unittest
import tempfile
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from email.utils import format_datetime
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from weather_service import WeatherService, normalise, owm_code, met_code

NOW = datetime(2026, 10, 7, 12, tzinfo=timezone.utc).timestamp()


def fixtures(tz='UTC', offset=0):
    start = datetime(2026, 10, 6)
    times = [(start + timedelta(hours=i)).isoformat(timespec='minutes') for i in range(264)]
    fields = dict(temperature_2m=30, weather_code=0, precipitation=0, rain=0, showers=0,
                  snowfall=0, precipitation_probability=42, wind_speed_10m=8, wind_gusts_10m=10,
                  visibility=15000, is_day=1)
    days = [times[i][:10] for i in range(0, len(times), 24)]
    d = dict(time=days, temperature_2m_min=[10]*11, temperature_2m_max=[40]*11,
             weather_code=[0]*11, precipitation_sum=[0]*11, precipitation_probability_max=[42]*11,
             wind_speed_10m_max=[8]*11, wind_gusts_10m_max=[10]*11,
             sunrise=[x+'T07:00' for x in days], sunset=[x+'T19:00' for x in days], uv_index_max=[3]*11)
    base = dict(timezone=tz, utc_offset_seconds=offset, hourly=dict(time=times, **{k:[v]*264 for k,v in fields.items()}),
                daily=d, current=dict(time='2026-10-07T12:00', temperature_2m=30, weather_code=0, uv_index=2, is_day=1))
    points = []
    for i in list(range(60)) + list(range(60, 216, 6)):
        t = datetime.fromtimestamp(NOW - 3600 + i*3600, timezone.utc)
        details = dict(air_temperature=20+i/100, wind_speed=5)
        period = 'next_1_hours' if i<60 else 'next_6_hours'
        points.append(dict(time=t.isoformat(), data=dict(instant=dict(details=details),
                      **{period:dict(summary=dict(symbol_code='lightrain'), details=dict(precipitation_amount=1 if i<60 else 6))})))
    met = dict(properties=dict(timeseries=points))
    owm = dict(dt=NOW-60, main=dict(temp=23.7, feels_like=24, humidity=64, pressure=1010),
               weather=[dict(id=804, icon='04d')], wind=dict(speed=3, gust=5, deg=110))
    return base, met, owm


class Response:
    def __init__(self, data, status=200, headers=None):
        self.data, self.status_code, self.headers = data, status, headers or {}
    def json(self): return deepcopy(self.data)
    def raise_for_status(self):
        if self.status_code >= 400: raise RuntimeError('HTTP error')


class WeatherTests(unittest.TestCase):
    def test_current_is_not_daily_max_and_sources_are_explicit(self):
        base, met, owm = fixtures()
        data = normalise(base, met, owm, NOW)
        self.assertEqual(data['current']['temperature_2m'],23.7)
        self.assertEqual(data['current']['weather_code'],61)
        self.assertEqual(data['weather_sources']['current_condition'],'MET Norway')
        self.assertEqual(data['weather_sources']['current_fields']['temperature_2m'],'OpenWeather')
        self.assertEqual(data['current']['wind_speed_10m'],10.8)
        self.assertEqual(data['current']['uv_index'],2)
        self.assertEqual(data['daily']['temperature_2m_max'][1],40)  # Whole current day, not future-only maximum.
        self.assertEqual(data['daily']['temperature_2m_max'][0],40)  # Yesterday retained for notifications.
        self.assertEqual(data['weather_sources']['current'],'OpenWeather')
        tomorrow = data['daily']['time'].index('2026-10-08')
        self.assertEqual(data['weather_sources']['daily'][tomorrow],'MET Norway')
        self.assertLess(data['daily']['temperature_2m_max'][tomorrow],21)
        self.assertEqual(data['hourly']['precipitation_probability'][60],42)
        self.assertEqual(base['current']['temperature_2m'],30,'do not mutate shared fallback data')

    def test_six_hour_values_are_interpolated_without_multiplying_rain(self):
        base, met, owm = fixtures()
        data=normalise(base,met,owm,NOW)
        t=datetime.fromtimestamp(NOW-3600+63*3600,timezone.utc).strftime('%Y-%m-%dT%H:%M')
        i=data['hourly']['time'].index(t)
        self.assertAlmostEqual(data['hourly']['temperature_2m'][i],20.6,places=1)
        self.assertEqual(data['hourly']['precipitation'][i],1)

    def test_missing_stale_or_unknown_current_uses_explicit_fallback(self):
        base,met,owm=fixtures()
        for current in [None,{},dict(owm,dt=NOW-7200),dict(owm,weather=[dict(id=781,icon='50d')])]:
            data=normalise(base,None,current,NOW)
            self.assertEqual(data['current']['temperature_2m'],30)
            self.assertEqual(data['weather_sources']['current'],'Open-Meteo')
        self.assertEqual(normalise(base,None,owm,NOW)['weather_sources']['daily'],['Open-Meteo']*11)

    def test_city_time_zone_and_dst_are_independent_of_server(self):
        base,met,owm=fixtures('America/New_York',-14400)
        data=normalise(base,met,owm,NOW)
        self.assertEqual(data['current']['time'],'2026-10-07T07:59')
        # On the spring DST transition, the current timestamp must skip 02:00.
        now=datetime(2026,3,8,7,10,tzinfo=timezone.utc).timestamp()
        owm['dt']=now
        self.assertEqual(normalise(base,None,owm,now)['current']['time'],'2026-03-08T03:10')

    def test_weather_classification_does_not_turn_sleet_into_clear_or_snow(self):
        self.assertEqual(owm_code(615),68)
        self.assertEqual(met_code('heavysleetshowers_night'),69)
        self.assertEqual(met_code('snowshowers_day'),85)
        self.assertEqual(met_code('rainshowersandthunder_day'),95)
        self.assertIsNone(met_code('unknown'))

    def test_cache_city_isolation_expiry_conditional_requests_and_single_flight(self):
        base,met,owm=fixtures();clock=[NOW];calls=[]
        expires=format_datetime(datetime.fromtimestamp(NOW+600,timezone.utc),usegmt=True)
        def get(url,**kw):
            calls.append((url,kw))
            if 'met.no' in url:
                return Response(met,304 if 'If-Modified-Since' in kw['headers'] else 200,
                                {'Expires':expires,'Last-Modified':expires})
            if 'openweathermap' in url:return Response(owm)
            return Response(base)
        service=WeatherService('private-key',get,lambda:clock[0])
        with ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(lambda _:service.forecast(44.9266,25.4566),range(6)))
        self.assertEqual(len(calls),3)
        clock[0]+=130;service.forecast(44.9266,25.4566)
        self.assertEqual(sum('met.no' in url for url,_ in calls),1,'respect upstream Expires')
        service.forecast(40.7128,-74.006)
        self.assertEqual(sum('met.no' in url for url,_ in calls),2,'new coordinates own cache')
        clock[0]+=600;service.forecast(44.9266,25.4566)
        self.assertIn('If-Modified-Since',[kw for url,kw in calls if 'met.no' in url][-1]['headers'])
        for a,b in [('nan',0),(91,0),(0,181),(None,25)]:
            with self.assertRaises(ValueError):service.forecast(a,b)

    def test_upstream_rate_limit_has_global_backoff(self):
        base,met,owm=fixtures();calls=[]
        def get(url,**kw):
            calls.append(url)
            return Response(None,429,{'Retry-After':'1200'}) if 'met.no' in url else Response(base)
        service=WeatherService(get=get,clock=lambda:NOW)
        self.assertEqual(service.forecast(44,25)['weather_sources']['hourly'][0],'Open-Meteo')
        service.forecast(45,26)
        self.assertEqual(sum('met.no' in url for url in calls),1)

    def test_two_workers_share_upstream_expiry_and_conditional_metadata(self):
        base,met,owm=fixtures();calls=[]
        expires=format_datetime(datetime.fromtimestamp(NOW+600,timezone.utc),usegmt=True)
        def get(url,**kw):
            calls.append(url)
            return Response(met,headers={'Expires':expires,'Last-Modified':expires})
        with tempfile.TemporaryDirectory() as directory:
            first=WeatherService(get=get,clock=lambda:NOW,cache_dir=directory)
            second=WeatherService(get=get,clock=lambda:NOW,cache_dir=directory)
            self.assertEqual(first._met(44,25),second._met(44,25))
            self.assertEqual(len(calls),1,'second worker must honour the first worker Expires')

    def test_temperature_bubbles_use_only_current_and_reuse_it_in_forecast(self):
        base,met,owm=fixtures();calls=[]
        def get(url,**kw):
            calls.append(url)
            return Response(owm if 'openweathermap' in url else met if 'met.no' in url else base)
        service=WeatherService('key',get,lambda:NOW)
        self.assertEqual(service.current_summary(44,25)['current']['temperature_2m'],23.7)
        self.assertEqual(len(calls),1,'no full forecast for a map temperature bubble')
        service.forecast(44,25)
        self.assertEqual(sum('openweathermap' in url for url in calls),1)
        self.assertEqual(len(calls),3)


if __name__=='__main__':unittest.main()
