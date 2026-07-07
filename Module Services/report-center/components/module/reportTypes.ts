// ─── Report & Module Domain Types ─────────────────────────────────────────

export type ReportStatus = 'running' | 'completed' | 'failed' | 'scheduled' | 'cancelled';
export type ReportCategory = 'sales' | 'inventory' | 'finance' | 'operations' | 'custom';

export interface ReportAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ReportSummary {
  id: string;
  title: string;
  description: string;
  status: ReportStatus;
  category: ReportCategory;
  author: ReportAuthor;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  executionMs?: number;
  rowCount?: number;
  serverProfile: string;
  database: string;
  queryPreview?: string;
  tags: string[];
  isFavorite: boolean;
  schedule?: {
    cron: string;
    nextRun: string; // ISO 8601
  };
}

export interface FilterState {
  search: string;
  status: ReportStatus | 'all';
  category: ReportCategory | 'all';
  serverProfile: string | 'all';
  dateRange: { from: string; to: string } | null;
}

export interface ModuleStatusBanner {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  description?: string;
  dismissible: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface SummaryCardData {
  id: string;
  label: string;
  value: number;
  unit?: string;
  trend?: {
    direction: 'up' | 'down' | 'flat';
    delta: number;
    label: string;
  };
  color: 'blue' | 'green' | 'amber' | 'red' | 'slate';
  icon: React.ReactNode;
}
