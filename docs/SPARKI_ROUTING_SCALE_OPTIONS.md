# Schaalopties routeverificatie — beslisdocument (31-07-2026)

**Status: alleen beslisdocument. Er is bewust níets van dit document gebouwd**
(harde grens in de opdracht van 31-07-2026): geen eigen Overpass-server, geen
kaartdatakopie, geen parallelle tegelverificatie, geen tweede routingengine,
geen brede schaalarchitectuur.

Context: de verificatieketen leunt op publieke Overpass-mirrors (14–98 s in
koude gebieden, 429-bursts bij kwadrant-splitsing, mirror-uitval) en op
PDOK/BGT (NL) + GRB (Vlaanderen). Fail-closed blijft in élk scenario staan.

| # | Optie | Noodzaak | Kosten | Beheer | Kaartactualisatie | Capaciteit | Foutafhandeling | Afhankelijkheid | Verwachte schaal | Wanneer echt nodig |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Publieke Overpass blijven gebruiken (huidig) | geen — werkt vandaag | €0 | geen | altijd actueel (OSM live) | laag: rate-limits, 10k-elementengrens, 14–98 s koud | fail-closed 422/`ROUTE_UNVERIFIABLE` bestaat al | hoog (goodwill publieke mirrors) | tientallen gebruikers, NL/VL | nu — default |
| 2 | Publieke diensten + gecontroleerde fallback (2e mirror-set, negatieve caching, in-flight-dedupe, DB-warme cache) | eerste knelpunt: koude gebieden + mirror-uitval | zeer laag (alleen bouwtijd) | minimaal | OSM live | middel: bursts gladgestreken, warme paden gedeeld | zelfde fail-closed keten, minder onverifieerbaar door hergebruik | middel | honderden gebruikers | **eerstvolgende stap** zodra tester-groei of >enkele % `ROUTE_UNVERIFIABLE` in de praktijk |
| 3 | Eigen regionale kaartbron (NL+BE-extract, dagelijkse OSM-diff, alleen de tags die de poorten nodig hebben) | pas bij structurele mirror-limieten | laag-middel (kleine VM/dienst, ~GB's) | dagelijkse importpijplijn bewaken | 1×/dag diff (acceptabel: obstakels wijzigen traag; route-niveau blijft vers gemeten) | hoog voor NL/BE | eigen bron kapot ⇒ terugvallen op optie 1/2, nooit fail-open | eigen infra i.p.v. derden | duizenden gebruikers NL/BE | bij commerciële launch NL/BE of aanhoudende mirror-blokkades |
| 4 | Volledig zelf-gehoste kaartinfrastructuur (eigen Overpass/EU-breed) | alleen bij EU-uitrol op schaal | hoog (zware server(s), 100+ GB, dagen initial import) | serieus (updates, monitoring, failover) | zelf te kiezen | zeer hoog | volledig in eigen hand | maximale eigen-infralast | tienduizenden+, EU-breed | pas bij bewezen EU-schaal — niet eerder bouwen |
| 5 | Verificatie opdelen per tegel + gecontroleerd parallel (bestaande tegelcaches als eenheid, kleine parallelfactor met rate-limit-budget) | versnelt koude verificatie zonder nieuwe bron | laag (bouwtijd) | geen extra infra | volgt bronopties 1–3 | middel: koude p95 omlaag | per-tegel eerlijk gat blijft eerlijk gat; overschrijding budget ⇒ onverifieerbaar | geen nieuwe | orthogonaal aan 1–4 | samen met optie 2, zodra koude-p95 een gemeten testerklacht is |

**Advies (niet uitgevoerd):** blijf op optie 1; bouw als eerstvolgende stap
optie 2 + 5 (samen met het cache-verbetervoorstel in
`SPARKI_ROUTING_CACHE_INVENTORY.md`) zodra de meetbare drempel geraakt wordt;
beslis over optie 3 pas bij commerciële NL/BE-groei; optie 4 niet vóór bewezen
EU-schaal. Elke stap vereist vooraf een ingevulde risicoanalyse
(`SPARKI_ROUTING_RISK_ANALYSIS_TEMPLATE.md`).
