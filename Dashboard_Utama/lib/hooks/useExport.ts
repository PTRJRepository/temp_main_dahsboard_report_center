/**
 * useExport.ts
 * React Query hooks for triggering and tracking report data exports.
 * Supports CSV, XLSX, and PDF export formats.
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { reportKeys } from './useReports';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportPayload {
  reportId?: string;
  format: ExportFormat;
  filters?: {
    search?: string;
    status?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export interface ExportProgress {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number; // 0–100
  downloadUrl?: string;
  error?: string;
  expiresAt?: string; // ISO 8601 — URL valid until this time
}

export interface ExportResponse {
  jobId: string;
  downloadUrl: string;
  expiresAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE = '/api';

async function exportRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Opens a time-limited signed URL in a hidden anchor and removes it after. */
function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Hook: useExportReport ─────────────────────────────────────────────────────

/**
 * Initiates an export job and polls for completion.
 * Automatically triggers a browser download when the file is ready.
 */
export interface UseExportReportOptions {
  /** On success, call this to show a user-facing toast / notification. */
  onSuccess?: (data: ExportResponse) => void;
  /** Called when the export job fails at any stage. */
  onError?: (error: Error) => void;
  /**
   * Poll interval in ms while waiting for job completion (default 1500).
   * Set to 0 to disable polling and return the jobId immediately.
   */
  pollInterval?: number;
}

export type UseExportReportResult = UseMutationResult<
  ExportResponse,
  Error,
  ExportPayload
>;

export function useExportReport({
  onSuccess,
  onError,
  pollInterval = 1500,
}: UseExportReportOptions = {}): UseExportReportResult {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ExportPayload): Promise<ExportResponse> => {
      const res = await fetch(`${API_BASE}/exports`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      }

      return res.json() as Promise<ExportResponse>;
    },

    onSuccess: async (data) => {
      // If polling is disabled, just call onSuccess and return the jobId
      if (pollInterval === 0) {
        onSuccess?.(data);
        return;
      }

      // Poll until status is 'completed' or 'failed'
      let job: ExportProgress | null = null;
      let attempts = 0;
      const maxAttempts = 80; // ~2 min at 1500 ms interval

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, pollInterval));

        const statusRes = await fetch(`${API_BASE}/exports/${data.jobId}/status`, {
          credentials: 'include',
        });

        if (!statusRes.ok) {
          throw new Error(`Status poll failed: HTTP ${statusRes.status}`);
        }

        job = (await statusRes.json()) as ExportProgress;

        if (job.status === 'completed' && job.downloadUrl) {
          const filename = `report-export-${Date.now()}.${(job as ExportProgress & { format?: ExportFormat }).format ?? 'csv'}`;
          triggerDownload(job.downloadUrl, filename);
          onSuccess?.(data);
          return;
        }

        if (job.status === 'failed') {
          throw new Error(job.error ?? 'Export job failed');
        }

        attempts++;
      }

      // Timeout after maxAttempts
      throw new Error('Export timed out — please try again or contact support.');
    },

    onError: (error) => {
      onError?.(error as Error);
    },
  });
}

// ─── Hook: useExportAllReports ─────────────────────────────────────────────────

export interface ExportAllPayload {
  format: ExportFormat;
  filters?: ExportPayload['filters'];
  /** Include full query text in the export (default: false) */
  includeQueryText?: boolean;
}

export type UseExportAllReportsResult = UseMutationResult<
  ExportResponse,
  Error,
  ExportAllPayload
>;

export function useExportAllReports(
  options?: Pick<UseExportReportOptions, 'onSuccess' | 'onError' | 'pollInterval'>
): UseExportAllReportsResult {
  const { onSuccess, onError, pollInterval } = options ?? {};

  return useMutation({
    mutationFn: async (payload: ExportAllPayload): Promise<ExportResponse> =>
      exportRequest<ExportResponse>('/exports/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),

    // Delegate polling / download to useExportReport's shared logic
    onSuccess: async (data, variables) => {
      if (pollInterval === 0) {
        onSuccess?.(data);
        return;
      }

      let job: ExportProgress | null = null;
      let attempts = 0;
      const maxAttempts = 80;
      const interval = pollInterval ?? 1500;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, interval));

        const statusRes = await fetch(`${API_BASE}/exports/${data.jobId}/status`, {
          credentials: 'include',
        });

        if (!statusRes.ok) break;

        job = (await statusRes.json()) as ExportProgress;

        if (job.status === 'completed' && job.downloadUrl) {
          const ext = variables.format;
          triggerDownload(job.downloadUrl, `all-reports-export-${Date.now()}.${ext}`);
          onSuccess?.(data);
          return;
        }

        if (job.status === 'failed') {
          throw new Error(job.error ?? 'Bulk export failed');
        }

        attempts++;
      }

      throw new Error('Export timed out — please try again or contact support.');
    },

    onError: (error) => {
      onError?.(error as Error);
    },
  });
}

// ─── Hook: useExportCancel ─────────────────────────────────────────────────────

/** Cancels an in-progress export job (stops polling). */
export type UseExportCancelResult = UseMutationResult<void, Error, string>;

export function useExportCancel(): UseExportCancelResult {
  return useMutation({
    mutationFn: async (jobId: string): Promise<void> =>
      exportRequest<void>(`/exports/${jobId}/cancel`, { method: 'POST' }),
  });
}

// ─── Hook: useExportTemplates ──────────────────────────────────────────────────

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

export interface ExportTemplate {
  id: string;
  name: string;
  format: ExportFormat;
  description: string;
  defaultFilters?: ExportPayload['filters'];
}

export function useExportTemplates(
  queryOptions?: UseQueryOptions<ExportTemplate[], Error>
) {
  return useQuery({
    queryKey: ['exports', 'templates'] as const,
    queryFn: async (): Promise<ExportTemplate[]> =>
      exportRequest<ExportTemplate[]>('/exports/templates'),
    staleTime: 5 * 60_000, // templates rarely change
    ...queryOptions,
  });
}
