# METEO NOW — verificare înainte de Google Play

Actualizat: 25 octombrie 2026. Acesta este punctul de pornire pentru pachetul din `02-Lansare-Google-Play/play-store/release-ready`.

## Pachetul actual

| Componentă | Versiune / fișier |
|---|---|
| Android | 1.0.27, versionCode 28, minSdk 23, targetSdk / compileSdk 36 |
| Application ID | com.onrender.meteo_targoviste.twa |
| Aplicația web / server | 2026.10.25.3, Service Worker v71 |
| Fișier pentru Play Console | builds/current/METEO-NOW-1.0.27-target36.aab |
| Instalare directă pentru test | builds/current/METEO-NOW-1.0.27-target36-test.apk |
| Sursa Android a buildului | builds/current/METEO-NOW-1.0.27-widget-source.zip |
| Verificări originale ale buildului | builds/current/VALIDARE-1.0.27.json |
| Amprente fișiere | builds/current/SHA256-1.0.27.txt |

Buildul 1.0.27 include pictograma meteo mărită și temperatura centrată pe toată lățimea cadranului Mini 2×1. Validarea proprie este în VALIDARE-1.0.27.json. Buildul Android a fost validat inițial cu interfața web 2026.10.24.2. Buildurile și rapoartele anterioare sunt păstrate în builds/archive, inclusiv 1.0.26. Instalează noul APK peste cel existent, fără dezinstalare.

Actualizarea web 2026.10.25.2 compactează notificările din aplicație și rafinează aspectul liquid glass, păstrând animația, textul complet și butonul de închidere. Android rămâne 1.0.27 / versionCode 28; nu este necesar un APK nou. Rapoartele originale ale buildului rămân nemodificate.

Actualizarea 2026.10.25.2 simplifică pagina principală și secțiunea Despre, elimină cardul stațiilor proprii, reorganizează confidențialitatea și creditele în secțiuni pliabile fără imagini încorporate și înlocuiește emoji-urile de ceață/ninsoare din notificările viitoare. Nu schimbă datele meteo, permisiunile sau colectarea datelor.

Actualizarea 2026.10.25.3 lasă pe pagina principală doar numele furnizorilor meteo, jos: OpenWeather · MET Norway · Open-Meteo. Setări → Despre conține un singur buton Confidențialitate; pagina reunește politica, sursele și toate creditele în secțiuni pliabile, fără media încorporate. Android rămâne 1.0.27 / versionCode 28.

## Funcții confirmate în surse

- Cinci variante de widget, inclusiv 2×1 și transparent; oraș configurabil separat și lista orașelor sincronizată criptat.
- O singură programare comună pentru widgeturi, aproximativ la 20 minute. Toți cei cinci furnizori au `updatePeriodMillis=0`; nu mai există fallbackul periodic suplimentar de 30 minute. Android poate amâna lucrul în funcție de conexiune și baterie.
- Locația se actualizează la deschidere / revenire și în timpul utilizării. Cu aplicația închisă, notificările folosesc ultima localitate confirmată și sincronizată. Fără GPS în fundal.
- Istoricul AI este local; întrebarea, contextul recent și vremea afișată sunt trimise pentru răspuns către Anthropic.
- Răspuns AI: maximum 120 cuvinte și 2.000 caractere, impus pe server; generare limitată la 600 tokenuri, fără continuare automată plătită.
- Prognoze locale salvate pentru pornire offline; datele vechi sunt marcate cu ora actualizării.
- Raportare tehnică proprie a erorilor, fără conversații, coordonate sau identificatori în evenimentele de diagnostic. Nu avem integrare Crashlytics.

## Ordinea înainte de publicare

1. Revizuiește `TEXTE-MAGAZIN.md` și `DATA-SAFETY-2026.md`. Formularul Data safety trebuie să includă și diagnosticul, nu răspunsul vechi „fără raportare de erori”.
2. Utilizatorul a ales să refacă personal capturile pe S24 Ultra; selecția finală pentru magazin așteaptă imaginile lui. Capturile emulatorului din `screenshots/2026-10-13/` și cele vechi direct din `screenshots/` sunt păstrate ca exemple și materiale anterioare, fără a fi înlocuite sau declarate selecția finală.
3. Încarcă AAB-ul într-un release de test din Play Console. Dacă versionCode 28 a fost deja folosit, trebuie un build cu număr mai mare; nu redenumi fișierul ca soluție.
4. Compară certificatul „App signing key certificate” din Play Console cu `/.well-known/assetlinks.json`. Adaugă amprenta Play dacă diferă, păstrând-o și pe cea locală. Nu presupune că trebuie să fie exact două certificate.
5. Instalează versiunea livrată de Play pe S24 Ultra și verifică lipsa barei Chrome, actualizarea peste instalarea existentă, orașele și widgeturile păstrate.
6. Probează notificările pe telefon: activare, test pe propriul dispozitiv, dezactivare din Android, revenire și o alertă reală cu aplicația închisă. Testele locale de Service Worker nu confirmă livrarea remote sau trezirea telefonului.
7. Probează locația după deplasare și revenire, pornirea offline, reconectarea, AI și widgeturile cu telefonul în repaus. Nu șterge datele pentru testul de actualizare.
8. Verifică cerințele afișate contului tău în Play Console și raportul de pre-lansare. Utilizatorul a confirmat că nu are încă un cont de dezvoltator Play Console; vechimea contului Google nu îl transformă într-un cont de dezvoltator vechi. Pentru un cont personal creat acum, Google cere în prezent test închis cu minimum 12 testeri înscriși continuu 14 zile înaintea cererii de acces la producție. Testul intern inițial nu înlocuiește acest test închis. [Cerințe oficiale](https://support.google.com/googleplay/android-developer/answer/14151465), consultate la 13 octombrie 2026.

## Ce rămâne neconfirmat

Nu există încă un cont de dezvoltator Play Console și nu a fost încărcat un release Play în această verificare. Certificatul de semnare folosit de Play, livrarea push pe S24 în repaus și consumul real de baterie necesită verificare separată. Nu certificăm toate mărcile de telefoane prin testele de calculator. Continuarea după înregistrarea contului este descrisă în `TEST-INTERN-PLAY.md`.

Versiunea 1.0.27 reconstruiește APK/AAB pentru alinierea widgetului Mini 2×1. Interfața web rămâne neschimbată.
