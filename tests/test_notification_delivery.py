import json
import sys
import types
import unittest
from unittest.mock import patch, MagicMock
import test_ai_context as fixtures
meteo = fixtures.meteo


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.sub = {'endpoint': 'https://push.example.test/abc',
                    'keys': {'auth': 'auth', 'p256dh': 'key'},
                    'lat': 44.9266, 'lon': 25.4566, 'nume': 'Moreni', 'tara': 'RO', 'admin': 'Dâmbovița'}
        self.storage = {'push_subs': {'a': self.sub}, 'push_weather_state': {}}

    def fb(self, path, method='GET', payload=None):
        if method == 'PUT':
            self.storage[path] = payload
            return payload
        if method == 'DELETE':
            self.storage.pop(path, None)
            return None
        return self.storage.get(path)

    def test_offline_phone_gets_delivery_window_and_bounded_network_wait(self):
        send = MagicMock()
        lib = types.SimpleNamespace(webpush=send, WebPushException=type('PushError', (Exception,), {}))
        with patch.dict(sys.modules, {'pywebpush': lib}):
            self.assertEqual(meteo._send_push(self.sub, {'title': 'Moreni | Ploaie', 'ttl': 1800}), (True, 200))
        self.assertEqual(send.call_args.kwargs['ttl'], 1800)
        self.assertEqual(send.call_args.kwargs['timeout'], 10)
        self.assertEqual(send.call_args.kwargs['headers']['Urgency'], 'normal')

    def test_calm_code_with_high_rain_probability_can_warn(self):
        p = fixtures.NotificationCopyTests.event_forecast(0, 0, [0] * 6, [5, 75, 80, 10, 5, 5])
        event = meteo._compune_eveniment_meteo(p, nume='Moreni')
        self.assertEqual(event['kind'], 'rain_start')

    def test_incomplete_hours_never_claim_rain_will_stop(self):
        p = fixtures.NotificationCopyTests.event_forecast(63, .7)
        p['hourly'].pop('weather_code')
        p['hourly'].pop('precipitation_probability')
        self.assertNotEqual(meteo._compune_eveniment_meteo(p)['kind'], 'rain_end')
        self.assertNotIn('continue', meteo._compune_eveniment_meteo(p)['body'])

    def test_missing_future_hours_do_not_rearm_a_weather_episode(self):
        p = fixtures.NotificationCopyTests.event_forecast()
        p['hourly']['time'] = ['2026-09-21T19:00']
        self.storage['push_weather_state'] = {'a': {'lastSent': 1000, 'kind': 'rain_now'}}
        with patch.object(meteo, '_fb', side_effect=self.fb), patch.object(meteo, '_prognoza_evenimente', return_value=p):
            result = meteo._push_weather_intern()
        self.assertEqual(result['faraDate'], 1)
        self.assertNotIn('push_weather_state/a', self.storage)

    def test_new_end_forecast_is_not_blocked_for_six_hours(self):
        old = {'location': 'RO:moreni', 'kind': 'rain_end', 'fingerprint': 'rain_end:old', 'lastSent': 1000}
        event = {'kind': 'rain_end', 'fingerprint': 'rain_end:new'}
        self.assertTrue(meteo._weather_should_send(event, old, 'RO:moreni', 5000))
        self.assertFalse(meteo._weather_should_send(event, old, 'RO:moreni', 1500))

    def test_episode_rearms_only_after_sustained_quiet(self):
        old = {'location': 'RO:moreni', 'kind': 'rain_end', 'fingerprint': 'same',
               'lastSent': 1000, 'quietSince': 1500}
        event = {'kind': 'rain_end', 'fingerprint': 'same'}
        self.assertFalse(meteo._weather_should_send(event, old, 'RO:moreni', 1600))
        self.assertTrue(meteo._weather_should_send(event, old, 'RO:moreni', 7000))

    def test_failed_delivery_is_retried_and_not_recorded_as_sent(self):
        p = fixtures.NotificationCopyTests.event_forecast(63, .7)
        with patch.object(meteo, '_fb', side_effect=self.fb), \
                patch.object(meteo, '_prognoza_evenimente', return_value=p), \
                patch.object(meteo, '_send_push', return_value=(False, 503)) as send:
            first = meteo._push_weather_intern()
            second = meteo._push_weather_intern()
        self.assertEqual(first['trimise'], 0)
        self.assertEqual(second['eroriLivrare'], 1)
        self.assertEqual(send.call_count, 2)
        self.assertNotIn('push_weather_state/a', self.storage)

    def test_nearby_subscribers_share_forecast_and_are_deduplicated(self):
        self.storage['push_subs']['b'] = dict(self.sub)
        p = fixtures.NotificationCopyTests.event_forecast(63, .7)
        with patch.object(meteo, '_fb', side_effect=self.fb), \
                patch.object(meteo, '_prognoza_evenimente', return_value=p) as forecast, \
                patch.object(meteo, '_send_push', return_value=(True, 200)) as send:
            self.assertEqual(meteo._push_weather_intern()['trimise'], 2)
            forecast.assert_called_once()
            self.storage['push_weather_state'] = {key: self.storage['push_weather_state/' + key] for key in ('a', 'b')}
            self.assertEqual(meteo._push_weather_intern()['duplicate'], 2)
            self.assertEqual(send.call_count, 2)

    def test_one_legacy_or_invalid_location_does_not_abort_other_subscribers(self):
        self.storage['push_subs']['bad'] = {'endpoint': 'https://push.example.test/bad', 'lat': 'NaN', 'lon': 1}
        with patch.object(meteo, '_fb', side_effect=self.fb), \
                patch.object(meteo, '_prognoza_evenimente', return_value=fixtures.NotificationCopyTests.event_forecast()), \
                patch.object(meteo, '_send_push') as send:
            result = meteo._push_weather_intern()
        self.assertEqual(result['faraLocatie'], 1)
        self.assertEqual(result['abonati'], 1)
        send.assert_not_called()

    def test_test_button_sends_only_to_the_matching_subscription(self):
        self.storage['push_subs/' + meteo._sub_key(self.sub['endpoint'])] = self.sub
        with patch.object(meteo, '_fb', side_effect=self.fb), patch.object(meteo, '_send_push', return_value=(True, 200)) as send:
            client = meteo.app.test_client()
            response = client.post('/api/push/test-device', json={'endpoint': self.sub['endpoint'], 'keys': self.sub['keys']})
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.get_json()['accepted'])
            send.assert_called_once()
            self.assertEqual(client.post('/api/push/test-device', json={'endpoint': self.sub['endpoint'], 'keys': {'auth': 'wrong'}}).status_code, 403)
            self.assertEqual(send.call_count, 1)

    def test_android_result_roundtrip_is_correlated_and_not_cached(self):
        body = {'id': 'b' * 64, 'requestId': 'a' * 32, 'status': 'denied'}
        with patch.object(meteo, '_fb', side_effect=self.fb):
            client = meteo.app.test_client()
            self.assertEqual(client.post('/api/push/android-status', json=body).status_code, 200)
            response = client.get('/api/push/android-status?id=' + body['id'])
        self.assertEqual(response.get_json()['state']['requestId'], body['requestId'])
        self.assertEqual(response.get_json()['state']['status'], 'denied')
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_turning_off_requires_confirmed_server_deletion(self):
        client = meteo.app.test_client()
        with patch.object(meteo, '_fb', return_value=None):
            self.assertEqual(client.post('/api/push/unsubscribe', json={'endpoint': self.sub['endpoint']}).status_code, 503)
        with patch.object(meteo, '_fb', return_value=True):
            self.assertEqual(client.post('/api/push/unsubscribe', json={'endpoint': self.sub['endpoint']}).status_code, 200)

    def test_test_button_rejects_malformed_requests_and_cooldown(self):
        client = meteo.app.test_client()
        self.assertEqual(client.post('/api/push/test-device', json=['bad']).status_code, 400)
        self.assertEqual(client.post('/api/push/android-status', json=['bad']).status_code, 400)
        key = meteo._sub_key(self.sub['endpoint'])
        self.storage['push_subs/' + key] = self.sub
        self.storage['push_test_state/' + key] = {'at': meteo.time.time()}
        with patch.object(meteo, '_fb', side_effect=self.fb), patch.object(meteo, '_send_push') as send:
            self.assertEqual(client.post('/api/push/test-device', json={'endpoint': self.sub['endpoint'], 'keys': self.sub['keys']}).status_code, 429)
        send.assert_not_called()

    def test_anm_warning_uses_county_and_retries_failed_delivery(self):
        self.storage['push_subs']['buc'] = {**self.sub, 'nume': 'București', 'admin': 'Bucuresti', 'judet': 'B'}
        self.storage['push_subs']['foreign'] = {**self.sub, 'nume': 'New York', 'tara': 'US'}
        data = {'avertizare': [{'numeTipMesaj': 'Cod galben', 'fenomeneVizate': 'ploi',
                               'intervalul': 'azi', 'judet': [{'cod': 'DB', 'culoare': '1'}]}]}
        with patch.object(meteo.requests, 'get') as get, patch.object(meteo, '_fb', side_effect=self.fb), \
                patch.object(meteo, '_send_push', return_value=(False, 503)) as send, meteo.app.app_context():
            get.return_value.json.return_value = data
            meteo._push_check_intern()
            meteo._push_check_intern()
        self.assertEqual(send.call_count, 2)
        self.assertEqual(send.call_args.args[0]['nume'], 'Moreni')
        self.assertNotIn('push_anm_state/a', self.storage)


if __name__ == '__main__':
    unittest.main()
