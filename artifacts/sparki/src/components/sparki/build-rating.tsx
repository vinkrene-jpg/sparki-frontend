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
        <span className="text-[12px] text-white/55">{question}</span>
        <DsStarRating
          value={rating}
          onChange={(n) => save(n)}
          size="sm"
          label={question}
        />
        {upsert.isError && (
          <span className="text-[11px] text-red-300/80">
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
            className="text-[11px] text-white/35 underline-offset-2 transition hover:text-white/60 hover:underline"
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
            className="min-w-0 flex-1 rounded-xl border border-white/[0.12] bg-white/[0.04] p-2.5 text-[12px] text-white/80 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
          />
          <button
            type="button"
            disabled={upsert.isPending}
            onClick={() => {
              save(rating, comment.trim() || null)
              setShowComment(false)
            }}
            className="rounded-full border border-white/[0.14] px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition hover:border-white/30 hover:text-white/90 disabled:opacity-50"
          >
            Bewaren
          </button>
        </div>
      )}
      {commentSaved && (
        <p className="mt-1.5 text-[11px] text-white/35">
          Bedankt — je beoordeling is opgeslagen.
        </p>
      )}
    </div>
  )
}
