import React from 'react';
import { useMonitoring } from '../store/MonitoringContext';
import { Server, Network, ShieldAlert, CheckCircle, AlertTriangle, XCircle, Activity, Bell } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { servers, networkDevices, alerts, incidents, cpuHistory, loading, error, refresh } = useMonitoring();

  const totalAssets = servers.length + networkDevices.length;
  const offlineAssets = servers.filter(s => s.status === 'offline').length + networkDevices.filter(n => n.status === 'offline').length;
  const criticalAssets = servers.filter(s => s.status === 'critical').length + networkDevices.filter(n => n.status === 'critical').length;
  const healthyAssets = totalAssets - offlineAssets - criticalAssets - (servers.filter(s => s.status === 'warning').length + networkDevices.filter(n => n.status === 'warning').length);

  const activeIncidents = incidents.filter(i => i.status !== 'Closed' && i.status !== 'Resolved').length;
  const topServers = [...servers].sort((a, b) => b.cpuUsage - a.cpuUsage).slice(0, 5);

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 flex flex-col">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className={cn("text-3xl font-bold mt-2 tracking-tight", colorClass)}>{value}</p>
        </div>
        <div className="p-2 bg-gray-800 rounded-md">
          <Icon className="h-5 w-5 text-gray-300" />
        </div>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-4">{subtitle}</p>}
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Infrastructure Overview</h1>
          <p className="text-sm text-gray-400 mt-1">Runtime status from the gateway host and OS network interfaces.</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="px-3 py-1.5 border border-gray-700 bg-gray-800 text-gray-200 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-blue-200">
          Loading live monitoring snapshot...
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Assets" value={totalAssets} icon={Activity} colorClass="text-white" subtitle="Servers & Network Devices" />
        <StatCard title="Healthy" value={healthyAssets} icon={CheckCircle} colorClass="text-green-500" subtitle="Operating normally" />
        <StatCard title="Critical" value={criticalAssets} icon={AlertTriangle} colorClass="text-orange-500" subtitle="Requires attention" />
        <StatCard title="Offline" value={offlineAssets} icon={XCircle} colorClass="text-red-500" subtitle="Unreachable assets" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts / High Resource */}
        <div className="col-span-2 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-medium text-gray-200 mb-4 flex items-center">
              <Server className="h-4 w-4 mr-2 text-gray-400" />
              Global CPU Utilization (Avg)
            </h3>
            <div className="h-64">
              {cpuHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cpuHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#F3F4F6' }}
                      itemStyle={{ color: '#60A5FA' }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">
                  Waiting for CPU samples from gateway runtime.
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-medium text-gray-200">Top Resource Usage (Servers)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 bg-gray-900/50 uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Server</th>
                    <th className="px-5 py-3 font-medium">CPU</th>
                    <th className="px-5 py-3 font-medium">RAM</th>
                    <th className="px-5 py-3 font-medium">Disk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {topServers.map((server) => (
                    <tr key={server.id} className="hover:bg-gray-800/50">
                      <td className="px-5 py-3 font-medium text-gray-200">{server.name}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center">
                          <span className={cn("mr-2", server.cpuUsage > 80 ? "text-red-400" : "text-gray-300")}>{server.cpuUsage}%</span>
                          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={cn("h-full", server.cpuUsage > 80 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${server.cpuUsage}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center">
                          <span className={cn("mr-2", server.ramUsage > 80 ? "text-red-400" : "text-gray-300")}>{server.ramUsage}%</span>
                          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={cn("h-full", server.ramUsage > 80 ? "bg-orange-500" : "bg-blue-500")} style={{ width: `${server.ramUsage}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center">
                          <span className={cn("mr-2", server.diskUsage > 90 ? "text-red-400" : "text-gray-300")}>{server.diskUsage}%</span>
                          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={cn("h-full", server.diskUsage > 90 ? "bg-red-500" : "bg-blue-500")} style={{ width: `${server.diskUsage}%` }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {topServers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                        No server data reported by the gateway yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Side Panel: Alerts & Incidents */}
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-200 flex items-center">
                <ShieldAlert className="h-4 w-4 mr-2 text-red-400" />
                Active Incidents
              </h3>
              <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">{activeIncidents}</span>
            </div>
            <div className="space-y-4">
              {incidents.filter(i => i.status !== 'Closed' && i.status !== 'Resolved').slice(0, 4).map(incident => (
                <div key={incident.id} className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-md">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-medium text-gray-200 line-clamp-1">{incident.title}</p>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">Asset: <span className="text-gray-300">{incident.relatedAsset}</span></p>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded",
                      incident.severity === 'Critical' ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400"
                    )}>
                      {incident.severity}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(incident.startedAt)}</span>
                  </div>
                </div>
              ))}
              {activeIncidents === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
                  No active incidents
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
             <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-200 flex items-center">
                <Bell className="h-4 w-4 mr-2 text-orange-400" />
                Recent Alerts
              </h3>
            </div>
            <div className="space-y-3">
              {alerts.slice(0, 5).map(alert => (
                <div key={alert.id} className="flex gap-3">
                  <div className="mt-0.5">
                    {alert.severity === 'Critical' ? <XCircle className="h-4 w-4 text-red-400" /> : <AlertTriangle className="h-4 w-4 text-orange-400" />}
                  </div>
                  <div>
                    <p className="text-sm text-gray-300 leading-snug">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-gray-400">{alert.source}</span>
                      <span className="text-xs text-gray-600">&bull;</span>
                      <span className="text-xs text-gray-500">{formatDate(alert.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
