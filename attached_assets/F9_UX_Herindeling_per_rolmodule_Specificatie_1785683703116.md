# F9 — UX-herindeling per rolmodule

**Pakket:** SPARKI_BUILD_01  
**Fase:** F9 — UX-herindeling per rolmodule  
**Status:** Uitgewerkt als 2e AI-bouwopdracht  
**Datum:** 2 augustus 2026

---

## Doel

Per rolmodule de schermen herindelen volgens vaste UX-principes, zodat de interface overzichtelijk, rolgericht en mobielvriendelijk is.  
Eerst inventariseren, daarna herindelen. Geen nieuwe functionaliteit bouwen.

---

## Eindtoestand die bereikt moet zijn

### 1. Scherminventarisatie (verplicht eerst)
- Per module een echte inventarisatie van alle bestaande schermen/routes.
- Documenteer wat er nu is (schermen, acties, tabs, kaarten).
- Dit is de basis voor de herindeling.

### 2. UX-regels die toegepast moeten worden
- Maximaal **één primaire actie** per scherm.
- Maximaal **vier kaarten** boven de vouw.
- **Twee tot vier echte tabs** (geen lege tabs).
- Beheer-opties **niet uitgegrijsd** tonen aan onbevoegden → gewoon weglaten.
- Details naar een **apart scherm**.
- Invoer via een **wizard** waar dat logisch is.
- Geen zesde hoofditem in de navigatie.
- **Mobiel is geen verkleinde desktop** — layout en hiërarchie moeten mobiel-first kloppen.

### 3. Volgorde van aanpak
- **Clubbeheer eerst.**
- Daarna de overige rolmodules.

### 4. Wat wel en niet mag
- **Verplaatsen** van bestaande functionaliteit mag.
- **Weglaten** van bestaande functionaliteit mag **niet** zonder expliciet besluit.
- Geen nieuwe functies toevoegen in deze fase.

---

## Niet bouwen

- Nieuwe functionaliteit.
- Nieuwe modules of navigatie-items.
- Een generieke design-system overhaul buiten de genoemde regels.

---

## Acceptatiecriteria / tests

- Scherminventarisatie is uitgevoerd en vastgelegd per module.
- Clubbeheer-schermen voldoen aan alle UX-regels hierboven.
- Geen lege tabs.
- Onbevoegde gebruikers zien geen uitgegrijsde beheerknoppen.
- Primaire actie is duidelijk en er is er maximaal één.
- Op mobiel is de hiërarchie logisch en niet slechts een verkleinde desktopversie.
- Bestaande functionaliteit is behouden (tenzij expliciet anders besloten).

---

## Instructie aan Replit

1. Voer eerst een echte scherminventarisatie uit per module (begin met clubbeheer).
2. Herindel daarna volgens de UX-regels.
3. Meet na afloop of alle regels zijn toegepast.
4. Bouw geen nieuwe features; verplaats alleen en pas de structuur aan.
5. Lever de bewijsbundel inclusief voor/na-overzicht van de schermen.
