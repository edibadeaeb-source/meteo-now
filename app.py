from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import csv
import json
import os
import subprocess
import threading
import re
from datetime import datetime, timedelta
from pathlib import Path
from flask import send_file
import tempfile, zipfile

app = Flask(__name__)
CORS(app)

# ─── Chei API: întâi din variabilele de mediu, apoi din keys.py (fișier local, privat) ───
def _load_key(env_name, keys_attr):
    v = os.environ.get(env_name)
    if v:
        return v
    try:
        import keys as _keys
        return getattr(_keys, keys_attr, "")
    except Exception:
        return ""

ANTHROPIC_API_KEY   = _load_key("ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY")
OPENWEATHER_API_KEY = _load_key("OPENWEATHER_API_KEY", "OPENWEATHER_API_KEY")
VAPID_PUBLIC_KEY    = _load_key("VAPID_PUBLIC_KEY", "VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY   = _load_key("VAPID_PRIVATE_KEY", "VAPID_PRIVATE_KEY")
VAPID_CLAIM_EMAIL   = _load_key("VAPID_CLAIM_EMAIL", "VAPID_CLAIM_EMAIL") or "mailto:admin@example.com"
PUSH_CRON_SECRET    = _load_key("PUSH_CRON_SECRET", "PUSH_CRON_SECRET") or "schimba-ma"
if not ANTHROPIC_API_KEY:
    print("⚠️  ANTHROPIC_API_KEY lipsește (setează variabila de mediu sau keys.py) — asistentul AI nu va funcționa.")
OUTPUT_DIR = "exported_data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE_DIR = str(Path(__file__).parent.resolve())

# ─── Ora României ───
# Serverele de găzduire (Render etc.) rulează pe UTC, deci datetime.now() ar da ora greșită.
# Folosim ora locală a României peste tot unde afișăm ceva utilizatorului.
try:
    from zoneinfo import ZoneInfo
    _TZ_RO = ZoneInfo("Europe/Bucharest")
except Exception:
    _TZ_RO = None

def now_ro():
    """Ora curentă în România (funcționează și local, și pe server UTC)."""
    if _TZ_RO is not None:
        return datetime.now(_TZ_RO)
    # rezervă: vara UTC+3, iarna UTC+2 (aproximare simplă)
    from datetime import timezone as _tz
    utc = datetime.now(_tz.utc)
    return utc + timedelta(hours=3 if 3 <= utc.month <= 10 else 2)

# Folderul noului site METEO Târgoviște (stil IMGW).
# Caută în mai multe locuri, ca să meargă indiferent cum sunt urcate fișierele:
#  1) variabila de mediu STATIC_DIR (dacă o setezi pe gazdă)
#  2) ./public lângă app.py (structura recomandată pentru găzduire)
#  3) ../targoviste-meteo (1)/public (structura ta locală actuală)
#  4) chiar lângă app.py (structură „aplatizată": index.html + iconițe la rădăcină)
_static_candidates = [
    os.environ.get('STATIC_DIR'),
    os.path.join(BASE_DIR, 'public'),
    str((Path(BASE_DIR).parent / 'targoviste-meteo (1)' / 'public').resolve()),
    BASE_DIR,
]
METEO_DIR = next((c for c in _static_candidates if c and os.path.exists(os.path.join(c, 'index.html'))),
                 BASE_DIR)

# ═══════════════════════════════════════════════════════════════
#  CLOUDFLARE TUNNEL
# ═══════════════════════════════════════════════════════════════
def start_tunnel():
    cloudflared_path = os.path.join(BASE_DIR, 'cloudflared.exe')
    process = subprocess.Popen(
        [cloudflared_path, 'tunnel', '--url', 'http://localhost:5000'],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        bufsize=1, universal_newlines=True
    )
    url_printed = False
    for line in process.stdout:
        # Afisam DOAR URL-ul public, suprimam orice altceva
        match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', line)
        if match and not url_printed:
            url_printed = True
            print(f"\n🌐 URL PUBLIC: {match.group()}", flush=True)
            print(f"   Dashboard: {match.group()}/", flush=True)
            print("", flush=True)

# Tunelul Cloudflare pornește DOAR local (pe Windows, cu cloudflared.exe prezent).
# Pe un server găzduit (Render/Railway/etc., care setează variabila PORT) NU pornește.
_IS_HOSTED = bool(os.environ.get('PORT'))
if not _IS_HOSTED and os.path.exists(os.path.join(BASE_DIR, 'cloudflared.exe')):
    threading.Thread(target=start_tunnel, daemon=True).start()

# ═══════════════════════════════════════════════════════════════
#  ROUTES STATICE
# ═══════════════════════════════════════════════════════════════
def _no_store(resp):
    """Nu permite păstrarea în cache — nici în browser, nici la edge-ul Cloudflare."""
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    # anteturi pe care Cloudflare le respectă special pentru cache-ul de la edge
    resp.headers['CDN-Cache-Control'] = 'no-store'
    resp.headers['Cloudflare-CDN-Cache-Control'] = 'no-store'
    return resp

@app.route('/')
def index():
    # Noul site METEO Târgoviște (dacă există), altfel vechiul dashboard
    if os.path.exists(os.path.join(METEO_DIR, 'index.html')):
        return _no_store(send_from_directory(METEO_DIR, 'index.html'))
    return _no_store(send_from_directory(BASE_DIR, 'index.html'))

@app.route('/licenta')
def licenta():
    # Vechiul dashboard din proiectul de diplomă
    return _no_store(send_from_directory(BASE_DIR, 'index.html'))


# ═══════════════════════════════════════════════════════════════
#  DIGITAL ASSET LINKS — verificarea aplicației Android (TWA)
#  Fără acest fișier, aplicația instalată din APK afișează bara de
#  browser (cu X și adresa). Cu el, se deschide pe tot ecranul.
#  Pune fișierul „assetlinks.json" (primit de la PWABuilder) lângă app.py.
# ═══════════════════════════════════════════════════════════════
@app.route('/.well-known/assetlinks.json')
def assetlinks():
    for folder in (METEO_DIR, BASE_DIR, os.path.join(BASE_DIR, '.well-known'),
                   os.path.join(METEO_DIR, '.well-known')):
        p = os.path.join(folder, 'assetlinks.json')
        if os.path.isfile(p):
            resp = send_file(p)
            resp.headers['Content-Type'] = 'application/json'
            resp.headers['Access-Control-Allow-Origin'] = '*'
            return resp
    return jsonify({'error': 'assetlinks.json lipsește — încarcă fișierul primit de la PWABuilder'}), 404

@app.route('/<path:fname>')
def meteo_static(fname):
    # Fișiere statice ale noului site (manifest PWA, service worker, iconițe)
    safe = os.path.normpath(fname)
    if safe.startswith('..') or os.path.isabs(safe):
        return 'Not found', 404
    full = os.path.join(METEO_DIR, safe)
    if os.path.isfile(full):
        resp = send_from_directory(METEO_DIR, safe)
        # tipul corect pentru manifestul PWA (unele servere îl trimit greșit)
        if safe.endswith('.webmanifest'):
            resp.headers['Content-Type'] = 'application/manifest+json'
        # HTML și service worker-ul nu se păstrează în cache; restul (iconițe) da
        if safe.endswith('.html') or safe.endswith('sw.js') or safe.endswith('.webmanifest'):
            return _no_store(resp)
        return resp
    return 'Not found', 404


# ═══════════════════════════════════════════════════════════════
#  PROXY ANM (meteoromania.ro) — pentru site-ul stației METEO
#  Ocolește CORS: browserul cere de la Flask, Flask cere de la ANM.
#  Cache 5 minute ca să nu supraîncărcăm API-ul oficial.
# ═══════════════════════════════════════════════════════════════
_anm_cache = {}
_ANM_ENDPOINTS = {'avertizari-generale', 'avertizari-nowcasting', 'starea-vremii', 'prognoza-orase'}

@app.route('/api/anm/<endpoint>')
def anm_proxy(endpoint):
    if endpoint not in _ANM_ENDPOINTS:
        return jsonify({'error': 'endpoint necunoscut'}), 404
    now = now_ro()
    cached = _anm_cache.get(endpoint)
    if cached and (now - cached[0]).total_seconds() < 300:
        return jsonify(cached[1])
    try:
        r = requests.get(
            f'https://www.meteoromania.ro/wp-json/meteoapi/v2/{endpoint}',
            timeout=15,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.meteoromania.ro/'
            }
        )
        r.raise_for_status()
        data = r.json()
        _anm_cache[endpoint] = (now, data)
        return jsonify(data)
    except Exception as e:
        if cached:
            return jsonify(cached[1])
        return jsonify({'error': str(e)}), 502


@app.route('/api/judete')
@app.route('/api/judete-geojson')
def judete_geojson():
    """Conturul județelor României (GeoJSON) — descărcat o dată și păstrat pe disc."""
    local = os.path.join(BASE_DIR, 'judete.geojson')
    if not os.path.exists(local):
        try:
            r = requests.get(
                'https://raw.githubusercontent.com/GabrielRondelli/geojson/main/romania-counties.geojson',
                timeout=20,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            r.raise_for_status()
            with open(local, 'wb') as f:
                f.write(r.content)
        except Exception as e:
            return jsonify({'error': str(e)}), 502
    return send_file(local, mimetype='application/geo+json')


# ═══════════════════════════════════════════════════════════════
#  PROXY OpenWeatherMap — cheia rămâne pe server, nu în browser
# ═══════════════════════════════════════════════════════════════
_owm_cache = {}

@app.route('/api/owm/weather')
def owm_weather():
    key = 'weather:' + request.args.get('lat','') + ',' + request.args.get('lon','') + ',' + request.args.get('lang','ro')
    now = now_ro()
    c = _owm_cache.get(key)
    if c and (now - c[0]).total_seconds() < 120:
        return jsonify(c[1])
    try:
        r = requests.get('https://api.openweathermap.org/data/2.5/weather', params={
            'lat': request.args.get('lat', '44.9266'), 'lon': request.args.get('lon', '25.4566'),
            'units': 'metric', 'lang': request.args.get('lang', 'ro'), 'appid': OPENWEATHER_API_KEY
        }, timeout=15)
        r.raise_for_status()
        data = r.json()
        _owm_cache[key] = (now, data)
        return jsonify(data)
    except Exception as e:
        if c:
            return jsonify(c[1])
        return jsonify({'error': str(e)}), 502

@app.route('/api/owm/find')
def owm_find():
    key = 'find:' + request.args.get('lat', '') + ',' + request.args.get('lon', '')
    now = now_ro()
    c = _owm_cache.get(key)
    if c and (now - c[0]).total_seconds() < 300:
        return jsonify(c[1])
    try:
        r = requests.get('https://api.openweathermap.org/data/2.5/find', params={
            'lat': request.args.get('lat', '44.9266'), 'lon': request.args.get('lon', '25.4566'),
            'cnt': request.args.get('cnt', '25'), 'units': 'metric', 'lang': 'ro', 'appid': OPENWEATHER_API_KEY
        }, timeout=15)
        r.raise_for_status()
        data = r.json()
        _owm_cache[key] = (now, data)
        return jsonify(data)
    except Exception as e:
        if c:
            return jsonify(c[1])
        return jsonify({'error': str(e)}), 502

@app.route('/api/owm/tile/<layer>/<int:z>/<int:x>/<int:y>.png')
def owm_tile(layer, z, x, y):
    allowed = {'pressure_new', 'clouds_new', 'wind_new', 'precipitation_new', 'temp_new'}
    if layer not in allowed:
        return 'Not found', 404
    try:
        r = requests.get(f'https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png',
                         params={'appid': OPENWEATHER_API_KEY}, timeout=15)
        from flask import Response
        return Response(r.content, mimetype='image/png')
    except Exception:
        return '', 502


# ═══════════════════════════════════════════════════════════════
#  NOTIFICĂRI PUSH (Web Push / VAPID)
#  Abonamentele se păstrează în Firebase, la calea /push_subs.
#  Verificarea avertizărilor ANM se declanșează prin /api/push/check.
# ═══════════════════════════════════════════════════════════════
PUSH_FIREBASE_URL = "https://licenta-ae902-default-rtdb.europe-west1.firebasedatabase.app"
JUDET_MONITORIZAT = "DB"          # Dâmbovița
_COD_NUME = {1: "cod galben", 2: "cod portocaliu", 3: "cod roșu"}


def _fb(path, method='GET', payload=None):
    """Citire/scriere simplă în Firebase Realtime Database."""
    url = f"{PUSH_FIREBASE_URL}/{path}.json"
    try:
        if method == 'GET':
            r = requests.get(url, timeout=15)
        elif method == 'PUT':
            r = requests.put(url, json=payload, timeout=15)
        elif method == 'DELETE':
            r = requests.delete(url, timeout=15)
        else:
            r = requests.post(url, json=payload, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"⚠️  Firebase {method} {path}: {e}")
        return None


def _sub_key(endpoint):
    """Cheie stabilă pentru un abonament (Firebase nu acceptă caractere speciale)."""
    import hashlib
    return hashlib.sha256(endpoint.encode()).hexdigest()[:32]


@app.route('/api/ping')
def ping():
    """
    Endpoint ultra-ușor, doar ca să țină serverul treaz (planul gratuit adoarme
    după ~15 min de inactivitate). Nu face nicio cerere externă.
    Îl apelezi dintr-un cron la fiecare 10 minute.
    """
    return jsonify({'ok': True, 'ora': now_ro().strftime('%H:%M:%S')})


@app.route('/api/push/key')
def push_key():
    """Cheia publică VAPID — aplicația o folosește la abonare."""
    if not VAPID_PUBLIC_KEY:
        return jsonify({'error': 'notificările nu sunt configurate pe server'}), 503
    return jsonify({'publicKey': VAPID_PUBLIC_KEY})


@app.route('/api/push/subscribe', methods=['POST'])
def push_subscribe():
    sub = request.get_json(silent=True) or {}
    endpoint = sub.get('endpoint')
    if not endpoint:
        return jsonify({'error': 'abonament invalid'}), 400
    inreg = {
        'endpoint': endpoint,
        'keys': sub.get('keys', {}),
        'creat': now_ro().isoformat(timespec='seconds')
    }
    # locația aleasă de utilizator — fără ea toți ar primi vremea din Târgoviște
    try:
        if sub.get('lat') is not None and sub.get('lon') is not None:
            inreg['lat'] = round(float(sub['lat']), 3)
            inreg['lon'] = round(float(sub['lon']), 3)
    except (TypeError, ValueError):
        pass
    for camp in ('nume', 'tara', 'judet', 'limba', 'unitate', 'fus'):
        if sub.get(camp):
            inreg[camp] = str(sub[camp])[:60]
    _fb(f'push_subs/{_sub_key(endpoint)}', 'PUT', inreg)
    return jsonify({'ok': True})


@app.route('/api/push/unsubscribe', methods=['POST'])
def push_unsubscribe():
    sub = request.get_json(silent=True) or {}
    endpoint = sub.get('endpoint')
    if endpoint:
        _fb(f'push_subs/{_sub_key(endpoint)}', 'DELETE')
    return jsonify({'ok': True})


def _send_push(subscription, payload):
    """Trimite o notificare către un abonament. Returnează (succes, cod)."""
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        print("⚠️  pywebpush lipsește: pip install pywebpush")
        return False, 'lib'
    try:
        webpush(
            subscription_info={'endpoint': subscription['endpoint'], 'keys': subscription.get('keys', {})},
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={'sub': VAPID_CLAIM_EMAIL}
        )
        return True, 200
    except WebPushException as e:
        code = getattr(getattr(e, 'response', None), 'status_code', 0)
        return False, code
    except Exception as e:
        print(f"⚠️  push: {e}")
        return False, 0


def broadcast_push(payload):
    """
    Trimite tuturor abonaților; curăță abonamentele expirate.
    O eroare la un abonament nu oprește restul.
    """
    subs = _fb('push_subs') or {}
    trimise, sterse = 0, 0
    if not isinstance(subs, dict):
        return 0, 0
    for key, sub in list(subs.items()):
        try:
            if not isinstance(sub, dict) or not sub.get('endpoint'):
                continue
            ok, code = _send_push(sub, payload)
            if ok:
                trimise += 1
            elif code in (404, 410):        # abonament expirat / dezinstalat
                _fb(f'push_subs/{key}', 'DELETE')
                sterse += 1
        except Exception as e:
            print(f"⚠️  push către {key}: {e}", flush=True)
    return trimise, sterse


@app.route('/api/push/test', methods=['POST', 'GET'])
def push_test():
    """Trimite o notificare de test (util la verificare)."""
    if request.args.get('secret') != PUSH_CRON_SECRET:
        return jsonify({'error': 'acces interzis'}), 403
    t, s = broadcast_push({
        'title': '🌤️ METEO Târgoviște',
        'body': 'Notificările funcționează. Vei primi alerte la avertizări meteo.',
        'url': '/'
    })
    return jsonify({'trimise': t, 'sterse': s})


@app.route('/api/push/check')
def push_check():
    """
    Verifică avertizările ANM pentru județul monitorizat și trimite notificare
    DOAR când apare ceva nou (nu la fiecare verificare).
    Se apelează periodic dintr-un serviciu de cron.

    Important: returnează MEREU 200, chiar și când ANM nu răspunde, ca serviciul
    de cron să nu raporteze erori pentru probleme temporare din exterior.
    """
    if request.args.get('secret') != PUSH_CRON_SECRET:
        return jsonify({'error': 'acces interzis'}), 403
    try:
        return _push_check_intern()
    except Exception as e:
        import traceback
        print("❌ push_check:", traceback.format_exc(), flush=True)
        return jsonify({'ok': False, 'eroare': str(e)[:200]}), 200


def _push_check_intern():
    try:
        r = requests.get('https://www.meteoromania.ro/wp-json/meteoapi/v2/avertizari-generale',
                         timeout=25, headers={'User-Agent': 'MeteoNow/1.0'})
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        # nu e vina noastră — raportăm ca „ok, dar sursa e indisponibilă"
        return jsonify({'ok': True, 'sursaIndisponibila': str(e)[:120], 'schimbare': False}), 200

    def unwrap(o):
        if not isinstance(o, dict):
            return {}
        out = dict(o.get('@attributes') or {})
        for k, v in o.items():
            if k != '@attributes':
                out[k] = v
        return out

    def as_list(x):
        if not x:
            return []
        return [unwrap(i) for i in (x if isinstance(x, list) else [x])]

    warns = as_list(data.get('avertizare'))
    active = []
    for w in warns:
        nivel = 0
        # zonele precise (ex. DB_munte) au prioritate; altfel județul
        for z in as_list(w.get('zona')) + as_list(w.get('judet')):
            cod = str(z.get('cod', '')).upper()
            if cod.startswith(JUDET_MONITORIZAT):
                try:
                    nivel = max(nivel, int(z.get('culoare') or 0))
                except (TypeError, ValueError):
                    pass
        if nivel > 0:
            active.append({
                'nivel': nivel,
                'tip': w.get('numeTipMesaj') or 'Avertizare meteorologică',
                'fenomene': (w.get('fenomeneVizate') or '').strip(),
                'interval': (w.get('intervalul') or '').strip(),
                'expira': w.get('dataExpirarii') or ''
            })

    # amprenta situației curente — ca să nu repetăm aceeași notificare
    amprenta = "|".join(sorted(f"{a['nivel']}:{a['tip']}:{a['interval']}" for a in active)) or "fara"
    stare = _fb('push_state') or {}
    if isinstance(stare, dict) and stare.get('amprenta') == amprenta:
        return jsonify({'schimbare': False, 'active': len(active)})

    _fb('push_state', 'PUT', {'amprenta': amprenta,
                              'actualizat': now_ro().isoformat(timespec='seconds')})

    if not active:
        return jsonify({'schimbare': True, 'active': 0, 'trimise': 0,
                        'info': 'nu mai sunt avertizări active — fără notificare'})

    top = max(active, key=lambda a: a['nivel'])
    cod_txt = _COD_NUME.get(top['nivel'], 'avertizare')
    titlu = f"⚠️ {cod_txt.upper()} — Dâmbovița"
    corp = top['tip']
    if top['fenomene'] and top['fenomene'] != 'conform textelor':
        corp = top['fenomene']
    if top['interval'] and top['interval'] != 'conform textelor':
        corp += f" · {top['interval']}"

    t, s = broadcast_push({'title': titlu, 'body': corp, 'url': '/#warnings-section',
                           'tag': 'anm-avertizare', 'nivel': top['nivel']})
    return jsonify({'schimbare': True, 'active': len(active), 'trimise': t, 'sterse': s,
                    'titlu': titlu, 'corp': corp})


# ═══════════════════════════════════════════════════════════════
#  REZUMATUL ZILEI + SFATURI (notificări personalizate pe locație)
#
#  Fiecare abonat are propriile coordonate, deci propriul mesaj.
#  Grupăm abonații pe coordonate rotunjite ca să nu cerem de zece ori
#  aceeași prognoză de la Open-Meteo.
# ═══════════════════════════════════════════════════════════════

def _prognoza_scurta(lat, lon):
    """Datele de care avem nevoie pentru un rezumat: azi, mâine, UV, vânt."""
    url = ('https://api.open-meteo.com/v1/forecast'
           f'?latitude={lat}&longitude={lon}'
           '&current=temperature_2m,apparent_temperature,weather_code,wind_gusts_10m,uv_index'
           '&daily=temperature_2m_max,temperature_2m_min,weather_code,'
           'precipitation_probability_max,uv_index_max,wind_gusts_10m_max'
           '&forecast_days=3&past_days=1&timezone=auto')
    r = requests.get(url, timeout=20, headers={'User-Agent': 'MeteoNow/1.0'})
    r.raise_for_status()
    return r.json()


_WMO_RO = {
    0: 'senin', 1: 'în mare parte senin', 2: 'parțial noros', 3: 'înnorat',
    45: 'ceață', 48: 'ceață cu chiciură', 51: 'burniță', 53: 'burniță', 55: 'burniță deasă',
    61: 'ploaie slabă', 63: 'ploaie', 65: 'ploaie puternică',
    71: 'ninsoare slabă', 73: 'ninsoare', 75: 'ninsoare puternică',
    80: 'averse', 81: 'averse', 82: 'averse puternice',
    95: 'furtună', 96: 'furtună cu grindină', 99: 'furtună cu grindină',
}
_WMO_EN = {
    0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'fog', 48: 'freezing fog', 51: 'drizzle', 53: 'drizzle', 55: 'heavy drizzle',
    61: 'light rain', 63: 'rain', 65: 'heavy rain',
    71: 'light snow', 73: 'snow', 75: 'heavy snow',
    80: 'showers', 81: 'showers', 82: 'heavy showers',
    95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
}


def _grade(c, unitate):
    """Temperatura în unitatea aleasă de utilizator, rotunjită."""
    if c is None:
        return '--°'
    if unitate == 'F':
        return f"{round(c * 9 / 5 + 32)}°F"
    return f"{round(c)}°"


def _sfat_zi(maxi, uv, prob, rafale, cod, limba):
    """Un singur sfat scurt, ales după cel mai apăsător lucru al zilei."""
    en = limba == 'en'
    if maxi is not None and maxi >= 35:
        return ('Bea apă des și stai la umbră între 11 și 17. Limonada rece e o idee bună.'
                if not en else 'Drink often and stay in the shade between 11am and 5pm.')
    if uv is not None and uv >= 8:
        return (f'UV {round(uv)} — cremă de protecție și pălărie, pielea se arde repede.'
                if not en else f'UV {round(uv)} — sunscreen and a hat, skin burns fast.')
    if cod in (95, 96, 99):
        return ('Se anunță furtună. Ține-te departe de copaci și de câmp deschis.'
                if not en else 'Thunderstorms expected. Stay away from trees and open fields.')
    if prob is not None and prob >= 60:
        return (f'{round(prob)}% șanse de ploaie — ia umbrela cu tine.'
                if not en else f'{round(prob)}% chance of rain — take an umbrella.')
    if rafale is not None and rafale >= 60:
        return (f'Rafale de {round(rafale)} km/h. Ține-ți pălăria și strânge ce e pe balcon.'
                if not en else f'Gusts up to {round(rafale)} km/h. Secure loose things outside.')
    if maxi is not None and maxi <= -8:
        return ('Ger serios. Mănuși, fes și cât mai puțin timp afară.'
                if not en else 'Serious cold. Gloves, hat, and keep it short outside.')
    if maxi is not None and maxi <= 2:
        return ('Atenție la polei dimineața — asfaltul umed înșală.'
                if not en else 'Watch for black ice in the morning.')
    return ('Zi liniștită. Profită de ea.' if not en else 'A calm day. Make the most of it.')


def _compune_rezumat(p, moment, limba, unitate, nume):
    """Construiește titlul și corpul notificării. Returnează (titlu, corp) sau None."""
    zi = p.get('daily') or {}
    en = limba == 'en'
    tabel = _WMO_EN if en else _WMO_RO

    # past_days=1 → indicele 0 e ieri, 1 e azi, 2 e mâine
    try:
        maxime = zi['temperature_2m_max']
        minime = zi['temperature_2m_min']
        coduri = zi.get('weather_code') or []
        probs = zi.get('precipitation_probability_max') or []
        uvs = zi.get('uv_index_max') or []
        raf = zi.get('wind_gusts_10m_max') or []
    except (KeyError, TypeError):
        return None

    seara = moment == 'seara'
    i = 2 if seara else 1                       # seara vorbim despre mâine
    ref = 1 if seara else 0                     # comparăm cu azi, respectiv cu ieri
    if len(maxime) <= i:
        return None

    maxi, mini = maxime[i], minime[i]
    cod = coduri[i] if len(coduri) > i else None
    prob = probs[i] if len(probs) > i else None
    uv = uvs[i] if len(uvs) > i else None
    rafale = raf[i] if len(raf) > i else None
    vreme = tabel.get(cod, '')

    dif = None
    if len(maxime) > ref and maxime[ref] is not None and maxi is not None:
        dif = maxi - maxime[ref]

    cand = ('Tomorrow' if en else 'Mâine') if seara else ('Today' if en else 'Azi')
    titlu = f"{_grade(maxi, unitate)} {cand.lower()}"
    if vreme:
        titlu += f" · {vreme}"
    if dif is not None and abs(dif) >= 3:
        pas = abs(dif) * 9 / 5 if unitate == 'F' else abs(dif)
        u = '°F' if unitate == 'F' else '°'
        if en:
            titlu += f" · {round(pas)}{u} {'warmer' if dif > 0 else 'colder'}"
        else:
            titlu += f" · cu {round(pas)}{u} mai {'cald' if dif > 0 else 'rece'}"

    loc = nume or ('your area' if en else 'zona ta')
    # săgeți în loc de cratimă: la temperaturi negative „-17°–-9°" era ilizibil
    corp = f"{loc} · ↑{_grade(maxi, unitate)} ↓{_grade(mini, unitate)}. "
    corp += _sfat_zi(maxi, uv, prob, rafale, cod, limba)
    return titlu, corp


@app.route('/api/push/rezumat')
def push_rezumat():
    """
    Rezumatul zilei, personalizat pentru locația fiecărui abonat.
    Se apelează din cron: dimineața (?moment=dimineata) și seara (?moment=seara).
    Returnează mereu 200, ca serviciul de cron să nu semnaleze erori externe.
    """
    if request.args.get('secret') != PUSH_CRON_SECRET:
        return jsonify({'error': 'acces interzis'}), 403
    try:
        return _rezumat_intern(request.args.get('moment', 'dimineata'))
    except Exception as e:
        import traceback
        print("❌ push_rezumat:", traceback.format_exc(), flush=True)
        return jsonify({'ok': False, 'eroare': str(e)[:200]}), 200


def _rezumat_intern(moment):
    subs = _fb('push_subs') or {}
    if not isinstance(subs, dict):
        return jsonify({'ok': True, 'abonati': 0})

    # grupăm pe coordonate rotunjite (~1 km) ca să nu repetăm aceeași cerere
    grupuri = {}
    for cheie, sub in subs.items():
        if not isinstance(sub, dict) or not sub.get('endpoint'):
            continue
        # abonații vechi (dinainte de salvarea locației) rămân pe Târgoviște
        lat = sub.get('lat', 44.9266)
        lon = sub.get('lon', 25.4566)
        grupuri.setdefault((round(float(lat), 2), round(float(lon), 2)), []).append((cheie, sub))

    trimise = sterse = fara_date = 0
    for (lat, lon), lista in grupuri.items():
        try:
            p = _prognoza_scurta(lat, lon)
        except Exception as e:
            print(f"⚠️  prognoză {lat},{lon}: {e}", flush=True)
            fara_date += len(lista)
            continue
        for cheie, sub in lista:
            rez = _compune_rezumat(p, moment, sub.get('limba', 'ro'),
                                   sub.get('unitate', 'C'), sub.get('nume'))
            if not rez:
                fara_date += 1
                continue
            titlu, corp = rez
            ok, cod = _send_push(sub, {
                'title': ('🌤️ ' + titlu), 'body': corp, 'url': '/',
                'tag': 'rezumat-' + moment
            })
            if ok:
                trimise += 1
            elif cod in (404, 410):
                _fb(f'push_subs/{cheie}', 'DELETE')
                sterse += 1

    return jsonify({'ok': True, 'moment': moment, 'grupuri': len(grupuri),
                    'trimise': trimise, 'sterse': sterse, 'faraDate': fara_date})


# ═══════════════════════════════════════════════════════════════
#  API PENTRU WIDGET (ecranul telefonului)
#  Răspuns mic și rapid, gata de afișat — widget-ul nativ nu face calcule.
# ═══════════════════════════════════════════════════════════════
_widget_cache = {'t': None, 'data': None}


@app.route('/api/widget')
def widget_data():
    now = now_ro()
    if _widget_cache['data'] and _widget_cache['t'] and (now - _widget_cache['t']).total_seconds() < 300:
        return jsonify(_widget_cache['data'])

    out = {
        'oras': 'Târgoviște',
        'temp': None,
        'tempText': '--',
        'resimtit': None,
        'descriere': '',
        'icon': 'nor',
        'umiditate': None,
        'vant': None,
        'maxAzi': None,
        'minAzi': None,
        'codAvertizare': 0,
        'codText': '',
        'avertizare': '',
        'zile': [],                      # prognoza pe 3 zile
        'actualizat': now.strftime('%H:%M')
    }

    # 1) vremea curentă (OpenWeatherMap)
    try:
        r = requests.get('https://api.openweathermap.org/data/2.5/weather', params={
            'lat': 44.9266, 'lon': 25.4566, 'units': 'metric', 'lang': 'ro',
            'appid': OPENWEATHER_API_KEY
        }, timeout=12)
        r.raise_for_status()
        d = r.json()
        t = d.get('main', {}).get('temp')
        if t is not None:
            out['temp'] = round(t, 1)
            out['tempText'] = f"{round(t)}°"
        rs = d.get('main', {}).get('feels_like')
        if rs is not None:
            out['resimtit'] = round(rs)
        w0 = (d.get('weather') or [{}])[0]
        desc = (w0.get('description') or '').strip()
        out['descriere'] = desc[:1].upper() + desc[1:] if desc else ''
        out['umiditate'] = d.get('main', {}).get('humidity')
        vant = d.get('wind', {}).get('speed')
        if vant is not None:
            out['vant'] = round(vant * 3.6)          # m/s → km/h
        oid = w0.get('id', 800)
        noapte = 'n' in (w0.get('icon') or '')
        if 200 <= oid < 300:   out['icon'] = 'furtuna'
        elif 300 <= oid < 400: out['icon'] = 'burnita'
        elif 500 <= oid < 600: out['icon'] = 'ploaie'
        elif 600 <= oid < 700: out['icon'] = 'ninsoare'
        elif 700 <= oid < 800: out['icon'] = 'ceata'
        elif oid == 800:       out['icon'] = 'luna' if noapte else 'soare'
        elif oid in (801, 802): out['icon'] = 'partial'
        else:                  out['icon'] = 'nor'
    except Exception as e:
        print(f"⚠️  widget/vreme: {e}")

    # 1b) prognoza pe 3 zile + max/min azi (Open-Meteo, fără cheie)
    try:
        r = requests.get('https://api.open-meteo.com/v1/forecast', params={
            'latitude': 44.9266, 'longitude': 25.4566,
            'daily': 'temperature_2m_max,temperature_2m_min,weathercode',
            'forecast_days': 4, 'timezone': 'Europe/Bucharest'
        }, timeout=12)
        r.raise_for_status()
        dz = r.json().get('daily', {})
        zile_ro = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']

        def icon_wmo(c):
            if c == 0:   return 'soare'
            if c <= 2:   return 'partial'
            if c == 3:   return 'nor'
            if c <= 48:  return 'ceata'
            if c <= 57:  return 'burnita'
            if c <= 67:  return 'ploaie'
            if c <= 77:  return 'ninsoare'
            if c <= 82:  return 'ploaie'
            if c <= 86:  return 'ninsoare'
            return 'furtuna'

        times = dz.get('time') or []
        maxs = dz.get('temperature_2m_max') or []
        mins = dz.get('temperature_2m_min') or []
        codes = dz.get('weathercode') or []

        if maxs and mins:
            out['maxAzi'] = round(maxs[0])
            out['minAzi'] = round(mins[0])

        zile = []
        for i in range(1, min(4, len(times))):          # mâine + următoarele 2
            try:
                d_ = datetime.strptime(times[i], '%Y-%m-%d')
                zile.append({
                    'zi': zile_ro[d_.weekday()],
                    'max': round(maxs[i]),
                    'min': round(mins[i]),
                    'icon': icon_wmo(codes[i] if i < len(codes) else 3)
                })
            except Exception:
                pass
        out['zile'] = zile
    except Exception as e:
        print(f"⚠️  widget/prognoza: {e}")

    # 2) avertizare ANM pentru județul monitorizat
    try:
        r = requests.get('https://www.meteoromania.ro/wp-json/meteoapi/v2/avertizari-generale',
                         timeout=15, headers={'User-Agent': 'StatiaMeteoTargoviste/1.0'})
        r.raise_for_status()
        data = r.json()

        def unwrap(o):
            if not isinstance(o, dict):
                return {}
            res = dict(o.get('@attributes') or {})
            for k, v in o.items():
                if k != '@attributes':
                    res[k] = v
            return res

        def as_list(x):
            if not x:
                return []
            return [unwrap(i) for i in (x if isinstance(x, list) else [x])]

        nivel, text = 0, ''
        for w in as_list(data.get('avertizare')):
            n = 0
            for z in as_list(w.get('zona')) + as_list(w.get('judet')):
                if str(z.get('cod', '')).upper().startswith(JUDET_MONITORIZAT):
                    try:
                        n = max(n, int(z.get('culoare') or 0))
                    except (TypeError, ValueError):
                        pass
            if n > nivel:
                nivel = n
                fen = (w.get('fenomeneVizate') or '').strip()
                text = fen if fen and fen != 'conform textelor' else (w.get('numeTipMesaj') or '')
        out['codAvertizare'] = nivel
        out['codText'] = _COD_NUME.get(nivel, '')
        out['avertizare'] = text[:90]
    except Exception as e:
        print(f"⚠️  widget/ANM: {e}")

    _widget_cache['t'] = now
    _widget_cache['data'] = out
    return jsonify(out)


# ═══════════════════════════════════════════════════════════════
#  CONTEXT DATE SENZORI
# ═══════════════════════════════════════════════════════════════
def build_context_prompt(context):
    if not context:
        return ""
    esp = context.get('esp32', {})
    lora = context.get('lorawan', {})
    
    # Folosim badge-urile din UI care arata starea reala (Online / Acum Xh Ymin)
    esp_badge  = (esp.get('status_badge') or '').strip()
    lora_badge = (lora.get('status_badge') or '').strip()
    
    # Online doar daca badge-ul contine "Online" (✅ Online), altfel e offline/stale
    esp_online  = 'Online' in esp_badge and bool(esp.get('temperatura'))
    lora_online = 'Online' in lora_badge and any(lora.get(k) for k in ['temperatura', 'umiditate', 'presiune', 'gaz'])
    
    lines = ["\n📊 DATE LIVE (acest moment):\n"]
    
    # ESP32
    if esp_online:
        lines.append(f"Senzor ESP32-C61 (Wi-Fi) — STATUS: ONLINE [{esp_badge}]")
        if esp.get('temperatura'): lines.append(f"  - Temperatura: {esp['temperatura']}°C")
        if esp.get('umiditate'):   lines.append(f"  - Umiditate: {esp['umiditate']}%")
        if esp.get('presiune'):    lines.append(f"  - Presiune: {esp['presiune']} hPa")
        if esp.get('iaq'):         lines.append(f"  - IAQ: {esp['iaq']} (scala 0-500)")
        if esp.get('gaz'):         lines.append(f"  - Gaz: {esp['gaz']} kΩ")
    else:
        if esp_badge and 'Online' not in esp_badge:
            lines.append(f"Senzor ESP32-C61 (Wi-Fi) — STATUS: OFFLINE [{esp_badge}]")
            lines.append("  (datele de mai jos sunt VECHI, nu reflecta starea actuala)")
            if esp.get('temperatura'): lines.append(f"  - Ultima temperatura cunoscuta: {esp['temperatura']}°C")
            if esp.get('umiditate'):   lines.append(f"  - Ultima umiditate cunoscuta: {esp['umiditate']}%")
        else:
            lines.append("Senzor ESP32-C61 (Wi-Fi) — STATUS: OFFLINE / fara date")
    
    # LoRaWAN — status include si lantul gateway → ChirpStack → MQTT bridge
    if lora_online:
        lines.append(f"\nLant LoRaWAN (Dragino gateway → ChirpStack → MQTT → Firebase) — STATUS: ONLINE [{lora_badge}]")
        lines.append("  (gateway-ul si dispozitivul SparkFun expLoRaBLE functioneaza, lantul complet activ)")
        if lora.get('temperatura'): lines.append(f"  - Temperatura: {lora['temperatura']}°C")
        if lora.get('umiditate'):   lines.append(f"  - Umiditate: {lora['umiditate']}%")
        if lora.get('presiune'):    lines.append(f"  - Presiune: {lora['presiune']} hPa")
        if lora.get('gaz'):         lines.append(f"  - Gaz: {lora['gaz']} kΩ")
        if lora.get('rssi'):        lines.append(f"  - RSSI: {lora['rssi']} dBm")
        if lora.get('snr'):         lines.append(f"  - SNR: {lora['snr']} dB")
        if lora.get('fcnt'):        lines.append(f"  - Frame counter: {lora['fcnt']}")
    else:
        if lora_badge and 'Online' not in lora_badge:
            lines.append(f"\nLant LoRaWAN (Dragino gateway → ChirpStack → MQTT → Firebase) — STATUS: OFFLINE [{lora_badge}]")
            lines.append("  IMPORTANT: Nu primim pachete LoRaWAN. Cauza poate fi:")
            lines.append("  1) Gateway-ul Dragino LPS8v2 este oprit, deconectat de la internet, sau a pierdut conexiunea Wi-Fi/Ethernet")
            lines.append("  2) Dispozitivul SparkFun expLoRaBLE este oprit, fara baterie, sau a iesit din aria de acoperire")
            lines.append("  3) Serverul ChirpStack al universitatii nu raspunde sau MQTT bridge nu ruleaza")
            lines.append("  Cand utilizatorul intreaba de gateway sau LoRaWAN, mentioneaza ca lantul e intrerupt si listeaza posibilele cauze. NU spune ca e Online.")
            lines.append("  (datele de mai jos sunt VECHI, ultimele cunoscute)")
            if lora.get('temperatura'): lines.append(f"  - Ultima temperatura cunoscuta: {lora['temperatura']}°C")
        else:
            lines.append("\nLant LoRaWAN — STATUS: OFFLINE / fara date deloc")
            lines.append("  Niciun pachet primit. Verifica gateway-ul Dragino si dispozitivul expLoRaBLE.")
    
    return "\n".join(lines)


SYSTEM_PROMPT = """Esti asistentul AI al aplicatiei METEO NOW — o aplicatie meteo care ofera vremea in timp real pentru ORICE localitate din lume. Esti practic meteorologul de serviciu al aplicatiei: raspunzi despre vremea curenta, prognoze, avertizari si despre ce ofera aplicatia.

REGULA DE AUR — LOCALITATEA:
- La fiecare mesaj primesti localitatea selectata de utilizator. TOATE raspunsurile se refera la ACEA localitate.
- Nu presupune niciodata alt oras. Daca utilizatorul intreaba "cum e vremea?", raspunzi pentru localitatea selectata.
- Daca vrea alt oras, ii spui ca o poate schimba din selectorul de locatie din bara de sus (pictograma cu ac).

CE OFERA APLICATIA (poti ghida utilizatorul catre sectiuni):
- Vremea curenta: temperatura, temperatura resimtita, umiditate, vant, presiune, rasarit/apus, faza lunii
- "Cat de neobisnuita e ziua de azi": compara ziua cu ultimii 30 de ani (arhiva ERA5) si arata abaterea de la normal si rangul istoric — functia noastra unica
- Alerte meteo spatiale: date NOAA live (blackout radio R0-R5, furtuni geomagnetice Kp G0-G5, radiatie solara S0-S5)
- Radar de precipitatii cu animatie si harta de acumulare 24h
- Prognoze: sinoptica, numerica pe 10 zile, pe termen lung (16 zile), harta sinoptica de analiza (fronturi)
- Animatie satelit infrarosu si animatie radar
- Setari: tema (automat/luminos/intunecat), limba RO/EN, notificari, animatii
- Se instaleaza ca aplicatie pe telefon (Android si iPhone) si are widget pentru ecranul principal

DOAR IN ROMANIA (apar automat cand localitatea e in Romania):
- Avertizarile oficiale ANM cu harta zonelor afectate si codurile galben/portocaliu/rosu
- Raportul statiilor sinoptice ANM din toata tara
- Avertizari hidrologice (debitul raurilor)

DOAR PENTRU TARGOVISTE (Romania):
- Aplicatia are acolo statii meteo proprii, cu senzori BME680, conectate prin Wi-Fi si LoRaWAN
- Cand nodurile sunt online, temperatura afisata e masurata direct de ele
- Mentionezi asta doar daca utilizatorul e in Targoviste sau intreaba explicit. NU insista pe detalii tehnice.

SURSE DE DATE: Open-Meteo (prognoze, arhiva climatica, hidro), OpenWeatherMap (vremea curenta), RainViewer (radar si satelit), NOAA SWPC (vreme spatiala), DWD (analiza sinoptica), ANM/meteoromania.ro (avertizari oficiale Romania), statii proprii (Targoviste).

STIL DE COMUNICARE:
- Raspunzi in LIMBA indicata in context (ro = romana, en = engleza). Daca e engleza, raspunzi natural in engleza, nu traduceri stangace.
- Natural si prietenos, ca un meteorolog care explica pe intelesul oricui
- IMPLICIT raspunsuri SCURTE (1-3 propozitii). Doar la cerere explicita → mai lungi
- Emoji subtile (maxim 1 per raspuns)
- NU folosi markdown (* ** _ etc)
- Raspunzi lejer si la lucruri de baza: ce ora e, ce zi/data e, saluturi, intrebari generale despre vreme, clima, fenomene meteo
- Daca intrebarea nu tine deloc de vreme, raspunzi scurt si politicos, apoi readuci discutia la vreme

DATE LIVE PRIMITE:
- Primesti vremea afisata acum pentru localitatea selectata. Foloseste-o, nu inventa.
- Daca esti in Targoviste, primesti si valorile de la senzorii proprii.
- "--" sau lipsa = nu ai acea informatie; spune sincer ca nu o ai.

CUNOSTINTE UTILE:
- Temperatura de confort: 20-22°C; umiditate confortabila: 40-60%
- Indice UV: <3 scazut, 3-6 moderat, 6-8 ridicat, 8-11 foarte ridicat, >11 extrem
- Calitatea aerului IAQ (0-500): <50 excelent, 50-100 bun, 100-150 moderat, 150-200 nesanatos pentru sensibili, >200 nesanatos
- Coduri de avertizare: galben = fii atent, portocaliu = pericol, rosu = pericol major
- Tii minte conversatia si poti face referire la ce s-a discutat"""


# ═══════════════════════════════════════════════════════════════
#  CHATBOT CLAUDE SONNET 4.6
# ═══════════════════════════════════════════════════════════════
@app.route('/ask', methods=['POST'])
def ask():
    body = request.json or {}
    user_question = body.get('question', '').strip()
    context = body.get('context', {})
    history = body.get('history', [])
    lang = (body.get('lang') or 'ro').lower()
    loc = body.get('locatie') or {}
    vremea = body.get('vremea') or {}

    if not user_question:
        return jsonify({'error': 'No question'}), 400

    # ── Limba în care trebuie să răspundă ──
    if lang.startswith('en'):
        limba_text = ("\nLIMBA RASPUNSULUI: ENGLEZA. Raspunde natural in engleza, "
                      "ca un vorbitor nativ. Nu amesteca limbile.")
    else:
        limba_text = "\nLIMBA RASPUNSULUI: ROMANA. Raspunde natural in romana."

    # ── Localitatea selectată ──
    loc_lines = []
    if loc.get('nume'):
        zona = ", ".join([x for x in [loc.get('admin'), loc.get('tara')] if x])
        loc_lines.append(f"\nLOCALITATEA SELECTATA ACUM: {loc['nume']}" + (f" ({zona})" if zona else ""))
        if loc.get('lat') is not None:
            loc_lines.append(f"Coordonate: {round(float(loc['lat']), 3)}, {round(float(loc['lon']), 3)}")
        if loc.get('inRomania'):
            loc_lines.append("Este in Romania → avertizarile oficiale ANM si raportul statiilor sunt disponibile in aplicatie.")
        else:
            loc_lines.append("NU este in Romania → sectiunile ANM (avertizari oficiale romanesti) nu se afiseaza pentru aceasta localitate.")
        if loc.get('areStatiiProprii'):
            loc_lines.append("Aici aplicatia are STATII METEO PROPRII (senzori BME680, Wi-Fi + LoRaWAN); temperatura afisata poate fi masurata direct de ele.")
        else:
            loc_lines.append("Aici NU exista statii proprii; datele vin din modele si statii publice. Nu vorbi despre senzorii proprii decat daca esti intrebat explicit.")
    loc_text = "\n".join(loc_lines)

    # ── Vremea afișată acum în aplicație ──
    v_lines = []
    if vremea.get('temperatura'):
        v_lines.append(f"\nVREMEA AFISATA ACUM IN APLICATIE (pentru localitatea de mai sus):")
        v_lines.append(f"Temperatura: {vremea['temperatura']}")
    if vremea.get('detalii'):
        v_lines.append(f"Detalii: {vremea['detalii']}")
    if vremea.get('rasarit') and vremea.get('rasarit') != '--:--':
        v_lines.append(f"Rasarit: {vremea['rasarit']} · Apus: {vremea.get('apus', '--')}")
    if vremea.get('fazaLunii'):
        v_lines.append(f"Faza lunii: {vremea['fazaLunii']}")
    vremea_text = "\n".join(v_lines)

    # Datele senzorilor proprii — doar când sunt relevante (Târgoviște)
    context_text = build_context_prompt(context) if loc.get('areStatiiProprii') else ""

    # Data si ora curenta (ora Romaniei), ca asistentul sa poata raspunde la "cat este ora?"
    _zile_ro = ['luni', 'marti', 'miercuri', 'joi', 'vineri', 'sambata', 'duminica']
    _zile_en = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    _acum = now_ro()
    _zi = (_zile_en if lang.startswith('en') else _zile_ro)[_acum.weekday()]
    ora_text = (f"\nDATA SI ORA CURENTA: {_zi}, {_acum.strftime('%d.%m.%Y')}, ora {_acum.strftime('%H:%M')} "
                f"(ora Romaniei). Daca utilizatorul intreaba cat e ora sau ce zi este, foloseste aceasta valoare.")

    full_system = f"{SYSTEM_PROMPT}{limba_text}{loc_text}{vremea_text}\n{context_text}{ora_text}"
    
    # Construim messages pentru Claude
    messages = []
    for msg in history:
        role = msg.get('role', 'user')
        text = msg.get('text', '')
        if text:
            messages.append({
                "role": "assistant" if role == "model" else "user",
                "content": text
            })
    
    messages.append({
        "role": "user",
        "content": user_question
    })

    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    data = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 2000,
        "system": full_system,
        "messages": messages
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        if 'content' not in result or len(result['content']) == 0:
            print(f"⚠️ Raspuns gol: {result}")
            return jsonify({'error': 'Raspuns gol de la Claude'}), 500
        
        answer = result['content'][0]['text']
        stop_reason = result.get('stop_reason', 'unknown')
        usage = result.get('usage', {})
        print(f"✅ Claude OK ({len(answer)} chars, stop={stop_reason}, tokens in={usage.get('input_tokens',0)} out={usage.get('output_tokens',0)})")
        
        return jsonify({'answer': answer})
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Timeout'}), 504
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP {e.response.status_code}: {e.response.text}")
        return jsonify({'error': f'API Error: {e.response.status_code}'}), 500
    except Exception as e:
        print(f"❌ Eroare: {e}")
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════
#  EXPORT FIREBASE (CSV / Excel)
# ═══════════════════════════════════════════════════════════════
@app.route('/export/<source>')
def export_data(source):
    """
    source: esp32 | lorawan | excel | zip
    Parametru ?hours=24 pentru filtru pe ultimele X ore
    """
    try:
        from export_firebase_to_csv import (
            fetch_firebase_path, parse_esp32_records, parse_lorawan_records,
            write_csv, write_excel
        )
    except ImportError as e:
        return jsonify({'error': f'Modul lipsa: {e}'}), 500
    
    hours = request.args.get('hours', type=float)
    since_ts = None
    if hours:
        since_ts = (now_ro() - timedelta(hours=hours)).timestamp()
    
    # Cream un folder temporar
    tmp_dir = tempfile.mkdtemp()
    stamp = now_ro().strftime('%Y%m%d_%H%M%S')
    
    try:
        if source == 'esp32':
            data = fetch_firebase_path("senzori/bme680")
            records = parse_esp32_records(data, since_ts)
            path = os.path.join(tmp_dir, f"esp32_bme680_{stamp}.csv")
            write_csv(records, path)
            return send_file(path, as_attachment=True, download_name=f"esp32_bme680_{stamp}.csv")
        
        elif source == 'lorawan':
            data = fetch_firebase_path("istoric/lorawan")
            records = parse_lorawan_records(data, since_ts)
            path = os.path.join(tmp_dir, f"lorawan_expLoRaBLE_{stamp}.csv")
            write_csv(records, path)
            return send_file(path, as_attachment=True, download_name=f"lorawan_expLoRaBLE_{stamp}.csv")
        
        elif source == 'excel':
            esp = parse_esp32_records(fetch_firebase_path("senzori/bme680"), since_ts)
            lora = parse_lorawan_records(fetch_firebase_path("istoric/lorawan"), since_ts)
            path = os.path.join(tmp_dir, f"export_complet_{stamp}.xlsx")
            ok = write_excel(esp, lora, [], path)
            if not ok:
                return jsonify({'error': 'openpyxl nu e instalat. Ruleaza: pip install openpyxl'}), 500
            return send_file(path, as_attachment=True, download_name=f"export_complet_{stamp}.xlsx")

        elif source == 'zip':
            # Toate intr-un ZIP
            esp = parse_esp32_records(fetch_firebase_path("senzori/bme680"), since_ts)
            lora = parse_lorawan_records(fetch_firebase_path("istoric/lorawan"), since_ts)

            esp_csv = os.path.join(tmp_dir, "esp32_bme680.csv")
            lora_csv = os.path.join(tmp_dir, "lorawan_expLoRaBLE.csv")
            excel = os.path.join(tmp_dir, "export_complet.xlsx")
            zip_path = os.path.join(tmp_dir, f"firebase_export_{stamp}.zip")

            write_csv(esp, esp_csv)
            write_csv(lora, lora_csv)
            write_excel(esp, lora, [], excel)

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for f in [esp_csv, lora_csv, excel]:
                    if os.path.exists(f):
                        zf.write(f, os.path.basename(f))

            return send_file(zip_path, as_attachment=True, download_name=f"firebase_export_{stamp}.zip")

        else:
            return jsonify({'error': f'Sursa necunoscuta: {source}. Folositi: esp32 | lorawan | excel | zip'}), 400
    except Exception as e:
        print(f"❌ Eroare export: {e}")
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════
#  SAVE DATA CSV (vechi, pastrat pentru compatibilitate)
# ═══════════════════════════════════════════════════════════════
@app.route('/save_data', methods=['POST'])
def save_data():
    data = request.get_json()
    if not data or 'data' not in data:
        return jsonify({"error": "No data field"}), 400

    records = data['data']
    if not records:
        return jsonify({"error": "Empty data"}), 400

    filename = f"sensor_data_{now_ro().strftime('%Y%m%d_%H%M%S')}.csv"
    filepath = os.path.join(OUTPUT_DIR, filename)

    fieldnames = [
        'server_timestamp_ms', 'client_timestamp_s', 'data_ora',
        'temperatura_C', 'umiditate_%', 'presiune_hPa',
        'iaq', 'gaz_kOhm', 'latenta_ms', 'dimensiune_payload_bytes'
    ]

    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, delimiter='\t')
        writer.writeheader()

        for rec in records:
            client_ts_sec = rec.get('timestamp')
            server_ts_ms = rec.get('server_timestamp')
            latenta = ''
            if server_ts_ms is not None and client_ts_sec is not None:
                try:
                    latenta = int(server_ts_ms) - int(float(client_ts_sec)) * 1000
                except:
                    latenta = ''

            row = {
                'server_timestamp_ms': server_ts_ms,
                'client_timestamp_s': client_ts_sec,
                'data_ora': rec.get('timeLabel', ''),
                'temperatura_C': rec.get('temp', ''),
                'umiditate_%': rec.get('hum', ''),
                'presiune_hPa': rec.get('pres', ''),
                'iaq': rec.get('iaq', ''),
                'gaz_kOhm': rec.get('gas', ''),
                'latenta_ms': latenta,
                'dimensiune_payload_bytes': rec.get('payload_size', '')
            }
            writer.writerow(row)

    return jsonify({"message": f"Saved {len(records)} records", "file": filename}), 200


if __name__ == '__main__':
    # ── DIAGNOSTIC: ce fișier index.html servește de fapt Flask ──
    _served = os.path.join(METEO_DIR, 'index.html') if os.path.exists(os.path.join(METEO_DIR, 'index.html')) else os.path.join(BASE_DIR, 'index.html')
    print("=" * 70)
    print("DIAGNOSTIC — fișierul servit de Flask:")
    print("  ", _served)
    try:
        with open(_served, 'r', encoding='utf-8', errors='ignore') as _f:
            _txt = _f.read()
        print("   text cadrane negru (fill=#000):", ('fill="#000"' in _txt))
        print("   text cadrane alb  (fill=#fff):", ('fill="#fff"' in _txt and 'prefix + i' in _txt))
        print("   dimensiune fișier:", len(_txt), "caractere")
    except Exception as _e:
        print("   nu am putut citi fișierul:", _e)
    print("=" * 70)

    _port = int(os.environ.get('PORT', '5000'))
    print("Serverul rulează pe portul", _port)
    print(" - Pagina principală: http://localhost:%d/" % _port)
    print(" - Asistent Claude:   POST /ask")
    print(" - Salvare date:      POST /save_data")
    app.run(host='0.0.0.0', port=_port, debug=False, use_reloader=False)