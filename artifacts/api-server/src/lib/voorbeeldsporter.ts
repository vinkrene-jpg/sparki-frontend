// Voorbeeldsporter (ANALYSE_UITBREIDING_EN_ZANDBAK_01 §5.1).
//
// Eén volledig gevulde, FICTIEVE sporter met een jaar aan gegenereerde data,
// bedoeld om de analysemodule te kunnen beoordelen en een nieuwe gebruiker te
// laten zien wat hij krijgt. Regels (bindend):
// - duidelijk gemarkeerd als voorbeeld — nooit te verwarren met eigen data;
// - nooit te koppelen aan een echte gebruiker (gereserveerd clerkId + .invalid
//   e-maildomein, dat Clerk nooit kan uitgeven);
// - gegenereerd door een herhaalbaar script met vaste startwaarde
//   (scripts/seed-voorbeeldsporter.ts).

export const VOORBEELD_CLERK_ID = "voorbeeld_sporter";
export const VOORBEELD_EMAIL = "voorbeeldsporter@voorbeeld.invalid";
export const VOORBEELD_NAAM = "Voorbeeldsporter (fictief)";

/** Is dit account de voorbeeldsporter? (voor de zichtbare markering) */
export function isVoorbeeldSporter(clerkId: string | null | undefined): boolean {
  return clerkId === VOORBEELD_CLERK_ID;
}
