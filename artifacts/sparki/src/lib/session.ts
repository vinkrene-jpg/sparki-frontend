// Per-app-open session id. Generated fresh on each full app load (a login or a
// reload) and stable for the rest of that visit. Sparki uses it to vary how the
// real analyses and feeds are ordered each visit — never the numbers, only the
// presentation — so the app feels fresh every time you come back.
export const SESSION_ID: string = (() => {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  try {
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  } catch {
    /* fall through to the manual id */
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
})();
