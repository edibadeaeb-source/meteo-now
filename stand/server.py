"""Local, read-only exhibition dashboard. Python standard library only.

No database credentials, writes, mobile application imports or Render requests.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import threading
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import urlopen, Request

ROOT = Path(__file__).resolve().parent
DATABASE = 'https://licenta-ae902-default-rtdb.europe-west1.firebasedatabase.app'
PATHS = {'esp': 'senzori/bme680', 'lora': 'senzori/lorawan', 'history': 'istoric/lorawan'}
FILES = {'/': ('index.html', 'text/html; charset=utf-8'),
         '/stand.css': ('stand.css', 'text/css; charset=utf-8'),
         '/stand.js': ('stand.js', 'text/javascript; charset=utf-8')}
MAX_BYTES = 512 * 1024


def number(value, low=-1e9, high=1e9):
    if value is None or isinstance(value, bool) or value == '':
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) and low <= result <= high else None
    except (TypeError, ValueError):
        return None


def timestamp(record):
    for key in ('server_timestamp', 'timestamp'):
        value = record.get(key)
        parsed = number(value, 1, 1e14)
        if parsed is not None:
            seconds = parsed / 1000 if parsed > 1e11 else parsed
            if seconds <= 4102444800:
                return seconds
        if isinstance(value, str):
            try:
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if dt.tzinfo is not None and 0 < dt.timestamp() <= 4102444800:
                    return dt.timestamp()
            except ValueError:
                pass
    return None


def normalize(record):
    if not isinstance(record, dict):
        return None
    result = {'timestamp': timestamp(record)}
    fields = {'temperature': (('temperatura', 'temperature'), -60, 100),
              'humidity': (('umiditate', 'humidity'), 0, 100),
              'pressure': (('presiune', 'pressure'), 300, 1200),
              'gas': (('gaz_kOhm', 'gas'), 0, 1e6),
              'iaq': (('iaq',), 0, 500), 'rssi': (('rssi',), -200, 0),
              'snr': (('snr',), -100, 100), 'fcnt': (('fcnt',), 0, 1e12)}
    for name, (aliases, low, high) in fields.items():
        result[name] = next((v for key in aliases
                             if (v := number(record.get(key), low, high)) is not None), None)
    return result if any(result[k] is not None for k in ('temperature', 'humidity', 'pressure', 'gas')) else None


def records(payload):
    if not isinstance(payload, (dict, list)):
        return []
    direct = normalize(payload) if isinstance(payload, dict) else None
    items = [direct] if direct else [normalize(x) for x in (payload.values() if isinstance(payload, dict) else payload)]
    return sorted((x for x in items if x), key=lambda x: x['timestamp'] or 0)[-60:]


def read_public(kind):
    query = {} if kind == 'lora' else {'orderBy': '"$key"', 'limitToLast': '60'}
    url = DATABASE + '/' + PATHS[kind] + '.json' + ('?' + urlencode(query) if query else '')
    req = Request(url, headers={'Accept': 'application/json', 'User-Agent': 'METEO-NOW-Stand/1.0'}, method='GET')
    with urlopen(req, timeout=7) as response:
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError('response too large')
    return records(json.loads(body))


class Reader:
    def __init__(self, fetch=read_public, clock=time.time):
        self.fetch, self.clock = fetch, clock
        self.lock = threading.Lock()
        self.last_check = None
        self.channels = {key: {'history': [], 'error': None, 'checkedAt': None}
                         for key in ('esp', 'lora')}

    def snapshot(self):
        with self.lock:
            now = self.clock()
            if self.last_check is None or now - self.last_check >= 20:
                with ThreadPoolExecutor(max_workers=3) as pool:
                    pending = {key: pool.submit(self.fetch, key) for key in PATHS}
                    outcome = {}
                    for key, job in pending.items():
                        try:
                            outcome[key] = (job.result(), None)
                        except HTTPError as error:
                            outcome[key] = ([], 'Acces la date refuzat' if error.code in (401, 403) else 'Sursa nu răspunde')
                        except Exception:
                            outcome[key] = ([], 'Conexiune la date indisponibilă')
                checked = self.clock()
                for key in ('esp', 'lora'):
                    rows, error = outcome[key]
                    if key == 'lora':
                        history, history_error = outcome['history']
                        # A failed current-value read must not be hidden by old history.
                        if not error:
                            rows = sorted(history + rows, key=lambda r: r['timestamp'] or 0)
                            rows = list({r['timestamp']: r for r in rows}.values())[-60:]
                        if history_error and not error and not rows:
                            error = history_error
                    channel = self.channels[key]
                    if not error:
                        channel['history'] = rows
                    channel.update(error=error, checkedAt=checked)
                self.last_check = checked
            # JSON copy prevents callers from changing the cache.
            result = json.loads(json.dumps(self.channels, allow_nan=False))
            now = self.clock()
            for channel in result.values():
                current = channel['history'][-1] if channel['history'] else None
                stamp = current['timestamp'] if current else None
                age = now - stamp if stamp else None
                channel['current'] = current
                channel['state'] = ('unavailable' if channel['error'] else 'empty' if not current else
                                    'unknown' if age is None or age < -60 else
                                    'live' if age < 300 else 'stale')
            return {'app': 'METEO-NOW-STAND', 'version': 1, 'generatedAt': self.clock(),
                    'pollSeconds': 20, 'channels': result}


class Handler(BaseHTTPRequestHandler):
    reader = Reader()

    def do_GET(self):
        # Prevent DNS rebinding and unrelated sites driving this local service.
        if self.headers.get('Host') not in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'):
            self.send_error(403)
            return
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            self.send_error(403)
            return
        path = urlsplit(self.path).path
        if path == '/api/station':
            body = json.dumps(self.reader.snapshot(), ensure_ascii=False, allow_nan=False).encode('utf-8')
            mime = 'application/json; charset=utf-8'
        elif path == '/health':
            body, mime = b'{"app":"METEO-NOW-STAND"}', 'application/json'
        elif path in FILES:
            name, mime = FILES[path]
            body = (ROOT / name).read_bytes()
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    print(f'METEO NOW / Stand: http://127.0.0.1:{args.port}', flush=True)
    print('Doar citire. Ctrl+C pentru oprire.', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
