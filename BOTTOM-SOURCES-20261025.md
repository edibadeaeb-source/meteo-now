# Subsol meteo și pagină unică de informații — 25 octombrie 2026

Web 2026.10.25.3 / Service Worker v71. Android rămâne 1.0.27 / versionCode 28; nu este necesar un APK nou.

Pe pagina principală mobilă, subsolul afișează numai „OpenWeather · MET Norway · Open-Meteo”, fără etichete sau butoane. Lista de date din subsolul desktop folosește aceleași nume. Atribuirile hărților rămân lângă hărți.

Setări → Despre are un singur buton tactil Confidențialitate (minimum 44 px). Pagina include politica RO/EN și o secțiune pliabilă Surse și credite, cu furnizori, hărți, toate cele 136 fotografii, 43 surse video, autori, licențe și mențiunile adaptării. Nu trebuie deschisă o a doua pagină pentru aceste informații. Nu se încarcă imagini, filmări, fonturi externe sau alte servicii. URL-ul vechi al creditelor rămâne funcțional pentru compatibilitate. Generatorul actualizează ambele pagini din aceleași metadate, fără duplicarea intrărilor la regenerare.

Validare browser: 320/412/430 px, nume furnizori fără legături în subsol, un singur buton în setări, politică și surse accesibile în aceeași pagină, RO/EN, font mare, fără depășiri sau cereri media/externe, fără erori JavaScript. Testele de confidențialitate și navigare offline au trecut. Nu s-a testat automat pe telefon fizic. Fără modificări la permisiuni, notificări, datele meteo sau practica de prelucrare a datelor.

Dovezi: 03-Testare-si-capturi/tests/artifacts-bottom-sources-20261025. Copia Server Flask și documentele pentru lansare sunt sincronizate. Rapoartele originale APK/AAB rămân nemodificate.
