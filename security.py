"""Small, testable security boundary for the public mobile app.

SQLite counters are shared by Gunicorn workers on ONE host. Multi-instance
deployments must use a shared rate-limit service. Never treat CORS as auth.
"""
import hashlib
import base64
from contextlib import closing
import hmac
import ipaddress
import math
import os
import secrets
from pathlib import PurePosixPath
import sqlite3
import tempfile
import time
from urllib.parse import urlsplit

from flask import g, jsonify, request
from flask_cors import CORS


PUBLIC_FILES = frozenset({
    'index.html', 'privacy.html', 'weather-credits.html', 'simulator.html',
    'manifest.webmanifest', 'sw.js', 'assetlinks.json', 'ai-conversations.js',
    'weather-ai.css', 'weather-atmosphere.js', 'weather-data-cache.js',
    'weather-geography.js', 'weather-glass.css', 'weather-library.js',
    'weather-motion.js', 'weather-romania.js', 'apple-icon.png',
    'apple-touch-icon.png', 'icon.svg', 'moon.png', 'placeholder-logo.png',
    'placeholder-logo.svg', 'placeholder-user.jpg', 'placeholder.jpg',
    'placeholder.svg', 'icon-dark-32x32.png', 'icon-light-32x32.png',
    'icon-maskable-192.png', 'icon-maskable-512.png',
    *('icon-%s.png' % size for size in (48, 72, 96, 128, 144, 192, 256, 384, 512)),
})


def public_file(name):
    if not name or '\\' in name or '\x00' in name:
        return False
    parts = name.split('/')
    if any(not p or p.startswith('.') for p in parts):
        return False
    if len(parts) == 1:
        return name in PUBLIC_FILES
    return parts[0] == 'assets' and PurePosixPath(name).suffix.lower() in {
        '.webp', '.mp4', '.json', '.png', '.jpg', '.svg', '.woff', '.woff2',
    }


def secret_matches(expected, supplied, minimum=24):
    # Missing configuration and old example passwords must fail closed.
    return (isinstance(expected, str) and len(expected) >= minimum and expected != 'schimba-ma'
            and isinstance(supplied, str) and len(supplied) <= 512
            and hmac.compare_digest(expected.encode(), supplied.encode()))


def bearer_token():
    value = request.headers.get('Authorization', '')
    return value[7:] if value.startswith('Bearer ') else ''


def cron_authorized(secret):
    # Keep existing cron jobs working; headers avoid putting secrets in URLs.
    supplied = bearer_token() or request.headers.get('X-Cron-Secret') or request.args.get('secret')
    return secret_matches(secret, supplied, minimum=16)


def valid_push_endpoint(value):
    if not isinstance(value, str) or len(value) > 2048 or any(c.isspace() for c in value):
        return False
    try:
        url = urlsplit(value)
        host = url.hostname or ''
        allowed = host in {'fcm.googleapis.com', 'android.googleapis.com',
                          'updates.push.services.mozilla.com', 'web.push.apple.com'}
        allowed = allowed or (host.endswith('.notify.windows.com')
                              and all(x.replace('-', '').isalnum() for x in host.split('.')))
        return (allowed and url.scheme == 'https' and url.port in (None, 443)
                and not url.username and not url.password and not url.fragment
                and bool(url.path.strip('/')))
    except ValueError:
        return False


def valid_push_keys(keys):
    if not isinstance(keys, dict):
        return False
    try:
        values = []
        for name, size in [('auth', 16), ('p256dh', 65)]:
            value = keys.get(name)
            if not isinstance(value, str) or len(value) > 128:
                return False
            data = base64.b64decode(value + '=' * (-len(value) % 4), altchars=b'-_', validate=True)
            if len(data) != size:
                return False
            values.append(data)
        return values[1][0] == 4
    except (ValueError, TypeError):
        return False


def client_ip(hosted):
    candidate = request.remote_addr or 'unknown'
    if hosted:
        # Render supplies CF-Connecting-IP through its Cloudflare edge. Do not
        # trust the caller-controlled leftmost X-Forwarded-For address.
        candidate = request.headers.get('CF-Connecting-IP', candidate)
    try:
        address = ipaddress.ip_address(candidate)
        # IPv6 privacy addresses in the same /64 share a quota.
        if address.version == 6:
            return str(ipaddress.ip_network(str(address) + '/64', strict=False))
        return str(address)
    except ValueError:
        return request.remote_addr or 'unknown'


class BudgetStore:
    """Atomic reservations, fixed windows and bounded storage across processes."""
    def __init__(self, filename=None, clock=time.time):
        self.filename = filename or os.path.join(
            os.environ.get('METEO_SECURITY_STATE_DIR', tempfile.gettempdir()),
            'meteo-now-security-v1.sqlite3')
        self.clock = clock

    def reserve(self, rules):
        now = self.clock()
        os.makedirs(os.path.dirname(os.path.abspath(self.filename)), exist_ok=True)
        with closing(sqlite3.connect(self.filename, timeout=2)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS budget (key TEXT, window INTEGER, '
                       'expires INTEGER, count INTEGER, PRIMARY KEY(key, window))')
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM budget WHERE expires <= ?', (now,))
            if db.execute('SELECT count(*) FROM budget').fetchone()[0] > 10000:
                return 60
            reservations = []
            for key, limit, seconds in rules:
                window = int(now // seconds)
                expires = (window + 1) * seconds
                row = db.execute('SELECT count FROM budget WHERE key=? AND window=?',
                                 (key, window)).fetchone()
                if row and row[0] >= limit:
                    return max(1, math.ceil(expires - now))
                reservations.append((key, window, expires))
            for key, window, expires in reservations:
                db.execute('INSERT INTO budget VALUES (?, ?, ?, 1) '
                           'ON CONFLICT(key, window) DO UPDATE SET count=count+1',
                           (key, window, expires))
        return 0

    def acquire_ai(self):
        now = self.clock()
        with closing(sqlite3.connect(self.filename, timeout=2)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS ai_leases (token TEXT PRIMARY KEY, expires REAL)')
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM ai_leases WHERE expires <= ?', (now,))
            if db.execute('SELECT count(*) FROM ai_leases').fetchone()[0] >= 2:
                return None
            token = secrets.token_hex(16)
            db.execute('INSERT INTO ai_leases VALUES (?, ?)', (token, now + 130))
            return token

    def release_ai(self, token):
        with closing(sqlite3.connect(self.filename, timeout=2)) as db, db:
            db.execute('DELETE FROM ai_leases WHERE token=?', (token,))


def _positive_env(name, default, maximum):
    try:
        return min(maximum, max(1, int(os.environ.get(name, default))))
    except ValueError:
        return default


def install_security(app, hosted, admin_secret):
    origins = ['https://meteo-now.onrender.com']
    origins.extend(x.strip().rstrip('/') for x in os.environ.get('METEO_ALLOWED_ORIGINS', '').split(',')
                   if x.strip().startswith('https://') and '*' not in x)
    if not hosted:
        origins.extend(['http://localhost:5000', 'http://127.0.0.1:5000'])
    CORS(app, resources={r'/(?:api/.*|ask)': {'origins': origins}},
         methods=['GET', 'POST', 'OPTIONS'], allow_headers=['Content-Type'],
         always_send=False, max_age=600)
    app.config.update(MAX_CONTENT_LENGTH=192 * 1024, MAX_FORM_MEMORY_SIZE=32 * 1024,
                      MAX_FORM_PARTS=20, SESSION_COOKIE_HTTPONLY=True,
                      SESSION_COOKIE_SECURE=hosted, SESSION_COOKIE_SAMESITE='Lax',
                      SECURITY_LIMITS_ENABLED=True)
    store = BudgetStore()
    app.extensions['security_budgets'] = store

    @app.before_request
    def protect_request():
        path = request.path
        api = path.startswith('/api/') or path == '/ask'
        admin = path == '/save_data' or path.startswith('/export/')
        if not api and not admin:
            return None
        if len(request.query_string) > 4096:
            return jsonify(error='Cerere prea lungă'), 400
        origin = request.headers.get('Origin')
        if origin and origin not in origins:
            return jsonify(error='Origine nepermisă'), 403
        if request.headers.get('Sec-Fetch-Site') == 'cross-site':
            return jsonify(error='Origine nepermisă'), 403
        if admin:
            local = (not hosted and request.remote_addr in ('127.0.0.1', '::1')
                     and not request.headers.get('X-Forwarded-For')
                     and not request.headers.get('CF-Connecting-IP'))
            if not local and not secret_matches(admin_secret(), bearer_token()):
                return jsonify(error='Acces administrativ necesar'), 403
        if request.method == 'OPTIONS' or not app.config['SECURITY_LIMITS_ENABLED']:
            return None
        if path == '/api/ping' or path == '/api/push/key':
            return None
        ip = hashlib.sha256(client_ip(hosted and os.environ.get('RENDER') == 'true').encode()).hexdigest()
        rules = [('api:' + ip, 240, 60), ('api:global', 1200, 60)]
        if path.startswith('/api/owm/tile/'):
            rules = [('tiles:' + ip, 600, 60), ('tiles:global', 2400, 60)]
        elif path == '/ask':
            rules += [('ai:minute:' + ip, 6, 60), ('ai:day:' + ip, 30, 86400),
                      ('ai:minute:global', 20, 60),
                      ('ai:day:global', _positive_env('METEO_AI_DAILY_REQUESTS', 200, 10000), 86400)]
        elif path == '/api/clima':
            rules += [('climate:' + ip, 12, 60), ('climate:global', 60, 60)]
        elif path == '/api/push/subscribe':
            rules += [('subscribe:' + ip, 10, 60)]
        elif path == '/api/widget/cities' and request.method == 'POST':
            rules += [('city-sync:' + ip, 30, 60)]
        try:
            retry = store.reserve(rules)
        except (sqlite3.Error, OSError):
            # Never silently remove the paid-AI spending boundary.
            app.logger.warning('Security budget store unavailable')
            return jsonify(error='Serviciu ocupat. Încearcă din nou.'), 503
        if retry:
            response = jsonify(error='Prea multe cereri. Încearcă din nou mai târziu.', retry_after=retry)
            response.status_code = 429
            response.headers['Retry-After'] = str(retry)
            return response
        if path == '/ask':
            try:
                g.ai_lease = store.acquire_ai()
            except (sqlite3.Error, OSError):
                g.ai_lease = None
            if not g.ai_lease:
                response = jsonify(error='Asistentul este ocupat. Încearcă din nou în câteva secunde.')
                response.status_code = 503
                response.headers['Retry-After'] = '10'
                return response

    @app.teardown_request
    def release_ai(error):
        token = g.pop('ai_lease', None)
        if token:
            try:
                store.release_ai(token)
            except (sqlite3.Error, OSError):
                app.logger.warning('AI lease release delayed; expiry remains active')

    @app.after_request
    def security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'geolocation=(self), camera=(), microphone=()'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; "
            "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdnjs.cloudflare.com "
            "https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com "
            "https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; "
            "img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com "
            "https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; connect-src 'self' https: wss:; "
            "media-src 'self' blob:; worker-src 'self' blob:; frame-src 'self'; form-action 'self'"
        )
        if hosted:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        if request.path.startswith('/api/push/') or request.path.startswith('/api/widget/cities') or request.path == '/ask':
            response.headers['Cache-Control'] = 'no-store'
        if response.status_code >= 400:
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.errorhandler(413)
    def too_large(error):
        return jsonify(error='Cerere prea mare'), 413
