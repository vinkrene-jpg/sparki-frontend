// TRAININGSVORMEN_01 F1 — startvulling van de bibliotheek (TRV-27, bijlage A).
//
// Regels:
// - Elke vorm hier is een FAMILIE met een parameterbereik (startwaarden; ze
//   worden bij de inschalingsopdracht TRV-94 definitief).
// - Onderbouwing: ALLES staat op "praktijkvorm" met toelichting
//   "nog niet ingeschaald" tot de aparte inschalingsopdracht is uitgevoerd
//   (TRV-94). Bronnen worden NIET verzonnen (TRV-27) — de bronnentabel blijft
//   leeg tot het inschalen.
// - Uitlegteksten zijn beschrijvend (hoe voer je hem uit), zonder
//   effectbeloften (TRV-55). Een vorm zonder geschreven uitleg blijft
//   status "concept" en is niet zichtbaar voor sporters (TRV-27).
// - Afspraakvormen (TRV-11): derny, motortraining en baanvormen die een
//   velodroom vereisen dragen vereistAfspraak: true.
// - Idempotent op slug: bestaande rijen worden niet overschreven, zodat
//   latere inschaling/redactie nooit door een herstart wordt teruggedraaid.

import { eq } from "drizzle-orm";
import {
  db,
  trainingFormsTable,
  trainingFormParametersTable,
  type Belastingssoort,
} from "@workspace/db";

type SeedParams = {
  duurMin?: number;
  duurMax?: number;
  duurStd?: number;
  maat?: "pct_ftp" | "zone" | "rpe" | "kg" | "herhalingen";
  intMin?: number;
  intMax?: number;
  intStd?: number;
  herhMin?: number;
  herhMax?: number;
  pauzeMin?: number;
  pauzeMax?: number;
};

type SeedForm = {
  slug: string;
  naam: string;
  discipline: "weg" | "indoor" | "baan" | "kracht" | "mobiliteit" | "techniek" | "wandelen";
  categorie: string;
  soort: Belastingssoort;
  doel: string;
  uitleg: string;
  gebruik: string;
  fouten: string;
  afspraak?: boolean;
  minLeeftijd?: number;
  params: SeedParams;
};

const F: SeedForm[] = [
  // ── Duur en herstel ────────────────────────────────────────────────────
  { slug: "herstelrit", naam: "Herstelrit", discipline: "weg", categorie: "Duur en herstel", soort: "herstel",
    doel: "Actief herstellen na een zware dag zonder nieuwe belasting toe te voegen.",
    uitleg: "Een korte, heel rustige rit in zone 1. De benen draaien los, het tempo blijft zo laag dat praten moeiteloos gaat.",
    gebruik: "Vlak terrein, licht verzet, hoge cadans. Stop eerder als vermoeidheid toeneemt.",
    fouten: "Te hard rijden — een herstelrit die in zone 2 belandt is geen herstel meer.",
    params: { duurMin: 30, duurMax: 75, duurStd: 45, maat: "pct_ftp", intMin: 40, intMax: 55, intStd: 50 } },
  { slug: "duurrit-laag", naam: "Duurrit laag tempo", discipline: "weg", categorie: "Duur en herstel", soort: "aeroob_duur",
    doel: "De aerobe basis onderhouden en uitbouwen op een goed vol te houden tempo.",
    uitleg: "Een gelijkmatige rit in zone 2. Het tempo voelt comfortabel; een gesprek blijft mogelijk.",
    gebruik: "Houd het vermogen vlak, ook op hellingen. Eet en drink onderweg bij ritten boven het uur.",
    fouten: "Steeds kleine uitschieters naar zone 3 — daarmee wordt de rit zwaarder dan bedoeld.",
    params: { duurMin: 60, duurMax: 180, duurStd: 90, maat: "pct_ftp", intMin: 56, intMax: 75, intStd: 68 } },
  { slug: "lange-duurrit", naam: "Lange duurrit", discipline: "weg", categorie: "Duur en herstel", soort: "aeroob_duur",
    doel: "Duurvermogen en vetverbranding trainen door lang aaneengesloten te rijden.",
    uitleg: "Een lange rit in zone 2, eventueel met korte natuurlijke variatie. De laatste uren zijn het doel: daar gebeurt het werk.",
    gebruik: "Plan de route en voeding vooraf; begin rustiger dan je kunt. Richtlijn: 60–90 gram koolhydraten per uur bij lange versies.",
    fouten: "Te snel starten en de laatste uren stilvallen; te weinig eten.",
    params: { duurMin: 150, duurMax: 360, duurStd: 210, maat: "pct_ftp", intMin: 56, intMax: 75, intStd: 65 } },
  { slug: "gefractioneerde-duurrit", naam: "Gefractioneerde duurrit", discipline: "weg", categorie: "Duur en herstel", soort: "aeroob_duur",
    doel: "Duurbelasting opbouwen wanneer één lange rit niet in de dag past.",
    uitleg: "De duurbelasting van één lange rit verdeeld over twee kortere ritten op dezelfde dag, beide in zone 2.",
    gebruik: "Houd beide delen rustig en eet tussendoor gewoon. De som telt, niet het tempo.",
    fouten: "De tweede rit als aparte training zien en te hard rijden.",
    params: { duurMin: 60, duurMax: 150, duurStd: 90, maat: "pct_ftp", intMin: 56, intMax: 75, intStd: 65 } },
  // ── Tempo en drempel ───────────────────────────────────────────────────
  { slug: "tempoblok", naam: "Tempoblok", discipline: "weg", categorie: "Tempo en drempel", soort: "aeroob_hoog",
    doel: "Wennen aan langer stevig doorrijden onder de drempel.",
    uitleg: "Aaneengesloten blokken in zone 3: stevig maar beheersbaar, ademhaling duidelijk voelbaar.",
    gebruik: "Rijd de blokken gelijkmatig, met rustige zone-1-pauzes ertussen.",
    fouten: "Het blok als drempeltraining rijden — tempo is bewust een tandje eronder.",
    params: { duurMin: 20, duurMax: 60, duurStd: 40, maat: "pct_ftp", intMin: 76, intMax: 87, intStd: 82, herhMin: 1, herhMax: 3, pauzeMin: 5, pauzeMax: 10 } },
  { slug: "sweet-spot-blok", naam: "Sweet spot-blok", discipline: "weg", categorie: "Tempo en drempel", soort: "aeroob_hoog",
    doel: "Veel trainingsprikkel per uur, net onder de drempel.",
    uitleg: "Blokken net onder FTP (ongeveer 88–94%). Zwaarder dan tempo, lichter dan drempel; goed te herhalen.",
    gebruik: "Twee tot drie blokken met ruime pauze. Vlak vermogen aanhouden, binnen of buiten.",
    fouten: "Boven de 94% uitkomen waardoor het feitelijk drempelwerk wordt.",
    params: { duurMin: 10, duurMax: 30, duurStd: 20, maat: "pct_ftp", intMin: 88, intMax: 94, intStd: 90, herhMin: 2, herhMax: 4, pauzeMin: 5, pauzeMax: 10 } },
  { slug: "drempelinterval", naam: "Drempelinterval", discipline: "weg", categorie: "Tempo en drempel", soort: "aeroob_hoog",
    doel: "Het lichaam laten wennen aan rijden op de omslagwaarde.",
    uitleg: "Herhalingen van 8–20 minuten rond FTP (95–105%). Zwaar maar controleerbaar; de laatste herhaling moet nog lukken.",
    gebruik: "Begin aan de onderkant van het bereik. Pauze ongeveer de helft van de bloklengte.",
    fouten: "De eerste herhaling te hard, waardoor de rest instort.",
    params: { duurMin: 8, duurMax: 20, duurStd: 10, maat: "pct_ftp", intMin: 95, intMax: 105, intStd: 100, herhMin: 2, herhMax: 4, pauzeMin: 4, pauzeMax: 10 } },
  { slug: "over-under", naam: "Gebroken drempel (over-under)", discipline: "weg", categorie: "Tempo en drempel", soort: "aeroob_hoog",
    doel: "Leren herstellen terwijl het tempo hoog blijft, zoals in koers.",
    uitleg: "Binnen één blok wisselen tussen net onder (ca. 95%) en net boven (ca. 110%) de drempel, bijvoorbeeld 2 minuten onder / 1 minuut boven.",
    gebruik: "Blijf zitten en houd de wissels strak op tijd. Kies het aantal blokken naar vorm.",
    fouten: "De 'onder'-stukken te licht maken waardoor het gewone intervallen worden.",
    params: { duurMin: 9, duurMax: 18, duurStd: 12, maat: "pct_ftp", intMin: 95, intMax: 112, intStd: 100, herhMin: 2, herhMax: 4, pauzeMin: 5, pauzeMax: 8 } },
  { slug: "subthreshold-serie", naam: "Subthreshold serie", discipline: "weg", categorie: "Tempo en drempel", soort: "aeroob_hoog",
    doel: "Veel tijd net onder de drempel verzamelen met korte, herhaalbare blokken.",
    uitleg: "Korte blokken (3–8 minuten) op 90–97% FTP met korte pauzes, vaak in meerdere series.",
    gebruik: "Houd de blokken bewust nét onder de omslag: gecontroleerd, geen wedstrijdgevoel.",
    fouten: "Sluipenderwijs boven FTP uitkomen; dan is het geen subthreshold meer.",
    params: { duurMin: 3, duurMax: 8, duurStd: 6, maat: "pct_ftp", intMin: 90, intMax: 97, intStd: 94, herhMin: 4, herhMax: 10, pauzeMin: 1, pauzeMax: 3 } },
  // ── Hoge intensiteit ───────────────────────────────────────────────────
  { slug: "vo2max-klassiek", naam: "VO2max-interval klassiek", discipline: "weg", categorie: "Hoge intensiteit", soort: "aeroob_hoog",
    doel: "De maximale zuurstofopname aanspreken met blokken van enkele minuten.",
    uitleg: "3–6 herhalingen van 3–5 minuten op 106–120% FTP. De ademhaling zit tegen het maximum; de laatste minuten zijn zwaar.",
    gebruik: "Ruime warming-up. Pauze ongeveer gelijk aan de bloklengte. Stop de sessie als het vermogen ver wegzakt.",
    fouten: "Starten als een sprint; het doel is de hele blokduur hoog zitten, niet de eerste 30 seconden.",
    minLeeftijd: 14,
    params: { duurMin: 3, duurMax: 5, duurStd: 4, maat: "pct_ftp", intMin: 106, intMax: 120, intStd: 112, herhMin: 3, herhMax: 6, pauzeMin: 3, pauzeMax: 5 } },
  { slug: "interval-30-15", naam: "Korte intervallen 30/15", discipline: "weg", categorie: "Hoge intensiteit", soort: "aeroob_hoog",
    doel: "Veel tijd op hoge zuurstofopname met korte werk-rustwisselingen.",
    uitleg: "Series van 30 seconden hard (rond 115–130% FTP) en 15 seconden vrijwel stilvallen, in blokken van 6–13 minuten.",
    gebruik: "Twee tot drie blokken met ruime pauze. De 15 seconden echt rustig nemen.",
    fouten: "De 30 seconden als sprint invullen; het ritme moet de hele serie houdbaar blijven.",
    minLeeftijd: 14,
    params: { duurMin: 6, duurMax: 13, duurStd: 10, maat: "pct_ftp", intMin: 115, intMax: 130, intStd: 120, herhMin: 2, herhMax: 3, pauzeMin: 4, pauzeMax: 6 } },
  { slug: "interval-40-20", naam: "Korte intervallen 40/20", discipline: "weg", categorie: "Hoge intensiteit", soort: "aeroob_hoog",
    doel: "Als 30/15, met iets langere werkstukken en iets meer herstel.",
    uitleg: "Series van 40 seconden hard en 20 seconden rustig, in blokken van 8–12 minuten.",
    gebruik: "Zelfde opzet als 30/15; kies deze variant als 30/15 te gejaagd voelt.",
    fouten: "Het herstel van 20 seconden doorfietsen op tempo, waardoor de serie vroeg klapt.",
    minLeeftijd: 14,
    params: { duurMin: 8, duurMax: 12, duurStd: 10, maat: "pct_ftp", intMin: 110, intMax: 125, intStd: 118, herhMin: 2, herhMax: 3, pauzeMin: 4, pauzeMax: 6 } },
  { slug: "piramide-interval", naam: "Piramide-interval", discipline: "weg", categorie: "Hoge intensiteit", soort: "aeroob_hoog",
    doel: "Hoge intensiteit met oplopende en aflopende bloklengtes voor variatie en controle.",
    uitleg: "Blokken die oplopen en weer afdalen (bijv. 1-2-3-2-1 minuut) op VO2max-intensiteit, met pauze gelijk aan het gereden blok.",
    gebruik: "Houd het vermogen per blok gelijk; de piramide zelf is de variatie.",
    fouten: "De korte blokken te hard rijden en de top van de piramide niet halen.",
    minLeeftijd: 14,
    params: { duurMin: 9, duurMax: 18, duurStd: 12, maat: "pct_ftp", intMin: 106, intMax: 125, intStd: 115, herhMin: 1, herhMax: 2, pauzeMin: 5, pauzeMax: 8 } },
  { slug: "maximale-aerobe-test", naam: "Maximale aerobe test", discipline: "weg", categorie: "Hoge intensiteit", soort: "aeroob_hoog",
    doel: "Een meetmoment: vaststellen wat het hoogste vol te houden vermogen is over een vaste duur.",
    uitleg: "Eén maximale, gelijkmatige inspanning over een vaste duur (bijvoorbeeld 20 minuten) na een degelijke warming-up.",
    gebruik: "Uitgerust starten, vlak parcours of indoor, gelijkmatig verdelen. Resultaat vastleggen bij het profiel.",
    fouten: "Te snel starten; de tweede helft bepaalt de uitslag.",
    minLeeftijd: 14,
    params: { duurMin: 12, duurMax: 30, duurStd: 20, maat: "rpe", intMin: 9, intMax: 10, intStd: 10 } },
  // ── Anaeroob en sprint ─────────────────────────────────────────────────
  { slug: "anaerobe-capaciteitsserie", naam: "Anaerobe capaciteitsserie", discipline: "weg", categorie: "Anaeroob en sprint", soort: "anaeroob",
    doel: "Het vermogen boven VO2max trainen met korte, zeer intensieve herhalingen.",
    uitleg: "Herhalingen van 30 seconden tot 2 minuten ver boven FTP (130–170%), met ruime rust ertussen.",
    gebruik: "Volledig herstellen tussen de herhalingen (3–6 minuten); kwaliteit boven kwantiteit.",
    fouten: "Te korte pauzes waardoor de herhalingen steeds trager worden.",
    minLeeftijd: 15,
    params: { duurMin: 1, duurMax: 2, duurStd: 1, maat: "pct_ftp", intMin: 130, intMax: 170, intStd: 150, herhMin: 4, herhMax: 8, pauzeMin: 3, pauzeMax: 6 } },
  { slug: "sprint-lage-snelheid", naam: "Sprintserie vanuit lage snelheid", discipline: "weg", categorie: "Anaeroob en sprint", soort: "neuromusculair",
    doel: "Explosief aanzetten en maximale kracht van bijna stilstand.",
    uitleg: "Sprints van 10–15 seconden vanuit lage snelheid in een zwaar verzet, volledig uit het zadel.",
    gebruik: "Volledig herstel tussen de sprints (minimaal 4 minuten). Techniek en veiligheid eerst: recht spoor, vrije weg.",
    fouten: "Sprinten op vermoeide benen; deze vorm vraagt frisheid.",
    minLeeftijd: 15,
    params: { duurMin: 1, duurMax: 1, duurStd: 1, maat: "rpe", intMin: 10, intMax: 10, intStd: 10, herhMin: 4, herhMax: 8, pauzeMin: 4, pauzeMax: 8 } },
  { slug: "sprint-vanuit-tempo", naam: "Sprintserie vanuit tempo", discipline: "weg", categorie: "Anaeroob en sprint", soort: "neuromusculair",
    doel: "De eindsprint trainen zoals hij in koers voorkomt: aanzetten vanuit snelheid.",
    uitleg: "Sprints van 10–15 seconden vanuit rijdend tempo (zone 2–3), met volledige rust ertussen.",
    gebruik: "Kies een veilig, overzichtelijk stuk weg. Let op schakelmoment en houding.",
    fouten: "Te vroeg aangaan en 'doodvallen' voor de streep.",
    minLeeftijd: 15,
    params: { duurMin: 1, duurMax: 1, duurStd: 1, maat: "rpe", intMin: 10, intMax: 10, intStd: 10, herhMin: 4, herhMax: 8, pauzeMin: 4, pauzeMax: 8 } },
  { slug: "heuvelsprints", naam: "Heuvelsprints", discipline: "weg", categorie: "Anaeroob en sprint", soort: "neuromusculair",
    doel: "Kracht en explosiviteit combineren met weerstand van de helling.",
    uitleg: "Korte maximale sprints (8–12 seconden) tegen een helling op, uit het zadel.",
    gebruik: "Volledig herstel tussen herhalingen; terugrollen is de pauze.",
    fouten: "Te lange sprints waardoor het anaerobe capaciteitswerk wordt in plaats van pure kracht.",
    minLeeftijd: 15,
    params: { duurMin: 1, duurMax: 1, duurStd: 1, maat: "rpe", intMin: 10, intMax: 10, intStd: 10, herhMin: 4, herhMax: 8, pauzeMin: 3, pauzeMax: 6 } },
  { slug: "lange-sprint", naam: "Lange sprint", discipline: "weg", categorie: "Anaeroob en sprint", soort: "anaeroob",
    doel: "De sprint volhouden voorbij de eerste explosie, richting 20–30 seconden.",
    uitleg: "Maximale inspanningen van 20–30 seconden: explosief starten en het vermogen zo lang mogelijk vasthouden.",
    gebruik: "Beperk het aantal herhalingen (3–5) en neem ruime rust; dit is zeer belastend.",
    fouten: "Te veel herhalingen plannen; de kwaliteit stort dan in.",
    minLeeftijd: 15,
    params: { duurMin: 1, duurMax: 1, duurStd: 1, maat: "rpe", intMin: 10, intMax: 10, intStd: 10, herhMin: 3, herhMax: 5, pauzeMin: 5, pauzeMax: 10 } },
  // ── Klimmen ────────────────────────────────────────────────────────────
  { slug: "klimblok-tempo", naam: "Klimblok tempo", discipline: "weg", categorie: "Klimmen", soort: "aeroob_hoog",
    doel: "Op de klim wennen aan lang stevig doorrijden in klimhouding.",
    uitleg: "Blokken van 10–30 minuten bergop in zone 3, zittend, met vast ritme.",
    gebruik: "Kies een gelijkmatige klim of indoor-simulatie; cadans niet laten wegzakken onder de 70.",
    fouten: "Elke bocht aanzetten in plaats van het blok vlak houden.",
    params: { duurMin: 10, duurMax: 30, duurStd: 20, maat: "pct_ftp", intMin: 76, intMax: 87, intStd: 82, herhMin: 1, herhMax: 3, pauzeMin: 5, pauzeMax: 10 } },
  { slug: "klimblok-drempel", naam: "Klimblok drempel", discipline: "weg", categorie: "Klimmen", soort: "aeroob_hoog",
    doel: "Drempelvermogen trainen op de helling, waar het in koers beslist wordt.",
    uitleg: "Herhalingen van 8–15 minuten bergop rond FTP.",
    gebruik: "Zelfde regels als drempelinterval; gebruik de afdaling als pauze.",
    fouten: "Door de helling automatisch boven de drempel uitkomen en te vroeg leeg zijn.",
    minLeeftijd: 14,
    params: { duurMin: 8, duurMax: 15, duurStd: 10, maat: "pct_ftp", intMin: 95, intMax: 105, intStd: 100, herhMin: 2, herhMax: 4, pauzeMin: 5, pauzeMax: 10 } },
  { slug: "klimherhalingen", naam: "Klimherhalingen", discipline: "weg", categorie: "Klimmen", soort: "aeroob_hoog",
    doel: "Kortere klim meerdere keren op hoge intensiteit rijden.",
    uitleg: "Dezelfde klim 3–6 keer op VO2max-achtige intensiteit (3–6 minuten per beklimming).",
    gebruik: "Afdaling = herstel. Houd de beklimmingen gelijkwaardig van vermogen.",
    fouten: "De eerste beklimming als koers rijden en daarna alleen nog overleven.",
    minLeeftijd: 14,
    params: { duurMin: 3, duurMax: 6, duurStd: 4, maat: "pct_ftp", intMin: 106, intMax: 120, intStd: 112, herhMin: 3, herhMax: 6, pauzeMin: 4, pauzeMax: 8 } },
  { slug: "torque-klimmen", naam: "Laag toerental klimmen (torque)", discipline: "weg", categorie: "Klimmen", soort: "kracht",
    doel: "Kracht op de pedalen ontwikkelen met lage cadans tegen de helling.",
    uitleg: "Blokken van 5–10 minuten bergop in een zwaar verzet op 50–60 omwentelingen per minuut, zittend, rond tempo-intensiteit.",
    gebruik: "Rustig ritme, druk vanuit de heup, bovenlichaam stil. Bij knieklachten direct stoppen.",
    fouten: "Te zwaar verzet kiezen waardoor de houding wringt en de knieën belast raken.",
    minLeeftijd: 16,
    params: { duurMin: 5, duurMax: 10, duurStd: 8, maat: "pct_ftp", intMin: 76, intMax: 90, intStd: 82, herhMin: 2, herhMax: 4, pauzeMin: 5, pauzeMax: 8 } },
  // ── Baan ───────────────────────────────────────────────────────────────
  { slug: "staande-start", naam: "Staande start", discipline: "baan", categorie: "Baan", soort: "neuromusculair",
    doel: "Maximaal explosief wegkomen vanuit stilstand op de baan.",
    uitleg: "Starts vanuit stilstand (gefixeerd of gehouden), volledig maximaal over 1 tot 2 ronden.",
    gebruik: "Alleen op een velodroom onder begeleiding. Volledige rust tussen de starts.",
    fouten: "Te veel starts op één avond; de kwaliteit zit in de eerste drie à vijf.",
    afspraak: true, minLeeftijd: 15,
    params: { duurMin: 1, duurMax: 1, duurStd: 1, maat: "rpe", intMin: 10, intMax: 10, intStd: 10, herhMin: 3, herhMax: 6, pauzeMin: 5, pauzeMax: 10 } },
  { slug: "vliegende-200", naam: "Vliegende 200", discipline: "baan", categorie: "Baan", soort: "neuromusculair",
    doel: "Maximale snelheid over 200 meter met aanloop.",
    uitleg: "Met twee à drie ronden aanloop hoog in de baan snelheid opbouwen en de laatste 200 meter vol sprinten.",
    gebruik: "Velodroom vereist; lijnen en voorrangsregels van de baan volgen.",
    fouten: "De aanloop te vroeg vol openen waardoor de 200 zelf inzakt.",
    afspraak: true, minLeeftijd: 15,
    params: { duurMin: 1, duurMax: 1, duurStd: 1, maat: "rpe", intMin: 10, intMax: 10, intStd: 10, herhMin: 2, herhMax: 5, pauzeMin: 8, pauzeMax: 15 } },
  { slug: "achtervolgingsinspanning", naam: "Achtervolgingsinspanning", discipline: "baan", categorie: "Baan", soort: "anaeroob",
    doel: "De vaste, hoge inspanning van een achtervolging (2–4 km) trainen.",
    uitleg: "Gelijkmatige maximale inspanning over achtervolgingsafstand, op schema gereden met rondetijden.",
    gebruik: "Velodroom vereist. Rondetijden vooraf afspreken en strak volgen.",
    fouten: "De eerste kilometer te snel openen.",
    afspraak: true, minLeeftijd: 15,
    params: { duurMin: 2, duurMax: 6, duurStd: 4, maat: "rpe", intMin: 9, intMax: 10, intStd: 10, herhMin: 1, herhMax: 3, pauzeMin: 10, pauzeMax: 20 } },
  { slug: "derny", naam: "Derny-training", discipline: "baan", categorie: "Baan", soort: "aeroob_hoog",
    doel: "Op hoge snelheid achter de derny wennen aan koerssnelheid en ritme.",
    uitleg: "Training achter een derny op de baan: lange blokken op hoge snelheid in het wiel van de gangmaker.",
    gebruik: "Uitsluitend als afspraak met baan, tijdslot en gangmaker; de vorm maakt een agenda-item met plaats en persoon.",
    fouten: "Zelf het tempo willen maken in plaats van het ritme van de gangmaker volgen.",
    afspraak: true, minLeeftijd: 16,
    params: { duurMin: 20, duurMax: 60, duurStd: 40, maat: "rpe", intMin: 7, intMax: 9, intStd: 8 } },
  { slug: "motortraining", naam: "Motortraining", discipline: "baan", categorie: "Baan", soort: "aeroob_hoog",
    doel: "Lange blokken op zeer hoge snelheid achter de motor.",
    uitleg: "Gangmaking achter een motor (baan of afgesloten parcours), voor snelheidsgewenning en koersritme.",
    gebruik: "Uitsluitend als afspraak met locatie en motorrijder; de vorm maakt een agenda-item.",
    fouten: "Te dicht op het achterwiel gaan rijden zonder ervaring met gangmaking.",
    afspraak: true, minLeeftijd: 16,
    params: { duurMin: 30, duurMax: 90, duurStd: 60, maat: "rpe", intMin: 7, intMax: 9, intStd: 8 } },
  { slug: "ploegkoers-simulatie", naam: "Ploegkoers-simulatie", discipline: "baan", categorie: "Baan", soort: "anaeroob",
    doel: "Aflossen, overnemen en koerslezen trainen zoals in de ploegkoers.",
    uitleg: "In koppels aflossingen draaien op de baan met wisselende tempo- en aanvalsfasen.",
    gebruik: "Velodroom en trainingsgroep vereist; afspraken over aflossingszones vooraf.",
    fouten: "Onveilig aflossen; de hand-sling vraagt instructie en rustige opbouw.",
    afspraak: true, minLeeftijd: 15,
    params: { duurMin: 20, duurMax: 60, duurStd: 40, maat: "rpe", intMin: 7, intMax: 10, intStd: 8 } },
  { slug: "standing-lap", naam: "Standing lap", discipline: "baan", categorie: "Baan", soort: "neuromusculair",
    doel: "Eén volledige ronde maximaal vanuit stilstand — het slotstuk van de teamsprint.",
    uitleg: "Vanuit stilstand één ronde volledig maximaal, met nadruk op de start en het vasthouden van snelheid.",
    gebruik: "Velodroom vereist; volledig herstel tussen herhalingen.",
    fouten: "Na de start rechtop gaan zitten en snelheid weggeven.",
    afspraak: true, minLeeftijd: 15,
    params: { duurMin: 1, duurMax: 1, duurStd: 1, maat: "rpe", intMin: 10, intMax: 10, intStd: 10, herhMin: 2, herhMax: 4, pauzeMin: 8, pauzeMax: 15 } },
  // ── Techniek ───────────────────────────────────────────────────────────
  { slug: "bochtentechniek", naam: "Bochtentechniek", discipline: "techniek", categorie: "Techniek", soort: "techniek_licht",
    doel: "Sneller en veiliger door bochten: lijn, remmoment en lichaamshouding.",
    uitleg: "Op een rustig parcours of pleintje bochten oefenen: buitenste pedaal laag, kijken naar de uitgang, remmen vóór de bocht.",
    gebruik: "Begin ruim en rustig, verklein de bocht geleidelijk. Droog wegdek, lage snelheid eerst.",
    fouten: "In de bocht remmen; te vroeg insturen.",
    params: { duurMin: 20, duurMax: 45, duurStd: 30, maat: "rpe", intMin: 2, intMax: 4, intStd: 3 } },
  { slug: "daaltechniek", naam: "Daaltechniek", discipline: "techniek", categorie: "Techniek", soort: "techniek_licht",
    doel: "Controle en vertrouwen in afdalingen opbouwen.",
    uitleg: "Een bekende afdaling meerdere keren rijden met aandacht voor remverdeling, lijn en blik vooruit.",
    gebruik: "Snelheid stap voor stap opbouwen; nooit boven het eigen comfort. Bij nat wegdek alleen de basis.",
    fouten: "Naar het gevaar kijken in plaats van naar de gewenste lijn.",
    params: { duurMin: 20, duurMax: 45, duurStd: 30, maat: "rpe", intMin: 2, intMax: 4, intStd: 3 } },
  { slug: "groepsrijden", naam: "Groepsrijden en waaiervorming", discipline: "techniek", categorie: "Techniek", soort: "techniek_licht",
    doel: "Strak en veilig in het wiel rijden, aflossen en van de wind af zitten.",
    uitleg: "In een kleine groep aflossen, van achteren aansluiten en op wisselende wind de juiste positie kiezen.",
    gebruik: "Rustig tempo; het doel is positie en samenspel, niet belasting.",
    fouten: "Overlappen van wielen; schrikreacties door te dicht rijden zonder ervaring.",
    params: { duurMin: 30, duurMax: 90, duurStd: 60, maat: "rpe", intMin: 3, intMax: 5, intStd: 4 } },
  { slug: "bidon-voeding-handelingen", naam: "Bidon- en voedingshandelingen", discipline: "techniek", categorie: "Techniek", soort: "techniek_licht",
    doel: "Eten, drinken en aanpakken zonder van de lijn af te wijken.",
    uitleg: "Rijdend een bidon pakken en terugzetten, een reep openen met één hand, aanpakken van een bidon door een helper.",
    gebruik: "Eerst stilstaand, dan op rustig tempo op een leeg stuk weg.",
    fouten: "Naar het stuur of de bidon kijken in plaats van naar de weg.",
    params: { duurMin: 15, duurMax: 30, duurStd: 20, maat: "rpe", intMin: 2, intMax: 3, intStd: 2 } },
  { slug: "cadansdrills", naam: "Cadansdrills", discipline: "techniek", categorie: "Techniek", soort: "techniek_licht",
    doel: "Een soepele, ronde pedaalslag over een breed cadansbereik.",
    uitleg: "Blokken op hoge cadans (100–120) en lage cadans (60–70) afgewisseld, op lichte weerstand.",
    gebruik: "Blijf ontspannen in de heupen; laat het zitvlak niet stuiteren op hoge cadans.",
    fouten: "Te veel weerstand bij de hoge-cadansblokken.",
    params: { duurMin: 20, duurMax: 45, duurStd: 30, maat: "rpe", intMin: 2, intMax: 4, intStd: 3, herhMin: 4, herhMax: 8, pauzeMin: 2, pauzeMax: 4 } },
  { slug: "eenbenige-drills", naam: "Eenbenige drills", discipline: "techniek", categorie: "Techniek", soort: "techniek_licht",
    doel: "De pedaalslag per been bewust maken en dode punten wegwerken.",
    uitleg: "Op de indoortrainer afwisselend met één been trappen (30–60 seconden per been) op lichte weerstand.",
    gebruik: "Alleen indoor; wissel ruim voordat de vorm verslechtert.",
    fouten: "Doorgaan terwijl de slag hakkelt — dan traint het juist het verkeerde patroon.",
    params: { duurMin: 10, duurMax: 20, duurStd: 15, maat: "rpe", intMin: 2, intMax: 3, intStd: 2, herhMin: 4, herhMax: 10, pauzeMin: 1, pauzeMax: 2 } },
  // ── Indoor ─────────────────────────────────────────────────────────────
  { slug: "indoor-duurblok", naam: "Indoor duurblok", discipline: "indoor", categorie: "Indoor", soort: "aeroob_duur",
    doel: "Rustige duurbelasting binnen, zonder verkeer of weersinvloeden.",
    uitleg: "Een aaneengesloten blok rustig doortrappen op de indoortrainer, op gelijkmatige weerstand of in ERG-modus.",
    gebruik: "Zorg voor ventilatie en voldoende drinken; binnen verlies je meer vocht dan buiten bij dezelfde inspanning.",
    fouten: "Zonder ventilator rijden waardoor de hartslag oploopt zonder extra trainingsprikkel.",
    params: { duurMin: 45, duurMax: 120, duurStd: 60, maat: "rpe", intMin: 3, intMax: 5, intStd: 4 } },
  { slug: "erg-intervallen", naam: "ERG-intervallen", discipline: "indoor", categorie: "Indoor", soort: "aeroob_hoog",
    doel: "Strak gedoseerde intervalblokken met vast vermogen op de slimme trainer.",
    uitleg: "Intervalblokken in ERG-modus waarbij de trainer het vermogen vasthoudt; jij hoeft alleen te blijven trappen.",
    gebruik: "Kies het vermogen aan de voorzichtige kant: in ERG-modus kun je niet ongemerkt iets terugnemen.",
    fouten: "Te hoog instellen en in de 'spiral of death' belanden als de cadans wegzakt.",
    params: { duurMin: 45, duurMax: 90, duurStd: 60, maat: "rpe", intMin: 6, intMax: 8, intStd: 7, herhMin: 3, herhMax: 6, pauzeMin: 3, pauzeMax: 6 } },
  // ── Kracht ─────────────────────────────────────────────────────────────
  { slug: "squat", naam: "Squat", discipline: "kracht", categorie: "Kracht", soort: "kracht",
    doel: "Basiskracht van benen en romp opbouwen.",
    uitleg: "De kniebuiging: voeten op schouderbreedte, rug lang, zakken tot de diepte die met goede houding lukt, en gecontroleerd omhoog.",
    gebruik: "Eerst de beweging beheersen met lichaamsgewicht of licht materiaal; pas daarna belasting opbouwen. Voor jeugd geldt: techniek en lichaamsgewicht, geen zware belasting en geen 1RM-doelen.",
    fouten: "Knieën naar binnen laten vallen; diepte forceren ten koste van de rug.",
    params: { duurMin: 15, duurMax: 40, duurStd: 25, maat: "herhalingen", intMin: 6, intMax: 15, intStd: 10, herhMin: 3, herhMax: 5, pauzeMin: 2, pauzeMax: 4 } },
  { slug: "deadlift", naam: "Deadlift", discipline: "kracht", categorie: "Kracht", soort: "kracht",
    doel: "De achterketen (bilspieren, hamstrings, rug) sterker maken.",
    uitleg: "Heupscharnier met belasting van de grond: rug lang, stang of gewicht dicht bij het lichaam, strekken vanuit de heup.",
    gebruik: "Techniek eerst, onder begeleiding aanleren. Voor jeugd geldt: licht materiaal en techniek, geen zware belasting en geen 1RM-doelen.",
    fouten: "Een bolle onderrug; het gewicht ver van het lichaam laten zweven.",
    minLeeftijd: 16,
    params: { duurMin: 15, duurMax: 40, duurStd: 25, maat: "herhalingen", intMin: 5, intMax: 10, intStd: 8, herhMin: 3, herhMax: 5, pauzeMin: 2, pauzeMax: 4 } },
  { slug: "lunge", naam: "Lunge", discipline: "kracht", categorie: "Kracht", soort: "kracht",
    doel: "Eenbenige beenkracht en balans, dicht bij de fietsbeweging.",
    uitleg: "Uitvalspas voorwaarts of achterwaarts, romp rechtop, knie boven de voet.",
    gebruik: "Begin met lichaamsgewicht; pas belasting op als beide zijden stabiel zijn.",
    fouten: "Een te korte pas waardoor de knie ver voorbij de tenen schiet.",
    params: { duurMin: 10, duurMax: 30, duurStd: 20, maat: "herhalingen", intMin: 8, intMax: 15, intStd: 10, herhMin: 2, herhMax: 4, pauzeMin: 1, pauzeMax: 3 } },
  { slug: "glute-bridge", naam: "Glute bridge", discipline: "kracht", categorie: "Kracht", soort: "kracht",
    doel: "De bilspieren activeren en versterken.",
    uitleg: "Ruglig, voeten plat, heupen omhoog drukken tot een rechte lijn van knie tot schouder, kort vasthouden en zakken.",
    gebruik: "Rustig tempo, nadruk op aanspannen van de billen — niet de onderrug.",
    fouten: "Overstrekken van de onderrug in de eindstand.",
    params: { duurMin: 10, duurMax: 20, duurStd: 15, maat: "herhalingen", intMin: 10, intMax: 20, intStd: 12, herhMin: 2, herhMax: 4, pauzeMin: 1, pauzeMax: 2 } },
  { slug: "core-plank", naam: "Core plank", discipline: "kracht", categorie: "Kracht", soort: "kracht",
    doel: "Rompstabiliteit voor een stille bovenbouw op de fiets.",
    uitleg: "Steun op onderarmen en tenen, lichaam één rechte lijn, buik en billen aangespannen.",
    gebruik: "Kwaliteit boven duur: stop zodra de heupen zakken. Varieer met zijwaartse plank.",
    fouten: "Doorhangende heupen; adem vasthouden.",
    params: { duurMin: 5, duurMax: 15, duurStd: 10, maat: "rpe", intMin: 4, intMax: 7, intStd: 5, herhMin: 3, herhMax: 6, pauzeMin: 1, pauzeMax: 2 } },
  { slug: "dead-bug", naam: "Dead bug", discipline: "kracht", categorie: "Kracht", soort: "kracht",
    doel: "Diepe rompspieren leren aanspannen terwijl armen en benen bewegen.",
    uitleg: "Ruglig met armen en knieën omhoog; strek tegengestelde arm en been terwijl de onderrug op de grond blijft.",
    gebruik: "Langzaam en gecontroleerd; de onderrug mag niet loskomen.",
    fouten: "Te snel bewegen waardoor de rug hol trekt.",
    params: { duurMin: 5, duurMax: 15, duurStd: 10, maat: "herhalingen", intMin: 6, intMax: 12, intStd: 8, herhMin: 2, herhMax: 4, pauzeMin: 1, pauzeMax: 2 } },
  { slug: "eenbenige-stabiliteit", naam: "Eenbenige stabiliteit", discipline: "kracht", categorie: "Kracht", soort: "kracht",
    doel: "Balans en controle per been, ter voorkoming van scheefgroei in belasting.",
    uitleg: "Oefeningen op één been: stand houden, lichte kniebuiging, eventueel op instabiele ondergrond.",
    gebruik: "Blote voeten of platte zolen helpen; begin simpel en bouw op.",
    fouten: "Compenseren met de heup in plaats van de voet en bil te laten werken.",
    params: { duurMin: 5, duurMax: 15, duurStd: 10, maat: "herhalingen", intMin: 6, intMax: 12, intStd: 8, herhMin: 2, herhMax: 4, pauzeMin: 1, pauzeMax: 2 } },
  { slug: "rompkracht-circuit", naam: "Rompkracht circuit", discipline: "kracht", categorie: "Kracht", soort: "kracht",
    doel: "Meerdere romp- en heupoefeningen achter elkaar als compacte krachtsessie.",
    uitleg: "Een circuit van 4–6 oefeningen (plank, bridge, dead bug, zijplank, e.d.), elk 30–45 seconden, met korte overgangen.",
    gebruik: "Twee tot vier ronden; houd de uitvoering leidend, niet de klok.",
    fouten: "Doorjakkeren met slechte vorm om het rondje te halen.",
    params: { duurMin: 15, duurMax: 35, duurStd: 25, maat: "rpe", intMin: 4, intMax: 7, intStd: 5, herhMin: 2, herhMax: 4, pauzeMin: 1, pauzeMax: 3 } },
  // ── Mobiliteit ─────────────────────────────────────────────────────────
  { slug: "heupmobiliteit", naam: "Heupmobiliteit", discipline: "mobiliteit", categorie: "Mobiliteit", soort: "techniek_licht",
    doel: "Vrijere heupen voor een lagere, comfortabelere houding op de fiets.",
    uitleg: "Een korte routine van heupopeners: diepe uitvalspas met rotatie, 90/90-zit, heupcirkels.",
    gebruik: "Rustig ademen, niet veren; per houding 30–60 seconden.",
    fouten: "Rek forceren tot pijn; mobiliteit vraagt herhaling, geen geweld.",
    params: { duurMin: 10, duurMax: 25, duurStd: 15, maat: "rpe", intMin: 1, intMax: 3, intStd: 2 } },
  { slug: "thoracale-mobiliteit", naam: "Thoracale mobiliteit", discipline: "mobiliteit", categorie: "Mobiliteit", soort: "techniek_licht",
    doel: "Een beweeglijkere bovenrug voor ademruimte en een stille houding.",
    uitleg: "Draai- en strekoefeningen voor de borstwervelkolom: open books, cat-camel, strekking over een foamroller.",
    gebruik: "Langzaam en binnen comfort; combineer met rustige ademhaling.",
    fouten: "Vanuit de onderrug draaien in plaats van de bovenrug.",
    params: { duurMin: 10, duurMax: 20, duurStd: 15, maat: "rpe", intMin: 1, intMax: 3, intStd: 2 } },
  { slug: "enkelmobiliteit", naam: "Enkelmobiliteit", discipline: "mobiliteit", categorie: "Mobiliteit", soort: "techniek_licht",
    doel: "Soepele enkels voor een vloeiende pedaalslag en stabiel staan.",
    uitleg: "Kniedrijven naar de muur, kuitrek in stand, cirkels; per enkel enkele minuten.",
    gebruik: "Dagelijks kort werkt beter dan één keer lang.",
    fouten: "De hiel van de grond laten komen bij het kniedrijven.",
    params: { duurMin: 5, duurMax: 15, duurStd: 10, maat: "rpe", intMin: 1, intMax: 2, intStd: 1 } },
  { slug: "hamstringroutine", naam: "Hamstringroutine", discipline: "mobiliteit", categorie: "Mobiliteit", soort: "techniek_licht",
    doel: "Lenige, belastbare hamstrings — de motor achter de pedaalslag.",
    uitleg: "Actieve rek (beenzwaaien, Jefferson curl licht, lig-rek met band) gecombineerd met rustige activatie.",
    gebruik: "Warm beginnen (na een rit of korte warming-up); geen verende rek.",
    fouten: "Koud en fel rekken; dat werkt averechts.",
    params: { duurMin: 10, duurMax: 20, duurStd: 15, maat: "rpe", intMin: 1, intMax: 3, intStd: 2 } },
  // ── Wandelen ───────────────────────────────────────────────────────────
  { slug: "herstelwandeling", naam: "Herstelwandeling", discipline: "wandelen", categorie: "Wandelen", soort: "herstel",
    doel: "Licht bewegen op een rustdag zonder trainingsbelasting toe te voegen.",
    uitleg: "Een rustige wandeling in eigen tempo, zonder doelen of meetdruk.",
    gebruik: "Comfortabel tempo; buiten is een pre maar niet verplicht.",
    fouten: "Er alsnog een work-out van maken met tussensprints of tempodoelen.",
    params: { duurMin: 20, duurMax: 60, duurStd: 30, maat: "rpe", intMin: 1, intMax: 2, intStd: 1 } },
  { slug: "lange-wandeling", naam: "Lange wandeling", discipline: "wandelen", categorie: "Wandelen", soort: "aeroob_duur",
    doel: "Lange, rustige duurbelasting op de voeten.",
    uitleg: "Een wandeling van anderhalf uur of meer op gelijkmatig tempo.",
    gebruik: "Goede schoenen, water mee en bij lange versies iets te eten.",
    fouten: "Te ver willen op nieuwe schoenen of zonder opbouw.",
    params: { duurMin: 90, duurMax: 300, duurStd: 120, maat: "rpe", intMin: 2, intMax: 4, intStd: 3 } },
  { slug: "heuvelwandeling", naam: "Heuvelwandeling", discipline: "wandelen", categorie: "Wandelen", soort: "aeroob_hoog",
    doel: "Stevigere wandelbelasting door hoogtemeters en klimwerk.",
    uitleg: "Een wandeling met bewust klimwerk; bergop stevig doorstappen, bergaf gecontroleerd.",
    gebruik: "Stokken kunnen helpen bij lange afdalingen; tempo op de klim doseren.",
    fouten: "Bergaf rennen op vermoeide benen.",
    params: { duurMin: 60, duurMax: 240, duurStd: 120, maat: "rpe", intMin: 3, intMax: 6, intStd: 4 } },
];

/**
 * Idempotente startvulling (TRV-27). Bestaande rijen (op slug) worden nooit
 * overschreven — latere redactie of inschaling blijft dus staan.
 * Alle vormen hebben geschreven uitleg → status "gepubliceerd";
 * onderbouwing blijft "praktijkvorm" / "nog niet ingeschaald" (TRV-94).
 */
export async function seedTrainingForms(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  for (const f of F) {
    const [existing] = await db
      .select({ id: trainingFormsTable.id })
      .from(trainingFormsTable)
      .where(eq(trainingFormsTable.slug, f.slug))
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }
    const [row] = await db
      .insert(trainingFormsTable)
      .values({
        slug: f.slug,
        naam: f.naam,
        discipline: f.discipline,
        categorie: f.categorie,
        belastingssoort: f.soort,
        doel: f.doel,
        // Effect wordt niet gevuld tot de inschaling (TRV-94): een effectclaim
        // zonder bron zou een verzonnen belofte zijn (TRV-55).
        effect: null,
        uitleg: f.uitleg,
        gebruik: f.gebruik,
        veelgemaakteFouten: f.fouten,
        onderbouwingsniveau: "praktijkvorm",
        onderbouwingstoelichting: "nog niet ingeschaald",
        minimumLeeftijd: f.minLeeftijd ?? null,
        eigenaarType: "sparki",
        zichtbaarheid: "sparki",
        vereistAfspraak: f.afspraak ?? false,
        status: "gepubliceerd",
      })
      .onConflictDoNothing({ target: trainingFormsTable.slug })
      .returning({ id: trainingFormsTable.id });
    if (!row) {
      skipped += 1;
      continue;
    }
    await db
      .insert(trainingFormParametersTable)
      .values({
        formId: row.id,
        duurMinuten: f.params.duurMin ?? null,
        duurMaxMinuten: f.params.duurMax ?? null,
        duurStandaardMinuten: f.params.duurStd ?? null,
        intensiteitsmaat: f.params.maat ?? null,
        intensiteitMin: f.params.intMin ?? null,
        intensiteitMax: f.params.intMax ?? null,
        intensiteitStandaard: f.params.intStd ?? null,
        herhalingenMin: f.params.herhMin ?? null,
        herhalingenMax: f.params.herhMax ?? null,
        pauzeMinMinuten: f.params.pauzeMin ?? null,
        pauzeMaxMinuten: f.params.pauzeMax ?? null,
      })
      .onConflictDoNothing({ target: trainingFormParametersTable.formId });
    inserted += 1;
  }
  return { inserted, skipped };
}
