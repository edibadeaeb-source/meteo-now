# METEO NOW — gesturi și glow în AI

Versiune web/server **2026.10.12.9**, Service Worker **v58**, `weather-ai.css?v=8`, `weather-motion.js?v=9`.

## Comportament

- Gesturile și rotița mouse-ului din AI nu mai ajung la pagina meteo. Derularea nativă a conversației și editarea textului sunt păstrate.
- Reîmprospătarea verifică panourile deschise la începutul, mișcarea și încheierea gestului. Deschiderea AI anulează imediat și un gest început în fundal. Gesturile întrerupte și cele cu mai multe degete sunt anulate.
- O lumină albă urmărește doar conturul rotunjit al ferestrei AI, inspirată de Samsung Edge Lighting. Cele trei trasee SVG au interiorul transparent (`fill:none`); niciun luciu nu traversează mijlocul, butoanele sau mesajele.
- Textul de invitație „Întreabă-mă” pulsează discret cu o strălucire albă cât timp editorul este gol. Animația este aplicată editorului gol și moștenită de placeholder; la primul caracter se oprește, fără efect pe mesajul scris.
- Conturul se oprește de asemenea în timpul scrierii și după închidere. Poziția luminii este proporțională cu perimetrul, inclusiv pe colțurile rotunjite și la redimensionare.
- Conturul animă numai poziția trăsăturilor SVG, iar textul animă umbra textului. Preferința pentru mișcare redusă dezactivează ambele efecte. Panoul permite derularea pe ambele axe unde există conținut, fără zoom al paginii.
- Cât timp AI este deschis, rădăcina paginii dezactivează overscroll-ul. Antetul, taburile și sugestiile pe două rânduri acceptă doar glisare verticală, prevenind interpretarea lor ca navigare orizontală a browserului; sugestiile orizontale de pe ecranele mici păstrează `pan-x`. Închiderea restabilește comportamentul paginii.
- Eliberarea degetului în AI nu mai încearcă să repornească filmarea meteo din fundal; recuperarea autoplay-ului prin atingere rămâne disponibilă în pagina meteo.
- Fundalul blurat este pe un strat decorativ separat (`#chatWindow::before`), cu atingerea dezactivată; containerul interactiv nu mai are `backdrop-filter`. Conturul are propria zonă de pictare.
- Butoanele nu mai creează pseudo-elemente cu tranziții de opacitate și nu schimbă fundalul la atingere sau hover. Feedbackul este doar o schimbare locală, imediată, a chenarului. Eliberarea, anularea, glisarea peste 6 px (inclusiv în interiorul butonului) și derularea elimină feedbackul. Meniul nativ la apăsare lungă este blocat doar pentru butoane; editarea textului este păstrată.

## Verificări

`tests/ai-interface-browser.cjs`: evenimente de atingere în antet, conversație, editor, istoric și fundal; verificarea directă a handlerului global; gest început înaintea deschiderii AI; anulare și atingere cu două degete; reîmprospătare funcțională după închidere; glisare reală în conversație prin protocolul browserului; glow gol/scriere/închidere, mișcare redusă; istoric, răspunsuri întârziate, tastatură, RO/EN, accesibilitate. Dimensiuni: 320×568, 360×800, 412×915, 430×932, 932×430 și 1280×800.

`tests/ai-sweep-browser.cjs`: glisări reale în ambele sensuri peste antet, taburi și sugestii, cu fundalul fotografic meteo și animațiile contur/text active (decodarea video este exclusă din această probă SwiftShader); hover păstrat după atingere; verifică izolarea blurului, lipsa straturilor de apăsare, geometria, lipsa reîmprospătării și activării accidentale. Compară separat pixelii de sticlă cu animațiile AI active, după ascunderea fundalului meteo doar în acea probă.

`tests/ai-long-press-browser.cjs`: 10 apăsări lungi prin protocolul real de atingere al browserului, câte 1,27 secunde; compararea pixelilor unei zone de sticlă stabile, geometria și filtrele panoului, anulare, ieșirea de pe buton, editarea textului și închidere. Fundalul meteo și animațiile de așteptare sunt înghețate doar în această probă, pentru a izola răspunsul butoanelor.

Verificări suplimentare: `ai-conversations.test.cjs`, `mobile-regressions.test.js`, `notification-flows.test.js` (inclusiv sintaxa scripturilor).

Datele meteo și răspunsurile AI sunt simulate în teste; nu sunt trimise mesaje sau notificări reale. Verificările sunt în Edge cu ecran mobil simulat, nu pe telefonul fizic S24 Ultra. Capturile sunt în `03-Testare-si-capturi/tests/ai-interface`.

Schimbarea este web; APK-ul **1.0.23** existent primește noua interfață de pe server, fără reinstalare.
