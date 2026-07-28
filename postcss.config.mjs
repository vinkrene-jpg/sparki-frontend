/**
 * Stale Next.js-era config neutralized: the Vite apps (sparki, mockup-sandbox)
 * use @tailwindcss/vite; '@tailwindcss/postcss' is not installed. Vite climbs
 * up to this root config, so it must not reference missing plugins.
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {},
}

export default config
