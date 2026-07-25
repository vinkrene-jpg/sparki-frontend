---
name: Sparki EU-uitrol & meertaligheid
description: Besliste productrichting — EU-brede uitrol, alle EU-talen, landensites met marketing
---
- Beslist (25 jul 2026): Sparki wordt uiteindelijk EU-breed uitgerold; alle EU-talen moeten ondersteund worden; per land komen marketingwebsites.
- **Gevolg voor al het bouwwerk:** alle user-facing copy zit nu hard-coded Nederlands in componenten én in LLM-prompts (elke prompt heeft een eigen taalregel). Vertaalbaarheid vereist t.z.t. één centrale stringlaag (i18n) + taalparameter door de AI-gateway; nieuwe features liefst nu al geen copy in backend-logica verstoppen.
- **Hoe toepassen:** nog géén i18n-refactor gestart zonder expliciete opdracht; wel bij nieuwe modules copy zoveel mogelijk in de presentatielaag houden.
