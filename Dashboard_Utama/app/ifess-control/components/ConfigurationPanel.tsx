'use client';

import { useState } from 'react';
import { useIfessStore } from '../stores/ifessStore';

export function ConfigurationPanel() {
  const { clients } = useIfessStore();
  const [selectedClient, setSelectedClient] = useState('');
  const [configText, setConfigText] = useState('');

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Configuration Editor</h2>
      <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full bg-[#3c3c3c] border border-[#4c4c4c] rounded text-[12px] px-2 py-1">
        <option value="">Select client...</option>
        {clients.map((c) => (
          <option key={c.clientId} value={c.clientId}>
            {c.clientName}
          </option>
        ))}
      </select>
      <textarea
        value={configText}
        onChange={(e) => setConfigText(e.target.value)}
        placeholder="Client configuration JSON..."
        className="w-full h-64 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-3 text-[13px] font-mono text-gray-100 resize-none focus:outline-none focus:border-[#0c6da8]"
      />
      <button className="px-4 py-2 text-[12px] bg-[#0c6da8] hover:bg-[#0d7fc0] rounded text-white font-medium" disabled={!selectedClient}>
        Save Config
      </button>
    </div>
  );
}
