"""Bounded technical reports. Never accept messages, URLs, stacks or identifiers."""
import hashlib
import json
import os
import queue
import re
import threading
from datetime import datetime, timedelta, timezone

import requests
from flask import jsonify, request

VERSION = '2026.10.12.4'
CODES = {'runtime_error', 'unhandled_rejection', 'resource_error', 'request_failed',
         'http_error', 'weather_unavailable', 'ai_unavailable', 'widget_unavailable', 'server_exception', 'self_test'}
COMPONENTS = {'app', 'weather', 'ai', 'maps', 'notifications', 'widgets', 'media', 'server'}
OPERATIONS = {'runtime', 'resource', 'forecast', 'current', 'nearby', 'tile', 'ai',
              'subscribe', 'push', 'widget', 'sync', 'climate', 'other'}
ERRORS = {'Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError',
          'TimeoutError', 'AbortError', 'NetworkError', 'InvalidStateError', 'SecurityError', 'Other'}
SCRIPTS = {'index.html', 'diagnostics.js', 'weather-data-cache.js', 'weather-atmosphere.js',
           'weather-library.js', 'weather-motion.js', 'weather-romania.js', 'weather-geography.js',
           'ai-conversations.js', 'sw.js', 'external', 'unknown', 'native'}
DATABASE = 'https://licenta-ae902-default-rtdb.europe-west1.firebasedatabase.app'


def service_key():
    # Render's injected service name can retain its original slug after a rename.
    legacy = (os.environ.get('RENDER_SERVICE_ID') == 'srv-d9jmnbrtqb8s73amvl4g'
              or os.environ.get('RENDER_EXTERNAL_HOSTNAME') == 'meteo-targoviste.onrender.com'
              or os.environ.get('RENDER_SERVICE_NAME') in {'meteo-vechi', 'meteo-targoviste'})
    return 'legacy' if legacy else 'main'


def normalize(data):
    allowed = {'code', 'component', 'operation', 'release', 'platform', 'error', 'script', 'line', 'column', 'status'}
    if not isinstance(data, dict) or set(data) - allowed:
        raise ValueError('Invalid fields')
    for field, choices in [('code', CODES), ('component', COMPONENTS), ('operation', OPERATIONS),
                           ('platform', {'android', 'ios', 'desktop', 'unknown'}), ('error', ERRORS), ('script', SCRIPTS)]:
        if not isinstance(data.get(field), str) or data[field] not in choices:
            raise ValueError('Invalid category')
    if not isinstance(data.get('release'), str) or not re.fullmatch(r'\d{1,4}(?:\.\d{1,4}){1,3}', data['release']):
        raise ValueError('Invalid version')
    out = {key: data[key] for key in ('code', 'component', 'operation', 'release', 'platform', 'error', 'script')}
    for field, maximum in [('line', 200000), ('column', 200000), ('status', 599)]:
        value = data.get(field, 0)
        if type(value) is not int or not 0 <= value <= maximum or (field == 'status' and 0 < value < 100):
            raise ValueError('Invalid number')
        out[field] = value
    return out


def operation_for(path):
    if path == '/ask': return 'ai', 'ai'
    if path == '/api/weather/forecast': return 'weather', 'forecast'
    if path == '/api/owm/weather': return 'weather', 'current'
    if path == '/api/owm/find': return 'weather', 'nearby'
    if path.startswith('/api/owm/tile/'): return 'maps', 'tile'
    if path.startswith('/api/anm/'): return 'maps', 'other'
    if path == '/api/widget/cities': return 'widgets', 'sync'
    if path == '/api/widget': return 'widgets', 'widget'
    if path.startswith('/api/push/'): return 'notifications', 'push'
    if path == '/api/clima': return 'weather', 'climate'
    return 'server', 'other'


class Reporter:
    def __init__(self, logger, hosted=False, writer=None):
        self.logger = logger
        self.hosted = hosted
        self.writer = writer or self.persist
        self.pending = queue.Queue(maxsize=32)
        self.lock = threading.Lock()
        self.started = False
        self.last_cleanup = None

    def submit(self, event):
        # Only schema-derived metadata reaches logs or storage; no request data.
        event = normalize(event)
        if not self.hosted:
            return True
        with self.lock:
            if not self.started:
                threading.Thread(target=self.run, name='meteo-diagnostics', daemon=True).start()
                self.started = True
        try:
            self.pending.put_nowait(event)
            return True
        except queue.Full:
            return False

    def run(self):
        while True:
            event = self.pending.get()
            try:
                self.logger.warning('METEO_DIAGNOSTIC %s', json.dumps(event, sort_keys=True, separators=(',', ':')))
                self.writer(event)
            except Exception:
                # Do not print exception URLs, tokens, bodies or recursively report.
                self.logger.warning('METEO_DIAGNOSTIC_STORE_UNAVAILABLE')
            finally:
                self.pending.task_done()

    def persist(self, event):
        from firebase_access import authorization_headers
        headers = authorization_headers()
        if not headers.get('Authorization'):
            raise RuntimeError('Private storage unavailable')
        now = datetime.now(timezone.utc)
        day = now.strftime('%Y-%m-%d')
        service = service_key()
        fingerprint = hashlib.sha256(json.dumps(event, sort_keys=True).encode()).hexdigest()[:24]
        url = DATABASE + '/diagnostics_v1/' + day + '/' + service + '/' + fingerprint + '.json'
        response = requests.patch(url, headers=headers, params={'print': 'silent'},
                                  json={'event': event, 'count': {'.sv': {'increment': 1}},
                                        'lastSeen': {'.sv': 'timestamp'}}, timeout=(3, 4))
        response.raise_for_status()
        # Retain fourteen UTC dates. Cleanup is best effort and never blocks UI.
        if self.last_cleanup != day:
            self.last_cleanup = day
            response = requests.get(DATABASE + '/diagnostics_v1.json', headers=headers,
                                    params={'shallow': 'true'}, timeout=(3, 4))
            response.raise_for_status()
            cutoff = (now - timedelta(days=13)).strftime('%Y-%m-%d')
            for old in (response.json() or {}):
                if re.fullmatch(r'\d{4}-\d{2}-\d{2}', old) and old < cutoff:
                    requests.delete(DATABASE + '/diagnostics_v1/' + old + '.json',
                                    headers=headers, timeout=(3, 4)).raise_for_status()


def install_diagnostics(app, hosted=False, reporter=None):
    reporter = reporter or Reporter(app.logger, hosted)
    app.extensions['diagnostics'] = reporter

    @app.post('/api/diagnostics')
    def receive_diagnostic():
        if request.content_length is None or request.content_length > 2048:
            return jsonify(error='Raport prea mare'), 413
        try:
            event = normalize(request.get_json(silent=True))
        except ValueError:
            return jsonify(error='Raport invalid'), 400
        try:
            accepted = reporter.submit(event)
        except Exception:
            accepted = False
        return ('', 202 if accepted else 503)

    @app.after_request
    def server_errors(response):
        if response.status_code < 500 or request.path.startswith('/api/diagnostics'):
            return response
        # Use the same cross-worker global budget as client reports; never recurse.
        try:
            store = app.extensions['security_budgets']
            if store.reserve([('diagnostics:server', 30, 60), ('diagnostics:day', 1000, 86400)]):
                return response
            component, operation = operation_for(request.path)
            reporter.submit({'code': 'server_exception' if response.status_code == 500 else 'http_error',
                             'component': component, 'operation': operation, 'release': VERSION,
                             'platform': 'unknown', 'error': 'Other', 'script': 'unknown',
                             'status': response.status_code})
        except Exception:
            pass
        return response
