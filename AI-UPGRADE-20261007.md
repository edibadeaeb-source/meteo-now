# METEO NOW — AI, versiunea 2026.10.07.10

## Sonnet 5.5

- `/ask` folosește `claude-sonnet-5-5`, cu cheia existentă numai pe server.
- `thinking: {type: between_tools}` păstrează răspunsurile scurte și directe,
  fără raționamentul inițial activat implicit de noul model. Limita rămâne 2000
  tokeni; nu se trimit parametri de sampling incompatibili.
- Răspunsul este citit din blocurile text, nu din `content[0]`. Blocurile de
  thinking/signature nu ajung în aplicație. Lipsa unui text utilizabil dă 502.
- JSON-ul include modelul comunicat de furnizor, pentru verificarea integrării.
- Snapshotul curent al orașului, fusul orar și regulile pentru date lipsă rămân
  neschimbate. Istoricul nu înlocuiește datele curente.

Documentație oficială:

- https://platform.claude.com/docs/en/models/sonnet-5-5/overview
- https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide

## Interfață și conversații

Referință: captura Wondercraft din Screenshot S24 ULTRA, WhatsApp Image
2026-10-07 at 23.53.09.jpeg. Adaptarea folosește grafica meteo proprie, fără
logo-ul sau opțiunile produsului din referință. Preferința utilizatorului:
combinație între fundalul meteo prin liquid glass și accente mov-albastre.

- Ecran de început cu simbol meteo, întrebare centrală, sugestii localizate și
  editor mai mare, cu contur mov/albastru. Taburi Întreabă AI-ul / Conversații.
- Istoric local pe dispozitiv, fără sincronizare în cloud. Reluare, conversație
  nouă, ștergere cu confirmare în panou. Limite: 30 conversații, 120 mesaje per
  conversație și 220000 caractere serializate. Dacă se trunchiază o conversație,
  se afișează o notă; dacă stocarea e blocată/plină, discuția continuă în memorie
  și apare o explicație. Politica de confidențialitate descrie stocarea locală și
  transmiterea ultimelor schimburi relevante către Anthropic.
- AI-ul primește cel mult 40 mesaje istorice și un snapshot nou la fiecare
  întrebare. Erorile nu devin mesaje de context. Mesajele păstrează local orașul
  pentru care au fost trimise; datele meteorologice nu sunt salvate în istoric.
- Cererile sunt legate de conversația inițială. Un răspuns întârziat nu poate
  apărea în alta; ștergerea discuției anulează cererea ei.
- Fundal inert și acoperit de un backdrop; focus păstrat în dialog, Escape și
  buton de închidere, taburi cu navigare din tastatură, feedback aria-live.
- VisualViewport adaptează înălțimea la tastatură. Actualizarea acestuia se face
  numai când AI-ul e deschis. Pe ecrane mici sugestiile sunt într-o bandă orizontală,
  păstrând titlul și editorul vizibile. Un singur blur pe dialog, fără blur pe
  fiecare mesaj. Fallback opac la reduced-transparency sau lipsa backdrop-filter.

## Verificări

- 50 teste Python, inclusiv Sonnet 5.5, răspunsuri cu thinking înainte de text,
  text absent, istoric, snapshot și fus orar.
- Teste de stocare: repornire, răspunsuri pe conversație, ștergere persistentă,
  filtrarea contextului, limite reale și stocare indisponibilă.
- Browser: repornire și reluare, răspuns întârziat, trei conversații, ștergere,
  RO/EN, text afișat sigur, background inert, focus și eliminarea blocării scrollului.
- Șase ecrane (320,360,412,430,932,1280px) și tastatură simulată de 350px:
  editorul și trimiterea încap, titlul e vizibil, fără overflow orizontal.
- Regresii generale: notificări, hărți și selecția orașelor, layout și ploaie.
- Capturile sunt în 03-Testare-si-capturi/tests/ai-interface.

Nu s-a făcut test fizic pe telefonul utilizatorului. Testele de browser nu
validează accesul contului la model; acesta este verificat separat prin `/ask`
după publicare.
