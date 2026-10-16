# METEO NOW — notificări, limite și confidențialitate

Verificat la **17 octombrie 2026**, ora locală Europe/Bucharest. Web/server **2026.10.17.2**, SW **v65**. Android rămâne **1.0.23**. Auditul nu creează conturi, abonamente, costuri noi, invitații sau notificări reale.

## 1. Notificările automate

Jurnalele private Render pentru serviciul principal confirmă în eșantionul recent:

- 98 apeluri `/api/push/check` cu HTTP 200, aproximativ la 15 minute, între 15 octombrie 21:30 și 16 octombrie 21:45 UTC, adică 16 octombrie 00:30 – 17 octombrie 00:45 în România.
- Două apeluri `/api/push/rezumat` cu HTTP 200 pe 16 octombrie, la aproximativ **07:30 și 20:00** în România.
- Apelul `check` execută deja atât verificarea ANM, cât și evenimentele meteo. Nu este necesar un job `/api/push/meteo` suplimentar pentru același interval.

Eșantionul este paginat, nu un inventar exhaustiv. În aceste 100 de înregistrări nu apar joburi ale serviciului legacy. Nu deducem de aici că niciun job legacy nu există. HTTP 200 confirmă procesarea cererii, nu succesul fiecărui furnizor sau sosirea pe telefon: ruta întoarce intenționat 200 și pentru unele indisponibilități externe.

Utilizatorul a confirmat că noul format funcționează. Nu am avut telefon fizic conectat în acest audit; livrarea unei alerte reale cu telefonul blocat rămâne o probă distinctă. Nu am apelat rutele de cron sau de trimitere push pentru a forța mesaje.

### Cheia din URL

Unele apeluri vechi includ cheia cron în query string, iar aceasta ajunge în jurnalele private de acces. Valoarea nu a fost afișată sau salvată în raport; copiile brute din starea uneltei au fost eliminate după agregare.

Am adăugat `gunicorn.conf.py` cu un format de acces care păstrează metoda, calea **fără parametri**, protocolul, statutul, dimensiunea și durata. Nu include IP, referer, user-agent ori antete. Erorile HTTP Anthropic nu mai imprimă corpul răspunsului, care ar putea reproduce conținutul unei întrebări. [Configurarea Gunicorn](https://gunicorn.org/configure/), [câmpurile jurnalelor](https://docs.gunicorn.org/en/stable/settings.html#access-log-format).

Această protecție nu șterge jurnalele vechi și nu poate modifica jurnalele proprii ale infrastructurii. Migrarea și rotirea cheii în serviciul extern de cron rămân necesare. Autentificarea prin URL este păstrată temporar ca să nu oprim programările existente. Ghidul concret este `CRON-HEADER-MIGRATION-20261017.md`.

Controlul browserului a eșuat cu eroarea de inițializare a uneltei „permission path cannot be represented losslessly”. Căutarea integrărilor nu a oferit o conexiune directă cron-job.org. Nu am pretins că am modificat joburile externe și nu am cerut cheia în conversație.

## 2. Limitele furnizorilor și costuri

| Serviciu | Condiții / limită publică verificată | Implicație pentru proiect |
|---|---|---|
| MET Norway | Identificare prin User-Agent, cache după Expires / Last-Modified, coordonate la maximum 4 zecimale; peste 20 cereri/secundă/aplicație necesită acord. Date CC BY 4.0. | Backendul identifică aplicația, rotunjește coordonatele, folosește cache și cereri condiționale; limita de ritm locală presupune cei doi workeri actuali. Nu certifică un număr de utilizatori. |
| Open-Meteo | Gratuit pentru utilizare necomercială: sub 10.000 apeluri/zi, 5.000/oră și 600/minut. Cererile cu multe variabile, locații sau perioade lungi pot conta drept mai multe apeluri. | Fără reclame/abonamente și pentru proiect educațional, folosirea actuală este compatibilă cu exemplele necomerciale publicate, sub rezerva încadrării reale. Monetizarea schimbă această analiză. Arhiva de 30 ani poate consuma multe unități la prima încărcare, chiar dacă apoi este memorată. |
| OpenWeather | Oferta gratuită pentru Current / 5-day forecast: 60 apeluri/minut și 1.000.000/lună. | Acestea sunt API-urile folosite în cod; nu confunda cota lor cu One Call cu tarif pe apel. Planul efectiv al contului nu a fost citit din consola furnizorului. |
| RainViewer | API gratuit pentru proiecte personale, educaționale și comunități mici; fără SLA sau plafon numeric public garantat. Credit cu link obligatoriu; trafic comercial mare cere discuție cu furnizorul. | Cache și revenire după erori; nu promitem gratuitate nelimitată pentru trafic mare. Atribuirea existentă este păstrată. |
| BigDataCloud | Client-side reverse geocoding gratuit numai pentru poziția curentă a dispozitivului care face cererea. Nu permite puncte generate ori coordonate ale altor utilizatori. | Am eliminat cele până la 12 geocodări ale punctelor sintetice din harta sinoptică. Punctele rămân aceleași și au etichete locale „Zona de nord-est” etc.; localizarea GPS reală rămâne. |
| Render | Ambele servicii au plan Free. Spațiul împarte 750 ore gratuite/lună; idle după 15 minute, pornire lentă și disc efemer. | Un backup ținut permanent pornit consumă și el ore. Nu am schimbat planurile și nu am oprit backupul. Nu promitem pornire instant sau disponibilitate garantată pe Free. |
| Firebase Realtime Database | Spark include 1 GB stocare, 10 GB descărcări/lună și maximum 100 conexiuni simultane. Blaze are reguli diferite. | Planul și consumul efectiv trebuie verificate în consola proiectului; nu am presupus că utilizatorul are Spark sau Blaze. API-urile mobile de push/widget folosesc backendul, nu citire publică a bazei. |

Surse oficiale: [MET Norway](https://developer.yr.no/doc/TermsOfService/), [licența MET](https://developer.yr.no/doc/License/), [Open-Meteo](https://open-meteo.com/en/terms), [contorizarea Open-Meteo](https://open-meteo.com/en/pricing), [OpenWeather](https://openweathermap.org/price), [RainViewer](https://www.rainviewer.com/api.html), [BigDataCloud](https://www.bigdatacloud.com/docs/article/fair-use-policy-for-free-client-side-reverse-geocoding-api), [Render](https://render.com/docs/free), [Firebase billing](https://firebase.google.com/docs/database/usage/billing), [Firebase connections](https://firebase.google.com/docs/database/faq-and-troubleshooting).

Datele NOAA/DWD/ANM și media au atribuiri existente; auditul de față nu certifică fiecare condiție juridică a tuturor surselor secundare sau a tuturor fotografiilor. Licența CC BY 4.0 a Open-Meteo și adaptarea datelor sunt acum explicite și în pagina de credite, fără eliminarea creditelor existente.

### AI — Sonnet 5.5

Codul cere `claude-sonnet-5-5`, un model prezent în documentația oficială. Preț standard verificat: **2 USD / milion tokenuri de intrare** și **10 USD / milion tokenuri de ieșire**. Nu am schimbat modelul sau introdus o abonare. [Model și tarife](https://platform.claude.com/docs/en/models/sonnet-5-5/overview).

Eșantionul de jurnale conține două răspunsuri AI reușite, fără textul întrebărilor: 25.036 tokenuri intrare și 303 ieșire cumulat. Aplicarea tarifelor standard, fără cache/discounturi/taxe, dă aproximativ **0,053 USD pentru ambele**. Este un calcul orientativ, nu factura contului și nu un eșantion reprezentativ al lansării.

Exemplu de dimensionare: 12.000 tokenuri intrare + 150 ieșire costă aproximativ **0,0255 USD/întrebare**. 200 asemenea întrebări/zi, 30 zile, ar însemna aproximativ **153 USD/lună**. Volumul real depinde de istoric și context, nu doar de lungimea răspunsului.

Protecțiile existente în cod sunt: 6/minut și 30/zi/IP, 20/minut și implicit 200/zi/serviciu, maximum două cereri AI simultane, maximum 2.000 tokenuri de ieșire/răspuns. Limita zilnică poate fi suprascrisă în mediul privat. Sunt limite de cereri, **nu un plafon exact în bani**. Cele două servicii au contoare locale distincte, resetate la repornire. Nu am inspectat creditul, reîncărcarea automată sau plafonul financiar din consola Anthropic și nu am modificat limitele fără un buget ales.

## 3. Confidențialitate și ștergere

Politica publică RO/EN explică acum:

- Contextul AI poate include orașul și coordonatele selectate; METEO NOW nu salvează conversația pe server, dar Anthropic declară retenție standard API până la 30 zile, cu excepții. Ștergerea locală nu șterge automat copiile furnizorului. [Retenție Anthropic](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data).
- IP-ul este procesat pentru securitate; limitele folosesc o amprentă derivată temporară, iar înregistrările expirate sunt curățate la cereri ulterioare.
- Notificările pot fi dezabonate din aplicație. Dezinstalarea nu garantează eliminare imediată a abonamentului.
- Orașele widgeturilor sunt criptate end-to-end; identificatorul opac și starea ultimei verificări Android sunt fluxuri separate. Nu există în prezent o acțiune unică pentru ștergerea tuturor acestor înregistrări server.

Inventarul Data safety este actualizat; nu marchează AI/locația ca exclusiv efemere și nu confundă ștergerea locală cu ștergerea tuturor copiilor externe. Clasificarea finală a distribuirii trebuie completată după relația reală cu fiecare furnizor și condițiile conturilor. Acesta este un inventar tehnic, nu o certificare juridică sau acceptare Google Play.

## Validare și pași rămași

Teste relevante: formatul de acces fără date private și eroarea AI fără corp; protecțiile existente; etichetele celor 13 puncte de prognoză RO/EN fără rețea; sintaxa și fluxurile GPS/notificări. Nu sunt simulate atacuri asupra producției sau supraîncărcări ale API-urilor gratuite.

Rămân: migrarea/rotirea cheii în cron-job.org; probă explicită de alertă cu telefonul blocat; verificarea consumului și a plafonului financiar în consolele furnizorilor înainte de lansare largă. Utilizatorul reface capturile magazinului pe telefon. Nu a fost creat sau plătit un cont Google Play în această sesiune.
