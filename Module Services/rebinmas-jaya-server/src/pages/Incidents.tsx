import React, { useState } from 'react';
import { useMonitoring } from '../store/MonitoringContext';
import { AlertTriangle, CheckCircle, Search, Clock } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { IncidentStatus, AlertSeverity } from '../types';

const SeverityBadge = ({ severity }: { severity: AlertSeverity }) => {
  const styles = {
    Informational: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Major: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    Emergency: 'bg-red-600 text-white border-red-700 animate-pulse',
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", styles[severity])}>
      {severity}
    </span>
  );
};

const StatusBadge = ({ status }: { status: IncidentStatus }) => {
  const styles = {
    Open: 'bg-gray-800 text-gray-300 border-gray-700',
    Acknowledged: 'bg-blue-900/50 text-blue-300 border-blue-800',
    Investigating: 'bg-purple-900/50 text-purple-300 border-purple-800',
    Resolved: 'bg-green-900/50 text-green-300 border-green-800',
    Closed: 'bg-gray-900 text-gray-500 border-gray-800',
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-1 rounded text-xs font-medium border", styles[status])}>
      {status}
    </span>
  );
};

export default function Incidents() {
  const { incidents, updateIncident } = useMonitoring();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIncidents = incidents.filter(i => 
    i.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.relatedAsset.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center">
            <AlertTriangle className="h-6 w-6 mr-2 text-red-400" />
            Incidents
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage and respond to critical infrastructure events.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-900 border border-gray-800 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 bg-gray-900/80 uppercase border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Started At</th>
                <th className="px-4 py-3 font-medium">Assigned To</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredIncidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-gray-800/50 transition-colors group">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">#{incident.id}</td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-200">{incident.title}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{incident.relatedAsset}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={incident.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs flex items-center">
                    <Clock className="h-3 w-3 mr-1 text-gray-500" />
                    {formatDate(incident.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{incident.assignedTo || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-right">
                    {incident.status !== 'Resolved' && incident.status !== 'Closed' && (
                      <button 
                        onClick={() => updateIncident(incident.id, { status: 'Resolved', resolvedAt: new Date().toISOString() })}
                        className="inline-flex items-center text-xs font-medium text-green-400 hover:text-green-300 transition-colors border border-green-500/30 px-2 py-1 rounded bg-green-500/10 hover:bg-green-500/20"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
               {filteredIncidents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No incidents found.
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
