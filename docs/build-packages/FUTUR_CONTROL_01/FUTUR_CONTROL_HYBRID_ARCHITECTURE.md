# FUTUR_CONTROL_HYBRID_ARCHITECTURE

**Regelcodes:** `HYB-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Hoe cloud en eigen netwerk samenwerken zonder van elkaar afhankelijk te worden.

---

## 1. Model

```
        INTERNET
            │
   ┌────────┴─────────┐
   │  FUTUR CONTROL   │  eigen deployment, eigen beheer-URL
   │  (cloud)         │  kern · registers · audit · schermen
   └────────▲─────────┘
            │  uitsluitend UITGAAND vanaf lokaal,
            │  versleuteld, met eigen identiteit per collector
   ┌────────┴──────────────────────────────┐
   │  EIGEN NETWERK                        │
   │  ┌──────────┐        ┌──────────────┐ │
   │  │   NAS    │◀──────▶│ mini-server  │ │
   │  │ opslag,  │  lokaal│ collector,   │ │
   │  │ back-up, │        │ verificatie, │ │
   │  │ snapshots│        │ agentruntime │ │
   │  └──────────┘        └──────────────┘ │
   └───────────────────────────────────────┘
```

## 2. Grondregels

| Code | Regel |
|---|---|
| HYB-01 | De Control-kern staat in de cloud en blijft bereikbaar buiten het lokale netwerk — ook bij stroom- of internetuitval thuis. |
| HYB-02 | NAS en mini-server sturen **versleuteld** statusinformatie naar Control. |
| HYB-03 | **Geen inkomende open beheerpoort** zonder aantoonbare noodzaak, geregistreerde reden en periodieke herbeoordeling. |
| HYB-04 | Voorkeur voor **uitgaande** beveiligde verbindingen. De lokale kant initieert; Control wacht. |
| HYB-05 | Secrets staan nooit hardcoded — niet in code, images, scripts, documentatie of nooddocumentatie. |
| HYB-06 | Lokale uitval mag cloudbeheer niet blokkeren. |
| HYB-07 | Internetuitval mag lokale back-ups niet stoppen. |
| HYB-08 | Statusgegevens worden lokaal **gebufferd** en later veilig aangeleverd. |
| HYB-09 | Lokale en cloudtijd moeten betrouwbaar gesynchroniseerd zijn. |
| HYB-10 | Alle beheeracties worden gelogd — lokaal én in Control. |

## 3. Verkeer

**HYB-11:** één uitgaande verbinding per collector, met een eigen identiteit en een eigen sleutel per omgeving. Een sleutel die op twee plaatsen werkt is een bevinding.
**HYB-12:** de collector stuurt uitsluitend **statusgegevens**: metingen, tellingen, uitkomsten van controles. Geen bestandsinhoud, geen productiegegevens, geen persoonsgegevens.
**HYB-13:** Control stuurt niets terug dat effect heeft op het apparaat of op wat erop draait. Het enige terugverkeer is de **eigen werkinstructie van de collector**: welke controles moeten draaien, met welke frequentie, en of de noodstop actief is. Dat is configuratie van Control's eigen meetgedrag, geen commando aan de NAS, de mini-server of enige dienst daarop. Een instructie die iets buiten de collector zou wijzigen, bestaat niet in de basisversie.
**HYB-14:** de noodstop werkt **fail-safe**: kan de collector Control niet bereiken, dan gaat de lokale agentruntime na een vastgelegde stiltetijd vanzelf stil. Twijfel leidt tot stilstand, niet tot doorgaan.

## 4. Buffering en tijd

**HYB-15:** bij internetuitval blijft de collector meten en bewaart hij de metingen lokaal, met hun **oorspronkelijke** meettijdstip.
**HYB-16:** bij aanlevering achteraf tonen die metingen hun eigen tijd, niet het tijdstip van aanlevering. Control markeert de periode zichtbaar als *achteraf aangeleverd*.
**HYB-17:** tijdens de stilte toont Control voor die bronnen `Onbekend` met leeftijd. Er wordt geen doorlopende gezondheid verondersteld omdat er later gegevens komen.
**HYB-18:** de buffer heeft een vastgelegde omvang en overschrijving is zichtbaar: als er metingen verloren gaan, staat er hoeveel en over welke periode.
**HYB-19:** tijddrift tussen lokaal en cloud boven een vastgelegde grens is een beveiligingssignaal, geen kleinigheid.

## 5. Uitvalcombinaties

| Situatie | Cloud | Lokaal | Wat de beheerder ziet |
|---|---|---|---|
| Alles werkt | Actief | Actief | Volledige status |
| Internet weg | Actief | Actief, buffert | Lokale bronnen `Onbekend` met leeftijd; producten in de cloud normaal zichtbaar |
| NAS uit | Actief | Deels | Back-upvelden `Onbekend`, waarschuwing kritiek bij overschrijding van de back-upgrens |
| Mini-server uit | Actief | Beperkt | Collectorfuncties `Onbekend`; cloudbeheer werkt door |
| Control uit | Uit | Actief | Read-only noodweergave; lokale back-ups lopen door; producten draaien door |
| Stroom weg thuis | Actief | Uit (na UPS) | Alle lokale velden `Onbekend`; producten en Control ongestoord |
| Cloud én lokaal weg | Uit | Uit | Alleen de buitenshuis bewaarde noodexport; herstelvolgorde netwerk → NAS → Control → producten |

**HYB-20:** in geen van deze situaties wordt een oude waarde als actueel getoond, en in geen enkele situatie wordt een status opgehoogd omdat een bron ontbreekt.

## 6. Wat expliciet niet mag

- Een tunnel of VPN die Control permanent inkomend toegang geeft tot het thuisnetwerk.
- Productiegegevens of bestandsinhoud die vanaf lokaal naar Control worden gestuurd.
- Een lokale dienst die als productieafhankelijkheid van een product gaat fungeren.
- Een collector die opdrachten uitvoert die niet in zijn vastgelegde lijst staan.
- Buffering die stilzwijgend gegevens laat vallen.
- Automatische herstart, herstel of firewallwijziging vanuit Control.

## 7. Directe afkeurgronden

- Inkomende beheerpoort zonder geregistreerde noodzaak.
- Gebufferde metingen krijgen het aanlevertijdstip.
- Ontbrekende bron leidt tot een hogere status dan `Onbekend`.
- De lokale agentruntime blijft draaien terwijl Control onbereikbaar is en de stiltetijd is verstreken.
- Secrets in een image, script of document.
- Statusverkeer bevat persoonsgegevens of bestandsinhoud.
- Verloren buffermetingen worden niet gemeld.
