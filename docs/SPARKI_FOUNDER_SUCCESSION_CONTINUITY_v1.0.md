# SPARKI FOUNDER SUCCESSION & CONTINUITY PLAN v1.0

**Versie:** 1.0  
**Datum:** 2026-07-28  
**Status:** ACTIEF  
**Vertrouwelijkheid:** INTERN — uitsluitend voor opgesomde continuity-admins en notarieel contact

---

## 0. Doel van dit document

Dit document regelt de bedrijfscontinuïteit van Sparki (de dienst) en de persoonlijke continuïteit
van de oprichter (René) in geval van uitval, langdurige onbereikbaarheid, of overdracht.
Het definieert wie wat mag, welke credentials bewaard worden en via welk protocol een
noodsituatie wordt afgehandeld.

---

## 1. Rollen & contacten

| Rol | Naam | Bevoegdheid | Contactvorm |
|---|---|---|---|
| **Oprichter / primaire beheerder** | René | Volledig | Persoonlijk |
| **Continuity Admin A** | Dylan | Technisch beheer bij uitval ≥ 14 dagen | Te bevestigen |
| **Continuity Admin B** | Tessa | Communicatie & commercieel beheer | Te bevestigen |
| **Notarieel contact** | Davidslucassen (p/a Kruders & Weda advocaten) | Juridisch en testamentair | Zakelijk adres |
| **Financieel contact** | Kruders & Weda | Bankvollmacht, jaarstukken | Kantoor |

> **SUCC-01:** Dylan en Tessa dienen schriftelijk te bevestigen dat zij de continuity-admin-rol
> aanvaarden. Dit bewijs dient te worden bewaard in het Secure Vault Keeper-project.

---

## 2. Noodprotocol — escalatieladder

### Stap 1: Korte uitval (< 72 uur)
- Geen actie vereist.
- Sparki draait zelfstandig op Replit Deployments.
- Geautomatiseerde gezondheidscontroles monitoren de dienst.

### Stap 2: Uitval 72 uur – 14 dagen
- **SUCC-02:** Dylan controleert de geautomatiseerde health checks.
- **SUCC-03:** Tessa stelt gebruikers en partnersclubs schriftelijk op de hoogte.
- Geen wijzigingen aan de codebase of database zonder expliciete instructie van René.

### Stap 3: Uitval > 14 dagen of medisch onvermogen
- **SUCC-04:** Dylan en Tessa activeren gezamenlijk de `MAINTENANCE`-modus via het
  admin-dashboard (`/admin/ops`) in Sparki.
- **SUCC-05:** Tessa contacteert Kruders & Weda voor juridisch advies.
- **SUCC-06:** Davidslucassen beoordeelt of testament-instructies van toepassing zijn.

### Stap 4: Permanente beëindiging van de dienst
- **SUCC-07:** `SERVICE_SHUTDOWN`-modus activeren (zie §5).
- **SUCC-08:** Gebruikersdata-export aangeboden conform AVG art. 20 (ten minste 30 dagen).
- **SUCC-09:** Database en object-storage na exporttermijn veilig vernietigen.
- **SUCC-10:** Domeinnamen overdragen of laten vervallen conform instructie van Kruders & Weda.

---

## 3. Bewaarde credentials & toegangsinstructie

Alle credentials worden uitsluitend bewaard in het **Secure Vault Keeper**-project
(`https://replit.com/@rene135/Secure-Vault-Keeper`).

> **SUCC-11:** De vault dient minimaal de volgende categorieën te bevatten:
>
> | Categorie | Inhoud |
> |---|---|
> | Replit-toegang | Replit-accountgegevens (gebruikersnaam + herstelcode) |
> | Clerk | Clerk Dashboard URL + API-sleutels |
> | Database | DATABASE_URL productie (Neon/Replit Postgres) |
> | Strava OAuth | STRAVA_CLIENT_ID + STRAVA_CLIENT_SECRET |
> | E-mail (Resend) | Resend API-sleutel + domeinverificatie |
> | VAPID | VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY |
> | Admin ID-lijst | SPARKI_ADMIN_IDS (kommalijst van Clerk-IDs) |
> | Dylan-toegang | Vault-instructie + verificatiemethode |
> | Tessa-toegang | Vault-instructie + verificatiemethode |
> | Davidslucassen | Notarieel contactformulier + instructiemoment |

> **SUCC-12:** De vault dient jaarlijks (elke 1 januari) te worden gecontroleerd op
> vervallen credentials of gewijzigde contactgegevens.

---

## 4. Sparki emergency-content populatie

De volgende berichten dienen als draft klaar te staan voor onmiddellijke verzending:

### Bericht A — Dienst tijdelijk in onderhoud (MAINTENANCE-modus)
```
Hoi,

Sparki is tijdelijk in onderhoudsmodus. Je gegevens zijn veilig en worden bewaard.
We verwachten de dienst zo snel mogelijk te hervatten.

Team Sparki
```

### Bericht B — Dienst permanent gestopt (SERVICE_SHUTDOWN)
```
Hoi,

Sparki stopt als dienst. Jouw gegevens zijn de komende 30 dagen beschikbaar voor download
via [export-link]. Na deze periode worden alle gegevens veilig verwijderd conform de AVG.

Bedankt voor je vertrouwen in Sparki.

Team Sparki
```

### Bericht C — Intern aan coaches/clubs (transitie)
```
Beste coach / clubvertegenwoordiger,

Sparki gaat door een periode van transitie. Hierover volgt binnenkort meer informatie.
Uw atleten en trainingsdata blijven bewaard. Neem contact op via [e-mailadres] voor vragen.
```

---

## 5. Systeemmodi & bevoegdheden

Zie `docs/P01_EVIDENCE_DOCUMENT.md` en de admin-ops-pagina (`/admin/ops`) voor de
operationele werking. Dit document regelt de menselijke bevoegdheden:

| Modus | Wie mag activeren | Vereiste handtekeningen |
|---|---|---|
| NORMAL | René | 1 |
| DEGRADED | René of Dylan | 1 |
| MAINTENANCE | René, Dylan of Tessa | 1 |
| SALES_PAUSED | René | 1 |
| BILLING_PAUSED | René | 1 (met notariële kennisgeving) |
| SERVICE_SHUTDOWN | René + Dylan of Tessa gezamenlijk | 2 (dubbele bevestiging) |

> ⚠️ `SERVICE_SHUTDOWN` mag **nooit** door één persoon alleen worden geactiveerd.

---

## 6. Wijzigingshistorie

| Versie | Datum | Auteur | Wijziging |
|---|---|---|---|
| 1.0 | 2026-07-28 | René (Sparki) | Eerste versie, gebaseerd op YAML masterplan v2.84 SUCC-01 t/m SUCC-12 |
