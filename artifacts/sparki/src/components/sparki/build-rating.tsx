import { useState } from "react"
import { DsStarRating } from "@/components/ds"
import {
  useBuildRating,
  useUpsertBuildRating,
  type BuildRatingSubjectType,
} from "@/hooks/use-build-ratings"

// Herbruikbaar beoordelingsblok voor alles wat Sparki bouwt (routes,
// planweken, dagadviezen, …). Eén tik op een ster slaat de score direct op
// (idempotente upsert); een korte toelichting is altijd optioneel. De scores
// zijn persoonlijk en voeden — alleen geaggregeerd — de periodieke audits.
export function BuildRatingBlock({
  subjectType,
  subjectId,
  question = "Hoe goed werkt dit voor jou?",
  className,
}: {
  subjectType: BuildRatingSubjectType
  subjectId: string | null
  question?: string
  className?: string
}) {
  const { data: existing } = useBuildRating(subjectType, subjectId)
  const upsert = useUpsertBuildRating()
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState("")
  const [commentSaved, setCommentSaved] = useState(false)

  if (!subjectId) return null
  const rating = existing?.rating ?? null

  const save = (nextRating: number, nextComment?: string | null) => {
    setCommentSaved(false)
    upsert.mutate(
      {
        subjectType,
        subjectId,
        rating: nextRating,
        // De upsert ververst de hele rij: stuur de bekende toelichting mee,
        // anders zou een ster-tik een eerder gegeven toelichting wissen.
        comment:
          nextComment !== undefined
            ? nextComment
            : (comment.trim() || existing?.comment) ?? null,
      },
      {
        onSuccess: () => {
          if (nextComment !== undefined) setCommentSaved(true)
        },
      },
    )
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[12px] text-muted-foreground">{question}</span>
        <DsStarRating
          value={rating}
          onChange={(n) => save(n)}
          size="sm"
          label={question}
        />
        {upsert.isError && (
          <span className="text-[11px] text-[color:var(--color-negative)]">
            Opslaan mislukt — probeer het nog eens.
          </span>
        )}
        {rating != null && !upsert.isError && (
          <button
            type="button"
            onClick={() => {
              setShowComment((s) => !s)
              setComment(existing?.comment ?? "")
              setCommentSaved(false)
            }}
            className="text-[11px] text-muted-foreground underline-offset-2 transition hover:text-muted-foreground hover:underline"
          >
            {existing?.comment ? "Toelichting wijzigen" : "Toelichting (niet verplicht)"}
          </button>
        )}
      </div>
      {showComment && rating != null && (
        <div className="mt-2 flex items-start gap-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Korte toelichting — wat werkt goed of juist niet?"
            className="min-w-0 flex-1 rounded-xl border border-border bg-muted p-2.5 text-[12px] text-foreground/80 placeholder:text-muted-foreground focus:border-cyan-300/40 focus:outline-none"
          />
          <button
            type="button"
            disabled={upsert.isPending}
            onClick={() => {
              save(rating, comment.trim() || null)
              setShowComment(false)
            }}
            className="rounded-full border border-border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition hover:border-border hover:text-foreground/90 disabled:opacity-50"
          >
            Bewaren
          </button>
        </div>
      )}
      {commentSaved && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Bedankt — je beoordeling is opgeslagen.
        </p>
      )}
    </div>
  )
}
