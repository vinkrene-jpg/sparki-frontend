import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type DocumentAnalysisStatus = "analyzing" | "analyzed" | "failed";
export type DocumentAnalysisKind =
  | "technische_gids"
  | "wedstrijdgids"
  | "etappeboek"
  | "routekaart"
  | "tijdschema"
  | "onbekend";

export type ExtractedField = {
  key: string;
  value: string | null;
  confidence: "high" | "medium" | "low" | null;
};

export type DocumentAnalysis = {
  id: number;
  clerkId: string;
  fileName: string;
  mediaType: string;
  documentKind: DocumentAnalysisKind;
  status: DocumentAnalysisStatus;
  summary: string | null;
  extractedFields: Record<string, ExtractedField> | null;
  foundFields: string[] | null;
  missingFields: string[] | null;
  followUpQuestions: string[] | null;
  errorMessage: string | null;
  linkedRaceId: number | null;
  createdAt: string;
  updatedAt: string;
};

export function useDocumentAnalyses() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.documentAnalyses.list(),
    queryFn: () =>
      apiFetch<{ analyses: DocumentAnalysis[] }>(
        "/api/document-analyses?limit=30",
      ),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 2 * 60_000,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fileName: string; mediaType: string; data: string }) =>
      apiFetch<{ analysis: DocumentAnalysis }>("/api/document-analyses", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.documentAnalyses.all(),
      });
    },
  });
}

export function useAnswerDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      answers,
    }: {
      id: number;
      answers: Record<string, string>;
    }) =>
      apiFetch<{ analysis: DocumentAnalysis }>(
        `/api/document-analyses/${id}/answers`,
        { method: "POST", body: JSON.stringify({ answers }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.documentAnalyses.all(),
      });
    },
  });
}

export function useLinkDocumentToRace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, raceId }: { id: number; raceId: number }) =>
      apiFetch<{ analysis: DocumentAnalysis; enriched: string[] }>(
        `/api/document-analyses/${id}/link`,
        { method: "POST", body: JSON.stringify({ raceId }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.documentAnalyses.all(),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.races.all() });
    },
  });
}

export function useDeleteDocumentAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/document-analyses/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.documentAnalyses.all(),
      });
    },
  });
}

// Read a File as raw base64 (no data-URL prefix), suitable for the upload body.
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kon bestand niet lezen"));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma !== -1 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
