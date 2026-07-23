// Kleine, aanvullende humorregel onder functionele tekst. Rendert niets bij
// niveau "uit" of zolang er geen regel is — de zakelijke tekst staat er altijd
// al en blijft leidend. Nooit gebruiken op kritieke of gevoelige oppervlakken.

import { useHumorLine } from "@/hooks/use-humor";
import type { HumorContext } from "@/lib/humor";
import { cn } from "@/lib/utils";

export function HumorLine({
  context,
  seedSalt = "",
  className,
}: {
  context: HumorContext;
  seedSalt?: string;
  className?: string;
}) {
  const line = useHumorLine(context, seedSalt);
  if (!line) return null;
  return (
    <p className={cn("text-xs italic text-white/45", className)}>{line}</p>
  );
}
