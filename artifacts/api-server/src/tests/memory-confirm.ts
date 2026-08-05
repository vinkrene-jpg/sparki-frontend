// Test voor het bevestigd-geheugen (AI_COACH §4.1/§4.4, acceptatie A1–A9).
//
// Bewaakt dat een weerlegde herinnering nooit meer een advies draagt:
//  1. Bevestigingsstroom: vraag ophalen → klopt_niet → status "weerlegd" +
//     correctierij; tweede vraag dezelfde dag = exact dezelfde vraag;
//     antwoord op een niet-voorgelegde rij → null (route geeft 404).
//  2. Weerlegd blijft weg: niet meer in actieve/context-observaties, en een
//     her-persist van dezelfde conclusie levert geen nieuwe actieve drager.
//  3. Opschoontaak §4.4: >365d nooit-bevestigd → "voorlopig"; "voorlopig" met
//     her-voorlegging ≥14d geleden getoond → "outdated"; "bevestigd" blijft.
//
// Let op: privacy ai_memory_enabled=false slikt de correctie-persist stil in —
// deze test zet de privacyinstelling daarom expliciet AAN.
//
// Run: `pnpm --filter @workspace/api-server run test:memory-confirm`

import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  aiObservationsTable,
  aiMemoryEventsTable,
  privacySettingsTable,
} from "@workspace/db";
import { getConfirmQuestion, answerConfirmQuestion } from "../lib/memory-confirm";
import {
  persistObservation,
  getActiveObservations,
  getContextObservations,
} from "../lib/ai-memory";
import { runObservationCleanup } from "../jobs/observation-cleanup";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const CONFIRM_CLERK = "user_test_memory_confirm_596";
const CLEANUP_CLERK = "user_test_memory_forget_596";
const ALL_CLERKS = [CONFIRM_CLERK, CLEANUP_CLERK];

async function cleanup() {
  for (const clerkId of ALL_CLERKS) {
    await db.delete(aiMemoryEventsTable).where(eq(aiMemoryEventsTable.clerkId, clerkId));
    await db.delete(aiObservationsTable).where(eq(aiObservationsTable.clerkId, clerkId));
    await db.delete(privacySettingsTable).where(eq(privacySettingsTable.clerkId, clerkId));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, clerkId));
  }
}

async function seedUser(clerkId: string, email: string) {
  await db.insert(userProfilesTable).values({
    clerkId,
    email,
  } as typeof userProfilesTable.$inferInsert);
  // Privacy AAN — anders slikt persistObservation de correctierij stil in.
  await db.insert(privacySettingsTable).values({
    clerkId,
    aiMemoryEnabled: true,
  } as typeof privacySettingsTable.$inferInsert);
}

// ── Deel 1: bevestigingsstroom (A1–A5) ───────────────────────────────────────
async function confirmFlowTests() {
  await seedUser(CONFIRM_CLERK, "memory-confirm-test@example.com");

  // Twee kandidaten: de oudste patroon-conclusie moet de vraag worden.
  const oudste = await persistObservation({
    clerkId: CONFIRM_CLERK,
    sourceType: "training_analysis",
    title: "Zwaardere trainingen op vrijdag",
    observationText: "Op vrijdagen liggen je trainingen structureel zwaarder dan gepland.",
    detectedPattern: "Vrijdagtrainingen vallen structureel zwaarder uit dan gepland",
  });
  const nieuwer = await persistObservation({
    clerkId: CONFIRM_CLERK,
    sourceType: "training_analysis",
    title: "Korte nachten voor wedstrijden",
    observationText: "In de nacht voor een wedstrijd slaap je gemiddeld anderhalf uur korter.",
    detectedPattern: "Nacht voor een wedstrijd is de slaap structureel korter",
  });
  check("beide kandidaat-observaties opgeslagen", oudste != null && nieuwer != null);
  if (!oudste || !nieuwer) return;
  // Maak de eerste expliciet ouder zodat de kandidaat-keuze deterministisch is.
  await db
    .update(aiObservationsTable)
    .set({ createdAt: new Date(Date.now() - 2 * 86_400_000) })
    .where(eq(aiObservationsTable.id, oudste.id));

  // A1 — vraag ophalen: oudste onbevestigde patroon-conclusie.
  const vraag1 = await getConfirmQuestion(CONFIRM_CLERK);
  check(
    "vraag ophalen levert de oudste patroon-conclusie, onbeantwoord",
    vraag1 != null && vraag1.observationId === oudste.id && vraag1.beantwoord === false,
    JSON.stringify(vraag1),
  );

  // A2 — tweede vraag dezelfde dag = exact dezelfde vraag (geen tweede conclusie).
  const vraag2 = await getConfirmQuestion(CONFIRM_CLERK);
  check(
    "tweede vraag dezelfde dag = zelfde observatie, nooit de nieuwere",
    vraag2 != null && vraag2.observationId === oudste.id,
    JSON.stringify(vraag2),
  );

  // A3 — antwoord op een niet-voorgelegde rij → null (route: 404).
  const nietVoorgelegd = await answerConfirmQuestion(CONFIRM_CLERK, nieuwer.id, "klopt_niet");
  check("antwoord op niet-voorgelegde rij wordt geweigerd (null → 404)", nietVoorgelegd === null);
  const [nieuwerNa] = await db
    .select()
    .from(aiObservationsTable)
    .where(eq(aiObservationsTable.id, nieuwer.id));
  check("de niet-voorgelegde rij is onaangeroerd", nieuwerNa?.status === "new", nieuwerNa?.status);

  // Ook een rij van een ándere sporter mag nooit beantwoord worden.
  const vreemd = await answerConfirmQuestion("user_iemand_anders_596", oudste.id, "klopt");
  check("antwoord namens andere sporter wordt geweigerd", vreemd === null);

  // A4 — klopt_niet → status "weerlegd" + correctierij + event.
  const antwoord = await answerConfirmQuestion(CONFIRM_CLERK, oudste.id, "klopt_niet");
  check("klopt_niet levert status weerlegd", antwoord?.status === "weerlegd", JSON.stringify(antwoord));
  const [weerlegd] = await db
    .select()
    .from(aiObservationsTable)
    .where(eq(aiObservationsTable.id, oudste.id));
  check("rij staat op weerlegd in de DB", weerlegd?.status === "weerlegd", weerlegd?.status);

  const correcties = await db
    .select()
    .from(aiObservationsTable)
    .where(
      and(
        eq(aiObservationsTable.clerkId, CONFIRM_CLERK),
        eq(aiObservationsTable.dedupeKey, `correctie:${weerlegd?.dedupeKey ?? oudste.id}`),
      ),
    );
  check(
    "correctierij is aangemaakt (privacy aan) en verwijst naar de weerlegde conclusie",
    correcties.length === 1 && correcties[0]!.observationText.includes("weerlegd"),
    JSON.stringify(correcties.map((c) => c.title)),
  );
  const events = await db
    .select()
    .from(aiMemoryEventsTable)
    .where(eq(aiMemoryEventsTable.clerkId, CONFIRM_CLERK));
  check(
    "observation_refuted-event vastgelegd",
    events.some((e) => e.eventType === "observation_refuted" && e.relatedObservationId === oudste.id),
  );

  // A5 — na het antwoord blijft het dezelfde vraag, nu beantwoord.
  const vraag3 = await getConfirmQuestion(CONFIRM_CLERK);
  check(
    "na antwoord: zelfde vraag terug met beantwoord=true (geen nieuwe conclusie vandaag)",
    vraag3 != null && vraag3.observationId === oudste.id && vraag3.beantwoord === true,
    JSON.stringify(vraag3),
  );

  // Weerlegd draagt nooit meer advies: niet in actieve, niet in context-observaties.
  const actief = await getActiveObservations(CONFIRM_CLERK);
  const context = await getContextObservations(CONFIRM_CLERK);
  check(
    "weerlegde rij zit niet meer in actieve observaties",
    !actief.some((o) => o.id === oudste.id),
  );
  check(
    "weerlegde rij zit niet meer in context-observaties (advies-invoer)",
    !context.some((o) => o.id === oudste.id),
  );

  // Afkoelmechanisme: dezelfde conclusie opnieuw persist-en mag geen nieuwe
  // actieve drager opleveren (correctie/dedupe vangt hem af).
  const opnieuw = await persistObservation({
    clerkId: CONFIRM_CLERK,
    sourceType: "training_analysis",
    title: "Zwaardere trainingen op vrijdag",
    observationText: "Op vrijdagen liggen je trainingen structureel zwaarder dan gepland.",
    detectedPattern: "Vrijdagtrainingen vallen structureel zwaarder uit dan gepland",
    dedupeKey: weerlegd?.dedupeKey ?? undefined,
  });
  const dragers = await db
    .select()
    .from(aiObservationsTable)
    .where(
      and(
        eq(aiObservationsTable.clerkId, CONFIRM_CLERK),
        eq(aiObservationsTable.dedupeKey, weerlegd!.dedupeKey!),
      ),
    );
  const actieveDragers = dragers.filter((d) =>
    ["new", "acknowledged", "saved", "voorlopig", "bevestigd"].includes(d.status),
  );
  check(
    "weerlegde conclusie komt niet terug als nieuwe actieve rij",
    actieveDragers.length === 0,
    JSON.stringify({ opnieuw: opnieuw?.id ?? null, statussen: dragers.map((d) => d.status) }),
  );
}

// ── Deel 2: opschoontaak §4.4 (A6–A9) ────────────────────────────────────────
async function forgetRulesTests() {
  await seedUser(CLEANUP_CLERK, "memory-forget-test@example.com");
  const oud = new Date(Date.now() - 400 * 86_400_000); // > 365 dagen

  // A6 — >365d nooit bevestigd → voorlopig.
  const [nooitBevestigd] = await db
    .insert(aiObservationsTable)
    .values({
      clerkId: CLEANUP_CLERK,
      sourceType: "training_analysis",
      title: "Oude nooit-bevestigde conclusie",
      observationText: "Je cadans zakt in het derde uur van lange ritten merkbaar terug.",
      detectedPattern: "Cadans zakt in het derde uur terug",
      status: "new",
      createdAt: oud,
    } as typeof aiObservationsTable.$inferInsert)
    .returning();

  // A7 — voorlopig + her-voorlegging ≥14d geleden getoond → outdated.
  const [voorlopigOud] = await db
    .insert(aiObservationsTable)
    .values({
      clerkId: CLEANUP_CLERK,
      sourceType: "training_analysis",
      title: "Oude voorlopige conclusie",
      observationText: "Bij tegenwind kies je vrijwel altijd een lager tempo dan het schema vraagt.",
      detectedPattern: "Tegenwind leidt tot lager tempo dan gepland",
      status: "voorlopig",
      createdAt: oud,
    } as typeof aiObservationsTable.$inferInsert)
    .returning();
  await db.insert(aiMemoryEventsTable).values({
    clerkId: CLEANUP_CLERK,
    eventType: "confirm_question_shown",
    relatedObservationId: voorlopigOud!.id,
    metadata: { status: "voorlopig" },
    createdAt: new Date(Date.now() - 20 * 86_400_000), // ≥ 14 dagen geleden getoond
  } as typeof aiMemoryEventsTable.$inferInsert);

  // A8 — bevestigd blijft staan, hoe oud ook.
  const [bevestigdOud] = await db
    .insert(aiObservationsTable)
    .values({
      clerkId: CLEANUP_CLERK,
      sourceType: "training_analysis",
      title: "Oude bevestigde conclusie",
      observationText: "Je herstelt aantoonbaar sneller na een rustdag met wandelen.",
      detectedPattern: "Sneller herstel na actieve rustdag",
      status: "bevestigd",
      createdAt: oud,
    } as typeof aiObservationsTable.$inferInsert)
    .returning();

  // A9 — weerlegd wordt door de opschoontaak nooit geraakt (komt nooit terug).
  const [weerlegdOud] = await db
    .insert(aiObservationsTable)
    .values({
      clerkId: CLEANUP_CLERK,
      sourceType: "training_analysis",
      title: "Oude weerlegde conclusie",
      observationText: "Je zou intervallen mijden op dagen na krachttraining.",
      detectedPattern: "Intervallen worden gemeden na krachttraining",
      status: "weerlegd",
      createdAt: oud,
    } as typeof aiObservationsTable.$inferInsert)
    .returning();

  const report = await runObservationCleanup(CLEANUP_CLERK, true, "test");
  check("opschoonrun draaide zonder fouten", report.clerkId === CLEANUP_CLERK);

  const na = new Map(
    (
      await db
        .select()
        .from(aiObservationsTable)
        .where(eq(aiObservationsTable.clerkId, CLEANUP_CLERK))
    ).map((r) => [r.id, r.status]),
  );

  check(
    ">365d nooit-bevestigd zakt naar voorlopig (her-voorlegging)",
    na.get(nooitBevestigd!.id) === "voorlopig",
    na.get(nooitBevestigd!.id),
  );
  check(
    "voorlopig + her-voorlegging ≥14d getoond vervalt stil naar outdated",
    na.get(voorlopigOud!.id) === "outdated",
    na.get(voorlopigOud!.id),
  );
  check(
    "bevestigd blijft staan (wordt nooit gedemoveerd)",
    na.get(bevestigdOud!.id) === "bevestigd",
    na.get(bevestigdOud!.id),
  );
  check(
    "weerlegd blijft weerlegd — komt nooit automatisch terug",
    na.get(weerlegdOud!.id) === "weerlegd",
    na.get(weerlegdOud!.id),
  );

  // Idempotentie: een tweede run verandert deze uitkomsten niet meer.
  await runObservationCleanup(CLEANUP_CLERK, true, "test-2");
  const [voorlopigNa2] = await db
    .select()
    .from(aiObservationsTable)
    .where(eq(aiObservationsTable.id, nooitBevestigd!.id));
  check(
    "tweede run laat de her-voorleg-rij op voorlopig staan (geen oude her-voorlegging)",
    voorlopigNa2?.status === "voorlopig",
    voorlopigNa2?.status,
  );
  const [bevestigdNa2] = await db
    .select()
    .from(aiObservationsTable)
    .where(eq(aiObservationsTable.id, bevestigdOud!.id));
  check("tweede run laat bevestigd staan", bevestigdNa2?.status === "bevestigd");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("FAIL  DATABASE_URL ontbreekt — deze test is DB-gebonden.");
    process.exit(1);
  }
  await cleanup();
  try {
    await confirmFlowTests();
    await forgetRulesTests();
  } finally {
    await cleanup();
    await pool.end();
  }
  console.log(failures === 0 ? "\nALLES GESLAAGD" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("test faalde:", err);
  try {
    await cleanup();
    await pool.end();
  } catch {}
  process.exit(1);
});
