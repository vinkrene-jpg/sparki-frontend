// TRAININGSVORMEN_01 — zichtbaarheidsregel voor trainingsvormen, gedeeld door
// de vormenbibliotheek (routes/training-forms) en het plaatsen op schemaplekken
// (routes/plan-slots). Eén regel, overal dezelfde uitkomst:
//   - Sparki-vormen: zichtbaar zodra gepubliceerd;
//   - eigen vormen: altijd zichtbaar voor de eigenaar;
//   - andermans vormen: alleen gepubliceerd én (marktplaats, of privé met een
//     geaccepteerde directe trainer-sporterrelatie met de eigenaar).

import { trainingFormsTable } from "@workspace/db";
import { hasAcceptedCoachLink } from "../sharing";

export async function formVisibleTo(
  form: typeof trainingFormsTable.$inferSelect,
  clerkId: string,
): Promise<boolean> {
  if (form.eigenaarType === "sparki") return form.status === "gepubliceerd";
  if (form.eigenaarClerkId === clerkId) return true;
  if (form.status !== "gepubliceerd") return false;
  if (form.zichtbaarheid === "marktplaats") return true;
  if (form.zichtbaarheid === "prive" && form.eigenaarClerkId) {
    return hasAcceptedCoachLink(form.eigenaarClerkId, clerkId);
  }
  return false;
}
