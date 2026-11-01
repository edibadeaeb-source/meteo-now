# Render și programările notificărilor — 1 noiembrie 2026

## Cauză confirmată

Jurnalul Render pentru meteo-now indică suspendare la 31 octombrie 2026, 18:01:20 UTC, cu actorul „Free Tier Usage Exceeded”. Serviciul a fost reluat automat la 1 noiembrie, 01:29:41 UTC. În timpul verificării, pagina principală și manifestul răspund cu HTTP 200. Eroarea 503 din mesajul cron-job.org este compatibilă cu suspendarea serviciului; nu este remediată prin modificarea codului endpointului.

Render oferă 750 ore gratuite comune întregului workspace, pe lună calendaristică. Două servicii gratuite care rulează simultan consumă împreună acest buget. Orele se resetează lunar, dar o programare dezactivată de cron-job.org după eșecuri repetate necesită reactivare separată. Referințe consultate: https://render.com/docs/free și https://cron-job.org/en/faq/.

## Politica cerută de utilizator

- METEO NOW rămâne serviciul principal: srv-d9usvf3m8hqs73dioq00, meteo-now.onrender.com.
- meteo-vechi este rezervă oprită manual: srv-d9jmnbrtqb8s73amvl4g, meteo-targoviste.onrender.com. Nu îl ștergem și nu schimbăm planul pe unul plătit.
- Codul se salvează în continuare pe main și backup și în copiile locale. Nu este necesar ca un al doilea server să ruleze permanent pentru acest backup.
- Publicările și verificările curente țintesc doar meteo-now. Nu se reia rezerva și nu se fac cereri publice de verificare către ea fără o cerere explicită de reactivare.
- Verificarea release-package-audit.py nu mai contactează rezerva. Starea suspendării se verifică separat prin metadatele Render, fără a trezi serviciul.

Suspendarea a fost efectuată de utilizator și confirmată prin Render: meteo-vechi are suspended=suspended, suspenders=[user], updatedAt=2026-11-01T10:57:54.597518Z. meteo-now are suspended=not_suspended, fără suspenders. Starea programărilor cron-job.org rămâne de verificat separat.

## Programările externe

Utilizatorul a identificat două joburi cu roluri diferite: ping la 10 minute și /api/push/check la 15 minute. Nu sunt dubluri. Se reactivează pentru meteo-now.onrender.com și se verifică rezultatul HTTP din Test run. Confirmarea executării rămâne în așteptare.

Se verifică joburile existente în cron-job.org. Joburile principalului serviciu trebuie reactivate numai după confirmarea că adresa și autentificarea sunt corecte. Nu se înlocuiește cheia cu URL-ul redat trunchiat în e-mail. Dacă există joburi identice, se compară programul și parametrii înainte de a decide care rămâne activ. Joburile pentru rezervă trebuie să rămână dezactivate.

Nu sunt incluse chei sau URL-uri cu secrete în documentație. Nu au fost trimise notificări reale sau executate verificările protejate ca parte a diagnosticului inițial.

## Acces disponibil la diagnostic

Integrarea Render permite citirea stării și evenimentelor, dar nu oferă operația suspend. Controlul browserului și alternativa Windows nu au putut porni, cu eroare internă de inițializare. Nu există o autentificare locală Render CLI sau o cheie API configurată pentru o operație alternativă. Suspendarea și modificarea programărilor nu trebuie raportate ca efectuate doar pe baza unui plan sau a confirmării utilizatorului; se verifică rezultatul real.
