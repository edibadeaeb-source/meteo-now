# Notificări — versiunea 1.0.19

Actualizare: 6 octombrie 2026. APK versionCode 20, target SDK 36.

## Comportament

- `/api/push/check?secret=<PUSH_CRON_SECRET>` verifică ANM și evenimentele meteo la fiecare apel. Jobul extern trebuie să rămână activ; intervalul recomandat este 15 minute. Alertele nu sunt limitate la ora rezumatului zilnic. Intervalul și livrarea Android pot produce întârzieri.
- Evenimentele folosesc vremea curentă și următoarele ore Open-Meteo: început/sfârșit de ploaie ori ninsoare, furtună, ceață și vânt puternic. Formulările exprimă prognoza, nu certitudinea.
- Sfârșitul precipitațiilor necesită două ore consecutive cu date valide și probabilitate mică. Datele lipsă nu sunt vreme senină.
- Deduplicarea este individuală, pentru localitate și tip de eveniment. Modificarea orei estimate poate genera o actualizare după o oră; vremea persistentă nu se repetă la fiecare verificare. Un episod nou se rearmează după 90 de minute fără un eveniment relevant.
- ANM este filtrat după județul abonamentului. O trimitere nereușită nu este memorată drept livrare reușită. Acceptarea serviciului push nu certifică afișarea efectivă pe telefon.
- Mesajele meteo au TTL de 30 de minute; avertizările ANM, o oră. Telefonul revenit online poate primi un mesaj încă valabil.
- „Trimite o notificare de test” vizează exclusiv abonamentul telefonului solicitant. Are limită de un test pe minut.

## Android și locație

Cererea nativă de permisiune publică un răspuns corelat cu cererea curentă, apoi revine la pagina TWA existentă. Verificarea nu șterge și nu recreează abonamentul. Un rezultat neconfirmat este afișat separat de refuz.

„Urmărește locația mea” păstrează localitatea GPS pentru notificări și când omul consultă alte orașe. O alegere manuală anulează un rezultat GPS vechi aflat în curs. Salvările abonamentului sunt serializate, astfel încât ultima locație să rămână ultima pe server.

Permisiunea de locație în timpul utilizării permite actualizarea la deschidere/revenire și în timpul utilizării. În fundal se utilizează ultima locație sincronizată. Această versiune nu solicită și nu implementează acces GPS permanent în fundal.

## Validare și verificarea pe telefon

Teste automate: `python -B -m unittest discover -s tests -p "test_*.py"`, `node tests/notification-flows.test.js`, `node tests/mobile-regressions.test.js`. Testele folosesc abonamente și date controlate, fără a trimite notificări reale.

1. Instalează APK 1.0.19 peste versiunea existentă, fără ștergerea datelor.
2. Activează notificările și confirmă permisiunea Android. Revenirea trebuie să păstreze aplicația și setările deschise.
3. Apasă „Trimite o notificare de test” și verifică panoul telefonului. Dacă serviciul acceptă testul dar nimic nu apare, verifică permisiunea Android, canalul notificărilor și restricțiile de baterie/conexiune.
4. Activează „Urmărește locația mea”. Consultă alt oraș, apoi revino în aplicație: localitatea GPS trebuie să fie actualizată, fără să folosească rezultatul unei cereri vechi.
5. Alertele automate necesită și rularea jobului extern. Nu testa prin endpointul administrativ `/api/push/test`, deoarece acesta trimite tuturor abonaților.

Cheile VAPID și secretul cron rămân în variabilele de mediu ale serverului. Nu se publică în documentație sau în pachetul sursă Android.
