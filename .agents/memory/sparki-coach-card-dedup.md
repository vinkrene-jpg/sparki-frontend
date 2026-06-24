---
name: Sparki coach card — lens duplication & scannability
description: Why the daily coach card showed the same sentence twice and how the surface stays scannable.
---

# Coach card: lenses are subsets of "Wat valt op"

The observation engine derives "Wat valt op" from ALL observations and each lens
(patronen / beter dan verwacht / verdient aandacht) from a tone-filtered subset.

- **Consequence:** on a day dominated by one tone (e.g. all concerns) "Wat valt
  op" and "Verdient aandacht" render the *identical* sentence. Likewise the hero
  advice headline equals `adviesVandaag`, so showing both repeats it.
- **Rule:** dedupe at the presentation layer (normalized containment against
  "Wat valt op"), never by changing/inventing engine output. Removing repetition
  is honest; fabricating distinct text is not.
- **Scannability:** lead the card/hero with ONE insight + the advice headline +
  actions; push the full lens breakdown and the reasoning (WhyContent) behind the
  "Waarom zegt Sparki dit?" disclosure. Don't render a separate "Waarom dit
  advies" block in the same panel as WhyContent — their sentences overlap.
- **How to apply:** any time multiple coach text fields are shown together, check
  whether one is a superset of another before rendering both.
