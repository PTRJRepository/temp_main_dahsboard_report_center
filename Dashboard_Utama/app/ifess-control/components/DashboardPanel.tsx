'use client';

import { useIfessStore } from '../stores/ifessStore';

export function DashboardPanel() {
  const { clients, commands, moduleStatuses } = useIfessStore();

  const online = clients.filter((c) => c.status === 'Online').length;
  const offline = clients.filter((c) => c.status === 'Offline' || c.status === 'Error').length;
  const pending = commands.filter((c) => c.status === 'Pending').length;
  const failed = commands.filter((c) => c.status === 'Failed').length;
  const running = moduleStatuses.filter((m) => m.status === 'Running').length;

  return (
    <div>
      <h2 className="text-sm font-semibold mb-4">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={clients.length} color="bg-blue-500" />
        <StatCard title="Online" value={online} color="bg-emerald-500" />
        <StatCard title="Offline/Error" value={offline} color="bg-gray-500" />
        <StatCard title="Pending Commands" value={pending} color="bg-yellow-500" />
        <StatCard title="Failed Commands" value={failed} color="bg-red-500" />
        <StatCard title="Running Modules" value={running} color="bg-emerald-500" />
        <StatCard title="Total Commands" value={commands.length} color="bg-blue-500" />
        <StatCard title="Total Modules" value={moduleStatuses.length} color="bg-purple-500" />
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="bg-[#252526] border border-[#3c3c3c] rounded p-4">
      <div className={`w-3 h-3 rounded-full mb-2 ${color}`} />
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="text-[11px] text-gray-400">{title}</div>
    </div>
  );
}
