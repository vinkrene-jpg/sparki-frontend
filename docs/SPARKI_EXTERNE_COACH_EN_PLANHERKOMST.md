# Externe coach & planherkomst — besluit en ontwerpkader

**Status:** besloten 30-07-2026 (René), uitvoering gepland als stap D van de
oplevervolgorde (§15). Bron: `docs/BESLUITENREGISTER_RENE_2026-07-30.md` (B2).
Dit document is het canonieke kader; het detailontwerp (schema, endpoints,
UI-flows) volgt in stap D en wordt hier aangevuld.

## Besluit (samengevat)
- Expliciet herkomstsysteem voor trainingen en plannen met minimaal deze
  herkomstwaarden: **Sparki-plan · gekoppelde trainer · externe coach ·
  geïmporteerd extern plan · handmatig door gebruiker · later door Sparki
  aangepast**.
- Upload/import van een extern trainingsplan, met behoud van de oorspronkelijke
  herkomst en een versie-/wijzigingshistorie.
- Zichtbare verantwoordelijkheid en actuele begeleidingsmodus voor de gebruiker.
- Veilige verwerking van bestanden en inhoud; **geen stille omzetting** van
  externe inhoud naar "Sparki" of "coach".

## Veiligheidsrisico in een extern plan
Waarschuwen, niet blokkeren: nadrukkelijk waarschuwen, uitleggen wat het risico
is, een veiliger alternatief voorstellen, de gebruiker **niet** automatisch
blokkeren, geen medische zekerheid claimen, en de waarschuwing plus de
gebruikersbeslissing loggen.

## Bekende technische uitgangssituatie (eerlijk)
- `planned_workouts.source` wordt vandaag hard genormaliseerd naar
  `coach|sparki`; dat moet vervallen c.q. uitgebreid worden — een geïmporteerd
  plan mag nooit stil "coach" of "sparki" worden.
- Er bestaat al een Data Origin-/herkomstlaag voor meetdata; de plan-herkomst
  sluit daar conceptueel op aan maar is een eigen laag op plannen/trainingen.
- Externe coach is een **herkomstlabel**, geen accountrol (hoofdstuk J-model).

## Acceptatiecriteria (uit het besluit)
1. Herkomst blijft door de hele keten (opslag → analyse → UI) zichtbaar en
   verandert nooit zonder expliciete, gelogde actie.
2. Upload-round-trip bewezen met een echt extern planbestand.
3. Versiehistorie toont wie/wat/wanneer per wijziging.
4. Waarschuwingsflow (risico → uitleg → alternatief → gebruikersbesluit) is
   gelogd en getest; geen automatische blokkade.
