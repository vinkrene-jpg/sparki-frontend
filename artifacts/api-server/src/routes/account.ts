// Accountbeheer: inzien, corrigeren (via bestaande profiel-routes), volledige
// export, verwijderen (met hersteltermijn), sessies beëindigen en tonen welke
// gegevens iedere rol ziet.

import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  connectorConnectionsTable,
  type PrivacySettings,
} from "@workspace/db";
import { clerkClient } from "@clerk/express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { rateLimit } from "../lib/security/rate-limit";
import { writeAudit } from "../lib/security/audit";
import {
  exportAccountData,
  executeAccountDeletion,
  DELETE_CONFIRM_PHRASE,
  recoveryDaysFor,
  allowsDirectDeletion,
  resolveAccountType,
} from "../lib/account-privacy";
import { createNotification } from "../lib/notifications";

const router = Router();

// Wat iedere rol ziet, afgeleid van de ECHTE deelinstellingen. Dit is dezelfde
// logica die de coach-/ouder-routes afdwingen — hier alleen uitgelegd.
export function roleVisibility(privacy: Pick<
  PrivacySettings,
  "dataSharingCoach" | "dataSharingParent" | "shareActivityWithFriends"
> | null) {
  const coach = privacy?.dataSharingCoach ?? "summary";
  const parent = privacy?.dataSharingParent ?? "safety_only";
  const friends = privacy?.shareActivityWithFriends ?? false;
  return {
    coach: {
      level: coach,
      ziet:
        coach === "none"
          ? []
          : coach === "summary"
            ? ["Trainingsgereedheid", "Weekschema en planning"]
            : [
                "Trainingsgereedheid",
                "Weekschema en planning",
                "Ruwe trainingsdata (vermogen, hartslag, duur)",
              ],
      zietNiet:
        coach === "full"
          ? ["Persoonlijke notities en gesprekken met Sparki"]
          : [
              "Ruwe trainingsdata",
              "Persoonlijke notities en gesprekken met Sparki",
            ],
    },
    ouder: {
      level: parent,
      ziet:
        parent === "none"
          ? []
          : parent === "safety_only"
            ? ["Veiligheids- en welzijnssignalen"]
            : ["Veiligheids- en welzijnssignalen", "Weekschema"],
      zietNiet: [
        "Prestatiedata (vermogen, tijden, testresultaten)",
        "Gesprekken met Sparki",
      ],
    },
    club: {
      level: "geen_directe_toegang",
      ziet: [],
      zietNiet: ["Alles — een club kijkt alleen mee via een gekoppelde coach, binnen jouw coach-instelling"],
    },
    vrienden: {
      level: friends ? "activiteit_updates" : "none",
      ziet: friends ? ["Activiteit-updates (training afgerond, wedstrijd gepland)"] : [],
      zietNiet: ["Gezondheidsdata", "Prestatiedetails", "Gesprekken met Sparki"],
    },
  };
}

// GET /api/account/overview — persoonsgegevens + rollen-inzage in één blik.
router.get("/overview", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [[profile], [athlete], [privacy], connections, coachLinks, parentLinks] =
      await Promise.all([
        db.select().from(userProfilesTable).where(eq(userProfilesTable.clerkId, clerkId)),
        db.select().from(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, clerkId)),
        db.select().from(privacySettingsTable).where(eq(privacySettingsTable.clerkId, clerkId)),
        db
          .select({
            provider: connectorConnectionsTable.provider,
            status: connectorConnectionsTable.status,
            lastSyncAt: connectorConnectionsTable.lastSyncAt,
          })
          .from(connectorConnectionsTable)
          .where(eq(connectorConnectionsTable.clerkId, clerkId)),
        db
          .select({
            coachClerkId: coachAthleteLinksTable.coachClerkId,
            status: coachAthleteLinksTable.status,
          })
          .from(coachAthleteLinksTable)
          .where(eq(coachAthleteLinksTable.athleteClerkId, clerkId)),
        db
          .select({
            parentClerkId: parentAthleteLinksTable.parentClerkId,
            status: parentAthleteLinksTable.status,
          })
          .from(parentAthleteLinksTable)
          .where(eq(parentAthleteLinksTable.athleteClerkId, clerkId)),
      ]);
    if (!profile) {
      res.status(404).json({ error: "Profiel niet gevonden" });
      return;
    }
    const deleteRequestedAt = privacy?.deleteRequestedAt ?? null;
    const accountType = await resolveAccountType(clerkId);
    const recoveryDays = recoveryDaysFor(accountType);
    res.json({
      profiel: {
        email: profile.email,
        naam: profile.displayName,
        rollen: profile.roles,
        actieveRol: profile.activeRole,
        aangemaaktOp: profile.createdAt,
      },
      sporterprofiel: athlete ?? null,
      privacy: privacy ?? null,
      koppelingen: connections,
      coachLinks,
      ouderLinks: parentLinks,
      wieZietWat: roleVisibility(privacy ?? null),
      // Hersteltermijn expliciet meegeven zodat de UI 'm nooit hoeft te hardcoden.
      hersteltermijnDagen: recoveryDays,
      directDefinitiefMogelijk: allowsDirectDeletion(accountType),
      verwijdering: deleteRequestedAt
        ? {
            aangevraagdOp: deleteRequestedAt,
            definitiefOp: new Date(
              new Date(deleteRequestedAt).getTime() +
                recoveryDays * 24 * 60 * 60 * 1000,
            ),
            herstelbaar: true,
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "account.overview failed");
    res.status(500).json({ error: "Er ging iets mis. Probeer het opnieuw." });
  }
});

// GET /api/account/export — volledige data-export (JSON-download).
router.get(
  "/export",
  requireAuth,
  rateLimit({ scope: "account_export", max: 3, windowMs: 60 * 60_000 }),
  async (req, res) => {
    const clerkId = getClerkUserId(req)!;
    try {
      const data = await exportAccountData(clerkId);
      await writeAudit(
        {
          event: "data_export",
          actorClerkId: clerkId,
          subjectClerkId: clerkId,
          meta: { tables: Object.keys(data.tables).length },
          req,
        },
        { required: true },
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="sparki-export.json"',
      );
      res.json(data);
    } catch (err) {
      req.log.error({ err }, "account.export failed");
      res.status(500).json({ error: "Export is niet gelukt. Probeer het opnieuw." });
    }
  },
);

// POST /api/account/delete — verwijderverzoek met expliciete bevestiging.
router.post(
  "/delete",
  requireAuth,
  rateLimit({ scope: "account_delete", max: 5, windowMs: 60 * 60_000 }),
  async (req, res) => {
    const clerkId = getClerkUserId(req)!;
    const body = (req.body as Record<string, unknown>) ?? {};
    const confirm = String(body.confirm ?? "");
    // GF8-05: "direct definitief" is een expliciete keuze naast de bevestigingszin.
    const directDefinitief = body.directDefinitief === true;
    if (confirm !== DELETE_CONFIRM_PHRASE) {
      res.status(400).json({
        error: `Bevestig de verwijdering door exact "${DELETE_CONFIRM_PHRASE}" mee te sturen.`,
      });
      return;
    }
    try {
      const accountType = await resolveAccountType(clerkId);
      // GF8-05: direct definitief verwijderen — geen hersteltermijn, meteen uit.
      if (directDefinitief) {
        // GF8-08: sommige accounttypes (club) mogen dit nooit — server weigert.
        if (!allowsDirectDeletion(accountType)) {
          res.status(403).json({
            error:
              "Direct definitief verwijderen is voor dit account niet mogelijk; de hersteltermijn van 30 dagen geldt altijd.",
          });
          return;
        }
        // GF8-06: bericht op het moment van verwijderen, vóór het account weg is.
        await createNotification({
          clerkId,
          type: "system",
          category: "privacy",
          title: "Je account wordt nu definitief verwijderd",
          body: "Je koos voor direct definitief verwijderen. Al je gegevens worden nu verwijderd en dit is niet meer terug te draaien.",
          source: "account",
        });
        const result = await executeAccountDeletion(clerkId, {
          reason: "direct_verzoek",
        });
        res.json({
          ok: true,
          definitief: true,
          uitzonderingen: result.exceptions,
        });
        return;
      }

      const now = new Date();
      const recoveryDays = recoveryDaysFor(accountType);
      await db
        .insert(privacySettingsTable)
        .values({ clerkId, deleteRequestedAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: privacySettingsTable.clerkId,
          set: { deleteRequestedAt: now, updatedAt: now },
        });
      await writeAudit(
        {
          event: "delete_requested",
          actorClerkId: clerkId,
          subjectClerkId: clerkId,
          meta: { hersteltermijnDagen: recoveryDays },
          req,
        },
        { required: true },
      );
      // GF8-06: bericht op het moment van aanvragen. Bewust GÉÉN aparte
      // herinnering halverwege de termijn (dat is een besluit, geen omissie).
      await createNotification({
        clerkId,
        type: "system",
        category: "privacy",
        title: "Je verwijderverzoek is geregistreerd",
        body: `Over ${recoveryDays} dagen worden al je gegevens definitief verwijderd. Tot die tijd kun je dit nog terugdraaien in je instellingen.`,
        source: "account",
        dedupeKey: `account_delete_requested:${clerkId}`,
      });
      res.json({
        ok: true,
        definitiefOp: new Date(
          now.getTime() + recoveryDays * 24 * 60 * 60 * 1000,
        ),
        hersteltermijnDagen: recoveryDays,
      });
    } catch (err) {
      req.log.error({ err }, "account.delete failed");
      res.status(500).json({ error: "Er ging iets mis. Probeer het opnieuw." });
    }
  },
);

// POST /api/account/delete/cancel — herstel binnen de termijn.
router.post("/delete/cancel", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    await db
      .update(privacySettingsTable)
      .set({ deleteRequestedAt: null, updatedAt: new Date() })
      .where(eq(privacySettingsTable.clerkId, clerkId));
    await writeAudit({
      event: "delete_cancelled",
      actorClerkId: clerkId,
      subjectClerkId: clerkId,
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "account.delete.cancel failed");
    res.status(500).json({ error: "Er ging iets mis. Probeer het opnieuw." });
  }
});

// POST /api/account/sessions/end — beëindig alle actieve sessies/apparaten.
router.post(
  "/sessions/end",
  requireAuth,
  rateLimit({ scope: "sessions_end", max: 5, windowMs: 10 * 60_000 }),
  async (req, res) => {
    const clerkId = getClerkUserId(req)!;
    try {
      let ended = 0;
      if (clerkId.startsWith("user_")) {
        const sessions = await clerkClient.sessions.getSessionList({
          userId: clerkId,
          status: "active",
        });
        for (const s of sessions.data) {
          try {
            await clerkClient.sessions.revokeSession(s.id);
            ended += 1;
          } catch {
            // één sessie kan al verlopen zijn — doorgaan
          }
        }
      }
      await writeAudit({
        event: "sessions_ended",
        actorClerkId: clerkId,
        subjectClerkId: clerkId,
        meta: { ended },
        req,
      });
      res.json({ ok: true, beëindigd: ended });
    } catch (err) {
      req.log.error({ err }, "account.sessions.end failed");
      res.status(500).json({ error: "Er ging iets mis. Probeer het opnieuw." });
    }
  },
);

export default router;
