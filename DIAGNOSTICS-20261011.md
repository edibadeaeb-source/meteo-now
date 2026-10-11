# Raportarea erorilor — 2026-10-11

Versiunea web: `2026.10.11.1`, service worker v45. Android: `1.0.20`, versionCode 21, targetSdk 36.

## Comportament

- Erorile JavaScript neinterceptate, promisiunile respinse, scripturile/video care nu se încarcă și cererile importante eșuate sunt raportate prin `/api/diagnostics`.
- Cererile pentru vreme, AI, ANM, hărți, notificări, arhivă și sincronizarea widgeturilor sunt clasificate după componentă. Răspunsurile HTTP 5xx și 429 sunt raportate; răspunsurile și excepțiile originale rămân disponibile codului existent. Datele meteo incomplete și răspunsurile AI goale au coduri separate.
- Serverul raportează automat răspunsurile 5xx. Widgeturile din APK 1.0.20 raportează eșecurile după încercările de actualizare și erorile din bucla de actualizare. Cache-ul și comportamentul existent rămân păstrate.
- Oprirea intenționată a cererilor și lipsa conexiunii detectată pe telefon nu sunt tratate ca erori de produs. Nu se stochează o coadă de rapoarte pe telefon.

## Confidențialitate și acces

Schema acceptă exclusiv categorii prestabilite, versiunea numerică, platforma generală, codul HTTP și numărul liniei/coloanei dintr-un script cunoscut. Câmpurile suplimentare și valorile arbitrare sunt respinse. Nu se trimit mesajele excepțiilor, stack-uri, URL-uri, corpuri de cerere, orașe, coordonate, conversații AI, chei, identificatori de instalare sau user-agent brut.

Rapoartele apar în jurnalele private Render cu prefixul `METEO_DIAGNOSTIC`. Agregatele private din Firebase sunt la `diagnostics_v1/AAAA-LL-ZZ/main|legacy/<amprentă-tehnică>`, cu metadate, numărul aparițiilor și ultima dată. Amprenta este a tipului de eroare, nu a utilizatorului. Incrementările Firebase sunt atomice între procese. Regulile deja publicate refuză accesul anonim la această ramură; nu este necesară redeschiderea bazei sau o cheie în frontend.

Nu există o listare publică a rapoartelor. Consultarea se face prin consola Firebase autentificată sau prin uneltele private ale serverului; jurnalele pot fi filtrate în Render după prefix. Nu s-au creat e-mailuri, alerte către terți sau automatizări recurente. Rapoartele provenite de la client sunt semnale neverificate, nu dovezi autentificate ale unui incident.

## Limite și disponibilitate

- Browser: aceeași semnătură o dată la 15 minute, cel mult 20 de trimiteri pe oră și sesiune de pagină. Native widget: cel mult o trimitere la 15 minute, fără permisiuni noi.
- Server: 6 cereri de raportare/minut/IP, 30/minut global și 1000/zi pe serviciu, partajate între cei doi workeri prin limita SQLite existentă. Rapoartele serverului au plafon separat de 30/minut și împart plafonul zilnic. Limitele și contoarele locale se resetează la înlocuirea containerului și nu coordonează servicii distincte.
- Fiecare proces are o coadă limitată la 32 de rapoarte și un singur fir de trimitere. Firebase este accesat în fundal, cu timeout; un eșec nu blochează vremea sau AI-ul și nu generează o buclă de raportare. Răspunsul 202 confirmă acceptarea în coadă, nu garantează persistența.
- Agregatele mai vechi de fereastra de 14 date UTC sunt curățate la următoarea raportare, cel mult o încercare pe zi/proces. Dacă serviciul nu mai primește rapoarte, curățarea așteaptă reluarea activității. Retenția jurnalelor platformei este administrată separat de Render.
- Este o raportare tehnică best effort: închiderea procesului poate pierde rapoarte din coadă, iar lipsa internetului nu poate fi raportată imediat. Nu înlocuiește Android Vitals/Crashlytics pentru ANR, crash-uri native complete sau monitorizare externă a indisponibilității totale.

## Verificări și instalare

89 teste Python au trecut, inclusiv 10 teste noi pentru schema strictă, date private, limite, coadă, autentificarea Firebase și izolarea erorilor. Testele JavaScript și browserul mobil verifică păstrarea comportamentului fetch, absența datelor private, deduplicarea, limitele, AI-ul și antetele reale de securitate. Emulatorul confirmă că `diagnostics_v1` este privat.

APK și AAB 1.0.20 au fost construite; semnătura APK a fost verificată. Instalează APK-ul nou peste 1.0.19, fără ștergerea datelor, pentru raportarea nativă a widgeturilor. Partea web și serverul se actualizează automat. Verificarea fizică pe S24 Ultra rămâne de făcut.

Verificarea după publicare este în `03-Testare-si-capturi/tests/verify-diagnostics-live-20261011.py`: trimite câte un raport sintetic `self_test` pe fiecare serviciu, confirmă agregarea prin autentificare privată, verifică refuzul citirii publice și șterge numai înregistrările proprii de test. Rezultatul se salvează în `diagnostics-live-20261011.json`.
