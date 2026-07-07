'use client';

import { useState } from 'react';
import { useIfessStore } from '../stores/ifessStore';
import { createCommand } from '../lib/api';

const COMMAND_TYPES = [
  'PING',
  'RELOAD_CONFIG',
  'START_MODULE',
  'STOP_MODULE',
  'RESTART_MODULE',
  'UPDATE_CONFIG',
  'SHUTDOWN_APP',
  'RESTART_APP',
  'EXECUTE_FIREBIRD_QUERY',
];

export function CommandCenterPanel() {
  const { clients, groups, commands, log } = useIfessStore();
  const [commandType, setCommandType] = useState('PING');
  const [moduleCode, setModuleCode] = useState('');
  const [targetMode, setTargetMode] = useState<'single' | 'multiple' | 'group' | 'all'>('single');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');

  const toggleClient = (clientId: string) => {
    setSelectedClients((prev) => (prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]));
  };

  const handleSend = async () => {
    let targets: string[] = [];
    if (targetMode === 'single') targets = selectedClients.slice(0, 1);
    else if (targetMode === 'multiple') targets = selectedClients;
    else if (targetMode === 'group') {
      const group = groups.find((g) => g.groupCode === selectedGroup);
      targets = group?.clients || [];
    } else if (targetMode === 'all') {
      targets = clients.map((c) => c.clientId);
    }

    for (const clientId of targets) {
      try {
        await createCommand({ clientId, commandType, moduleCode, payload: {} });
        log(`Command ${commandType} sent to ${clientId}`, 'success');
      } catch (e) {
        log(`Failed to send command to ${clientId}: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
      }
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Command Center</h2>
      <div className="bg-[#252526] border border-[#3c3c3c] rounded p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Command Type</label>
            <select value={commandType} onChange={(e) => setCommandType(e.target.value)} className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1">
              {COMMAND_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Module Code (optional)</label>
            <input value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-gray-400 block mb-1">Target</label>
          <select value={targetMode} onChange={(e) => setTargetMode(e.target.value as typeof targetMode)} className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1 mb-2">
            <option value="single">Single Client</option>
            <option value="multiple">Multiple Clients</option>
            <option value="group">Client Group</option>
            <option value="all">All Clients</option>
          </select>

          {targetMode === 'group' && (
            <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1">
              <option value="">Select group...</option>
              {groups.map((g) => (
                <option key={g.groupCode} value={g.groupCode}>
                  {g.groupName}
                </option>
              ))}
            </select>
          )}

          {(targetMode === 'single' || targetMode === 'multiple') && (
            <div className="max-h-32 overflow-y-auto border border-[#3c3c3c] rounded p-2">
              {clients.map((c) => (
                <label key={c.clientId} className="flex items-center gap-2 text-[12px] text-gray-300 hover:bg-[#2a2d2e] p-1 rounded">
                  <input type="checkbox" checked={selectedClients.includes(c.clientId)} onChange={() => toggleClient(c.clientId)} />
                  {c.clientName}
                </label>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleSend} className="px-4 py-2 text-[12px] bg-[#0c6da8] hover:bg-[#0d7fc0] rounded text-white font-medium">
          Send Command
        </button>
      </div>

      <h3 className="text-[12px] font-semibold text-gray-300">Command History</h3>
      <table className="w-full text-[11px]">
        <thead className="bg-[#333] text-gray-400 text-left">
          <tr>
            <th className="px-2 py-1">Client</th>
            <th className="px-2 py-1">Type</th>
            <th className="px-2 py-1">Status</th>
            <th className="px-2 py-1">Created</th>
          </tr>
        </thead>
        <tbody>
          {commands.slice(0, 50).map((c) => (
            <tr key={c.commandId} className="border-t border-[#3c3c3c]">
              <td className="px-2 py-1">{c.clientId}</td>
              <td className="px-2 py-1">{c.commandType}</td>
              <td className="px-2 py-1">{c.status}</td>
              <td className="px-2 py-1 text-gray-500">{new Date(c.createdAt).toLocaleString('id-ID')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
