'use client';

import { useMemo, useState } from 'react';
import { useIfessStore } from '../stores/ifessStore';
import { createQueryTemplate, validateQuery, dispatchQuery } from '../lib/api';
import type { QueryTemplate } from '../types';

const STATUS_COLOR: Record<string, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-sky-400',
};

export function QueryTemplatePanel() {
  const { templates, clients, groups, log, setTemplates } = useIfessStore();
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<QueryTemplate | null>(null);
  const [form, setForm] = useState<Partial<QueryTemplate>>({
    templateCode: '',
    templateName: '',
    description: '',
    queryText: '',
    defaultMaxRows: 1000,
    defaultTimeoutSeconds: 30,
    tags: [],
  });
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [targetMode, setTargetMode] = useState<'AllClients' | 'SingleClient' | 'ClientGroup'>('AllClients');
  const [targetClient, setTargetClient] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  const [running, setRunning] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Group templates by tag (folder-like explorer)
  const grouped = useMemo(() => {
    const filtered = templates.filter((t) => {
      if (activeTag && !(t.tags || []).includes(activeTag)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.templateCode.toLowerCase().includes(q) ||
          t.templateName.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
    const map = new Map<string, QueryTemplate[]>();
    filtered.forEach((t) => {
      (t.tags && t.tags.length ? t.tags : ['untagged']).forEach((tag) => {
        if (!map.has(tag)) map.set(tag, []);
        map.get(tag)!.push(t);
      });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates, search, activeTag]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    templates.forEach((t) => (t.tags || []).forEach((tag) => s.add(tag)));
    return Array.from(s).sort();
  }, [templates]);

  const loadIntoEditor = (t: QueryTemplate) => {
    setSelected(t);
    setForm({
      templateCode: t.templateCode,
      templateName: t.templateName,
      description: t.description || '',
      queryText: t.queryText,
      defaultMaxRows: t.defaultMaxRows,
      defaultTimeoutSeconds: t.defaultTimeoutSeconds,
      tags: t.tags || [],
    });
    setValidation(null);
  };

  const handleValidate = async () => {
    if (!form.queryText) return;
    try {
      const result = await validateQuery(form.queryText);
      setValidation(result);
      log(result.valid ? `Template "${form.templateCode}" valid` : `Invalid: ${result.errors.join(', ')}`, result.valid ? 'success' : 'error');
    } catch (e) {
      log(`Validate error: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    }
  };

  const handleDispatch = async () => {
    if (!form.queryText) return;
    setRunning(true);
    try {
      const v = await validateQuery(form.queryText);
      if (!v.valid) {
        setValidation(v);
        log(`Query invalid: ${v.errors.join(', ')}`, 'error');
        return;
      }
      const result = await dispatchQuery({
        queryName: form.templateName || form.templateCode || 'Ad-hoc',
        queryText: form.queryText,
        targetMode,
        targetClientIds: targetMode === 'SingleClient' && targetClient ? [targetClient] : [],
        targetGroup: targetMode === 'ClientGroup' ? targetGroup : undefined,
        maxRows: form.defaultMaxRows || 1000,
        timeoutSeconds: form.defaultTimeoutSeconds || 30,
      });
      log(`Dispatched "${form.templateCode || 'ad-hoc'}" → ${result.targetCount} client(s). Batch ${result.queryBatchId}`, 'success');
    } catch (e) {
      log(`Dispatch error: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleCreate = async () => {
    try {
      const result = await createQueryTemplate(form as QueryTemplate) as { success: boolean; template?: QueryTemplate; error?: string };
      if (result.success && result.template) {
        setTemplates([...templates, result.template]);
        log(`Template "${result.template.templateCode}" saved`, 'success');
        setShowCreate(false);
        setForm({ templateCode: '', templateName: '', description: '', queryText: '', defaultMaxRows: 1000, defaultTimeoutSeconds: 30, tags: [] });
      } else {
        log(`Save failed: ${result.error || 'unknown'}`, 'error');
      }
    } catch (e) {
      log(`Save error: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    }
  };

  return (
    <div className="h-full flex">
      {/* ── Left: Template Explorer (folder/tree) ── */}
      <div className="w-72 border-r border-[#3c3c3c] flex flex-col bg-[#252526]">
        <div className="p-2 border-b border-[#3c3c3c] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider">Template Explorer</span>
            <button onClick={() => setShowCreate((s) => !s)} className="text-[11px] text-sky-400 hover:text-sky-300">+ New</button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1"
          />
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveTag(null)}
              className={`text-[10px] px-2 py-0.5 rounded ${activeTag === null ? 'bg-[#0c6da8] text-white' : 'bg-[#333] text-gray-400 hover:text-white'}`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`text-[10px] px-2 py-0.5 rounded ${activeTag === tag ? 'bg-[#0c6da8] text-white' : 'bg-[#333] text-gray-400 hover:text-white'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 && <div className="p-3 text-[12px] text-gray-500">No templates</div>}
          {grouped.map(([tag, items]) => (
            <div key={tag} className="border-b border-[#2d2d2d]">
              <div className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wider bg-[#1e1e1e] flex items-center gap-1">
                <span className="text-amber-500">📁</span> {tag} <span className="text-gray-600">({items.length})</span>
              </div>
              {items.map((t) => (
                <button
                  key={t.templateCode}
                  onClick={() => loadIntoEditor(t)}
                  className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 border-l-2 ${
                    selected?.templateCode === t.templateCode
                      ? 'bg-[#0c6da8]/20 border-l-[#0c6da8] text-white'
                      : 'border-l-transparent text-gray-300 hover:bg-[#2a2d2e]'
                  }`}
                >
                  <span className="text-sky-500">📄</span>
                  <span className="flex-1 truncate">{t.templateName}</span>
                  <span className="text-[10px] text-gray-600">{t.defaultMaxRows}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Editor / Detail ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected && !showCreate && (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Select a template from the explorer, or click <span className="text-sky-400 mx-1">+ New</span> to create one.
          </div>
        )}

        {showCreate && (
          <div className="p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold mb-3">New Template</h3>
            <div className="bg-[#252526] border border-[#3c3c3c] rounded p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={form.templateCode} onChange={(e) => setForm({ ...form, templateCode: e.target.value })} placeholder="Template Code (e.g. MY_QUERY)" className="bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
                <input value={form.templateName} onChange={(e) => setForm({ ...form, templateName: e.target.value })} placeholder="Template Name" className="bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
              </div>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
              <textarea value={form.queryText} onChange={(e) => setForm({ ...form, queryText: e.target.value })} placeholder="SELECT ..." className="w-full h-40 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 text-[12px] font-mono" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.defaultMaxRows} onChange={(e) => setForm({ ...form, defaultMaxRows: parseInt(e.target.value) || 1000 })} placeholder="Max Rows" className="bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
                <input type="number" value={form.defaultTimeoutSeconds} onChange={(e) => setForm({ ...form, defaultTimeoutSeconds: parseInt(e.target.value) || 30 })} placeholder="Timeout (s)" className="bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="px-4 py-1.5 text-[12px] bg-[#0c6da8] hover:bg-[#0d7fc0] rounded text-white font-medium">Save</button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-1.5 text-[12px] bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-gray-200">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {selected && !showCreate && (
          <>
            <div className="p-3 border-b border-[#3c3c3c] flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{selected.templateName}</div>
                <div className="text-[11px] text-gray-500">{selected.templateCode} · {(selected.tags || []).join(', ') || 'untagged'}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleValidate} className="px-3 py-1 text-[11px] bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-gray-200 border border-[#4c4c4c]">Validate</button>
                <button onClick={handleDispatch} disabled={running} className="px-4 py-1 text-[11px] bg-[#0c6da8] hover:bg-[#0d7fc0] disabled:bg-[#3c3c3c] rounded text-white font-medium">
                  {running ? 'Running...' : 'Execute'}
                </button>
              </div>
            </div>

            <div className="p-3 border-b border-[#3c3c3c] grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Target Mode</label>
                <select value={targetMode} onChange={(e) => setTargetMode(e.target.value as typeof targetMode)} className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1">
                  <option value="AllClients">All Clients</option>
                  <option value="SingleClient">Single Client</option>
                  <option value="ClientGroup">Client Group</option>
                </select>
              </div>
              {targetMode === 'SingleClient' && (
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Client</label>
                  <select value={targetClient} onChange={(e) => setTargetClient(e.target.value)} className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1">
                    <option value="">Select...</option>
                    {clients.map((c) => <option key={c.clientId} value={c.clientId}>{c.clientName}</option>)}
                  </select>
                </div>
              )}
              {targetMode === 'ClientGroup' && (
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Group</label>
                  <select value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)} className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1">
                    <option value="">Select...</option>
                    {groups.map((g) => <option key={g.groupCode} value={g.groupCode}>{g.groupName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Max Rows</label>
                <input type="number" value={form.defaultMaxRows} onChange={(e) => setForm({ ...form, defaultMaxRows: parseInt(e.target.value) || 1000 })} className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
              </div>
            </div>

            <div className="flex-1 p-3 overflow-auto">
              {selected.description && <div className="text-[12px] text-gray-400 mb-2">{selected.description}</div>}
              <textarea
                value={form.queryText}
                onChange={(e) => setForm({ ...form, queryText: e.target.value })}
                className="w-full h-full min-h-[300px] bg-[#1e1e1e] border border-[#3c3c3c] rounded p-3 text-[13px] font-mono text-gray-100 resize-none focus:outline-none focus:border-[#0c6da8]"
                spellCheck={false}
              />
              {validation && (
                <div className={`mt-2 text-[12px] px-3 py-2 rounded border ${validation.valid ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300' : 'bg-red-900/30 border-red-700 text-red-300'}`}>
                  {validation.valid ? 'Valid — SELECT/WITH only, ready to execute' : `Invalid: ${validation.errors.join(', ')}`}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
