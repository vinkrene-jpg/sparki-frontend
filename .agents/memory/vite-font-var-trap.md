---
name: Vite font loading — Next.js CSS variable trap
description: Why font-family falls back to browser serif in Vite when migrated from Next.js, and how to fix it.
---

## The rule
Never use `var(--font-geist-sans)` or `var(--font-geist-mono)` in Vite projects. These CSS custom properties are injected by Next.js's `next/font` loader at build time and do not exist in Vite.

## Why it breaks
When a `var()` references an undefined custom property with no fallback argument (e.g. `var(--font-geist-sans)` — no comma-fallback inside the `var()`), CSS treats the entire `font-family` declaration as invalid at computed-value time. The property takes its inherited/initial value, which for the root element is the browser default — usually a **serif** font like Times New Roman. This silently breaks every element using `font-sans` in Tailwind without any console error.

## How to apply
In any Vite project migrated from Next.js:
1. Install the font via npm: `pnpm add @fontsource-variable/inter` (or whichever font)
2. Import it at the top of `main.tsx`: `import "@fontsource-variable/inter"`
3. Set `--font-sans` in `index.css` directly: `'Inter Variable', 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif`
4. Remove the `var(--font-geist-sans)` reference entirely
5. Remove any Google Fonts `<link>` tags (self-hosted is more reliable in Replit's proxied iframe)
