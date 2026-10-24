# METEO NOW — primul test prin Google Play

Actualizat: 13 octombrie 2026. Utilizatorul a confirmat că nu a creat / plătit încă un cont de dezvoltator Play Console. Nu s-a efectuat nicio plată, creare de cont sau încărcare în magazin.

## Ce putem pregăti fără cont

APK-ul, AAB-ul, capturile, textele RO/EN și inventarul Data safety sunt pregătite local. APK-ul poate fi testat direct pe telefon. Acest lucru nu confirmă instalarea / semnarea din Google Play și livrarea notificărilor în repaus.

## Când alegi să creezi contul

Înregistrarea Play Console are în prezent o taxă unică de 25 USD. Crearea contului, verificarea identității și plata se fac de către titular; nu trimite parole, date de card sau acte în conversație. [Înregistrare oficială](https://support.google.com/googleplay/android-developer/answer/6112435/).

Vechimea contului Google nu este vechimea contului de dezvoltator. Pentru un cont personal creat acum, cerința actuală înainte de accesul la producție este un test închis cu minimum 12 testeri înscriși continuu cel puțin 14 zile, urmat de cererea de acces la producție. Testul intern nu înlocuiește această etapă. [Cerințe oficiale pentru conturi personale noi](https://support.google.com/googleplay/android-developer/answer/14151465).

## Primul release de test

1. După înregistrare, creează aplicația METEO NOW cu limba principală română și identificatorul pachetului existent. Nu schimba Application ID-ul sursei.
2. Deschide canalul Internal testing și pregătește un release cu `builds/current/METEO-NOW-1.0.25-target36.aab`. Dacă numărul 26 a fost deja consumat în Play, va trebui reconstruit cu număr mai mare.
3. Adaugă numai conturile Google ale testerilor care acceptă să participe. Pregătirea de acum nu trimite invitații și nu înscrie pe nimeni automat.
4. Compară SHA-256 din App signing key certificate cu assetlinks public. Dacă diferă, adaugă certificatul Play lângă cel local înainte de verificarea afișării fără bara Chrome.
5. Distribuie linkul de înscriere testerilor aleși, după configurarea release-ului. Existența AAB-ului local nu produce un link de instalare Play.

[Ghid oficial de testare](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en). Pașii exact disponibili sunt cei afișați în contul tău.

## Proba pe S24 Ultra

Păstrează datele existente dacă versiunea Play permite actualizarea peste APK-ul local. Dacă semnăturile diferă, instalarea peste cea existentă poate fi refuzată; înainte de orice dezinstalare trebuie stabilită salvarea preferințelor, deoarece istoricul AI și configurarea widgeturilor sunt locale.

| Probă | Rezultat așteptat |
|---|---|
| Pornire | METEO NOW, orașul și datele încărcate, fără bara Chrome |
| Orașe | Lista se deschide prin atingere scurtă; alegerea orașului păstrează datele orașului corect |
| GPS la revenire | Localitatea se actualizează după deschidere / revenire, cu permisiunea acordată |
| GPS cu aplicația închisă | Nu promitem urmărire în fundal; alertele folosesc ultima localitate sincronizată |
| Notificări ON | Testul din Setări ajunge pe același dispozitiv |
| Notificări OFF din Android | Revenirea nu lasă fals starea ON și nu ocolește permisiunea Android |
| Telefon blocat | O alertă reală este verificată separat; ora, titlul și localitatea sunt notate |
| Internet oprit / revenit | Prognoza salvată este marcată ca veche; reconectarea recuperează datele |
| AI | Fundal izolat, fără refresh la tragere; butoanele și editorul nu pâlpâie |
| Widgeturi | Orașele configurate se păstrează, actualizare automată aproximativă; Android poate amâna |

Notează pentru fiecare probă versiunea, modelul, versiunea Android, rezultatul și ora. Un singur model de telefon nu certifică toate dispozitivele. Nu presupune că un test push reușit în aplicație confirmă și livrarea în repaus.
