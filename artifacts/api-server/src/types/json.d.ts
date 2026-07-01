// Allow importing bundled *.json data files without enabling resolveJsonModule
// (which would make tsc parse and type-infer large literals). esbuild inlines
// the real JSON at build time; here it is typed as `unknown` and narrowed at the
// use site.
declare module "*.json" {
  const value: unknown;
  export default value;
}
