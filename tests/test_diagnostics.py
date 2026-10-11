import json
import logging
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from flask import Flask
from diagnostics import Reporter, install_diagnostics, normalize, service_key
from security import install_security


def event(**kwargs):
    return dict(code='runtime_error', component='app', operation='runtime', release='2026.10.11.1',
                platform='android', error='TypeError', script='index.html', **kwargs)


class DiagnosticPrivacyTests(unittest.TestCase):
    def test_renamed_legacy_service_keeps_separate_reports(self):
        for env in [{'RENDER_SERVICE_NAME':'meteo-vechi'}, {'RENDER_SERVICE_NAME':'meteo-targoviste'},
                    {'RENDER_SERVICE_ID':'srv-d9jmnbrtqb8s73amvl4g'},
                    {'RENDER_EXTERNAL_HOSTNAME':'meteo-targoviste.onrender.com'}]:
            with patch.dict('os.environ', env, clear=True): self.assertEqual(service_key(), 'legacy')
        with patch.dict('os.environ', {'RENDER_SERVICE_NAME':'meteo-now'}, clear=True): self.assertEqual(service_key(), 'main')

    def test_rejects_raw_data_and_arbitrary_strings(self):
        for key, value in [('message', 'question'), ('stack', 'token'), ('url', 'https://host/?lat=44.99'),
                           ('city', 'Moreni'), ('userId', '123'), ('coordinates', [44, 25])]:
            with self.assertRaises(ValueError): normalize(event(**{key: value}))
        for field in ['code', 'component', 'operation', 'platform', 'error', 'script', 'release']:
            value = event(); value[field] = 'secret@example.com'
            with self.assertRaises(ValueError): normalize(value)

    def test_rejects_invalid_types_and_oversized_numbers(self):
        for value in [None, [], 'text', {}, event(status=True), event(line=-1), event(column=200001), event(status=99)]:
            with self.assertRaises(ValueError): normalize(value)

    def test_preserves_only_technical_fields(self):
        result = normalize(event(line=3000, column=12, status=502))
        self.assertEqual(result['line'], 3000)
        self.assertEqual(len(result), 10)

    def test_background_queue_is_bounded_and_nonblocking(self):
        reporter = Reporter(logging.getLogger('test'), hosted=True)
        with patch('diagnostics.threading.Thread') as thread:
            for _ in range(32): self.assertTrue(reporter.submit(event()))
            self.assertFalse(reporter.submit(event()))
            thread.assert_called_once()

    def test_storage_uses_private_headers_and_atomic_counter(self):
        reporter = Reporter(logging.getLogger('test'))
        response = Mock(); response.json.return_value = {'2000-01-01': True, 'not-a-date': True, '2999-01-01': True}
        with patch('firebase_access.authorization_headers', return_value={'Authorization': 'Bearer PRIVATE'}), \
             patch('diagnostics.requests.patch', return_value=response) as write, \
             patch('diagnostics.requests.get', return_value=response), \
             patch('diagnostics.requests.delete', return_value=response) as delete:
            reporter.persist(normalize(event()))
        self.assertEqual(write.call_args.kwargs['headers']['Authorization'], 'Bearer PRIVATE')
        self.assertEqual(write.call_args.kwargs['json']['count'], {'.sv': {'increment': 1}})
        self.assertNotIn('PRIVATE', json.dumps(write.call_args.kwargs['json']))
        delete.assert_called_once()
        self.assertTrue(delete.call_args.args[0].endswith('/diagnostics_v1/2000-01-01.json'))

    def test_never_falls_back_to_anonymous_storage(self):
        reporter = Reporter(logging.getLogger('test'))
        with patch('firebase_access.authorization_headers', return_value={}), patch('diagnostics.requests.patch') as write:
            with self.assertRaises(RuntimeError): reporter.persist(normalize(event()))
        write.assert_not_called()


class DiagnosticRouteTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.app = Flask(__name__)
        self.reporter = Mock(); self.reporter.submit.return_value = True
        with patch.dict('os.environ', {'METEO_SECURITY_STATE_DIR': self.directory.name}):
            install_security(self.app, True, lambda: '')
        install_diagnostics(self.app, True, self.reporter)
        self.client = self.app.test_client()

    def tearDown(self):
        self.directory.cleanup()

    def test_reports_are_write_only_and_reject_invalid_payloads(self):
        self.assertEqual(self.client.get('/api/diagnostics').status_code, 405)
        self.assertEqual(self.client.post('/api/diagnostics', json=event()).status_code, 202)
        self.assertEqual(self.client.post('/api/diagnostics', json=event(message='SECRET')).status_code, 400)
        self.assertEqual(self.client.post('/api/diagnostics', data='x'*2049).status_code, 413)
        self.assertEqual(self.reporter.submit.call_count, 1)

    def test_foreign_origin_and_rate_limits(self):
        self.assertEqual(self.client.post('/api/diagnostics', json=event(), headers={'Origin': 'https://evil.invalid'}).status_code, 403)
        for _ in range(6): self.assertEqual(self.client.post('/api/diagnostics', json=event()).status_code, 202)
        self.assertEqual(self.client.post('/api/diagnostics', json=event()).status_code, 429)

    def test_sink_failure_does_not_cause_recursive_reports(self):
        self.reporter.submit.side_effect = RuntimeError('not logged')
        self.assertEqual(self.client.post('/api/diagnostics', json=event()).status_code, 503)
        self.assertEqual(self.reporter.submit.call_count, 1)

    def test_server_failures_report_route_category_without_query_or_body(self):
        @self.app.get('/api/widget')
        def widget(): return 'SECRET', 502
        response = self.client.get('/api/widget?lat=44.123456&token=SECRET')
        self.assertEqual(response.status_code, 502)
        captured = self.reporter.submit.call_args.args[0]
        self.assertEqual(captured['component'], 'widgets')
        self.assertEqual(captured['operation'], 'widget')
        self.assertNotIn('SECRET', json.dumps(captured))
        self.assertNotIn('44.123456', json.dumps(captured))


if __name__ == '__main__': unittest.main()
