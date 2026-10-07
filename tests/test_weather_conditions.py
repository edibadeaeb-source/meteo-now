import unittest
from copy import deepcopy
from weather_service import normalise,WeatherService
from test_weather_service import fixtures,Response,NOW

class ConditionsTests(unittest.TestCase):
    def test_bucharest_rain_outlier_does_not_override_dry_local_forecast(self):
        base,met,owm=fixtures()
        owm['weather']=[dict(id=500,icon='10n')];owm['rain']={'1h':.65}
        for point in met['properties']['timeseries']:
            for period in ('next_1_hours','next_6_hours'):
                if period in point['data']:
                    point['data'][period]['summary']['symbol_code']='partlycloudy_night'
                    point['data'][period]['details']['precipitation_amount']=0
        base['hourly']['precipitation_probability']=[0]*len(base['hourly']['time'])
        original=deepcopy(base);d=normalise(base,met,owm,NOW)
        self.assertEqual(d['current']['weather_code'],2)
        self.assertEqual(d['current']['precipitation'],0)
        self.assertEqual(d['current']['temperature_2m'],owm['main']['temp'])
        self.assertEqual(d['weather_sources']['current_condition'],'MET Norway')
        self.assertEqual(d['weather_sources']['current_fields']['weather_code'],'MET Norway')
        self.assertEqual(d['weather_sources']['current_fields']['temperature_2m'],'OpenWeather')
        self.assertEqual(set(d['hourly']['precipitation_probability']),{0},'do not manufacture a percentage to hide disagreements')
        self.assertEqual(base,original)

    def test_wet_met_six_hour_interval_is_an_hourly_mean(self):
        base,met,owm=fixtures()
        point=met['properties']['timeseries'][1]['data']
        point['next_6_hours']=point.pop('next_1_hours');point['next_6_hours']['details']['precipitation_amount']=3
        d=normalise(base,met,owm,NOW)
        self.assertEqual(d['current']['weather_code'],61)
        self.assertEqual(d['current']['precipitation'],.5)
        self.assertEqual(d['current']['precipitation_interval_seconds'],3600)

    def test_no_recent_or_known_met_condition_preserves_observation_backup(self):
        base,met,owm=fixtures();owm['weather']=[dict(id=500,icon='10d')];owm['rain']={'1h':.65}
        for candidate in [None,dict(properties=dict(timeseries=[]))]:
            d=normalise(base,candidate,owm,NOW)
            self.assertEqual(d['current']['weather_code'],61)
            self.assertEqual(d['current']['precipitation'],.65)
            self.assertEqual(d['weather_sources']['current_condition'],'OpenWeather')
        for point in met['properties']['timeseries']:
            for period in ('next_1_hours','next_6_hours'):
                if period in point['data']:point['data'][period]['summary']['symbol_code']='unknown'
        self.assertEqual(normalise(base,met,owm,NOW)['weather_sources']['current_condition'],'OpenWeather')

    def test_old_full_cache_is_not_reused_after_condition_policy_change(self):
        base,met,owm=fixtures();calls=[]
        def get(url,**kwargs):
            calls.append(url);return Response(met if 'met.no' in url else owm if 'openweathermap' in url else base)
        service=WeatherService('key',get,lambda:NOW)
        old=normalise(base,None,owm,NOW);del old['weather_sources']['revision']
        service.cache[(44.4268,26.1025)]=(NOW,old)
        d=service.forecast(44.4268,26.1025)
        self.assertEqual(d['weather_sources']['revision'],'2026.10.08.3')
        self.assertEqual(d['weather_sources']['current_condition'],'MET Norway')
        self.assertEqual(len(calls),3)
