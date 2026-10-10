import base64
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch, MagicMock

from flask import Flask, jsonify
from security import BudgetStore, client_ip, cron_authorized, install_security, public_file, valid_push_endpoint
import test_ai_context as fixtures

meteo = fixtures.meteo


def subscription():
    enc = lambda x: base64.urlsafe_b64encode(x).decode().rstrip('=')
    return dict(endpoint='https://fcm.googleapis.com/fcm/send/security-fixture',
                keys={'auth': enc(bytes(16)), 'p256dh': enc(b'\x04' + bytes(64))},
                lat=44.4268, lon=26.1025, nume='București')


class StaticBoundaryTests(unittest.TestCase):
    def test_private_files_are_never_served(self):
        client = meteo.app.test_client()
        for path in ['/app.py', '/security.py', '/keys.py', '/.git/HEAD', '/.env', '/requirements.txt',
                     '/tests/test_security.py', '/cache_clima/a.json', '/exported_data/a.csv',
                     '/assets/../app.py', '/assets/.env.json', '/assets/sub/../../index.html',
                     '/assets/x\\..\\keys.py', '/WEATHER-CONSISTENCY-UV-20261008.md']:
            with self.subTest(path=path):
                self.assertEqual(client.get(path).status_code, 404)

    def test_public_resources_and_android_verification_remain_available(self):
        client = meteo.app.test_client()
        for path in ['/', '/index.html', '/manifest.webmanifest', '/sw.js', '/ai-conversations.js',
                     '/weather-glass.css', '/icon-192.png', '/.well-known/assetlinks.json', '/privacy.html']:
            response = client.get(path)
            self.assertEqual(response.status_code, 200, path)
            response.close()
        self.assertTrue(public_file('assets/weather/v1/clear-day.webp'))
        self.assertTrue(public_file('assets/weather-video/v6/clear-day.mp4'))
        self.assertFalse(public_file('assets/config.py'))

    def test_frontend_contains_no_provider_secret(self):
        text = (fixtures.ROOT / 'index.html').read_text(encoding='utf-8')
        self.assertNotIn('appid=', text)
        self.assertNotIn('var OWM_KEY', text)
        self.assertIn('JSON.stringify(abonamentPushJSON(sub))', text)


class SecurityMiddlewareTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = Flask('security-fixture', static_folder=None)
        with patch.dict(os.environ, {'METEO_SECURITY_STATE_DIR': self.tmp.name}):
            install_security(self.app, True, lambda: 'a' * 32)
        self.app.testing = True
        self.calls = 0

        @self.app.route('/ask', methods=['POST'])
        def ask():
            self.calls += 1
            return jsonify(ok=True)

        @self.app.route('/save_data', methods=['POST'])
        def admin():
            return jsonify(ok=True)

        @self.app.route('/api/widget')
        def widget():
            return jsonify(ok=True)
        self.client = self.app.test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def test_foreign_origins_and_cross_site_requests_are_blocked_before_view(self):
        for headers in [{'Origin': 'https://attacker.invalid'}, {'Origin': 'null'},
                        {'Sec-Fetch-Site': 'cross-site'},
                        {'Origin': 'https://meteo-now.onrender.com.attacker.invalid'}]:
            self.assertEqual(self.client.post('/ask', headers=headers, json={}).status_code, 403)
        self.assertEqual(self.calls, 0)
        self.assertEqual(self.client.post('/ask', headers={'Origin': 'https://meteo-now.onrender.com'}, json={}).status_code, 200)

    def test_native_clients_without_origin_remain_supported(self):
        self.assertEqual(self.client.get('/api/widget').status_code, 200)

    def test_cors_preflight_only_allows_own_origin(self):
        headers = {'Origin': 'https://meteo-now.onrender.com', 'Access-Control-Request-Method': 'POST',
                   'Access-Control-Request-Headers': 'Content-Type'}
        response = self.client.options('/ask', headers=headers)
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], headers['Origin'])
        self.assertEqual(self.calls, 0)
        headers['Origin'] = 'https://attacker.invalid'
        response = self.client.options('/ask', headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertNotIn('Access-Control-Allow-Origin', response.headers)

    def test_admin_export_and_write_require_secret_in_hosted_mode(self):
        self.assertEqual(self.client.post('/save_data', json={}).status_code, 403)
        response = self.client.post('/save_data', headers={'Authorization': 'Bearer ' + 'a' * 32}, json={})
        self.assertEqual(response.status_code, 200)

    def test_security_headers_preserve_geolocation_and_media(self):
        response = self.client.get('/api/widget')
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response.headers['X-Frame-Options'], 'SAMEORIGIN')
        self.assertIn("object-src 'none'", response.headers['Content-Security-Policy'])
        self.assertIn('geolocation=(self)', response.headers['Permissions-Policy'])
        self.assertEqual(response.headers['Strict-Transport-Security'], 'max-age=31536000')

    def test_per_ip_ai_limit_cannot_be_bypassed_by_forged_xff(self):
        for i in range(6):
            self.assertEqual(self.client.post('/ask', json={}, headers={'X-Forwarded-For': f'192.0.2.{i}'}).status_code, 200)
        response = self.client.post('/ask', json={}, headers={'X-Forwarded-For': '198.51.100.50'})
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response.headers['Retry-After']), 0)
        self.assertEqual(self.calls, 6)

    def test_global_ai_budget_applies_across_addresses(self):
        with patch.dict(os.environ, {'METEO_AI_DAILY_REQUESTS': '2'}):
            for ip in ['192.0.2.1', '192.0.2.2']:
                self.assertEqual(self.client.post('/ask', json={}, environ_overrides={'REMOTE_ADDR': ip}).status_code, 200)
            self.assertEqual(self.client.post('/ask', json={}, environ_overrides={'REMOTE_ADDR': '192.0.2.3'}).status_code, 429)
        self.assertEqual(self.calls, 2)

    def test_ai_lease_released_and_concurrency_bounded(self):
        store = self.app.extensions['security_budgets']
        store.reserve([])
        a, b = store.acquire_ai(), store.acquire_ai()
        self.assertTrue(a and b)
        response = self.client.post('/ask', json={})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.calls, 0)
        store.release_ai(a)
        self.assertEqual(self.client.post('/ask', json={}).status_code, 200)
        self.assertTrue(store.acquire_ai(), 'the completed view releases its lease')

    def test_limiter_failure_fails_closed(self):
        with patch.object(self.app.extensions['security_budgets'], 'reserve', side_effect=sqlite3.OperationalError):
            self.assertEqual(self.client.post('/ask', json={}).status_code, 503)
        self.assertEqual(self.calls, 0)

    def test_head_requests_cannot_bypass_expensive_api_limits(self):
        store = self.app.extensions['security_budgets']
        with patch.object(store, 'reserve', return_value=60) as reserve:
            self.assertEqual(self.client.head('/api/widget').status_code, 429)
            reserve.assert_called_once()

    def test_forwarded_headers_only_trusted_with_explicit_edge_context(self):
        with self.app.test_request_context(headers={'CF-Connecting-IP': '192.0.2.9', 'X-Forwarded-For': '198.51.100.2'},
                                           environ_base={'REMOTE_ADDR': '127.0.0.1'}):
            self.assertEqual(client_ip(False), '127.0.0.1')
            self.assertEqual(client_ip(True), '192.0.2.9')


class BudgetStoreTests(unittest.TestCase):
    def test_workers_share_atomic_quota_and_windows_expire(self):
        with tempfile.TemporaryDirectory() as folder:
            filename = os.path.join(folder, 'state.sqlite3')
            stores = [BudgetStore(filename, lambda: 125)] * 8
            with ThreadPoolExecutor(max_workers=8) as pool:
                results = list(pool.map(lambda s: s.reserve([('global', 3, 60)]), stores))
            self.assertEqual(results.count(0), 3)
            self.assertEqual(BudgetStore(filename, lambda: 181).reserve([('global', 3, 60)]), 0)

    def test_rejected_reservation_does_not_charge_other_buckets(self):
        with tempfile.TemporaryDirectory() as folder:
            store = BudgetStore(os.path.join(folder, 'state.sqlite3'), lambda: 125)
            self.assertEqual(store.reserve([('busy', 1, 60)]), 0)
            self.assertGreater(store.reserve([('unused', 1, 60), ('busy', 1, 60)]), 0)
            self.assertEqual(store.reserve([('unused', 1, 60)]), 0)


class InputAndOwnershipTests(unittest.TestCase):
    def test_malformed_ai_requests_never_call_paid_provider(self):
        with patch.object(meteo.requests, 'post') as post:
            client = meteo.app.test_client()
            invalid = [[], {'question': []}, {'question': 'x'*2001}, {'question': 'hi', 'history': ['x']},
                       {'question': 'hi', 'context': []}, {'question': 'hi', 'lang': 3},
                       {'question': 'hi', 'locatie': {'nume': 3}},
                       {'question': 'hi', 'locatie': {'lat': 'NaN', 'lon': 25}},
                       {'question': 'hi', 'vremea': {'localitate': []}},
                       {'question': 'hi', 'context': {'esp32': {'status_badge': 3}}}]
            for body in invalid:
                with self.subTest(body=body):
                    self.assertEqual(client.post('/ask', json=body).status_code, 400)
            self.assertEqual(client.post('/ask', data=json.dumps({'question': 'x'*200000}), content_type='application/json').status_code, 413)
            post.assert_not_called()

    def test_push_cannot_target_private_network_or_arbitrary_hosts(self):
        for endpoint in ['https://127.0.0.1/x', 'https://localhost/x', 'https://169.254.169.254/x',
                         'https://fcm.googleapis.com.attacker.invalid/x', 'https://attacker.invalid/x',
                         'https://user:pass@fcm.googleapis.com/x', 'http://fcm.googleapis.com/x',
                         'https://fcm.googleapis.com:8443/x']:
            self.assertFalse(valid_push_endpoint(endpoint), endpoint)
            body = subscription();body['endpoint'] = endpoint
            with patch.object(meteo, '_fb') as fb:
                self.assertEqual(meteo.app.test_client().post('/api/push/subscribe', json=body).status_code, 400)
                fb.assert_not_called()

    def test_subscription_update_and_deletion_require_matching_keys(self):
        body = subscription()
        with patch.object(meteo, '_fb', return_value=body) as fb:
            client = meteo.app.test_client()
            response = client.post('/api/push/subscribe', json=body)
            self.assertEqual(response.status_code, 200)
            other = {**body, 'keys': {**body['keys'], 'auth': 'AQEBAQEBAQEBAQEBAQEBAQ'}}
            fb.reset_mock()
            self.assertEqual(client.post('/api/push/subscribe', json=other).status_code, 403)
            self.assertEqual(client.post('/api/push/unsubscribe', json=other).status_code, 403)
            self.assertTrue(all(c.args[1:] != ('PUT',) and (len(c.args)<2 or c.args[1] not in ('PUT','DELETE')) for c in fb.call_args_list))

    def test_missing_and_example_cron_secrets_are_rejected(self):
        for secret in ['', 'schimba-ma']:
            with meteo.app.test_request_context('/api/push/check?secret=' + secret):
                self.assertFalse(cron_authorized(secret))
        secret = 'valid-existing-key-19'
        for headers, url in [({'Authorization': 'Bearer ' + secret}, '/api/push/check'),
                             ({'X-Cron-Secret': secret}, '/api/push/check'),
                             ({}, '/api/push/check?secret=' + secret)]:
            with meteo.app.test_request_context(url, headers=headers):
                self.assertTrue(cron_authorized(secret))
        with patch.object(meteo, 'PUSH_CRON_SECRET', ''), patch.object(meteo, '_push_check_intern') as send:
            self.assertEqual(meteo.app.test_client().get('/api/push/check?secret=').status_code, 403)
            send.assert_not_called()

    def test_invalid_proxy_parameters_never_call_provider_or_leak_keys(self):
        client = meteo.app.test_client()
        with patch.object(meteo.requests, 'get') as get:
            for url in ['/api/owm/weather?lat=nan&lon=25', '/api/owm/find?cnt=100000',
                        '/api/clima?lat=inf&lon=25', '/api/clima?lat=91&lon=25',
                        '/api/owm/tile/clouds_new/99/0/0.png', '/api/owm/tile/clouds_new/2/9/9.png']:
                self.assertIn(client.get(url).status_code, (400, 404))
            get.assert_not_called()
        meteo._owm_cache.clear()
        with patch.object(meteo.requests, 'get', side_effect=RuntimeError('appid=secret-do-not-expose')):
            response = client.get('/api/owm/weather?lat=44&lon=25')
        self.assertEqual(response.status_code, 502)
        self.assertNotIn('secret-do-not-expose', response.get_data(as_text=True))


class FirebaseCredentialTests(unittest.TestCase):
    def test_required_auth_fails_closed_without_credentials(self):
        import firebase_access
        with patch.dict(os.environ, {'METEO_FIREBASE_REQUIRE_AUTH': '1'}, clear=True):
            with self.assertRaises(RuntimeError):
                firebase_access.authorization_headers()

    def test_server_transmits_bearer_credentials_without_putting_them_in_url(self):
        with patch('firebase_access.authorization_headers', return_value={'Authorization': 'Bearer private-token'}), \
             patch.object(meteo.requests, 'get') as get:
            get.return_value.json.return_value = {'ok': True}
            self.assertEqual(meteo._fb('push_subs'), {'ok': True})
            self.assertNotIn('private-token', get.call_args.args[0])
            self.assertEqual(get.call_args.kwargs['headers']['Authorization'], 'Bearer private-token')

    def test_bad_credentials_never_fall_back_to_anonymous_database_access(self):
        with patch('firebase_access.authorization_headers', side_effect=RuntimeError('private-config-detail')), \
             patch.object(meteo.requests, 'get') as get:
            self.assertIsNone(meteo._fb('push_subs'))
            get.assert_not_called()
