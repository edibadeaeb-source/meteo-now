# METEO NOW — aceleași condiții în aplicație și în toate widgeturile

Android **1.0.22**, versionCode **23**, targetSdk **36**. Web/server **2026.10.11.3**.

## Cauza confirmată

Pentru aceleași coordonate Moreni (44.983, 25.644), înainte de corecție aplicația returna WMO 63 / ploaie, prin condiția MET Norway, iar widgetul interoga direct OpenWeather și returna `icon=nor`, `fundal=noapte`, „Cer acoperit de nori”. Android transforma apoi norul în lună cu nor. Nu era o eroare de desenare a capsulei noi.

## Corecție

- `/api/widget` proiectează același rezultat `WeatherService.forecast` folosit de `/api/weather/forecast`, inclusiv temperatura curentă, condiția WMO, zi/noapte și proveniența. Nu mai cere o a doua condiție OpenWeather separată. Rezervele către furnizori sunt gestionate de serviciul comun.
- Cache-ul separat de cinci minute păstrează numai avertizările ANM. Condiția curentă trece prin cache-ul comun pe coordonate, fără o copie suplimentară care să înghețe vremea widgetului. O eroare totală întoarce HTTP 502, ca telefonul să păstreze ultima prognoză validă în locul unui răspuns gol.
- Ploaia, burnița, lapovița, ninsoarea, aversele, furtuna și ceața au prioritate față de apus/noapte, atât în pictograme cât și în culorile widgeturilor cu fundal meteo. Lapovița are pictogramă proprie. Cerul complet noros rămâne nor; luna cu nor se folosește pentru parțial noros noaptea.
- Corecția comună se aplică tuturor celor cinci variante: Acum, Detalii, Prognoză, Transparent și Mini 2×1. Configurarea orașelor, apăsările și programarea comună rămân intacte.
- Toate previzualizările, inclusiv layoutul scund 2×1, afișează **Vremea mea**. După configurare se afișează orașul ales.
- Actualizarea automată rămâne aproximativ la 20 de minute, în funcție de restricțiile Android. Aceeași sursă nu înseamnă că o prognoză actualizată acum și una încă neactualizată au obligatoriu același instantaneu.

## Verificare

- 100 teste Python trecute, inclusiv 9 pentru cazul Moreni, compatibilitatea endpointurilor, fenomene zi/noapte/apus, fusul New York, cache-ul avertizărilor și păstrarea ultimei prognoze valide la erori.
- 1944 aserțiuni în emulator Android API 37: randare pe șapte dimensiuni / trei scale de font, 26 coduri de precipitații/ceață × opt teme × zi/noapte, comparația pictogramei de ploaie randate efectiv în toate cele cinci widgeturi, noros complet, JSON vechi și cele șase layouturi de previzualizare.
- APK/AAB release semnate și verificate. APK-ul se instalează peste versiunea precedentă, cu aceeași semnătură și fără ștergerea datelor. Nu s-a încărcat nimic în Play Console și nu s-a testat fizic pe S24 Ultra în această sesiune.
- Sursele complete Android sunt salvate în `android-native/`, fără chei de semnare sau configurație privată. Versiunea anterioară este arhivată în `archive/1.0.21/`.
