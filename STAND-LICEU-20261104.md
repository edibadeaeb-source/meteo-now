# Stand METEO NOW — 4 noiembrie 2026

Dashboard independent pentru prezentarea de vineri, 6 noiembrie. Sursa este în `stand/`; copia pregătită pentru utilizare este în `METEO-NOW/08-Stand-prezentare`, cu lansator `METEO-NOW/DESCHIDE-STAND.bat`.

Interfață inspirată din cele trei referințe furnizate: antet bleumarin, panouri albe bine delimitate și un panou lateral de monitorizare. Ambele stații ESP32-C6 / SparkFun expLoRaBLE sunt afișate permanent, una lângă alta pe laptop, fără comutare, pe întreaga lățime. Texte și cifre mărite; temperaturile au cinci intervale de culoare și un indicator vizual, iar umiditatea are două cadrane semicirculare 0–100%. Patru grafice SVG cu zone umplute: temperatură, umiditate, presiune și gaz, fiecare cu ambele surse. RSSI/SNR, număr real de înregistrări afișate, contor de stații cu pachete recente, export CSV, explicații interactive, ecran complet. Demo local explicit etichetat funcționează fără internet.

Server separat, numai Python standard library, loopback `127.0.0.1:8765`. Citește doar trei ramuri publice ale stației Firebase prin GET; istoricul este limitat la 60 înregistrări pe sursă, cu cache comun 20 secunde și timeout. Nu necesită chei și nu scrie în Firebase, nu interoghează ramuri private, nu trimite comenzi sau notificări. Fișierele din `stand/` nu sunt publicate de ruta statică a aplicației existente.

Chatbotul din dreapta jos contactează exclusiv `/ask` de pe serviciul principal numai după trimiterea explicită a unei întrebări. Include snapshotul numeric afișat pentru ambele stații, starea real/istoric/demo și cel mult opt mesaje anterioare; conversația nu persistă pe laptop după reîncărcare. Nu transmite chei sau coordonate și nu susține că a verificat independent gateway/ChirpStack/MQTT. Valori IAQ nu sunt inventate pentru LoRa. Limitele AI existente rămân active; proxy-ul local mai impune o cerere simultan, pauză de 10 secunde și maximum 30 de cereri/zi de rulare. Nicio cerere AI automată, inclusiv la deschiderea chatului. Accesul web cross-site este refuzat; intrările și dimensiunile sunt validate. Lansatorul actualizează serverul vechi doar după identificarea procesului propriu.

Nicio modificare în runtime-ul mobil/web, firmware, puntea MQTT, ChirpStack sau regulile Firebase. Serviciul de rezervă rămâne suspendat. Commitul poartă `[skip render]` pentru a evita deploymentul unor fișiere exclusiv locale.

## Verificări efectuate

- 15 teste Python: normalizare, valori zero, timestamp secunde/milisecunde/ISO, valori invalide, istoric limitat/sortat, cache, indisponibilitate și revenire, conservarea valorilor, citire Firebase exclusiv GET, protecția fișierelor private, Host și cereri cross-site. Adăugate validarea contextului AI, lipsa coordonatelor/cheilor, etichetarea demo/istoric, endpoint fix, plafon și refuzul intrărilor invalide.
- Teste în Edge/Playwright la 1920, 1440, 1366, 1024, 768, 412 și 320px: fără depășire orizontală și fără erori JavaScript. Ambele stații și patru grafice sunt disponibile simultan; testate cele cinci intervale de culoare, cadranele la 0%, 100% și lipsă date, contorul de prospețime, etichete de minimum 14px și lățimea completă. Demo offline, export etichetat, oră invalidă, întrerupere/revenire și răspuns întârziat după trecerea la demo. Chat: focus, închidere, istoric/resetare, snapshot, limită, offline și 320px. Răspunsurile AI din browser sunt simulate; nu se consumă cereri reale în regresie.
- Un singur test real către AI-ul existent a reușit: a explicat Wi-Fi/LoRaWAN și a precizat explicit că datele sunt simulate. Nu s-au schimbat modelul, cheile sau bugetul furnizorului.
- Citire reală din Firebase reușită: 60 înregistrări ESP32 și 30 LoRaWAN disponibile; ambele surse sunt vechi și marcate `stale`. Aceasta verifică accesul la istoric, nu transmisia montajului actual.
- Lansatorul PowerShell a pornit serverul local; `/health` a confirmat identitatea, apoi scriptul de oprire l-a închis.
- Dovezi finale: `03-Testare-si-capturi/tests/artifacts-stand-instruments-20261104` — capturi, `browser-results.json` și `verification.json`. Dovezile primei versiuni rămân în `artifacts-stand-20261104`.

## Hartă, QR și cele două teme — completare 4 noiembrie

Adăugate temele albă/închisă cu preferință locală, grafice roșii/verzi/albastre și legende pe fiecare grafic, plus aspectul violet-albastru al chatbotului inspirat din aplicație. Conturul luminos este separat de fundalul static, fără blur dinamic; mișcarea redusă dezactivează animația.

Harta locală vectorială arată implicit ambele marcaje, ESP32-C6 și expLoRaBLE. Click/Enter afișează parametrii aceleiași plăci din snapshotul dashboardului, cu etichete demo/istoric/indisponibil. Include glisare, zoom și resetarea vizualizării. Pozițiile sunt explicit planificate la stand, nu GPS în timp real. Colegiul Național „Constantin Carabella”, str. Locotenent Pârvan Popescu 58, Târgoviște; adresă verificată pe site-ul oficial, campus verificat în obiectul OSM way 295331770. Marcajele sunt decalate vizual la același campus, nu inventează două poziții GPS.

Planul folosește un extras OSM de 800×480m / 569 elemente, cu atribuire vizibilă și datele derivate ODbL incluse. Zero tile-uri descărcate și zero cereri externe pentru hartă. QR SVG/PNG local către `https://meteo-now.onrender.com/`, generat cu corecție Q și margine 4 module, decodat cu zxing-cpp din imaginea generată și din capturi light/dark. Nu indică Play Store și nu instalează automat APK.

Regresia în browser acoperă ambele teme la toate cele șapte dimensiuni, persistența temei, ambele puncte inițial vizibile, parametrii și actualizarea lor, offline hartă/QR, zoom/reset, culorile și toate verificările anterioare. Nicio cerere AI reală suplimentară. Dovezi finale: `artifacts-stand-map-theme-20261104`.

## De verificat cu montajul real

Montajul nu a fost disponibil. Alimentarea, radioul, gateway-ul, ChirpStack, puntea MQTT și scrierile autentificate de pe ESP32 nu sunt validate. Scrierile anonime au fost închise în octombrie; nu le redeschidem și nu instalăm identitatea administrativă a aplicației pe placă. Mâine verificăm mai întâi configurația originală și accesul la server/rețea, apoi pregătim autentificarea adecvată și proba capăt la capăt. Datele simulate nu sunt prezentate ca măsurători reale.
