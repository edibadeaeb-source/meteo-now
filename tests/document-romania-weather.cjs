const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const cities=JSON.parse(fs.readFileSync(path.join(root,'assets/weather-romania/v1/cities.json'),'utf8'));
const photos=JSON.parse(fs.readFileSync(path.join(root,'assets/weather-romania/v1/sources.json'),'utf8'));
const labels={'clear-day':'senin','clear-night':'senin','partly-cloudy':'parțial noros',overcast:'acoperit',twilight:'răsărit/apus',snow:'ninsoare',rain:'ploaie'};
const table=cities.map(c=>{const rows=photos.filter(p=>p.slug===c.slug),scenes=night=>Array.from(new Set(rows.filter(p=>p.night===night).flatMap(p=>p.scenes))).map(s=>labels[s]).join(', ')||'scenă meteo generală';return '| '+c.name+' | '+scenes(false)+' | '+scenes(true)+' |';}).join('\n');
const chapter=`
## România și categorii nocturne — versiunea 2026.10.07.2

\`weather-romania.js\` înregistrează un catalog fix pentru 48 de localități: toate reședințele de județ distincte, București, Moreni, Sinaia, Sighișoara, Hunedoara, Turda, Mangalia și Mediaș. Sunt 136 de fotografii reale din Wikimedia Commons, verificate vizual și după proveniență. Pentru București, Brașov, Cluj-Napoca și Timișoara există și șapte filmări locale din Pexels. Cadrele care nu corespundeau localității și câteva imagini prea mici au fost excluse. Pentru Mangalia, cadrul estival din Olimp, parte a municipiului, este folosit numai de la 18°C în sus; seara și noaptea nu îl pot selecta.

Catalogul este local aplicației; nu caută pe Commons/Pexels la utilizare. Numele normalizat trebuie să corespundă și coordonatelor (12 km de centrul orașului), iar țara diferită de România respinge selecția. Coordonatele GPS fără nume se potrivesc doar în limita a 3 km. Un sat apropiat cu alt nume păstrează peisajul său general. Alexandria din Egipt, Arad din Israel și Sfântu Gheorghe din Delta Dunării nu primesc imagini ale orașelor omonime românești.

Fiecare fotografie/film are categorii permise și momentul zilei. Nu se întunecă o fotografie însorită pentru a o transforma în noapte. Fotografiile cu zăpadă sunt rezervate categoriei ninsoare. Dacă nu există un cadru local adecvat, se folosește filmarea meteo generală potrivită. Furtuna și ceața rămân generale pentru toate aceste orașe; ploaia locală există doar în selecțiile Slobozia de zi și Miercurea Ciuc de noapte. Acestea sunt cadre ilustrative, nu camere live sau fotografii luate în momentul prognozei.

Pentru noaptea parțial noroasă există două filme distincte cu nori și lună/stele; pentru noaptea complet acoperită există două filme cu nori denși, gradați pentru noapte, fără stele ori lună adăugată. Luna din film este decorativă, nu măsurarea fazei curente; modulul lunar existent rămâne sursa acelei informații. Variantele însorite/de zi nu intră în aceste două categorii nocturne. Filmele originale și cele 22 adăugate anterior sunt păstrate.

Fotografiile au o deplasare și mărire discretă prin transformări CSS, cu aceleași reguli pentru Animații, mișcare redusă și scroll. La trecerea spre fotografie, filmul vechi este oprit și callback-urile întârziate sunt invalidate; niciun video vechi nu se poate suprapune peste fotografia orașului nou. Varianta rămâne stabilă în aceeași vizită, inclusiv la atingere și la revenirea în oraș. Se încarcă numai cadrul ales, nu întreaga galerie. Un voal discret peste cadrele locale menține lizibilitatea titlului și temperaturii fără schimbarea transparenței cardurilor. Oprirea precipitațiilor decorative golește întregul bitmap, inclusiv marginea rotunjită de raportul fracționar de pixeli; scrollul nu păstrează un strat de particule peste ploaia/ninsoarea filmată ori când utilizatorul oprește Animații.

Cele 11 filme noi din \`assets/weather-video/v4/\` au 22 de MP4-uri: câte o variantă 720×1280 și una HD 1080×1920 sau 2K 1440×2560 potrivit sursei, H.264, 30 cadre/s, opt secunde, fără audio. Au 11 postere proprii WebP. Cele 136 de fotografii sunt decupate vertical în \`assets/weather-romania/v1/\`; rezoluția depinde de materialul disponibil și nu este ridicată artificial la 2K. Originalele disponibile și variantele publice de rezoluție mare sunt arhivate separat în folderul de backup din 7 octombrie.

Proveniența, autorii, dimensiunile și licențele sunt în cele două fișiere \`sources.json\`. Pagina \`weather-credits.html\`, accesibilă în Setări → Despre prin „Credite foto și video”, păstrează titlul, autorul, sursa, licența și indicarea adaptării pentru fiecare fotografie. Adaptările foto păstrează licența originală a imaginii. Referințe: [Creative Commons BY-SA](https://creativecommons.org/licenses/by-sa/4.0/), [Pexels](https://www.pexels.com/license/); fiecare imagine are și legătura către propria versiune a licenței.

Service worker v32 păstrează noile fotografii/postere și fișierele v4 în cache-ul media existent. Plafonul filmărilor rămâne 96 MiB, cu Range offline. Navigarea către credite sau confidențialitate are o rezervă separată, fără să suprascrie documentul meteo offline.

Verificări: \`weather-romania.test.js\` acoperă cele 48 de orașe, combinațiile vreme/zi/noapte, existența fișierelor, orașele omonime străine și stabilitatea selecției. \`weather-romania-footage.test.cjs\` verifică fiecare cadru și îmbinarea celor 22 de MP4-uri pentru salturi de luminanță. \`weather-romania-browser.cjs\` decodează și redă efectiv toate cele 22 de variante. \`weather-romania-photos-browser.cjs\` decodează toate cele 136 de imagini și verifică mișcarea, preferințele, trecerea video/foto, răspunsurile întârziate și cache/Range offline. \`weather-page-cache.test.cjs\` protejează documentul offline după vizitarea paginii de credite. Au trecut și regresiile pentru ore locale, gesturi, căutarea orașelor, UV, clasificarea geografică, cache și dimensiuni de ecran. Nu este un test fizic pe S24 Ultra.

### Cadre foto locale disponibile

Pentru categoriile care lipsesc din tabel se păstrează scena meteo generală. Cele patru orașe cu filme locale au în plus filmele menționate mai sus.

| Localitate | Zi / tranziție | Noapte |
| --- | --- | --- |
${table}

`;
const file=path.join(root,'DESIGN-FUNDALURI.md');let doc=fs.readFileSync(file,'utf8');
if(doc.includes('## România și categorii nocturne'))doc=doc.replace(/\n## România și categorii nocturne[\s\S]+?(?=\n## Lista de orașe)/,'');
fs.writeFileSync(file,doc.replace('Actualizare: 7 octombrie 2026.\n','Actualizare: 7 octombrie 2026.\n'+chapter));
console.log('Documented 48-city coverage and final validation');
