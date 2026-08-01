# TEAM_ONBOARDING_01 — HERSTELPROTOCOL

Van toepassing wanneer Mirror of praktijkgebruik defecten vindt.

1. **Classificeer** elk defect: rechtenlek (kritiek), datacorruptie (kritiek),
   flow-breuk (hoog), UX/copy (normaal).
2. **Kritieke defecten**: onboarding-instroom voor organisatietype `TEAM` per
   direct dichtzetten via bestaande feature-flag-laag; bestaande organisaties
   blijven leesbaar — nooit data verwijderen als "herstel".
3. **Herstel gebeurt in dit pakket**, tenzij de oorzaak aantoonbaar in het
   rollen-/rechtenmodel ligt (dan terug naar CLUB_RECHTEN_01) of in de
   club-onboardingmechaniek (dan CLUB_ONBOARDING_01).
4. Elke fix: regressietest toevoegen + volledige relevante testset opnieuw
   draaien (team-organisatie, team-abonnement, club, club-onboarding,
   cross-account-isolation, typecheck).
5. Hersteloplevering opnieuw als **BUILD_DELIVERED** met start-/eind-SHA en
   exitcodes; Mirror hertoetst uitsluitend de vaste gepushte SHA.
6. Rollback: migraties zijn additief; terugrollen mag bestaande records nooit
   onzichtbaar of onbereikbaar maken.
