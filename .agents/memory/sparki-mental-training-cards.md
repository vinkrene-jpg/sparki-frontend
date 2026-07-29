---
name: Mentale Training kaarten met diepgang-sterren
description: Per-kaart diepgang (1–3 sterren) voor de zes Mentale Bibliotheek-kaarten; besliskader en lagenmodel.
---

Beslist (René, 29 jul 2026): de sterren regelen de **diepgang per kaart**, niet één globale profielvoorkeur.

Lagenmodel (engines/mental): ★ = alleen de kern, ★★ = + "zo doe je het", ★★★ = + verdieping (waarom het werkt, valkuil, weekoefening).
**Regel:** lagen voegen alleen toe — de kern bij ★ is byte-identiek aan de kern bij ★★★ (test borgt dit). Inhoud is vaste vakkennis, geen gegenereerde tekst.

Opslag: `mental_card_depths` (clerkId+cardKey uniek, upsert). Geen rij = standaard ★ (bewust laagdrempelig). Server stelt de kaart al op het gekozen niveau samen; de client krijgt verborgen lagen niet eens binnen.

**How to apply:** nieuwe mentale kaarten krijgen alle drie lagen + een regel in de kaarten-test; nooit diepgang client-side "wegklappen" van volledige content.
