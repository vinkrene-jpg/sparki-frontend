# TEAM_MECHANIEKER_01 — HERSTELPROTOCOL

## 1. Bij Mirror-afkeuring

1. Leg de afgekeurde eindcommit vast.
2. Maak een nieuwe herstelcommit vanaf die commit.
3. Herstel uitsluitend de concrete blokkade en de direct gedeelde codepaden.
4. Niet refactoren, opruimen of scope uitbreiden.
5. Oorzaak onbekend: melden en eerst reproduceren; niet gokken.
6. Productbesluit, privacygrens of architectuurwijziging nodig: stop en leg één concrete keuze aan René voor.

## 2. Herstelrapport

Lever:

- blokkade;
- reproduceerbaar bewijs;
- technische oorzaak;
- gewijzigde bestanden;
- waarom de wijziging de oorzaak oplost;
- tests en exitcodes;
- nieuwe commit-SHA.

## 3. Opnieuw te testen

- het afgekeurde scenario;
- alle scenario's die hetzelfde endpoint, tabel, permission of providerpad gebruiken;
- de vaste testset van dit pakket;
- regressie van de direct gedeelde lagen.

Geen volledige app-regressie, tenzij een gedeelde kernlaag is gewijzigd.

## 4. Uitzonderingslijst: lokale fout is niet lokaal bij wijziging van

- individuele Mechanieker/garage
- activiteiten en kilometerregistratie
- club/teamrollen
- ploegleiderwedstrijdselectie
- document/PDF-service
- auditlog en notificaties

Ook volledig hertoetsen bij wijzigingen aan auth, tenantisolatie, centrale permissions, algemene auditlog, billing-entitlements of gedeelde document-/communicatieservices.

## 5. Grens

Na twee herstelronden op dezelfde blokkade gaat het terug naar René. Een derde technische poging zonder gewijzigd besluit of nieuwe oorzaak is niet toegestaan.

## 6. Een afkeuring betekent nooit

- acceptatiecriteria verzwakken;
- een falende test verwijderen;
- het hele pakket opnieuw bouwen;
- een eerder goedgekeurd pakket terugdraaien zonder regressiebewijs;
- technisch onafhankelijke bouwopdrachten stilzetten.
