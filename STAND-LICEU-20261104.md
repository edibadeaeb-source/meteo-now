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

## Hartă standard Leaflet — versiunea locală 4

Înlocuit controlul SVG cu Leaflet 1.9.4 și harta standard OpenStreetMap, cu zoom, glisare, ferestre pe hartă și ambele carduri de placă vizibile implicit. Ambele markere păstrează aceeași coordonată configurată a campusului și au ancore în pixeli diferite; nu se inventează două coordonate măsurate. Interfața folosește „Localizarea stațiilor” și „Coordonate GPS ale locației”; nu pretinde receptoare GPS sau urmărire a plăcilor. Contextul AI cunoaște locația evenimentului și distinge configurația hărții de telemetria GPS.

Tile-urile se cer direct furnizorului, numai pentru harta vizibilă, cu atribuire, referer și cache normal de browser. Planul local rămâne sub hartă pentru lipsa conexiunii. Biblioteca/CSS și licența sunt locale; CSP permite doar hostul de imagini al furnizorului. Nu există proxy, arhivare sau preîncărcări de tile-uri.

Regresia în browser a trecut cu tile-uri simulate: 37 cereri interceptate, zero descărcări reale de tile-uri, zero erori JS și zero cereri externe neașteptate. Verificarea separată HEAD a furnizorului: 200, image/png, fără corp de imagine descărcat. Capturile din `artifacts-stand-leaflet-20261104` arată planul de rezervă; nu sunt capturi de basemap online. Testele nu certifică rețeaua de la liceu. Nicio cerere AI reală nouă.

## Context AI — versiunea locală 5

AI-ul prezintă numele colegiului și adresa atunci când este întrebat unde este standul; elimină explicațiile nesolicitate despre configurarea poziției. Informațiile de proveniență rămân corecte pentru întrebări explicite despre GPS. Modul real este descris prin fluxul celor două noduri ESP32-C6/Wi-Fi și SparkFun expLoRaBLE/LoRaWAN către Firebase. Cititorul, ramurile de date și firmware-ul nu sunt schimbate, iar demo-ul rămâne explicit etichetat.

Au trecut cele 15 teste Python. Un singur test AI real, cu snapshotul citit din Firebase, a returnat colegiul/adresa și fluxul celor două noduri fără explicația nesolicitată despre coordonate. Datele vechi au fost recunoscute drept istoric, nu valori actuale. Lansatorul detectează și repornește versiunea anterioară locală pentru încărcarea promptului nou.

## Valorile punctelor din grafice

Adăugate casete de detalii pentru toate cele patru grafice, la mouse, atingere și tastatură. Selectarea caută cel mai apropiat punct în limita unei raze de 32px (44px la atingere), fără interpolarea valorilor. Caseta arată valoarea cu unitatea, nodul, timestampul eșantionului și proveniența real/istoric/demo. Punctul selectat este evidențiat. Caseta rămâne în interiorul graficului, se închide la ieșire/tap exterior/Escape și se șterge la redesenare pentru a nu păstra detalii vechi. Interacțiunea tactilă păstrează `pan-y` și nu modifică blocarea scrollului paginii.

Test dedicat `stand/tooltips-test.cjs`: toate mărimile/unitățile, nodul și timestampul exact, zero, navigare tastatură, temele light/dark la 1920/1366/768/412/320px, istoric și lipsă date, tap și scroll vertical în emulare tactilă. Zero erori JavaScript, zero cereri AI reale și zero descărcări reale de tile-uri. Dovezi: `artifacts-stand-tooltips-20261104`. Nu s-a efectuat test fizic pe S24 Ultra în acest pas. Nu sunt necesare modificări ale serverului sau APK nou; reîmprospătarea paginii încarcă fișierele locale actualizate.

## De verificat cu montajul real

Montajul nu a fost disponibil. Alimentarea, radioul, gateway-ul, ChirpStack, puntea MQTT și scrierile autentificate de pe ESP32 nu sunt validate. Scrierile anonime au fost închise în octombrie; nu le redeschidem și nu instalăm identitatea administrativă a aplicației pe placă. Mâine verificăm mai întâi configurația originală și accesul la server/rețea, apoi pregătim autentificarea adecvată și proba capăt la capăt. Datele simulate nu sunt prezentate ca măsurători reale.

## 5 noiembrie 2026 · Arhivă și date live

Standul pornește cu datele celor două noduri. Cele patru grafice combină câte 30 de măsurători istorice distincte din 16 iulie 2026 pentru fiecare nod și până la 30 de măsurători recente. În Firebase nu apar măsurători din perioada căutată, în jurul datei de 22 octombrie. Data de sesiune și data fiecărui punct sunt afișate separat. Modul cu date simulate a fost eliminat. Antetul indică Colegiul Național „Constantin Carabella”, Târgoviște.
