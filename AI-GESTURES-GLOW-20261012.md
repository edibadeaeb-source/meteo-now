# METEO NOW — gesturi și glow în AI

Versiune web/server **2026.10.12.8**, Service Worker **v57**, `weather-ai.css?v=7`.

## Comportament

- Gesturile și rotița mouse-ului din AI nu mai ajung la pagina meteo. Derularea nativă a conversației și editarea textului sunt păstrate.
- Reîmprospătarea verifică panourile deschise la începutul, mișcarea și încheierea gestului. Deschiderea AI anulează imediat și un gest început în fundal. Gesturile întrerupte și cele cu mai multe degete sunt anulate.
- O lumină albă urmărește doar conturul rotunjit al ferestrei AI, inspirată de Samsung Edge Lighting. Cele trei trasee SVG au interiorul transparent (`fill:none`); niciun luciu nu traversează mijlocul, butoanele sau mesajele.
- Textul de invitație „Întreabă-mă” pulsează discret cu o strălucire albă cât timp editorul este gol. Animația este aplicată editorului gol și moștenită de placeholder; la primul caracter se oprește, fără efect pe mesajul scris.
- Conturul se oprește de asemenea în timpul scrierii și după închidere. Poziția luminii este proporțională cu perimetrul, inclusiv pe colțurile rotunjite și la redimensionare.
- Conturul animă numai poziția trăsăturilor SVG, iar textul animă umbra textului. Preferința pentru mișcare redusă dezactivează ambele efecte. Panoul permite derularea pe ambele axe unde există conținut, fără zoom al paginii.
- Apăsarea lungă pe butoane folosește o singură luminare locală, constantă, fără micșorare, filtre sau animații repetate de luciu. Eliberarea, anularea, ieșirea de pe buton și derularea elimină feedbackul. Meniul nativ la apăsare lungă este blocat doar pentru butoane; editarea textului este păstrată.

## Verificări

`tests/ai-interface-browser.cjs`: evenimente de atingere în antet, conversație, editor, istoric și fundal; verificarea directă a handlerului global; gest început înaintea deschiderii AI; anulare și atingere cu două degete; reîmprospătare funcțională după închidere; glisare reală în conversație prin protocolul browserului; glow gol/scriere/închidere, mișcare redusă; istoric, răspunsuri întârziate, tastatură, RO/EN, accesibilitate. Dimensiuni: 320×568, 360×800, 412×915, 430×932, 932×430 și 1280×800.

`tests/ai-long-press-browser.cjs`: 10 apăsări lungi prin protocolul real de atingere al browserului, câte 1,27 secunde; compararea pixelilor unei zone de sticlă stabile, geometria și filtrele panoului, anulare, ieșirea de pe buton, editarea textului și închidere. Fundalul meteo și animațiile de așteptare sunt înghețate doar în această probă, pentru a izola răspunsul butoanelor.

Verificări suplimentare: `ai-conversations.test.cjs`, `mobile-regressions.test.js`, `notification-flows.test.js` (inclusiv sintaxa scripturilor).

Datele meteo și răspunsurile AI sunt simulate în teste; nu sunt trimise mesaje sau notificări reale. Verificările sunt în Edge cu ecran mobil simulat, nu pe telefonul fizic S24 Ultra. Capturile sunt în `03-Testare-si-capturi/tests/ai-interface`.

Schimbarea este web; APK-ul **1.0.23** existent primește noua interfață de pe server, fără reinstalare.
