# Limite pentru răspunsurile AI

Web/server 2026.10.17.3, Service Worker v66; Android rămâne 1.0.23.

Utilizatorul a confirmat că are deja bugetul Claude și dorește răspunsuri limitate pentru prevenirea abuzului. Nu schimbăm furnizorul, creditul sau setările financiare ale contului. Migrarea viitoare la un furnizor gratuit nu este inclusă în această modificare.

## Comportament

- Răspunsurile au maximum **120 de cuvinte** și **2.000 de caractere**. Un cuvânt este o secvență fără spațiu; spațiile Unicode sunt recunoscute. Limita de caractere acoperă și șirurile fără spații.
- Instrucțiunea cere în mod normal 1–3 propoziții, cu aceeași limită pentru română și engleză, inclusiv când utilizatorul solicită texte foarte lungi.
- Serverul aplică limita după combinarea tuturor blocurilor de text, indiferent de instrucțiunile utilizatorului sau parametrii suplimentari din cerere.
- Cererea către Claude are maximum **600 tokenuri de ieșire**, față de 2.000 anterior. Tokenurile nu sunt cuvinte; această limită reduce generarea facturabilă pe răspuns, iar limita de cuvinte controlează textul livrat.
- Dacă răspunsul depășește limitele sau furnizorul indică oprire la limita de tokenuri/context, păstrăm ultima propoziție completă disponibilă. Dacă nu există una, fragmentul limitat are semnul „…”. Nu facem o cerere suplimentară de continuare sau rescriere.
- Se păstrează modelul, datele meteo din aplicație, istoricul, interfața și protecțiile existente: 6 cereri/minut și 30/zi/IP, 20/minut și implicit 200/zi/serviciu, două cereri AI simultane.

Aceste protecții reduc abuzul, dar nu reprezintă o garanție a costului lunar: se facturează și contextul de intrare, contoarele sunt separate pe servicii și se resetează la repornire. Nu am trimis cereri AI plătite în testele automate.

## Validare

Teste cu răspunsuri furnizor simulate: RO/EN, exact 120 de cuvinte, depășire în mai multe blocuri, spații Unicode, șir fără spații, oprire la tokenuri și tentativă de suprascriere prin parametrii clientului. Testele de context și securitate verifică păstrarea comportamentului existent.

Referință oficială: [Anthropic — stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons), consultată la 17 octombrie 2026. Limita finală de cuvinte este implementată local și poate fi reutilizată la o integrare viitoare cu alt furnizor.
