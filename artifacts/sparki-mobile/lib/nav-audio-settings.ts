// Persistente audio-instellingen voor navigatie (geluidssignalen + gesproken
// aanwijzingen). Bron van waarheid is /api/nav-settings (zelfde instellingen
// als op de webpagina Navigatie-instellingen); AsyncStorage is de lokale
// cache zodat de keuze ook offline en direct bij het openen geldt.
//
// De PUT vereist de volledige instellingen-vorm; daarom patchen we de
// opgehaalde instellingen (of eerlijke defaults die gelijk zijn aan wat het
// navigatiescherm nu al toont) en sturen het geheel terug.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";

const CACHE_KEY = "sparki:nav-audio";

type NavSettingsShape = {
  dataFields: string[];
  maxFields: number;
  fontSize: string;
  barPosition: string;
  headingUp: boolean;
  autoClimb: boolean;
  autoPois: boolean;
  autoSprint: boolean;
  soundCues?: boolean;
  voiceCues?: boolean;
};

// Zelfde defaults als de webpagina Navigatie-instellingen.
const DEFAULTS: NavSettingsShape = {
  dataFields: ["snelheid", "afstand", "resterend", "tijd"],
  maxFields: 4,
  fontSize: "normaal",
  barPosition: "boven",
  headingUp: false,
  autoClimb: true,
  autoPois: true,
  autoSprint: false,
  soundCues: true,
  voiceCues: true,
};

export type NavAudioPrefs = { soundCues: boolean; voiceCues: boolean };

export function useNavAudioPrefs(): {
  prefs: NavAudioPrefs;
  setSoundCues: (v: boolean) => void;
  setVoiceCues: (v: boolean) => void;
} {
  const [prefs, setPrefs] = useState<NavAudioPrefs>({
    soundCues: true,
    voiceCues: true,
  });

  useEffect(() => {
    let alive = true;
    // 1) Lokale cache: direct van kracht, ook offline.
    void AsyncStorage.getItem(CACHE_KEY).then((raw) => {
      if (!alive || !raw) return;
      try {
        const p = JSON.parse(raw) as Partial<NavAudioPrefs>;
        setPrefs((cur) => ({
          soundCues: typeof p.soundCues === "boolean" ? p.soundCues : cur.soundCues,
          voiceCues: typeof p.voiceCues === "boolean" ? p.voiceCues : cur.voiceCues,
        }));
      } catch {
        // corrupte cache negeren
      }
    });
    // 2) Server: bron van waarheid (zelfde instelling als op web).
    void customFetch<{ settings: NavSettingsShape | null }>("/api/nav-settings")
      .then((body) => {
        if (!alive || !body.settings) return;
        const next: NavAudioPrefs = {
          soundCues: body.settings.soundCues !== false,
          voiceCues: body.settings.voiceCues !== false,
        };
        setPrefs(next);
        void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
      })
      .catch(() => {
        // Offline: cache/defaults blijven gelden.
      });
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback((next: NavAudioPrefs) => {
    setPrefs(next);
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
    // Best-effort naar de server: bestaande instellingen ophalen, patchen,
    // geheel terugsturen (PUT valideert de volledige vorm).
    void customFetch<{ settings: NavSettingsShape | null }>("/api/nav-settings")
      .then((body) => {
        const base: NavSettingsShape = body.settings ?? DEFAULTS;
        return customFetch("/api/nav-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...base, ...next }),
        });
      })
      .catch(() => {
        // Offline: lokale keuze blijft staan; server volgt bij de volgende sync.
      });
  }, []);

  return {
    prefs,
    setSoundCues: useCallback((v: boolean) => persist({ ...prefs, soundCues: v }), [persist, prefs]),
    setVoiceCues: useCallback((v: boolean) => persist({ ...prefs, voiceCues: v }), [persist, prefs]),
  };
}
