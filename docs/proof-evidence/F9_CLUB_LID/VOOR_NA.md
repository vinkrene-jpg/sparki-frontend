# F9_CLUB_LID — Club-ledenpagina heringedeeld (voor/na, 402×874)

Herindeling van `artifacts/sparki/src/pages/club.tsx` (lid-weergave = `RealClubView`,
inclusief wat de hoofdtrainer daar bovenop ziet). Geen nieuwe functionaliteit —
alleen verplaatsen/herstructureren. Alles blijft bereikbaar.

## Bewijs

Vastgelegd via het e2e-harnas (prod-build + api-server + Nix-chromium +
ticketlogin) op telefoonformaat **402×874**. Test: `e2e/tests/f9-club-lid.mjs`
(patroon overgenomen van `e2e/tests/f9-clubbeheer.mjs`).

Het QA-account is al **beheerder** van "E2E Rolstart Club", dus `RealClubView`
rendert (owner/admin = `canManage`). Zo tonen de opnames precies het lid-scherm
inclusief de beheer-bovenlaag.

- `voor/` = HEAD-versie (`98f3b87a`), vastgelegd vóór de wijziging.
- `na/` = deze herindeling.

Draaien:
```
F9_SHOT_DIR=voor node e2e/tests/f9-club-lid.mjs   # eerst HEAD-club.tsx + build
F9_SHOT_DIR=na   node e2e/tests/f9-club-lid.mjs   # daarna deze versie + build
```

### Gemeten verschil (paginahoogte / venster)

| | schermen bij openen | tabs | primaire actie per scherm | composer |
|---|---|---|---|---|
| **voor** | 1270px / 874px = **1,5** | geen | 4 concurrerende acties op één pagina | inline in de vouw |
| **na** | 874px / 874px = **1,0** | 4 (Vandaag/Berichten/Documenten/Meer) | max. 1 per tab | in stappenvenster |

## Indeling na

- **Kop + kerninfo in beeld** (TUX-24/26): clubnaam + rol + het rolgestuurde
  startblok (`RolStartBlock`) met precies één begrijpelijke eerste actie staan
  bij openen in beeld; geen scrollverplichting.
- **Vier échte tabs** (`HoofdstukTabs`, zelfde component als club-beheer):
  - **Vandaag** — signalen (beheer) + clubtrainingen (aan-/afmelden via
    `TrainingCard`, ongewijzigd).
  - **Berichten** — F7-berichtenlijst (`MessageBubble`, ongewijzigd); één
    primaire actie **"Bericht sturen"** die de composer als stappenvenster opent.
  - **Documenten** — F8-`ClubDocumentsList`, ongewijzigd hergebruikt.
  - **Meer** — hoofdtraineroverzicht (op logische plek, breekt de vouw niet
    meer), wedstrijden & selectie (beschikbaarheid), en toestemming via de knop
    **"Delen instellen"** → stappenvenster.
- **Zware blokken naar sheet** (TUX-27..30): de F7-berichtcomposer en het
  toestemmingsblok openen als `BeheerSheet`-stappenvenster met eigen
  sluiten/terug — nooit meer inline in een lange scroll.
- **Hoofdtrainer-blok** staat nu onder **Meer** i.p.v. bovenop de volle pagina;
  daardoor blijft de hoofdhandeling (Vandaag/trainingen) boven de vouw.

## F9-regels — voldoet/niet

| Regel | Status | Toelichting |
|---|---|---|
| Hoofdhandeling + kerninfo in beeld bij openen (TUX-24..26) | ✅ | Kop, rolstartblok en tabs binnen 402×874; 1,0 scherm (was 1,5). |
| Geen scrollverplichting | ✅ | Fold-opname toont volledige tabbalk + eerste sectie. |
| Meerstaps → stappenvenster met uitweg (TUX-27..30) | ✅ | Composer + toestemming in `BeheerSheet` (sluiten/terug). |
| Max. 1 primaire actie | ✅ | Per tab hooguit één (Berichten: "Bericht sturen"; Meer: "Delen instellen"). |
| Max. 4 kaarten boven de vouw | ✅ | Boven de vouw: rolstartblok + tabs + 1 sectie. |
| 2–4 échte tabs | ✅ | Vier tabs (Vandaag/Berichten/Documenten/Meer). |
| Onbevoegden: beheeropties WEGLATEN, niet uitgrijzen | ✅ | Signalen/berichten-sturen alleen bij `canManage`; hoofdtrainer-overzicht alleen bij die rol — weggelaten, niet uitgegrijsd. |
| Details naar apart scherm/sheet | ✅ | Composer + toestemming naar sheet. |
| Rol + omgeving zichtbaar via bestaande ScreenShell-ContextRegel | ✅ | Zichtbaar in de opnames ("CLUB · TESTOMGEVING · SPORTER"); geen shell-wijziging. |
| Geen nieuwe functionaliteit; alles bereikbaar | ✅ | Alle 6 oude secties bestaan nog, verdeeld over tabs/sheets. |
| F7/F8-componenten ongewijzigd hergebruikt | ✅ | `MessageBubble`/`MessageComposer`/`ClubDocumentsList` alleen herplaatst. |

## Eerlijke beperkingen

- De prod-build wordt niet automatisch ververst door het harnas; per
  vastlegging (voor/na) is handmatig herbouwd (`npm run build`) met de juiste
  club.tsx-versie op schijf.
- Het QA-account heeft geen geplande trainingen/wedstrijden/berichten, dus de
  tab-inhoud toont lege toestanden (echte data, geen mock). De structuur
  (tabs, primaire actie, sheets) is daarmee wél volledig aangetoond.
