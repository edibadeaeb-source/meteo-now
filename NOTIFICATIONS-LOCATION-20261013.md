# METEO NOW — verificare notificări și revenire GPS

Versiune web/server **2026.10.13.1**, Service Worker **v61**. Interfața AI și sursele Android sunt păstrate.

## Alegerea pentru prima lansare

Utilizatorul a ales actualizarea localității la deschidere și revenire. Notificările cu aplicația închisă folosesc ultima locație GPS confirmată și sincronizată. Nu adăugăm urmărire GPS în fundal, permisiuni sau APK nou. Această limită este deja explicată în Setări și în politica RO/EN. Manifestul nativ nu declară permisiuni de localizare, iar componenta web care primește push nu oferă geolocalizare.

## Probleme reproduse și corecții

- Un apel simultan de focus/visibility revenea înaintea poziției GPS aflate în curs; continuarea putea sincroniza orașul vechi. Apelurile așteaptă acum aceeași operație GPS.
- Verificarea permisiunii pentru notificări putea salva independent abonamentul înaintea noii poziții. Salvarea așteaptă actualizarea GPS și verifică din nou dacă notificările au fost oprite în timpul așteptării. Sincronizarea push are loc după încheierea operației GPS, pentru a evita o așteptare circulară.
- Ascunderea aplicației invalidează rezultatele GPS/geocodării întârziate și elimină pauza normală de focus pentru următoarea revenire. Dacă o cerere veche este încă activă, apelurile de revenire împart o singură reverificare nouă după încheierea ei.
- Revenirea restabilește urmărirea automată și dacă orașul consultat manual coincide deja cu localitatea GPS, fără reîncărcarea inutilă a vremii.

## Validare

- `tests/location-resume.test.cjs`: așteptare GPS comună, anularea rezultatului din sesiunea ascunsă și o singură verificare nouă, urmărire restabilită în același oraș, fără GPS/mutarea orașului cu pagina ascunsă sau permisiunea retrasă. Prima regresie a eșuat pe versiunea anterioară.
- `tests/notification-flows.test.js`: salvarea abonamentului așteaptă GPS; oprirea în timpul așteptării este respectată; fără suprascriere după alegere manuală; recuperare și reîncercări după erori; fără dublarea abonării; sintaxa tuturor scripturilor. Regresia salvării orașului vechi a eșuat înaintea corecției.
- `tests/notification-location-browser.cjs`: Geolocation API și Service Worker reale, furnizori/abonament simulați local. Mutare Târgoviște/București, consultare New York fără mutarea alertelor GPS, internet oprit/revenit, eroare 503 și recuperare, notificări oprite păstrate, GPS lent peste ascundere/revenire, focus simultan și fără erori JavaScript.
- Aceeași probă închide toate ferestrele aplicației și injectează prin protocolul browserului un `PushEvent` către Service Worker-ul real. Notificarea afișată este verificată prin `getNotifications()` (titlu, text, tag, URL) și închisă. Aceasta verifică procesarea locală în lipsa ferestrei aplicației; nu trimite către un abonat real și nu verifică trezirea prin FCM sau afișarea pe S24.
- 26 teste backend de prospețime și livrare au trecut înaintea modificărilor de frontend. Backendul de notificări nu este schimbat. Coordonatele și mesajele din probe sunt date de test.

Rezultatele sunt în `03-Testare-si-capturi/tests/artifacts-notification-location`. Nu a fost conectat un telefon fizic; livrarea reală pe S24 și programarea efectivă a joburilor de producție nu sunt confirmate de aceste probe. Interogarea jurnalelor HTTP Render nu a furnizat date pentru a confirma programarea; nu interpretăm lipsa datelor drept funcționare sau defect.

Pentru proba finală pe telefon: activați „Urmărește locația mea”, schimbați localitatea în utilizarea normală, apoi închideți și redeschideți aplicația și verificați orașul și vremea. Cu notificările oprite, revenirea trebuie să le păstreze oprite. Testul din Setări verifică numai abonamentul dispozitivului folosit.

Referință Android: https://developer.android.com/develop/sensors-and-location/location/permissions/background
