# Mini capsule redesign — 24 octombrie 2026

Android 1.0.26, versionCode 27; minSdk 23, targetSdk / compileSdk 36.

Fotografia utilizatorului arăta orașul, temperatura și min/max înghesuite în coloana din dreapta. Mini 2×1 are acum un antet pe toată lățimea pentru oraș, un grup central cu iconița și temperatura, și un subsol centrat pentru min/max. Antetul și subsolul au aceeași pondere, păstrând centrul vizual al grupului meteo. Sunt păstrate forma capsulei, paletele, pictograma de localizare, acțiunile și datele meteo. Varianta scundă rămâne neschimbată.

Verificare: APK/AAB reconstruite și semnate cu certificatul existent. Emulator Android API 37: 3180 verificări reușite, șapte dimensiuni, fonturi 1 / 1,3 / 2 și opt teme. Verificări de regresie pentru cei cinci furnizori de widgeturi. Capturi simulate pentru Moreni 9° (180×86 dp) și New York City cu temperaturi negative, zi, noapte și ploaie. Imaginile au fost inspectate vizual. Telefonul fizic S24 Ultra nu a fost testat automat.

Pachetul 1.0.25 este arhivat. APK, AAB, arhiva sursei fără secrete, amprentele SHA256 și raportul VALIDARE-1.0.26.json sunt în builds/current. Interfața web rămâne 2026.10.24.2 / Service Worker v68; nu este necesară o republicare Render. Nu sunt schimbate notificările, locația, furnizorii meteo sau celelalte widgeturi.

Dovezi: 03-Testare-si-capturi/tests/artifacts-capsule-redesign-20261024.
