'use client';

import { Fragment, useState } from 'react';
import { useIfessStore } from '../stores/ifessStore';
import { getQueryBatch } from '../lib/api';
import type { QueryBatch, QueryJob } from '../types';

interface BatchDetail extends QueryBatch {
  jobs: QueryJob[];
  results: Array<{
    queryJobId: string;
    clientId: string;
    headers: string[];
    rows: unknown[][];
    rowCount: number;
    isTruncated: boolean;
  }>;
}

const STATUS_COLOR: Record<string, string> = {
  Success: 'text-emerald-400',
  Failed: 'text-red-400',
  Running: 'text-sky-400',
  Pending: 'text-amber-400',
  Completed: 'text-emerald-400',
};

export function QueryHistoryPanel() {
  const { batches, log } = useIfessStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async (batchId: string) => {
    if (expanded === batchId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(batchId);
    setLoading(true);
    try {
      const d = await getQueryBatch(batchId);
      setDetail(d as BatchDetail);
    } catch (e) {
      log(`Load batch detail failed: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-sm font-semibold mb-3 shrink-0">Query History</h2>
      <div className="overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-[#333] text-gray-400 text-left sticky top-0">
            <tr>
              <th className="px-2 py-2 w-6"></th>
              <th className="px-3 py-2">Batch ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Success/Failed</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No query batches yet. Dispatch a query from the Query Editor or Template Explorer.
                </td>
              </tr>
            )}
            {batches.map((b) => (
              <Fragment key={b.queryBatchId}>
                <tr key={b.queryBatchId} className="border-t border-[#3c3c3c] hover:bg-[#2a2d2e] cursor-pointer" onClick={() => toggle(b.queryBatchId)}>
                  <td className="px-2 py-2 text-gray-500">{expanded === b.queryBatchId ? '▼' : '▶'}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{b.queryBatchId}</td>
                  <td className="px-3 py-2">{b.queryName}</td>
                  <td className={`px-3 py-2 ${STATUS_COLOR[b.status] || 'text-gray-300'}`}>{b.status}</td>
                  <td className="px-3 py-2">
                    <span className="text-emerald-400">{b.successCount}</span>
                    <span className="text-gray-600">/</span>
                    <span className="text-red-400">{b.failedCount}</span>
                    <span className="text-gray-600 ml-2">({b.totalTarget})</span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{new Date(b.createdAt).toLocaleString('id-ID')}</td>
                </tr>
                {expanded === b.queryBatchId && (
                  <tr key={`${b.queryBatchId}-detail`} className="border-t border-[#2d2d2d]">
                    <td colSpan={6} className="px-3 py-3 bg-[#1e1e1e]">
                      {loading && <div className="text-gray-500 text-[12px]">Loading...</div>}
                      {!loading && detail && (
                        <div className="space-y-4">
                          {/* Query text */}
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Query</div>
                            <pre className="bg-[#252526] border border-[#3c3c3c] rounded p-2 text-[11px] font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">{detail.queryText}</pre>
                          </div>
                          {/* Jobs status */}
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Jobs ({detail.jobs.length})</div>
                            <div className="flex flex-wrap gap-2">
                              {detail.jobs.map((j) => (
                                <span key={j.queryJobId} className={`text-[10px] px-2 py-1 rounded bg-[#252526] border border-[#3c3c3c] ${STATUS_COLOR[j.status] || 'text-gray-400'}`}>
                                  {j.targetClientId.slice(0, 16)} · {j.status} · {j.rowCount} rows
                                  {j.errorMessage && <span className="text-red-400 ml-1">⚠ {j.errorMessage.slice(0, 40)}</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                          {/* Result grids */}
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Results</div>
                            {detail.results.length === 0 && <div className="text-gray-500 text-[12px]">No results yet — clients have not reported back.</div>}
                            {detail.results.map((r) => (
                              <div key={r.queryJobId} className="mb-3 border border-[#3c3c3c] rounded">
                                <div className="bg-[#252526] px-2 py-1 text-[11px] text-gray-400 border-b border-[#3c3c3c] flex justify-between">
                                  <span>{r.clientId}</span>
                                  <span>{r.rowCount} rows {r.isTruncated && <span className="text-amber-400">(truncated)</span>}</span>
                                </div>
                                <div className="overflow-x-auto max-h-64">
                                  {r.headers.length > 0 && r.rows.length > 0 ? (
                                    <table className="w-full text-[11px]">
                                      <thead className="bg-[#2d2d2d] text-gray-400 text-left sticky top-0">
                                        <tr>
                                          {r.headers.map((h, i) => <th key={i} className="px-2 py-1 font-medium">{h}</th>)}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.rows.slice(0, 100).map((row, ri) => (
                                          <tr key={ri} className="border-t border-[#2d2d2d]">
                                            {r.headers.map((_, ci) => (
                                              <td key={ci} className="px-2 py-1 text-gray-300 font-mono">{String(row[ci] ?? '')}</td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="p-2 text-gray-500 text-[11px]">Empty result set</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
