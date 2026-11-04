# Stand METEO NOW — 4 noiembrie 2026

Dashboard independent pentru prezentarea de vineri, 6 noiembrie. Sursa este în `stand/`; copia pregătită pentru utilizare este în `METEO-NOW/08-Stand-prezentare`, cu lansator `METEO-NOW/DESCHIDE-STAND.bat`.

Interfață deschisă, crem/alb cu verde și albastru: ambele stații ESP32-C6 / SparkFun expLoRaBLE sunt afișate permanent, una lângă alta pe laptop, fără comutare. Texte și cifre mărite; temperaturile au cinci intervale de culoare, iar celelalte măsurători au accente distincte. Patru grafice SVG responsive afișate simultan: temperatură, umiditate, presiune și gaz, fiecare cu ambele surse. RSSI/SNR disponibile, export CSV, explicații interactive, ecran complet. Demo local explicit etichetat, cu reglaje pentru temperatură și umiditate, funcționează fără internet.

Server separat, numai Python standard library, loopback `127.0.0.1:8765`. Citește doar trei ramuri publice ale stației Firebase prin GET; istoricul este limitat la 60 înregistrări pe sursă, cu cache comun 20 secunde și timeout. Nu necesită chei. Nu scrie în Firebase, nu interoghează ramuri private, nu trimite comenzi, notificări sau cereri AI și nu contactează serviciile Render. Linkul spre aplicația mobilă se deschide doar la apăsare. Fișierele din `stand/` nu sunt publicate de ruta statică a aplicației existente.

Nicio modificare în runtime-ul mobil/web, firmware, puntea MQTT, ChirpStack sau regulile Firebase. Serviciul de rezervă rămâne suspendat. Commitul poartă `[skip render]` pentru a evita deploymentul unor fișiere exclusiv locale.

## Verificări efectuate

- 10 teste Python: normalizare, valori zero, timestamp secunde/milisecunde/ISO, valori invalide, istoric limitat/sortat, cache, indisponibilitate și revenire, conservarea valorilor, acces strict numai GET, protecția fișierelor private, Host și cereri cross-site.
- Teste în Edge/Playwright la 1920, 1440, 1366, 1024, 768, 412 și 320px: fără depășire orizontală și fără erori JavaScript. Ambele stații și patru grafice sunt disponibile simultan; testate cele cinci intervale de culoare a temperaturii și etichetele măsurătorilor de minimum 14px. Demo offline, export etichetat, oră invalidă, întrerupere/revenire și răspuns întârziat după trecerea la demo. Ecran complet și mișcare redusă verificate. Nu sunt încărcate resurse externe.
- Citire reală din Firebase reușită: 60 înregistrări ESP32 și 30 LoRaWAN disponibile; ambele surse sunt vechi și marcate `stale`. Aceasta verifică accesul la istoric, nu transmisia montajului actual.
- Lansatorul PowerShell a pornit serverul local; `/health` a confirmat identitatea, apoi scriptul de oprire l-a închis.
- Dovezi: `03-Testare-si-capturi/tests/artifacts-stand-20261104` — capturi, `browser-results.json` și `verification.json`.

## De verificat cu montajul real

Montajul nu a fost disponibil. Alimentarea, radioul, gateway-ul, ChirpStack, puntea MQTT și scrierile autentificate de pe ESP32 nu sunt validate. Scrierile anonime au fost închise în octombrie; nu le redeschidem și nu instalăm identitatea administrativă a aplicației pe placă. Mâine verificăm mai întâi configurația originală și accesul la server/rețea, apoi pregătim autentificarea adecvată și proba capăt la capăt. Datele simulate nu sunt prezentate ca măsurători reale.
