# METEO NOW — AI: sticlă stabilă și reflexe la atingere

Versiune web/server **2026.10.12.10**, Service Worker **v59**, `weather-ai.css?v=9`, `ai-glass.js?v=1`.

## Problema raportată

Corecția 2026.10.12.9 a trecut probele desktop, dar utilizatorul a raportat în continuare pâlpâirea întregului panou AI și a casetei de scriere pe S24 Ultra. Reflexul de pe butoane trebuie păstrat. Telefonul fizic nu este conectat la calculator; probele locale nu reprezintă o confirmare pe S24.

## Comportament final

- Nici containerul AI, nici stratul său decorativ nu mai folosesc `backdrop-filter`. La deschidere, cadrul video sau fotografia meteo deja încărcată se copiază într-un bitmap opac, estompat o singură dată, peste care rămâne nuanța mov-albastră a sticlei. Nu se descarcă altă imagine și nu se serializează date ale utilizatorului.
- Bitmapul nu se redesenează la atingere, hover, derulare sau schimbarea tabului AI. Redimensionarea reală pe lățime îl adaptează; închiderea îi eliberează memoria. Redeschiderea captează vremea curentă, reutilizând același element. Media absentă sau canvas indisponibil păstrează un fundal stabil.
- Reflexul liquid glass al butoanelor este păstrat: o trecere albă la intrarea pe buton și o lumină radială care urmărește degetul. Mișcarea în interiorul butonului nu îl mai dezactivează. Evenimentele tactile continuă urmărirea și după anularea Pointer Events de către derularea nativă. În Chrome Android, `pointercancel` și `pointerleave` pot sosi după `touchmove`; ele nu mai sting reflexul cât timp degetul este încă pe ecran. `touchend`/`touchcancel`, închiderea și pierderea focusului îl eliberează. Reflexele sunt limitate la zona fiecărui buton; nu există filtre animate pe panou.
- Textul real și placeholderul editorului nu mai au animații. Strălucirea albă se află pe un text decorativ separat, cu `aria-hidden` și `pointer-events:none`, animând doar opacitatea. Eticheta și placeholderul nativ rămân accesibile și editabile. La primul caracter, glow-ul se oprește.
- Lumina albă continuă să urmărească numai conturul rotunjit. La mișcare redusă, atât conturul, cât și efectele de text/butoane sunt oprite.
- Izolarea fundalului, istoricul conversațiilor, derularea nativă, tastatura, RO/EN și blocarea reîmprospătării paginii meteo rămân active. Antetul/taburile nu declanșează navigarea orizontală a browserului, iar rândurile de sugestii de pe ecrane mici își păstrează derularea orizontală.

## Probe

- `tests/ai-sweep-browser.cjs`: 24 eșantioane pe șase glisări reale, în ambele sensuri, peste antet/taburi/sugestii; geometrie și bitmap nemodificate; bitmap opac; lipsa blurului CSS; reflex păstrat și coordonate actualizate în interiorul butonului; comparații de pixeli în panou și în zona liberă a editorului, cu animațiile AI active și fundalul meteo fotografic activ; închidere/eliberare și recapturare la redeschidere.
- `tests/ai-interface-browser.cjs`: conversații, istoric, răspunsuri întârziate, editare, accesibilitate, RO/EN, tastatură, glow separat de textarea, izolare tactilă și șase dimensiuni: 320×568, 360×800, 412×915, 430×932, 932×430, 1280×800.
- `tests/ai-long-press-browser.cjs`: zece atingeri de 1,27 secunde; reflexul de intrare nu se repetă în timpul ținerii, pixelii sticlei și geometria rămân stabili, anularea și selectarea textului funcționează.
- `tests/ai-android-browser.cjs`: Chrome 155.0.8059.39 în emulator Android SDK 37, 360×672 CSS px, DPR 2; șase glisări native, geometrie/bitmap stabile, reflex păstrat, glow separat, scriere și închidere/eliberare, fără erori JavaScript. Testul folosește fotografia meteo locală și nu verifică telefonul fizic sau wrapperul APK.
- `tests/test_security.py`: 26 teste; noul modul `ai-glass.js` este permis explicit ca resursă publică, iar fișierele private rămân inaccesibile.
- Regresiile mobile, sintaxa scripturilor, fluxurile notificărilor și stocarea video sunt verificate separat. Datele meteo și răspunsurile AI sunt simulate; probele nu trimit notificări sau mesaje reale.

Aplicația Android **1.0.23** încarcă interfața de pe server; această schimbare nu cere un APK nou. Confirmarea finală pe telefonul S24 rămâne necesară.
