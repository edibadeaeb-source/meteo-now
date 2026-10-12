# METEO NOW — reflexul sugestiilor AI

Versiune **2026.10.12.11**, `weather-ai.css?v=10`, Service Worker **v60**.

După versiunea .10, utilizatorul raportează pâlpâire numai pe butoanele cu întrebări predefinite, la glisarea degetului. Confirmarea pe S24 Ultra rămâne necesară după această publicare.

Sugestiile păstrează un singur reflex liquid glass. Textura radială de 160×160 px este permanentă și se deplasează pe un strat separat; nu se reconstruiește gradientul la fiecare coordonată. Opacitatea crește/scade în 180 ms, iar stratul este pregătit constant pentru transform/opacitate. Tranziția veche a pseudo-elementului este înlocuită explicit. Sugestiile nu mai pornesc și a doua bandă albă la fiecare intrare. Celelalte butoane își păstrează efectul anterior. Fundalul panoului, editorul, lumina de pe contur și răspunsurile AI nu sunt schimbate.

Probe:

- `tests/ai-suggestion-glass-browser.cjs`: toate cele șase sugestii pe trei dimensiuni (412×915, 360×800, 430×932), 144 eșantioane de stil prin handlerii reali și trei gesturi tactile native, câte unul pe fiecare dimensiune; textura fixă, stratul luminos mobil, stilurile textului/fundalului/chenarului stabile, stingerea interpolată, fără animație suplimentară sau trimitere accidentală. Stingerea este măsurată sincron cu handlerul real, deoarece durata unui tur CDP poate depăși tranziția de 180 ms.
- `tests/ai-sweep-browser.cjs`: glisări native peste grupurile AI, în ambele sensuri; comparații exacte ale pixelilor panoului/editorului cu efectele active; fără declanșarea întrebărilor sau reîmprospătării meteo.
- `tests/ai-interface-browser.cjs`: conversații, istoric, tastatură, RO/EN, accesibilitate, efecte/mișcare redusă și șase dimensiuni de ecran.
- `tests/notification-flows.test.js`: verificarea sintaxei tuturor scripturilor inline și a fluxurilor existente.

Aceste probe folosesc date simulate în browserul de test, fără mesaje/notificări reale. Versiunea .11 nu a fost verificată pe telefonul fizic sau în emulatorul Android. Aplicația Android folosește interfața de pe server; nu necesită un APK nou.
