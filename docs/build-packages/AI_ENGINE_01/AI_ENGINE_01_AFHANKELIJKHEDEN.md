# AFHANKELIJKHEDEN — `AI_ENGINE_01`

## Exact nodig

- `AI_GOVERNANCE_01`
- `DATA_TRUST_01`
- centrale entitlements
- rol- en toestemmingslaag
- bestaande deterministische engines
- bestaande Anthropic/Gemini-integraties
- auditlog
- document- en fotoanalyse
- support-, route-, training-, club- en mechaniekservices
- kosten- en logginginfrastructuur

## Verplicht vooraf bruikbaar

1. Governancebeleid is beschikbaar en versieerbaar.
2. Gebruikerscontext heeft herkomst en eigenaar.
3. Pakket- en rolrechten zijn server-side.
4. Deterministische engines leveren stabiele uitkomsten.
5. Providersecrets staan buiten code.
6. Auditlog en correlatie-ID zijn beschikbaar.

## Restpunten die niet blokkeren

- toekomstige provider;
- toekomstige sport;
- nieuwe marktplaats;
- nieuwe clubvariant;
- aanvullende AI-persona’s;
- toekomstige voice-assistent.

Een restpunt blokkeert pas wanneer het een vereiste hierboven rechtstreeks raakt.

## Gedeelde lagen met verhoogd regressierisico

- entitlements;
- rolrechten;
- context/provenance;
- providergateway;
- toolgateway;
- geheugen;
- auditlog;
- deterministische engines;
- veiligheidsclassifier.

Wijziging in deze lagen vereist volledige pakket-hertoets.
