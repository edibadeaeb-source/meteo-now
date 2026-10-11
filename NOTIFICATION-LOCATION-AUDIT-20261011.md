# Locație și notificări — 11 octombrie 2026

Versiune web/server: **2026.10.11.5**, Service Worker v49. APK nativ neschimbat: **1.0.22 / versionCode 23**. Nu este necesară reinstalarea pentru aceste corecții.

## Corecții

- Verificarea automată cere o poziție GPS proaspătă, cu `enableHighAccuracy:false`, la deschidere/revenire și la intervalul existent de două minute în prim-plan. Nu folosește poziția de până la 30 de secunde memorată de browser. După o eroare se permite imediat reîncercarea la reconectare.
- Numele localității confirmate este refolosit pentru deplasări sub 100 m; nu apelăm geocodarea pentru fiecare verificare când telefonul rămâne în același loc.
- O alegere manuală anulează cererea GPS anterioară chiar la apăsare, înainte de încărcarea prognozei. Consultarea altui oraș păstrează localitatea GPS pentru notificări. Reconectarea nu întrerupe consultarea manuală; revenirea în aplicație verifică localitatea actuală.
- Sincronizarea notificărilor se reia după reconectare și după erori temporare, cu cel mult trei reîncercări la 15/60/180 secunde. Nu face reîncercări cât pagina este ascunsă și nu reactivează notificările dezactivate de utilizator.
- Nu trimitem noi alerte meteo sau rezumate din rezerva `stale`, fără proveniență temporală validă, din date descărcate cu peste 30 minute în urmă ori cu o stare curentă mai veche de 90 minute. Datele salvate rămân disponibile în aplicație; nu sunt prezentate în alerte ca și cum ar fi noi.
- Evenimentele se raportează la ora stării cerului, dacă este disponibilă, separat de ora unei observații mai vechi de temperatură.
- Orele cu offset explicit (de exemplu `+03:00` sau `-04:00`) și orele fără offset sunt convertite în fusul localității înainte de comparare. Verificarea cu date reale a reprodus și corectat eroarea Python de comparare a celor două formate, care putea opri alertele pe prognozele furnizorului de rezervă.
- Un rezumat cu ploaie/ninsoare/polei nu se încheie cu sfatul generic „Zi liniștită” când probabilitatea numerică lipsește; sfatul ține cont și de codul meteo.
- Rezumatul alege azi/mâine din datele calendaristice ale orașului, inclusiv la furnizorii care nu includ ieri. O temperatură lipsă sau nevalidă nu produce un rezumat incomplet.
- O citire nereușită a istoricului Firebase nu este echivalentă cu un istoric gol. Se amână notificările meteo, ANM și rezumatele afectate. Deduplicarea pe localitate include și regiunea, fără retrimitere doar pentru mici schimbări GPS în același oraș.

## Validare

Teste Python pentru server și pragurile temporale; teste JavaScript pentru permisiuni, ultima locație, anularea GPS, serializarea abonamentelor, reconectare și reîncercare. Testul de browser folosește Edge la 412×915, API GPS și Service Worker reale, cu prognoze și abonamente simulate pe server local. Nu trimite notificări reale și nu accesează Firebase real.

Scenarii de browser trecute: deplasare între localități, geocodare refolosită când staționar, consultare manuală cu alerte GPS, reconectare, recuperare după HTTP 503, notificări dezactivate păstrate și revenire la orașul GPS. Fără erori JavaScript.

## Limite și verificare pe S24 Ultra

Permisiunea „în timpul utilizării” permite GPS când aplicația este deschisă. Când este închisă, notificările folosesc **ultima localitate GPS sincronizată**, fără urmărire permanentă. Această actualizare nu introduce permisiuni native sau localizare în fundal. Detectarea unei deplasări cu aplicația complet închisă necesită o implementare nativă separată și acord dedicat pentru locație în fundal.

Livrarea reală pe un telefon în repaus depinde de jobul extern, conexiune și restricțiile Android. Acceptarea push nu confirmă afișarea. Nu am validat în această sesiune livrarea reală în repaus sau deplasarea fizică pe S24 Ultra. Nu am modificat programarea joburilor externe.

1. În aplicația instalată, activează „Urmărește locația mea” și notificările. Folosește testul destinat propriului telefon, fără apelarea testului administrativ pentru toți abonații.
2. După o deplasare, redeschide aplicația: verifică orașul, apoi mesajul de confirmare a locației notificărilor.
3. Consultă alt oraș: notificările trebuie să păstreze localitatea GPS.
4. Oprește internetul, schimbă locația, apoi reconectează: localitatea alertelor trebuie să se sincronizeze fără o nouă activare.
5. Blochează telefonul și verifică livrarea testului și a unui eveniment real; acesta este un test fizic separat de simularea de browser.
