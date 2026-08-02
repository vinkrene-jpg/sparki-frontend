// SPARKI_BUILD_01 F3 / BB-14 — startscherm voedingsdeskundige.
//
// Eerste prioriteit van deze rol is Voeding. Zolang er geen gekoppelde
// sporters zijn, is dít de eerlijke lege toestand: wat ontbreekt, wie het
// oplost en één vervolgstap. Er wordt nooit teruggevallen op de
// sporterweergave en er worden geen sporters of voedingsdata nagebootst.
import { Link } from "wouter"
import { ArrowRight } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { GLOBAL_ROLE_STARTS } from "@/lib/role-start"

const start = GLOBAL_ROLE_STARTS.find((r) => r.role === "nutrition_specialist")!

export default function NutritionSpecialistHome() {
  return (
    <ScreenShell section="Voeding" terug={false}>
      <div className="space-y-4" data-testid="nutrition-start">
        <SectionLabel title="Jouw sporters" />
        <div className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
          <p className="text-sm text-foreground/75">{start.leeg!.ontbreekt}</p>
          <p className="mt-2 text-sm text-muted-foreground">{start.leeg!.wieLostOp}</p>
          <Link
            href={start.leeg!.vervolgstap.href}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent-cyan hover:text-accent-cyan"
            data-testid="nutrition-vervolgstap"
          >
            {start.leeg!.vervolgstap.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ScreenShell>
  )
}
