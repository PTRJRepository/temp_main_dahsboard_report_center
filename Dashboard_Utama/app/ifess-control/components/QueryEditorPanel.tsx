'use client';

import { useState } from 'react';
import { useIfessStore } from '../stores/ifessStore';
import { validateQuery, dispatchQuery, getQueryBatch, listClients } from '../lib/api';

interface QueryResult {
  queryJobId: string;
  clientId: string;
  headers: string[];
  rows: unknown[][];
  rowCount: number;
  isTruncated: boolean;
}

export function QueryEditorPanel() {
  const { clients, log, setClients } = useIfessStore();
  const [queryText, setQueryText] = useState('SELECT RDB$RELATION_NAME AS TABLE_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0 ORDER BY RDB$RELATION_NAME');
  const [maxRows, setMaxRows] = useState(100);
  const [targetClient, setTargetClient] = useState('');
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [results, setResults] = useState<QueryResult[] | null>(null);
  const [error, setError] = useState<string>('');

  const ensureClients = async () => {
    if (clients.length === 0) {
      try { setClients(await listClients()); } catch {}
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleExecute = async () => {
    setError('');
    setResults(null);
    setValidation(null);
    setLoading(true);
    setStatus('Validating...');

    try {
      const valid = await validateQuery(queryText);
      setValidation(valid);
      if (!valid.valid) {
        setStatus(`Invalid: ${valid.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      await ensureClients();
      const target = targetClient || clients[0]?.clientId || '';
      if (!target) {
        setError('No client available. Register a client first.');
        setLoading(false);
        return;
      }

      setStatus(`Dispatching to ${target}...`);
      const disp = await dispatchQuery({
        queryName: 'Ad-hoc Query',
        queryText,
        targetMode: 'SingleClient',
        targetClientIds: [target],
        maxRows,
      });

      // Poll until batch complete
      setStatus(`Executing (batch ${disp.queryBatchId.slice(0, 18)}...)...`);
      let batch: Awaited<ReturnType<typeof getQueryBatch>> | null = null;
      for (let i = 0; i < 40; i++) {
        await sleep(1000);
        batch = await getQueryBatch(disp.queryBatchId);
        if (batch.status === 'Completed' || batch.status === 'Success' || batch.status === 'Failed') break;
      }

      if (!batch) {
        setError('No response from batch');
        setLoading(false);
        return;
      }

      const res = (batch as { results?: QueryResult[] }).results || [];
      setResults(res);
      const totalRows = res.reduce((s, r) => s + r.rowCount, 0);
      setStatus(`Done — ${batch.status}, ${res.length} job(s), ${totalRows} row(s) total`);
      log(`Query executed: ${totalRows} rows from ${target}`, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      setStatus(`Error: ${msg}`);
      log(`Query error: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-3">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold">Query Editor</h2>
        <button
          onClick={handleExecute}
          disabled={loading}
          className="px-4 py-1.5 text-[12px] bg-[#0c6da8] hover:bg-[#0d7fc0] disabled:bg-[#3c3c3c] rounded text-white font-medium"
        >
          {loading ? 'Running...' : 'Execute (Ctrl+Enter)'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 shrink-0">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Target Client</label>
          <select
            value={targetClient}
            onChange={(e) => setTargetClient(e.target.value)}
            onClick={ensureClients}
            className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1"
          >
            <option value="">First available</option>
            {clients.map((c) => (
              <option key={c.clientId} value={c.clientId}>
                {c.clientName} ({c.status})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">Max Rows</label>
          <input
            type="number"
            value={maxRows}
            onChange={(e) => setMaxRows(parseInt(e.target.value) || 100)}
            className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1"
          />
        </div>
        <div className="flex items-end">
          <span className={`text-[11px] ${loading ? 'text-amber-400' : status.startsWith('Done') ? 'text-emerald-400' : status.startsWith('Error') || status.startsWith('Invalid') ? 'text-red-400' : 'text-gray-400'}`}>
            {status || 'Ready'}
          </span>
        </div>
      </div>

      <textarea
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'Enter' && !loading) handleExecute();
        }}
        className="h-32 shrink-0 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 text-[13px] font-mono text-gray-100 resize-none focus:outline-none focus:border-[#0c6da8]"
        spellCheck={false}
      />

      {validation && !validation.valid && (
        <div className="text-[12px] px-3 py-2 rounded border bg-red-900/30 border-red-700 text-red-300 shrink-0">
          Invalid: {validation.errors.join(', ')}
        </div>
      )}
      {error && (
        <div className="text-[12px] px-3 py-2 rounded border bg-red-900/30 border-red-700 text-red-300 shrink-0">
          {error}
        </div>
      )}

      {/* Result grid */}
      <div className="flex-1 overflow-auto border border-[#3c3c3c] rounded bg-[#1e1e1e] min-h-0">
        {!results && !loading && (
          <div className="h-full flex items-center justify-center text-gray-600 text-[12px]">
            No results yet. Write a SELECT query and click Execute.
          </div>
        )}
        {loading && !results && (
          <div className="h-full flex items-center justify-center text-amber-400 text-[12px]">
            {status}...
          </div>
        )}
        {results && results.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-500 text-[12px]">
            Query completed but no results returned. (Client may not have executed yet.)
          </div>
        )}
        {results && results.length > 0 && (
          <div className="p-2 space-y-3">
            {results.map((r) => (
              <div key={r.queryJobId} className="border border-[#3c3c3c] rounded">
                <div className="bg-[#252526] px-2 py-1 text-[11px] text-gray-400 border-b border-[#3c3c3c] flex justify-between">
                  <span>{r.clientId}</span>
                  <span>
                    {r.rowCount} rows {r.isTruncated && <span className="text-amber-400">(truncated)</span>}
                  </span>
                </div>
                <div className="overflow-auto max-h-[400px]">
                  {r.headers.length > 0 && r.rows.length > 0 ? (
                    <table className="w-full text-[11px]">
                      <thead className="bg-[#2d2d2d] text-gray-400 text-left sticky top-0">
                        <tr>
                          {r.headers.map((h, i) => (
                            <th key={i} className="px-2 py-1 font-medium border-r border-[#1e1e1e]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.rows.map((row, ri) => (
                          <tr key={ri} className="border-t border-[#2d2d2d] hover:bg-[#252526]">
                            {r.headers.map((_, ci) => (
                              <td key={ci} className="px-2 py-1 text-gray-300 font-mono border-r border-[#1e1e1e]">
                                {String(row[ci] ?? '')}
                              </td>
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
        )}
      </div>
    </div>
  );
}
