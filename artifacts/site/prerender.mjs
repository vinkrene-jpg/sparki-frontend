// ── Prerender (MKT-18) ───────────────────────────────────────────────────────
// Draait ná `vite build` (client) en `vite build --ssr` (server). Rendert elke
// route naar statische HTML in dist/public/<route>/index.html zodat de site
// zonder JavaScript leesbaar is en zoekmachines per pagina titel + beschrijving
// zien. De client hydrateert daarna gewoon (main.tsx).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'dist/public');

const ROUTES = [
  '/',
  '/sporters',
  '/professionals',
  '/renner',
  '/renner-met-plan',
  '/ouder',
  '/trainer',
  '/club',
  '/clubtrainer',
  '/team',
  '/ploegleider',
  '/staf',
  '/specialist',
  '/prijzen/sporters',
  '/prijzen/professionals',
  '/faq',
];

const { render } = await import(
  path.join(here, 'dist/server/entry-server.js')
);
const template = await readFile(path.join(publicDir, 'index.html'), 'utf8');

const esc = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

let failures = 0;
for (const route of ROUTES) {
  const { html, title, description } = render(route);
  if (!html || !title || !description) {
    console.error(`FOUT: lege render/meta voor ${route}`);
    failures++;
    continue;
  }
  let page = template.replace(
    '<div id="root"></div>',
    `<div id="root">${html}</div>`,
  );
  page = page.replace(
    /<title>[^<]*<\/title>/,
    `<title>${esc(title)} — Sparki</title>`,
  );
  const metaTag = `<meta name="description" content="${esc(description)}" />`;
  page = page.includes('name="description"')
    ? page.replace(/<meta name="description"[^>]*>/, metaTag)
    : page.replace('</title>', `</title>\n    ${metaTag}`);

  const outDir =
    route === '/' ? publicDir : path.join(publicDir, route.slice(1));
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'index.html'), page);
  console.log(`prerendered ${route} — "${title}"`);
}

if (failures > 0) {
  console.error(`Prerender FAALDE voor ${failures} route(s).`);
  process.exit(1);
}
