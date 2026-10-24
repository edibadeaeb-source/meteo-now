# Mini capsule refinement — 24 octombrie 2026

Android 1.0.27, versionCode 28; minSdk 23, targetSdk / compileSdk 36.

Pictograma meteo are puțin mai mult spațiu în înălțime, iar temperatura este centrată orizontal pe întregul cadran. Cele două margini laterale au ponderi egale; temperatura ocupă coloana centrală fără suprapunere peste pictogramă. Antetul cu orașul și subsolul cu min/max rămân centrate, pe toată lățimea. Sunt păstrate forma capsulei, culorile, datele și acțiunile. Varianta scundă și celelalte widgeturi nu sunt schimbate.

Verificări și capturi simulate: artifacts-capsule-refinement-20261024, inclusiv Moreni 9° și New York City cu temperatură negativă. Matricea Android acoperă șapte dimensiuni, trei scale de font și opt teme, plus regresii pentru cei cinci furnizori. Raportul android-results.json înregistrează rezultatul real. APK/AAB sunt verificate cu certificatul existent. Nu s-a efectuat testare automată pe telefonul fizic.

Buildul 1.0.26 este păstrat în arhivă; noul pachet și sursa fără secrete sunt în builds/current. Web: 2026.10.24.2 / Service Worker v68, fără modificări și fără republicare Render.
