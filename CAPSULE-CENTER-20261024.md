# Text centrat în Mini 2×1 — 24 octombrie 2026

Android 1.0.25 / versionCode 26 / targetSdk 36. Interfața web rămâne 2026.10.24.2; nu este necesară o modificare a serviciilor web.

În ambele variante de înălțime ale widgetului Mini 2×1, orașul și pictograma de localizare sunt sus, temperatura este centrată în coloana de text, iar min/max sunt jos când înălțimea permite acel rând. În varianta normală, spațiul vertical este distribuit simetric 1:2:1, astfel încât rândul temperaturii să fie exact la mijloc. Alinierea orizontală a temperaturii și min/max este pe centru; orașul are lățimea conținutului și întregul grup text/pin este centrat.

Textul se adaptează în continuare la dimensiune și la fontul Android. Forma mai scundă, cele opt palete, pictogramele WMO, orașul configurat, actualizările și acțiunea de deschidere a orașului sunt păstrate. Celelalte patru widgeturi nu sunt modificate.

Verificare pe emulator Android API 37 cu date simulate: **3.276 aserțiuni**, inclusiv șapte dimensiuni, trei scale de font (1×, 1,3×, 2×), opt teme, nume lung, temperatură negativă, centrare, ordine și încadrare verticală. S-au păstrat verificările celor cinci furnizori de widgeturi și ale stărilor meteo. Previziualizarea este o dovadă de test, nu o captură de pe S24 Ultra. APK și AAB sunt semnate cu certificatul existent; este necesară instalarea APK-ului nou peste cel existent, fără dezinstalare.

Dovezi: `03-Testare-si-capturi/tests/artifacts-capsule-center-20261024`. Buildul 1.0.24 și validarea sa rămân în `builds/archive/1.0.24`; fișierele curente sunt în `builds/current`. Nu sunt trimise notificări sau cereri AI plătite în aceste verificări.
