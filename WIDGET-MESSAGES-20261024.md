# Widgeturi și mesaje în aplicație — 24 octombrie 2026

Android 1.0.24 / versionCode 25 / targetSdk 36. Web/server 2026.10.24.1, Service Worker v67.

## Referințe și modificări

Au fost inspectate cele două fotografii și filmarea de 4,63 secunde din `03-Testare-si-capturi/Screenshot S24 ULTRA`. Filmarea arată un cerc care se extinde într-un mesaj și revine la cerc la închidere.

- Widgetul opac cu detalii are temperatură, descriere și min/max într-o zonă separată de cele trei detalii de jos. Etichetele „Resimțită”, „Umiditate” și „Vânt” au valori separate și panouri cu contrast mai bun. Două variante RemoteViews adaptează aranjarea pentru înălțimi mici și normale, fără suprapunerea min/max peste detalii. Widgetul transparent rămâne neschimbat.
- Mini 2×1 păstrează metadatele grilei. Corpul vizibil este cu 8 dp mai scund în varianta normală, respectiv 4 dp în cea foarte mică. Cele opt palete meteo au culori mai profunde, reflexie albă mai discretă și text alb cu umbră ușoară. Se păstrează min/max, orașul, pictograma WMO și deschiderea orașului potrivit.
- `app-messages.js` și `app-messages.css` oferă același efect de cerc → mesaj extins → cerc pentru mesajele meteo, feedbackul de localizare și confirmările din setări. Mesajele folosesc în continuare suprafața liquid glass. Animația durează aproximativ 680 ms la apariție și 380 ms la închidere, fără animarea blurului sau mutarea conținutului paginii.
- Preferința de animații dezactivate și `prefers-reduced-motion` sunt respectate. Sunt păstrate închiderea prin X, atingere, Escape și glisare în sus; mesajele noi nu sunt închise de temporizatorul unui mesaj vechi. Mesajele din setări stau în interiorul dialogului, fără activarea fundalului.

Notificările Android din bara sistemului, permisiunile, locația, furnizorii, AI-ul, sincronizarea orașelor și frecvența de actualizare a widgeturilor nu sunt schimbate. Etichetele persistente de stare și ferestrele de permisiune nu devin mesaje temporare.

## Verificări și livrare

Randare pe emulator Android, cu date simulate: **2.076 aserțiuni**, inclusiv cele cinci widgeturi, opt teme, temperaturi negative, oraș lung, șapte dimensiuni ale capsulei, trei scale de font și widgetul opac la 250×110, 300×180 și 390×210 dp. Nu reprezintă certificarea tuturor launcherelor sau o probă fizică pe S24 Ultra.

Verificările în browser acoperă lățimi 320/412/430 px, stările animației, închiderea, înlocuirea mesajelor, izolarea setărilor și preferințele de mișcare. Capturile sunt dovezi de test cu date simulate, nu capturi finale pentru magazin.

APK și AAB semnate cu certificatul existent; versiunea Android nouă este necesară pentru modificările widgeturilor. La instalare se actualizează aplicația existentă fără dezinstalare. Buildul anterior este păstrat în `builds/archive/1.0.23`; fișierele curente și validarea se găsesc în `builds/current`.
