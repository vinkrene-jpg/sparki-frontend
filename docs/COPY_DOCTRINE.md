# Sparki — Copy Doctrine

Bindende schrijfregels voor alle UI-tekst in de Sparki-codebase.  
Van toepassing op: TSX-componenten, TS-bibliotheken, strings die in de build belanden.

---

## Kernregel: geen antropomorfisme

**Sparki spreekt nooit over zichzelf in de derde persoon als handelende actor.**

Verboden patronen — de geautomatiseerde lint-check (`pnpm run lint:copy`) valt hierop:

| Patroon | Voorbeeld (fout) | Voorbeeld (goed) |
|---|---|---|
| `Sparki [werkwoord]` | *Sparki berekent je zones* | *Zones worden berekend op basis van je FTP* |
| `Laat Sparki [werkwoord]` | *Laat Sparki een schema bouwen* | *Schema bouwen* |
| `kan Sparki [werkwoord]` | *kan Sparki je uitrusting beoordelen* | *krijg je eerlijk onderhoudsadvies* |
| `Sparki-advies` (als zelfstandig nw.) | *Bekijk het Sparki-advies* | *Bekijk het adviesschema* |
| `Opgebouwd door Sparki` | *Opgebouwd door Sparki* | *Automatisch opgebouwd* |
| `door/via Sparki` in een actieve zin | *verwerking gaat via Sparki* | *verwerking telt mee in je tegoed* |

---

## Toegestaan

- **"Sparki"** als productnaam zonder actief werkwoord:  
  ✓ *Navigeren met Sparki* (feature-titel)  
  ✓ *Sparki Connect* (paginanaam)  
  ✓ *SPARKI* als woordmerk  
  ✓ Share-teksten: *…genavigeerd met Sparki.*

- **Passief of systeem-gericht**:  
  ✓ *Wordt berekend op basis van…*  
  ✓ *Je gegevens worden doorzocht op verbanden.*  
  ✓ *Schema wordt opgesteld op basis van je profiel.*

- **Directe actie-labels** (knoppen, titels):  
  ✓ *Schema bouwen*, *Verbanden analyseren*, *Filosofie uitleggen*

- **User-benefit formulering**:  
  ✓ *Nodig voor het berekenen van je zones.*  
  ✓ *FTP is nodig voor zones en belasting.*

---

## Toon

- **Zakelijk en direct** — geen verkooptaal, geen AI-hype.
- **Wetenschappelijk waar van toepassing** — gebruik de correcte term (TSS, W/kg, FTP), leg hem uit bij eerste gebruik in een flow.
- **Eerlijk over beperkingen** — als iets niet automatisch kan worden berekend, zeg dat zo. Nooit impliceren dat het wel kan.
- **Geen lege belofte** — lading ("eerlijk", "echt", "correct") alleen als dat operationeel aantoonbaar is.

---

## Lint-check

```bash
pnpm run lint:copy          # controleer de hele codebase
```

De check grep op de verboden patronen en faalt als er één treffer is in `src/`.  
Script: `scripts/lint-copy.sh`

---

## Wanneer twijfelen

Probeer de zin te herschrijven zodat het ook klinkt als de output van een laboratoriumsysteem of een professionele sportanalyst. Als het dan nog werkt: goed. Als het dan te klinisch klinkt: voeg de menselijke warmte toe in de toon, niet door een actor te creëren.

**Fout:** *Sparki ziet dat je herstel achterloopt.*  
**Te klinisch:** *Herstelscore valt onder drempelwaarde T-2.*  
**Goed:** *Je herstel loopt achter — nog 1 dag extra rust voorkomt ophoping.*
