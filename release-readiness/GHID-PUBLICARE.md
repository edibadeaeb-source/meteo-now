# Publicarea METEO NOW

Actualizat: 13 octombrie 2026.

Începe cu [CHECKLIST-LANSARE.md](CHECKLIST-LANSARE.md), apoi folosește [TEXTE-MAGAZIN.md](TEXTE-MAGAZIN.md) și [DATA-SAFETY-2026.md](DATA-SAFETY-2026.md). Pachetul Android curent este 1.0.23 / versionCode 24, în `builds/current` din directorul release-ready.

Codul curent este deja publicat pe cele două servicii Render. Nu trebuie reîncărcate manual fișierele web și nu trebuie regenerat pachetul prin PWABuilder pentru această revizie a documentelor.

Verifică în Play Console semnarea aplicației, numărul de versiune disponibil, declarațiile de conținut și cerințele contului. După încărcarea într-un canal de test, verifică versiunea instalată din Play înainte de a trimite pentru producție. În această sesiune nu efectuăm publicarea în magazin.

Programările serverului sunt separate de pachetul Play. Nu copia instrucțiunile vechi care puneau secretul cron în URL. Dacă sunt necesare modificări de programare, verifică întâi joburile existente și folosește antetul de autentificare acceptat de server, fără a publica cheia. Simplul răspuns `/api/ping` nu confirmă executarea joburilor de notificări.
