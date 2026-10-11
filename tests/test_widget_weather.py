from copy import deepcopy
from datetime import datetime, timezone
import unittest
from unittest.mock import patch, MagicMock

import test_ai_context as fixture
from widget_weather import condition, current_widget

meteo = fixture.meteo
NOW = datetime(2026, 10, 11, 18, tzinfo=timezone.utc).timestamp()


def forecast(code=63, day=0, tz='Europe/Bucharest'):
    return {
        'timezone': tz, 'utc_offset_seconds': 10800,
        'current': {'temperature_2m': 20.11, 'weather_code': code, 'is_day': day,
                    'apparent_temperature': 19.14, 'relative_humidity_2m': 37,
                    'wind_speed_10m': 10.22, 'precipitation': .6},
        'hourly': {'time': ['2026-10-11T21:00'], 'weather_code': [code]},
        'daily': {'time': ['2026-10-10', '2026-10-11', '2026-10-12'],
                  'temperature_2m_min': [99, 10, 11], 'temperature_2m_max': [99, 22, 23],
                  'weather_code': [3, code, 2],
                  'sunrise': ['2026-10-10T07:00', '2026-10-11T07:00', '2026-10-12T07:00'],
                  'sunset': ['2026-10-10T18:30', '2026-10-11T18:30', '2026-10-12T18:30']},
        'weather_sources': {'today': '2026-10-11', 'current': 'OpenWeather',
                            'current_condition': 'MET Norway', 'stale': False,
                            'retrieved_at': '2026-10-11T18:00:00+00:00',
                            'hourly': ['MET Norway'], 'daily': ['Open-Meteo'] * 3},
    }


class ProjectionTests(unittest.TestCase):
    def test_moreni_current_rain_at_night_uses_same_code_and_values_as_mobile(self):
        data = forecast()
        untouched = deepcopy(data)
        out = current_widget(data, NOW)
        self.assertEqual((out['icon'], out['fundal'], out['descriere']), ('ploaie', 'ploaie', 'Ploaie'))
        self.assertEqual(out['weatherCode'], data['current']['weather_code'])
        self.assertEqual((out['tempText'], out['resimtit'], out['vant']), ('20°', 19, 10))
        self.assertEqual(out['weatherSources']['current_condition'], 'MET Norway')
        self.assertEqual(out['actualizat'], '21:00')
        self.assertEqual(data, untouched)

    def test_all_precipitation_and_fog_conditions_win_over_sunrise_sunset(self):
        stamp = datetime(2026, 10, 11, 15, 30, tzinfo=timezone.utc).timestamp()
        for day in (0, 1):
            for code, icon, theme in [(51,'burnita','ploaie'), (56,'burnita','ploaie'),
                    (61,'ploaie','ploaie'), (67,'ploaie','ploaie'), (68,'lapovita','ninsoare'),
                    (71,'ninsoare','ninsoare'), (82,'ploaie','ploaie'), (86,'ninsoare','ninsoare'),
                    (95,'furtuna','furtuna'), (99,'furtuna','furtuna'), (45,'ceata','ceata')]:
                with self.subTest(code=code, day=day):
                    out = current_widget(forecast(code, day), stamp)
                    self.assertEqual((out['icon'], out['fundal']), (icon, theme))

    def test_clear_partial_and_overcast_are_distinct_day_and_night(self):
        for code, day, icon, theme in [(0,0,'luna','noapte'), (0,1,'soare','zi'),
                (2,0,'partial','noapte'), (2,1,'partial','zi'), (3,0,'nor','noapte'), (3,1,'nor','noros')]:
            with self.subTest(code=code, day=day):
                out = current_widget(forecast(code, day), NOW)
                self.assertEqual((out['icon'], out['fundal']), (icon, theme))

    def test_sunset_only_for_fair_sky_and_today_solar_values(self):
        stamp = datetime(2026, 10, 11, 15, 30, tzinfo=timezone.utc).timestamp()
        self.assertEqual(current_widget(forecast(2, 1), stamp)['fundal'], 'apus')
        self.assertEqual(current_widget(forecast(3, 1), stamp)['fundal'], 'noros')

    def test_new_york_uses_local_timezone_and_keeps_old_retrieval_time(self):
        data = forecast(0, 1, 'America/New_York')
        data['weather_sources'].update(stale=True, retrieved_at='2026-10-11T16:00:00Z')
        out = current_widget(data, NOW)
        self.assertEqual(out['actualizat'], '12:00')
        self.assertTrue(out['dateSalvate'])

    def test_missing_condition_is_not_labelled_clear_and_missing_temp_is_not_zero(self):
        for code in (None, -1, 4, 49, 100, float('nan')):
            self.assertEqual(condition(code), ('nor', 'Stare indisponibilă'))
        data = forecast()
        data['current']['temperature_2m'] = None
        with self.assertRaises(ValueError): current_widget(data, NOW)


class RouteTests(unittest.TestCase):
    def setUp(self):
        meteo._widget_cache.clear()

    @patch.object(meteo.requests, 'get')
    @patch.object(meteo._weather_service, 'forecast')
    def test_mobile_and_widget_share_current_snapshot_without_second_provider_call(self, shared, get):
        shared.return_value = forecast()
        get.return_value = MagicMock()
        get.return_value.json.return_value = {'avertizare': []}
        client = meteo.app.test_client()
        mobile = client.get('/api/weather/forecast?latitude=44.983&longitude=25.644').get_json()
        widget = client.get('/api/widget?lat=44.983&lon=25.644&oras=Moreni&admin=Dambovita&country=RO').get_json()
        self.assertEqual(widget['weatherCode'], mobile['current']['weather_code'])
        self.assertEqual(widget['tempText'], f"{round(mobile['current']['temperature_2m'])}°")
        self.assertEqual(widget['icon'], 'ploaie')
        self.assertEqual(widget['maxAzi'], 22)
        self.assertEqual(widget['zile'][0]['max'], 23)
        self.assertEqual(get.call_count, 1)
        self.assertIn('meteoromania.ro', get.call_args.args[0])

    @patch.object(meteo.requests, 'get')
    @patch.object(meteo._weather_service, 'forecast')
    def test_warning_cache_never_freezes_current_weather_for_five_minutes(self, shared, get):
        first, second = forecast(2), forecast(63)
        shared.side_effect = [first, second]
        get.return_value.json.return_value = {'avertizare': []}
        client = meteo.app.test_client()
        path = '/api/widget?lat=44.983&lon=25.644&oras=Moreni&admin=Dambovita&country=RO'
        self.assertEqual(client.get(path).get_json()['icon'], 'partial')
        self.assertEqual(client.get(path).get_json()['icon'], 'ploaie')
        self.assertEqual(shared.call_count, 2)
        self.assertEqual(get.call_count, 1, 'reuse warnings without independent weather cache')

    @patch.object(meteo.requests, 'get')
    @patch.object(meteo._weather_service, 'forecast', side_effect=RuntimeError('unavailable'))
    def test_failure_is_non_success_to_preserve_native_last_good_cache(self, shared, get):
        response = meteo.app.test_client().get('/api/widget?lat=44.983&lon=25.644&country=US')
        self.assertEqual(response.status_code, 502)
        self.assertNotIn('temp', response.get_json())
        get.assert_not_called()
        self.assertEqual(len(meteo._widget_cache), 0)


if __name__ == '__main__': unittest.main()
