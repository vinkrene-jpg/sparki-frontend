import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useUser } from "@clerk/react"
import { DEV_PREVIEW } from "@/lib/dev"
import { apiFetch, API_BASE } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

// Sparki Input Center — the one central place where the athlete hands Sparki
// information (photo, image, PDF, file, link or typed question) and the whole
// conversation, including the uploaded items, stays persisted and visible.

export type InputAttachmentKind = "photo" | "image" | "pdf" | "file"

export type InputAttachment = {
  objectPath: string
  name: string
  contentType: string
  size: number | null
  kind: InputAttachmentKind
  // F11: centrale files-rij (bron van waarheid). Aanwezig zodra de bijlage door
  // de centrale veiligheidspoort is gefinaliseerd; dan wordt hij via de centrale
  // (intrekbare, owner-gecontroleerde) route geserveerd. Legacy-bijlagen hebben
  // dit niet en worden via het generieke object-pad geserveerd.
  fileId?: number | null
}

export type InputMessageSource = {
  id: number
  title: string
  url: string
  source: string | null
}

export type ConversationTurn = {
  id: number
  clerkId: string
  role: "athlete" | "sparki"
  text: string | null
  link: string | null
  attachments: InputAttachment[] | null
  sources: InputMessageSource[] | null
  createdAt: string
}

// Builds the owner-gated serving URL for a stored attachment. The image/file is
// served by the API (cookies sent automatically same-origin / via Vite proxy).
// F11: bijlagen met een centrale files-rij (fileId) worden via de centrale
// route geserveerd — die dwingt intrekbaarheid (410) en owner-controle af.
// Overige (legacy) bijlagen én losse objectPaden lopen via /api/storage; ook dáár
// dwingt de server voor centraal-beheerde objecten inmiddels serveFile (met
// intrekbaarheid) af. Aanroepbaar met een string (los pad) of een attachment.
export function attachmentUrl(
  att: string | Pick<InputAttachment, "objectPath" | "fileId">,
): string {
  if (typeof att === "string") {
    return `${API_BASE}/api/storage${att}`
  }
  if (att.fileId != null) {
    return `${API_BASE}/api/files/${att.fileId}/download`
  }
  return `${API_BASE}/api/storage${att.objectPath}`
}

// Coarse kind from a file's MIME type — drives thumbnail vs file-chip rendering.
export function kindForFile(file: File): InputAttachmentKind {
  if (file.type.startsWith("image/")) return "image"
  if (file.type === "application/pdf") return "pdf"
  return "file"
}

// Uploads one file to object storage via the presigned-URL flow:
//   1. ask the API for a signed PUT URL (cookie-authenticated, owner = clerkId)
//   2. PUT the bytes DIRECTLY to storage (not through our server)
// Returns the attachment metadata to attach to a conversation message.
export async function uploadFile(
  file: File,
  kind: InputAttachmentKind,
): Promise<InputAttachment> {
  const contentType = file.type || "application/octet-stream"
  const { uploadURL, objectPath } = await apiFetch<{
    uploadURL: string
    objectPath: string
  }>("/api/storage/uploads/request-url", {
    method: "POST",
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType,
    }),
  })

  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  })
  if (!put.ok) {
    throw new Error("Uploaden van bestand is mislukt")
  }

  return {
    objectPath,
    name: file.name,
    contentType,
    size: file.size,
    kind,
  }
}

export function useConversation() {
  const { isSignedIn } = useUser()
  return useQuery({
    queryKey: queryKeys.inputCenter.conversation(),
    queryFn: () =>
      apiFetch<{ turns: ConversationTurn[] }>(
        "/api/input-center/conversation",
      ),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 30_000,
  })
}

// Optional conversation context: the ride the question is about. The backend
// ownership-checks the session and grounds Sparki's answer in that real ride.
export type SendMessageContext = { kind: "session"; sessionId: number }

export type SendMessageInput = {
  text?: string | null
  link?: string | null
  attachments?: InputAttachment[]
  context?: SendMessageContext | null
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SendMessageInput) =>
      apiFetch<{
        athleteTurn: ConversationTurn
        sparkiTurn: ConversationTurn
      }>("/api/input-center/messages", {
        method: "POST",
        body: JSON.stringify({
          text: input.text ?? null,
          link: input.link ?? null,
          attachments: input.attachments ?? [],
          context: input.context ?? null,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.inputCenter.conversation(),
      })
    },
  })
}
