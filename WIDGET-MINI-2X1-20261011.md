# METEO NOW — widget Mini 2×1

Versiune Android **1.0.21**, versionCode **22**, targetSdk **36**.

- Widget suplimentar, capsulă rotunjită: pictogramă mare în stânga, temperatura curentă, orașul cu pin de localizare și Max/Min când există suficientă înălțime.
- Opt palete după vreme și momentul zilei: zi, noapte, apus, nori, ploaie, furtună, ninsoare, ceață. Reflexii și contur discret; fără animații continue sau buton de actualizare.
- Android 12+: două RemoteViews responsive, praguri 110×40dp și 130×72dp. Înălțimea mică afișează temperatura și localitatea. Pentru Android mai vechi se folosește varianta joasă. Dimensiunea în celule este 2×1, dar spațiul exact depinde de launcher.
- Atingerea corpului deschide orașul widgetului în aplicație. Atingerea numelui deschide configuratorul nativ, cu orașele sincronizate din aplicație și căutare manuală.
- Datele se descarcă o singură dată pe localitate pentru toate dimensiunile. Se reutilizează programarea comună la aproximativ 20 de minute, cache-ul și repornirea după evenimente de sistem. Nu se adaugă permisiuni sau cereri periodice separate pentru acest widget.
- Build release APK/AAB reușit. APK verificat cu apksigner, AAB cu jarsigner; certificatul coincide cu 1.0.20. Instalare peste versiunea existentă, fără ștergerea datelor.
- 1091 aserțiuni în emulator Android API 37: șapte dimensiuni, font 100%/130%/200%, opt teme, temperaturi negative, nume lung, pin de localizare, lipsă date și construire/regresie pentru cele patru widgeturi existente. Imaginile de test folosesc date simulate.

Limită de verificare: nu a fost instalat fizic pe S24 Ultra în această sesiune; adăugarea din selectorul Samsung și apăsările trebuie confirmate pe telefon. Nu s-a încărcat nimic în Play Console.

Sursele publice complete: `android-native/`, salvate pe main și backup. Cheile private rămân exclusiv în proiectul local, fără a intra în arhiva sursă.

Documentația Android pentru dimensiuni și RemoteViews responsive: https://developer.android.com/develop/ui/views/appwidgets/layouts
