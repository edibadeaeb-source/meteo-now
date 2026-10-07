# METEO NOW — 2026.10.07.6

## Surse gratuite și comparație

Vremea curentă de pe mobil folosește acum OpenWeather Current Weather 2.5,
cu cheia existentă exclusiv pe server. Prognoza viitoare folosește MET Norway
Locationforecast, gratuit, fără cheie, cu atribuire CC BY 4.0.

În verificarea din 7 octombrie, la aproximativ 12:08 ora României:

| Oraș | Open-Meteo, temperatura curentă | OpenWeather | MET Norway, primul punct disponibil |
| --- | --- | --- | --- |
| Moreni | 21,2°C, noros | 22,89°C, cer acoperit | 21°C, parțial noros |
| București | 22,1°C, noros | 21,63°C, cer fragmentat | 21,4°C, parțial noros |
| New York | 6,9°C, senin | 10,49°C, senin | 8,9°C, senin |

Acestea sunt diferențe între surse, **nu măsurători independente de precizie**.
Punctul MET din New York era de la 08:00 UTC; celelalte date erau apropiate de
09:00 UTC. Nu rezultă că un furnizor este întotdeauna mai exact. OpenWeather
combină modele și surse observaționale pentru vremea curentă; Open-Meteo descrie
datele sale „current” drept date bazate pe modele la intervale de 15 minute.

The Weather Company nu a fost integrat: utilizatorul nu are acces API și dorește
o soluție gratuită. WeatherAPI.com Free are numai trei zile de prognoză, insuficiente
pentru ecranul actual de zece zile. OpenWeather One Call cu facturare nu este folosit.

Surse oficiale:

- https://openweathermap.org/current
- https://openweathermap.org/price
- https://open-meteo.com/en/docs
- https://docs.api.met.no/doc/locationforecast/datamodel.html
- https://docs.api.met.no/doc/ForecastJSON
- https://docs.api.met.no/doc/TermsOfService.html
- https://docs.api.met.no/doc/License.html
- https://www.weatherapi.com/pricing.aspx

## Comportamentul final

- `/api/weather/forecast` păstrează formatul folosit deja de aplicație și până la
  zece zile, cu data locală a orașului. Nu folosește maximul zilei drept temperatură curentă.
- MET înlocuiește temperatura, fenomenul și cantitatea de precipitații pentru orele
  acoperite. Intervalele native de șase ore sunt interpolate pentru temperatură;
  cantitatea de apă este distribuită ca medie pe oră, fără multiplicarea totalului.
- Zilele viitoare complete folosesc MET. Azi păstrează extrema întregii zile din
  Open-Meteo; MET nu poate recupera orele deja trecute. Ultima zi incompletă și
  intervalele neacoperite păstrează Open-Meteo. Testul real a acoperit opt zile
  viitoare complete din zece zile afișate.
- UV, probabilități de precipitații, vizibilitate și ore solare rămân Open-Meteo.
  Vântul folosește MET dacă acel câmp există, altfel sursa de rezervă. Aceste roluri
  sunt indicate în `weather_sources` și în creditele aplicației.
- Notificările și prognozele widgeturilor folosesc același serviciu. Widgeturile
  aveau deja vreme curentă OpenWeather. Nu este necesar un APK nou pentru acest update.
- Lista de orașe și harta cer doar temperaturile curente, cu cel mult 16 coordonate
  per cerere. Listele mai mari sunt împărțite automat, cu ordinea păstrată.
- Cache separat pe coordonate, 120 secunde pentru vreme curentă/date combinate,
  maximum 256 intrări. MET respectă Expires, Last-Modified și If-Modified-Since;
  cache comun celor doi workers în directorul temporar, în afara fișierelor publice.
  La 429 există pauză comună și rezervă. Răspunsul complet este acum memorat și
  partajat între workers; cererile simultane pentru aceleași coordonate sunt comasate.
  La indisponibilitatea tuturor surselor se admite o rezervă din același oraș,
  de cel mult 30 minute, marcată `stale`.
- Datele de prognoză din cache pot conține coordonate, dar niciun identificator de
  persoană/dispozitiv; politica de confidențialitate a fost actualizată în RO/EN.

## Interfață și fundaluri

Apăsarea scurtă pe pilula orașului deschide lista pe `click`, după terminarea
atingerii. Deschiderea pe `pointerup` permitea clicului ulterior să atingă un rând
nou introdus și să selecteze un oraș. Glisarea și anularea sunt tratate separat;
Enter/Space deschid lista cu tastatura.

Contrastul textului secundar și umbra textului sunt puțin mai puternice. Panourile
păstrează transparența liquid glass.

Cele 136 fotografii licențiate au variante noi, fără vechea decupare îngustă, în
`assets/weather-romania/v2`. Orașul ocupă aproximativ 40% din înălțimea fundalului,
în partea de jos, cu o margine estompată spre un cer ilustrativ potrivit vremii.
Nu sunt camere live și nu sunt prezentate drept fotografii ale vremii actuale.
Autorii, licențele și adaptarea sunt în `weather-credits.html`.

Filmarea Pexels 30550598, etichetată „Twinkling Starry Night Sky Timelapse”,
conținea particulele albe observate în screenshot. A fost înlocuită în catalog și
la revenirea din cache cu **Sky at Night with Stars**, Ahnaf Piash, Pexels 5747525:
https://www.pexels.com/video/sky-at-night-with-stars-5747525/
Licență: https://www.pexels.com/license/
Variantele noi sunt în `assets/weather-video/v5`, lite 720×1280 și 2K 1440×2560,
H.264 silențios, 30 fps, cu poster potrivit și buclă lină. Originalul 2160×3240
permite 2K fără mărire artificială. Vechea filmare rămâne arhivată, nefolosită.

## Verificări

- 37 teste Python: surse, fallback, cache între workers, 429, fus orar/DST,
  clasificare meteo, date API, azi/ieri, widgeturi, AI și notificări.
- Teste browser reale: atingere scurtă pe nume/puncte la 320/412/430px, opt orașe,
  selecție explicită, tastatură și glisare; 136 imagini WebP decodate, noua compoziție,
  încărcări întârziate, reapariție video, animații, cache/offline.
- Cele două filme de noapte decodează și rulează efectiv; noul film 2K/lite are
  toate cadrele și trecerea buclei verificate. Salt maxim de luminozitate <0,7.
- Layout: iPhone SE/Pro Max, Xiaomi compact, S24 Ultra, tabletă, landscape și desktop.
- Comparația reală și probele de integrare sunt salvate în folderul de testare.

Nu s-a testat fizic pe telefonul utilizatorului. Acuratețea locală trebuie evaluată
pe mai multe zile față de condițiile observate, nu declarată dintr-o singură comparație.

## Recuperarea prognozei și pornirea cu GPS — versiunea 6

Problema din screenshoturi a fost reprodusă pe server: prognoza Moreni și
I. L. Caragiale răspundea 502, în timp ce temperatura curentă era disponibilă.
Serviciul cerea obligatoriu răspunsul Open-Meteo pentru întregul ecran. Cauza
exactă a refuzului furnizorului pe server nu a putut fi stabilită din exterior.
Jurnalul nou include sursa, tipul erorii și codul HTTP, fără URL-uri cu chei.

- Open-Meteo nu mai este obligatoriu. Dacă nu răspunde, prognoza se construiește
  integral din MET Norway. Dacă și MET este indisponibil sau incomplet, se folosește
  OpenWeather 5 day / 3 hour, accesat numai ca ultimă rezervă cu cheia existentă.
- Sunt afișate numai zilele acoperite, fără completarea fictivă până la zece zile.
  Astăzi, în rezerva MET/OWM, min/max acoperă orele disponibile și observația curentă;
  interfața explică limita. Zilele viitoare incomplete sunt omise.
- Fusul orar este identificat local cu tzfpy; orele respectă DST. Răsăritul și
  apusul se calculează cu Astral, inclusiv absența lor în noaptea/ziua polară.
  UV, vizibilitatea și probabilitățile necomunicate rămân indisponibile, afișate „—”.
- La 429 de la Open-Meteo, pauza Retry-After este comună între workers și orașe.
  Serverul are doi workers cu câte patru threads; prognozele și cache-ul MET sunt
  comune pe disc și limitate separat la 256 intrări. O prognoză proaspătă se
  reutilizează două minute, iar cache-ul local al aplicației până la cinci minute.
- Aplicația reîncearcă de trei ori erorile de rețea/5xx, cu pauze de una și trei
  secunde. Nu reîncearcă automat 4xx. La revenirea conexiunii reîncarcă imediat.
  Datele existente rămân pe ecran în timpul actualizării; o cerere întârziată
  pentru orașul vechi nu poate înlocui locația nouă.
- Prima pornire fără prognoză memorată păstrează ecranul de început până la date
  valide sau până la un mesaj cu reîncercare, în locul ecranului gol cu „--°”.

Verificări suplimentare: 42 teste Python în total; pornire browser fără cache,
schimbare GPS Moreni → I. L. Caragiale, două erori 502 urmate de recuperare,
indisponibilitate completă și revenirea conexiunii. Rezerva MET a fost verificată
și cu răspunsuri reale pentru Moreni, I. L. Caragiale și New York.

Testul de concurență a trimis 200 cereri cu 32 threads către două instanțe locale
ale serviciului, cu furnizori simulați. Pentru un oraș s-au făcut numai trei cereri
către furnizori, iar pentru alt oraș alte trei; datele nu s-au amestecat.
Acesta verifică partajarea cache-ului, nu certifică o capacitate de mii de utilizatori
pe planul Render și pe limitele furnizorilor folosiți. Este necesar un test de
capacitate separat înainte de a face o astfel de promisiune.

Documentație suplimentară: https://openweathermap.org/forecast5,
https://astral.readthedocs.io/en/latest/, https://github.com/ringsaturn/tzfpy.
