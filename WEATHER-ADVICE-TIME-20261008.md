# METEO NOW — mesaje în ora locală, 2026.10.08.2

## Problema

Captura WhatsApp Image 2026-10-08 at 00.49.58.jpeg arată Moreni la 00:48,
cu mesajul «Apusul e peste 40 de minute». Contextul mesajelor folosea un obiect
solar global, completat asincron din alt flux decât prognoza mobilă. Răspunsurile
întârziate pentru orașul anterior puteau modifica acest obiect fără verificarea
coordonatelor, iar mesajul programat nu revalida datele la afișare.

## Corecție

- Mesajele mobile folosesc temperatura curentă, condițiile, UV, vântul,
  precipitațiile și datele zilnice din prognoza afișată pentru coordonatele LOC.
  Valorile istorice suplimentare rămân disponibile numai pentru același oraș.
- Fusul IANA al orașului și data locală aleg răsăritul/apusul din ziua potrivită.
  Calculul compară cifre locale normalizate, fără interpretarea lor ca ore ale
  telefonului. Offsetul furnizorului rămâne rezervă când fusul lipsește.
- Apusul este anunțat doar în timpul zilei și în ultima oră înainte de apus.
  Indicatorul pentru ora locală acoperă zilele/nopțile polare sau orele solare
  absente. Datele expirate ori solare fără coordonate nu dau numărătoare inversă.
- Pe desktop, orele OWM sunt etichetate cu coordonatele cererii și data lor
  locală este verificată. Răspunsurile OWM și contextul extins pentru un oraș
  părăsit sunt ignorate înainte să modifice DOM-ul sau contextul solar.
- Contextul se golește la schimbarea coordonatelor. Prognoza mobilă îl
  completează fără cereri noi. Mesajul și ora se recalculează înainte de afișare,
  inclusiv după suspendarea timerului în fundal. Nu se arată în fundal.
- Mesajele despre UV/zi frumoasă cer confirmarea că este zi. Textele neutre și
  cele de căldură au variante de noapte în română și engleză; avertizările rămân.
- Service worker: net-v42. Backendul, AI-ul și stilurile nu sunt modificate.

## Verificări

- Reproducerea Moreni 00:48 cu apusul NYC rămas la +40 minute: niciun mesaj
  despre apus sau soare. Temperatura din mesaj este 13°C, aceeași din ecran.
- Același moment UTC în NYC: ora locală 17:48, mesajul corect la 40 minute de
  apusul propriu. Revenirea în Moreni elimină acel context.
- Timer suspendat peste apus, variante RO/EN, căldură nocturnă, date polare,
  lipsa prognozei proprii, solar desktop expirat și ambele răspunsuri întârziate.
- Browser la dimensiunea S24 Ultra: popup nocturn, temperatura curentă,
  închiderea popupului și respingerea datelor solare de la alt oraș.
- Regresii: notificări/sintaxă, hărți/climă, pictograme orare și fusuri orare.
- Captură: 03-Testare-si-capturi/tests/weather-advice/moreni-night-0048.png.
  Verificare simulată în browser; nu s-a testat fizic pe telefon.
