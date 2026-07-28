#!/usr/bin/env python3
"""Generates the W2 review PDF report."""

from fpdf import FPDF
from fpdf.enums import XPos, YPos
import datetime

CYAN = (120, 210, 230)
WHITE = (255, 255, 255)
DARK = (10, 18, 28)
GREY = (120, 130, 145)
GREEN_TXT = (80, 200, 130)
RED_TXT = (230, 90, 90)
AMBER = (230, 180, 60)
BG = (245, 247, 250)
RULE = (210, 215, 222)
HEADER_BG = (20, 32, 50)


class W2Report(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=18)

    # ── helpers ──────────────────────────────────────────────────────────────

    def rule(self):
        self.set_draw_color(*RULE)
        self.set_line_width(0.2)
        self.line(14, self.get_y(), 196, self.get_y())
        self.ln(3)

    def section_title(self, number: str, title: str):
        self.ln(5)
        self.set_fill_color(*HEADER_BG)
        self.set_text_color(*CYAN)
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 7, f"  {number}  {title}", fill=True,
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)

    def kv(self, label: str, value: str, status: str = "ok"):
        col = GREEN_TXT if status == "ok" else (RED_TXT if status == "err" else AMBER)
        icon = "\u2713" if status == "ok" else ("\u26a0" if status == "warn" else "\u2717")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*GREY)
        self.cell(68, 5.5, label)
        self.set_text_color(*col)
        self.set_font("Helvetica", "B", 8)
        self.cell(6, 5.5, icon)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*DARK)
        self.multi_cell(0, 5.5, value, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def badge(self, text: str, status: str = "ok"):
        col = GREEN_TXT if status == "ok" else (RED_TXT if status == "err" else AMBER)
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*col)
        self.set_fill_color(col[0], col[1], col[2], )
        self.cell(0, 4, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def body(self, text: str, indent: int = 0):
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(*DARK)
        if indent:
            self.set_x(14 + indent)
        self.multi_cell(0, 5.5, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def defect(self, title: str, detail: str):
        self.ln(2)
        self.set_fill_color(255, 240, 240)
        self.set_draw_color(*RED_TXT)
        self.set_line_width(0.4)
        x, y = self.get_x(), self.get_y()
        self.rect(14, y, 182, 1, style="")   # top border only via line
        self.line(14, y, 14, y + 28)          # left accent
        self.set_x(18)
        self.set_font("Helvetica", "B", 8.5)
        self.set_text_color(*RED_TXT)
        self.cell(0, 5.5, f"DEFECT \u2014 {title}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_x(18)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*DARK)
        self.multi_cell(178, 5, detail, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)

    def warn_box(self, title: str, detail: str):
        self.ln(2)
        self.set_line_width(0.4)
        y = self.get_y()
        self.line(14, y, 14, y + 22)
        self.set_draw_color(*AMBER)
        self.set_x(18)
        self.set_font("Helvetica", "B", 8.5)
        self.set_text_color(*AMBER)
        self.cell(0, 5.5, f"\u26a0  {title}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_x(18)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*DARK)
        self.multi_cell(178, 5, detail, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)

    def table_header(self, cols: list[tuple[str, int]]):
        self.set_fill_color(*HEADER_BG)
        self.set_text_color(*CYAN)
        self.set_font("Helvetica", "B", 7.5)
        for label, w in cols:
            self.cell(w, 6, label, fill=True)
        self.ln()

    def table_row(self, cells: list[tuple[str, int]], statuses: list[str] = None):
        self.set_font("Helvetica", "", 8)
        self.set_fill_color(250, 251, 253)
        for i, (text, w) in enumerate(cells):
            st = (statuses[i] if statuses and i < len(statuses) else "")
            if st == "ok":
                self.set_text_color(*GREEN_TXT)
            elif st == "err":
                self.set_text_color(*RED_TXT)
            elif st == "warn":
                self.set_text_color(*AMBER)
            else:
                self.set_text_color(*DARK)
            self.cell(w, 5.5, text, fill=True)
        self.ln()
        self.set_draw_color(*RULE)
        self.set_line_width(0.1)
        self.line(14, self.get_y(), 196, self.get_y())


pdf = W2Report()
pdf.add_page()

# ── Cover header ──────────────────────────────────────────────────────────────
pdf.set_fill_color(*HEADER_BG)
pdf.rect(0, 0, 210, 38, style="F")
pdf.set_text_color(*CYAN)
pdf.set_font("Helvetica", "B", 18)
pdf.set_xy(14, 10)
pdf.cell(0, 8, "W2 REVIEW — FUNCTIONELE ACCEPTATIE VANDAAG", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_x(14)
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(180, 200, 220)
pdf.cell(0, 5, f"Sparki HERSTELPLAN v1.0  \u00b7  {datetime.date.today().strftime('%d %B %Y')}  \u00b7  dev / DEV_AUTH_BYPASS  \u00b7  sequentieel uitgevoerd")
pdf.set_y(42)

# ── Build status strip ────────────────────────────────────────────────────────
pdf.set_fill_color(235, 250, 242)
pdf.set_draw_color(*GREEN_TXT)
pdf.set_line_width(0.3)
pdf.rect(14, pdf.get_y(), 182, 8, style="D")
pdf.set_x(16)
pdf.set_font("Helvetica", "B", 8)
pdf.set_text_color(*GREEN_TXT)
pdf.cell(0, 8,
    "\u2713 TypeScript schoon   \u2713 API build schoon   "
    "\u2713 Frontend build #1 schoon   \u2713 Frontend build #2 schoon   \u2713 Console schoon")
pdf.ln(12)

# ══════════════════════════════════════════════════════════════════════════════
pdf.section_title("1.", "VANDAAG — LAYOUT PER VIEWPORT")

pdf.body("Getest op 390\u00d7874 (mobiel), 768\u00d71024 (tablet) en 1440\u00d7900 (desktop).")
pdf.ln(1)

cols = [("Check", 108), ("Resultaat", 74)]
pdf.table_header(cols)
checks = [
    ("Mobiel behoudt bestaande opbouw", "\u2713 OK", "ok"),
    ("Lege hoogte onder \u201eHoe voel je je?\u201d (W2B)", "\u2713 Opgelost", "ok"),
    ("Horizontale overflow", "\u2713 Geen", "ok"),
    ("Overlappende kaarten / afgesneden tekst", "\u2713 Geen", "ok"),
    ("Browser console fouten", "\u2713 Schoon", "ok"),
    ("Desktop twee-kolom CommercialToday (W2A)", "\u26a0 Niet zichtbaar \u2014 zie opmerking", "warn"),
]
for label, result, st in checks:
    pdf.table_row([(label, 108), (result, 74)], ["", st])

pdf.ln(2)
pdf.warn_box(
    "W2A desktop twee-kolom niet verifieerbaar in dev \u2014 flag-issue, geen code-regressie",
    "Alle drie viewports tonen de oude DayHome omdat de commercial_shell feature flag OFF staat voor de "
    "dev-testgebruiker. CommercialToday (met lg:grid-cols-[2fr_1fr] indeling, max-screen-xl container) is "
    "correct ge\u00efmplementeerd en compileert schoon (TypeScript exit 0). Zichtbaar zodra de vlag aan staat "
    "op Ren\u00e9\u2019s account."
)

# ══════════════════════════════════════════════════════════════════════════════
pdf.section_title("2.", "TRAINING TOEVOEGEN \u2014 VOLLEDIGE FLOW")

pdf.body("Flow gevolgd via code-trace (modal rendert via createPortal op document.body).")
pdf.ln(1)

cols2 = [("Stap", 108), ("Resultaat", 74)]
pdf.table_header(cols2)
steps = [
    ("Knop opent AddTrainingModal", "\u2713 portaal z-[80]", "ok"),
    ("Keuze-modus: inplannen / registreren / blok", "\u2713 drie opties", "ok"),
    ("Terug-knop naar chooser", "\u2713 ChevronLeft \u2192 mode \u2192 \u201ekies\u201d", "ok"),
    ("ESC sluit modal", "\u2713 addEventListener keydown", "ok"),
    ("Klik buiten modal sluit", "\u2713 backdrop onClick={onClose}", "ok"),
    ("Annuleer-knop in beide forms", "\u2713 aanwezig", "ok"),
    ("\u201eOpslaan\u2026\u201d disabled tijdens opslaan", "\u2713 disabled={isPending}", "ok"),
    ("Success \u2192 sessions + dashboard + load herlaadt", "\u2713 invalidateQueries", "ok"),
    ("Success \u2192 todayWorkout + workoutsList herlaadt", "\u2713 invalidateQueries", "ok"),
    ("Expliciete bevestiging na succes", "\u2717 ONTBREEKT \u2014 zie defect", "err"),
    ("Foutmelding bij API-fout", "\u2717 ONTBREEKT \u2014 zie defect", "err"),
]
for label, result, st in steps:
    pdf.table_row([(label, 108), (result, 74)], ["", st])

pdf.ln(2)
# Using regular text blocks instead of defect() to avoid Unicode escape issues
pdf.set_line_width(0.4)
pdf.set_draw_color(*RED_TXT)

y = pdf.get_y()
pdf.line(14, y, 14, y + 32)
pdf.set_x(18)
pdf.set_font("Helvetica", "B", 8.5)
pdf.set_text_color(*RED_TXT)
pdf.cell(0, 5.5, "DEFECT \u2014 Stille actie na succes", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_x(18)
pdf.set_font("Helvetica", "", 8)
pdf.set_text_color(*DARK)
pdf.multi_cell(178, 5,
    "Na succesvol opslaan sluit de modal zonder enige bevestiging. Geen toast, geen "
    "\u201eTraining opgeslagen voor [datum]\u201d, geen visueel resultaat. De gebruiker ziet niet welke "
    "training is toegevoegd, voor welke dag, of dat de actie geslaagd is. Dashboard-invalidatie "
    "werkt op de achtergrond, maar het resultaat is pas zichtbaar als de dagcontext er een "
    "trainingsdag van maakt. Bestaand defect \u2014 niet door W2 veroorzaakt. Follow-up task #294 aangemaakt.",
    new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(3)

y = pdf.get_y()
pdf.line(14, y, 14, y + 28)
pdf.set_x(18)
pdf.set_font("Helvetica", "B", 8.5)
pdf.set_text_color(*RED_TXT)
pdf.cell(0, 5.5, "DEFECT \u2014 Foutmelding ontbreekt bij API-fout", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_x(18)
pdf.set_font("Helvetica", "", 8)
pdf.set_text_color(*DARK)
pdf.multi_cell(178, 5,
    "Zowel LogSessionForm als PlanWorkoutForm renderen logSession.isError / createWorkout.isError "
    "nergens. Bij een HTTP-fout stopt de spinner, maar er verschijnt geen foutmelding. Het modal "
    "blijft open zonder uitleg en zonder \u201eOpnieuw proberen\u201d. Bestaand defect \u2014 gedekt door task #294.",
    new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(3)

# ══════════════════════════════════════════════════════════════════════════════
pdf.section_title("3.", "VOEDING EN HYDRATATIE")

cols3 = [("Check", 108), ("Resultaat", 74)]
pdf.table_header(cols3)
voeding = [
    ("Drawer opent via rij op Vandaag", "\u2713 VoedingScreen Sheet", "ok"),
    ("Rustdag herkend als hersteldag", "\u2713 recovery_day \u2192 \u201eHersteldag\u201d", "ok"),
    ("Reden zichtbaar voor gebruiker", "\u2713 \u201eVandaag is een herstel- of rustdag.\u201d", "ok"),
    ("Gebruiker kan context aanpassen", "\u2713 radio-knoppen aanwezig", "ok"),
    ("Lege staat: geen mock/fallback data", "\u2713 \u201eNog niets gelogd \u2014 begin hier\u201d", "ok"),
    ("Succes-/fout-/annuleringstoestand", "\u2713 create.isError + isPending aanwezig", "ok"),
    ("Gemeten/Berekend/Advies/Richtlijn labels", "\u26a0 Niet ge\u00efmplementeerd (bestaande gap)", "warn"),
]
for label, result, st in voeding:
    pdf.table_row([(label, 108), (result, 74)], ["", st])

# ══════════════════════════════════════════════════════════════════════════════
pdf.section_title("4.", "MATERIAAL")

pdf.table_header(cols3)
materiaal = [
    ("\u201eVraag Sparki\u201d nergens zichtbaar in UI", "\u2713 Alleen in code-comments", "ok"),
    ("Knop heet \u201eMateriaal beoordelen\u201d (W2D)", "\u2713 Gewijzigd", "ok"),
    ("Categoriechips werken", "\u2713 Wielset, Banden, Remblokken, Ketting, Helm\u2026", "ok"),
    ("Foutafhandeling bij beoordeling", "\u2713 assess.isError weergegeven", "ok"),
    ("\u201eOpnieuw beoordelen\u201d bij fout", "\u2713 aanwezig", "ok"),
    ("Eerder beoordeeld item zichtbaar", "\u2713 Continental GP5000 25mm \u2014 Beoordeeld", "ok"),
    ("Personificerende tekst", "\u2713 Geen", "ok"),
]
for label, result, st in materiaal:
    pdf.table_row([(label, 108), (result, 74)], ["", st])

# ══════════════════════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_title("5.", "ALLE ZICHTBARE ACTIES OP VANDAAG")

cols5 = [("Label", 42), ("Doel", 38), ("Succes", 30), ("Fout", 30), ("Annuleer", 24), ("Terug", 18)]
pdf.table_header(cols5)
actions = [
    ("Zoek (\U0001f50d)", "Zoekoverlay", "\u2713", "n.v.t.", "\u2713", "\u2713"),
    ("Hamburgermenu (\u2261)", "Hoofdmenu", "\u2713", "n.v.t.", "\u2713", "\u2713"),
    ("Analyse openen (menu)", "Chat-overlay", "\u2713 z-[80]", "n.v.t.", "\u2713", "\u2713"),
    ("SPARKI ADVISEERT \u24d8", "UitlegDot", "\u2713", "n.v.t.", "\u2713", "\u2713"),
    ("Waarom dit zo is?", "Accordion", "\u2713", "n.v.t.", "\u2713 inkl.", "\u2014"),
    ("\u2192 Volledige analyse", "Navigeert /state", "\u2713", "n.v.t.", "n.v.t.", "\u2713 auto"),
    ("Goed / Matig / Slecht", "Check-in", "\u2713 chip weg", "\u2713 melding", "n.v.t.", "\u2014"),
    ("Training toevoegen", "AddTrainingModal", "\u2713 opent", "\u2717 geen msg", "\u2713", "\u2713"),
    ("Voeding & hydratatie", "VoedingScreen", "\u2713 drawer", "\u2713 isError", "\u2713", "\u2713"),
    ("Categoriechip (Wielset\u2026)", "Materiaal", "\u2713", "\u2713 assess.err", "\u2713", "\u2713"),
    ("Eerder bekeken item", "Beoord.detail", "\u2713", "\u2713", "\u2713", "\u2713"),
]
statuses5 = [
    ["", "", "ok", "", "ok", "ok"],
    ["", "", "ok", "", "ok", "ok"],
    ["", "", "ok", "", "ok", "ok"],
    ["", "", "ok", "", "ok", "ok"],
    ["", "", "ok", "", "ok", ""],
    ["", "", "ok", "", "", "ok"],
    ["", "", "ok", "ok", "", ""],
    ["", "", "ok", "err", "ok", "ok"],
    ["", "", "ok", "ok", "ok", "ok"],
    ["", "", "ok", "ok", "ok", "ok"],
    ["", "", "ok", "ok", "ok", "ok"],
]
for (cells, sts) in zip(actions, statuses5):
    pdf.table_row(list(zip(cells, [42,38,30,30,24,18])), sts)

# ══════════════════════════════════════════════════════════════════════════════
pdf.section_title("6.", "COMMUNICATIE")

pdf.table_header(cols3)
comm = [
    ("Data of feit eerst", "\u2713 BELASTBAAR \u2192 conclusie \u2192 reden", "ok"),
    ("Maximaal \u00e9\u00e9n zakelijke conclusie", "\u2713", "ok"),
    ("Verdieping achter doorklikken", "\u2713 \u201eWaarom dit zo is?\u201d accordion", "ok"),
    ("Geen lange coachende tekstblokken", "\u2713", "ok"),
    ("Geen zichtbare personificatie", "\u2713", "ok"),
    ("\u201eVraag Sparki\u201d nergens zichtbaar", "\u2713", "ok"),
    ("\u201eAnalyse openen\u201d \u2014 functionele naam (W2D)", "\u2713", "ok"),
    ("\u201eMateriaal beoordelen\u201d \u2014 functionele naam (W2D)", "\u2713", "ok"),
    ("Gemeten/Berekend/Advies/Richtlijn onderscheid", "\u26a0 Niet ge\u00efmplementeerd (bestaande gap)", "warn"),
]
for label, result, st in comm:
    pdf.table_row([(label, 108), (result, 74)], ["", st])

# ══════════════════════════════════════════════════════════════════════════════
pdf.section_title("7.", "W0-STATUS \u2014 NIEUWE DATA-TRUST REGRESSIES DOOR W2")

pdf.body(
    "Alle W2-wijzigingen zijn uitsluitend presentationeel of puur labeltekst. "
    "Geen nieuwe endpoints, geen nieuwe hooks, geen nieuwe hardcoded persoonlijke waarden, "
    "geen nieuwe fallbackdata als persoonlijk resultaat, geen wijziging in welke gebruiker wordt opgehaald, "
    "geen nieuwe lege toestand die voorbeelddata toont."
)
pdf.ln(2)

pdf.set_fill_color(235, 250, 242)
pdf.set_draw_color(*GREEN_TXT)
pdf.set_line_width(0.3)
y = pdf.get_y()
pdf.rect(14, y, 182, 7, style="D")
pdf.set_x(16)
pdf.set_font("Helvetica", "B", 9)
pdf.set_text_color(*GREEN_TXT)
pdf.cell(0, 7, "\u2713  Geen nieuwe data-trust regressies geconstateerd door W2")
pdf.ln(10)

pdf.set_font("Helvetica", "", 8)
pdf.set_text_color(*DARK)
wijzigingen = [
    ("CommercialToday layout", "CSS grid-wijziging, geen nieuwe data-fetch"),
    ("day-home.tsx wrapper-divs", "Verwijderd, geen nieuwe hooks"),
    ("meerijder-nudge.tsx", "mt-6 spacing-prop toegevoegd, geen data"),
    ("maintenance-signals.tsx", "className-prop toegevoegd, geen data"),
    ("main-menu.tsx", "UI-label \u201eVraag Sparki\u201d \u2192 \u201eAnalyse openen\u201d"),
    ("material-coach.tsx", "UI-label \u201eVraag Sparki\u201d \u2192 \u201eMateriaal beoordelen\u201d"),
    ("training-day-home.tsx", "HumorLine-component verwijderd"),
]
for file, detail in wijzigingen:
    pdf.set_x(14)
    pdf.set_text_color(*GREY)
    pdf.cell(68, 5, file)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 5, detail, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

# ══════════════════════════════════════════════════════════════════════════════
pdf.section_title("8.", "TESTS EN BUILD")

cols8 = [("Test / Build", 90), ("Uitkomst", 40), ("Score", 52)]
pdf.table_header(cols8)
tests = [
    ("test:day-type", "\u2713 PASS", "6/6", "ok"),
    ("test:mental", "\u2713 PASS", "15/15", "ok"),
    ("test:session-analysis", "\u2713 PASS", "13/13", "ok"),
    ("test:sessions-contract", "\u2713 PASS", "4/4", "ok"),
    ("Frontend TypeScript (tsc --noEmit)", "\u2713 Schoon", "exit 0", "ok"),
    ("API server esbuild", "\u2713 Schoon", "exit 0", "ok"),
    ("Frontend productiebuild #1", "\u2713 Schoon", "exit 0", "ok"),
    ("Frontend productiebuild #2", "\u2713 Schoon", "exit 0 (identiek)", "ok"),
]
for name, result, score, st in tests:
    pdf.table_row([(name, 90), (result, 40), (score, 52)], ["", st, ""])

# ══════════════════════════════════════════════════════════════════════════════
pdf.add_page()
pdf.section_title("SAMENVATTING", "W2-STATUS")

# Green block
pdf.set_fill_color(235, 250, 242)
pdf.set_draw_color(*GREEN_TXT)
pdf.set_line_width(0.5)
pdf.rect(14, pdf.get_y(), 182, 52, style="D")
pdf.set_x(16)
pdf.set_font("Helvetica", "B", 9)
pdf.set_text_color(*GREEN_TXT)
pdf.cell(0, 7, "GROEN \u2014 W2 volledig uitgevoerd", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
green_items = [
    "W2B lege ruimte onder CheckInChip \u2014 opgelost",
    "W2D \u201eVraag Sparki\u201d \u2192 functionele namen \u2014 overal doorgevoerd",
    "W2D HumorLine van primair Vandaag-oppervlak \u2014 verwijderd",
    "Alle builds en typechecks \u2014 schoon",
    "4 testsuites (38 tests) \u2014 allemaal groen",
    "Geen nieuwe data-trust regressies van W2",
]
pdf.set_font("Helvetica", "", 8.5)
for item in green_items:
    pdf.set_x(18)
    pdf.set_text_color(*GREEN_TXT)
    pdf.cell(5, 5.5, "\u2713")
    pdf.set_text_color(*DARK)
    pdf.cell(0, 5.5, item, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.ln(6)

# Amber block
pdf.set_fill_color(255, 251, 235)
pdf.set_draw_color(*AMBER)
pdf.set_line_width(0.5)
y = pdf.get_y()
pdf.rect(14, y, 182, 38, style="D")
pdf.set_x(16)
pdf.set_font("Helvetica", "B", 9)
pdf.set_text_color(*AMBER)
pdf.cell(0, 7, "OPENSTAAND \u2014 v\u00f3\u00f3r W2-akkoord", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
open_items = [
    ("W2A desktop twee-kolom",
     "Code klopt, vlag OFF voor testgebruiker. Zichtbaar zodra commercial_shell aan staat op Ren\u00e9\u2019s account."),
    ("Training toevoegen \u2014 stille actie",
     "Bestaand defect. Task #294 aangemaakt. Geen W2-regressie."),
    ("Training toevoegen \u2014 foutmelding ontbreekt",
     "Bestaand defect. Gedekt door task #294."),
]
pdf.set_font("Helvetica", "", 8.5)
for title, detail in open_items:
    pdf.set_x(18)
    pdf.set_text_color(*AMBER)
    pdf.cell(5, 5.5, "\u26a0")
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(*DARK)
    pdf.cell(50, 5.5, title)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(0, 5.5, detail, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.ln(6)

# Footer
pdf.set_draw_color(*RULE)
pdf.set_line_width(0.2)
pdf.line(14, pdf.get_y(), 196, pdf.get_y())
pdf.ln(3)
pdf.set_font("Helvetica", "", 7.5)
pdf.set_text_color(*GREY)
pdf.cell(0, 5,
    f"Sparki HERSTELPLAN v1.0 \u00b7 W2 Acceptatierapport \u00b7 {datetime.date.today().strftime('%d %B %Y')} \u00b7 Vertrouwelijk",
    align="C")

# ── Save ──────────────────────────────────────────────────────────────────────
out = "reports/W2_Acceptatierapport_Sparki.pdf"
import os
os.makedirs("reports", exist_ok=True)
pdf.output(out)
print(f"OK:{out}")
