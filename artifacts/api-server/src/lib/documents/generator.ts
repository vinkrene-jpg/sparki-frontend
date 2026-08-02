// HERSTEL_EN_AANVULLING_01 F4 (HA-16…HA-21) — de ÉNE documentgenerator.
//
// Bindend: er is precies één PDF-engine in het hele product (HA-18/HA-43).
// Elke uitdraai — dagschema, wedstrijdbezetting, materiaallijst en alle
// latere rapporttypen — loopt door deze laag. Geen tweede PDF-bibliotheek,
// niets hardcoded in de frontend.
//
// Ontwerp volgt REPORT_DESIGN_STANDARD_01 / SPARKI_REPORT_CONTENT_RULES:
//   • TPL-05 (operationele dagstukken): groot lettertype, zwart-wit,
//     printbaar, leesbaar in de auto; GEEN AI-tekst (RCR-26/BLK-11).
//   • Versienummer prominent; classificatie in de voettekst.
//   • Ontbrekende gegevens worden benoemd, niet gladgestreken (RCR-05).
//   • Merktoepassing (HA-20): merklocatie is gereserveerd in de koptekst met
//     het huidige productiewoordmerk ("SPARKI"); de definitieve merkuitvoering
//     wacht op het merkbesluit en blokkeert deze laag niet.

import PDFDocument from "pdfkit";

export type DocClassificatie = "intern" | "vertrouwelijk" | "openbaar";

export type DocKop = {
  /** Rapporttype-code, bv. "RT-12". */
  code: string;
  titel: string;
  /** Evenement/onderwerp-regel onder de titel. */
  onderwerp: string;
  datum: string; // YYYY-MM-DD (Amsterdam)
  versie: number;
  classificatie: DocClassificatie;
  /** Naam van de opsteller (functie), bv. "Ploegleider". */
  opgesteldDoor: string;
};

export type DocTabel = {
  kop?: string;
  kolommen: string[];
  rijen: string[][];
  /** Relatieve kolombreedtes; default gelijk verdeeld. */
  breedtes?: number[];
};

export type DocBlok =
  | { soort: "tabel"; tabel: DocTabel }
  | { soort: "tekst"; kop?: string; tekst: string }
  | { soort: "lijst"; kop?: string; items: string[] }
  /** RCR-05: expliciet gat — wordt zichtbaar benoemd, nooit gladgestreken. */
  | { soort: "ontbreekt"; tekst: string };

const MARGE = 48;
const ZWART = "#111111";
const GRIJS = "#555555";
const LIJN = "#999999";

/**
 * Rendert één document naar een PDF-buffer. TPL-05-uitgangspunten: A4,
 * zwart-wit, groot lettertype (basis 11pt, tabellen 10pt), duidelijke
 * versie-/wijzigingsvermelding. Deterministisch: zelfde invoer ⇒ zelfde
 * inhoud (behalve het gegenereerd-op-tijdstip in de voettekst).
 */
export async function renderDocument(kop: DocKop, blokken: DocBlok[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGE, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const klaar = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const breedte = doc.page.width - 2 * MARGE;

  // ── Koptekst: merklocatie + type + versie prominent ────────────────────────
  doc.fillColor(ZWART).font("Helvetica-Bold").fontSize(13).text("SPARKI", MARGE, MARGE - 8);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(GRIJS)
    .text(`${kop.code} · versie ${kop.versie}`, MARGE, MARGE - 6, { width: breedte, align: "right" });
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(18).fillColor(ZWART).text(kop.titel, { width: breedte });
  doc.font("Helvetica").fontSize(12).fillColor(ZWART).text(kop.onderwerp, { width: breedte });
  doc
    .fontSize(10)
    .fillColor(GRIJS)
    .text(`Datum ${kop.datum} · opgesteld door ${kop.opgesteldDoor} · VERSIE ${kop.versie}`, {
      width: breedte,
    });
  doc.moveTo(MARGE, doc.y + 6).lineTo(MARGE + breedte, doc.y + 6).strokeColor(LIJN).lineWidth(0.8).stroke();
  doc.y += 14;

  // ── Blokken ────────────────────────────────────────────────────────────────
  for (const blok of blokken) {
    if (doc.y > doc.page.height - 120) doc.addPage();
    if (blok.soort === "tekst") {
      if (blok.kop) sectieKop(doc, blok.kop, breedte);
      doc.font("Helvetica").fontSize(11).fillColor(ZWART).text(blok.tekst, { width: breedte });
      doc.moveDown(0.6);
    } else if (blok.soort === "lijst") {
      if (blok.kop) sectieKop(doc, blok.kop, breedte);
      doc.font("Helvetica").fontSize(11).fillColor(ZWART).list(blok.items, { width: breedte, bulletRadius: 1.6 });
      doc.moveDown(0.6);
    } else if (blok.soort === "ontbreekt") {
      doc.font("Helvetica-Oblique").fontSize(11).fillColor(ZWART).text(`Ontbreekt: ${blok.tekst}`, { width: breedte });
      doc.moveDown(0.6);
    } else {
      renderTabel(doc, blok.tabel, breedte);
    }
  }

  // ── Voettekst op elke pagina: classificatie + paginanummer ────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(GRIJS)
      .text(
        `${kop.classificatie.toUpperCase()} · ${kop.code} v${kop.versie} · pagina ${i - range.start + 1} van ${range.count}`,
        MARGE,
        doc.page.height - 36,
        { width: breedte, align: "center", lineBreak: false },
      );
  }

  doc.end();
  return klaar;
}

function sectieKop(doc: PDFKit.PDFDocument, tekst: string, breedte: number) {
  doc.font("Helvetica-Bold").fontSize(12.5).fillColor(ZWART).text(tekst, { width: breedte });
  doc.moveDown(0.25);
}

function renderTabel(doc: PDFKit.PDFDocument, tabel: DocTabel, breedte: number) {
  if (tabel.kop) sectieKop(doc, tabel.kop, breedte);
  const n = tabel.kolommen.length;
  const rel = tabel.breedtes && tabel.breedtes.length === n ? tabel.breedtes : Array(n).fill(1);
  const totaal = rel.reduce((a, b) => a + b, 0);
  const widths = rel.map((r) => (r / totaal) * breedte);

  const rij = (cellen: string[], bold: boolean) => {
    const hoogte = Math.max(
      ...cellen.map((c, i) =>
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).heightOfString(c || "—", { width: widths[i]! - 8 }),
      ),
      14,
    );
    if (doc.y + hoogte > doc.page.height - 90) doc.addPage();
    const y0 = doc.y;
    let x = MARGE;
    cellen.forEach((c, i) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10)
        .fillColor(ZWART)
        .text(c || "—", x + 4, y0 + 3, { width: widths[i]! - 8 });
      x += widths[i]!;
    });
    doc
      .moveTo(MARGE, y0 + hoogte + 5)
      .lineTo(MARGE + breedte, y0 + hoogte + 5)
      .strokeColor(LIJN)
      .lineWidth(bold ? 0.9 : 0.4)
      .stroke();
    doc.x = MARGE;
    doc.y = y0 + hoogte + 8;
  };

  rij(tabel.kolommen, true);
  for (const r of tabel.rijen) rij(r, false);
  doc.moveDown(0.5);
}
