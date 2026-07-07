'use client';

import { useIfessStore } from '../stores/ifessStore';
import { useMemo } from 'react';

export function ClientDetailPanel({ clientId }: { clientId: string }) {
  const { clients, moduleStatuses, commands } = useIfessStore();
  const client = useMemo(() => clients.find((c) => c.clientId === clientId), [clients, clientId]);
  const statuses = useMemo(() => moduleStatuses.filter((m) => m.clientId === clientId), [moduleStatuses, clientId]);
  const clientCommands = useMemo(() => commands.filter((c) => c.clientId === clientId), [commands, clientId]);

  if (!client) return <div className="text-gray-400">Client not found</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{client.clientName}</h2>
      <div className="grid grid-cols-2 gap-4 text-[12px]">
        <Info label="Client ID" value={client.clientId} />
        <Info label="Machine" value={client.machineName || '-'} />
        <Info label="Environment" value={client.environment || '-'} />
        <Info label="OS" value={client.os || '-'} />
        <Info label="App Version" value={client.appVersion || '-'} />
        <Info label="Status" value={client.status} />
        <Info label="Uptime" value={client.uptimeSeconds ? `${Math.floor(client.uptimeSeconds / 3600)}h` : '-'} />
        <Info label="Last Heartbeat" value={client.lastHeartbeatAt ? new Date(client.lastHeartbeatAt).toLocaleString('id-ID') : '-'} />
      </div>

      <div>
        <h3 className="text-[12px] font-semibold mb-2 text-gray-300">Modules</h3>
        <div className="space-y-2">
          {statuses.length === 0 && <div className="text-gray-500 text-[11px]">No module status reported</div>}
          {statuses.map((m) => (
            <div key={m.moduleCode} className="bg-[#252526] border border-[#3c3c3c] rounded p-2 flex justify-between items-center">
              <span className="text-[12px]">{m.moduleCode}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded ${statusColor(m.status)}`}>{m.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[12px] font-semibold mb-2 text-gray-300">Recent Commands</h3>
        <table className="w-full text-[11px]">
          <thead className="bg-[#333] text-gray-400 text-left">
            <tr>
              <th className="px-2 py-1">Type</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Created</th>
            </tr>
          </thead>
          <tbody>
            {clientCommands.slice(0, 10).map((c) => (
              <tr key={c.commandId} className="border-t border-[#3c3c3c]">
                <td className="px-2 py-1">{c.commandType}</td>
                <td className="px-2 py-1">{c.status}</td>
                <td className="px-2 py-1 text-gray-500">{new Date(c.createdAt).toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#252526] border border-[#3c3c3c] rounded p-2">
      <div className="text-gray-500 text-[10px] mb-0.5">{label}</div>
      <div className="text-gray-200">{value}</div>
    </div>
  );
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    Running: 'bg-emerald-500/20 text-emerald-400',
    Stopped: 'bg-gray-500/20 text-gray-400',
    Error: 'bg-red-500/20 text-red-400',
    Pending: 'bg-yellow-500/20 text-yellow-400',
  };
  return map[status] || 'bg-gray-500/20 text-gray-400';
}
