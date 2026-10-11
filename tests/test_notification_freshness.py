import copy
import unittest
from datetime import datetime
from unittest.mock import patch

import test_ai_context as fixtures
from notification_weather import fresh_forecast

meteo = fixtures.meteo
NOW = datetime.fromisoformat('2026-09-22T16:22:00+00:00').timestamp()


class NotificationFreshnessTests(unittest.TestCase):
    def forecast(self):
        return fixtures.NotificationCopyTests.event_forecast(63, .7)

    def test_local_time_and_utc_offset_describe_same_current_weather(self):
        p = self.forecast()
        self.assertTrue(fresh_forecast(p, NOW))
        p.pop('timezone')
        p['utc_offset_seconds'] = 10800
        self.assertTrue(fresh_forecast(p, NOW))
        p['current']['time'] = '2026-09-22T16:22:00+00:00'
        self.assertTrue(fresh_forecast(p, NOW))

    def test_stale_old_future_and_undated_data_are_not_current_alerts(self):
        for changes in [
            {'stale': True}, {'retrieved_at': '2026-09-22T15:00:00+00:00'},
            {'retrieved_at': '2026-09-23T16:22:00+00:00'},
            {'retrieved_at': 'invalid'}, {'retrieved_at': '2026-09-22T16:22'},
        ]:
            with self.subTest(changes=changes):
                p = self.forecast()
                p['weather_sources'].update(changes)
                self.assertFalse(fresh_forecast(p, NOW))
        p = self.forecast()
        p.pop('weather_sources')
        self.assertFalse(fresh_forecast(p, NOW))
        p = self.forecast()
        p['current']['time'] = '2026-09-22T12:00'
        self.assertFalse(fresh_forecast(p, NOW))

    def test_new_york_time_is_not_interpreted_as_romanian_time(self):
        p = self.forecast()
        p['timezone'] = 'America/New_York'
        p['current']['time'] = '2026-09-22T12:22'
        self.assertTrue(fresh_forecast(p, NOW))

    def test_event_uses_current_condition_time_not_older_temperature_observation(self):
        p = self.forecast()
        p['current']['time'] = '2026-09-22T18:00'
        p['weather_sources']['current_condition_time'] = '2026-09-22T19:22'
        event = meteo._compune_eveniment_meteo(p)
        self.assertEqual(event['kind'], 'rain_end')
        # First dry forecast is 20:00, within the next hour from condition time.
        self.assertIn('în următoarea oră', event['body'])

    def test_stale_data_cannot_send_or_rearm_an_episode(self):
        p = self.forecast()
        p['weather_sources']['stale'] = True
        def storage(path, *args, **kwargs):
            return {'a': {'endpoint': 'https://fcm.googleapis.com/test', 'lat': 45, 'lon': 25}} if path == 'push_subs' else {}
        with patch.object(meteo.time, 'time', return_value=NOW), \
             patch.object(meteo, '_fb', side_effect=storage) as fb, \
             patch.object(meteo, '_prognoza_evenimente', return_value=p), \
             patch.object(meteo, '_send_push') as send:
            result = meteo._push_weather_intern()
        self.assertEqual(result['faraDate'], 1)
        send.assert_not_called()
        self.assertFalse(any(len(c.args) > 1 for c in fb.call_args_list))

    def test_dedup_storage_outage_aborts_instead_of_repeating_notifications(self):
        def storage(path, *args, **kwargs):
            return {'a': {'endpoint': 'https://fcm.googleapis.com/test', 'lat': 45, 'lon': 25}} if path == 'push_subs' else False
        with patch.object(meteo, '_fb', side_effect=storage), patch.object(meteo, '_send_push') as send:
            self.assertFalse(meteo._push_weather_intern()['ok'])
        send.assert_not_called()

    def test_summary_matches_dates_with_and_without_yesterday(self):
        p = fixtures.NotificationCopyTests.forecast()
        expected_today = meteo._compune_rezumat(p, 'dimineata', 'ro', 'C', 'Moreni')
        expected_tomorrow = meteo._compune_rezumat(p, 'seara', 'ro', 'C', 'Moreni')
        without = copy.deepcopy(p)
        without['daily'] = {k: v[1:] for k, v in p['daily'].items()}
        # Yesterday's comparison disappears, but today's temperature stays 18.
        today = meteo._compune_rezumat(without, 'dimineata', 'ro', 'C', 'Moreni')
        self.assertEqual(today[0], expected_today[0])
        self.assertIn('18°C', today[1])
        self.assertEqual(meteo._compune_rezumat(without, 'seara', 'ro', 'C', 'Moreni'), expected_tomorrow)

    def test_summary_skips_missing_target_day_and_missing_temperature(self):
        p = fixtures.NotificationCopyTests.forecast()
        p['daily']['time'][1] = '2026-09-24'
        self.assertIsNone(meteo._compune_rezumat(p, 'dimineata', 'ro', 'C', 'Moreni'))
        for value in [None, float('nan'), float('inf')]:
            p = fixtures.NotificationCopyTests.forecast()
            p['daily']['temperature_2m_min'][1] = value
            self.assertIsNone(meteo._compune_rezumat(p, 'dimineata', 'ro', 'C', 'Moreni'))

    def test_summary_and_anm_skip_unavailable_deduplication_storage(self):
        sub = {'endpoint': 'https://fcm.googleapis.com/test', 'lat': 45, 'lon': 25,
               'nume': 'Moreni', 'tara': 'RO', 'admin': 'Dâmbovița'}
        def storage(path, *args, **kwargs):
            return {'a': sub} if path == 'push_subs' else False
        p = fixtures.NotificationCopyTests.forecast()
        p.update(timezone='Europe/Bucharest', weather_sources=self.forecast()['weather_sources'])
        with patch.object(meteo.time, 'time', return_value=NOW), \
             patch.object(meteo, '_fb', side_effect=storage), \
             patch.object(meteo, '_prognoza_scurta', return_value=p), \
             patch.object(meteo.requests, 'get') as get, \
             patch.object(meteo, '_send_push') as send, meteo.app.app_context():
            self.assertEqual(meteo._rezumat_intern('dimineata').get_json()['trimise'], 0)
            get.return_value.json.return_value = {'avertizare': []}
            self.assertFalse(meteo._push_check_intern().get_json()['ok'])
        send.assert_not_called()

    def test_newly_retrieved_stale_summary_is_not_sent(self):
        p = fixtures.NotificationCopyTests.forecast()
        p.update(timezone='Europe/Bucharest', weather_sources={**self.forecast()['weather_sources'], 'stale': True})
        def storage(path, *args, **kwargs):
            return {'a': {'endpoint': 'https://fcm.googleapis.com/test', 'lat': 45, 'lon': 25}} if path == 'push_subs' else None
        with patch.object(meteo, '_fb', side_effect=storage), \
             patch.object(meteo, '_prognoza_scurta', return_value=p), \
             patch.object(meteo, '_send_push') as send, meteo.app.app_context():
            self.assertEqual(meteo._rezumat_intern('dimineata').get_json()['faraDate'], 1)
        send.assert_not_called()


if __name__ == '__main__':
    unittest.main()
