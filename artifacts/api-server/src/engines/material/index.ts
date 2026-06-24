// Materiaalcoach engine.
//
// Owns photo-driven equipment & nutrition analysis: the category registry (which
// relevant material/nutrition questions Sparki may ask), the honest vision-based
// analysis (explicit confidence, asks for an extra photo when unsure), and the
// DIY-vs-professional cost estimate for material cases. Consumed by the material
// route. Real uploads only — never mock data, never fabricated findings.

export {
  MATERIAL_CATEGORIES,
  getCategory,
  normalizeMediaType,
  analyzeMaterial,
} from "../../lib/material/analyze";
export type {
  MaterialCategory,
  MaterialKind,
  MaterialPhotoInput,
  MaterialAnalysisResult,
  ImageMediaType,
} from "../../lib/material/analyze";

export {
  uploadMaterialPhoto,
  readMaterialPhotoBase64,
  streamMaterialPhoto,
} from "../../lib/material/storage";
export type { StoredPhotoInput } from "../../lib/material/storage";

export {
  evaluateMaterialNudge,
  ensureMaterialNudgeNotification,
} from "../../lib/material/nudge";
export type {
  MaterialNudge,
  MaterialNudgeCategory,
  EnsuredMaterialNudge,
} from "../../lib/material/nudge";
