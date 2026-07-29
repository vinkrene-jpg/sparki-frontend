# WP-04 — Ouder/jeugd-verificatie & herbevestiging

**Scope:** volledige verificatie van de bestaande ouderomgeving tegen het fase-2-model: per-categorie toestemming, tierovergangen (u16→16-17→18+), herbevestigingsflow, veiligheidsminimum, clubcontext-consent (<16 via ouder). Vooral testen en dichttimmeren, weinig nieuwbouw.
**Hergebruik:** parent_athlete_links, lib/parent-permissions (EffectiveParentAccess), routes/parent.ts (requireParentAccess), club_consents, bestaande coach-parent-tests.
**Niet wijzigen:** SAFETY_CATEGORIES-semantiek; 18+ sluit alles.
**API:** geen nieuwe routes verwacht; eventueel herbevestigings-endpoint als die ontbreekt.
**UX:** herbevestiging duidelijk uitgelegd aan ouder én jeugdsporter (eigen regie).
**Rechten:** fail-closed op elk onduidelijk punt (onbekende leeftijd = minimum).
**Tests:** tierovergang sluit niet-veiligheidsrechten; herbevestiging heropent alleen na expliciete keuze; clubcontext zonder ouder-consent blijft dicht voor <16.
**Bewijs:** testoutput met fixture-jeugdsporter (geboortedatum-manipulatie in test).
**Risico:** legacy-links zonder consentConfirmedAt → gedrag expliciet vastleggen (nu: veiligheidsminimum, gedocumenteerd).
**Stopcondities:** een jeugd-/consentregel blijkt niet fail-closed afdwingbaar.
**Afhankelijkheden:** geen (parallel naast WP-01/02). **Complexiteit:** S/M.
