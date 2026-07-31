// Regressietest (taak #519, reviewronde): een routegeneratie die onder oude
// criteria is gestart mag zijn uitkomst nooit meer tonen nadat de rijder de
// criteria wijzigde of opnieuw zocht — resultaten horen bij precies één
// criteria-set (zoeklaag-regel).
import assert from "node:assert/strict";
import { test } from "node:test";

import { createAanvraagSessies } from "./route-aanvraag-state";

test("uitkomst van een verouderde generatie landt nooit (criteria gewijzigd + nieuwe zoekopdracht)", () => {
  const sessies = createAanvraagSessies();

  // Zoekopdracht A: geen bruikbare bekende route ⇒ generatie A start async.
  const tokenA = sessies.nieuweSessie();
  assert.equal(sessies.isActueel(tokenA), true);

  // Rijder wijzigt afstand/hoogte: resultaten gewist, sessie ongeldig.
  sessies.invalideer();
  assert.equal(sessies.isActueel(tokenA), false);

  // Zoekopdracht B met andere criteria (vindt wél bruikbare bekende routes).
  const tokenB = sessies.nieuweSessie();
  assert.equal(sessies.isActueel(tokenB), true);

  // Generatie A wordt nu pas klaar: haar token is niet meer actueel ⇒ het
  // scherm mag voorstellen/fout/fase van A niet toepassen of tonen.
  assert.equal(sessies.isActueel(tokenA), false);

  // Ook een latere expliciete generatie binnen sessie B blijft geldig…
  assert.equal(sessies.isActueel(tokenB), true);
  // …tot er opnieuw gezocht wordt.
  const tokenC = sessies.nieuweSessie();
  assert.equal(sessies.isActueel(tokenB), false);
  assert.equal(sessies.isActueel(tokenC), true);
});

test("token 0 (geen sessie) is nooit actueel", () => {
  const sessies = createAanvraagSessies();
  assert.equal(sessies.isActueel(0), false);
  sessies.nieuweSessie();
  assert.equal(sessies.isActueel(0), false);
});
