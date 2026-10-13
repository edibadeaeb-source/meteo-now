# METEO NOW — verificare înainte de Google Play

Actualizat: 13 octombrie 2026. Acesta este punctul de pornire pentru pachetul din `02-Lansare-Google-Play/play-store/release-ready`.

## Pachetul actual

| Componentă | Versiune / fișier |
|---|---|
| Android | 1.0.23, versionCode 24, minSdk 23, targetSdk / compileSdk 36 |
| Application ID | com.onrender.meteo_targoviste.twa |
| Aplicația web / server | 2026.10.13.3, Service Worker v63 |
| Fișier pentru Play Console | builds/current/METEO-NOW-1.0.23-target36.aab |
| Instalare directă pentru test | builds/current/METEO-NOW-1.0.23-target36-test.apk |
| Sursa Android a buildului | builds/current/METEO-NOW-1.0.23-widget-source.zip |
| Verificări originale ale buildului | builds/current/VALIDARE-1.0.23.json |
| Amprente fișiere | builds/current/SHA256-1.0.23.txt |

Raportul original al buildului descrie interfața web de la momentul construirii, 2026.10.12.3. Îl păstrăm ca dovadă istorică. APK-ul deschide interfața web actualizată; ultimele corecții AI, GPS și titluri de notificări nu necesită reconstruirea lui.

## Funcții confirmate în surse

- Cinci variante de widget, inclusiv 2×1 și transparent; oraș configurabil separat și lista orașelor sincronizată criptat.
- O singură programare comună pentru widgeturi, aproximativ la 20 minute. Toți cei cinci furnizori au `updatePeriodMillis=0`; nu mai există fallbackul periodic suplimentar de 30 minute. Android poate amâna lucrul în funcție de conexiune și baterie.
- Locația se actualizează la deschidere / revenire și în timpul utilizării. Cu aplicația închisă, notificările folosesc ultima localitate confirmată și sincronizată. Fără GPS în fundal.
- Istoricul AI este local; întrebarea, contextul recent și vremea afișată sunt trimise pentru răspuns către Anthropic.
- Prognoze locale salvate pentru pornire offline; datele vechi sunt marcate cu ora actualizării.
- Raportare tehnică proprie a erorilor, fără conversații, coordonate sau identificatori în evenimentele de diagnostic. Nu avem integrare Crashlytics.

## Ordinea înainte de publicare

1. Revizuiește `TEXTE-MAGAZIN.md` și `DATA-SAFETY-2026.md`. Formularul Data safety trebuie să includă și diagnosticul, nu răspunsul vechi „fără raportare de erori”.
2. Refă capturile magazinului pe interfața actuală: vreme, orașe, radar/ANM, AI și widgeturi. Cele cinci capturi existente sunt materiale anterioare; nu le declarăm capturi ale versiunii actuale.
3. Încarcă AAB-ul într-un release de test din Play Console. Dacă versionCode 24 a fost deja folosit, trebuie un build cu număr mai mare; nu redenumi fișierul ca soluție.
4. Compară certificatul „App signing key certificate” din Play Console cu `/.well-known/assetlinks.json`. Adaugă amprenta Play dacă diferă, păstrând-o și pe cea locală. Nu presupune că trebuie să fie exact două certificate.
5. Instalează versiunea livrată de Play pe S24 Ultra și verifică lipsa barei Chrome, actualizarea peste instalarea existentă, orașele și widgeturile păstrate.
6. Probează notificările pe telefon: activare, test pe propriul dispozitiv, dezactivare din Android, revenire și o alertă reală cu aplicația închisă. Testele locale de Service Worker nu confirmă livrarea remote sau trezirea telefonului.
7. Probează locația după deplasare și revenire, pornirea offline, reconectarea, AI și widgeturile cu telefonul în repaus. Nu șterge datele pentru testul de actualizare.
8. Verifică cerințele afișate contului tău în Play Console și raportul de pre-lansare. Utilizatorul declară un cont din 2013; nu presupunem automat obligațiile pentru un cont personal nou.

## Ce rămâne neconfirmat

Nu a fost încărcat un release Play în această verificare. Certificatul de semnare folosit de Play, capturile noi, livrarea push pe S24 în repaus și consumul real de baterie necesită verificare separată. Nu certificăm toate mărcile de telefoane prin testele de calculator.

Nu reconstruim APK/AAB pentru această actualizare a documentelor și nu schimbăm interfața aplicației.
