import pathlib, sys, tempfile, unittest, requests
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from weather_service import WeatherService, normalise
from weather_probability import intervals, supplement
from test_weather_service import fixtures, Response, NOW

XML = b'''<weatherdata><forecast>
<time from="2026-10-07T12:00:00" to="2026-10-07T15:00:00"><precipitation probability="0"/></time>
<time from="2026-10-07T15:00:00" to="2026-10-07T18:00:00"><precipitation probability="0.73"/></time>
<time from="2026-10-07T18:00:00" to="2026-10-07T21:00:00"><precipitation probability="1.7"/></time>
<time from="2026-10-07T21:00:00" to="2026-10-08T00:00:00"><precipitation/></time>
</forecast></weatherdata>'''

class XMLResponse(Response):
    content=XML

class ProbabilityTests(unittest.TestCase):
    def test_native_bounds_zero_and_missing_are_not_interpolated(self):
        base,met,current=fixtures();d=normalise(base,met,current,NOW)
        d['hourly']['precipitation_probability']=[None]*len(d['hourly']['time'])
        d['daily']['precipitation_probability_max']=[None]*len(d['daily']['time'])
        supplement(d, intervals(XML))
        h=d['hourly'];at=lambda hour:h['time'].index('2026-10-07T'+hour+':00')
        self.assertIsNone(h['precipitation_probability'][at('11')])
        self.assertEqual(h['precipitation_probability'][at('12'):at('18')],[0,0,0,73,73,73])
        self.assertIsNone(h['precipitation_probability'][at('18')])
        self.assertEqual(d['daily']['precipitation_probability_max'][1],73)
        self.assertIsNone(d['daily']['precipitation_probability_max'][2])
        self.assertEqual(d['current']['temperature_2m'],23.7)

    def test_preserves_valid_other_source_probabilities(self):
        base,met,current=fixtures();d=normalise(base,met,current,NOW)
        supplement(d,intervals(XML))
        self.assertEqual(set(d['hourly']['precipitation_probability']),{42})

    def test_city_timezone_and_offset_hours(self):
        base,met,current=fixtures('America/New_York',-14400)
        d=normalise(base,met,current,NOW)
        d['hourly']['precipitation_probability']=[None]*len(d['hourly']['time'])
        supplement(d,intervals(XML))
        i=d['hourly']['time'].index('2026-10-07T08:00')
        self.assertEqual(d['hourly']['precipitation_probability'][i:i+6],[0,0,0,73,73,73])

    def test_optional_cache_is_shared_for_ten_minutes_and_per_city(self):
        calls=[]
        def get(url,**kw):calls.append(kw['params']);return XMLResponse({})
        clock=[NOW]
        with tempfile.TemporaryDirectory() as directory:
            services=[WeatherService('key',get,lambda:clock[0],directory) for _ in range(2)]
            with ThreadPoolExecutor(max_workers=12) as pool:
                results=list(pool.map(lambda i:services[i%2]._probabilities(44.983,25.644),range(30)))
            self.assertEqual(len(calls),1);self.assertTrue(all(len(r)==2 for r in results))
            clock[0]+=121;services[1]._probabilities(44.983,25.644);self.assertEqual(len(calls),1)
            services[0]._probabilities(40.7128,-74.006);self.assertEqual(len(calls),2)
            clock[0]+=600;services[1]._probabilities(44.983,25.644);self.assertEqual(len(calls),3)

    def test_optional_failure_keeps_complete_met_forecast(self):
        base,met,current=fixtures()
        def get(url,**kw):
            if 'open-meteo' in url or '/forecast' in url:raise requests.Timeout()
            return Response(met if 'met.no' in url else current)
        d=WeatherService('key',get,lambda:NOW).forecast(44.983,25.644)
        self.assertEqual(d['current']['temperature_2m'],23.7)
        self.assertGreater(len(d['hourly']['time']),180)
        self.assertTrue(all(v is None for v in d['hourly']['precipitation_probability']))

    def test_global_429_backoff_skips_other_cities(self):
        calls=[]
        def get(url,**kw):
            calls.append(url);r=requests.Response();r.status_code=429;r.headers['Retry-After']='900'
            raise requests.HTTPError(response=r)
        with tempfile.TemporaryDirectory() as directory:
            a=WeatherService('key',get,lambda:NOW,directory)
            b=WeatherService('key',get,lambda:NOW,directory)
            self.assertEqual(a._probabilities(44,25),[])
            self.assertEqual(b._probabilities(40,-74),[])
            self.assertEqual(len(calls),1)

if __name__=='__main__':unittest.main()
