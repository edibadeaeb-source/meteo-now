from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import csv
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
if not ANTHROPIC_API_KEY:
    print("⚠️  ANTHROPIC_API_KEY lipsește (setează variabila de mediu sau keys.py) — asistentul AI nu va funcționa.")
OUTPUT_DIR = "exported_data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASE_DIR = str(Path(__file__).parent.resolve())

# Folderul noului site METEO Târgoviște (stil IMGW).
# Caută în mai multe locuri, ca să meargă atât local cât și pe server:
#  1) variabila de mediu STATIC_DIR (dacă o setezi pe gazdă)
#  2) ./public lângă app.py (structura recomandată pentru găzduire)
#  3) ../targoviste-meteo (1)/public (structura ta locală actuală)
_static_candidates = [
    os.environ.get('STATIC_DIR'),
    os.path.join(BASE_DIR, 'public'),
    str((Path(BASE_DIR).parent / 'targoviste-meteo (1)' / 'public').resolve()),
]
METEO_DIR = next((c for c in _static_candidates if c and os.path.exists(os.path.join(c, 'index.html'))),
                 _static_candidates[-1])

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

@app.route('/<path:fname>')
def meteo_static(fname):
    # Fișiere statice ale noului site (manifest PWA, service worker, iconițe)
    safe = os.path.normpath(fname)
    if safe.startswith('..') or os.path.isabs(safe):
        return 'Not found', 404
    full = os.path.join(METEO_DIR, safe)
    if os.path.isfile(full):
        resp = send_from_directory(METEO_DIR, safe)
        # HTML și service worker-ul nu se păstrează în cache; restul (iconițe) da
        if safe.endswith('.html') or safe.endswith('sw.js'):
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
    now = datetime.now()
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
    key = 'weather:' + request.args.get('lat', '') + ',' + request.args.get('lon', '')
    now = datetime.now()
    c = _owm_cache.get(key)
    if c and (now - c[0]).total_seconds() < 120:
        return jsonify(c[1])
    try:
        r = requests.get('https://api.openweathermap.org/data/2.5/weather', params={
            'lat': request.args.get('lat', '44.9266'), 'lon': request.args.get('lon', '25.4566'),
            'units': 'metric', 'lang': 'ro', 'appid': OPENWEATHER_API_KEY
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
    now = datetime.now()
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


SYSTEM_PROMPT = """Esti asistentul AI al statiei METEO Targoviste — serviciul meteo public pentru municipiul Targoviste si judetul Dambovita. Rolul tau este sa raspunzi la intrebari despre vremea curenta, prognoze, avertizari si despre ce ofera acest site. Esti practic meteorologul de serviciu al statiei.

CE STIE SITE-UL (sectiunile lui — poti ghida utilizatorul catre ele):
- HERO: vremea curenta la Targoviste (temperatura mare afisata e masurata de statia proprie cand e online), temperatura resimtita, pozitia soarelui pe arc (rasarit/apus), faza lunii desenata astronomic, cautare de localitati
- ALERTE METEO SPATIALE: 3 cadrane cu date NOAA live — blackout radio (R0-R5), furtuni geomagnetice indice Kp (G0-G5), radiatie solara (S0-S5)
- MONITORIZARE: Raport statii (temperaturi de la statiile sinoptice ANM din toata Romania + statia proprie), Date radar (compozit RainViewer cu animatie), Precipitatii (harta de acumulare 24h pe grila Open-Meteo)
- AVERTIZARI CURENTE: avertizarile oficiale ANM (meteoromania.ro) cu judetele colorate pe coduri galben/portocaliu/rosu + avertizari hidrologice cu debitul raului Ialomita (Open-Meteo Flood/GloFAS)
- PROGNOZE: sinoptica (harta cu localitati din zona, zi/noapte), predictie numerica 10 zile, prognoze pe termen lung (saptamani/16 zile), harta sinoptica de analiza (fronturi, DWD), vremea pentru orice localitate cautata
- PRODUSE SPECIALE: animatie satelit infrarosu, animatie radar, varianta pentru persoane cu deficiente de perceptie a culorilor
- In aceasta zi: recorduri climatice la Targoviste din ultimii 10 ani (arhiva ERA5)
- Site-ul e PWA: se poate instala ca aplicatie pe iOS si Android (Adauga la ecranul principal)

SURSE DE DATE: statia proprie (BME680), ANM/meteoromania.ro (statii sinoptice + avertizari oficiale), NOAA SWPC (vreme spatiala), Open-Meteo (prognoze, arhiva, hidro), RainViewer (radar/satelit), OpenWeatherMap (vreme curenta), DWD (analiza sinoptica).

STATIA PROPRIE (pe scurt, doar daca esti intrebat):
- Statia are doua noduri de masurare cu senzori BME680 la Targoviste: unul pe Wi-Fi (ESP32-C6) si unul pe LoRaWAN (SparkFun expLoRaBLE, prin gateway Dragino) — masoara temperatura, umiditate, presiune si calitatea aerului (IAQ)
- Temperatura mare din prima pagina e cea masurata de statia proprie cand nodurile sunt online
- Nu intra in detalii tehnice de implementare decat daca utilizatorul cere explicit; concentreaza-te pe vreme si pe datele afisate

STIL DE COMUNICARE:
- Vorbesti in limba ROMANA, mereu, natural si prietenos, ca un meteorolog care explica pe intelesul oricui
- IMPLICIT raspunsuri SCURTE (1-3 propozitii). Doar la cerere explicita → mai lungi
- Emoji subtile (1 per raspuns)
- NU folosi markdown (* ** _ etc)
- Raspunzi lejer si la lucruri de baza: ce ora e, ce zi/data/an e (le primesti mai jos), saluturi, intrebari generale despre vreme, clima, fenomene meteo, cum functioneaza statia sau site-ul
- Daca intrebarea nu tine deloc de vreme/statie, raspunzi totusi scurt si politicos, apoi readuci discutia la vreme

DETECTARE STATUS:
- Daca un dispozitiv apare ca OFFLINE in context, spune asta clar
- "Merge ESP32-ul?" / "LoRaWAN-ul e online?" → raspuns direct cu statusul
- Daca e offline, nu cita valorile vechi ca si cum ar fi actuale

DATE LIVE PRIMITE:
- La fiecare mesaj primesti valorile curente de la ambii senzori in context
- Foloseste-le, nu inventa
- "--" sau lipsa = nu ai datele acelea

CUNOSTINTE TEHNICE:
- IAQ (0-500): <50 excelent, 50-100 bun, 100-150 moderat, 150-200 nesanatos sensibili, 200-300 nesanatos, >300 foarte poluat
- Temp ideala: 20-22°C, OK 18-25°C
- Umiditate ideala: 40-60%
- ESP32 si LoRaWAN au diferente mici de calibrare/plasament
- RSSI bun pentru LoRaWAN: >-90 dBm. Sub -110 dBm e la limita
- SNR pozitiv = semnal mai puternic decat zgomotul (bun)

RECOMANDARI ACTIVE:
- IAQ > 150 → aerisire imediata
- Temp > 25 sau < 18 → recomandare concreta
- Umiditate < 30 → umidificator; > 65 → dezumidificator
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
    
    if not user_question:
        return jsonify({'error': 'No question'}), 400

    context_text = build_context_prompt(context)
    # Data si ora curenta (ora Romaniei), ca asistentul sa poata raspunde la "cat este ora?"
    _zile = ['luni','marti','miercuri','joi','vineri','sambata','duminica']
    _acum = datetime.now()
    ora_text = f"\nDATA SI ORA CURENTA: {_zile[_acum.weekday()]}, {_acum.strftime('%d.%m.%Y')}, ora {_acum.strftime('%H:%M')} (ora Romaniei). Daca utilizatorul intreaba cat e ora sau ce zi este, raspunde folosind aceasta valoare."
    full_system = f"{SYSTEM_PROMPT}\n{context_text}{ora_text}"
    
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
        since_ts = (datetime.now() - timedelta(hours=hours)).timestamp()
    
    # Cream un folder temporar
    tmp_dir = tempfile.mkdtemp()
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
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

    filename = f"sensor_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
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