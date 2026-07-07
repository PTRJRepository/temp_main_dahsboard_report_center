'use client';

import { useEffect, useState } from 'react';
import { useIfessStore } from '../stores/ifessStore';
import { ObjectExplorer } from './ObjectExplorer';
import { QueryEditorPanel } from './QueryEditorPanel';
import { QueryHistoryPanel } from './QueryHistoryPanel';
import { QueryTemplatePanel } from './QueryTemplatePanel';
import { DashboardPanel } from './DashboardPanel';
import { listClients, listCommands, listModuleStatuses, listClientGroups, listAuditLogs, listQueryBatches, listQueryTemplates } from '../lib/api';

type View = 'query' | 'history' | 'templates' | 'dashboard' | 'explorer';

const MENU: { id: View; label: string; icon: string }[] = [
  { id: 'query', label: 'Query Editor', icon: '🔍' },
  { id: 'history', label: 'Query History', icon: '📋' },
  { id: 'templates', label: 'Templates', icon: '📚' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'explorer', label: 'Object Explorer', icon: '🗂' },
];

export function IfessControlShell() {
  const { log, setClients, setCommands, setModuleStatuses, setGroups, setBatches, setAuditLogs, setTemplates } = useIfessStore();
  const [view, setView] = useState<View>('query');

  const loadData = async () => {
    try {
      const [clients, commands, moduleStatuses, groups, batches, auditLogs, templates] = await Promise.all([
        listClients(),
        listCommands().catch(() => []),
        listModuleStatuses().catch(() => []),
        listClientGroups().catch(() => []),
        listQueryBatches().catch(() => []),
        listAuditLogs().catch(() => []),
        listQueryTemplates().catch(() => []),
      ]);
      setClients(clients);
      setCommands(commands);
      setModuleStatuses(moduleStatuses);
      setGroups(groups);
      setBatches(batches);
      setAuditLogs(auditLogs);
      setTemplates(templates);
    } catch (e) {
      log(`Load failed: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen flex bg-[#1e1e1e] text-gray-100 font-sans text-[13px] overflow-hidden">
      {/* Sidebar */}
      <div className="w-48 bg-[#252526] border-r border-[#3c3c3c] flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-[#3c3c3c]">
          <div className="text-white font-semibold text-sm">IFESS Control</div>
          <div className="text-[10px] text-gray-500">Query & Client Console</div>
        </div>
        <nav className="flex-1 py-2">
          {MENU.map((m) => (
            <button
              key={m.id}
              onClick={() => setView(m.id)}
              className={`w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 border-l-2 ${
                view === m.id
                  ? 'bg-[#0c6da8]/20 border-l-[#0c6da8] text-white'
                  : 'border-l-transparent text-gray-400 hover:bg-[#2a2d2e] hover:text-white'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </nav>
        <button onClick={loadData} className="px-3 py-2 text-[11px] text-gray-400 hover:text-white border-t border-[#3c3c3c] text-left">
          ↻ Refresh
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {view === 'query' && (
          <div className="flex-1 p-4 overflow-hidden">
            <QueryEditorPanel />
          </div>
        )}
        {view === 'history' && (
          <div className="flex-1 p-4 overflow-auto">
            <QueryHistoryPanel />
          </div>
        )}
        {view === 'templates' && (
          <div className="flex-1 overflow-hidden">
            <QueryTemplatePanel />
          </div>
        )}
        {view === 'dashboard' && (
          <div className="flex-1 p-4 overflow-auto">
            <DashboardPanel />
          </div>
        )}
        {view === 'explorer' && (
          <div className="flex-1 overflow-hidden">
            <ObjectExplorer />
          </div>
        )}
      </div>
    </div>
  );
}
