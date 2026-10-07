import pathlib,sys,tempfile,time,unittest,threading,requests
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime,timezone,timedelta
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from weather_service import WeatherService
from test_weather_service import fixtures,Response,NOW


def limited():
    r=requests.Response();r.status_code=429;r.headers['Retry-After']='600'
    return requests.HTTPError('Provider throttled',response=r)

class ResilienceTests(unittest.TestCase):
    def test_met_forecast_without_open_meteo_is_complete_and_truthful(self):
        base,met,owm=fixtures();calls=[]
        def get(url,**kw):
            calls.append(url)
            if 'open-meteo' in url:raise limited()
            return Response(met if 'met.no' in url else owm)
        s=WeatherService('key',get,lambda:NOW)
        d=s.forecast(44.983,25.644)
        self.assertEqual(d['weather_sources']['current'],'OpenWeather')
        self.assertTrue(d['weather_sources']['fallback'])
        self.assertEqual(d['timezone'],'Europe/Bucharest')
        self.assertGreater(len(d['hourly']['time']),180)
        self.assertGreater(len(d['daily']['time']),6)
        self.assertEqual(set(d['weather_sources']['hourly']),{'MET Norway'})
        self.assertEqual(d['current']['temperature_2m'],23.7)
        self.assertIsNone(d['current']['uv_index'])
        self.assertTrue(all(v is None for v in d['hourly']['visibility']))
        self.assertTrue(all(v is None for v in d['hourly']['precipitation_probability']))
        self.assertIn(d['weather_sources']['today'],d['weather_sources']['partial_days'])
        self.assertIn('T07:',d['daily']['sunrise'][0])
        self.assertGreaterEqual(d['daily']['temperature_2m_max'][0],23.7)
        s.forecast(44.914,25.701)
        self.assertEqual(sum('open-meteo' in u for u in calls),1,'429 backoff protects every city')

    def test_owm_forecast_when_both_other_providers_fail(self):
        base,met,owm=fixtures()
        rows=[]
        for i in range(1,41):
            row=deepcopy(owm);row['dt']=NOW+i*3*3600;row['main']['temp']=10+i/10
            row['pop']=.35;row['rain']={'3h':3};rows.append(row)
        def get(url,**kw):
            if 'open-meteo' in url or 'met.no' in url:raise limited()
            return Response({'list':rows} if '/forecast' in url else owm)
        d=WeatherService('key',get,lambda:NOW).forecast(40.7128,-74.006)
        self.assertEqual(d['timezone'],'America/New_York')
        self.assertEqual(d['current']['temperature_2m'],23.7)
        self.assertEqual(set(d['weather_sources']['hourly']),{'OpenWeather'})
        self.assertEqual(len(d['daily']['time']),5)
        self.assertTrue(all(x in (None,35) for x in d['hourly']['precipitation_probability']))
        self.assertAlmostEqual(d['hourly']['precipitation'][5],1)
        self.assertIsNone(d['current']['uv_index'])

    def test_shared_cache_coalesces_200_requests_between_two_server_instances(self):
        base,met,owm=fixtures();calls=[];lock=threading.Lock()
        def get(url,**kw):
            with lock:calls.append(url)
            time.sleep(.02)
            return Response(met if 'met.no' in url else owm if 'openweathermap' in url else base)
        with tempfile.TemporaryDirectory() as directory:
            services=[WeatherService('key',get,lambda:NOW,cache_dir=directory) for _ in range(2)]
            with ThreadPoolExecutor(max_workers=32) as pool:
                results=list(pool.map(lambda i:services[i%2].forecast(44.983,25.644),range(200)))
            self.assertEqual(len(calls),3,'two workers share a single assembly of all three sources')
            self.assertTrue(all(d['current']['temperature_2m']==23.7 for d in results))
            services[1].forecast(40.7128,-74.006)
            self.assertEqual(len(calls),6,'different locations must remain separate')
            self.assertEqual(len(list((pathlib.Path(directory)/'forecasts').glob('*.json'))),2)

    def test_incomplete_met_response_still_uses_the_next_reserve(self):
        base,met,owm=fixtures()
        rows=[]
        for i in range(1,41):
            row=deepcopy(owm);row['dt']=NOW+i*3*3600;rows.append(row)
        met['properties']['timeseries']=met['properties']['timeseries'][:1]
        def get(url,**kw):
            if 'open-meteo' in url:raise limited()
            return Response(met if 'met.no' in url else {'list':rows} if '/forecast' in url else owm)
        d=WeatherService('key',get,lambda:NOW).forecast(44.983,25.644)
        self.assertEqual(set(d['weather_sources']['hourly']),{'OpenWeather'})
        self.assertGreaterEqual(len(d['daily']['time']),4)

    def test_met_only_with_unknown_optional_fields_and_polar_night(self):
        base,met,owm=fixtures()
        def get(url,**kw):
            if 'open-meteo' in url:raise limited()
            return Response(met)
        d=WeatherService(get=get,clock=lambda:NOW).forecast(44.983,25.644)
        self.assertEqual(d['weather_sources']['current'],'MET Norway')
        self.assertIsNone(d['current']['apparent_temperature'])
        self.assertIsNone(d['daily']['wind_gusts_10m_max'][1])
        from weather_fallback import met_baseline
        from weather_service import met_code,number
        delta=datetime(2026,12,7,12,tzinfo=timezone.utc).timestamp()-NOW
        winter=deepcopy(met)
        for p in winter['properties']['timeseries']:
            t=datetime.fromisoformat(p['time']);p['time']=(t+timedelta(seconds=delta)).isoformat()
        d=met_baseline(winter,None,78.22,15.65,NOW+delta,met_code,number)
        self.assertEqual(d['current']['is_day'],0)
        self.assertIsNone(d['daily']['sunrise'][0])

if __name__=='__main__':unittest.main()
