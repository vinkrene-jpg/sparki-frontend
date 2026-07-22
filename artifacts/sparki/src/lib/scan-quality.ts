// Deterministische beeldkwaliteitschecks voor de begeleide fietsscan.
//
// Alle functies zijn puur en werken op grijswaarden-buffers zodat ze zonder
// browser testbaar zijn. Er wordt niets "geschat" door een model: dit zijn
// klassieke, uitlegbare metingen (luminantie, Laplacian-variantie,
// frame-verschil, kadervulling via randdichtheid).

export type QualityMeasurement = {
  brightness: number; // 0..1 gemiddelde luminantie
  sharpness: number; // Laplacian-variantie (hoger = scherper)
  motion: number; // 0..1 aandeel sterk gewijzigde pixels t.o.v. vorig frame
  coverage: number; // 0..1 aandeel van het kader met onderwerp-detail
};

export type QualityVerdict = {
  ok: boolean;
  // Eén concrete, klare-taal herinstructie wanneer het beeld onvoldoende is.
  instruction: string | null;
};

// Drempels — bewust ruim gekozen zodat normale binnen-opnames slagen, maar
// donkere, bewogen of lege beelden eerlijk worden afgekeurd.
export const QUALITY_LIMITS = {
  minBrightness: 0.16,
  maxBrightness: 0.93,
  minSharpness: 28,
  maxMotion: 0.28,
  minCoverage: 0.06,
} as const;

// RGBA → grijswaarden (0..255) op de aangeleverde afmetingen.
export function toGray(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    gray[i] = 0.299 * rgba[o]! + 0.587 * rgba[o + 1]! + 0.114 * rgba[o + 2]!;
  }
  return gray;
}

export function measureBrightness(gray: Float32Array): number {
  if (gray.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i]!;
  return sum / gray.length / 255;
}

// Laplacian-variantie: standaard scherptemaat. Onscherpe beelden hebben
// nauwelijks tweede-orde-verschillen.
export function measureSharpness(
  gray: Float32Array,
  width: number,
  height: number,
): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        gray[i - 1]! + gray[i + 1]! + gray[i - width]! + gray[i + width]! -
        4 * gray[i]!;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

// Bewegingsmaat: aandeel pixels dat ≥ threshold verschilt van vorig frame.
export function measureMotion(
  gray: Float32Array,
  prevGray: Float32Array | null,
  threshold = 22,
): number {
  if (!prevGray || prevGray.length !== gray.length || gray.length === 0) return 0;
  let changed = 0;
  for (let i = 0; i < gray.length; i++) {
    if (Math.abs(gray[i]! - prevGray[i]!) >= threshold) changed++;
  }
  return changed / gray.length;
}

// Kadervulling: aandeel pixels met lokaal contrast (randdichtheid). Een leeg
// kader (muur/vloer) heeft nauwelijks randen; een fiets vult het kader met
// buizen, spaken en kabels. Dit is een eerlijke benadering — geen
// objectherkenning, dus zo wordt het in de UI ook benoemd ("detail in beeld").
export function measureCoverage(
  gray: Float32Array,
  width: number,
  height: number,
  edgeThreshold = 18,
): number {
  if (width < 2 || height < 2) return 0;
  let edges = 0;
  let n = 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = y * width + x;
      const gx = Math.abs(gray[i]! - gray[i + 1]!);
      const gy = Math.abs(gray[i]! - gray[i + width]!);
      if (gx + gy >= edgeThreshold) edges++;
      n++;
    }
  }
  return edges / n;
}

export function measureFrame(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  prevGray: Float32Array | null,
): { quality: QualityMeasurement; gray: Float32Array } {
  const gray = toGray(rgba, width, height);
  return {
    gray,
    quality: {
      brightness: measureBrightness(gray),
      sharpness: measureSharpness(gray, width, height),
      motion: measureMotion(gray, prevGray),
      coverage: measureCoverage(gray, width, height),
    },
  };
}

// Beoordeel een meting en geef bij afkeuring precies één herinstructie in
// klare taal — de meest beperkende afwijzing eerst.
export function judgeQuality(
  q: QualityMeasurement,
  limits = QUALITY_LIMITS,
): QualityVerdict {
  if (q.brightness < limits.minBrightness) {
    return { ok: false, instruction: "Te donker — zoek meer licht of ga dichter bij een raam staan." };
  }
  if (q.brightness > limits.maxBrightness) {
    return { ok: false, instruction: "Te licht — vermijd direct tegenlicht of een lamp in beeld." };
  }
  if (q.motion > limits.maxMotion) {
    return { ok: false, instruction: "Beweeg langzamer — houd je telefoon even stil." };
  }
  if (q.sharpness < limits.minSharpness) {
    return { ok: false, instruction: "Onscherp beeld — houd je telefoon stil en wacht tot de camera scherpstelt." };
  }
  if (q.coverage < limits.minCoverage) {
    return { ok: false, instruction: "Weinig detail in beeld — plaats de fiets volledig binnen het kader en ga iets dichterbij." };
  }
  return { ok: true, instruction: null };
}
