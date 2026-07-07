'use client';

import { useState } from 'react';
import { useIfessStore } from '../stores/ifessStore';
import { createClientGroup } from '../lib/api';

export function ClientGroupPanel({ groupCode }: { groupCode?: string }) {
  const { groups, clients, log, setGroups } = useIfessStore();
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const group = groupCode ? groups.find((g) => g.groupCode === groupCode) : undefined;

  const handleCreate = async () => {
    try {
      const result = await createClientGroup({
        groupCode: newGroupCode,
        groupName: newGroupName,
        description: newDescription,
      });
      if (result.success) {
        setGroups([...groups, result.group]);
        log('Client group created', 'success');
      }
    } catch (e) {
      log(`Failed to create group: ${e instanceof Error ? e.message : 'Unknown'}`, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{group ? group.groupName : 'Client Groups'}</h2>

      {!group && (
        <div className="bg-[#252526] border border-[#3c3c3c] rounded p-4 space-y-3">
          <h3 className="text-[12px] font-semibold text-gray-300">Create Group</h3>
          <div className="grid grid-cols-3 gap-3">
            <input value={newGroupCode} onChange={(e) => setNewGroupCode(e.target.value)} placeholder="Group Code" className="bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
            <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Group Name" className="bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
            <button onClick={handleCreate} className="px-3 py-1 text-[12px] bg-[#0c6da8] hover:bg-[#0d7fc0] rounded text-white">
              Create
            </button>
          </div>
          <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Description" className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1" />
        </div>
      )}

      {group && (
        <div className="bg-[#252526] border border-[#3c3c3c] rounded p-4">
          <div className="text-[12px] text-gray-400 mb-2">{group.description || 'No description'}</div>
          <h3 className="text-[12px] font-semibold text-gray-300 mb-2">Members</h3>
          <div className="space-y-1">
            {(group.clients || []).length === 0 && <div className="text-gray-500 text-[11px]">No members</div>}
            {(group.clients || []).map((clientId) => {
              const client = clients.find((c) => c.clientId === clientId);
              return (
                <div key={clientId} className="text-[12px] text-gray-300">
                  {client ? client.clientName : clientId}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!group && (
        <table className="w-full text-[12px]">
          <thead className="bg-[#333] text-gray-400 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Members</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.groupCode} className="border-t border-[#3c3c3c]">
                <td className="px-3 py-2">{g.groupCode}</td>
                <td className="px-3 py-2">{g.groupName}</td>
                <td className="px-3 py-2">{(g.clients || []).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
