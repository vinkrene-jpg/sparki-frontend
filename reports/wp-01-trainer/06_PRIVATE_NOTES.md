# WP-01 — STAP 6: PRIVÉNOTITIES EN ISOLATIE

Controle uitgevoerd; **geen herstel nodig**, geen codewijziging.

- Trainer A ↔ trainer B: alle context-item-routes (list/create/update/delete) filteren hard op `coachClerkId = caller` — trainer B kan items van A niet lezen of muteren. Hoofdtrainer krijgt in WP-01 dus ook géén automatische inzage (er bestaat geen leesroute buiten de eigenaar).
- Sporter: coach-context-items zijn in het bestaande ontwerp bewust **werkafspraken/instructies** (blessure-afspraak, school/werk, beperking, wedstrijddoel, instructie) — transparant voor de sporter via `/context-items/about-me` en als sturing in het voedingsadvies (keyword-gefilterd, max 3). Dit is gedocumenteerd, getest gedrag ("coachcontext: CRUD + transparantie voor de sporter" ✓), geen lek: het zijn afspraak-items, geen geheime notities. Echte privé-observaties van Sparki over de sporter blijven bij visibility=private en bereiken een coach nooit (coach-parent-private-memory 3/3 ✓, shared-raw-fields 3/3 ✓).
- Koppeling of context weg ⇒ toegang weg: context-items-gate 403 bij deelt-niet ✓; einde koppeling/toewijzing sluit alle cockpitroutes (stap-3-test 6/6 ✓). Verwijderen van een koppeling geeft nergens nieuwe toegang (routes checken op leesmoment).
- Audit: cockpit-mutaties loggen via writeAudit metadata (event/actor/subject), nooit notitie-inhoud.

**Afwijking t.o.v. werkpakket-tekst, eerlijk benoemd:** het pakket zegt "sporter ziet privénotitie niet". In Sparki bestaan er geen verborgen trainer-notities over een sporter: het bestaande, door tests vastgelegde productbesluit is transparantie van afspraak-items richting de sporter. Een aparte, echt onzichtbare notitielaag introduceren zou een productbesluit zijn dat buiten Beslisblok 02 valt — niet gedaan; ter bevestiging aan René.
