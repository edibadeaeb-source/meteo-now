# METEO NOW — notificări scurte cu emoji

Web/server **2026.10.17.1**, Service Worker **v64**. Android rămâne **1.0.23**; nu este necesar APK nou. Utilizatorul a ales formatul „Moreni 🌧️” și un mesaj scurt dedesubt.

## Prezentare

- Titlul păstrează numele complet și diacriticele localității, cu un singur emoji. Nu transformăm numele în majuscule și nu folosim bara verticală.
- Evenimentele de ploaie folosesc 🌧️, ninsoarea 🌨️, furtuna ⛈️, ceața 🌫️ și vântul 💨. Avertizările oficiale folosesc ⚠️, iar testul pe dispozitiv 🔔.
- Mesajul este formulat complet, fără tăiere cu puncte de suspensie. Pentru codurile de averse 80/81/82: „Averse posibile în următoarea oră.” Pentru ploaie obișnuită: „Ploaie posibilă în următoarea oră.” Nu redenumim orice ploaie drept averse.
- „În următoarea oră” se folosește numai când ținta este la cel mult 60 minute de ora datelor curente. Pentru intervale mai târzii se păstrează momentul local al orașului: această seară, cursul nopții, mâine dimineață etc. Pragul anterior de 75 minute a fost corectat.
- Încetarea precipitațiilor rămâne probabilistică: „Ploaia s-ar putea opri în această seară.” Nu promitem înseninări doar pentru că ploaia se oprește.
- Rezumatele zilnice au emoji din codul meteo al zilei țintă și text compact: „Astăzi: ploaie slabă. Maxima 18°C, minima 9°C.” / „Mâine: …”. Sunt eliminate sfatul lung și comparația cu ziua anterioară din aceste notificări. Un rezumat despre ziua de mâine poate avea soare chiar dacă este trimis seara; nu descrie vremea curentă nocturnă.
- Avertizarea păstrează nivelul în corp: „Cod galben: ploi.”, „Cod portocaliu: ploi și intensificări ale vântului.” Fenomenele sunt extrase semantic din mesajul ANM, până la trei idei. Nu inventăm o oră de expirare când nu există una sigură în fluxul scurt.
- Corpul avertizărilor compacte este localizat RO/EN. Rezerva locală pentru Dâmbovița păstrează aceleași reguli de prezentare și severitate.

Nu sunt adăugate tipuri noi de alerte pentru vreme senină sau nopți liniștite. Sunt schimbate textele și simbolurile notificărilor existente, nu programările, alegerea evenimentului, consimțământul, GPS-ul, deduplicarea sau tag-urile.

## Verificare

- 34 teste Python pentru notificări: 12 tipuri de evenimente în RO/EN, titluri/diacritice, rezumate azi/mâine și °C/°F, coduri de avertizare, intervalele la 60/61/75 minute, prospețime și livrare simulată.
- 16 teste context AI / copy / sincronizare: trecute.
- Testul local JavaScript verifică severitatea și mesajele complete RO/EN în rezerva ANM; testele fluxurilor de notificări și sintaxei scripturilor au trecut.
- Browserul folosește Geolocation API și Service Worker reale, cu furnizori/abonamente simulate local. După închiderea ferestrelor aplicației, workerul primește un PushEvent sintetic cu „Oraș QA 🌧️” / „Averse posibile în următoarea oră.” și păstrează titlul, corpul și URL-ul.

Nu am trimis notificări reale în această verificare și nu am verificat fizic afișarea emoji pe S24. Aspectul exact al emoji este stabilit de sistemul telefonului. Actualizarea se aplică notificărilor noi; mesajele deja afișate nu sunt rescrise.

Rezultatele sunt în `03-Testare-si-capturi/tests/artifacts-notification-copy-20261017`. Testul browserului este și în `artifacts-notification-location/browser-results.json`.
