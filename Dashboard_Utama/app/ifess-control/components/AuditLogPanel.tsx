'use client';

import { useIfessStore } from '../stores/ifessStore';

export function AuditLogPanel() {
  const { auditLogs } = useIfessStore();

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Audit Logs</h2>
      <table className="w-full text-[12px]">
        <thead className="bg-[#333] text-gray-400 text-left">
          <tr>
            <th className="px-3 py-2">Timestamp</th>
            <th className="px-3 py-2">Actor</th>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Object</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {auditLogs.map((log) => (
            <tr key={log.auditId} className="border-t border-[#3c3c3c]">
              <td className="px-3 py-2 text-gray-400">{new Date(log.timestamp).toLocaleString('id-ID')}</td>
              <td className="px-3 py-2">{log.actorName}</td>
              <td className="px-3 py-2">{log.action}</td>
              <td className="px-3 py-2">{log.objectType} {log.objectId || ''}</td>
              <td className="px-3 py-2">{log.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
