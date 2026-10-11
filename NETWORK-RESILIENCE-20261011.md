# METEO NOW — internet lent, offline și încărcare controlată

Versiune web/server: **2026.10.11.2**, 11 octombrie 2026. APK-ul 1.0.20 rămâne compatibil; nu s-au modificat permisiunile sau sursele native Android.

## Comportament

- Cadran liquid glass sub antet: „Fără conexiune”, pictogramă Wi-Fi tăiat și ultima actualizare în fusul orașului. În timpul reconectării arată un ceas și actualizarea în curs; dispare după succes. RO/EN, text accesibil, fără blocarea paginii.
- Prognoze locale pentru maximum 16 coordonate, disponibile până la 24 de ore. Prospețimea rămâne 5 minute. Datele vechi sunt marcate „salvate”, inclusiv în contextul AI și în prima coloană orară. Nu declanșează sfaturi meteo prezentate drept actuale.
- Pornire offline cu IndexedDB și fișierele interfeței salvate de service worker. Prima instalare trebuie deschisă online cel puțin o dată pentru salvarea fișierelor. Hărțile, avertizările noi, AI-ul și notificările noi necesită internet; nu sunt inventate sau stocate ca răspunsuri private în Cache Storage.
- Pe o conexiune blocată, documentul deja instalat este afișat după 2 secunde în loc să aștepte descărcarea întregului HTML. Înlocuirea din fundal are limită de 10 secunde. Scripturile și stilurile au versiuni explicite și rezervă locală. Fișierele interfeței nu includ răspunsuri API, conversații, abonamente sau date de cont.
- O locație fără prognoză salvată nu primește datele altui oraș. La schimbare nereușită rămâne afișat orașul anterior. La pornire fără date apare un mesaj de recuperare, nu un splash infinit.
- Reîncercările automate sunt reunite pe coordonate și limitate. HTTP 429 respectă Retry-After (10 secunde–15 minute); erorile obișnuite au pauză de 30 secunde. Reconectarea așteaptă închiderea cererilor întrerupte înainte de relansare. Butonul manual poate solicita o reîncercare.
- Preîncărcarea orașelor vecine este oprită offline, în modul economisire date și când browserul raportează 2G sau sub 0,5 Mbps.
- După miezul nopții, zilele expirate sunt eliminate din prognoza salvată în fusul orașului; antetul folosește min/max pentru data corectă. Sincronizarea inițială a widgeturilor așteaptă finalizarea documentului pe conexiuni lente.

## Încărcare și protecție

Stocarea cotelor folosește SQLite WAL, index de expirare și tranzacții serializate în fiecare proces. Inițializarea WAL tolerează cursa dintre procese noi. Rezervările rămân atomice între procese, inclusiv pentru AI; erorile bazei continuă să refuze cererea. Limitele existente nu au fost mărite.

`tests/weather-load-local.py` acceptă numai localhost. Pornește două procese cu aplicația Flask reală, cache pe disc și cote comune, cu furnizori simulați și acces extern blocat. Rulează 200 de cereri/20 simultane, apoi 800/64 simultane pentru trei orașe. Verifică toate răspunsurile, separarea coordonatelor și exact 9 cereri către furnizori în total. O probă ulterioară de 245 de cereri verifică limita globală de 1200/minut: 200 acceptate, 45 refuzate cu HTTP 429 și Retry-After, fără cereri meteo suplimentare.

Acesta este un test local de aplicație și cache, cu server Werkzeug multithread. **Nu stabilește capacitatea Render**, care rulează două procese Gunicorn sincrone, și nu înseamnă 1000 de utilizatori simultan. Nu suprasolicită producția, serviciile meteo sau Firebase.

## Verificări

- 91 de teste Python, inclusiv rezervări atomice cu 64 de fire și două instanțe ale stocării cotelor.
- `tests/weather-network-browser.cjs`: browser mobil, service worker și IndexedDB reale; răspunsuri HTTP transmise în bucăți limitate la 64 și 8 kbps, cu 400 ms latență, plus limitare CDP. Biblioteca Firebase este simulată, iar bibliotecile oficiale cu versiuni fixe sunt oglindite local numai în test.
- Închidere și redeschidere offline cu date vechi de două ore; comutare la un alt oraș salvat; refuzul amestecării unui oraș fără date; reconectare automată; lipsa completă a prognozelor locale; pictogramă și cadran; absența API-urilor din cache-ul interfeței.
- Teste separate: schimbări lente, răspunsuri sosite în altă ordine, pornire GPS, furnizori indisponibili, CSP și injecții HTML, cache pagini/video, probabilități/UV și raportarea privată a erorilor.
- `tests/weather-offline-cache.test.cjs`: retenție, lipsa cererilor offline, Retry-After, deduplicare, timestamp real din server și trecerea zilei în fusul orașului.

Rezultatele măsurate și captura sunt în `03-Testare-si-capturi/tests/artifacts-network`, în afara surselor publicate. Nu s-au efectuat teste pe telefonul fizic în acest pas.

Testele pot fi reluate din directorul surselor cu Node și Python: `node tests/weather-network-browser.cjs`, respectiv `python tests/weather-load-local.py`. Scripturile conțin căile runtime-urilor disponibile pe acest calculator; testul HTTP nu acceptă o adresă externă.
