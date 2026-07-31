// Serveert de PRODUCTIEBUILD van de webapp (artifacts/sparki/dist/public) met
// SPA-fallback en proxyt /api/* naar de draaiende api-server (127.0.0.1:80).
// Nodig omdat de dev-server ALTIJD DevPreview rendert — echte-router-bewijs
// kan alleen tegen een productiebuild (zie e2e/README.md).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../artifacts/sparki/dist/public",
);
const API_TARGET = process.env.E2E_API_TARGET ?? "http://127.0.0.1:80";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

export async function startProdServer() {
  if (!existsSync(path.join(ROOT, "index.html"))) {
    throw new Error(
      `Productiebuild ontbreekt (${ROOT}). Draai eerst: cd artifacts/sparki && PORT=5000 BASE_PATH=/ pnpm run build`,
    );
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      if (url.pathname.startsWith("/api/")) {
        // Proxy naar de echte api-server; headers/cookies 1-op-1 doorgeven.
        const headers = { ...req.headers };
        delete headers.host;
        delete headers.connection;
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const upstream = await fetch(`${API_TARGET}${req.url}`, {
          method: req.method,
          headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
          redirect: "manual",
        });
        const outHeaders = {};
        upstream.headers.forEach((v, k) => {
          // fetch() decomprimeert het antwoord al: content-encoding én
          // content-length beschrijven de gecomprimeerde variant en zouden
          // het browserantwoord afkappen — beide weglaten (Node zet zelf een
          // kloppende content-length op de ontpakte bytes).
          if (
            k !== "set-cookie" &&
            k !== "content-encoding" &&
            k !== "content-length" &&
            k !== "transfer-encoding"
          )
            outHeaders[k] = v;
        });
        const setCookies = upstream.headers.getSetCookie?.() ?? [];
        res.writeHead(upstream.status, { ...outHeaders, ...(setCookies.length ? { "set-cookie": setCookies } : {}) });
        res.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end();
        return;
      }
      let data;
      try {
        data = await readFile(filePath);
      } catch {
        // SPA-fallback
        filePath = path.join(ROOT, "index.html");
        data = await readFile(filePath);
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(err));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}
