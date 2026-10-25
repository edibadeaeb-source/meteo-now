# Interfață minimalistă și simboluri notificări — 25 octombrie 2026

Web 2026.10.25.2, Service Worker v70; Android rămâne 1.0.27 / versionCode 28. Nu este necesar un APK nou.

Notificări: emoji-ul de ceață care apare încadrat pe Samsung este înlocuit cu ☁️; pentru ninsoare folosim ❄️. Titlul rămâne oraș + simbol, iar fenomenul și momentul sunt scrise în corpul mesajului. Testele acoperă evenimentele curente/viitoare, rezumatele și avertizările în RO/EN. Aspectul exact al emoji-urilor este desenat de sistemul telefonului; nu a fost validat automat pe S24 Ultra. Notificările deja livrate nu sunt rescrise.

Interfață: eliminat cardul mobil „Aici măsurăm noi”, inclusiv pentru Târgoviște. Eliminată lista duplicată de surse din zona superioară desktop. Explicațiile despre senzori și tehnologiile de implementare nu mai apar în Despre, în textul introductiv sau în prezentarea din subsol. Pe mobil rămân jos legăturile Surse și credite / Confidențialitate; desktop păstrează atribuirea în subsol. Creditele hărților rămân lângă hărți.

Credite: 136 fotografii grupate în 48 localități și 43 surse video, numai text și linkuri, cu autor, titlu, licență și mențiunea adaptării. Nici pagina veche nu încorpora fotografiile; reorganizarea reduce HTML-ul de la 109.290 la 63.855 octeți. Nu s-au eliminat fundalurile folosite de aplicație. Paginile de informații nu cer imagini, filmări, fonturi sau servicii externe la deschidere. Fișierele CSS/JS comune sunt incluse în cache-ul interfeței și în lista explicită de fișiere publice.

Confidențialitate: aceleași 74 paragrafe și elemente de listă păstrate integral în RO/EN; doar prezentarea este reorganizată în șapte secțiuni per limbă. Data reviziei conținutului, 17 octombrie 2026, rămâne neschimbată. Furnizorii, retenția AI, localizarea, notificările și drepturile utilizatorului sunt în continuare accesibile. Noua prezentare nu schimbă practica de prelucrare a datelor.

Verificare: browser la 320/412/430 px, comutare RO/EN, extindere surse și politică, nume lungi, font mare, cardul eliminat pentru Târgoviște, credite hărți păstrate, zero cereri media/externe pentru paginile informative și fără erori JavaScript. 8 teste de titluri, 14 de livrare notificări, 26 de securitate și 3 de confidențialitate trecute. Testul de navigare/cache confirmă păstrarea separată a aplicației offline și a paginilor de informații. Nu s-au trimis notificări reale utilizatorilor ca parte a testării.

Dovezi: 03-Testare-si-capturi/tests/artifacts-minimal-interface-20261025. Sursele și documentele sunt sincronizate cu Server Flask; publicarea țintește ambele servicii Render existente, cu salvare pe main și backup. Rapoartele istorice ale APK/AAB rămân nemodificate.
