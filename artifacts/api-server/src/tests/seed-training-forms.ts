// Eenmalige/idempotente runner voor de F1-startvulling (TRV-27).
import { seedTrainingForms } from "../lib/training-forms-seed";

seedTrainingForms()
  .then((r) => {
    console.log(`Startvulling klaar: ${r.inserted} toegevoegd, ${r.skipped} bestonden al.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Startvulling mislukt:", err);
    process.exit(1);
  });
