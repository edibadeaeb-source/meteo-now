# Fundal de noapte parțial noros — 24 octombrie 2026

Web/server 2026.10.24.2; Service Worker v68; catalog România v4. Android rămâne 1.0.24 și nu se reconstruiește.

Fotografia utilizatorului pentru Moreni arată varianta `partly-cloudy-night-b`: un câmp de stele dintr-o filmare orizontală HD, mărită pentru telefon. Înlocuirea se aplică acelei variante din catalogul comun, nu tuturor cerurilor înnorate și nu datelor meteo.

Noua sursă este [4K Timelapse of Moon and Clouds at Night — Ahmet Gürün](https://www.pexels.com/video/4k-timelapse-of-moon-and-clouds-at-night-34206506/), cu [licența Pexels](https://www.pexels.com/license/) verificată la 24 octombrie 2026. Atribuirea a fost adăugată paginii de credite; restul creditelor și atribuirea furnizorilor meteo rămân intacte.

Sursa reală are 3240×2160 pixeli. Decupajul vertical de 1214×2160 este redus la **1080×1920**, fără a pretinde rezoluție 2K după mărire. Mișcarea este încetinită de două ori și interpolată la 30 fps, cu buclă de 11 secunde și tranziție între capete. Varianta economică are 720×1280 / 24 fps și aproximativ 1 MB. Filmările sunt H.264 fără audio. Fotografia de rezervă JPEG este extrasă din noua filmare.

Noul catalog mapează inclusiv identificatorul vechi spre fișierele `assets/weather-video/v8/`, deci un snapshot păstrat în cache nu reintroduce filmarea veche. Cealaltă variantă de noapte parțial noroasă și variantele de cer complet acoperit sunt păstrate. Nu se adaugă stele, precipitații sau fulgere. Filmarea este ilustrativă; nu reprezintă faza astronomică actuală a Lunii sau o cameră live din oraș.

Verificări: 330 cadre HD și 264 cadre economice, inclusiv îmbinarea buclei; salt maxim de luminanță medie sub 1 pe scala 0–255. Acesta este un control pentru salturi de luminozitate, nu o certificare completă a calității percepute. Ambele variante sunt decodate efectiv în browser mobil la 412×915, cu fotografie de rezervă corespunzătoare, scenă de noapte, păstrarea sursei la atingere și reutilizarea celor două elemente video. Testul de pornire cu snapshot Moreni vechi confirmă selecția v8; testele catalogului și ale celor 48 de orașe românești trec. Datele meteo folosite în browser sunt simulate; nu s-a testat fizic pe S24 Ultra.

Dovezile sunt în `03-Testare-si-capturi/tests/artifacts-night-clouds-20261024`. Nu sunt trimise notificări sau cereri AI plătite pentru aceste verificări.
