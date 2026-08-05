// ANALYSE_UITBREIDING §3/§4 — Analyse op verzoek.
//
// Harde eis: dezelfde selectie over dezelfde periode geeft hetzelfde antwoord.
// Daarom: (1) deterministische engines leveren de uitkomsten; (2) er wordt een
// digest over selectie+periode+uitkomsten berekend; (3) bij een ongewijzigde
// digest wordt de bewaarde tekst teruggegeven — het model wordt dan niet
// opnieuw aangeroepen. Het model formuleert alleen; het rekent niets.
//
// §4-beveiliging tegen schijnverbanden (bij 2–5 kaarten):
// - een verband is een waarneming ("gaat samen op met"), nooit een oorzaak;
// - alleen benoemen als beide reeksen genoeg punten in dezelfde periode
//   hebben — anders wordt dat gezegd in plaats van weggelaten.

import { createHash } from "node:crypto";
import {
  db,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  analysisRequestsTable,
} from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { computeLoadSeries } from "./recovery-load";
import { computeOntkoppelingRitten } from "./ontkoppeling";
import { aiMessage } from "./ai/gateway";
import { createAdviceDossier } from "./advice-dossier";

// ── Kaartenregister — welke kaarten een analyse op verzoek ondersteunen ──────
export const ANALYSE_KAARTEN = [
  "belastingsverloop",
  "opbouwsnelheid",
  "ontkoppeling",
  "efficientie",
  "slaap",
] as const;
export type AnalyseKaart = (typeof ANALYSE_KAARTEN)[number];

export function isAnalyseKaart(v: unknown): v is AnalyseKaart {
  return typeof v === "string" && (ANALYSE_KAARTEN as readonly string[]).includes(v);
}

/** Zichtbare daglimiet (per sporter, Amsterdamse dag). */
export const ANALYSES_PER_DAG = 5;

function amsterdamDag(d = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
}

export async function analysesVandaag(clerkId: string): Promise<number> {
  const dag = amsterdamDag();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(analysisRequestsTable)
    .where(
      and(
        eq(analysisRequestsTable.clerkId, clerkId),
        sql`(${analysisRequestsTable.createdAt} AT TIME ZONE 'Europe/Amsterdam')::date = ${dag}::date`,
      ),
    );
  return row?.n ?? 0;
}

// ── Deterministische uitkomsten per kaart ────────────────────────────────────
// Elke kaart levert: een reeks-samenvatting (echte getallen) + eerlijke gaten.

type KaartUitkomst = {
  kaart: AnalyseKaart;
  /** Aantal echte datapunten in de periode — sturing voor de verbandregel. */
  punten: number;
  feiten: Record<string, unknown>;
  /** Eerlijk: wat ontbreekt of beperkt de zeggingskracht. */
  gaten: string[];
};

export async function bouwUitkomsten(
  clerkId: string,
  kaarten: AnalyseKaart[],
  periodeDays: number,
): Promise<KaartUitkomst[]> {
  const vanaf = new Date();
  vanaf.setDate(vanaf.getDate() - periodeDays);
  const vanafIso = vanaf.toISOString().split("T")[0]!;

  const nodigLoad = kaarten.some((k) => k === "belastingsverloop" || k === "opbouwsnelheid");
  const nodigOntk = kaarten.some((k) => k === "ontkoppeling" || k === "efficientie");
  const nodigSlaap = kaarten.includes("slaap");

  const [sessies, ontkRitten, metrics] = await Promise.all([
    nodigLoad
      ? db
          .select({
            sessionDate: trainingSessionsTable.sessionDate,
            tss: trainingSessionsTable.tss,
          })
          .from(trainingSessionsTable)
          .where(eq(trainingSessionsTable.clerkId, clerkId))
      : Promise.resolve([]),
    nodigOntk ? computeOntkoppelingRitten(clerkId, periodeDays) : Promise.resolve([]),
    nodigSlaap
      ? db
          .select({
            metricDate: athleteDailyMetricsTable.metricDate,
            sleepHours: athleteDailyMetricsTable.sleepHours,
          })
          .from(athleteDailyMetricsTable)
          .where(
            and(
              eq(athleteDailyMetricsTable.clerkId, clerkId),
              gte(athleteDailyMetricsTable.metricDate, vanafIso),
            ),
          )
      : Promise.resolve([]),
  ]);

  const uitkomsten: KaartUitkomst[] = [];
  const series = nodigLoad ? computeLoadSeries(sessies, periodeDays) : null;

  for (const kaart of kaarten) {
    if (kaart === "belastingsverloop" && series) {
      const eerste = series.chartData[0];
      const laatste = series.chartData[series.chartData.length - 1];
      const dagenMetTraining = series.chartData.filter((p) => p.tss > 0).length;
      uitkomsten.push({
        kaart,
        punten: series.chartData.length,
        feiten: {
          ctlNu: laatste?.ctl ?? null,
          ctlBegin: eerste?.ctl ?? null,
          atlNu: laatste?.atl ?? null,
          tsbNu: laatste?.tsb ?? null,
          dagenMetTraining,
        },
        gaten:
          dagenMetTraining === 0
            ? ["Geen trainingen met belastingsscore in deze periode."]
            : [],
      });
    } else if (kaart === "opbouwsnelheid" && series) {
      // Weekstijging van CTL — zelfde reeks, geen tweede berekening.
      const perWeek = new Map<string, number>();
      for (const p of series.chartData) {
        const d = new Date(`${p.date}T12:00:00Z`);
        const dag = (d.getUTCDay() + 6) % 7;
        d.setUTCDate(d.getUTCDate() - dag);
        perWeek.set(d.toISOString().split("T")[0]!, p.ctl);
      }
      const weken = [...perWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      const stijgingen = weken
        .map(([, ctl], i) => (i === 0 ? null : Math.round((ctl - weken[i - 1]![1]) * 10) / 10))
        .filter((v): v is number => v != null);
      uitkomsten.push({
        kaart,
        punten: stijgingen.length,
        feiten: {
          laatsteWeekStijging: stijgingen[stijgingen.length - 1] ?? null,
          maxWeekStijging: stijgingen.length ? Math.max(...stijgingen) : null,
          wekenBoven5: stijgingen.filter((v) => v > 5).length,
        },
        gaten: stijgingen.length < 4 ? ["Minder dan vier volledige weken in de reeks."] : [],
      });
    } else if (kaart === "ontkoppeling" || kaart === "efficientie") {
      const met = ontkRitten.filter((r) => r.ontkoppelingPct != null);
      const laatste = met[met.length - 1] ?? null;
      const waarden =
        kaart === "ontkoppeling"
          ? met.map((r) => r.ontkoppelingPct!)
          : met.map((r) => r.efficientieWPerSlag!);
      const gem = waarden.length
        ? Math.round((waarden.reduce((s, v) => s + v, 0) / waarden.length) * 100) / 100
        : null;
      uitkomsten.push({
        kaart,
        punten: met.length,
        feiten: {
          laatsteWaarde:
            laatste == null
              ? null
              : kaart === "ontkoppeling"
                ? laatste.ontkoppelingPct
                : laatste.efficientieWPerSlag,
          laatsteDatum: laatste?.date ?? null,
          gemiddelde: gem,
          geschikteRitten: met.length,
          ongeschikteRitten: ontkRitten.length - met.length,
        },
        gaten:
          met.length === 0
            ? ["Geen geschikte ritten (vermogen én hartslag, minimaal een uur, gelijkmatig)."]
            : [],
      });
    } else if (kaart === "slaap") {
      const uren = metrics
        .map((m) => (m.sleepHours == null ? null : Number(m.sleepHours)))
        .filter((v): v is number => v != null && Number.isFinite(v));
      const gem = uren.length
        ? Math.round((uren.reduce((s, v) => s + v, 0) / uren.length) * 10) / 10
        : null;
      uitkomsten.push({
        kaart,
        punten: uren.length,
        feiten: {
          gemiddeldeUren: gem,
          nachtenOnder65: uren.filter((v) => v < 6.5).length,
          metingen: uren.length,
        },
        gaten: uren.length < 7 ? ["Minder dan zeven slaapmetingen in deze periode."] : [],
      });
    }
  }
  return uitkomsten;
}

// ── Digest — zelfde selectie + periode + data ⇒ zelfde antwoord ──────────────
export function uitkomstenDigest(
  kaarten: AnalyseKaart[],
  periodeDays: number,
  uitkomsten: KaartUitkomst[],
): string {
  return createHash("sha256")
    .update(JSON.stringify({ kaarten: [...kaarten].sort(), periodeDays, uitkomsten }))
    .digest("hex")
    .slice(0, 64);
}

// ── Formulering — het model verwoordt, de engines hebben gerekend ────────────
const MIN_PUNTEN_VOOR_VERBAND = 5;

export async function formuleerAnalyse(
  clerkId: string,
  kaarten: AnalyseKaart[],
  periodeDays: number,
  uitkomsten: KaartUitkomst[],
): Promise<string> {
  const verbandenToegestaan =
    kaarten.length >= 2 &&
    uitkomsten.every((u) => u.punten >= MIN_PUNTEN_VOOR_VERBAND);
  const system = [
    "Je bent de analysestem van een wielercoach-app. Schrijf UITSLUITEND in het Nederlands, in gewone taal, direct tegen de sporter (je/jij).",
    "Je krijgt deterministisch berekende uitkomsten. Je mag GEEN getallen berekenen, schatten of verzinnen — gebruik alleen de meegegeven feiten.",
    "Benoem eerlijk wat er in 'gaten' staat. Verzwijg nooit een beperking.",
    "Verbanden zijn waarnemingen, geen oorzaken: gebruik 'gaat samen op met', nooit 'komt door', 'veroorzaakt' of 'daardoor'.",
    verbandenToegestaan
      ? "Je mag benoemen wat samen op lijkt te gaan tussen de kaarten."
      : "Benoem GEEN verband tussen kaarten: minstens één reeks heeft te weinig punten. Zeg dat expliciet als er meer dan één kaart is.",
    "Maximaal 120 woorden. Geen aanhef, geen afsluiting, geen opsommingstekens.",
  ].join("\n");
  const message = await aiMessage(
    "analyse_on_demand",
    clerkId,
    {
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system,
      // Temperatuur 0: dezelfde input hoort dezelfde formulering op te leveren;
      // de digest-cache is daarnaast de harde garantie.
      temperature: 0,
      messages: [
        {
          role: "user",
          content: JSON.stringify({ periodeDagen: periodeDays, kaarten, uitkomsten }),
        },
      ],
    } as Parameters<typeof aiMessage>[2],
    { dedupeKey: uitkomstenDigest(kaarten, periodeDays, uitkomsten) },
  );
  const tekst = message.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("\n")
    .trim();
  if (!tekst) throw new Error("Lege analyse-tekst van het model");
  return tekst;
}

// ── Hoofdstroom: opvragen of aanmaken ────────────────────────────────────────
export async function analyseOpVerzoek(clerkId: string, kaartenRuw: unknown, periodeRuw: unknown) {
  const kaarten = Array.isArray(kaartenRuw) ? kaartenRuw.filter(isAnalyseKaart) : [];
  if (kaarten.length < 1 || kaarten.length > 5 || new Set(kaarten).size !== kaarten.length) {
    return { fout: "Kies één tot vijf verschillende kaarten." as const };
  }
  const periodeDays = Math.min(365, Math.max(14, Number(periodeRuw) || 90));

  const uitkomsten = await bouwUitkomsten(clerkId, kaarten, periodeDays);
  const digest = uitkomstenDigest(kaarten, periodeDays, uitkomsten);

  // Kostenbeheersing: de hele beslissing (hergebruik? limiet? aanroepen?)
  // loopt per sporter achter een advisory-transactielock. Gelijktijdige
  // verzoeken serialiseren; het tweede identieke verzoek vindt daarna de
  // bewaarde rij en de daglimiet kan niet meer voorbijgerend worden.
  // Mislukt de modelaanroep, dan rolt de transactie terug en telt er niets.
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${"analyse-verzoek:" + clerkId}))`,
    );

    // Zelfde selectie+periode+data ⇒ bewaarde analyse terug (geen modelaanroep,
    // telt niet mee voor de daglimiet).
    const [bestaand] = await tx
      .select()
      .from(analysisRequestsTable)
      .where(
        and(
          eq(analysisRequestsTable.clerkId, clerkId),
          eq(analysisRequestsTable.dataDigest, digest),
        ),
      )
      .orderBy(desc(analysisRequestsTable.createdAt))
      .limit(1);
    const dag = amsterdamDag();
    const telVandaag = async () => {
      const [row] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(analysisRequestsTable)
        .where(
          and(
            eq(analysisRequestsTable.clerkId, clerkId),
            sql`(${analysisRequestsTable.createdAt} AT TIME ZONE 'Europe/Amsterdam')::date = ${dag}::date`,
          ),
        );
      return row?.n ?? 0;
    };
    if (bestaand) {
      const gebruikt = await telVandaag();
      return { analyse: bestaand, hergebruikt: true as const, gebruiktVandaag: gebruikt, limiet: ANALYSES_PER_DAG };
    }

    const gebruikt = await telVandaag();
    if (gebruikt >= ANALYSES_PER_DAG) {
      return { limietBereikt: true as const, gebruiktVandaag: gebruikt, limiet: ANALYSES_PER_DAG };
    }

    const tekst = await formuleerAnalyse(clerkId, kaarten, periodeDays, uitkomsten);

    // Adviesdossier (R3): elk resultaat is terugleesbaar onderbouwd.
    const dossier = await createAdviceDossier({
    clerkId,
    adviceType: "analyse_op_verzoek",
    adviceKey: `analyse:${digest}`,
    title: `Analyse op verzoek — ${kaarten.join(" + ")} (${periodeDays} dagen)`,
    adviceText: tekst,
    basedOn: uitkomsten.map((u) => ({
      kind: "kaart",
      label: u.kaart,
      value: JSON.stringify(u.feiten),
      date: amsterdamDag(),
    })),
    sourcesUsed: ["training_sessions", "activity_imports", "athlete_daily_metrics"],
    sourcesExcluded: [],
    rulesApplied: [
      "analyse-verzoek-v1:deterministische-uitkomsten",
      "analyse-verzoek-v1:verband-alleen-bij-genoeg-punten",
      "analyse-verzoek-v1:geen-oorzakelijke-taal",
    ],
    knowledgeRefs: [],
    confidenceFactors: { punten: Object.fromEntries(uitkomsten.map((u) => [u.kaart, u.punten])) },
    confidenceLevel: uitkomsten.some((u) => u.gaten.length > 0) ? "voorzichtig" : "redelijk_zeker",
    alternativesConsidered: [{ option: "Geen analyse tonen tot er meer data is" }],
    whyAlternativeRejected:
      "De sporter vroeg hier zelf om; beperkingen worden expliciet benoemd in plaats van te zwijgen.",
    risks: [{ risk: "Waarnemingen kunnen als oorzaak gelezen worden; de formulering vermijdt oorzakelijke taal." }],
    computedBy: [
      { engine: "analyse-verzoek", version: "v1" },
      { engine: "computeLoadSeries" },
      { engine: "computeOntkoppelingRitten" },
    ],
    aiInvolvement: { used: true, purpose: "analyse_on_demand" },
    });

    const [rij] = await tx
      .insert(analysisRequestsTable)
      .values({
        clerkId,
        kaarten: [...kaarten].sort(),
        periodeDays,
        dataDigest: digest,
        uitkomsten,
        tekst,
        adviceDossierId: dossier.id,
      })
      .returning();
    return { analyse: rij!, hergebruikt: false as const, gebruiktVandaag: gebruikt + 1, limiet: ANALYSES_PER_DAG };
  });
}
