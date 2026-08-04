// TRAININGSVORMEN_01 — F3 bewijstest (schemaplekken + bandbreedte).
//
// Bewijs (bouwpakket F3, TRV-32/33/40/41/50/62/82):
//  1. Trainer met directe link maakt een plek; een vreemde trainer krijgt 403.
//  2. Sporter mag de bandbreedte NIET wijzigen (TRV-20), trainer wél.
//  3. Plaatsen binnen de bandbreedte → status "vervuld", geen toelichting.
//  4. Plaatsen buiten de bandbreedte → status "afgeweken" mét toelichting,
//     maar de sessie WORDT geplaatst (nooit blokkeren, TRV-41/82).
//  5. Afspraakvorm (derny) is niet plaatsbaar → 422 (TRV-50/87).
//  6. Sessie weghalen → plek weer "leeg", planned_workout weg.
//  7. Ruimte-instelling (strak/normaal/vrij) is een idempotente upsert (TRV-33).
//  8. Zonder pct_ftp-berekening blijft belasting_bekend=false — nooit 0 (TRV-62).
//
// Run: node ./scripts/run-test.mjs trv-f3-plan-slots --dev-auth (server moet draaien)

import { eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  coachAthleteLinksTable,
  planSlotsTable,
  plannedSessionsTable,
  plannedWorkoutsTable,
  trainerSlotDefaultsTable,
  trainingFormsTable,
} from "@workspace/db";
import { seedTrainingForms } from "../lib/training-forms-seed";

const API = process.env.API_BASE ?? `http://localhost:${process.env.PORT ?? "8080"}/api`;

const TRAINER = "trv-f3-trainer";
const VREEMDE = "trv-f3-vreemde-trainer";
const SPORTER = "trv-f3-sporter";
const USERS = [TRAINER, VREEMDE, SPORTER];

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${!ok && detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function api(path: string, clerkId: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
      ...(init?.headers ?? {}),
    },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function cleanup() {
  const slots = await db
    .select({ id: planSlotsTable.id })
    .from(planSlotsTable)
    .where(inArray(planSlotsTable.clerkId, USERS));
  if (slots.length) {
    await db.delete(plannedSessionsTable).where(
      inArray(plannedSessionsTable.slotId, slots.map((s) => s.id)),
    );
  }
  await db.delete(planSlotsTable).where(inArray(planSlotsTable.clerkId, USERS));
  await db.delete(plannedWorkoutsTable).where(inArray(plannedWorkoutsTable.clerkId, USERS));
  await db
    .delete(trainerSlotDefaultsTable)
    .where(inArray(trainerSlotDefaultsTable.sporterClerkId, USERS));
  await db
    .delete(coachAthleteLinksTable)
    .where(inArray(coachAthleteLinksTable.athleteClerkId, USERS));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, USERS));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, USERS));
}

async function main() {
  await cleanup();
  await seedTrainingForms(); // idempotent — bibliotheek nodig om te plaatsen

  for (const [clerkId, roles] of [
    [TRAINER, ["coach"]],
    [VREEMDE, ["coach"]],
    [SPORTER, ["athlete"]],
  ] as const) {
    await db.insert(userProfilesTable).values({
      clerkId,
      email: `${clerkId}@sparki.test`,
      roles: roles as unknown as string[],
      activeRole: roles[0],
    });
  }
  await db.insert(athleteProfilesTable).values({ clerkId: SPORTER, birthDate: "1990-01-15" } as never);
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: TRAINER,
    athleteClerkId: SPORTER,
    status: "accepted",
  });

  // Vormen om mee te testen: duurrit (weg/aeroob_duur) en derny (afspraak).
  const [duurvorm] = await db
    .select()
    .from(trainingFormsTable)
    .where(eq(trainingFormsTable.slug, "duurrit-laag"))
    .limit(1);
  const [derny] = await db
    .select()
    .from(trainingFormsTable)
    .where(eq(trainingFormsTable.slug, "derny"))
    .limit(1);
  check("testvormen aanwezig (duurrit-laag, derny)", Boolean(duurvorm && derny));
  if (!duurvorm || !derny) throw new Error("startvulling ontbreekt");

  // 1. Plek aanmaken: trainer ok, vreemde 403.
  const slotBody = {
    datum: "2026-08-10",
    bedoeling: "aerobe basis onderhouden",
    belastingssoort: "aeroob_duur",
    duurMin: 90,
    duurMax: 150,
    vervangcategorie: duurvorm.categorie,
  };
  const created = await api(`/plan/${SPORTER}/slots`, TRAINER, {
    method: "POST",
    body: JSON.stringify(slotBody),
  });
  check("trainer maakt plek (201)", created.status === 201, `status=${created.status}`);
  const vreemde = await api(`/plan/${SPORTER}/slots`, VREEMDE, {
    method: "POST",
    body: JSON.stringify(slotBody),
  });
  check("vreemde trainer 403", vreemde.status === 403, `status=${vreemde.status}`);
  const slotId = created.body?.slot?.id as number;

  // 2. Bandbreedte: sporter 403, trainer 200.
  const sporterPatch = await api(`/plan/slots/${slotId}`, SPORTER, {
    method: "PATCH",
    body: JSON.stringify({ duurMax: 300 }),
  });
  check("sporter mag bandbreedte niet wijzigen (403, TRV-20)", sporterPatch.status === 403);
  const trainerPatch = await api(`/plan/slots/${slotId}`, TRAINER, {
    method: "PATCH",
    body: JSON.stringify({ duurMax: 160 }),
  });
  check("trainer wijzigt bandbreedte (200)", trainerPatch.status === 200);

  // 3. Binnen bandbreedte plaatsen → vervuld (TRV-40/82).
  const binnen = await api(`/plan/slots/${slotId}/sessie`, SPORTER, {
    method: "POST",
    body: JSON.stringify({ formId: duurvorm.id, duurMinuten: 120 }),
  });
  check("plaatsen binnen band (201)", binnen.status === 201, JSON.stringify(binnen.body));
  check("status vervuld zonder toelichting", binnen.body?.slot?.status === "vervuld" && binnen.body?.slot?.afwijkingstoelichting == null);

  // 6a. Weghalen → leeg + workout weg.
  const workoutId = binnen.body?.sessie?.plannedWorkoutId as number;
  const weg = await api(`/plan/slots/${slotId}/sessie`, SPORTER, { method: "DELETE" });
  check("sessie weghalen (200)", weg.status === 200);
  const [slotNa] = await db.select().from(planSlotsTable).where(eq(planSlotsTable.id, slotId));
  check("plek weer leeg", slotNa?.status === "leeg" && slotNa?.afwijkingstoelichting == null);
  const wo = await db
    .select({ id: plannedWorkoutsTable.id })
    .from(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.id, workoutId));
  check("gekoppelde training verwijderd", wo.length === 0);

  // 4. Buiten bandbreedte → afgeweken mét toelichting, niet geblokkeerd (TRV-41/82).
  const buiten = await api(`/plan/slots/${slotId}/sessie`, SPORTER, {
    method: "POST",
    body: JSON.stringify({ formId: duurvorm.id, duurMinuten: 175 }),
  });
  check("plaatsen buiten band wordt NIET geblokkeerd (201)", buiten.status === 201, JSON.stringify(buiten.body));
  check(
    "status afgeweken mét toelichting",
    buiten.body?.slot?.status === "afgeweken" &&
      typeof buiten.body?.slot?.afwijkingstoelichting === "string" &&
      buiten.body.slot.afwijkingstoelichting.includes("boven de plek-bandbreedte"),
  );

  // 8. Belasting: duurvorm heeft geen pct_ftp-maat? Controleer eerlijkheid.
  const sessie = buiten.body?.sessie;
  if (sessie?.belastingBekend === false) {
    check("belasting onbekend blijft onbekend (TRV-62)", sessie.geschatteBelasting == null);
  } else {
    check("belasting bekend ⇒ er is écht een getal", typeof sessie?.geschatteBelasting === "number" && sessie.geschatteBelasting > 0);
  }

  // 5. Afspraakvorm niet plaatsbaar (TRV-50/87).
  const slot2 = await api(`/plan/${SPORTER}/slots`, TRAINER, {
    method: "POST",
    body: JSON.stringify({ datum: "2026-08-11", bedoeling: "baanwerk" }),
  });
  const dernyPoging = await api(`/plan/slots/${slot2.body?.slot?.id}/sessie`, SPORTER, {
    method: "POST",
    body: JSON.stringify({ formId: derny.id, duurMinuten: 60 }),
  });
  check("afspraakvorm plaatsen geweigerd (422)", dernyPoging.status === 422, `status=${dernyPoging.status}`);

  // 7. Ruimte-instelling idempotent (TRV-33).
  const r1 = await api(`/plan/${SPORTER}/ruimte`, TRAINER, {
    method: "PUT",
    body: JSON.stringify({ ruimte: "strak" }),
  });
  const r2 = await api(`/plan/${SPORTER}/ruimte`, TRAINER, {
    method: "PUT",
    body: JSON.stringify({ ruimte: "vrij" }),
  });
  const defaults = await db
    .select()
    .from(trainerSlotDefaultsTable)
    .where(eq(trainerSlotDefaultsTable.sporterClerkId, SPORTER));
  check(
    "ruimte upsert: één rij, laatste waarde wint",
    r1.status === 200 && r2.status === 200 && defaults.length === 1 && defaults[0]!.ruimte === "vrij",
  );
  const rSporter = await api(`/plan/${SPORTER}/ruimte`, SPORTER, {
    method: "PUT",
    body: JSON.stringify({ ruimte: "vrij" }),
  });
  check("sporter mag ruimte niet instellen (403)", rSporter.status === 403);

  await cleanup();
  console.log(`\n${failures === 0 ? "ALLE CHECKS GESLAAGD" : `${failures} check(s) GEFAALD`}`);
  await pool.end();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("trv-f3-plan-slots: onverwachte fout", err);
  try {
    await cleanup();
    await pool.end();
  } catch {}
  process.exit(1);
});
