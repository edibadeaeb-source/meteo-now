# METEO NOW — gesturi și glow în AI

Versiune web/server **2026.10.12.6**, Service Worker **v55**, `weather-ai.css?v=5`.

## Comportament

- Gesturile și rotița mouse-ului din AI nu mai ajung la pagina meteo. Derularea nativă a conversației și editarea textului sunt păstrate.
- Reîmprospătarea verifică panourile deschise la începutul, mișcarea și încheierea gestului. Deschiderea AI anulează imediat și un gest început în fundal. Gesturile întrerupte și cele cu mai multe degete sunt anulate.
- Un reflex alb discret traversează întreaga fereastră AI de la stânga la dreapta, inclusiv antetul, butoanele și conversațiile. Caseta „Întreabă-mă” are aceeași trecere albă, puțin mai vizibilă. Nu mai sunt reflexii animate mov/albastru.
- Efectul rulează cât timp nu există text în editor, inclusiv pe o conversație sau în istoric. Se estompează la primul caracter scris și se oprește complet la închidere. Editorul ascuns din istoric nu are propria animație.
- Animațiile folosesc numai transformări și opacitate. Preferința pentru mișcare redusă dezactivează reflexiile în mișcare. Panoul permite derularea pe ambele axe unde există conținut, fără zoom al paginii.

## Verificări

`tests/ai-interface-browser.cjs`: evenimente de atingere în antet, conversație, editor, istoric și fundal; verificarea directă a handlerului global; gest început înaintea deschiderii AI; anulare și atingere cu două degete; reîmprospătare funcțională după închidere; glisare reală în conversație prin protocolul browserului; glow gol/scriere/închidere, mișcare redusă; istoric, răspunsuri întârziate, tastatură, RO/EN, accesibilitate. Dimensiuni: 320×568, 360×800, 412×915, 430×932, 932×430 și 1280×800.

Verificări suplimentare: `ai-conversations.test.cjs`, `mobile-regressions.test.js`, `notification-flows.test.js` (inclusiv sintaxa scripturilor).

Datele meteo și răspunsurile AI sunt simulate în teste; nu sunt trimise mesaje sau notificări reale. Verificările sunt în Edge cu ecran mobil simulat, nu pe telefonul fizic S24 Ultra. Capturile sunt în `03-Testare-si-capturi/tests/ai-interface`.

Schimbarea este web; APK-ul **1.0.23** existent primește noua interfață de pe server, fără reinstalare.
