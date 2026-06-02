/**
 * app/report-center/[module]/page.tsx
 * Dynamic route — renders a detail page for a single report module.
 * Shows module header, report list in a table, and export actions.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { MODULE_IDS, getModuleConfig } from '@/lib/reports/config';
import { getMockReportsByModule } from '@/lib/reports/mock-data';
import ModuleToolbar from './ModuleToolbar';

// ─── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  return MODULE_IDS.map((module) => ({ module }));
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ReportStatus = 'completed' | 'running' | 'scheduled';

interface PageProps {
  params: { module: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; badge: string }
> = {
  completed: {
    label: 'Completed',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  running: {
    label: 'Running',
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  scheduled: {
    label: 'Scheduled',
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
};

// ─── Page component ────────────────────────────────────────────────────────────

export default async function ModuleDetailPage({ params }: PageProps) {
  const { module } = await params;

  if (module === 'inventory') {
    redirect('/report-center/inventory');
  }

  if (MODULE_IDS.includes(module)) {
    redirect(`/report-center?module=${module}#modules`);
  }

  const config = getModuleConfig(module);

  if (!config) {
    notFound();
  }

  const reports: ReturnType<typeof getMockReportsByModule> = [];

  const completedCount = reports.filter((r) => r.status === 'completed').length;
  const runningCount = reports.filter((r) => r.status === 'running').length;
  const scheduledCount = reports.filter((r) => r.status === 'scheduled').length;

  return (
    <main className="min-h-screen bg-slate-50">

      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <Link
              href="/report-center"
              className="hover:text-cyan-700 transition-colors"
            >
              Report Center
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">{config.name}</span>
          </nav>
        </div>
      </div>

      {/* ── Module header ─────────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">

            {/* Title block */}
            <div>
              <div className="mb-2 inline-flex border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {config.name} Module
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {config.name} Reports
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                {config.description}
              </p>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-slate-200 bg-slate-950 p-4 text-white">
                <div className="text-2xl font-semibold">{reports.length}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-300">
                  Reports
                </div>
              </div>
              <div className="border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-2xl font-semibold text-emerald-800">
                  {completedCount}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wide text-emerald-700">
                  Ready
                </div>
              </div>
              <div className="border border-slate-200 bg-white p-4">
                <div className="text-2xl font-semibold text-slate-950">
                  {runningCount + scheduledCount}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                  Pending
                </div>
              </div>
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span>Last updated: {config.lastUpdated}</span>
            <span>·</span>
            <span>{config.reportCount} total reports in this module</span>
          </div>
        </div>
      </section>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 py-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">
            {reports.length} Report{reports.length !== 1 ? 's' : ''}
          </h2>
          <ModuleToolbar
            totalRows={reports.reduce((sum, r) => sum + r.rows, 0)}
          />
        </div>
      </div>

      {/* ── Reports table ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-10 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">

          {/* Table header */}
          <div className="grid grid-cols-[1fr_160px_140px_120px_100px] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <div>Report Name</div>
            <div>Category</div>
            <div>Last Run</div>
            <div>Status</div>
            <div className="text-right">Action</div>
          </div>

          {/* Table rows */}
          {reports.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-sm font-semibold text-slate-700">Query real modul ini belum diaktifkan.</p>
              <p className="mt-2 text-sm text-slate-400">
                Report Center saat ini hanya membuka report real untuk Inventory. Tidak ada data mock yang ditampilkan.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reports.map((report) => {
                const status = STATUS_CONFIG[report.status as ReportStatus];
                return (
                  <div
                    key={report.id}
                    className="grid grid-cols-[1fr_160px_140px_120px_100px] items-center gap-0 px-4 py-4 hover:bg-slate-50 transition-colors"
                  >
                    {/* Name + description */}
                    <div>
                      <div className="text-sm font-semibold text-slate-950">
                        {report.name}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                        {report.description}
                      </div>
                    </div>

                    {/* Category */}
                    <div className="text-sm text-slate-600">{report.category}</div>

                    {/* Last run */}
                    <div className="text-sm text-slate-500">{report.lastRun}</div>

                    {/* Status badge */}
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.badge}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    {/* View button */}
                    <div className="flex justify-end">
                      <Link
                        href={`/report-center/${module}/${report.id}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination placeholder */}
        {reports.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Showing {reports.length} of {config.reportCount} reports</span>
            <div className="flex gap-1">
              <button className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-400 cursor-not-allowed" disabled>
                ‹ Prev
              </button>
              <button className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-400 cursor-not-allowed" disabled>
                Next ›
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
