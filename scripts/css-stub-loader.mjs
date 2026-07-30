// Node ESM-loader die .css-imports vervangt door een leeg module. Nodig voor
// node-page-tests van componenten die (voor Vite) een css-bestand importeren
// (bv. leaflet/dist/leaflet.css) — node:test kan geen css laden en
// mock.module() grijpt niet vroeg genoeg in de loader-keten in.
export async function load(url, context, nextLoad) {
  if (url.split("?")[0].endsWith(".css")) {
    return { format: "module", source: "export default {};", shortCircuit: true };
  }
  return nextLoad(url, context);
}
