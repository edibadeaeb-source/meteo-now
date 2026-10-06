# Fundaluri fotorealiste și liquid glass

Actualizare: 6 octombrie 2026.

Cele nouă imagini au fost generate cu instrumentul integrat image_gen, apoi codificate WebP pentru livrare. Nu sunt fotografii făcute în localitățile afișate. Fișierele finale sunt în `assets/weather/v1/`, iar originalele sunt păstrate separat în arhiva locală de design.

Scena este aleasă după codul WMO al vremii curente, zi/noapte și orele locale de răsărit/apus. Furtuna, precipitațiile, ceața și ninsoarea au prioritate față de cerul de apus. Fotografiile trec între două straturi; un răspuns vechi nu poate suprascrie o selecție nouă. Aceeași scenă este reutilizată, iar fișierele versiunii sunt păstrate separat în cache-ul local. Nu rulează vechea animație de cer pe canvas.

Panourile mobile, lista de orașe, Setările, asistentul și comenzile hărților folosesc sticlă cu reflexii și transparență. Grupurile din interiorul Setărilor reutilizează blurul panoului părinte. Există rezervă pentru browsere fără backdrop-filter și pentru preferințe de transparență/motion redus.

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
