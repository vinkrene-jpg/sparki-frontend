// F12 — Centrale inbox en notificaties.
//
// Vergrendelt de vier F12-gaten:
//  - NOT-01 BUNDELING: meerdere wijzigingen aan HETZELFDE object binnen het
//    venster ⇒ één gebundelde melding vanaf de drempel; onder de drempel los.
//    Kritieke categorieën (privacy/veiligheid) worden NOOIT gebundeld.
//  - gelezen ≠ afgehandeld: readAt en resolvedAt zijn los zetbaar/filterbaar.
//  - NOT-03 PUSHTEKST: de opgebouwde push/e-mail-payload bevat GEEN
//    trainingstitel of wedstrijdnaam (assert op de daadwerkelijke payload).
//  - NOT-05 AUDIENCE: een melding met audience=coach is na rolverlies
//    onzichtbaar in de lijst én niet-PATCHbaar (404), ook via directe aanroep.
//
// Run: node ./scripts/run-test.mjs f12-inbox --dev-auth

import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  notificationsTable,
  userProfilesTable,
  plannedWorkoutsTable,
  racesTable,
} from "@workspace/db";
import {
  createNotification,
  resolveNotifications,
  visibleAudiences,
  BUNDLE_THRESHOLD,
  BUNDLE_WINDOW_HOURS,
} from "../lib/notifications";
import { buildDueReminders } from "../engines/reminders/build";
import {
  brokenLinkCopy,
  neutralLinkPushPayload,
} from "../engines/data-hub/connection-health";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

const TEST_ID = "test_f12_inbox_user";
const COACH_ROLE_ID = "test_f12_inbox_coach";
const API = "http://localhost:8080/api/notifications";

async function cleanup() {
  for (const id of [TEST_ID, COACH_ROLE_ID]) {
    await db.delete(notificationsTable).where(eq(notificationsTable.clerkId, id));
    await db.delete(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.clerkId, id));
    await db.delete(racesTable).where(eq(racesTable.clerkId, id));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, id));
  }
}

async function openRows(clerkId: string, bundleKey: string) {
  return db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, clerkId),
        eq(notificationsTable.bundleKey, bundleKey),
        isNull(notificationsTable.resolvedAt),
      ),
    );
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: TEST_ID,
    email: "f12-inbox-test@example.com",
    displayName: "F12 Inbox Test",
  });

  // ── NOT-01 BUNDELING ───────────────────────────────────────────────────────
  await scenario(
    `bundeling: ${BUNDLE_THRESHOLD} of meer wijzigingen zelfde object ⇒ 1 bundel`,
    async () => {
      const bundleKey = "wedstrijd:coach:/races/f12-plan-1";
      for (let i = 0; i < 10; i++) {
        await createNotification({
          clerkId: TEST_ID,
          type: "coach_update",
          category: "wedstrijd",
          title: `Wijziging ${i} in het plan`,
          body: `Detail ${i}`,
          source: "coach",
          actionUrl: `/races/f12-plan-1?rev=${i}`,
          bundleKey,
          bundleLabel: "je wedstrijdplan",
        });
      }
      const open = await openRows(TEST_ID, bundleKey);
      assert(open.length === 1, `verwacht 1 open rij, kreeg ${open.length}`);
      const bundle = open[0]!;
      assert(bundle.bundleCount === 10, `bundleCount ${bundle.bundleCount}, verwacht 10`);
      assert(
        bundle.body === "10 wijzigingen in je wedstrijdplan",
        `bundel-body onjuist: ${bundle.body}`,
      );
      // Laatste actionUrl bewaard.
      assert(
        bundle.actionUrl === "/races/f12-plan-1?rev=9",
        `laatste actionUrl niet bewaard: ${bundle.actionUrl}`,
      );
    },
  );

  await scenario("bundeling: groei reset readAt (bundel wordt weer ongelezen)", async () => {
    const bundleKey = "wedstrijd:coach:/races/f12-plan-2";
    for (let i = 0; i < BUNDLE_THRESHOLD; i++) {
      await createNotification({
        clerkId: TEST_ID,
        type: "coach_update",
        category: "wedstrijd",
        title: `W${i}`,
        source: "coach",
        actionUrl: `/races/f12-plan-2?rev=${i}`,
        bundleKey,
        bundleLabel: "je wedstrijdplan",
      });
    }
    const [bundle] = await openRows(TEST_ID, bundleKey);
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(eq(notificationsTable.id, bundle!.id));
    // Nog een wijziging: bundel groeit en springt terug op ongelezen.
    await createNotification({
      clerkId: TEST_ID,
      type: "coach_update",
      category: "wedstrijd",
      title: "W-extra",
      source: "coach",
      actionUrl: "/races/f12-plan-2?rev=x",
      bundleKey,
      bundleLabel: "je wedstrijdplan",
    });
    const [grown] = await openRows(TEST_ID, bundleKey);
    assert(grown!.readAt == null, "readAt niet gereset bij groei");
    assert(grown!.bundleCount === BUNDLE_THRESHOLD + 1, "count niet gegroeid");
  });

  await scenario("onder de drempel ⇒ losse meldingen (geen bundel)", async () => {
    const bundleKey = "wedstrijd:coach:/races/f12-plan-3";
    for (let i = 0; i < BUNDLE_THRESHOLD - 1; i++) {
      await createNotification({
        clerkId: TEST_ID,
        type: "coach_update",
        category: "wedstrijd",
        title: `Los ${i}`,
        source: "coach",
        actionUrl: `/races/f12-plan-3?rev=${i}`,
        bundleKey,
        bundleLabel: "je wedstrijdplan",
      });
    }
    const open = await openRows(TEST_ID, bundleKey);
    assert(
      open.length === BUNDLE_THRESHOLD - 1,
      `verwacht ${BUNDLE_THRESHOLD - 1} losse rijen, kreeg ${open.length}`,
    );
    assert(open.every((r) => r.bundleCount === 1), "een rij is toch gebundeld");
  });

  await scenario("kritieke categorieën worden NOOIT gebundeld", async () => {
    // Zelfde object, categorie veiligheid: elke melding blijft een losse rij.
    for (let i = 0; i < 5; i++) {
      await createNotification({
        clerkId: TEST_ID,
        type: "security_alert",
        category: "veiligheid",
        title: `Veiligheidssignaal ${i}`,
        source: "val-alarm",
        actionUrl: "/veiligheid/f12-obj",
        // Zelfs een expliciete bundleKey mag kritiek niet bundelen.
        bundleKey: "veiligheid:val-alarm:/veiligheid/f12-obj",
      });
    }
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, TEST_ID),
          eq(notificationsTable.category, "veiligheid"),
        ),
      );
    assert(rows.length === 5, `kritiek gebundeld: verwacht 5 rijen, kreeg ${rows.length}`);
    assert(rows.every((r) => r.bundleKey == null), "kritieke rij kreeg een bundleKey");
  });

  // ── NOT-01 concurrency (reviewfix) ─────────────────────────────────────────
  await scenario(
    "concurrency: 10 parallelle producenten ⇒ exact 1 bundel, count=10, geen verloren events",
    async () => {
      const bundleKey = "wedstrijd:coach:/races/f12-parallel-1";
      // Alle 10 tegelijk: de advisory-lock + atomaire increment moeten dit
      // serialiseren tot exact één bundel met de volle telling.
      const outcomes = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          createNotification({
            clerkId: TEST_ID,
            type: "coach_update",
            category: "wedstrijd",
            title: `Parallel ${i}`,
            source: "coach",
            actionUrl: `/races/f12-parallel-1?rev=${i}`,
            bundleKey,
            bundleLabel: "je wedstrijdplan",
          }),
        ),
      );
      const open = await openRows(TEST_ID, bundleKey);
      assert(open.length === 1, `verwacht 1 open rij, kreeg ${open.length}`);
      assert(
        open[0]!.bundleCount === 10,
        `bundleCount ${open[0]!.bundleCount}, verwacht 10 (verloren increment?)`,
      );
      assert(
        open[0]!.body === "10 wijzigingen in je wedstrijdplan",
        `bundel-body telt niet mee: ${open[0]!.body}`,
      );
      // "created=true" markeert een rij die op DAT moment nieuw zichtbaar was:
      // onder parallellisme kunnen dat de eerste losse inserts (< drempel) zijn
      // plus de fold. Wat NOOIT mag: dat groei-op-een-bestaande-bundel als
      // nieuw telt (dubbele push). We eisen dus: minstens één nieuw event, en —
      // belangrijker — geen tweede open bundel/rij (zie hieronder). Nul nieuwe
      // events zou betekenen dat er niets ontstond, dat mag ook niet.
      const createdCount = outcomes.filter(Boolean).length;
      assert(createdCount >= 1, `verwacht ≥1 'nieuw event', kreeg ${createdCount}`);
      assert(
        createdCount < 10,
        `elke parallelle groei telde als nieuw (${createdCount}) — dubbele push-risico`,
      );
      // Er mag ook geen tweede (per abuis losse) rij zijn ontstaan.
      const all = await db
        .select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.clerkId, TEST_ID),
            eq(notificationsTable.bundleKey, bundleKey),
          ),
        );
      const openAll = all.filter((r) => r.resolvedAt == null);
      assert(openAll.length === 1, `verwacht 1 open, kreeg ${openAll.length}`);
    },
  );

  await scenario(
    "concurrency rond de drempel: parallelle events verliezen niets",
    async () => {
      // Twee golven parallel rond de drempel; totale count moet exact het aantal
      // events zijn dat ONDER dezelfde sleutel binnenkwam.
      const bundleKey = "wedstrijd:coach:/races/f12-parallel-2";
      const total = BUNDLE_THRESHOLD + 4;
      await Promise.all(
        Array.from({ length: total }, (_, i) =>
          createNotification({
            clerkId: TEST_ID,
            type: "coach_update",
            category: "wedstrijd",
            title: `Rond drempel ${i}`,
            source: "coach",
            actionUrl: `/races/f12-parallel-2?rev=${i}`,
            bundleKey,
            bundleLabel: "je wedstrijdplan",
          }),
        ),
      );
      const open = await openRows(TEST_ID, bundleKey);
      assert(open.length === 1, `verwacht 1 open rij, kreeg ${open.length}`);
      assert(
        open[0]!.bundleCount === total,
        `count ${open[0]!.bundleCount}, verwacht ${total} (verloren event?)`,
      );
    },
  );

  await scenario(
    "beleid: al-GELEZEN losse rijen worden NIET met terugwerkende kracht gevouwen",
    async () => {
      const bundleKey = "wedstrijd:coach:/races/f12-readfold";
      // Twee losse rijen aanmaken (onder de drempel) en beide als GELEZEN
      // markeren.
      for (let i = 0; i < BUNDLE_THRESHOLD - 1; i++) {
        await createNotification({
          clerkId: TEST_ID,
          type: "coach_update",
          category: "wedstrijd",
          title: `Gelezen los ${i}`,
          source: "coach",
          actionUrl: `/races/f12-readfold?rev=${i}`,
          bundleKey,
          bundleLabel: "je wedstrijdplan",
        });
      }
      await db
        .update(notificationsTable)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notificationsTable.clerkId, TEST_ID),
            eq(notificationsTable.bundleKey, bundleKey),
          ),
        );
      // Nog één nieuwe wijziging: gelezen rijen tellen NIET mee, dus geen fold —
      // dit blijft een nieuwe losse rij.
      await createNotification({
        clerkId: TEST_ID,
        type: "coach_update",
        category: "wedstrijd",
        title: "Nieuwe los na gelezen",
        source: "coach",
        actionUrl: `/races/f12-readfold?rev=new`,
        bundleKey,
        bundleLabel: "je wedstrijdplan",
      });
      const open = await openRows(TEST_ID, bundleKey);
      // Alle rijen zijn nog los (bundleCount=1); geen enkele is een bundel.
      assert(
        open.every((r) => r.bundleCount === 1),
        "al-gelezen rijen werden tóch in een bundel gevouwen",
      );
      // En de gelezen rijen zijn niet opgeslokt (resolved).
      const resolved = await db
        .select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.clerkId, TEST_ID),
            eq(notificationsTable.bundleKey, bundleKey),
          ),
        );
      assert(
        resolved.every((r) => r.resolvedAt == null),
        "een al-gelezen rij is per abuis opgeslokt",
      );
    },
  );

  // ── gelezen ≠ afgehandeld ────────────────────────────────────────────────
  await scenario("gelezen ≠ afgehandeld: readAt en resolvedAt los zetbaar", async () => {
    const key = "sync:f12-conn";
    await createNotification({
      clerkId: TEST_ID,
      type: "sync_error",
      title: "Sync hapert",
      resolutionKey: key,
    });
    const [row] = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, TEST_ID),
          eq(notificationsTable.resolutionKey, key),
        ),
      );
    // Alleen gelezen zetten: resolvedAt blijft NULL (nog niet afgehandeld).
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(eq(notificationsTable.id, row!.id));
    const [afterRead] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, row!.id));
    assert(afterRead!.readAt != null, "readAt niet gezet");
    assert(afterRead!.resolvedAt == null, "gelezen zette óók afgehandeld — mag niet");
    // Nu afhandelen via resolutionKey: readAt blijft gezet.
    await resolveNotifications(TEST_ID, key);
    const [afterResolve] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, row!.id));
    assert(afterResolve!.resolvedAt != null, "resolvedAt niet gezet");
    assert(afterResolve!.readAt != null, "afhandelen wiste gelezen — mag niet");
  });

  // ── NOT-03 PUSHTEKST ─────────────────────────────────────────────────────
  await scenario("pushpayload bevat GEEN trainingstitel", async () => {
    const secret = "Geheime Intervaltraining 5x3";
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await db.insert(plannedWorkoutsTable).values({
      clerkId: TEST_ID,
      title: secret,
      description: "Vertrouwelijke omschrijving met details",
      scheduledDate: tomorrow,
      status: "planned",
    });
    const items = await buildDueReminders(TEST_ID, new Date());
    const training = items.find((it) => it.type === "training_reminder");
    assert(training != null, "geen trainings-reminder gebouwd");
    // In-app MAG specifiek zijn.
    assert(training!.body.includes(secret), "in-app body zou specifiek moeten zijn");
    // Push/e-mail MOGEN dat NIET.
    assert(!training!.pushTitle.includes(secret), "pushTitle lekt trainingstitel");
    assert(!training!.pushBody.includes(secret), "pushBody lekt trainingstitel");
    assert(!training!.emailSubject.includes(secret), "emailSubject lekt trainingstitel");
    assert(!training!.emailBody.includes(secret), "emailBody lekt trainingstitel");
    assert(
      training!.pushBody.length > 0 && !training!.pushBody.includes("Vertrouwelijke"),
      "pushBody lekt omschrijving",
    );
  });

  await scenario("pushpayload bevat GEEN wedstrijdnaam/locatie", async () => {
    const raceName = "Geheime Klassieker van Nergenshuizen";
    const raceLoc = "Verborgen Dorp";
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await db.insert(racesTable).values({
      clerkId: TEST_ID,
      name: raceName,
      raceDate: soon,
      location: raceLoc,
    });
    const items = await buildDueReminders(TEST_ID, new Date());
    const race = items.find((it) => it.type === "race_reminder");
    assert(race != null, "geen wedstrijd-reminder gebouwd");
    assert(race!.body.includes(raceName), "in-app body zou naam moeten bevatten");
    for (const field of [race!.pushTitle, race!.pushBody, race!.emailSubject, race!.emailBody]) {
      assert(!field.includes(raceName), `payload lekt wedstrijdnaam: ${field}`);
      assert(!field.includes(raceLoc), `payload lekt locatie: ${field}`);
    }
  });

  await scenario(
    "connection-health pushpayload bevat GEEN providernaam/status/getallen",
    () => {
      // De specifieke in-app copy (mét providernaam) mag NOOIT de push worden.
      const specific = brokenLinkCopy("sync_stale", "Strava");
      assert(specific.title.includes("Strava"), "test-aanname: in-app copy is specifiek");
      // De push-payload gebruikt uitsluitend de neutrale velden.
      const push = neutralLinkPushPayload({
        pushTitle: "Er is iets met een koppeling",
        pushBody: "Je synchronisatie heeft aandacht nodig — open de app.",
      });
      const forbidden = ["Strava", "Garmin", "Wahoo", "24 uur", "toestemming verlopen"];
      for (const field of [push.title, push.body]) {
        for (const bad of forbidden) {
          assert(!field.includes(bad), `pushpayload lekt "${bad}": ${field}`);
        }
      }
      // Ook de DEFAULT (zonder expliciete velden) is neutraal.
      const dflt = neutralLinkPushPayload({});
      for (const bad of forbidden) {
        assert(!dflt.title.includes(bad) && !dflt.body.includes(bad), "default lekt inhoud");
      }
    },
  );

  // ── NOT-05 AUDIENCE-AFDWINGING ───────────────────────────────────────────
  await scenario("audience: coach-melding onzichtbaar + niet-PATCHbaar na rolverlies", async () => {
    // Gebruiker MET coach-rol.
    await db.insert(userProfilesTable).values({
      clerkId: COACH_ROLE_ID,
      email: "f12-coach@example.com",
      displayName: "F12 Coach",
      roles: ["athlete", "coach"],
      activeRole: "coach",
    });
    // Melding gericht aan de coach-rol.
    await createNotification({
      clerkId: COACH_ROLE_ID,
      type: "coach_update",
      title: "Coachbericht",
      body: "Voor de coach",
      audience: "coach",
      source: "coach",
    });
    const [notif] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.clerkId, COACH_ROLE_ID));
    assert(notif != null, "coach-melding niet aangemaakt");

    // Mét coach-rol: audience bevat "coach".
    const withCoach = await visibleAudiences(COACH_ROLE_ID);
    assert(withCoach.includes("coach"), "coach niet in audiences terwijl rol aanwezig");

    // Zichtbaar in de lijst (directe aanroep, x-dev-clerk-id) én PATCHbaar.
    const listBefore = await fetch(`${API}?limit=50`, {
      headers: { "x-dev-clerk-id": COACH_ROLE_ID },
    });
    const beforeJson = (await listBefore.json()) as {
      groups: Array<{ kind: string; notification?: { id: number } }>;
    };
    const foundBefore = JSON.stringify(beforeJson).includes("Coachbericht");
    assert(foundBefore, "coach-melding niet zichtbaar terwijl rol aanwezig");

    // ── Rolverlies: coach-rol ingetrokken ──
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete"], activeRole: "athlete" })
      .where(eq(userProfilesTable.clerkId, COACH_ROLE_ID));

    const afterLoss = await visibleAudiences(COACH_ROLE_ID);
    assert(!afterLoss.includes("coach"), "coach nog in audiences na rolverlies");

    // Onzichtbaar in de lijst.
    const listAfter = await fetch(`${API}?limit=50`, {
      headers: { "x-dev-clerk-id": COACH_ROLE_ID },
    });
    const afterJson = await listAfter.json();
    assert(
      !JSON.stringify(afterJson).includes("Coachbericht"),
      "coach-melding nog zichtbaar na rolverlies",
    );

    // Niet-PATCHbaar via directe aanroep ⇒ 404 (geen 403-lek).
    const patch = await fetch(`${API}/${notif!.id}/read`, {
      method: "PATCH",
      headers: { "x-dev-clerk-id": COACH_ROLE_ID },
    });
    assert(patch.status === 404, `PATCH na rolverlies gaf ${patch.status}, verwacht 404`);

    // De rij is NIET gemarkeerd als gelezen (fail-closed werkte).
    const [still] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notif!.id));
    assert(still!.readAt == null, "melding voor ingetrokken rol tóch gelezen gemarkeerd");
  });

  await scenario("audience-loos = altijd zichtbaar voor eigenaar", async () => {
    await createNotification({
      clerkId: COACH_ROLE_ID,
      type: "system",
      title: "Systeemmelding zonder audience",
      // geen audience meegegeven
    });
    const list = await fetch(`${API}?limit=50`, {
      headers: { "x-dev-clerk-id": COACH_ROLE_ID },
    });
    const json = await list.json();
    assert(
      JSON.stringify(json).includes("Systeemmelding zonder audience"),
      "audience-loze melding niet zichtbaar voor eigenaar",
    );
  });

  await scenario("config: drempel en venster leesbaar/onderbouwd", () => {
    assert(BUNDLE_THRESHOLD >= 2, "drempel te laag om zinvol te bundelen");
    assert(BUNDLE_WINDOW_HOURS >= 1, "venster te klein");
  });

  await cleanup();

  // ── Rapport ────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed += 1;
  }
  console.log(
    `\n${results.length - failed}/${results.length} scenario's geslaagd ` +
      `(drempel=${BUNDLE_THRESHOLD}, venster=${BUNDLE_WINDOW_HOURS}u)`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("f12-inbox test crashte:", err);
  process.exit(1);
});
