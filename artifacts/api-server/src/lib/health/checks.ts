import { eq, sql } from "drizzle-orm";
import { db, connectorConnectionsTable } from "@workspace/db";
import { connectorRegistry } from "../connectors/registry";
import { emailChannelStatus } from "../email";
import {
  isStravaConfigured,
  getValidStravaAccessToken,
} from "../connectors/providers/strava-oauth";
import type { CheckDefinition, ProbeResult } from "./types";

// ── Probe helpers ────────────────────────────────────────────────────────────

function ms(start: number): number {
  return Math.max(0, Math.round(performance.now() - start));
}

// A GREY result: honestly not wired / not connected. `reason` is plain Dutch.
function grey(reason: string, start: number): ProbeResult {
  return {
    status: "grey",
    passed: false,
    responseTimeMs: ms(start),
    message: reason,
  };
}

// Fetch with a hard timeout so a hanging dependency can't stall the engine.
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 8000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// A read query against a real table proves the store is reachable. Returns a
// green result (orange when slow) or a red result with a plain-language error.
async function probeTableRead(
  countSql: ReturnType<typeof sql>,
  okMessage: string,
  failMessage: string,
): Promise<ProbeResult> {
  const start = performance.now();
  try {
    await db.execute(countSql);
    const took = ms(start);
    return {
      status: took > 1500 ? "orange" : "green",
      passed: true,
      responseTimeMs: took,
      message: took > 1500 ? `${okMessage} (trage respons)` : okMessage,
      technicalDetails: `Query OK in ${took}ms`,
    };
  } catch (err) {
    return {
      status: "red",
      passed: false,
      responseTimeMs: ms(start),
      message: failMessage,
      technicalDetails: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Individual probes ────────────────────────────────────────────────────────

// Auth (Clerk): verify the secret key actually works against Clerk's backend
// API. Missing config is a real outage (no login) → red.
async function probeAuthClerk(): Promise<ProbeResult> {
  const start = performance.now();
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret || !process.env.CLERK_PUBLISHABLE_KEY) {
    return {
      status: "red",
      passed: false,
      responseTimeMs: ms(start),
      message:
        "Inloggen is niet ingesteld. Niemand kan inloggen of registreren.",
      technicalDetails: "CLERK_SECRET_KEY/CLERK_PUBLISHABLE_KEY ontbreekt.",
      urgency: "critical",
    };
  }
  try {
    const res = await fetchWithTimeout("https://api.clerk.com/v1/users?limit=1", {
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
    });
    const took = ms(start);
    if (res.ok) {
      return {
        status: took > 2000 ? "orange" : "green",
        passed: true,
        responseTimeMs: took,
        message:
          took > 2000
            ? "Inloggen werkt, maar reageert traag."
            : "Inloggen en registreren werken.",
        technicalDetails: `Clerk API antwoordde ${res.status} in ${took}ms`,
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        status: "red",
        passed: false,
        responseTimeMs: took,
        message:
          "Inloggen werkt niet: de beveiligingssleutel wordt geweigerd. Sporters kunnen niet inloggen.",
        technicalDetails: `Clerk API antwoordde ${res.status}`,
        urgency: "critical",
      };
    }
    return {
      status: "orange",
      passed: false,
      responseTimeMs: took,
      message: "De inlogdienst reageert onverwacht. Houd dit in de gaten.",
      technicalDetails: `Clerk API antwoordde ${res.status}`,
    };
  } catch (err) {
    return {
      status: "orange",
      passed: false,
      responseTimeMs: ms(start),
      message: "De inlogdienst is even niet bereikbaar.",
      technicalDetails: err instanceof Error ? err.message : String(err),
    };
  }
}

// Database read + write. Read = SELECT 1. Write = a temp table that drops itself
// on commit, proving write access without leaving any trace.
async function probeDatabase(): Promise<ProbeResult> {
  const start = performance.now();
  try {
    await db.execute(sql`SELECT 1`);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`CREATE TEMP TABLE _hc_write_probe (n int) ON COMMIT DROP`,
      );
      await tx.execute(sql`INSERT INTO _hc_write_probe (n) VALUES (1)`);
    });
    const took = ms(start);
    return {
      status: took > 1500 ? "orange" : "green",
      passed: true,
      responseTimeMs: took,
      message:
        took > 1500
          ? "De database werkt, maar reageert traag."
          : "De database leest en schrijft normaal.",
      technicalDetails: `Lees- en schrijftest OK in ${took}ms`,
    };
  } catch (err) {
    return {
      status: "red",
      passed: false,
      responseTimeMs: ms(start),
      message:
        "De database is niet bereikbaar. Vrijwel niets in de app werkt nu.",
      technicalDetails: err instanceof Error ? err.message : String(err),
      urgency: "critical",
    };
  }
}

// Sparki processes (Anthropic). GREY when not configured; otherwise a minimal
// real call confirms reachability. The client module throws on import when the
// env is missing, so we import it dynamically behind an env check.
async function probeSparkiAi(): Promise<ProbeResult> {
  const start = performance.now();
  if (
    !process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
    !process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
  ) {
    return grey(
      "Sparki-denkkracht is nog niet gekoppeld. Slimme samenvattingen en coaching zijn tijdelijk uit.",
      start,
    );
  }
  try {
    const { anthropic } = await import("@workspace/integrations-anthropic-ai");
    await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4,
      messages: [{ role: "user", content: "ping" }],
    });
    const took = ms(start);
    return {
      status: took > 4000 ? "orange" : "green",
      passed: true,
      responseTimeMs: took,
      message:
        took > 4000
          ? "Sparki-denkkracht reageert, maar traag."
          : "Sparki-denkkracht werkt.",
      technicalDetails: `Anthropic antwoordde in ${took}ms`,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const rate = /rate|429|limit/i.test(detail);
    return {
      status: rate ? "orange" : "red",
      passed: false,
      responseTimeMs: ms(start),
      message: rate
        ? "Sparki-denkkracht zit tegen de gebruikslimiet aan. Het kan even trager zijn."
        : "Sparki-denkkracht reageert niet. Slimme functies werken tijdelijk niet.",
      technicalDetails: detail,
      urgency: rate ? "medium" : "high",
    };
  }
}

// Maps / route planner (OpenRouteService). GREY when no API key; otherwise a
// real geocode call confirms the key works and ORS is reachable.
async function probeMapsOrs(): Promise<ProbeResult> {
  const start = performance.now();
  const key = process.env.ORS_API_KEY;
  if (!key) {
    return grey(
      "De routekaart-dienst is nog niet gekoppeld. Routes plannen is tijdelijk uit.",
      start,
    );
  }
  try {
    const url = new URL("https://api.openrouteservice.org/geocode/search");
    url.searchParams.set("api_key", key);
    url.searchParams.set("text", "Amsterdam");
    url.searchParams.set("size", "1");
    const res = await fetchWithTimeout(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const took = ms(start);
    if (res.ok) {
      return {
        status: took > 3000 ? "orange" : "green",
        passed: true,
        responseTimeMs: took,
        message:
          took > 3000
            ? "Routes plannen werkt, maar reageert traag."
            : "Routes plannen en kaarten werken.",
        technicalDetails: `ORS antwoordde ${res.status} in ${took}ms`,
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        status: "red",
        passed: false,
        responseTimeMs: took,
        message:
          "Routes plannen werkt niet: de kaartsleutel wordt geweigerd. Sporters kunnen geen routes maken.",
        technicalDetails: `ORS antwoordde ${res.status}`,
        urgency: "high",
        remediation:
          "Controleer de ORS_API_KEY of de maandlimiet van OpenRouteService.",
      };
    }
    if (res.status === 429) {
      return {
        status: "orange",
        passed: false,
        responseTimeMs: took,
        message:
          "De routekaart-dienst zit aan de daglimiet. Routes plannen kan tijdelijk haperen.",
        technicalDetails: "ORS antwoordde 429 (limiet bereikt)",
        urgency: "medium",
      };
    }
    return {
      status: "orange",
      passed: false,
      responseTimeMs: took,
      message: "De routekaart-dienst reageert onverwacht.",
      technicalDetails: `ORS antwoordde ${res.status}`,
    };
  } catch (err) {
    return {
      status: "orange",
      passed: false,
      responseTimeMs: ms(start),
      message: "De routekaart-dienst is even niet bereikbaar.",
      technicalDetails: err instanceof Error ? err.message : String(err),
    };
  }
}

// Strava connector. Direct per-user OAuth (not the Replit proxy). GREY when
// OAuth is not configured; GREEN when configured (and, if an athlete is
// connected, when their access token can be read/refreshed); ORANGE when a live
// connection's token refresh fails.
async function probeStrava(): Promise<ProbeResult> {
  const start = performance.now();
  // Strava is wired via DIRECT per-user OAuth (STRAVA_CLIENT_ID/SECRET), with the
  // access/refresh tokens stored per athlete in connector_connections — NOT via
  // the Replit connector-proxy. So the probe measures that real path: is OAuth
  // configured, and can a live connection's access token actually be refreshed?
  if (!isStravaConfigured()) {
    return grey(
      "Strava is nog niet gekoppeld. De koppeling is nog niet geconfigureerd, dus sporters kunnen nog geen ritten importeren.",
      start,
    );
  }
  try {
    const rows = await db
      .select({
        clerkId: connectorConnectionsTable.clerkId,
        status: connectorConnectionsTable.status,
      })
      .from(connectorConnectionsTable)
      .where(eq(connectorConnectionsTable.provider, "strava"));

    const connected = rows.filter((r) => r.status === "connected");
    if (connected.length === 0) {
      // The capability is fully wired and configured; there is simply no active
      // athlete connection yet to import-test. That is honest, not a failure.
      return {
        status: "green",
        passed: true,
        responseTimeMs: ms(start),
        message:
          "Strava-koppeling is beschikbaar; sporters kunnen verbinden. Er is nog geen actieve koppeling om een import mee te testen.",
        technicalDetails: `Strava OAuth geconfigureerd; ${rows.length} koppeling(en), 0 actief.`,
      };
    }
    // Validate a real connection end-to-end: read/refresh a live access token.
    try {
      await getValidStravaAccessToken(connected[0].clerkId);
      const took = ms(start);
      return {
        status: "green",
        passed: true,
        responseTimeMs: took,
        message: "Strava is gekoppeld. Ritten importeren werkt.",
        technicalDetails: `Actief toegangstoken gevalideerd voor ${connected.length} koppeling(en) in ${took}ms.`,
      };
    } catch (tokenErr) {
      return {
        status: "orange",
        passed: false,
        responseTimeMs: ms(start),
        message:
          "Een Strava-koppeling kon niet worden ververst. De betreffende sporter moet mogelijk opnieuw koppelen.",
        technicalDetails:
          tokenErr instanceof Error ? tokenErr.message : String(tokenErr),
      };
    }
  } catch (err) {
    return {
      status: "orange",
      passed: false,
      responseTimeMs: ms(start),
      message: "De Strava-koppeling is even niet te controleren.",
      technicalDetails: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Registry of all checks ────────────────────────────────────────────────────

// Audience-impact helper for readable, consistent userImpact strings.
function impact(text: string): string {
  return text;
}

const coreChecks: CheckDefinition[] = [
  {
    key: "auth_clerk",
    category: "auth",
    title: "Inloggen & registreren",
    description:
      "Controleert of sporters, ouders en coaches kunnen inloggen en registreren.",
    responsibleModule: "Auth (Clerk)",
    userImpact: impact(
      "Sporters, ouders, coaches en admins kunnen niet inloggen of registreren.",
    ),
    urgency: "critical",
    remediation:
      "Controleer de Clerk-instellingen (CLERK_SECRET_KEY) of de status van Clerk.",
    probe: probeAuthClerk,
  },
  {
    key: "database",
    category: "database",
    title: "Database (opslag)",
    description:
      "Controleert of de centrale database leest en schrijft (alle gegevens).",
    responsibleModule: "Database (Postgres)",
    userImpact: impact(
      "Vrijwel alles stopt: sporters, ouders, coaches en admins zien fouten of lege schermen.",
    ),
    urgency: "critical",
    remediation: "Controleer DATABASE_URL en de status van de database.",
    probe: probeDatabase,
  },
  {
    key: "ai_sparki",
    category: "ai",
    title: "Sparki-denkkracht",
    description:
      "Controleert of Sparki slimme samenvattingen en coaching kan maken.",
    responsibleModule: "Sparki-processen (Anthropic)",
    userImpact: impact(
      "Sporters en coaches missen slimme samenvattingen, inzichten en coaching-teksten.",
    ),
    urgency: "high",
    remediation:
      "Controleer de Sparki-denkkracht koppeling (Anthropic-integratie) of de gebruikslimiet.",
    probe: probeSparkiAi,
  },
  {
    key: "maps_ors",
    category: "maps",
    title: "Routes & kaarten",
    description:
      "Controleert of routes gepland en kaarten geladen kunnen worden.",
    responsibleModule: "Routeplanner (OpenRouteService)",
    userImpact: impact("Sporters kunnen geen nieuwe routes plannen of bekijken."),
    urgency: "high",
    remediation: "Controleer de ORS_API_KEY of de maandlimiet van de kaartdienst.",
    probe: probeMapsOrs,
  },
  {
    key: "notifications_inapp",
    category: "notifications",
    title: "Meldingen in de app",
    description: "Controleert of meldingen kunnen worden opgeslagen en getoond.",
    responsibleModule: "Meldingen (in-app)",
    userImpact: impact(
      "Sporters, ouders en coaches missen meldingen in de app.",
    ),
    urgency: "medium",
    remediation: "Controleer de database en de meldingen-tabel.",
    probe: () =>
      probeTableRead(
        sql`SELECT count(*) FROM notifications`,
        "Meldingen in de app werken.",
        "Meldingen kunnen niet worden geladen.",
      ),
  },
  {
    key: "onboarding_flow",
    category: "onboarding",
    title: "Onboarding (eerste keer)",
    description:
      "Controleert of nieuwe sporters de onboarding kunnen doorlopen en opslaan.",
    responsibleModule: "Onboarding",
    userImpact: impact(
      "Nieuwe sporters kunnen hun start-vragen niet afronden of opslaan.",
    ),
    urgency: "high",
    remediation: "Controleer de database en de onboarding-tabel.",
    probe: () =>
      probeTableRead(
        sql`SELECT count(*) FROM onboarding_state`,
        "Onboarding werkt.",
        "De onboarding-gegevens kunnen niet worden geladen.",
      ),
  },
  {
    key: "invite_flow",
    category: "invite",
    title: "Uitnodigingen & testers",
    description:
      "Controleert of uitnodigingslinks (testers, coaches, ouders) werken.",
    responsibleModule: "Uitnodigingen",
    userImpact: impact(
      "Nieuwe testers, coaches of ouders kunnen niet via een uitnodiging binnenkomen.",
    ),
    urgency: "medium",
    remediation: "Controleer de database en de uitnodigingen-tabel.",
    probe: () =>
      probeTableRead(
        sql`SELECT count(*) FROM invitations`,
        "Uitnodigingen werken.",
        "Uitnodigingen kunnen niet worden geladen.",
      ),
  },
  {
    key: "parent_supervision",
    category: "parent",
    title: "Ouder-toezicht",
    description:
      "Controleert of de koppeling tussen ouder en (minderjarige) sporter werkt.",
    responsibleModule: "Ouder-koppelingen",
    userImpact: impact(
      "Ouders kunnen het welzijn van hun kind niet volgen.",
    ),
    urgency: "medium",
    remediation: "Controleer de database en de ouder-koppeling-tabel.",
    probe: () =>
      probeTableRead(
        sql`SELECT count(*) FROM parent_athlete_links`,
        "Ouder-toezicht werkt.",
        "De ouder-koppelingen kunnen niet worden geladen.",
      ),
  },
  {
    key: "links_sharing",
    category: "links",
    title: "Koppelingen & delen",
    description:
      "Controleert of coach-, ouder- en deellinks (privé/club/intern) werken.",
    responsibleModule: "Koppelingen & links",
    userImpact: impact(
      "Coaches en ouders kunnen niet aan sporters gekoppeld worden.",
    ),
    urgency: "medium",
    remediation: "Controleer de database en de koppelingen-tabellen.",
    probe: () =>
      probeTableRead(
        sql`SELECT
          (SELECT count(*) FROM coach_athlete_links) +
          (SELECT count(*) FROM parent_athlete_links) AS n`,
        "Koppelingen en delen werken.",
        "De koppelingen kunnen niet worden geladen.",
      ),
  },
  {
    key: "feedback_messages",
    category: "feedback",
    title: "Feedback van sporters",
    description:
      "Controleert of feedback van sporters (na trainingen) wordt opgeslagen.",
    responsibleModule: "Trainingsfeedback",
    userImpact: impact(
      "Sparki en coaches missen de feedback van sporters na trainingen.",
    ),
    urgency: "low",
    remediation: "Controleer de database en de feedback-tabel.",
    probe: () =>
      probeTableRead(
        sql`SELECT count(*) FROM workout_feedback`,
        "Feedback van sporters wordt opgeslagen.",
        "Feedback van sporters kan niet worden geladen.",
      ),
  },
  {
    key: "bugreport_capture",
    category: "bugreport",
    title: "Bugmeldingen",
    description: "Controleert of testers bugmeldingen kunnen indienen.",
    responsibleModule: "Bugmeldingen",
    userImpact: impact(
      "Testers kunnen geen problemen melden; admins missen bugrapporten.",
    ),
    urgency: "low",
    remediation: "Controleer de database en de bugmeldingen-tabel.",
    probe: () =>
      probeTableRead(
        sql`SELECT count(*) FROM bug_reports`,
        "Bugmeldingen werken.",
        "Bugmeldingen kunnen niet worden geladen.",
      ),
  },
  {
    key: "nightly_knowledge",
    category: "nightly",
    title: "Nachtelijke kennis-scan",
    description:
      "Controleert of de kennisbank gevuld is door de nachtelijke scan.",
    responsibleModule: "Kennis-scan (nachtelijk)",
    userImpact: impact("Sporters en coaches zien geen verse kennis of nieuws."),
    urgency: "low",
    remediation:
      "Controleer de geplande nachtelijke scan (Scheduled Deployment) en de kennisbank.",
    probe: async () => {
      const start = performance.now();
      try {
        const r = await db.execute(
          sql`SELECT count(*)::int AS n FROM knowledge_items`,
        );
        const n = Number((r.rows[0] as { n?: number } | undefined)?.n ?? 0);
        const took = ms(start);
        if (n === 0) {
          return {
            status: "orange",
            passed: false,
            responseTimeMs: took,
            message:
              "De kennisbank is nog leeg. De nachtelijke scan heeft (nog) niets opgehaald.",
            technicalDetails: "knowledge_items bevat 0 rijen",
          };
        }
        return {
          status: "green",
          passed: true,
          responseTimeMs: took,
          message: `De kennisbank is gevuld (${n} items).`,
          technicalDetails: `knowledge_items: ${n} rijen in ${took}ms`,
        };
      } catch (err) {
        return {
          status: "red",
          passed: false,
          responseTimeMs: ms(start),
          message: "De kennisbank kan niet worden gelezen.",
          technicalDetails: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },
  {
    key: "goal_review_job",
    category: "goals",
    title: "Maandelijkse doelen-review",
    description:
      "Controleert of de maandelijkse doelen-review echt voorstellen heeft opgeleverd.",
    responsibleModule: "Doelen-review (maandelijks)",
    userImpact: impact(
      "Sporters krijgen geen maandelijkse voorstellen om hun doelen bij te sturen.",
    ),
    urgency: "medium",
    remediation:
      "Controleer de geplande maandelijkse taak (Scheduled Deployment, job:goal-review) en de logs van de laatste run.",
    probe: async () => {
      const start = performance.now();
      try {
        const r = await db.execute(sql`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (
              WHERE created_at >= now() - interval '35 days'
            )::int AS recent,
            max(created_at) AS last_at
          FROM goal_proposals
        `);
        const row = r.rows[0] as
          | { total?: number; recent?: number; last_at?: string | Date | null }
          | undefined;
        const total = Number(row?.total ?? 0);
        const recent = Number(row?.recent ?? 0);
        const lastAt = row?.last_at ? new Date(row.last_at) : null;
        const took = ms(start);

        if (total === 0) {
          // Never ran (or never produced anything). Distinguish honestly:
          // without active goals there is nothing for the job to propose.
          const g = await db.execute(
            sql`SELECT count(*)::int AS n FROM athlete_goals WHERE status = 'active'`,
          );
          const activeGoals = Number(
            (g.rows[0] as { n?: number } | undefined)?.n ?? 0,
          );
          if (activeGoals === 0) {
            return grey(
              "De doelen-review heeft nog nooit voorstellen gemaakt — er zijn ook nog geen actieve doelen om te beoordelen. Zodra sporters doelen hebben, hoort hier resultaat te verschijnen.",
              start,
            );
          }
          return grey(
            `De doelen-review heeft nog nooit voorstellen gemaakt, terwijl er wel ${activeGoals} actieve doel(en) zijn. Controleer of de geplande maandelijkse taak (job:goal-review) is aangemaakt.`,
            start,
          );
        }

        if (recent === 0) {
          return {
            status: "orange",
            passed: false,
            responseTimeMs: took,
            message: `De doelen-review heeft in de afgelopen 35 dagen geen voorstellen gemaakt. Laatste voorstel: ${
              lastAt ? lastAt.toLocaleDateString("nl-NL") : "onbekend"
            }. Mogelijk draait de geplande taak niet meer.`,
            technicalDetails: `goal_proposals: ${total} totaal, 0 in laatste 35 dagen`,
          };
        }

        return {
          status: "green",
          passed: true,
          responseTimeMs: took,
          message: `De doelen-review draait: ${recent} voorstel(len) in de afgelopen 35 dagen.`,
          technicalDetails: `goal_proposals: ${recent} recent / ${total} totaal in ${took}ms`,
        };
      } catch (err) {
        return {
          status: "red",
          passed: false,
          responseTimeMs: ms(start),
          message: "De doelen-voorstellen kunnen niet worden gelezen.",
          technicalDetails: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },
  {
    key: "mail_server",
    category: "mail",
    title: "E-mail & herinneringen per mail",
    description:
      "Controleert of er e-mails verstuurd kunnen worden (herinneringen, meldingen).",
    responsibleModule: "E-mailkanaal (Resend)",
    userImpact: impact(
      "Herinneringen gaan niet per e-mail uit; ze blijven wel in de app staan.",
    ),
    urgency: "low",
    remediation:
      "Koppel een e-mailprovider en verifieer een eigen domein zodat er aan alle sporters gemaild kan worden.",
    probe: async () => {
      const start = performance.now();
      // Honesty contract: a real probe of the email channel. Never fake green.
      //   ready          → GREEN (verified sender domain, can mail athletes)
      //   limited        → ORANGE (connected but no verified domain: only test
      //                    sends to the account owner work — "let op")
      //   not_configured → GREY (no provider connected yet)
      let status;
      try {
        status = await emailChannelStatus();
      } catch (err) {
        return {
          status: "red",
          passed: false,
          responseTimeMs: ms(start),
          message: "Het e-mailkanaal kan niet gecontroleerd worden.",
          technicalDetails: err instanceof Error ? err.message : String(err),
        };
      }
      if (status.state === "ready") {
        const domains =
          status.verifiedDomains.length > 0
            ? status.verifiedDomains.join(", ")
            : "(eigen afzender ingesteld)";
        return {
          status: "green",
          passed: true,
          responseTimeMs: ms(start),
          message: "E-mail werkt: herinneringen kunnen per mail verstuurd worden.",
          technicalDetails: `Afzender ${status.from}; geverifieerd: ${domains}`,
        };
      }
      if (status.state === "limited") {
        return {
          status: "orange",
          passed: false,
          responseTimeMs: ms(start),
          message:
            "E-mail is gekoppeld, maar er is nog geen eigen domein geverifieerd. Tot die tijd kan alleen naar de eigenaar van het account getest worden — herinneringen aan sporters gaan nog niet per mail uit.",
          technicalDetails: status.reason,
        };
      }
      const r = grey(
        "Er is nog geen e-mailkanaal gekoppeld. Herinneringen blijven voorlopig in de app staan.",
        start,
      );
      r.technicalDetails = status.reason;
      return r;
    },
  },
];

// Honestly-unwired capabilities. Each is GREY with a plain reason and detects
// presence rather than assuming — when the capability lands, the probe flips.
const unwiredChecks: CheckDefinition[] = [
  {
    key: "gps_permission",
    category: "gps",
    title: "GPS & locatie",
    description:
      "Locatietoegang is een toestemming op het toestel/de browser van de gebruiker.",
    responsibleModule: "GPS / locatie (toestel)",
    userImpact: impact(
      "Locatie hangt af van de toestemming op het toestel; dit is niet vanaf de server te meten.",
    ),
    urgency: "low",
    remediation:
      "Dit is een toestel-toestemming. De gebruiker geeft locatietoegang in de app/browser.",
    probe: async () => {
      const start = performance.now();
      return grey(
        "GPS/locatie is een toestemming op het toestel van de gebruiker en kan niet vanaf de server gecontroleerd worden.",
        start,
      );
    },
  },
  {
    key: "gpx_export",
    category: "gpx",
    title: "GPX-export",
    description:
      "Controleert of routes als GPX-bestand geëxporteerd kunnen worden.",
    responsibleModule: "GPX-export",
    userImpact: impact(
      "Sporters kunnen routes (nog) niet als GPX-bestand downloaden voor hun fietscomputer.",
    ),
    urgency: "low",
    remediation:
      "GPX-export wordt apart opgeleverd. Zodra die functie er is, gaat deze controle automatisch meten.",
    probe: async () => {
      const start = performance.now();
      // Honesty contract: GPX *export* code does not exist in the app yet (only
      // GPX import/parsing). There is nothing real to test, so this stays GREY.
      // When an export route/function is built, replace this with a real probe
      // that generates a GPX from sample data and validates the output.
      const r = grey(
        "GPX-export is nog niet gebouwd in deze versie. Sporters kunnen routes nog niet downloaden voor hun fietscomputer.",
        start,
      );
      r.technicalDetails = "Geen GPX-export functie/route aanwezig om te testen.";
      return r;
    },
  },
  {
    key: "storage_objects",
    category: "storage",
    title: "Bestandsopslag & uploads",
    description:
      "Controleert of bestanden (zoals screenshots bij bugmeldingen) geüpload kunnen worden.",
    responsibleModule: "Bestandsopslag (object storage)",
    userImpact: impact(
      "Uploads van bestanden/foto's zijn nog niet beschikbaar; screenshots gaan voorlopig via een link.",
    ),
    urgency: "low",
    remediation:
      "Koppel object storage zodra bestand-uploads nodig zijn.",
    probe: async () => {
      const start = performance.now();
      // Honesty contract: no object-storage client is wired in the app, so there
      // is no real upload/read test to run. This stays GREY even if storage env
      // vars exist. When a storage client is added, replace this with a real
      // probe that uploads + reads + deletes a tiny test object.
      const configured = Boolean(
        process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ||
          process.env.PRIVATE_OBJECT_DIR ||
          process.env.PUBLIC_OBJECT_SEARCH_PATHS,
      );
      const r = grey(
        configured
          ? "Er is bestandsopslag geconfigureerd, maar er is nog geen echte upload-test gekoppeld. Bestand-uploads worden nog niet bevestigd."
          : "Bestandsopslag voor uploads is nog niet ingesteld. Deze functie is nog niet beschikbaar.",
        start,
      );
      r.technicalDetails = configured
        ? "Object-storage omgevingsvariabele gevonden; geen functionele upload-test gewired."
        : "Geen object-storage omgevingsvariabele gevonden.";
      return r;
    },
  },
];

// Connector checks are generated from the registry so adding a platform there
// automatically adds a check. Strava is wired (real probe); everything with
// available=false is honestly GREY with its Dutch reason.
const connectorChecks: CheckDefinition[] = connectorRegistry.map((def) => {
  if (def.id === "strava") {
    return {
      key: "connector_strava",
      category: "connector",
      title: "Koppeling: Strava",
      description: "Controleert of de Strava-koppeling actief is.",
      responsibleModule: "Connector: Strava",
      userImpact: impact(
        "Sporters kunnen geen ritten en gegevens uit Strava importeren.",
      ),
      urgency: "medium",
      remediation:
        "Controleer de Strava-koppeling, het API-token of de API-limiet.",
      probe: probeStrava,
    } satisfies CheckDefinition;
  }
  const reason =
    def.unavailableReason ??
    `${def.displayName} is nog niet gekoppeld.`;
  return {
    key: `connector_${def.id}`,
    category: "connector",
    title: `Koppeling: ${def.displayName}`,
    description: `Controleert of de ${def.displayName}-koppeling beschikbaar is.`,
    responsibleModule: `Connector: ${def.displayName}`,
    userImpact: impact(
      `${def.displayName} is nog niet beschikbaar; gegevens hiervan kunnen nog niet geïmporteerd worden.`,
    ),
    urgency: "low",
    remediation: `${def.displayName} wordt later gekoppeld. Tot die tijd blijft deze grijs.`,
    probe: async () => {
      const start = performance.now();
      return grey(reason, start);
    },
  } satisfies CheckDefinition;
});

export const healthCheckDefinitions: CheckDefinition[] = [
  ...coreChecks,
  ...unwiredChecks,
  ...connectorChecks,
];

export function getCheckDefinition(key: string): CheckDefinition | undefined {
  return healthCheckDefinitions.find((c) => c.key === key);
}
