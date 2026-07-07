import React, { useState } from 'react';
import { useMonitoring } from '../store/MonitoringContext';
import { Bell, CheckCircle, Search, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { AlertSeverity } from '../types';

const SeverityIcon = ({ severity }: { severity: AlertSeverity }) => {
  switch (severity) {
    case 'Emergency':
    case 'Critical': return <XCircle className="h-5 w-5 text-red-400" />;
    case 'Major':
    case 'Warning': return <AlertTriangle className="h-5 w-5 text-orange-400" />;
    case 'Informational': return <Info className="h-5 w-5 text-blue-400" />;
    default: return <Info className="h-5 w-5 text-gray-400" />;
  }
};

export default function Alerts() {
  const { alerts, acknowledgeAlert } = useMonitoring();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAlerts = alerts.filter(a => 
    a.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center">
            <Bell className="h-6 w-6 mr-2 text-orange-400" />
            Alerts
          </h1>
          <p className="text-sm text-gray-400 mt-1">System-generated notifications and threshold warnings.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-900 border border-gray-800 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredAlerts.map((alert) => (
          <div 
            key={alert.id} 
            className={cn(
              "p-4 rounded-lg border flex items-start gap-4 transition-colors",
              alert.acknowledged 
                ? "bg-gray-900/50 border-gray-800 opacity-75" 
                : "bg-gray-900 border-gray-700 shadow-sm"
            )}
          >
            <div className="mt-0.5 shrink-0">
              <SeverityIcon severity={alert.severity} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-medium text-gray-200 truncate">{alert.message}</h3>
                <span className="text-xs text-gray-500 shrink-0">{formatDate(alert.timestamp)}</span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs font-mono text-gray-400">{alert.source}</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded">
                  {alert.severity}
                </span>
                {alert.acknowledged && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-green-500/80 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Acknowledged
                  </span>
                )}
              </div>
            </div>
            {!alert.acknowledged && (
              <button 
                onClick={() => acknowledgeAlert(alert.id)}
                className="shrink-0 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded border border-gray-700 transition-colors"
              >
                Acknowledge
              </button>
            )}
          </div>
        ))}
        {filteredAlerts.length === 0 && (
          <div className="p-8 text-center bg-gray-900 border border-gray-800 rounded-lg text-gray-500">
            No alerts found.
          </div>
        )}
      </div>
    </div>
  );
}
