# Google Play Data safety — METEO NOW

Revizie: 25 octombrie 2026. Android 1.0.27 / web 2026.10.25.1. Inventar bazat pe sursele actuale; formularul nu a fost trimis în Play Console.

## Răspunsuri generale

- Colectare de date în afara dispozitivului: **Da**.
- Criptare în tranzit: HTTPS pentru fluxurile aplicației.
- Cont de utilizator, reclame, identificator publicitar, achiziții: nu sunt implementate.
- Nu declara „fără analytics / diagnostic” în sensul formularului: există raportare tehnică proprie, chiar dacă nu este integrat un SDK de analytics.

## Inventarul actual

| Categorie pentru formular | Flux în cod | Obligatoriu / opțional | Scop propus |
|---|---|---|---|
| Locație aproximativă și precisă | Coordonate pentru geocodare, vreme și, dacă sunt activate, alerte | GPS opțional; se poate alege manual orașul | Funcționalitatea aplicației |
| Device or other IDs | Endpoint / chei push; identificator opac pentru starea permisiunii Android și pentru sincronizarea widgeturilor | Push opțional; sincronizarea orașelor din APK este automată, fără comutator separat | Funcționalitatea aplicației |
| Other user-generated content | Întrebări AI, mesaje recente relevante și contextul meteo trimise către Anthropic | Opțional, la utilizarea AI | Funcționalitatea aplicației |
| Diagnostics | Coduri de eroare, componentă, versiune, categorie platformă, cod HTTP, linie/coloană | Automat când apare o eroare; fără opțiune separată de dezactivare | Analytics, în sensul diagnosticării problemelor din formular |
| Crash logs — declarare conservatoare | Evenimente runtime_error / unhandled_rejection; fără stack sau mesaj liber | Automat când apare o eroare | Analytics, pentru repararea erorilor |

„Crash logs” nu înseamnă că există Crashlytics, raportare completă de crash nativ sau ANR. Schema actuală transmite categorii de erori JavaScript și ale widgeturilor. Nu trimite conversații, orașe sau coordonate în diagnostice. Identificatorii fluxurilor push/widget sunt separați de rapoartele de diagnostic.

## Stocare și ștergere

- Prognoza obișnuită are cache pe server după coordonate. Locația nu trebuie declarată exclusiv efemeră nici fără push: nu este doar procesată în memorie pentru cererea imediată.
- Cu push activ, Firebase păstrează abonamentul și localitatea. Oprirea din aplicație cere dezabonarea; dezinstalarea nu garantează ștergerea imediată, abonamentele invalide fiind eliminate la răspunsul furnizorului.
- Lista orașelor widgeturilor este un pachet AES-GCM criptat end-to-end. Cheia rămâne pe dispozitiv; serverul păstrează și un identificator opac al pachetului. Nu declara întregul serviciu exempt de identificatori doar fiindcă lista este criptată.
- Starea Android păstrează ultimul rezultat permis/refuzat, identificatorul cererii și data, înlocuite la o nouă verificare; nu promitem retenție automată limitată în zile pentru acest flux.
- Agregatele de diagnostic mai vechi de 14 zile sunt curățate la o raportare ulterioară. Jurnalele Render au retenție administrată separat.
- Istoricul AI este salvat local și se poate șterge din panoul AI. Serverul METEO NOW nu păstrează conversația; contextul transmis poate include localitatea și coordonatele. Anthropic declară retenție standard API de până la 30 zile, cu excepții contractuale, de siguranță și legale; nu declara acest flux exclusiv efemer și nu promite că ștergerea locală șterge copiile furnizorului. [Politica furnizorului](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), verificată la 24 octombrie 2026. Nu am verificat în consola Anthropic existența unui acord special al contului.
- Pentru protecția împotriva abuzului, contoarele locale de acces folosesc un hash al IP-ului; înregistrările expirate sunt curățate la cereri ulterioare. Nu folosi afirmația generală „nu procesăm identificatori”. Scopul acestui flux este prevenirea abuzului și securitate, separat de diagnosticul tehnic.
- Ștergerea datelor locale și revocarea permisiunilor nu sunt echivalente cu ștergerea tuturor datelor de pe server. Politica publică oferă contactul edibadea.eb@gmail.com; nu bifa un mecanism automat de ștergere server pe baza simplei dezinstalări.

## Destinatari și clasificarea distribuirii

Fluxuri identificate: MET Norway, OpenWeatherMap și Open-Meteo pentru meteo; BigDataCloud pentru geocodare; RainViewer, NOAA SWPC, DWD și ANM pentru hărți/date; Anthropic pentru AI; Firebase pentru stocare; Render pentru găzduire; serviciul push pentru livrare.

Nu presupune că fiecare cerere de hartă trimite coordonate GPS sau că orice transfer este automat „sharing”. Înainte de trimiterea formularului, confirmă pentru fiecare furnizor condițiile aplicabile și eventuala excepție de prestator / acțiune inițiată de utilizator. Până atunci, folosește declararea conservatoare a transferurilor de locație, AI și identificatori; nu marca global „nu distribuie date” fără această verificare.

## Reguli Google consultate

În formular, „colectare” include transmiterea în afara dispozitivului. Procesarea efemeră presupune păstrare doar în memorie pentru cererea imediată. Google distinge transferul către prestatori de distribuire și include diagnosticul tehnic în categoriile de performanță. Aceste reguli nu înlocuiesc verificarea contractelor furnizorilor. [Ghid oficial Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en), consultat la 13 octombrie 2026.

Politica publică actuală: https://meteo-now.onrender.com/privacy.html. Copia inclusă în pachet trebuie să fie identică cu sursa publicată.

Verificarea din 17 octombrie și condițiile de utilizare ale API-urilor sunt în `LAUNCH-AUDIT-20261017.md` din sursele active / documentația tehnică. Jurnalele private confirmă apeluri automate ale joburilor, dar nu înlocuiesc proba fizică de livrare a unei alerte.
