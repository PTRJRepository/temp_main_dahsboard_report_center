'use client';

import { useIfessStore } from '../stores/ifessStore';
import { DashboardPanel } from './DashboardPanel';
import { ClientDetailPanel } from './ClientDetailPanel';
import { CommandCenterPanel } from './CommandCenterPanel';
import { QueryEditorPanel } from './QueryEditorPanel';
import { QueryTemplatePanel } from './QueryTemplatePanel';
import { QueryHistoryPanel } from './QueryHistoryPanel';
import { AuditLogPanel } from './AuditLogPanel';
import { ClientGroupPanel } from './ClientGroupPanel';
import { ConfigurationPanel } from './ConfigurationPanel';
import { ModulePanel } from './ModulePanel';

export function MainWorkspace() {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useIfessStore();

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
      {openTabs.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Select an object from the Object Explorer to open a detail tab.
        </div>
      )}

      {openTabs.length > 0 && (
        <>
          <div className="flex border-b border-[#3c3c3c] shrink-0 overflow-x-auto">
            {openTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-[11px] border-r border-[#3c3c3c] flex items-center gap-2 whitespace-nowrap ${
                  activeTabId === tab.id ? 'bg-[#1e1e1e] text-white border-b-2 border-b-[#0c6da8]' : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#333]'
                }`}
              >
                {tab.label}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="text-gray-500 hover:text-white ml-1"
                >
                  ×
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {openTabs.map((tab) => (
              <div key={tab.id} className={activeTabId === tab.id ? 'block h-full' : 'hidden'}>
                <TabContent nodeType={tab.nodeType} nodeId={tab.nodeId} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TabContent({ nodeType, nodeId }: { nodeType: string; nodeId: string }) {
  switch (nodeType) {
    case 'dashboard':
      return <DashboardPanel />;
    case 'client':
      return <ClientDetailPanel clientId={nodeId.replace('client-', '')} />;
    case 'clients':
    case 'client-status':
      return <ClientListPanel />;
    case 'client-groups':
    case 'client-group':
      return <ClientGroupPanel groupCode={nodeId.startsWith('group-') ? nodeId.replace('group-', '') : undefined} />;
    case 'modules':
      return <ModulePanel />;
    case 'commands':
    case 'command-status':
      return <CommandCenterPanel />;
    case 'query-editor':
      return <QueryEditorPanel />;
    case 'query-templates':
      return <QueryTemplatePanel />;
    case 'query-history':
      return <QueryHistoryPanel />;
    case 'configuration':
      return <ConfigurationPanel />;
    case 'audit-logs':
      return <AuditLogPanel />;
    default:
      return <div className="text-gray-400">Panel not yet implemented for {nodeType}</div>;
  }
}

function ClientListPanel() {
  const { clients } = useIfessStore();
  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Clients</h2>
      <table className="w-full text-[12px]">
        <thead className="bg-[#333] text-gray-400 text-left">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Machine</th>
            <th className="px-3 py-2">Last Heartbeat</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.clientId} className="border-t border-[#3c3c3c]">
              <td className="px-3 py-2 text-gray-200">{c.clientName}</td>
              <td className="px-3 py-2">{c.status}</td>
              <td className="px-3 py-2 text-gray-400">{c.machineName || '-'}</td>
              <td className="px-3 py-2 text-gray-500">{c.lastHeartbeatAt ? new Date(c.lastHeartbeatAt).toLocaleString('id-ID') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
