// MUX_375_MEETBAARHEID_01 — onderdeel A: schermafdrukbewijs op een vaste breedte.
//
// Breedte is een PARAMETER (geen hardgecodeerde 375):
//   BREEDTE=375  node e2e/mux-375-shots.mjs
//   BREEDTE=1440 HOOGTE=900 node e2e/mux-375-shots.mjs
// Optioneel (shell-timeout chunking): ROLLEN="sporter,ouder" beperkt de set;
// de INDEX wordt dan aangevuld i.p.v. overschreven.
//
// Vereisten:
// - api-server draait op 127.0.0.1:80 (dev, met DEV_AUTH_BYPASS zodat de
//   fixture-identiteitsheader werkt — server blijft fail-closed richting prod);
// - acceptatiebuild aanwezig: cd artifacts/sparki &&
//     PORT=5000 BASE_PATH=/ SPARKI_ACCEPT_MODE=true pnpm run build
//   (bevroren productiebuild mét TESTCONTEXT-regel; de echte
//   productiepublicatie krijgt deze vlag nooit);
// - rolfixtures bestaan: bash scripts/governor/create-role-test-fixtures.sh
//
// Uitvoer: docs/ux/shots/<sha>/<breedte>/<rol>/<module>/<tab>-{fold,full}.png
// plus docs/ux/shots/<sha>/INDEX.md (één SHA per map).
import { execSync } from "node:child_process";
import { mkdirSync, appendFileSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { startProdServer } from "./serve-prod.mjs";

const BREEDTE = Number(process.env.BREEDTE);
if (!Number.isInteger(BREEDTE) || BREEDTE < 200)
  throw new Error("Zet BREEDTE=<pixels> (bv. 375 of 1440) — de breedte is een parameter.");
const HOOGTE = Number(process.env.HOOGTE ?? (BREEDTE < 800 ? 812 : 900));
const MOBIEL = BREEDTE < 800;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHA = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
const OUT = path.join(ROOT, "docs/ux/shots", SHA, String(BREEDTE));
const INDEX = path.join(ROOT, "docs/ux/shots", SHA, "INDEX.md");

// Rollen → vaste fixture-identiteit + modules (echte ingangen van die rol).
// Tabbladen binnen een module worden ter plekke ontdekt (role="tab" e.d.).
const ROLLEN = [
  { rol: "sporter", fixture: "governor-fixture-athlete-adult", rolWoord: "athlete", modules: { dashboard: "/dashboard", trainen: "/train", routes: "/routes", analyse: "/analyse", wedstrijd: "/races", profiel: "/you", meer: "/meer" } },
  { rol: "ouder", fixture: "governor-fixture-parent", rolWoord: "parent", modules: { kinderen: "/kinderen", dashboard: "/dashboard", meldingen: "/meldingen", toestemmingen: "/toestemmingen", meer: "/meer" } },
  { rol: "trainer", fixture: "governor-fixture-trainer-1", rolWoord: "coach", modules: { dashboard: "/", sporters: "/coach", koppelen: "/invitations", meer: "/meer" } },
  { rol: "hoofdtrainer", fixture: "governor-fixture-hoofdtrainer", rolWoord: "coach", modules: { rolstart: "/rol-start/hoofdtrainer", club: "/club", meer: "/meer" } },
  { rol: "clubbeheerder", fixture: "governor-fixture-clubbeheerder", rolWoord: "athlete", modules: { rolstart: "/rol-start/admin", clubbeheer: "/club/beheer", club: "/club", meer: "/meer" } },
  { rol: "ploegleider", fixture: "governor-fixture-ploegleider", rolWoord: "athlete", modules: { rolstart: "/rol-start/ploegleider", club: "/club", "wedstrijd-room": "/wedstrijd-room", meer: "/meer" } },
  { rol: "teammanager", fixture: "governor-fixture-teammanager", rolWoord: "athlete", modules: { rolstart: "/rol-start/teammanager", club: "/club", meer: "/meer" } },
  { rol: "mechanieker", fixture: "governor-fixture-mechanieker", rolWoord: "athlete", modules: { rolstart: "/rol-start/mechanieker", club: "/club", meer: "/meer" } },
  { rol: "soigneur", fixture: "governor-fixture-soigneur", rolWoord: "athlete", modules: { rolstart: "/rol-start/soigneur", club: "/club", meer: "/meer" } },
  { rol: "medical-staff", fixture: "governor-fixture-medical-staff", rolWoord: "athlete", modules: { rolstart: "/rol-start/medical_staff", club: "/club", meer: "/meer" } },
];

const filter = (process.env.ROLLEN ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const TE_DOEN = filter.length ? ROLLEN.filter((r) => filter.includes(r.rol)) : ROLLEN;

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const bevindingen = [];
const indexRegels = [];
let fouten = 0;

function tijd() {
  return new Date().toISOString();
}

async function schrijfShots(page, dir, tabNaam) {
  mkdirSync(dir, { recursive: true });
  const foldPad = path.join(dir, `${tabNaam}-fold.png`);
  const fullPad = path.join(dir, `${tabNaam}-full.png`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  // fold = exact het eerste scherm (viewportmaat, niet geschaald). Export in
  // CSS-pixels zodat de fold exact <breedte> px breed is (acceptatie 1);
  // gerenderd wordt wél op pixeldichtheid 2 (deviceScaleFactor in de context).
  await page.screenshot({ path: foldPad, fullPage: false, scale: "css" });
  await page.screenshot({ path: fullPad, fullPage: true, scale: "css" });
  return { foldPad, fullPad };
}

function noteer(rol, module, tab, paden) {
  for (const [soort, p] of Object.entries(paden)) {
    indexRegels.push(
      `| ${rol} | ${module} | ${tab} | ${soort === "foldPad" ? "fold" : "full"} | ${BREEDTE} | ${SHA} | ${tijd()} | ${path.relative(path.join(ROOT, "docs/ux/shots", SHA), p)} |`,
    );
  }
}

const { server, baseUrl } = await startProdServer();
const executablePath = execSync("which chromium").toString().trim();
const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

try {
  for (const wie of TE_DOEN) {
    const context = await browser.newContext({
      viewport: { width: BREEDTE, height: HOOGTE },
      deviceScaleFactor: 2,
      ...(MOBIEL ? { userAgent: MOBILE_UA, hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    try {
      // Fixture-identiteit zetten zoals de app dat zelf doet (localStorage →
      // x-dev-clerk-id via apiFetch; alleen geldig in dev/acceptatiebuild).
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      await page.evaluate((id) => window.localStorage.setItem("sparki.dev.previewAthlete", id), wie.fixture);
      await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      // Contextregel-bewijs: identiteit server-side + TESTCONTEXT zichtbaar.
      const me = await page.evaluate(async () => {
        const id = window.localStorage.getItem("sparki.dev.previewAthlete");
        const r = await fetch("/api/auth/me", { credentials: "include", headers: id ? { "x-dev-clerk-id": id } : {} });
        return { status: r.status, body: r.status === 200 ? await r.json() : null };
      });
      if (me.status !== 200 || me.body?.clerkId !== wie.fixture)
        throw new Error(`identiteit staat NIET: verwacht ${wie.fixture}, kreeg ${me.body?.clerkId ?? me.status}`);
      const banner = await page
        .locator("button", { hasText: "TESTCONTEXT" })
        .first()
        .innerText()
        .catch(() => "");
      if (!banner.includes("TESTCONTEXT"))
        throw new Error(
          "TESTCONTEXT-regel niet zichtbaar — is de acceptatiebuild (SPARKI_ACCEPT_MODE=true) gebouwd? Zonder contextregel is de afdruk geen geldig bewijs.",
        );
      // Review-aanscherping: de contextregel moet de ACTIEVE rol van deze
      // fixture noemen — anders bewijst de afdruk niet dat de juiste
      // rolcontext stond (dev-fallback-valkuil).
      if (!banner.toLowerCase().includes(wie.rolWoord))
        throw new Error(
          `contextregel mist rol "${wie.rolWoord}" voor ${wie.fixture}: "${banner}"`,
        );

      for (const [module, route] of Object.entries(wie.modules)) {
        const dir = path.join(OUT, wie.rol, module);
        try {
          await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
          await page.waitForTimeout(800);
          const paden = await schrijfShots(page, dir, "hoofd");
          noteer(wie.rol, module, "hoofd", paden);

          // Tabbladen binnen de module ontdekken en één voor één vastleggen.
          const tabs = page.locator('[role="tab"]:visible');
          const nTabs = await tabs.count();
          for (let i = 0; i < Math.min(nTabs, 12); i++) {
            const tab = tabs.nth(i);
            const naam = ((await tab.innerText().catch(() => `tab-${i + 1}`)) || `tab-${i + 1}`)
              .trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || `tab-${i + 1}`;
            await tab.click().catch(() => {});
            await page.waitForTimeout(600);
            const tPaden = await schrijfShots(page, dir, naam);
            noteer(wie.rol, module, naam, tPaden);
          }
        } catch (err) {
          fouten += 1;
          bevindingen.push(`FOUT ${wie.rol}/${module} (${route}): ${err?.message ?? err}`);
        }
      }

      // A5 — Academy hoort nog niet te bestaan (MEDIA_UITLEG_01 F8 = OPEN).
      await page.goto(`${baseUrl}/academy`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(500);
      const academyTekst = await page.locator("body").innerText().catch(() => "");
      if (/academy/i.test(academyTekst)) {
        const dir = path.join(OUT, wie.rol, "academy");
        const paden = await schrijfShots(page, dir, "bevinding");
        noteer(wie.rol, "academy", "bevinding", paden);
        bevindingen.push(
          `BEVINDING ${wie.rol}: /academy toont Academy-inhoud, maar MEDIA_UITLEG_01 F8 staat OPEN — dit hoort nog niet te bestaan.`,
        );
      }
      console.log(`✓ ${wie.rol} (${wie.fixture}) op ${BREEDTE}×${HOOGTE}`);
    } catch (err) {
      fouten += 1;
      bevindingen.push(`FOUT rol ${wie.rol}: ${err?.message ?? err}`);
      console.error(`✗ ${wie.rol}: ${err?.message ?? err}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

// INDEX.md aanvullen (één SHA per map; kop alleen bij eerste schrijf).
mkdirSync(path.dirname(INDEX), { recursive: true });
if (!existsSync(INDEX)) {
  writeFileSync(
    INDEX,
    `# Schermafdruk-index — SHA ${SHA}\n\nAlle afdrukken in deze map zijn gemaakt tegen commit \`${SHA}\` (op main).\n\n| rol | module | tabblad | soort | breedte | sha | tijdstip (UTC) | bestand |\n|---|---|---|---|---|---|---|---|\n`,
  );
} else if (!readFileSync(INDEX, "utf8").includes(SHA)) {
  throw new Error(`INDEX.md bestaat maar noemt een ANDERE SHA — één index per SHA-map.`);
}
appendFileSync(INDEX, indexRegels.join("\n") + "\n");
if (bevindingen.length) {
  appendFileSync(INDEX, `\n## Bevindingen (${tijd()}, breedte ${BREEDTE})\n\n` + bevindingen.map((b) => `- ${b}`).join("\n") + "\n");
}

console.log(`\nAfdrukken: ${OUT}`);
console.log(`Index: ${INDEX}`);
for (const b of bevindingen) console.log(b);
if (fouten > 0) {
  console.error(`\n${fouten} fout(en) — onvolledig bewijs.`);
  process.exit(1);
}
console.log("\nAlle rollen vastgelegd.");
