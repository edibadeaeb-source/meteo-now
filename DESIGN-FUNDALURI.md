# Fundaluri fotorealiste și liquid glass

Actualizare: 6 octombrie 2026.

Cele nouă imagini au fost generate cu instrumentul integrat image_gen, apoi codificate WebP pentru livrare. Nu sunt fotografii făcute în localitățile afișate. Fișierele finale sunt în `assets/weather/v1/`, iar originalele sunt păstrate separat în arhiva locală de design.

Scena este aleasă după codul WMO al vremii curente, zi/noapte și orele locale de răsărit/apus. Furtuna, precipitațiile, ceața și ninsoarea au prioritate față de cerul de apus. Fotografiile trec între două straturi; un răspuns vechi nu poate suprascrie o selecție nouă. Aceeași scenă este reutilizată, iar fișierele versiunii sunt păstrate separat în cache-ul local. Nu rulează vechea animație de cer pe canvas.

Panourile mobile, lista de orașe, Setările, asistentul și comenzile hărților folosesc sticlă cu reflexii și transparență. Din versiunea 2026.10.06.7, cardurile prognozei păstrează fundalul clar prin sticlă, fără backdrop-filter, încă de la deschidere, conform capturii „Bug descoperit din greseaka.jpeg”. Nuanțele, contururile, reflexiile și răspunsul la apăsare rămân aceleași. Aspectul nu depinde de prima atingere sau de pornirea filmării. Setările și lista de orașe păstrează blurul și izolarea fundalului; grupurile din interiorul Setărilor reutilizează blurul panoului părinte. Preferința sistemului pentru transparență redusă păstrează cardurile opace pentru accesibilitate.

## Filmări și redare mobilă — versiunea 2026.10.06.6

Biblioteca actuală este `assets/weather-video/v2/`: 12 filmări, fiecare cu o variantă mică și una mare. Materialele UHD sunt codificate la 1440×2560, iar sursele disponibile numai HD sunt păstrate la 1080×1920. Variantele mici sunt 720×1280. Toate sunt H.264 Main, 30 cadre/s, fără audio, cu bucle îmbinate printr-o tranziție de o secundă. Nu se măresc sursele HD la o rezoluție etichetată 2K. Originalele rămân în arhiva locală `design-fundaluri-20261006/filmari-originale/`; helperul actual este `tests/prepare-context-weather-video.cjs`.

Filmarea originală de noapte conținea un flash luminos, confirmat printr-un salt al luminanței medii de aproximativ 53 între două cadre. Noua versiune folosește numai fragmentul stabil dinaintea flashului, încetinit și îmbinat. Testul parcurge toate cele 240 de cadre ale fiecărei variante și compară inclusiv ultimul cadru cu primul: saltul maxim este sub 1, fără flash. URL-ul și cache-ul v2 împiedică reutilizarea fragmentului vechi.

Selectarea peisajului folosește coordonatele orașului, altitudinea furnizată de prognoză și o coastă globală Natural Earth, simplificată și împachetată în aproximativ 174 KiB în `weather-geography.js`. Nu se face o cerere externă suplimentară pentru clasificare. Datele Natural Earth sunt [domeniu public](https://www.naturalearthdata.com/about/terms-of-use/), provenite din [coasta la scara 1:50m](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-coastline/). Proximitatea de coastă este aproximativă (28 km), destinată decorului, nu navigației. Marea Caspică este exclusă din clasificarea de coastă oceanică.

New York metropolitan primește filmarea reală din Manhattan pe cer senin sau aproape senin. Miami cald primește filmarea de Miami Beach; alte coaste tropicale calde primesc palmieri și mare. Coastele temperate au mare și cer însorit, iar coastele cu nori variabili au o filmare separată cu nori și valuri. Localitățile la altitudini de cel puțin 900 m primesc un peisaj reprezentativ de munte pe vreme bună. Celelalte localități păstrează cerul, gradat discret după temperatura curentă, în °C indiferent de unitatea afișată. 30°C într-un oraș continental nu declanșează plajă tropicală. Peisajele generice reprezintă tipul zonei, fără a pretinde că fiecare stâncă sau plajă este filmată în acel oraș. Nu sunt camere live.

Vremea și ora au prioritate: ploaia, furtuna, ninsoarea, ceața și cerul acoperit folosesc scenele meteo respective, indiferent de oraș sau temperatură. Noaptea nu poate selecta un peisaj însorit, inclusiv pentru WMO 1 și 2. La coastă rece nu se afișează o scenă estivală. Fundalul și filmul sunt schimbate inclusiv între orașe cu același cod WMO; răspunsurile întârziate sunt ignorate.

Cerul acoperit, ploaia și furtuna reutilizează noua filmare UHD de nori cenușii, cu tonuri potrivite scenei. Ploaia are suplimentar picături pe un canvas limitat ca rezoluție și număr. Ninsoarea folosește fulgii din filmarea reală; particulele de rezervă sunt oprite când filmul rulează. Ceața combină fotografia de ceață cu un strat discret de nori filmați și voal atmosferic. Nu există flash-uri de fulger generate sau blur animat.

Fotografia apare imediat și rămâne rezervă dacă redarea nu pornește. Două elemente video sunt reutilizate, numai unul rulează; aceeași filmare nu se reîncarcă la comutarea între orașe cu aceeași scenă. Video este muted/playsinline/loop, fără controale sau player pe tot ecranul. Redarea se reia la revenirea în aplicație și la atingere dacă browserul a respins pornirea automată. Setarea „Animații”, preferința de mișcare redusă și vizibilitatea paginii sunt respectate. Cadrele de particule sunt suspendate în timpul scrollului; filmul redat de browser continuă. Pe desktop efectele mobile sunt oprite.

Se descarcă numai filmarea necesară scenei și numai calitatea selectată. Ecranele cu densitate de cel puțin 2 primesc varianta mare, dacă nu sunt activate economisirea datelor, conexiunea 2G/3G sau memoria redusă (cel mult 2 GiB). Decodarea nereușită a variantei mari trece la varianta mică. Două elemente video sunt reutilizate; aceeași scenă și aceeași calitate nu se reîncarcă la schimbarea orașului. Cache-ul separat `meteo-weather-video-v2` păstrează fișierul întreg, răspunde corect cererilor Range inclusiv offline și are un plafon de 96 MiB. Scrierile sunt serializate, iar cele mai vechi descărcări sunt eliminate la depășirea plafonului. Variantele mari au aproximativ 2,2–5,9 MiB fiecare, cele mici aproximativ 0,7–2,3 MiB. Vechile fișiere v1 rămân disponibile pentru clienții care încă nu au preluat actualizarea.

Testele verifică selectarea geografică pe mai multe continente, altitudine, unități de temperatură și prioritatea vremii/noaptei; dimensiunile tuturor celor 24 de MP4-uri și întreaga filmare nocturnă; cache-ul limitat inclusiv la scrieri concurente. Testul în browser verifică avansarea pixelilor, decodarea efectivă 1440×2560, nouă combinații de oraș/vreme, economisirea datelor, pornirea fără gest inițial, oprire/reluare, cache/Range offline, scroll și dimensiuni mobile. Fluiditatea fizică pe S24 Ultra rămâne de verificat pe telefon.

### Proveniența filmărilor

Fișierele sunt adaptări ale filmărilor publicate pe Pexels. [Licența Pexels](https://www.pexels.com/license/) permite folosirea și modificarea filmărilor în aplicații. Nu sunt filmări live ale localității selectate.

| Fișier | Autor | Sursă |
| --- | --- | --- |
| clear-day.mp4 | Monsieur Sylvain | [Cirrus Clouds in Blue Sky](https://www.pexels.com/video/cirrus-clouds-in-blue-sky-5659664/) |
| partly-cloudy | 宇 梁 | [Serene Clouds in the Blue Sky Timelapse](https://www.pexels.com/video/serene-clouds-in-the-blue-sky-timelapse-33227529/) |
| overcast | Ilya Klimenko | [A Timelapse Video of Moving Clouds](https://www.pexels.com/video/a-timelapse-video-of-moving-clouds-4340449/) |
| twilight.mp4 | Matthias Groeneveld | [Timelapse Footage of Cloudy Sky](https://www.pexels.com/video/timelapse-footage-of-cloudy-sky-15322657/) |
| snow.mp4 | Diana ✨ | [Snowfall](https://www.pexels.com/video/snowfall-6861877/) |
| clear-night.mp4 | Jorryn Morais | [Time Lapse of a Starry Night Sky](https://www.pexels.com/video/time-lapse-of-a-starry-night-sky-14922976/) |
| new-york | Laura Tancredi | [Low Angle Shot of a Blue Sky — NYC](https://www.pexels.com/video/low-angle-shot-of-a-blue-sky-7065833/) |
| miami / coast | paashuu | [The Beach and City Skyline from an Aerial View — Miami Beach](https://www.pexels.com/video/the-beach-and-city-skyline-from-an-aerial-view-15820691/) |
| tropical-coast | Peggy Anke | [Tropical Beach View](https://www.pexels.com/video/tropical-beach-view-5383483/) |
| coast-cloudy | M'hamed Aboujid | [Blue Sky over Sea](https://www.pexels.com/video/blue-sky-over-sea-15210016/) |
| highland | Esmerald Heqimaj | [Majestic Mountain Range Under Blue Skies](https://www.pexels.com/video/majestic-mountain-range-under-blue-skies-29371404/) |

## Pictograme și gesturi

Pictogramele pe ore folosesc `hourly.is_day[k]`, calculat pentru coordonatele cerute. „Acum” folosește `current.is_day`. Dacă marcajul lipsește, se compară ora și răsăritul/apusul din aceeași dată locală a orașului, fără fusul telefonului. Senin/parțial noros au lună pe timp de noapte; burnița nocturnă nu are soare. Rezumatul zilnic rămâne o sinteză de zi. Sunt verificate Moreni, New York, Tokyo, trecerea la ziua următoare și ziua/noaptea polară.

Viewportul păstrează limita de zoom inclusiv după închiderea asistentului. Gesturile de mărire a paginii sunt prevenite pe mobil în afara hărților; Leaflet păstrează propriul zoom. Derularea normală și interacțiunile cu panourile rămân disponibile.

Verificări: toate scenele, ora locală, codurile WMO 85/86, schimbări concurente, încărcare nereușită, sintaxă și regresii mobile; test în browser pe lățimi 320/360/393/412/430/820 px, derulare, izolarea fundalului în Setări și selectorul de orașe. Capturi în `03-Testare-si-capturi/tests/artifacts-liquid-glass/`. Performanța fizică la 120 Hz rămâne de verificat pe telefon.

## Prompturile finale

### clear-day

Fișier final: `assets/weather/v1/clear-day.webp`.

Use case: photorealistic-natural. Asset type: full-screen portrait background for a premium mobile weather application. Generate a high-resolution portrait photograph (vertical 9:16 composition), ultra photorealistic atmospheric sky with physically natural light, real cloud texture, fine photographic detail, subtle tonal gradients. Frame almost entirely sky, at most a very low distant indistinct horizon in the bottom 8 percent, no city landmarks, no buildings, no people, no text, no UI, no logos, no illustration, no painterly effect, no plastic CGI clouds, no excessive HDR. Keep the upper center uncluttered for overlaid city and temperature typography. Atmospheric depth should remain beautiful behind transparent glass panels. Clear bright blue daytime sky, soft azure to pale cyan atmospheric depth, tiny sparse wisps of cirrus at edges, warm natural sun glow outside the upper right frame, no artificial sun disc, fresh serene summer light.

### rain

Fișier final: `assets/weather/v1/rain.webp`.

Use case: photorealistic-natural. Asset type: full-screen portrait background for a premium mobile weather application. Generate a high-resolution portrait photograph (vertical 9:16 composition), ultra photorealistic atmospheric sky with physically natural light, real cloud texture, fine photographic detail, subtle tonal gradients. Frame almost entirely sky, at most a very low distant indistinct horizon in the bottom 8 percent, no city landmarks, no buildings, no people, no text, no UI, no logos, no illustration, no painterly effect, no plastic CGI clouds, no excessive HDR. Keep the upper center uncluttered for overlaid city and temperature typography. Atmospheric depth should remain beautiful behind transparent glass panels. A realistic rainy sky during daylight, layered slate blue rainclouds with natural soft cloud texture, distant rain curtains descending through the lower third, subdued silver light behind clouds, rich cool blue-gray atmosphere, no glass-window droplets, no lightning, no cartoon streaks.

### clear-night

Fișier final: `assets/weather/v1/clear-night.webp`.

Use case: photorealistic-natural. Asset type: full-screen portrait background for a premium mobile weather application. Generate a high-resolution portrait photograph (vertical 9:16 composition), ultra photorealistic atmospheric sky with physically natural light, real cloud texture, fine photographic detail, subtle tonal gradients. Frame almost entirely sky, at most a very low distant indistinct horizon in the bottom 8 percent, no city landmarks, no buildings, no people, no text, no UI, no logos, no illustration, no painterly effect, no plastic CGI clouds, no excessive HDR. Keep the upper center uncluttered for overlaid city and temperature typography. Atmospheric depth should remain beautiful behind transparent glass panels. A realistic clear night sky, deep navy blue and indigo atmospheric depth with a modest number of small natural stars, extremely subtle distant clouds low at the edges, dark blue horizon glow at the bottom, no moon (the app shows the actual moon phase separately), no Milky Way, no nebula, no fantasy colors.

### partly-cloudy

Fișier final: `assets/weather/v1/partly-cloudy.webp`.

Use case: photorealistic-natural. Asset type: full-screen portrait background for a premium mobile weather application. Generate a high-resolution portrait photograph, vertical 9:16 composition, ultra photorealistic atmospheric sky with physically natural lighting, real cloud texture, fine photographic detail and subtle tonal gradients. Frame almost entirely sky; at most a very low distant indistinct horizon in the bottom 8 percent. No city landmarks, buildings, people, text, UI, logos, illustration, painterly effects, plastic CGI clouds or excessive HDR. Upper center should have calm negative space for city and temperature typography. Beautiful atmospheric depth behind transparent glass panels. Fresh daytime blue sky with realistic softly illuminated cumulus clouds drifting in from the left and lower right, wide calm blue opening through upper center, natural silver and warm white cloud edges, realistic shadows within clouds, sunlight outside frame.

### overcast

Fișier final: `assets/weather/v1/overcast.webp`.

Use case: photorealistic-natural. Asset type: full-screen portrait background for a premium mobile weather application. Generate a high-resolution portrait photograph, vertical 9:16 composition, ultra photorealistic atmospheric sky with physically natural lighting, real cloud texture, fine photographic detail and subtle tonal gradients. Frame almost entirely sky; at most a very low distant indistinct horizon in the bottom 8 percent. No city landmarks, buildings, people, text, UI, logos, illustration, painterly effects, plastic CGI clouds or excessive HDR. Upper center should have calm negative space for city and temperature typography. Beautiful atmospheric depth behind transparent glass panels. Overcast daylight sky filled with realistic layered soft stratocumulus, cool blue-grey depths and soft silver light filtering through irregular cloudy layers, quiet substantial natural cloud texture, slightly brighter low horizon, no sun disc or rain.

### storm

Fișier final: `assets/weather/v1/storm.webp`.

Use case: photorealistic-natural. Asset type: full-screen portrait background for a premium mobile weather application. Generate a high-resolution portrait photograph, vertical 9:16 composition, ultra photorealistic atmospheric sky with physically natural lighting, real cloud texture, fine photographic detail and subtle tonal gradients. Frame almost entirely sky; at most a very low distant indistinct horizon in the bottom 8 percent. No city landmarks, buildings, people, text, UI, logos, illustration, painterly effects, plastic CGI clouds or excessive HDR. Upper center should have calm negative space for city and temperature typography. Beautiful atmospheric depth behind transparent glass panels. Dramatic but believable thunderstorm sky with deep slate indigo cumulonimbus clouds, naturally turbulent layered edges and distant rain curtains, one subtle thin distant lightning branch in the lower right third, calm dark upper center, no neon purple or fantasy saturation, no landscape foreground.

### snow

Fișier final: `assets/weather/v1/snow.webp`.

Use case: photorealistic-natural. Asset type: full-screen portrait background for a premium mobile weather application. Generate a high-resolution portrait photograph, vertical 9:16 composition, ultra photorealistic atmospheric sky with physically natural lighting, real cloud texture, fine photographic detail and subtle tonal gradients. Frame almost entirely sky; at most a very low distant indistinct horizon in the bottom 8 percent. No city landmarks, buildings, people, text, UI, logos, illustration, painterly effects, plastic CGI clouds or excessive HDR. Upper center should have calm negative space for city and temperature typography. Beautiful atmospheric depth behind transparent glass panels. Real winter snowfall atmosphere, low layered soft pale blue-gray winter clouds, diffuse silver daylight, gentle atmospheric veil and a few softly out-of-focus snowflakes scattered across the lower and side areas, realistic natural snowfall not large decorative snowflakes, no structures or trees.

### fog

Fișier final: `assets/weather/v1/fog.webp`.

Use case: photorealistic-natural. Asset type: full-screen portrait background for a premium mobile weather application. Generate a high-resolution portrait photograph, vertical 9:16 composition, ultra photorealistic atmospheric sky with physically natural lighting, real cloud texture, fine photographic detail and subtle tonal gradients. Frame almost entirely sky; at most a very low distant indistinct horizon in the bottom 8 percent. No city landmarks, buildings, people, text, UI, logos, illustration, painterly effects, plastic CGI clouds or excessive HDR. Upper center should have calm negative space for city and temperature typography. Beautiful atmospheric depth behind transparent glass panels. A realistic misty atmosphere with silver blue-grey daylight filtering through fog, nuanced soft layers of pale mist and faint low distant silhouettes of hills only along the bottom edge, calm spacious low contrast sky, no yellow sunlight, no structures, no flat featureless color.

### twilight

Fișier final: `assets/weather/v1/twilight.webp`.

Use case: photorealistic-natural. Asset type: full-screen portrait background for a premium mobile weather application. Generate a high-resolution portrait photograph, vertical 9:16 composition, ultra photorealistic atmospheric sky with physically natural lighting, real cloud texture, fine photographic detail and subtle tonal gradients. Frame almost entirely sky; at most a very low distant indistinct horizon in the bottom 8 percent. No city landmarks, buildings, people, text, UI, logos, illustration, painterly effects, plastic CGI clouds or excessive HDR. Upper center should have calm negative space for city and temperature typography. Beautiful atmospheric depth behind transparent glass panels. Photorealistic sunset sky with deep soft indigo upper atmosphere, natural muted rose and amber light flowing through thin realistic wispy clouds in the lower half, tiny warm sun barely above an extremely low distant horizon near the bottom edge, peaceful refined true photographic colors, no intense neon saturation.
