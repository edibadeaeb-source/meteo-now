# Android METEO NOW 1.0.26

Copie completă a surselor native active, versionCode 27, targetSdk 36. Proiectul de lucru rămâne în `01-Surse-active/METEO Tgv - Google Play package (1)/source`.

Adaugă widgetul **METEO NOW · Mini 2×1**, fără schimbarea celor patru widgeturi existente. Toate folosesc același configurator nativ de oraș, cache pe localitate și o singură actualizare WorkManager la aproximativ 20 minute. Economisirea bateriei poate amâna actualizările.

Nu include chei de semnare, conturi de serviciu, configurație locală sau APK-uri. Semnarea folosește fișierul privat `keystore.properties`, exclus din Git. Build-ul debug are identificator și FileProvider separate pentru a nu suprascrie aplicația de pe telefon/emulator.

Testare: `gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest`, apoi instalarea celor două APK-uri de test și `adb shell am instrument -w com.onrender.meteo_targoviste.twa.widgetqa.test/com.onrender.meteo_targoviste.twa.widget.WidgetRenderingInstrumentation`.

Verificarea include randarea pe emulator Android API 37, 7 dimensiuni × 3 scale de font × 8 teme, temperaturi negative, nume lung, localizare, stare offline și construirea celor patru widgeturi existente. Testul de randare utilizează date simulate; nu reprezintă o măsurare a vremii reale. Nu a fost testat fizic pe S24 Ultra în această sesiune. Numărul final de aserțiuni este în validarea buildului.

Corecții 1.0.22: toate cele cinci widgeturi folosesc codul WMO al aplicației. Ploaia, ninsoarea, lapovița, furtuna și ceața au prioritate față de noapte sau apus; noros complet rămâne noros. Toate previzualizările afișează „Vremea mea”. Vezi `../WIDGET-CONSISTENCY-20261011.md`.

Corecții 1.0.23: toate cele cinci metadate `updatePeriodMillis` sunt zero. Actualizarea periodică este gestionată numai de WorkManager-ul comun, fără programarea paralelă la 30 de minute. Testul Android verifică toate cele cinci metadate. Vezi `../PERFORMANCE-AUDIT-20261012.md`.

Corecții 1.0.24: widget opac adaptat înălțimii disponibile, detalii fără suprapuneri, mini 2×1 cu corp vizibil mai scund și opt palete cu contrast crescut. Test Android: 2.076 aserțiuni. Vezi ../WIDGET-MESSAGES-20261024.md.

Corecții 1.0.25: Mini 2×1 are orașul sus, temperatura centrată și min/max jos; testele verifică pozițiile și încadrarea textului la toate dimensiunile și scalele de font. Vezi ../CAPSULE-CENTER-20261024.md.

Corecții 1.0.26: Mini 2×1 are orașul și min/max pe toată lățimea, cu iconița și temperatura într-un grup central; 3180 verificări în emulator acoperă pozițiile, încadrarea și regresiile pentru toate widgeturile. Vezi ../CAPSULE-REDESIGN-20261024.md.
