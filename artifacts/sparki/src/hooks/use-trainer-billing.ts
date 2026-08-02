// SPARKI_BUILD_04 F14 — hooks voor de facturatiewerkplek.
// Praat met /api/trainer/billing/* (trainer-billing.ts). Rechten zijn
// server-side: uitsluitend de eigen trainer ziet iets.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const ck = {
  dashboard: () => ["trainer", "billing", "dashboard"] as const,
  invoices: () => ["trainer", "billing", "invoices"] as const,
  invoice: (id: number) => ["trainer", "billing", "invoices", id] as const,
  history: (clientId: number) => ["trainer", "billing", "history", clientId] as const,
  reports: (year: string) => ["trainer", "billing", "reports", year] as const,
};

export type DashboardBlock = {
  key: string;
  count?: number;
  amountCents?: number;
  date?: string | null;
  items?: string[];
  note?: string;
  clients?: { id: number; name: string }[];
  events?: { kind: string; body: string; createdAt: string }[];
};

export type BillingDashboard = {
  primaryAction: { kind: string; invoiceId: number; label: string } | null;
  blocks: DashboardBlock[];
};

export type TrainerInvoice = {
  id: number;
  clientId: number;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  description: string;
  amountInclCents: number;
  paidCents: number;
  status: string;
  isOverdue: boolean;
  paymentAgreementDate: string | null;
  paymentAgreementNote: string | null;
  uncollectibleReason: string | null;
};

export function useBillingDashboard() {
  return useQuery({
    queryKey: ck.dashboard(),
    queryFn: () => apiFetch<BillingDashboard>("/api/trainer/billing/dashboard"),
  });
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: ck.invoices(),
    queryFn: () => apiFetch<TrainerInvoice[]>("/api/trainer/billing/invoices"),
  });
}

export function useClientHistory(clientId: number | null) {
  return useQuery({
    queryKey: ck.history(clientId ?? -1),
    enabled: clientId != null,
    queryFn: () =>
      apiFetch<{
        client: { id: number; name: string };
        events: { id: number; kind: string; body: string; channel: string; createdAt: string }[];
        invoices: TrainerInvoice[];
        paymentBehavior: { avgPaymentDays: number | null; timesLate: number; note: string };
      }>(`/api/trainer/billing/clients/${clientId}/history`),
  });
}

export function useBillingReports(year: string) {
  return useQuery({
    queryKey: ck.reports(year),
    queryFn: () =>
      apiFetch<{
        year: string;
        totalCents: number;
        perMonth: Record<string, number>;
        perQuarter: Record<string, number>;
        perClient: Record<string, number>;
        openAmountCents: number;
        avgPaymentDays: number | null;
        activeClients: number;
        invoiceCount: number;
        vatOverview: { note: string; vatCents: number; korExemptCents: number };
      }>(`/api/trainer/billing/reports?year=${year}`),
  });
}

function useInvoiceAction(pathSuffix: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, body }: { invoiceId: number; body?: unknown }) =>
      apiFetch(`/api/trainer/billing/invoices/${invoiceId}/${pathSuffix}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["trainer", "billing"] });
    },
  });
}

export const useSendInvoice = () => useInvoiceAction("send");
export const useSendReminder = () => useInvoiceAction("reminder");
export const useMarkPaid = () => useInvoiceAction("mark-paid");
export const usePaymentAgreement = () => useInvoiceAction("payment-agreement");
export const useMarkUncollectible = () => useInvoiceAction("uncollectible");
export const useInvoiceNote = () => useInvoiceAction("note");
export const useWithdrawInvoice = () => useInvoiceAction("withdraw");
