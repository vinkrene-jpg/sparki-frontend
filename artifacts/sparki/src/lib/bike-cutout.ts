// Achtergrond verwijderen — client-side met @imgly/background-removal (WASM,
// draait volledig in de browser; er gaat geen beeld naar een externe dienst).
// Het origineel blijft altijd bewaard; dit levert een LOSSE vrijstaande PNG.

let modulePromise: Promise<typeof import("@imgly/background-removal")> | null = null

function loadModule() {
  if (!modulePromise) modulePromise = import("@imgly/background-removal")
  return modulePromise
}

// Warm het model alvast op (groot bestand) zodat de eerste opname niet wacht.
export function preloadBackgroundRemoval(): void {
  void loadModule().catch(() => {
    // Stil: bij echte verwijdering tonen we de eerlijke foutmelding.
  })
}

export async function removeBackgroundToPngBase64(
  input: Blob,
): Promise<string> {
  const mod = await loadModule()
  const result = await mod.removeBackground(input, {
    output: { format: "image/png" },
  })
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Kon het vrijstaande beeld niet lezen"))
    reader.readAsDataURL(result)
  })
  const base64 = dataUrl.split(",")[1] ?? ""
  if (!base64) throw new Error("Achtergrond verwijderen is niet gelukt")
  return base64
}
