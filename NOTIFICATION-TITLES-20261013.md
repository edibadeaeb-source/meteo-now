# METEO NOW — titluri de notificări

Versiune web/server **2026.10.13.3**, Service Worker **v63**. Utilizatorul a ales combinația dintre numele simplu al orașului pentru actualizări obișnuite și o propoziție adaptată evenimentului pentru schimbările meteo.

## Comportament

- Rezumatele de dimineață/seară au titlul **MORENI**, **TÂRGOVIȘTE** sau numele integral al localității cu majuscule. Corpul precizează „Astăzi”/„Mâine”, starea vremii, maxima/minima și sfatul existent. Starea vremii a fost mutată în corp pentru a nu pierde informația eliminată din titlu.
- Evenimentele folosesc propoziții: „Plouă acum în Moreni”, „Se apropie ploaia de Moreni”, „Ploaia se oprește curând în Moreni”; echivalente pentru ninsoare, furtună, ceață și vânt. „Curând” apare la încetarea precipitațiilor numai pentru o țintă în următoarele 60 de minute. Pentru o încetare mai târzie: „Ploaia se oprește în Moreni”, cu intervalul probabil în mesaj.
- Avertizările oficiale păstrează severitatea: „Cod galben pentru Moreni”, „Cod portocaliu pentru Moreni”, „Cod roșu pentru Moreni”. Corpul ANM este păstrat. Titlul rezervei locale este „Cod galben pentru Dâmbovița”.
- Titlurile de test folosesc numele simplu al orașului sau METEO NOW; corpul spune explicit că este o notificare de test.
- Titlurile și rezumatele meteo sunt localizate RO/EN. Numele orașelor și diacriticele sunt păstrate. Nu se adaugă separatoare verticale, săgeți, emoji sau puncte de suspensie.

Nu sunt schimbate momentul livrării, alegerea evenimentelor, coordonatele, consimțământul sau deduplicarea. Nu sunt expediate notificări reale în timpul probelor. Nu necesită APK nou.

## Validare

- `tests/test_notification_titles.py`: 12 tipuri de evenimente actuale/viitoare în RO/EN, rezumate azi/mâine, condiția meteo păstrată în corp, nume complete/diacritice, „curând” exclus pentru încetări mai târzii, niveluri de avertizare.
- Testele existente pentru copy, prospețime, livrare/deduplicare și abonamentul individual; avertizarea și notificarea de test verifică și titlul nou în payload.
- `tests/notification-flows.test.js`: sintaxa tuturor scripturilor și fluxurile de permisiuni/sincronizare.
- `tests/notification-location-browser.cjs`: componenta reală Service Worker primește local un PushEvent după închiderea ferestrei aplicației; titlul, corpul, tag-ul și URL-ul sunt păstrate. Proba nu reprezintă livrare FCM sau verificare pe S24 fizic.

Exemplele sunt texte de test, nu starea meteo reală a localităților.
