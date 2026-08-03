import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const devPlugins =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
    ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({
            root: path.resolve(import.meta.dirname, ".."),
          }),
        ),
        await import("@replit/vite-plugin-dev-banner").then((m) =>
          m.devBanner(),
        ),
      ]
    : [];

export default defineConfig(({ command }) => {
  const isServe = command === "serve";

  const rawPort = process.env.PORT;

  if (isServe && !rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort ?? "5173");

  if (isServe && (Number.isNaN(port) || port <= 0)) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = process.env.BASE_PATH ?? "/";

  // Omgevingsidentificatie: bak de commit-SHA in de build zodat elke
  // niet-productieomgeving (DEV Preview) hem zichtbaar kan tonen en
  // testbewijs altijd aan een commit te koppelen is.
  let buildSha = "onbekend";
  try {
    buildSha = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // Workflow-omgevingen hebben git niet altijd op PATH — lees dan .git/HEAD
    // rechtstreeks (zelfde waarheid, geen fabricage). Blijft anders "onbekend".
    try {
      const gitDir = path.resolve(import.meta.dirname, "../../.git");
      const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
      const sha = head.startsWith("ref: ")
        ? fs.readFileSync(path.join(gitDir, head.slice(5)), "utf8").trim()
        : head;
      if (/^[0-9a-f]{40}$/.test(sha)) buildSha = sha.slice(0, 8);
    } catch {
      /* eerlijk "onbekend" */
    }
  }

  // Eén mobiele waarheid (besluit 01-08-2026): elke build schrijft version.json
  // met de echte commit-SHA zodat de app zichzelf kan vergelijken met de server
  // en een nieuwe release zichtbaar kan aanbieden. In dev serveert een
  // middleware dezelfde vorm en krijgt het manifest een DEV-naam, zodat een
  // per ongeluk vanuit de ontwikkelomgeving geïnstalleerde PWA herkenbaar is.
  const versionPlugin = {
    name: "sparki-version-truth",
    closeBundle() {
      const outDir = path.resolve(import.meta.dirname, "dist/public");
      try {
        fs.writeFileSync(
          path.join(outDir, "version.json"),
          JSON.stringify({
            sha: buildSha,
            builtAt: new Date().toISOString(),
            environment: process.env.NODE_ENV === "production" ? "production" : "development",
            service: "web",
          }),
        );
      } catch {
        /* build faalt hier niet op; ontbrekend version.json is eerlijk "onbekend" */
      }
    },
    configureServer(server: {
      middlewares: {
        use: (
          fn: (
            req: { url?: string },
            res: {
              setHeader: (k: string, v: string) => void;
              end: (b: string) => void;
            },
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? "").split("?")[0] === `${basePath}version.json`) {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify({ sha: buildSha, dev: true }));
          return;
        }
        next();
      });
    },
    transformIndexHtml(html: string, ctx: { server?: unknown }) {
      if (!ctx.server) return html; // productie: standaardmanifest
      return html.replace(
        '<link rel="manifest" href="/manifest.webmanifest" />',
        '<link rel="manifest" href="/manifest-dev.webmanifest" />',
      );
    },
  };

  return {
    base: basePath,
    define: {
      __SPARKI_BUILD_SHA__: JSON.stringify(buildSha),
      // Acceptatiemodus (TESTDEPLOY_SYNC_01): alleen true wanneer de build in de
      // toetsomgeving met SPARKI_ACCEPT_MODE=true is gemaakt; de publicatiebuild
      // heeft die variabele niet en bakt dus false in.
      __SPARKI_ACCEPT_MODE__: JSON.stringify(
        (() => {
          const accept = process.env.SPARKI_ACCEPT_MODE === "true";
          // Harde guard (MUX_375-review): een acceptatiebuild mag nooit als
          // publicatiebuild dienen — die zou TESTCONTEXT/dev-preview publiek
          // tonen. In een deployment-buildomgeving breekt de build dan af.
          if (accept && process.env.REPLIT_DEPLOYMENT) {
            throw new Error(
              "SPARKI_ACCEPT_MODE=true is verboden in een publicatiebuild (REPLIT_DEPLOYMENT gezet).",
            );
          }
          return accept;
        })(),
      ),
    },
    plugins: [
      react(),
      tailwindcss({ optimize: false }),
      runtimeErrorOverlay(),
      versionPlugin,
      ...devPlugins,
    ],
    resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Behavior-neutral vendor splitting: heavy libraries used only on a few
        // screens (maps, charts, QR, animation) become their own cacheable
        // chunks so they no longer bloat the single main bundle. No lazy/Suspense
        // boundaries are introduced, so runtime behavior is unchanged.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "wouter"],
          "vendor-map": ["leaflet"],
          "vendor-charts": ["recharts"],
          "vendor-qr": ["qrcode.react"],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_SERVER_PORT ?? "8080"}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  };
});
