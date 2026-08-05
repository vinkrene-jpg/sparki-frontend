import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ANALYSE §5.2 — Wat-als: een blok doorrekenen met hetzelfde belastingsmodel.
// De uitkomst is ALTIJD een berekening, nooit een voorspelling.

export type WatAlsPunt = { date: string; ctl: number; atl: number; tsb: number; tss: number };
export type WatAlsData = {
  soort: "berekening";
  start: { ctl: number; atl: number; tsb: number };
  verloop: WatAlsPunt[];
};

export function useWatAls() {
  return useMutation({
    mutationFn: (input: { tssPerDag: number[] }) =>
      apiFetch<WatAlsData>("/api/athlete/wat-als", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
