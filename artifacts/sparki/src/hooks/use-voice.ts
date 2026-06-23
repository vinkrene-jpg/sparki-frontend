import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

// Mirrors the api-server voice engine surface (GET /api/voice).

export type VoiceTone =
  | "observer"
  | "curious"
  | "dry_humor"
  | "cynical"
  | "supportive";

export type VoiceStyle = {
  tone: VoiceTone;
  label: string;
  line: string;
  unlocked: boolean;
};

export type VoiceTrust = {
  score: number;
  tier: "nieuw" | "kennismaking" | "vertrouwd" | "maat";
  tierLabel: string;
  tierBlurb: string;
  signals: {
    daysKnown: number;
    onboardingComplete: boolean;
    memoriesShared: number;
    followUpsAnswered: number;
    followUpsDismissed: number;
    positiveEvents: number;
    metricsLogged: number;
    friends: number;
  };
};

export type VoiceProfile = {
  trust: VoiceTrust;
  styles: VoiceStyle[];
  memoryHook: string | null;
  openLoop: string | null;
  empathy: string | null;
};

/** The athlete's live Sparki voice profile — real trust score + real examples. */
export function useVoiceProfile() {
  return useQuery({
    queryKey: queryKeys.voice.profile(),
    queryFn: () => apiFetch<VoiceProfile>("/api/voice"),
    staleTime: STALE.profile,
  });
}
