// Applicatieve versleuteling van externe toegangstokens en andere gevoelige
// secrets in de database (AES-256-GCM). Waarden krijgen het prefix
// "enc:v1:<iv>:<tag>:<ciphertext>" (base64url). Lezen is tolerant: een waarde
// zonder prefix is een legacy-plaintext token en wordt ongewijzigd
// teruggegeven, zodat bestaande verbindingen blijven werken; bij de
// eerstvolgende schrijfactie wordt hij automatisch versleuteld opgeslagen.
//
// Sleutelbeleid: SPARKI_TOKEN_KEY (32+ tekens) is de bron. In productie is die
// verplicht — zonder sleutel weigert de server tokens op te slaan (fail
// closed). In ontwikkeling wordt deterministisch een sleutel afgeleid van
// CLERK_SECRET_KEY/DATABASE_URL zodat dev zonder extra setup werkt.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";

function keyMaterial(): Buffer | null {
  const explicit = process.env.SPARKI_TOKEN_KEY;
  if (explicit && explicit.length >= 16) {
    return createHash("sha256").update(explicit).digest();
  }
  if (process.env.NODE_ENV === "production") return null;
  const devSeed = process.env.CLERK_SECRET_KEY || process.env.DATABASE_URL;
  if (!devSeed) return null;
  return createHash("sha256").update(`sparki-dev-token-key:${devSeed}`).digest();
}

export function tokenEncryptionConfigured(): boolean {
  return keyMaterial() != null;
}

/** Versleutel een gevoelige waarde. `null` blijft `null`. Faalt hard zonder sleutel. */
export function encryptSecret(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  const key = keyMaterial();
  if (!key) {
    throw new Error(
      "SPARKI_TOKEN_KEY ontbreekt: gevoelige tokens kunnen niet veilig worden opgeslagen",
    );
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`;
}

/** Ontsleutel; legacy plaintext (zonder prefix) passeert ongewijzigd. */
export function decryptSecret(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext
  const key = keyMaterial();
  if (!key) {
    throw new Error("SPARKI_TOKEN_KEY ontbreekt: token kan niet gelezen worden");
  }
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Ongeldig versleuteld token");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}
