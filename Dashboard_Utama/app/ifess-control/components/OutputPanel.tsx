'use client';

import { useIfessStore } from '../stores/ifessStore';

export function OutputPanel() {
  const { logs, clearLogs } = useIfessStore();

  return (
    <div className="h-48 border-t border-[#3c3c3c] bg-[#252526] flex flex-col shrink-0">
      <div className="bg-[#2d2d2d] border-b border-[#3c3c3c] px-3 py-1.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Output</span>
        <button onClick={clearLogs} className="text-[11px] text-gray-400 hover:text-white">
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1">
        {logs.length === 0 && <div className="text-gray-500">No output yet...</div>}
        {logs.map((log) => (
          <div key={log.id} className={`flex gap-2 ${log.level === 'error' ? 'text-red-400' : log.level === 'success' ? 'text-emerald-400' : log.level === 'warning' ? 'text-yellow-400' : 'text-gray-300'}`}>
            <span className="text-gray-600">[{log.timestamp}]</span>
            <span className="uppercase text-[10px] text-gray-500">{log.level}</span>
            <span>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
