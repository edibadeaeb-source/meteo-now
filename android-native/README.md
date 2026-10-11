# Android METEO NOW 1.0.21

Copie completă a surselor native active, versionCode 22, targetSdk 36. Proiectul de lucru rămâne în `01-Surse-active/METEO Tgv - Google Play package (1)/source`.

Adaugă widgetul **METEO NOW · Mini 2×1**, fără schimbarea celor patru widgeturi existente. Toate folosesc același configurator nativ de oraș, cache pe localitate și o singură actualizare WorkManager la aproximativ 20 minute. Economisirea bateriei poate amâna actualizările.

Nu include chei de semnare, conturi de serviciu, configurație locală sau APK-uri. Semnarea folosește fișierul privat `keystore.properties`, exclus din Git. Build-ul debug are identificator și FileProvider separate pentru a nu suprascrie aplicația de pe telefon/emulator.

Testare: `gradlew.bat :app:assembleDebug :app:assembleDebugAndroidTest`, apoi instalarea celor două APK-uri de test și `adb shell am instrument -w com.onrender.meteo_targoviste.twa.widgetqa.test/com.onrender.meteo_targoviste.twa.widget.WidgetRenderingInstrumentation`.

Ultima verificare: 1091 aserțiuni pe emulator Android API 37, 7 dimensiuni × 3 scale de font × 8 teme, temperaturi negative, nume lung, localizare, stare offline și construirea celor patru widgeturi existente. Testul de randare utilizează date simulate; nu reprezintă o măsurare a vremii reale. Nu a fost testat fizic pe S24 Ultra în această sesiune.
