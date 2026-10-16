# Programări notificări — mutarea cheii din URL

Pregătire concretă, **neaplicată încă în cron-job.org**. Apelurile existente funcționează; nu le oprim înainte de înlocuire. Nu copia valori de chei în conversație sau în Git.

## Configurația țintă

| Job | URL fără cheia privată | Ritm / oră observată |
|---|---|---|
| Avertizări și evenimente meteo | https://meteo-now.onrender.com/api/push/check | aproximativ 15 minute |
| Rezumat dimineață | https://meteo-now.onrender.com/api/push/rezumat?moment=dimineata | 07:30 Europe/Bucharest |
| Rezumat seară | https://meteo-now.onrender.com/api/push/rezumat?moment=seara | 20:00 Europe/Bucharest |

Acestea sunt momentele observate în jurnale, nu o citire a configurației din cron-job.org. Verifică fusul orar real al fiecărui job înainte de a schimba orele. Nu crea un job `meteo` duplicat: `check` include deja evenimentele meteo.

Pentru toate trei, secțiunea de antete HTTP trebuie să conțină **X-Cron-Secret**, cu valoarea cheii private configurate în Render ca **PUSH_CRON_SECRET**. Alternativa acceptată este Authorization: Bearer urmat de cheia privată. Nu utiliza ambele mecanisme în paralel fără motiv.

## Ordine fără întrerupere

1. În fiecare job existent, adaugă antetul folosind cheia actuală, apoi elimină numai parametrul `secret` din URL. Păstrează `moment` la rezumate și restul programării. Nu crea încă o copie activă a jobului.
2. Verifică la execuția programată HTTP 200 **și corpul JSON**: autentificarea poate reuși chiar dacă o sursă meteo este temporar indisponibilă. Nu folosi `/api/push/test` pentru această verificare: ar trimite tuturor abonaților.
3. După migrarea tuturor apelanților, generează o cheie nouă, aleatoare, de minimum 32 caractere și păstreaz-o numai în configurările private. Actualizează serviciile autorizate și antetele joburilor într-o fereastră scurtă controlată; cu un singur secret acceptat, rotirea nu este atomică între sisteme și pot exista execuții 403 în timpul tranziției. Pregătește toate modificările înainte de aplicare.
4. Verifică următoarea execuție, fără a declanșa mesaje de test generale. Abia după confirmare poate fi eliminată compatibilitatea cu secretul în URL din server. În acest audit compatibilitatea este păstrată.

Serviciul legacy rămâne funcțional, dar nu trebuie să dubleze automat joburile principale fără o decizie explicită. Cheia veche poate exista în jurnalele istorice private până la expirarea retenției platformei; formatul nou de jurnal nu le rescrie retroactiv.

Nu am extras, afișat sau rotit cheia și nu am modificat joburile externe în această sesiune. Controlul browserului este blocat de o eroare tehnică a uneltei, iar căutarea integrărilor nu a identificat un conector cron-job.org utilizabil.
