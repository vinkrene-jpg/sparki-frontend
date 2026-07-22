// ── Golf 27 — AI-helpdesk & support (webclient) ─────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type HelpdeskAnswer = {
  turnId: number;
  category: string;
  categoryLabel: string;
  status: "direct" | "beperkt" | "meer_info" | "mens" | "storing_bekend";
  answer: string | null;
  sources: Array<{ type: "artikel" | "storing"; id: number; title: string }>;
  ticketId: number | null;
  ticketAttached: boolean;
  knownIssue: { id: number; title: string } | null;
};

export type SupportTicket = {
  id: number;
  summary: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type SupportTicketMessage = {
  id: number;
  authorRole: string;
  body: string;
  createdAt: string;
  sentAt: string | null;
};

export type SupportArticle = {
  id: number;
  slug: string;
  title: string;
  body: string;
  category: string;
  version: number;
  updatedAt: string;
};

export function useAskHelpdesk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      question: string;
      correlationId?: string | null;
      screen?: string | null;
    }) =>
      apiFetch<HelpdeskAnswer>("/api/support/helpdesk/ask", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
  });
}

export function useHelpdeskFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { turnId: number; feedback: "opgelost" | "niet_geholpen" | "onjuist" }) =>
      apiFetch<{ ok: boolean; ticketId: number | null }>(
        `/api/support/helpdesk/${input.turnId}/feedback`,
        { method: "POST", body: JSON.stringify({ feedback: input.feedback }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
  });
}

export function useMyTickets() {
  return useQuery({
    queryKey: ["support", "tickets"],
    queryFn: () => apiFetch<{ tickets: SupportTicket[] }>("/api/support/tickets"),
  });
}

export function useTicketDetail(id: number | null) {
  return useQuery({
    queryKey: ["support", "ticket", id],
    enabled: id != null,
    queryFn: () =>
      apiFetch<{ ticket: SupportTicket; messages: SupportTicketMessage[] }>(
        `/api/support/tickets/${id}`,
      ),
  });
}

export function useSendTicketMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: number; body: string }) =>
      apiFetch<{ ok: boolean; reopened: boolean }>(
        `/api/support/tickets/${input.ticketId}/messages`,
        { method: "POST", body: JSON.stringify({ body: input.body }) },
      ),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["support", "ticket", v.ticketId] });
      void qc.invalidateQueries({ queryKey: ["support", "tickets"] });
    },
  });
}

export function useSupportArticles(q: string) {
  return useQuery({
    queryKey: ["support", "articles", q],
    queryFn: () =>
      apiFetch<{ articles: SupportArticle[] }>(
        `/api/support/artikelen${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      ),
  });
}
