---
name: Doelen-leeftijdsbanden (DOELEN_01)
description: Leeftijdsbandpoort voor alle doel-schrijfpaden; soft-delete zichtbaarheid; vertaal-doorvraaglimiet.
---

- **Eén policy-poort voor álle schrijfpaden.** `goal-policy` (band uit leeftijd, onbekend ⇒ meest beschermende band, fail-closed) moet op ELK pad zitten dat een doel schrijft: sporter-create, sporter-update, trainervoorstel, voorstel-acceptatie én AI-vertaaloutput. **Why:** review vond dat een gedeeltelijke PUT anders de band omzeilt; valideer daarom altijd de VOLLEDIGE samengestelde rij (bestaand + patch), nooit alleen de patch.
- **Soft-delete = filteren in élke consumer.** Doel-verwijderen is status `dropped`; elke leesquery (eigen picture, trainer-inzage, ouder-inzage) moet expliciet `status != 'dropped'` filteren — de eerste implementatie lekte dropped doelen via de eigen picture.
- **AI-vertaling:** doorvraaglimiet (max 2) serverzijdig afdwingen op de history-lengte, nooit client-side; modeloutput gaat opnieuw door de bandvalidatie en valt bij falen terug op een deterministisch gedragsdoel zonder verzonnen getallen.
- **Doelinzage trainer** wordt gedragen door een bestaand (niet-dropped) doel met `origin=trainervoorstel` + `trainerClerkId` — geen aparte grant-tabel; verdwijnt het doel, dan verdwijnt de inzage vanzelf.
