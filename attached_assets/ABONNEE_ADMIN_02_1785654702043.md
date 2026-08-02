# ABONNEE_ADMIN_02 — Lidnummer en abonnee-administratie

**Type:** bouwopdracht voor Replit
**Status:** vastgesteld 02-08-2026. Vervangt `ABONNEE_ADMIN_01` (taak #537), die is INGETROKKEN.
**Regelcodes:** `ABA-01` t/m `ABA-52`
**Plaats in de bouwstraat:** golf 2, ná `ABONNEMENT_01`. Dat is een technische afhankelijkheid — de administratie heeft de abonnementenlaag nodig — geen vrijgavepoort.

**Uitvoeringsregel:** deze opdracht is de volledige uitvoeringsvrijgave. Replit voert alle fasen zelfstandig achter elkaar uit en rapporteert zonder te wachten. Mirror toetst parallel.

---

## 0. Wat er verandert ten opzichte van v1

`ABA-01` — De startvoorwaarde *"integraal uitvoeren zodra `DATA_TRUST_01` én `ABONNEMENT_01` door Mirror zijn goedgekeurd — niet eerder"* is **vervallen**. Dat was een wachtpoort uit de oude uitvoeringsregel. Wat blijft is de technische afhankelijkheid op de abonnementenlaag.

`ABA-02` — De reden dat v1 op heruitgifte wachtte — de scheiding tussen **betaler en gebruiker** — is nu besloten en in deze opdracht verwerkt (hoofdstuk 3).

`ABA-03` — De open besluiten `P-1` t/m `P-5` zijn beantwoord, op één na. Zie hoofdstuk 8.

---

## 1. Harde grenzen

`ABA-04` — **Geen tweede abonnements- of rechtensysteem.** `resolveEntitlements` blijft de enige rechtenbron en wordt uitsluitend lezend geraakt.

`ABA-05` — Verplicht hergebruik: Clerk · Stripe · `lib/db/src/schema/billing.ts` · `schema/support.ts` · `routes/privacy.ts` · `admin_ops_log`. Geen parallelle administratie, geen tweede auditlog, geen eigen betaalkoppeling.

`ABA-06` — Bewaartermijnen worden **centraal configureerbaar** gebouwd. Deze opdracht stelt zelf geen juridische waarden vast; de besloten termijnen staan in het besluitenoverzicht van 02-08 hoofdstuk 5 en worden ingevuld na het toetsvoorstel.

`ABA-07` — Geen mockdata, geen voorbeeldabonnees, geen verzonnen lidnummers in productie.

---

## 2. Lidnummer

`ABA-08` — Elke abonnee krijgt één vast **lidnummer**, tevens klantnummer. Eén per abonnee, uniek en onveranderlijk.

`ABA-09` — Vorm: `SPK-JJJJ-NNNNNN`. Het jaartal is het jaar van eerste toekenning en verandert nooit meer mee.

`ABA-10` — Toekenning via een **database-sequence of unieke sleutel**. Uitdrukkelijk **geen** `SELECT MAX()+1` — dat levert dubbele nummers op bij gelijktijdige aanmeldingen.

`ABA-11` — De migratie die bestaande abonnees een nummer geeft is **idempotent**: twee keer draaien levert hetzelfde resultaat en nooit een tweede nummer voor dezelfde abonnee.

`ABA-12` — Het lidnummer verandert niet bij: wisselen van pakket · opzeggen en opnieuw beginnen · overgang van zelf betalen naar clubafname · het bereiken van de 18e verjaardag · wisselen van club.

`ABA-13` — Het lidnummer is zichtbaar voor de abonnee zelf en in de beheeromgeving. Het verschijnt op facturen en in supportcontact.

`ABA-14` — Een verwijderd account geeft zijn lidnummer **niet terug in omloop**. Hergebruik van nummers is uitgesloten.

---

## 3. Betaler en gebruiker zijn twee dingen

`ABA-15` — Vandaag bestaat er geen scheiding tussen betaler en gebruiker in de billing. Die komt hier. Drie entiteiten: **abonnee** (wie de toegang gebruikt) · **betaler** (wie de rekening voldoet) · **abonnement** (wat er geleverd wordt).

`ABA-16` — Vier combinaties moeten werken:
1. sporter betaalt voor zichzelf
2. **club betaalt voor een lid** (Compleet-afname)
3. **ouder betaalt voor een jeugdlid**
4. club betaalt voor een jeugdlid — met verplichte toestemming van de ouder

`ABA-17` — De betaler ziet **geen inhoudelijke gegevens** van de abonnee. Betalen geeft geen inzage. Een club ziet uitsluitend **aantallen**: hoeveel leden Compleet gebruiken. Niet wie, en niet wie geweigerd heeft.

`ABA-18` — De abonnee ziet altijd **wie voor hem betaalt** en kan dat weigeren.

`ABA-19` — Clubafname volgt de besloten regels: club kiest per lid · maandelijkse facturatie · staffelkorting in vaste tredes · toegevoegd lid krijgt Compleet direct maar wordt de volgende maand verrekend · bij vertrek of stopzetting houdt het lid Compleet nog één maand · had de sporter zelf al Compleet, dan neemt de club over en wordt het resterende deel van zijn eigen betaling terugbetaald, met bericht aan de sporter.

`ABA-20` — Weigert een lid de clubafname, dan telt dat als **zelf opzeggen**: het materiaal wordt afgeschermd en de betaling door de club stopt direct. Hij kan later alsnog akkoord gaan.

---

## 4. Levenscyclus van een abonnement

`ABA-21` — Statussen minimaal: `actief` · `opgezegd_loopt_af` · `verlopen` · `overgenomen_door_club` · `geweigerd` · `account_verwijderd`.

`ABA-22` — **Bij het verlopen hangt het gedrag af van wie opzegt.** Zegt de **club** op, dan blijft wat de sporter had gewoon bewaard en zichtbaar. Zegt de **sporter zelf** op, dan wordt het afgeschermd.

`ABA-23` — Afgeschermd materiaal blijft bewaard zolang het account bestaat. De sporter **ziet dát er materiaal is afgeschermd** — het verdwijnt niet zonder spoor.

`ABA-24` — Gaat hij later weer betalen, dan **komt alles terug** — niet alleen het laatste jaar.

`ABA-25` — Deze regel geldt voor **alle** pakketgebonden gegevens, niet alleen routes.

`ABA-26` — Accountverwijdering: dertig dagen bewaartermijn, met de keuze om direct definitief te verwijderen. Bericht op het moment van verwijderen, geen aparte herinnering. Een uitdraai wordt meegegeven.

`ABA-27` — Voor een **club** geldt altijd dertig dagen; direct definitief verwijderen kan niet. De clubomgeving blijft daarna als archief bestaan voor de beheerder, en het clubauditlog blijft drie jaar bewaard.

---

## 5. Administratief dossier

`ABA-28` — Per abonnee is opvraagbaar: lidnummer · aanmaakdatum · huidig pakket · pakkethistorie met begin- en einddatum · wie betaalt en sinds wanneer · betaalgeschiedenis · facturen · openstaande bedragen · toestemmingen en wijzigingen daarin · supportcontacten · statuswijzigingen met datum en actor.

`ABA-29` — Betaalgedrag wordt vastgelegd als **feit**, nooit als score of stigmatiserend oordeel.

`ABA-30` — Iedere wijziging in het dossier gaat naar `admin_ops_log` met actor, tijdstip, oude en nieuwe waarde. Append-only.

`ABA-31` — De abonnee heeft **inzage in zijn eigen dossier** inclusief zijn toestemmingenoverzicht.

`ABA-32` — Bij een minderjarige ziet de ouder het administratieve deel (pakket, betaler, facturen). **Niet** de inhoudelijke sportgegevens — die vallen onder de bestaande ouderrechten en veranderen hier niet.

---

## 6. Fasering

| Fase | Inhoud | Klaar als |
|---|---|---|
| **F0** | Inventarisatie: bestaande billing-, support-, privacy- en auditstructuren; waar zitten al abonnee-achtige velden. Geen code | Inventaris opgeleverd, dubbelingen benoemd |
| **F1** | Lidnummer: sequence, unieke sleutel, idempotente migratie voor bestaande abonnees | Geen duplicaat mogelijk, ook niet bij gelijktijdige aanmelding |
| **F2** | Betaler/gebruiker-scheiding in het datamodel | De vier combinaties uit `ABA-16` bestaan als data |
| **F3** | Clubafname: per lid kiezen, weigeren, overnemen, terugbetalen, staffel, maandfacturatie | `ABA-19` en `ABA-20` aantoonbaar |
| **F4** | Levenscyclus en afscherming, inclusief terugkeer bij hervatting | `ABA-22` t/m `ABA-25` aantoonbaar |
| **F5** | Administratief dossier en beheerweergave | `ABA-28` t/m `ABA-32` aantoonbaar |
| **F6** | Bewaartermijnen aansluiten op de centrale configuratie | Geen termijn hardcoded |
| **F7** | Eindbewijs | Alle Mirror-toetsen groen |

---

## 7. Mirror — directe herstelgronden

`ABA-33` — Twee abonnees met hetzelfde lidnummer.
`ABA-34` — Een lidnummer dat verandert na een pakketwissel, opzegging, clubovername of verjaardag.
`ABA-35` — Een hergebruikt lidnummer van een verwijderd account.
`ABA-36` — Een migratie die bij tweede uitvoering een tweede nummer toekent.
`ABA-37` — Een betaler die inhoudelijke gegevens van de abonnee kan zien.
`ABA-38` — Een club die kan zien **welke** leden Compleet gebruiken of geweigerd hebben.
`ABA-39` — Een abonnee die niet kan zien wie voor hem betaalt.
`ABA-40` — Afgeschermd materiaal dat verdwijnt zonder dat de abonnee ziet dat het bestaat.
`ABA-41` — Materiaal dat na hervatting van de betaling niet volledig terugkomt.
`ABA-42` — Een tweede rechtenbron naast `resolveEntitlements`, of een schrijvende aanroep daarop.
`ABA-43` — Een bewaartermijn die hardcoded in de code staat.
`ABA-44` — Een dossierwijziging die niet in `admin_ops_log` terechtkomt.
`ABA-45` — Een minderjarige die zelfstandig een betaling kan starten.
`ABA-46` — Clubafname voor een jeugdlid zonder vastgelegde toestemming van de ouder.

---

## 8. Besluiten die ik hierin heb genomen

Deze zijn van mij, niet van René, en met één zin terug te draaien.

`ABA-47` — **`P-1` pauzeren: niet bouwen.** Er komt geen pauzefunctie in v1. Opzeggen en later opnieuw beginnen volstaat, en het lidnummer blijft daarbij hetzelfde. Reden: een pauzestand levert een extra toestand op in elke rechtencontrole, voor een gebruik dat we nog nooit hebben gezien.

`ABA-48` — **`P-2` refundbeleid: rechten lopen tot de einddatum.** Wie opzegt houdt toegang tot het einde van de betaalde periode; er wordt niet naar rato terugbetaald. Enige uitzondering is de al besloten terugbetaling wanneer een club de betaling overneemt. Overige terugbetalingen gaan handmatig via Stripe — **geen automatisch refundproces in v1.**

`ABA-49` — **`P-3` downgradegedrag: één regel voor alles.** Wat voor routes geldt, geldt voor alle pakketgebonden gegevens: afschermen, niet verwijderen, zichtbaar dat het bestaat, volledig terug bij hervatting. Geen aparte regels per gegevenssoort.

`ABA-50` — **`P-5` een minderjarige start geen eigen betaling.** Betaling loopt via de ouder of via de club. Reden: een betaalverplichting aangaan is niet iets waar een minderjarige zelfstandig aan gebonden moet worden, en het kost niets om dat dicht te houden.

---

## 9. Wat open blijft

`ABA-51` — **`P-4`: wie is bevoegd voor een overleden abonnee, een privacy hold en terugbetalingen bij langdurige afwezigheid van de oprichter.** Dit is geen uitwerkingsvraag maar een continuïteitsbesluit dat samenhangt met het bestaande opvolgingskader onder Futur Holding. Het blokkeert niets in deze opdracht: bouw de statussen en handelingen, laat de bevoegdheid configureerbaar en leeg.

`ABA-52` — De **zes bewaartermijnen in de configuratie** worden ingevuld na het toetsvoorstel uit golf 2.3. Tot die tijd blijven ze leeg en blokkeren ze uitsluitend de betaalde publieke release, niet de bouw.
