# METEO NOW — stand de prezentare

Pregătit la 4 noiembrie 2026 pentru prezentarea de vineri, 6 noiembrie.

## Pornire

Dublu clic pe `DESCHIDE-STAND.bat`. Se deschide dashboardul la http://127.0.0.1:8765 pe laptop. Butonul din dreapta sus sau F11 activează ecranul complet. Pentru oprirea serverului: `OPRESTE-STAND.bat`. Închiderea filei nu oprește serverul; oprirea calculatorului îl oprește.

Necesită doar Python 3.10+ (deja disponibil pe acest laptop), fără instalare de pachete. Fișierele pot fi copiate împreună pe alt laptop care are Python. Pentru pornire manuală: `python server.py --port 8765`. Serverul ascultă exclusiv pe acest calculator, nu în rețeaua liceului.

## Ce poți arăta

- Valorile celor doi senzori BME680: temperatură, umiditate, presiune, rezistență de gaz; IAQ numai pe ESP32 dacă există în pachet.
- ESP32/Wi-Fi și expLoRaBLE/LoRaWAN, cu RSSI și SNR când sunt raportate.
- Ambele stații sunt afișate simultan, fără selectarea senzorului. Cifre și texte mărite pentru vizitatorii standului, pe fundal crem/alb cu accente naturale.
- Temperatura are cinci intervale de culoare: sub 10°C, 10–18°C, 18–26°C, 26–32°C, minimum 32°C. Sunt repere vizuale, nu avertizări meteo sau de siguranță.
- Patru grafice comparative vizibile: temperatură, umiditate, presiune și rezistență de gaz. Export CSV cu data și ora UTC.
- Explicații interactive pentru traseul măsurătorii.
- Legătură spre aplicația publică METEO NOW, deschisă doar la apăsare.
- Demo interactiv fără internet: valori simulate, etichetate permanent, cu reglaje pentru temperatură și umiditate. CSV-urile demo sunt etichetate SIMULAT.

## Date reale și siguranță

Implicit se deschide în „Senzori reali”. Citirea este exclusiv GET, fără chei sau scrieri, în ramurile publice existente `senzori/bme680`, `senzori/lorawan`, `istoric/lorawan` ale proiectului Firebase `licenta-ae902`. Istoricul este limitat la ultimele 60 de chei / senzor și sortat apoi după timestamp. Interogările sunt grupate și memorate 20 secunde; când fila este ascunsă sau demo este activ, browserul nu mai cere date. Nicio citire a rădăcinii, abonamentelor push, orașelor sau comenzilor private.

„Date recente” necesită o măsurătoare datată în ultimele 5 minute și citire reușită. Întreruperea conexiunii păstrează valorile și le marchează indisponibile; datele vechi nu sunt prezentate ca măsurători actuale. Ora nevalidă nu este inventată. Dashboardul nu verifică separat gateway-ul, ChirpStack sau MQTT; verifică numai datele ajunse la capătul traseului. IAQ este orientativ și nu certifică siguranța aerului. Montajul din interior măsoară mediul din interior, nu vremea orașului.

Aplicația mobilă, regulile Firebase, firmware-ul și serviciile Render nu sunt modificate. `meteo-vechi` rămâne suspendat. Dashboardul nu este publicat pe Render și nu folosește orele gratuite ale serviciului de rezervă. Demo funcționează cu fișiere locale și nu depinde de CDN, fonturi externe, AI sau notificări.

## Mâine, cu montajul

1. Verificăm alimentările și conectăm antenele corecte înaintea emițătoarelor. Confirmăm configurația existentă înainte de a rescrie firmware.
2. Verificăm conexiunea ESP32 la rețeaua disponibilă și accesul gateway-ului la internet / serverul ChirpStack al licenței. Rețeaua de la liceu poate avea un portal de autentificare; pregătim o conexiune potrivită montajului.
3. Refacem autentificarea scrierilor ESP32 și a punții MQTT. Scrierea anonimă a fost blocată în octombrie; simpla alimentare a montajului nu o reactivează. Nu redeschidem baza public la scriere și nu punem cheia administrativă a aplicației pe microcontroler.
4. Verificăm pachete noi de la ambele dispozitive, timestampurile și actualizarea graficelor. Acest pas necesită montajul real și nu este confirmat încă.
5. Facem o probă de deconectare și revenire. Luăm încărcătorul laptopului, alimentări/cabluri, montajul și telefonul. Demo rămâne o rezervă etichetată pentru explicații, nu o simulare prezentată drept măsurătoare reală.

Referință pentru interogările limitate: https://firebase.google.com/docs/database/rest/retrieve-data
