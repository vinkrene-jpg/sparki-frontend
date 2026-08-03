// TRAININGSVORMEN_01 F1 — bewijstest bibliotheek (TRV-80 basis).
//
// Controleert op de ECHTE database (na seed):
// 1. Startvulling aanwezig: alle 7 disciplines vertegenwoordigd, ≥45 vormen.
// 2. Integriteit: elke GEPUBLICEERDE vorm heeft geschreven uitleg (TRV-27),
//    geldige discipline, geldige belastingssoort en een parameterrij.
// 3. Onderbouwing: tot de inschaling staat ALLES op praktijkvorm met
//    toelichting "nog niet ingeschaald" (TRV-94) en zonder effectclaim.
// 4. Afspraakvormen (derny/motor/baan) dragen vereist_afspraak (TRV-11).
// 5. API-zichtbaarheid: concept-vormen van een trainer zijn voor een andere
//    sporter onzichtbaar; jeugdfilter is fail-closed bij onbekende leeftijd.

import { eq, and } from "drizzle-orm";
import {
  db,
  trainingFormsTable,
  trainingFormParametersTable,
  userProfilesTable,
  athleteProfilesTable,
  trainingFormDisciplines,
  belastingssoorten,
} from "@workspace/db";
import { seedTrainingForms } from "../lib/training-forms-seed";

const API = process.env.API_BASE ?? `http://localhost:${process.env.PORT ?? "8080"}/api`;

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${!ok && detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function ensureUser(clerkId: string, roles: string[], dob: string | null) {
  await db
    .insert(userProfilesTable)
    .values({ clerkId, email: `${clerkId}@example.com`, roles, activeRole: roles[0] })
    .onConflictDoNothing();
  await db
    .insert(athleteProfilesTable)
    .values({ clerkId, ...(dob ? { birthDate: dob } : {}) } as never)
    .onConflictDoNothing();
  // Zelfherstellend: een eerdere run kan de rij zonder geboortedatum hebben
  // achtergelaten (onConflictDoNothing) — zet de gewenste stand expliciet.
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: dob } as never)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
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

async function main() {
  await seedTrainingForms(); // idempotent

  const vormen = await db.select().from(trainingFormsTable).where(eq(trainingFormsTable.eigenaarType, "sparki"));
  check("startvulling ≥45 Sparki-vormen", vormen.length >= 45, `n=${vormen.length}`);
  for (const d of trainingFormDisciplines) {
    check(`discipline ${d} vertegenwoordigd`, vormen.some((v) => v.discipline === d));
  }

  const params = await db.select().from(trainingFormParametersTable);
  const paramForms = new Set(params.map((p) => p.formId));
  const soorten = new Set<string>(belastingssoorten);
  const disc = new Set<string>(trainingFormDisciplines);
  let integriteitOk = true;
  for (const v of vormen) {
    if (v.status !== "gepubliceerd") continue;
    if (!v.uitleg?.trim() || !disc.has(v.discipline) || !soorten.has(v.belastingssoort) || !paramForms.has(v.id)) {
      integriteitOk = false;
      console.log(`  integriteit stuk bij: ${v.slug}`);
    }
  }
  check("elke gepubliceerde vorm: uitleg + geldige assen + parameters", integriteitOk);

  const nietIngeschaald = vormen.every(
    (v) => v.onderbouwingsniveau === "praktijkvorm" && v.onderbouwingstoelichting === "nog niet ingeschaald" && !v.effect,
  );
  check("TRV-94: alles praktijkvorm/'nog niet ingeschaald', geen effectclaims", nietIngeschaald);

  for (const slug of ["derny", "motortraining", "staande-start", "vliegende-200"]) {
    const v = vormen.find((x) => x.slug === slug);
    check(`afspraakvorm ${slug} vereist afspraak`, Boolean(v?.vereistAfspraak));
  }

  // API-checks
  const trainer = "trv-f1-trainer";
  const sporter = "trv-f1-sporter"; // volwassen
  const sporterOnbekend = "trv-f1-sporter-onbekend"; // geen geboortedatum
  await ensureUser(trainer, ["coach"], "1985-05-05");
  await ensureUser(sporter, ["athlete"], "1990-01-15");
  await ensureUser(sporterOnbekend, ["athlete"], null);

  // Trainer maakt privé conceptvorm
  const created = await api("/training-forms", trainer, {
    method: "POST",
    body: JSON.stringify({
      naam: "Trainersblok F1-test",
      discipline: "weg",
      belastingssoort: "aeroob_hoog",
      uitleg: "Testvorm voor F1: blokken op tempo.",
    }),
  });
  check("trainer kan vorm aanmaken (concept, privé)", created.status === 201 || created.status === 409, `status=${created.status}`);

  const lijstSporter = await api("/training-forms", sporter);
  check("lijst-API bereikbaar voor sporter", lijstSporter.status === 200, `status=${lijstSporter.status}`);
  const zichtbaar = (lijstSporter.body?.vormen ?? []) as any[];
  check(
    "concept-trainersvorm onzichtbaar voor niet-gekoppelde sporter",
    !zichtbaar.some((v) => v.naam === "Trainersblok F1-test"),
  );
  check("geen concept-status zichtbaar voor sporter", zichtbaar.every((v) => v.status === "gepubliceerd" || v.eigenaarType === "sparki"));
  check("sporter (volwassen) ziet vormen met leeftijdsgrens", zichtbaar.some((v) => v.minimumLeeftijd != null));

  const lijstOnbekend = await api("/training-forms", sporterOnbekend);
  const zichtbaarOnbekend = (lijstOnbekend.body?.vormen ?? []) as any[];
  check(
    "fail-closed: onbekende leeftijd ziet GEEN vormen met leeftijdsgrens",
    lijstOnbekend.status === 200 && zichtbaarOnbekend.every((v) => v.minimumLeeftijd == null),
  );

  // Jeugdcheck bij opslaan (TRV-49): 1RM-tekst zonder 18+ wordt geweigerd.
  const geweigerd = await api("/training-forms", trainer, {
    method: "POST",
    body: JSON.stringify({
      naam: "Zware test 1RM",
      discipline: "kracht",
      belastingssoort: "kracht",
      uitleg: "Werk naar je 1RM toe.",
    }),
  });
  check("TRV-49: 1RM-inhoud zonder 18+ wordt geweigerd bij opslaan", geweigerd.status === 400, `status=${geweigerd.status}`);

  // Publiceren zonder uitleg faalt (TRV-27)
  const leeg = await api("/training-forms", trainer, {
    method: "POST",
    body: JSON.stringify({ naam: "Vorm zonder uitleg F1", discipline: "weg", belastingssoort: "herstel" }),
  });
  if (leeg.status === 201) {
    const pub = await api(`/training-forms/${leeg.body.id}/publiceren`, trainer, { method: "POST" });
    check("TRV-27: publiceren zonder uitleg geweigerd", pub.status === 400, `status=${pub.status}`);
  } else {
    check("TRV-27: publiceren zonder uitleg geweigerd", leeg.status === 409, `aanmaak status=${leeg.status}`);
  }

  console.log(failures === 0 ? "\nALLE CHECKS GROEN" : `\n${failures} CHECKS ROOD`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("testfout:", err);
  process.exit(1);
});
