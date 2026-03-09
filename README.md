# Mijn Studiepad

Een statische webapplicatie voor het plannen van je studie op basis van leeruitkomsten per opleiding.

## Wat doet het?

1. **Kies je opleiding** – selecteer ICT of CMD
2. **Geef aan wat je al behaald hebt** – vink leeruitkomsten aan
3. **Plan je studiepad** – sleep modules naar het juiste jaar en periode op het 4×4 rooster
4. **Sla op** – je voortgang wordt bewaard in de browser (localStorage)
5. **Druk af** – exporteer je studieplan als PDF

## Lokaal draaien

De app heeft **geen server nodig**, maar browsers blokkeren `fetch()` bij het openen van bestanden via `file://`. Gebruik daarom een eenvoudige HTTP-server:

**Optie 1 – npx serve (Node.js):**
```bash
npx serve .
```
Open dan [http://localhost:3000](http://localhost:3000)

**Optie 2 – Python:**
```bash
python -m http.server 3000
```
Open dan [http://localhost:3000](http://localhost:3000)

## GitHub Pages

De app is beschikbaar via GitHub Pages:
👉 **https://[username].github.io/MijnStudiepad/**

## Opleidingen toevoegen

1. Maak een nieuw JSON-bestand aan in de map `leeruitkomsten/`:
   `Leeruitkomsten-MIJNCODE.json`

2. Gebruik de volgende structuur:
```json
{
  "modules": [
    {
      "naam": "1.1 Naam van de module",
      "periodes": [1],
      "leeruitkomsten": [
        {
          "titel": "Naam van de leeruitkomst",
          "studiepunten": 3,
          "omschrijving": "Beschrijving met eindkwalificatie software realiseren."
        }
      ]
    }
  ]
}
```

3. Voeg de opleiding toe aan `leeruitkomsten/opleidingen.json`:
```json
[
  { "code": "ICT", "displayName": "ICT - Informatica" },
  { "code": "MIJNCODE", "displayName": "Mijn Opleiding" }
]
```

### Notatie voor `naam`
- `"1.1 Naam"` → module in jaar 1
- `"1.3-1.4 Naam"` → module over periodes 3 en 4 van jaar 1
- `"2.3Keuzemodule Naam"` → keuzemodule in jaar 2

### Notatie voor `periodes`
- `[1]` → alleen periode 1
- `[1, 2]` → periodes 1 én 2
- `[1, 2, 3, 4]` → gehele jaar

## Bestandsstructuur

```
MijnStudiepad/
├── index.html              # Startpagina
├── app.js                  # Applicatielogica (vanilla JS)
├── style.css               # Stijlen
├── leeruitkomsten/
│   ├── opleidingen.json    # Lijst van beschikbare opleidingen
│   ├── Leeruitkomsten-ICT.json
│   └── Leeruitkomsten-CMD.json
├── .gitignore
└── README.md
```
