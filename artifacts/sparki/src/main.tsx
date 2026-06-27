import "@fontsource-variable/inter";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker that powers Web Push (profile nudges + reminders
// on the phone lock screen). Scoped to the app base path so deep links resolve
// correctly under a path prefix. Failures are silent — push is always optional
// and never blocks the app.
if ("serviceWorker" in navigator) {
  const base = import.meta.env.BASE_URL || "/";
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .catch(() => undefined);
  });
}
