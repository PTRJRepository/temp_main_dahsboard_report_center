'use client';

import { useIfessStore } from '../stores/ifessStore';

export function ModulePanel() {
  const { moduleStatuses, clients } = useIfessStore();

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Modules</h2>
      <table className="w-full text-[12px]">
        <thead className="bg-[#333] text-gray-400 text-left">
          <tr>
            <th className="px-3 py-2">Client</th>
            <th className="px-3 py-2">Module</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">PID</th>
            <th className="px-3 py-2">Restarts</th>
            <th className="px-3 py-2">Last Error</th>
          </tr>
        </thead>
        <tbody>
          {moduleStatuses.map((m) => {
            const client = clients.find((c) => c.clientId === m.clientId);
            return (
              <tr key={`${m.clientId}-${m.moduleCode}`} className="border-t border-[#3c3c3c]">
                <td className="px-3 py-2">{client ? client.clientName : m.clientId}</td>
                <td className="px-3 py-2">{m.moduleCode}</td>
                <td className="px-3 py-2">{m.status}</td>
                <td className="px-3 py-2">{m.pid || '-'}</td>
                <td className="px-3 py-2">{m.restartCount}</td>
                <td className="px-3 py-2 text-red-400">{m.lastError || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
