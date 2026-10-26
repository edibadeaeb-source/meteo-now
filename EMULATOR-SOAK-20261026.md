# Test Android continuu — 26 octombrie 2026

La cererea utilizatorului: rulare de 120 minute în emulatorul propriu Pixel_10, serial emulator-5556, Android API 37. APK semnat existent 1.0.27 / versionCode 28, aplicația web publicată 2026.10.25.3, cu date meteo reale. Aplicația nu este modificată sau republicată pentru test.

Runner: `tests/emulator-soak.cjs`; lansare Windows: `tests/run-emulator-soak.ps1 -Minutes 120`. Procesul face o cerere temporară Windows pentru prevenirea repausului automat, fără modificarea planului de energie. Ecranul poate fi stins. Oprirea manuală a calculatorului sau închiderea forțată a proceselor poate întrerupe testul.

Scenarii la aproximativ trei minute: orașe salvate România / New York, setări, panoul AI fără întrebare, radar extins, revenire la derulare. Periodic: offline/reconectare prin motorul Chrome, fundal/revenire, reîncărcare și validarea sintetică a widgeturilor. Se înregistrează ciclurile, erorile JavaScript, cererile eșuate, memoria JS/Android și capturi de început/final sau la eșec. Nu este un test de încărcare a serverului.

Cereri AI și de abonare/test push blocate explicit de automatizare pentru a preveni costuri și notificări reale. Din acest motiv, evenimentele `request-failed` cu motivul `inspector` pe `/api/push/subscribe` sunt așteptate, nu defecte ale aplicației. `net::ERR_ABORTED` se analizează în contextul navigării și al fazei offline. Contorul networkFailures este brut și nu certifică de unul singur o defecțiune.

Proba inițială a identificat incompatibilitatea API-ului Playwright tap cu un context Android atașat prin CDP; s-a trecut la atingeri CDP reale. Proba corectată: patru cicluri trecute, zero eșecuri și zero erori JavaScript. Separat, instrumentarea Android a trecut 3420 verificări de widgeturi cu date simulate. Acestea sunt verificări ale instrumentului și ale scenariilor, nu rezultatul rulării de două ore.

Raportul efectiv: `03-Testare-si-capturi/tests/artifacts-emulator-soak-20261026/run/status.json`, plus events.jsonl și capturi. Pornire: 2026-10-26 15:51:35 UTC; finalizare estimată: 17:51:35 UTC, aproximativ 19:51 în București. Starea finală trebuie citită din raport; nu este presupusă reușita. Urmărire în acest chat prin automatizarea `rezultat-test-emulator-meteo-now-2-ore`, care trebuie dezactivată după rezultatul final.

Limite: fără consum real de baterie, fără firmware Samsung/Xiaomi/Oppo, fără livrare push reală și fără verificarea răspunsurilor AI. Testele widgeturilor folosesc date sintetice și nu certifică actualizarea reală a widgeturilor în launcher. Emulatorul nu înlocuiește testerii ceruți de Google Play. Nu se accesează telefonul fizic al utilizatorului.

Oprire: creează fișierul STOP în directorul run. La încheiere, runnerul restaurează setările emulatorului observate înainte de test (1080×1920, densitate 320, stay-on 1), închide numai emulator-5556 și procesul Windows eliberează cererea de prevenire a repausului. Verifică `emulatorStopped` / cleanupError înainte de a declara curățarea confirmată.
