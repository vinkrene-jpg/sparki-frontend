// Twee gescheiden poorten in de UI — MEETNIVEAU_EN_UITLEG_01 §4.
//
// PakketPoortNotice (pakketprobleem: wat het pakket toevoegt + pad naar
// upgraden) en DataPoortNotice (sensorprobleem: welke sensor ontbreekt + wat
// die zou opleveren). Teksten komen uit lib/poorten.ts — één bron, zodat de
// scheiding toetsbaar blijft. Nooit beide tegelijk tonen; kies via bepaalPoort.

import { Link } from "wouter";
import { Lock, Radio } from "lucide-react";
import { pakketMelding, dataMelding, type SensorSoort } from "@/lib/poorten";

export function PakketPoortNotice({ onderdeel }: { onderdeel: string }) {
  const m = pakketMelding(onderdeel);
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div>
          <p className="text-sm font-medium text-foreground">{m.titel}</p>
          <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
          <Link
            href={m.actieHref}
            className="mt-3 inline-block rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            {m.actieLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DataPoortNotice({ sensor }: { sensor: SensorSoort }) {
  const m = dataMelding(sensor);
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-start gap-3">
        <Radio className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div>
          <p className="text-sm font-medium text-foreground">{m.titel}</p>
          <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
        </div>
      </div>
    </div>
  );
}
