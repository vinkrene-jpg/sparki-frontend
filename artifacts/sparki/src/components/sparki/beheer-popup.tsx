// BeheerPopup — beheer-acties (doelen, wedstrijden) openen als popup bóven de
// huidige pagina in plaats van ernaartoe te navigeren. Je blijft waar je bent;
// wijzigingen komen via de gedeelde query-invalidatie overal terug (Plan,
// Analyse, Jij). Gebouwd op de bestaande Sheet-primitief (portal + focus trap).
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { GoalsWorksheet } from "@/components/sparki/goals-worksheet"
import { RaceWizard } from "@/components/sparki/race-wizard"
import { useCreateRace } from "@/hooks/use-races"
import type { RaceInput } from "@/lib/race-types"
import type { ReactNode } from "react"

export function BeheerSheet({
  open,
  onOpenChange,
  titel,
  breed = false,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  titel: string
  /** Bredere variant voor grotere formulieren (bijv. de wedstrijd-wizard). */
  breed?: boolean
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={`w-full overflow-y-auto border-white/10 bg-[#05070e] text-white ${breed ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-sans text-xl font-extralight tracking-tight text-white">
            {titel}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

/** Doelen beheren in een popup — zelfde werkblad als op /you. */
export function DoelenBeheerSheet({
  open,
  onOpenChange,
  autoAdd = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  autoAdd?: boolean
}) {
  return (
    <BeheerSheet open={open} onOpenChange={onOpenChange} titel="Doelen beheren">
      {/* key zorgt dat autoAdd bij elke opening opnieuw geldt */}
      {open && <GoalsWorksheet key={autoAdd ? "add" : "beheer"} autoAdd={autoAdd} />}
    </BeheerSheet>
  )
}

/** Wedstrijd toevoegen in een popup — zelfde 5-staps wizard als op /races. */
export function WedstrijdToevoegenSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createRace = useCreateRace()
  async function handleSave(input: RaceInput) {
    await createRace.mutateAsync(input)
    onOpenChange(false)
  }
  return (
    <BeheerSheet open={open} onOpenChange={onOpenChange} titel="Wedstrijd toevoegen" breed>
      {open && (
        <RaceWizard onSave={handleSave} onCancel={() => onOpenChange(false)} />
      )}
    </BeheerSheet>
  )
}
