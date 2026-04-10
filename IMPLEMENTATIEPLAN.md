# Implementatieplan — MijnStudiepad nieuwe features

> Datum: 2026-04-10

---

## Overzicht

| # | Feature | Status |
|---|---------|--------|
| 1 | URL-routing per opleiding + uitleg-scherm per opleiding | ✅ Afgerond |
| 2 | Homepage uitleg ATD-proces | ✅ Afgerond (samengevoegd met Feature 1) |
| 3 | Toetsonderdelen in leeruitkomst-popup | 🔄 In uitvoering |
| 4 | Toetsonderdelen-staat bij slepen naar ander jaar | ⏳ Gepland |

---

## Feature 1 — URL-routing per opleiding

### Doel
Elke opleiding krijgt een eigen URL-pad (bijv. `/ict`, `/cmd`). De homepage toont geen tegels meer. Op de opleiding-pagina ziet de student **eerst de uitleg** voor die opleiding, met een duidelijke knop om door te gaan naar het studieoverzicht.

### Paginaflow per opleiding-URL

```
/ict  (of /cmd)
  └─ Stap A: Uitleg-scherm  ──[knop "Ga naar mijn studieoverzicht ICT - Informatica"]──►  Stap B: Step2-grid
```

- **Stap A** is de landingspagina van de opleiding-URL. Bevat de relevante instructies (zie Feature 2 voor de algemene ATD-uitleg; hier specifiek voor de opleiding).
- **Stap B** is het bestaande Step2-grid (studieplan-editor).
- De stap-wissel is client-side state (`view: 'uitleg' | 'plan'`) — geen extra URL-segment nodig.
- Als er een opgeslagen plan is (localStorage), toon dan op het uitleg-scherm ook de "Hervatten"-banner (zoals nu in Step1).

### Technische aanpak

#### 1.1 Next.js dynamische routes aanmaken
Maak de folder `src/app/[opleiding]/` met daarin `page.tsx`.

```
src/app/
  page.tsx                    ← homepage (alleen ATD-uitleg, geen opleiding-tegels)
  [opleiding]/
    page.tsx                  ← uitleg + studieplan voor één opleiding
```

De `[opleiding]`-parameter is de `code` uit `opleidingen.json` (bijv. `ict`, `cmd`) — gebruik lowercase.

#### 1.2 Mapping URL → opleiding-metadata
```typescript
const OPLEIDING_MAP: Record<string, { displayName: string; jsonUrl: string }> = {
  ict: {
    displayName: 'ICT — Informatica',
    jsonUrl: '/leeruitkomsten/Leeruitkomsten-ICT.json',
  },
  cmd: {
    displayName: 'CMD — Communication & Multimedia Design',
    jsonUrl: '/leeruitkomsten/Leeruitkomsten-CMD.json',
  },
};
```
Als de `params.opleiding` niet in de map staat → 404 of redirect naar homepage met foutmelding.

#### 1.3 View-state in `[opleiding]/page.tsx`
```typescript
const [view, setView] = useState<'uitleg' | 'plan'>('uitleg');
```
- `'uitleg'`: toont het uitleg-scherm (Stap A). Geen curriculum geladen.
- `'plan'`: laadt curriculum en toont Step2 (Stap B). Curriculum wordt pas geladen bij klik op de doorgaan-knop, _of_ direct bij hervatten.

#### 1.4 Uitleg-scherm (Stap A) — knoplabel
De doorgaan-knop gebruikt de `displayName` van de opleiding:
```
"Ga naar mijn studieoverzicht — ICT Informatica"
"Ga naar mijn studieoverzicht — CMD"
```
Hiermee is de knop beschrijvend en uniek per opleiding.

#### 1.5 Header — beschrijvende terugknop
De terugknop in `Header.tsx` krijgt een label dat beschrijft waar de gebruiker naartoe gaat — niet generiek "Home" of "←":

| Context | Label |
|---------|-------|
| Op uitleg-scherm (Stap A) van `/ict` of `/cmd` | `"← Over het studieadviesproces"` (link naar `/`) |
| In het studieplan (Stap B) | `"← Uitleg ICT — Informatica"` (zet `view` terug op `'uitleg'`) |

Het label in Stap B gebruikt ook de `displayName` van de actieve opleiding.

#### 1.6 `page.tsx` (root) aanpassen
- Verwijder `<Step1>` component volledig uit de render.
- `step`-state vervalt; de root-page toont alleen de homepage-uitleg (Feature 2).
- De volledige studieplan-logica (state, handlers, `<Step2>`, `<PrintModal>`, `<PrintView>`) verhuist naar `[opleiding]/page.tsx`.

#### 1.7 LocalStorage — meerdere opleidingen
De localStorage-key wordt per opleiding uniek:  
`mijnStudieplan_ict`, `mijnStudieplan_cmd`, etc.  
(was: `mijnStudieplan`)

#### 1.8 `Step1.tsx` — vervalt
Het component `src/components/Step1.tsx` wordt niet meer gebruikt en kan worden verwijderd nadat de routing werkt.

#### 1.6 Header-navigatie
Voeg in `Header.tsx` een "Home"-knop toe (← terug) die zichtbaar is op de opleiding-pagina's. Deze linkt naar `/`.

### Raakvlakken
- `src/app/page.tsx` — ingrijpende wijziging (verwijder Step1-logica)
- `src/components/Step1.tsx` — verwijderen
- `src/components/Header.tsx` — terugknop met beschrijvend label (ontvangt `backLabel` en `onBack` als props)
- Nieuw: `src/app/[opleiding]/page.tsx` — uitleg-scherm + studieplan, view-state, hervatten-banner

---

## Feature 2 — Homepage uitleg ATD-proces

### Doel
De homepage (`/`) legt het ATD-studieadviesproces uit en plaatst dit hulpmiddel daarin. Geen opleiding-tegels, geen acties.

### Inhoud van de uitleg

De tekst is gebaseerd op _CONCEPT ATD Aanpak studieplannen.docx_. Structureer de pagina als volgt:

#### Sectie A — Wat is het studieadvies?
> Avans geeft aan het einde van jaar 1 een studieadvies. Dit advies valt in één van drie categorieën:
>
> - **Positief** (≥ 45 EC behaald): je stroomt normaal door naar jaar 2.
> - **Advies passend studietraject** (< 45 EC): je hebt een tekort. Je kunt jaar 1 overdoen, of je vraagt toestemming aan de examencommissie om toch door te gaan — mét een goedgekeurd studieplan.
> - **Verwijsadvies** (< 45 EC, onvoldoende vertrouwen): doorstromen is niet toegestaan, tenzij de examencommissie een uitzondering maakt.

#### Sectie B — Het studieplan als levend document
> Bij categorie 2 of 3 stel je samen met je studieloopbaanbegeleider (slb'er) een studieplan op. Dit plan is een _levend document_: je werkt het bij na elk periode-gesprek. Het plan laat zien welke leeruitkomsten je wanneer gaat behalen en in welke volgorde.
>
> De slb'er beoordeelt de haalbaarheid (volgorde, combinaties, werkdruk). De examencommissie geeft uiteindelijk toestemming voor doorstroming.

#### Sectie C — Tijdlijn (visueel of lijst)
| Periode | Actie |
|---------|-------|
| P2 | Eerste gesprek slb'er over studievoortgang; eerste studiesignaal op basis van P1-resultaten |
| P3 | Uitleg proces aan studenten |
| P4 week 9-10 | Overleg slb'er & examencommissie over categorie 2/3-studenten |
| P4 week 11 | Definitief studieadvies; deadline studieplan (1 februari) |

#### Sectie D — Hoe gebruik je dit hulpmiddel?
> **MijnStudiepad** helpt je een studieplan te maken en bij te houden. Je kunt:
> - Leeruitkomsten plannen per periode en jaar
> - Bijhouden welke leeruitkomsten en toetsonderdelen je hebt behaald
> - Je plan opslaan en printen voor overleg met je slb'er of de examencommissie
>
> Ga naar de pagina van jouw opleiding om te beginnen of je plan te hervatten:
> - [ICT — Informatica](/ict)
> - [CMD — Communication & Multimedia Design](/cmd)

> **Let op:** Deze links zijn het enige instappunt. Sla het adres van jouw opleiding op als bladwijzer.

### Technische aanpak
- Inhoud volledig statisch — geen state, geen API-calls.
- Schrijf de pagina in `src/app/page.tsx` als gewone React server component.
- Gebruik de bestaande design tokens (kleuren, typografie) uit `globals.css`.
- De tijdlijn kan een gestileerde `<ol>` of een grid zijn.
- De twee opleiding-links zijn `<Link href="/ict">` en `<Link href="/cmd">` (Next.js `<Link>`).

### Raakvlakken
- `src/app/page.tsx` — volledig herschrijven

---

## Feature 3 — Toetsonderdelen in leeruitkomst-popup

### Doel
In de `InfoModal` worden per leeruitkomst, boven de bestaande beschrijving, de **toetsonderdelen** getoond. Elk toetsonderdeel is afzonderlijk aan te vinken.

### Data-model uitbreiding

#### 3.1 Nieuw type `Toetsonderdeel`
Toevoegen aan `src/lib/types.ts`:
```typescript
export interface Toetsonderdeel {
  titel: string;
}
```

#### 3.2 Uitbreiding `Outcome`
```typescript
export interface Outcome {
  name: string;
  studiepunten: number;
  qualification: string;
  description: string;
  toetsonderdelen?: Toetsonderdeel[];  // ← nieuw
  // interne velden:
  titel?: string;
  omschrijving?: string;
}
```

#### 3.3 State voor behaalde toetsonderdelen
In `page.tsx` (en later `[opleiding]/page.tsx`):
```typescript
// Key format: "moduleCode|outcomeIdx|toetsonderdeelIdx"
const [achievedToetsonderdelen, setAchievedToetsonderdelen] = useState<Set<string>>(new Set());
```

Doorgeven via props naar `<Step2>` → `<InfoModal>`.

#### 3.4 Placeholder-data in JSON
Tot de echte toetsonderdelen zijn aangeleverd, voeg je **3 toetsonderdelen per leeruitkomst** toe in `Leeruitkomsten-ICT.json` en `Leeruitkomsten-CMD.json`:
```json
"toetsonderdelen": [
  { "titel": "Lorem ipsum dolor sit amet consectetur" },
  { "titel": "Adipiscing elit sed do eiusmod tempor" },
  { "titel": "Incididunt ut labore et dolore magna" }
]
```
(6 woorden per toetsonderdeel, 3 per leeruitkomst)

Dit moet bij **alle** leeruitkomsten in beide JSON-bestanden worden toegevoegd. Dat zijn respectievelijk ~120 leeruitkomsten (ICT) en ~30 (CMD). Gebruik een script of bulk-edit.

#### 3.5 `parseJSON` in `utils.ts`
Pas `parseJSON` aan zodat `toetsonderdelen` van de raw JSON naar het geparseerde `Outcome`-object worden gekopieerd:
```typescript
toetsonderdelen: raw.toetsonderdelen || [],
```

#### 3.6 `InfoModal.tsx` aanpassen
Toon per leeruitkomst:
1. Header (naam, EC, vinkje leeruitkomst behaald) — ongewijzigd
2. **Toetsonderdelen-sectie** (nieuw) — boven de beschrijving:
   - Kleine subkop: "Toetsonderdelen"
   - Per toetsonderdeel: checkbox + titel
   - Stijl: compacter dan de leeruitkomst zelf; subtiele achtergrond
3. Beschrijving — ongewijzigd

```tsx
{/* Toetsonderdelen */}
{o.toetsonderdelen && o.toetsonderdelen.length > 0 && (
  <div className="mb-3 p-3 bg-gray-50 rounded border border-border-subtle">
    <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Toetsonderdelen</p>
    {o.toetsonderdelen.map((t, ti) => {
      const toKey = `${code}|${i}|${ti}`;
      const toState = getToetsonderdeelState(toKey); // 'checked' | 'unchecked' | 'vervallen'
      return (
        <label key={ti} className="flex items-center gap-2 py-1 cursor-pointer">
          <ToetsonderdeelCheckbox state={toState} onChange={() => toggleToetsonderdeel(toKey)} />
          <span className={toState === 'vervallen' ? 'line-through text-muted' : ''}>{t.titel}</span>
          {toState === 'vervallen' && (
            <span className="text-xs text-orange-600 font-medium">vervalt bij jaar-overplaatsing</span>
          )}
        </label>
      );
    })}
  </div>
)}
```

#### 3.7 `InfoModal` props-uitbreiding
```typescript
interface InfoModalProps {
  // ... bestaande props
  achievedToetsonderdelen: Set<string>;
  toetsonderdeelStates: Map<string, 'checked' | 'unchecked' | 'vervallen'>;
  toggleToetsonderdeel: (key: string) => void;
}
```

#### 3.8 LocalStorage
Sla `achievedToetsonderdelen` en `toetsonderdeelStates` op als arrays in de bestaande save-structuur.

### Raakvlakken
- `src/lib/types.ts` — `Toetsonderdeel` interface + `Outcome.toetsonderdelen`
- `src/lib/utils.ts` — `parseJSON` aanpassen
- `src/app/page.tsx` / `[opleiding]/page.tsx` — nieuwe state
- `src/components/InfoModal.tsx` — UI + props
- `src/components/Step2.tsx` — props doorgeven
- `public/leeruitkomsten/Leeruitkomsten-ICT.json` — placeholder-data toevoegen
- `public/leeruitkomsten/Leeruitkomsten-CMD.json` — placeholder-data toevoegen

---

## Feature 4 — Toetsonderdelen-staat bij slepen naar ander jaar

### Doel
- **Slepen binnen hetzelfde jaar** (bijv. periode 1→3, jaar 1→jaar 1): toetsonderdelen blijven aangevinkt.
- **Slepen naar een ander jaar** (bijv. jaar 1 → jaar 2): toetsonderdelen krijgen de staat `'vervallen'`. De student ziet daarmee dat behaalde toetsonderdelen vervallen als de volledige leeruitkomst niet wordt behaald.

### Staten van een toetsonderdeel
```
'unchecked'  — standaard, niet aangevinkt
'checked'    — behaald
'vervallen'  — was behaald maar leeruitkomst is naar ander jaar verplaatst
               (behaalde TO's vervallen als LU niet volledig behaald wordt)
```

### Technische aanpak

#### 4.1 State-model
Vervang de enkelvoudige `achievedToetsonderdelen: Set<string>` door een `Map`:
```typescript
// Key: "moduleCode|outcomeIdx|toetsonderdeelIdx"
// Value: 'checked' | 'unchecked' | 'vervallen'
const [toetsonderdeelStates, setToetsonderdeelStates] = useState<Map<string, 'checked' | 'unchecked' | 'vervallen'>>(new Map());
```

#### 4.2 Drag-handler uitbreiden in `Step2.tsx`
De bestaande `onDrop`-handler weet van welke cel (`sourceKey = "year_period"`) naar welke cel (`targetKey`) gesleept wordt.

Na een drop:
```typescript
function handleDrop(item: PlanItem, sourceKey: string, targetKey: string) {
  // Bestaande logica: item verplaatsen in planGrid
  // ...

  // Nieuw: toetsonderdeel-staat bijwerken
  const [sourceYear] = sourceKey.split('_').map(Number);
  const [targetYear] = targetKey.split('_').map(Number);

  if (sourceYear !== targetYear) {
    // Jaar veranderd → zet alle 'checked' TO's van deze LU op 'vervallen'
    setToetsonderdeelStates(prev => {
      const next = new Map(prev);
      // Prefix van alle TO-keys voor deze leeruitkomst:
      const prefix = `${item.code}|${item.idx}|`;
      for (const [key, state] of next.entries()) {
        if (key.startsWith(prefix) && state === 'checked') {
          next.set(key, 'vervallen');
        }
      }
      return next;
    });
  }
  // Bij zelfde jaar: geen wijziging aan toetsonderdeel-staten
}
```

#### 4.3 Herstellen van 'vervallen' staat
Als de student de leeruitkomst terugslept naar het originele jaar, of handmatig een 'vervallen' TO aanvinkt:
- Klik op een 'vervallen' checkbox → wordt 'unchecked' (niet automatisch 'checked'; student beslist opnieuw).
- Er is geen automatisch herstel van 'vervallen' → 'checked' bij terugslepen (te complex, kan verwarrend zijn).

#### 4.4 Visuele weergave in InfoModal
| Staat | Weergave |
|-------|----------|
| `unchecked` | Lege checkbox, normale tekst |
| `checked` | Aangevinkt (groen), normale tekst |
| `vervallen` | Speciaal icoon (bijv. ⚠️ of oranje checkbox), doorstreepte tekst, tooltip: _"Dit toetsonderdeel was behaald maar de leeruitkomst is naar een ander jaar verplaatst. Als je de volledige leeruitkomst niet behaalt, vervallen eerder behaalde onderdelen."_ |

#### 4.5 Visuele indicator op de kaart in Step2
Overweeg een klein oranje waarschuwingsicoontje op de leeruitkomst-kaart in het grid als er 'vervallen' toetsonderdelen zijn. Dit maakt de situatie zichtbaar zonder de popup te openen.

#### 4.6 LocalStorage
`toetsonderdeelStates` opslaan als array van `[key, state]`-tuples:
```typescript
toetsonderdeelStates: Array.from(toetsonderdeelStates.entries())
// herladen:
new Map(saved.toetsonderdeelStates || [])
```

### Raakvlakken
- `src/app/page.tsx` / `[opleiding]/page.tsx` — state-model aanpassen
- `src/components/Step2.tsx` — drop-handler uitbreiden
- `src/components/InfoModal.tsx` — 'vervallen' weergave
- `src/lib/types.ts` — evt. `ToetsonderdeelState` type exporteren

---

## Volgorde van implementatie

1. **Feature 1** (routing) en **Feature 2** (homepage) samen — ze raken beiden `page.tsx` en de app-structuur fundamenteel. Doe dit eerst zodat de rest op de juiste plek gebouwd wordt.
2. **Feature 3** (toetsonderdelen in popup) — data-model + UI, zonder drag-logica.
3. **Feature 4** (staat bij slepen) — bouwt voort op Feature 3's state-model.

---

## Open punten / te beslissen

- **Feature 1:** Moeten de opleiding-URL's exact de `code` volgen (`/ict`, `/cmd`) of een langere naam (`/informatica`, `/communication-multimedia-design`)?
- **Feature 2:** Worden de Studieadvies.pdf en Studieadvies-docent.pdf als download aangeboden op de homepage?
- **Feature 3:** Wanneer worden de echte toetsonderdelen aangeleverd ter vervanging van de Lorem Ipsum-placeholders?
- **Feature 3:** Mogen toetsonderdelen ook los worden aangevinkt als de leeruitkomst zelf nog niet als behaald is gemarkeerd? (Huidig voorstel: ja — ze zijn onafhankelijk.)
- **Feature 4:** Moet 'vervallen' ook worden getoond in `PrintView`? (Voorstel: ja, als aparte categorie.)
- **Feature 4:** Moeten 'vervallen' TO's invloed hebben op de voortgangsbalk (EC-teller)? (Voorstel: nee — alleen volledig behaalde leeruitkomsten tellen mee voor EC.)
