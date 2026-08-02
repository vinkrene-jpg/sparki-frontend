// SPARKI_BUILD_01 F7 — trainer↔sporter-berichten (coach_link).
//
// Eén scherm, drie rollen (server bepaalt welke):
//  - trainer: praat met een gekoppelde sporter (twee richtingen);
//  - sporter: praat met zijn trainer (twee richtingen);
//  - ouder:   meeleesweergave bij een gekoppeld kind <16 — ALLEEN lezen,
//             duidelijk gelabeld als ouderinzage.
//
// Dezelfde berichten-UI als de clubberichten (MessageThread), met bijlagen,
// gelezenstatus en een ingetrokken-bestand-staat. Eigen terugknop bovenaan ⇒
// ScreenShell krijgt terug={false}.

import { Link, useParams } from "wouter"
import { ChevronLeft, Eye } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"
import {
  useCoachLinkThread,
  useSendCoachLinkMessage,
  useMarkCoachLinkRead,
  useRevokeCoachLinkAttachment,
  type ComposeAttachment,
} from "@/hooks/use-coach-link-messages"
import { MessageBubble, MessageComposer } from "@/components/sparki/message-thread"

export default function CoachMessagesPage() {
  const params = useParams<{ coachClerkId: string; athleteClerkId: string }>()
  const coachClerkId = params.coachClerkId ?? null
  const athleteClerkId = params.athleteClerkId ?? null
  const { profile } = useUserProfile()
  const currentClerkId = profile?.clerkId ?? null

  const { data, isLoading, isError, error } = useCoachLinkThread(coachClerkId, athleteClerkId)
  const send = useSendCoachLinkMessage(coachClerkId, athleteClerkId)
  const markRead = useMarkCoachLinkRead(coachClerkId, athleteClerkId)
  const revoke = useRevokeCoachLinkAttachment(coachClerkId, athleteClerkId)

  const role = data?.role
  const isParent = role === "parent"
  const messages = (data?.messages ?? []).slice().reverse() // oud → nieuw
  const serverError = (send.error as (Error & { status?: number }) | null)?.message ?? null

  // Terug: sporter/ouder naar hun startpunt, trainer naar zijn sporters.
  const backHref = role === "coach" ? "/" : role === "parent" ? "/kinderen" : "/"
  const backLabel =
    role === "coach"
      ? "Terug naar je sporters"
      : role === "parent"
        ? "Terug naar je kinderen"
        : "Terug"

  return (
    <ScreenShell section="Coach" terug={false} bg="/atmosphere/wedstrijd-renster-bergen.webp">
      <div className="space-y-5">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white/70"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {backLabel}
        </Link>

        <SectionLabel n="01" title="Berichten met je trainer" />

        {isParent && (
          <div
            className="flex items-start gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] px-3.5 py-2.5 text-[12px] text-cyan-100/90"
            data-testid="ouder-meelees-banner"
          >
            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span>
              Ouderinzage — je leest deze berichten volledig mee omdat je kind
              jonger dan 16 is. Meelezen alleen; je kunt hier zelf niet reageren.
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.05]" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-[13px] text-white/55">
            {(error as (Error & { status?: number }) | null)?.status === 403
              ? "Je hebt geen toegang tot dit gesprek."
              : "Het gesprek kon niet geladen worden."}
          </p>
        ) : messages.length === 0 ? (
          <p className="rounded-xl border border-white/[0.07] bg-[#070d16]/60 px-3.5 py-3 text-[12px] text-white/45">
            Nog geen berichten in dit gesprek.
            {!isParent && " Stuur er hieronder één om te beginnen."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                mine={m.authorClerkId === currentClerkId}
                currentClerkId={currentClerkId}
                onRevoke={isParent ? undefined : (attId) => revoke.mutate(attId)}
                onSeen={() => markRead.mutate(m.id)}
              />
            ))}
          </div>
        )}

        {/* Ouder leest alleen mee — geen opstelvak. */}
        {!isParent && role != null && (
          <MessageComposer
            placeholder="Bericht sturen…"
            sending={send.isPending}
            serverError={serverError}
            onSend={({ body, files, links }) => {
              const attachments: ComposeAttachment[] = [
                ...files.map((f) => ({ kind: "file" as const, base64: f.base64, name: f.name })),
                ...links.map((l) => ({ kind: "link" as const, url: l.url, title: l.title })),
              ]
              send.mutate({ body, attachments })
            }}
          />
        )}
      </div>
    </ScreenShell>
  )
}
