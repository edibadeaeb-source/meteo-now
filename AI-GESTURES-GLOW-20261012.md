# METEO NOW — gesturi și glow în AI

Versiune web/server **2026.10.12.4**, Service Worker **v53**, `weather-ai.css?v=3`.

## Comportament

- Gesturile și rotița mouse-ului din AI nu mai ajung la pagina meteo. Derularea nativă a conversației și editarea textului sunt păstrate.
- Reîmprospătarea verifică panourile deschise la începutul, mișcarea și încheierea gestului. Deschiderea AI anulează imediat și un gest început în fundal. Gesturile întrerupte și cele cu mai multe degete sunt anulate.
- Ecranul de început are două reflexii discrete mov/albastru. Acestea se estompează la primul caracter scris și nu rulează în istoric, conversație sau cu AI închis.
- Caseta „Întreabă-mă” are un halo și o strălucire fină pe textul de invitație. Revine când caseta este goală, inclusiv într-o conversație. Se oprește în timpul scrierii, în istoric și după închidere.
- Animațiile folosesc numai transformări și opacitate. Preferința pentru mișcare redusă păstrează efectele statice. Panoul permite derularea pe ambele axe unde există conținut, fără zoom al paginii.

## Verificări

`tests/ai-interface-browser.cjs`: evenimente de atingere în antet, conversație, editor, istoric și fundal; verificarea directă a handlerului global; gest început înaintea deschiderii AI; anulare și atingere cu două degete; reîmprospătare funcțională după închidere; glisare reală în conversație prin protocolul browserului; glow gol/scriere/închidere, mișcare redusă; istoric, răspunsuri întârziate, tastatură, RO/EN, accesibilitate. Dimensiuni: 320×568, 360×800, 412×915, 430×932, 932×430 și 1280×800.

Verificări suplimentare: `ai-conversations.test.cjs`, `mobile-regressions.test.js`, `notification-flows.test.js` (inclusiv sintaxa scripturilor).

Datele meteo și răspunsurile AI sunt simulate în teste; nu sunt trimise mesaje sau notificări reale. Verificările sunt în Edge cu ecran mobil simulat, nu pe telefonul fizic S24 Ultra. Capturile sunt în `03-Testare-si-capturi/tests/ai-interface`.

Schimbarea este web; APK-ul **1.0.23** existent primește noua interfață de pe server, fără reinstalare.
