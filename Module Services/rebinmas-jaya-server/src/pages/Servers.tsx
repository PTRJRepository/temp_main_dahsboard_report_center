import React, { useState } from 'react';
import { useMonitoring } from '../store/MonitoringContext';
import { Server as ServerIcon, Search, Plus, Filter, MoreVertical } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { AssetStatus } from '../types';

const StatusBadge = ({ status }: { status: AssetStatus }) => {
  const styles = {
    healthy: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    offline: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize", styles[status])}>
      {status}
    </span>
  );
};

export default function Servers() {
  const { servers, loading, error, refresh } = useMonitoring();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredServers = servers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.ipAddress.includes(searchTerm)
  );

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center">
            <ServerIcon className="h-6 w-6 mr-2 text-blue-400" />
            Servers
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage and monitor physical and virtual servers.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-900 border border-gray-800 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button className="flex items-center justify-center px-3 py-1.5 border border-gray-700 bg-gray-800 text-gray-200 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            Filter
          </button>
          <button
            onClick={() => void refresh()}
            className="flex items-center justify-center px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-blue-200">
          Loading live server metrics...
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 bg-gray-900/80 uppercase border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Server Name</th>
                <th className="px-4 py-3 font-medium">IP Address</th>
                <th className="px-4 py-3 font-medium">Environment</th>
                <th className="px-4 py-3 font-medium">CPU</th>
                <th className="px-4 py-3 font-medium">RAM</th>
                <th className="px-4 py-3 font-medium">Disk</th>
                <th className="px-4 py-3 font-medium">Last Check</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredServers.map((server) => (
                <tr key={server.id} className="hover:bg-gray-800/50 transition-colors group">
                  <td className="px-4 py-3">
                    <StatusBadge status={server.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-200">{server.name}</div>
                    <div className="text-xs text-gray-500">{server.os}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{server.ipAddress}</td>
                  <td className="px-4 py-3 text-gray-400">{server.environment}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-medium w-8", server.cpuUsage > 80 ? "text-red-400" : "text-gray-300")}>{server.cpuUsage}%</span>
                      <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden hidden sm:block">
                        <div className={cn("h-full", server.cpuUsage > 80 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${server.cpuUsage}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-medium w-8", server.ramUsage > 80 ? "text-red-400" : "text-gray-300")}>{server.ramUsage}%</span>
                      <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden hidden sm:block">
                        <div className={cn("h-full", server.ramUsage > 80 ? "bg-orange-500" : "bg-blue-500")} style={{ width: `${server.ramUsage}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-medium w-8", server.diskUsage > 90 ? "text-red-400" : "text-gray-300")}>{server.diskUsage}%</span>
                      <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden hidden sm:block">
                        <div className={cn("h-full", server.diskUsage > 90 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${server.diskUsage}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(server.lastCheck)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1 text-gray-500 hover:text-gray-300 transition-colors rounded">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredServers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No servers found matching "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
