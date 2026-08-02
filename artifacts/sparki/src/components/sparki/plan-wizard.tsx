// Adaptieve plan-wizard: hoe hoger het niveau, hoe meer vragen.
// Slaat alles op via de bestaande profiel- en leefagenda-API's en bouwt
// daarna het plan met de bestaande generator — geen nieuwe backend.
import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { DsCard, DsCardTitel } from "@/components/ds/card";
import { DsButton } from "@/components/ds/button";
import { DsStatus } from "@/components/ds/status";
import {
  NIVEAUS,
  wizardStappenVoorNiveau,
  type NiveauId,
  type WizardStapId,
} from "@/lib/plan-overview";
import {
  useSavePlanSetup,
  useGenerateTrainingPlan,
  type GenerateResponse,
  type PlanDay,
} from "@/hooks/use-training-plan";
import {
  useLifeEvents,
  useAddLifeEvent,
  useDeleteLifeEvent,
  type LifeEventKind,
  type LifeEventImpact,
} from "@/hooks/use-life-events";

const WEEKDAGEN: { id: string; label: string }[] = [
  { id: "mon", label: "Ma" },
  { id: "tue", label: "Di" },
  { id: "wed", label: "Wo" },
  { id: "thu", label: "Do" },
  { id: "fri", label: "Vr" },
  { id: "sat", label: "Za" },
  { id: "sun", label: "Zo" },
];

const BELASTBAARHEID: { id: string; label: string; uitleg: string }[] = [
  { id: "low", label: "Voorzichtig", uitleg: "Ik herstel langzaam of kom terug van blessure/ziekte." },
  { id: "moderate", label: "Normaal", uitleg: "Ik kan gewone trainingsweken goed aan." },
  { id: "high", label: "Hoog", uitleg: "Ik verdraag zware weken en herstel snel." },
];

const AGENDA_SOORT: { id: LifeEventKind; label: string }[] = [
  { id: "werk", label: "Werk" },
  { id: "school", label: "School" },
  { id: "familie", label: "Familie" },
  { id: "anders", label: "Anders" },
];

const AGENDA_IMPACT: { id: LifeEventImpact; label: string }[] = [
  { id: "geen_training", label: "Geen training mogelijk" },
  { id: "minder_tijd", label: "Minder tijd" },
  { id: "alleen_licht", label: "Alleen licht trainen" },
];

function Keuzeknop({
  actief,
  onClick,
  children,
  className,
}: {
  actief: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actief}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60",
        actief
          ? "border-accent-cyan/60 bg-accent-cyan/10"
          : "border-border bg-surface hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PlanWizard({ missing }: { missing: string[] }) {
  const save = useSavePlanSetup();
  const generate = useGenerateTrainingPlan();
  const { data: events } = useLifeEvents();
  const addEvent = useAddLifeEvent();
  const deleteEvent = useDeleteLifeEvent();

  const [niveau, setNiveau] = useState<NiveauId | null>(null);
  const [stapIndex, setStapIndex] = useState(0);
  const [dagen, setDagen] = useState<string[]>([]);
  const [uren, setUren] = useState<number | "">("");
  const [belastbaarheid, setBelastbaarheid] = useState<string | null>(null);
  const [blessures, setBlessures] = useState("");
  const [voorkeuren, setVoorkeuren] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  // Resultaat-popup: verschijnt zodra de generator klaar is, met het ECHTE
  // gebouwde plan (aantallen uit de response, nooit verzonnen).
  const [resultaat, setResultaat] = useState<GenerateResponse | null>(null);

  // Nieuw agenda-item (inline formulier)
  const [agTitel, setAgTitel] = useState("");
  const [agSoort, setAgSoort] = useState<LifeEventKind>("werk");
  const [agImpact, setAgImpact] = useState<LifeEventImpact>("minder_tijd");
  const [agVan, setAgVan] = useState("");
  const [agTot, setAgTot] = useState("");

  const stappen: WizardStapId[] = niveau
    ? wizardStappenVoorNiveau(niveau)
    : ["niveau"];
  const stap = stappen[stapIndex] ?? "niveau";

  function volgende() {
    setFout(null);
    if (stap === "beschikbaarheid") {
      if (dagen.length === 0) return setFout("Kies minimaal één trainingsdag.");
      if (uren === "" || Number(uren) <= 0)
        return setFout("Vul in hoeveel uur per week je wilt trainen.");
    }
    if (stap === "belastbaarheid" && belastbaarheid == null)
      return setFout("Kies hoe belastbaar je je voelt.");
    setStapIndex((i) => Math.min(i + 1, stappen.length - 1));
  }

  function vorige() {
    setFout(null);
    setStapIndex((i) => Math.max(i - 1, 0));
  }

  async function bouwPlan() {
    if (niveau == null || uren === "" || agendaBezig) return;
    setFout(null);
    try {
      await save.mutateAsync({
        experienceLevel: NIVEAUS.find((n) => n.id === niveau)!.experienceLevel,
        availableDays: dagen,
        weeklyHourTarget: Number(uren),
        ...(belastbaarheid != null && { loadCapacity: belastbaarheid }),
        ...(blessures.trim() && { injuryHistory: blessures.trim() }),
        ...(voorkeuren.trim() && { trainingPreferences: voorkeuren.trim() }),
      });
      const res = await generate.mutateAsync();
      setResultaat(res);
    } catch {
      setFout("Opslaan of opbouwen lukte niet. Probeer het opnieuw.");
    }
  }

  async function voegAgendaToe() {
    if (!agTitel.trim() || !agVan) return;
    setFout(null);
    try {
      await addEvent.mutateAsync({
        kind: agSoort,
        title: agTitel.trim(),
        startDate: agVan,
        endDate: agTot || null,
        impact: agImpact,
      });
      setAgTitel("");
      setAgVan("");
      setAgTot("");
    } catch {
      setFout("De periode kon niet worden opgeslagen. Probeer het opnieuw.");
    }
  }

  // Agenda-writes moeten persist zijn vóórdat het plan gebouwd wordt —
  // anders plant de generator om een drukke periode heen die nog niet bestaat.
  const agendaBezig = addEvent.isPending || deleteEvent.isPending;
  const bezig = save.isPending || generate.isPending || agendaBezig;

  return (
    <DsCard variant="standaard" className="flex flex-col gap-4">
      <div>
        <DsCardTitel>Plan opstellen</DsCardTitel>
        <p className="type-body-sm text-content-secondary mt-1">
          {niveau == null
            ? "Een paar vragen — hoe serieuzer je traint, hoe preciezer we het maken."
            : `Stap ${stapIndex + 1} van ${stappen.length}`}
        </p>
      </div>

      {/* ── Stap: niveau ── */}
      {stap === "niveau" && (
        <div className="flex flex-col gap-2">
          {NIVEAUS.map((n) => (
            <Keuzeknop
              key={n.id}
              actief={niveau === n.id}
              onClick={() => {
                setNiveau(n.id);
                setStapIndex(0);
              }}
            >
              <span className="type-action block">{n.label}</span>
              <span className="type-body-sm text-content-secondary">{n.beschrijving}</span>
            </Keuzeknop>
          ))}
        </div>
      )}

      {/* ── Stap: beschikbaarheid ── */}
      {stap === "beschikbaarheid" && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="type-action mb-2">Op welke dagen kun je trainen?</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAGEN.map((d) => (
                <Keuzeknop
                  key={d.id}
                  actief={dagen.includes(d.id)}
                  onClick={() =>
                    setDagen((cur) =>
                      cur.includes(d.id)
                        ? cur.filter((x) => x !== d.id)
                        : [...cur, d.id],
                    )
                  }
                  className="px-3 py-2 min-w-11 text-center"
                >
                  <span className="type-label">{d.label}</span>
                </Keuzeknop>
              ))}
            </div>
          </div>
          <div>
            <p className="type-action mb-2">Hoeveel uur per week wil je trainen?</p>
            <input
              type="number"
              min={1}
              max={30}
              value={uren}
              onChange={(e) =>
                setUren(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-24 rounded-lg border border-border bg-surface px-3 py-2 num type-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
              aria-label="Uren per week"
            />
            <span className="type-body-sm text-content-secondary ml-2">uur per week</span>
          </div>
        </div>
      )}

      {/* ── Stap: leefagenda ── */}
      {stap === "agenda" && (
        <div className="flex flex-col gap-3">
          <p className="type-action">
            Drukke periodes (werk, school, sociaal)?
          </p>
          <p className="type-body-sm text-content-secondary -mt-2">
            Het plan houdt hier automatisch rekening mee. Overslaan mag.
          </p>
          {(events ?? []).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <div>
                <span className="type-action block">{e.title}</span>
                <span className="type-body-sm text-content-secondary">
                  {e.startDate}
                  {e.endDate ? ` – ${e.endDate}` : ""} · {AGENDA_IMPACT.find((i) => i.id === e.impact)?.label}
                </span>
              </div>
              <DsButton variant="tekst" onClick={() => deleteEvent.mutate(e.id)}>
                Weg
              </DsButton>
            </div>
          ))}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
            <input
              type="text"
              value={agTitel}
              onChange={(e) => setAgTitel(e.target.value)}
              placeholder="Bijv. drukke werkweek, examens…"
              className="rounded-lg border border-border bg-surface px-3 py-2 type-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
            />
            <div className="flex flex-wrap gap-1.5">
              {AGENDA_SOORT.map((s) => (
                <Keuzeknop key={s.id} actief={agSoort === s.id} onClick={() => setAgSoort(s.id)} className="px-2.5 py-1.5">
                  <span className="type-label">{s.label}</span>
                </Keuzeknop>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AGENDA_IMPACT.map((i) => (
                <Keuzeknop key={i.id} actief={agImpact === i.id} onClick={() => setAgImpact(i.id)} className="px-2.5 py-1.5">
                  <span className="type-label">{i.label}</span>
                </Keuzeknop>
              ))}
            </div>
            <div className="flex gap-2">
              <label className="flex flex-col gap-1 type-label text-content-secondary">
                Van
                <input type="date" value={agVan} onChange={(e) => setAgVan(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60" />
              </label>
              <label className="flex flex-col gap-1 type-label text-content-secondary">
                Tot (optioneel)
                <input type="date" value={agTot} onChange={(e) => setAgTot(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60" />
              </label>
            </div>
            <DsButton
              variant="secundair"
              onClick={voegAgendaToe}
              disabled={!agTitel.trim() || !agVan || addEvent.isPending}
            >
              Periode toevoegen
            </DsButton>
          </div>
        </div>
      )}

      {/* ── Stap: belastbaarheid ── */}
      {stap === "belastbaarheid" && (
        <div className="flex flex-col gap-3">
          <p className="type-action">Hoe belastbaar ben je op dit moment?</p>
          <div className="flex flex-col gap-2">
            {BELASTBAARHEID.map((b) => (
              <Keuzeknop key={b.id} actief={belastbaarheid === b.id} onClick={() => setBelastbaarheid(b.id)}>
                <span className="type-action block">{b.label}</span>
                <span className="type-body-sm text-content-secondary">{b.uitleg}</span>
              </Keuzeknop>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span className="type-action">Blessures of aandachtspunten (optioneel)</span>
            <textarea
              rows={2}
              value={blessures}
              onChange={(e) => setBlessures(e.target.value)}
              placeholder="Bijv. knieklachten bij lange ritten"
              className="resize-none rounded-lg border border-border bg-surface px-3 py-2 type-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
            />
          </label>
        </div>
      )}

      {/* ── Stap: voorkeuren (wedstrijdniveaus) ── */}
      {stap === "voorkeuren" && (
        <label className="flex flex-col gap-1">
          <span className="type-action">Trainingsvoorkeuren</span>
          <span className="type-body-sm text-content-secondary">
            Bijv. liever lange duurritten, intervallen op dinsdag, groepstraining op zaterdag.
          </span>
          <textarea
            rows={3}
            value={voorkeuren}
            onChange={(e) => setVoorkeuren(e.target.value)}
            className="mt-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 type-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60"
          />
        </label>
      )}

      {/* ── Stap: samenvatting ── */}
      {stap === "samenvatting" && niveau != null && (
        <div className="flex flex-col gap-2">
          <p className="type-action">Klopt dit?</p>
          <ul className="flex flex-col gap-1 type-body text-content-secondary">
            <li>Niveau: <span className="text-foreground/80">{NIVEAUS.find((n) => n.id === niveau)?.label}</span></li>
            <li>Trainingsdagen: <span className="text-foreground/80">{dagen.map((d) => WEEKDAGEN.find((w) => w.id === d)?.label).join(", ") || "—"}</span></li>
            <li>Uren per week: <span className="num text-foreground/80">{uren === "" ? "—" : uren}</span></li>
            {belastbaarheid != null && (
              <li>Belastbaarheid: <span className="text-foreground/80">{BELASTBAARHEID.find((b) => b.id === belastbaarheid)?.label}</span></li>
            )}
            {(events?.length ?? 0) > 0 && (
              <li>Agenda-periodes: <span className="num text-foreground/80">{events!.length}</span></li>
            )}
          </ul>
          {missing.includes("ftp") && (
            <p className="type-body-sm text-content-secondary">
              Je FTP is nog niet bekend — het plan start dan met een voorzichtige schatting die meegroeit met je ritten.
            </p>
          )}
        </div>
      )}

      {fout && <DsStatus status="fout">{fout}</DsStatus>}

      <div className="ds-actiebalk flex gap-2 mt-1">
        {stapIndex > 0 && (
          <DsButton variant="secundair" onClick={vorige} disabled={bezig}>
            Terug
          </DsButton>
        )}
        {stap === "samenvatting" ? (
          <DsButton variant="primair" onClick={bouwPlan} loading={bezig} className="flex-1">
            Bouw mijn plan
          </DsButton>
        ) : (
          <DsButton
            variant="primair"
            onClick={volgende}
            disabled={niveau == null}
            className="flex-1"
          >
            Volgende
          </DsButton>
        )}
      </div>

      {resultaat && (
        <PlanGereedModal
          resultaat={resultaat}
          onSluiten={() => setResultaat(null)}
        />
      )}
    </DsCard>
  );
}

// ── Resultaat-popup ──────────────────────────────────────────────────────────
// Portal naar body op z-[80]: eigen fixed modals botsen anders met de
// onderste navigatie (z-50) en lijken dan "niets te doen".
function PlanGereedModal({
  resultaat,
  onSluiten,
}: {
  resultaat: GenerateResponse;
  onSluiten: () => void;
}) {
  const plan = resultaat.plan;
  const dagen = resultaat.days ?? [];
  const trainingen = dagen.filter((d) => !d.isRest);
  const rustdagen = dagen.filter((d) => d.isRest);
  const totaalMin = trainingen.reduce((s, d) => s + (d.estDurationMin ?? 0), 0);
  const weken = new Set(dagen.map((d) => d.weekIndex)).size;
  const eerste: PlanDay | undefined = [...trainingen].sort((a, b) =>
    a.dayDate.localeCompare(b.dayDate),
  )[0];

  function datumLabel(iso: string) {
    const [j, m, d] = iso.split("-").map(Number);
    if (!j || !m || !d) return iso;
    return new Date(j, m - 1, d).toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Je trainingsplan staat klaar"
    >
      <div
        className="absolute inset-0 bg-foreground/70 backdrop-blur-sm"
        onClick={onSluiten}
      />
      <DsCard
        variant="standaard"
        className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto flex flex-col gap-4 border-accent-cyan/30"
      >
        <div>
          <p className="type-label text-accent-cyan tracking-[0.18em]">
            JE PLAN STAAT KLAAR
          </p>
          <DsCardTitel>{plan?.name ?? "Jouw trainingsplan"}</DsCardTitel>
          {plan?.summary && (
            <p className="type-body-sm text-content-secondary mt-1">
              {plan.summary}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { n: weken, l: weken === 1 ? "week" : "weken" },
            { n: trainingen.length, l: "trainingen" },
            {
              n: Math.round((totaalMin / 60) * 10) / 10,
              l: "uur totaal",
            },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-lg border border-border bg-surface px-2 py-3 text-center"
            >
              <span className="num type-title block text-foreground">{s.n}</span>
              <span className="type-label text-content-secondary">{s.l}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          {eerste && (
            <p className="type-body text-content-secondary">
              Je trapt af op{" "}
              <span className="text-foreground/90">{datumLabel(eerste.dayDate)}</span>
              {" "}met{" "}
              <span className="text-foreground/90">
                {eerste.workout?.title ?? eerste.focus}
              </span>
              {eerste.estDurationMin != null && (
                <>
                  {" "}(<span className="num">{eerste.estDurationMin}</span> min)
                </>
              )}
              .
            </p>
          )}
          {rustdagen.length > 0 && (
            <p className="type-body-sm text-content-secondary">
              Er zijn <span className="num">{rustdagen.length}</span> rustdagen
              ingepland — herstel is onderdeel van het plan, niet een gat erin.
            </p>
          )}
          {eerste?.rationale && (
            <p className="type-body-sm text-content-secondary">
              Waarom zo: {eerste.rationale}
            </p>
          )}
          <p className="type-body-sm text-content-secondary">
            Elke training in de kalender is aan te tikken voor uitleg, en het
            plan past zich aan als jij iets mist of aanpast.
          </p>
        </div>

        <div className="ds-actiebalk">
          <DsButton variant="primair" onClick={onSluiten} className="w-full">
            Laat mijn plan zien
          </DsButton>
        </div>
      </DsCard>
    </div>,
    document.body,
  );
}
