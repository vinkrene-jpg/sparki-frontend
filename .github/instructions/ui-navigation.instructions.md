---
applyTo: "artifacts/sparki/src/**/*.ts,artifacts/sparki/src/**/*.tsx,artifacts/sparki-mobile/**/*.ts,artifacts/sparki-mobile/**/*.tsx"
---

# Gebruikersinterface en navigatie

Pas deze regels aanvullend op `.github/copilot-instructions.md` toe.

- Rapporteer `technical_status`, `calibration_status`, `acceptance_contract.approved` en `product_proof.status` afzonderlijk wanneer een toepasselijk kalibratieonderwerp bestaat; ontbrekende statusdekking wordt niet ingevuld of afgeleid.
- Pas Poort 5b en 5c exact toe zoals centraal gedefinieerd. Voor UI omvat 5b minimaal renderbaarheid en een zichtbaar resultaat of eerlijke blokkade van de primaire interactie; 5c traceert op de actuele GitHub-head event handler, route-doel, query/mutatie en gerenderde uitkomst.
- Iedere zichtbare knop, link, schakelaar, menuoptie en kaart heeft een bereikbaar, waarneembaar resultaat of een eerlijke geblokkeerde toestand.
- Controleer dat event handlers niet alleen lokale state wijzigen terwijl rendering, query, mutatie, route of apparaatgedrag onveranderd blijft.
- Controleer dat doelroutes, queryparameters, tabbladen, anchors en modals werkelijk bestaan, renderen en een duidelijke terug- of sluitroute hebben.
- Volg succes, laden, lege data, gedeeltelijke data, fout, offline, verboden rol en herladen/herstarten. Loadingcopy of placeholders mogen geen definitieve uitkomst worden.
- Gebruikerscopy is helder Nederlands, gebruikt geen zichtbare term “AI” en claimt geen waarneming, succes of zekerheid die de data niet bewijst.
- De interface vraagt geen reeds beschikbare of afleidbare data opnieuw; controleer de bestaande intelligent-werkbladstroom: verzamelen → combineren → analyseren → voorstellen → alleen echte lacunes uitvragen.
- Controleer rol- en contextlogica voor sporter, coach, ouder en clubrol; een verborgen knop is geen vervanging voor server-side autorisatie.
- Een component- of state-test is niet genoeg voor interacties: bewijs de zichtbare uitkomst en de relevante backend-/navigatiekoppeling.
