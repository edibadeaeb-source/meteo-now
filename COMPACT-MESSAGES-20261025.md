# Notificări interioare compacte — 25 octombrie 2026

Web 2026.10.25.1, Service Worker v69; app-messages.css?v=2. Android rămâne 1.0.27 / versionCode 28; APK/AAB și rapoartele lor istorice nu se reconstruiesc.

Mai puțin spațiu vertical, pictogramă de 36 px, antet cu oraș și etichetă pe același rând când încap, text cu interlinie mai compactă și suprafață liquid glass. Firul de timp este mai discret. Butonul de închidere păstrează ținta tactilă de 44 px și are spațiu rezervat; textul nu se suprapune peste el. Nu se trunchiază mesajele și nu se impune o înălțime fixă. Preferințele de mișcare și transparență redusă sunt respectate. Animația de intrare/ieșire este păstrată; animația opacității butonului nu îi deplasează poziția verticală.

Verificări browser: 320 / 360 / 412 / 430 px, sfat meteo și confirmare de locație, text mare, titlu și avertizare lungă fără trunchiere. Sfatul de test are 82,36 px la 360/412/430 și 101,78 px la 320; confirmarea scurtă are 60,78 px. Regresiile verifică intrarea/ieșirea, închiderea, înlocuirea mesajelor, izolarea setărilor, mișcarea redusă și comutatorul de animații. Fără erori JavaScript în probele controlate. Nu s-a testat automat pe telefon fizic.

Dovezi: 03-Testare-si-capturi/tests/artifacts-compact-messages-20261025 și testele app-messages-browser.cjs / app-messages-motion.cjs. Codul web este sincronizat cu copia Server Flask; publicarea țintește ambele servicii Render existente. Notificările Android/push, conținutul meteo, AI și widgeturile nu sunt modificate.
