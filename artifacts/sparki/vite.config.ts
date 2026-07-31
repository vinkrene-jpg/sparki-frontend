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

  return {
    base: basePath,
    define: {
      __SPARKI_BUILD_SHA__: JSON.stringify(buildSha),
    },
    plugins: [
      react(),
      tailwindcss({ optimize: false }),
      runtimeErrorOverlay(),
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
