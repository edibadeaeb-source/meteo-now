# METEO NOW — activitate, trafic și widgeturi

Web/server **2026.10.12.1**, Service Worker **v50**. Android **1.0.23 / versionCode 24**, targetSdk 36.

## Probleme corectate

- Protecția temporizărilor era instalată după înregistrarea mai multor actualizări. Acestea puteau continua să execute cod și cereri când pagina era ascunsă. Toate temporizările proprii trec acum printr-un ajutor definit în primul script. Sunt oprite callbackurile ascunse, inclusiv ceasul și animațiile hărților. Setarea actualizării automate este respectată la intervalele de cel puțin 10 secunde; temporizările bibliotecilor nu mai sunt modificate global.
- Temperatura stației avea două actualizări periodice suprapuse, la 15 și 20 secunde. Rămâne cea la 15 secunde.
- După schimbarea filmării, ambele elemente video păstrau o sursă. După pornirea noii filmări, sursa și ascultătorii celei vechi sunt eliminați, permițând browserului să elibereze resursele. Filmarea curentă rămâne în pauză când pagina este ascunsă și poate continua imediat la revenire. Trecerea la o fotografie eliberează ambele surse și anulează filmările în curs de încărcare.
- Curățarea precipitațiilor folosește întregul bitmap în coordonate fizice, independent de transformarea contextului canvas. Proba de browser include opriri/porniri repetate și resetarea transformării la DPR fracționar, astfel încât ploaia să nu rămână desenată după oprire.
- Patru widgeturi aveau `updatePeriodMillis=1800000`, pe lângă WorkManager-ul comun la 20 minute. Acum toate cele cinci au această programare Android suplimentară dezactivată. Actualizarea la configurare, pornirea dispozitivului și actualizarea aplicației rămân disponibile.

## Măsurare comparativă

Test izolat în Edge, ecran mobil 412×915, DPR 2. Prognozele și Firebase sunt simulate; fișierele video, decodarea, Service Worker și IndexedDB sunt reale. Sunt folosite aceeași secvență de scene și două orașe salvate.

| Verificare | Înainte | După |
|---|---:|---:|
| Cereri HTTP către API la o executare controlată a tuturor callbackurilor periodice, cu pagina ascunsă | 1 | 0 |
| Elemente video care păstrează `src`, după schimbarea filmării | 2 | 1 |
| Date video suplimentare la revenirea la două filmări deja memorate | 0 bytes | 0 bytes |
| Date video suplimentare la revenirea din fundal | 0 bytes | 0 bytes |

Proba temporizărilor invocă determinist fiecare callback înregistrat o dată; **nu reprezintă 30 de minute reale cu telefonul blocat**. Temporizările native există în continuare, însă callbackurile aplicației nu execută lucru cât pagina este ascunsă. Cererile deja începute nu sunt anulate prin această schimbare.

În proba pentru senin noaptea, filmarea de 1440×2560 are 4.346.219 bytes, iar varianta pentru economisirea datelor, de 720×1280, are 718.507 bytes. Alegerea variantei mici exista deja și a fost reverificată. Nu descărcăm întreaga bibliotecă de filmări. Memoria persistentă a filmărilor are deja bugetul de 96 MiB, verificat de testul cache-ului; resursele pot fi descărcate din nou după evacuare sau ștergerea datelor.

Rezultatele brute sunt păstrate în `03-Testare-si-capturi/tests/artifacts-performance/before.json` și `after.json`. Numărul de cadre pierdute în Edge headless variază cu încărcarea calculatorului; nu îl folosim ca procent de îmbunătățire a fluidității sau ca estimare de autonomie.

## Widgeturi

Inspecția codului confirmă un singur job periodic comun, condiționat de conexiune, anulat după eliminarea ultimului widget. Actualizarea grupează widgeturile pentru aceeași localitate și face o singură cerere pe grup la fiecare trecere; o eroare poate determina o reîncercare. Configurarea manuală și alte evenimente de sistem pot provoca actualizări suplimentare, deci nu promitem un număr fix de cereri pe zi.

Cele 20 de minute sunt o programare aproximativă. Android poate amâna execuția în Doze, la economisirea bateriei sau până la îndeplinirea condițiilor. Acesta este comportamentul documentat pentru [PeriodicWorkRequest](https://developer.android.com/reference/androidx/work/PeriodicWorkRequest).

## Verificare și limite

Testele serverului, temporizărilor, cache-urilor, notificărilor, coordonatelor, iconițelor și variantelor meteo sunt executate fără trimiterea de notificări reale. Testele de browser verifică și pornirea offline, internetul limitat la 64/8 kbps, recuperarea automată, scenele video și suspendarea animației. Testul Android verifică metadatele tuturor celor cinci furnizori, randarea pe dimensiuni și scale de font diferite, orașele și iconițele existente. Rezultatele finale sunt în fișierul de validare al buildului.

Nu am măsurat mAh sau procentul de baterie pe S24 Ultra și nu am validat livrarea push cu telefonul în repaus în această sesiune. Testul de calculator nu certifică 120 Hz pe dispozitiv.

## Probă recomandată pe S24 Ultra

1. Instalează APK-ul 1.0.23 peste versiunea curentă, fără ștergerea datelor. Redeschide aplicația cu internet pentru actualizarea interfeței web.
2. Verifică derularea, schimbarea orașelor, revenirea după blocarea ecranului și cele cinci widgeturi deja configurate.
3. Compară două perioade de câteva ore, în condiții apropiate de semnal și utilizare: un widget, apoi mai multe pentru același oraș. Notează consumul aplicației și al Chrome, traficul de date și ora ultimei actualizări a widgeturilor.
4. Repetă cu widgeturi pentru orașe diferite; aici sunt firești cereri separate. Verifică păstrarea datelor fără internet și revenirea automată după reconectare.
5. Pentru o comparație utilă, păstrează aceleași setări de ecran, locație, notificări și economisire a bateriei. Nu șterge istoricul de baterie și nu reseta aplicația doar pentru această probă.
