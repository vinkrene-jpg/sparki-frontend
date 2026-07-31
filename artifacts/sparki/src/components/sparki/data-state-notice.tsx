import { DsState, type DsStateSoort } from "@/components/ds";
import type { DataState } from "@/hooks/use-data-state";

// Zeven toestanden, niet één lege doos (DATA_TRUST_01 §4).
//
// Server-side toestanden (geen_data / onvoldoende_data / verouderd /
// sync_bezig / providerfout) komen uit /api/data-origin/state/:domein;
// rechtenproblemen (403) en technische fouten komen uit de HTTP-status van
// de eigenlijke gegevensquery. Dit component toont ze zichtbaar verschillend
// en zegt altijd wat er ontbreekt en wat de gebruiker kan doen.

const TITELS: Record<string, string> = {
  geen_data: "Nog geen gegevens",
  onvoldoende_data: "Nog onvoldoende gegevens",
  verouderd: "Gegevens zijn verouderd",
  sync_bezig: "Bezig met ophalen",
  providerfout: "Koppeling tijdelijk niet bereikbaar",
};

const SOORTEN: Record<string, DsStateSoort> = {
  geen_data: "leeg",
  onvoldoende_data: "info",
  verouderd: "info",
  sync_bezig: "info",
  providerfout: "nietBeschikbaar",
};

export function DataStateNotice({
  state,
  queryError,
  onActie,
  actieLabel,
  className,
}: {
  /** Server-side toestand; mag null zijn wanneer de query zelf faalde. */
  state: DataState | null | undefined;
  /** Fout van de eigenlijke gegevensquery (voor rechten/technisch). */
  queryError?: unknown;
  onActie?: () => void;
  actieLabel?: string;
  className?: string;
}) {
  // Rechtenprobleem en technische fout: uit de HTTP-status, server-bepaald.
  if (queryError) {
    const status =
      typeof queryError === "object" && queryError !== null && "status" in queryError
        ? Number((queryError as { status?: unknown }).status)
        : null;
    const rechten = status === 403 || status === 401;
    return (
      <DsState
        className={className}
        soort="nietBeschikbaar"
        titel={rechten ? "Je hebt hier geen toegang toe" : "Er ging iets mis"}
        beschrijving={
          rechten
            ? "Dit onderdeel is niet beschikbaar voor jouw account of rol."
            : "Probeer het opnieuw. Blijft dit gebeuren, meld het dan via Support."
        }
        actie={
          !rechten && onActie
            ? { label: actieLabel ?? "Opnieuw proberen", onClick: onActie }
            : undefined
        }
      />
    );
  }

  if (!state || state.toestand === "ok") return null;

  return (
    <DsState
      className={className}
      soort={SOORTEN[state.toestand] ?? "info"}
      titel={TITELS[state.toestand] ?? "Geen gegevens"}
      beschrijving={state.melding ?? undefined}
      actie={
        onActie && state.toestand !== "sync_bezig"
          ? { label: actieLabel ?? state.actie ?? "Opnieuw proberen", onClick: onActie }
          : undefined
      }
      uitleg={state.actie ? { tekst: state.actie } : undefined}
    />
  );
}
