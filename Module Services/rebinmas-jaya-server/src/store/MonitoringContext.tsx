import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, CpuHistoryPoint, Incident, NetworkDevice, NetworkDiscovery, NetworkUsage, Server } from '../types';

interface MonitoringState {
  servers: Server[];
  networkDevices: NetworkDevice[];
  alerts: Alert[];
  incidents: Incident[];
  cpuHistory: CpuHistoryPoint[];
  networkDiscovery: NetworkDiscovery | null;
  networkUsage: NetworkUsage | null;
  loading: boolean;
  error: string | null;
  refresh: (options?: { forceDiscovery?: boolean }) => Promise<void>;
  addServer: (server: Server) => void;
  updateServer: (id: string, server: Partial<Server>) => void;
  deleteServer: (id: string) => void;
  addNetworkDevice: (device: NetworkDevice) => void;
  deleteNetworkDevice: (id: string) => void;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (id: string, updates: Partial<Incident>) => void;
}

interface MonitoringSnapshot {
  servers?: Server[];
  networkDevices?: NetworkDevice[];
  alerts?: Alert[];
  incidents?: Incident[];
  cpuHistory?: CpuHistoryPoint[];
  networkDiscovery?: NetworkDiscovery;
  networkUsage?: NetworkUsage;
}

const MonitoringContext = createContext<MonitoringState | undefined>(undefined);

function getSnapshotUrl(forceDiscovery = false) {
  if (typeof window === 'undefined') {
    return forceDiscovery ? '/api/monitoring/snapshot?forceDiscovery=1' : '/api/monitoring/snapshot';
  }
  const url = new URL('/api/monitoring/snapshot', window.location.origin);
  if (forceDiscovery) url.searchParams.set('forceDiscovery', '1');
  return url.toString();
}

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  const [servers, setServers] = useState<Server[]>([]);
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [cpuHistory, setCpuHistory] = useState<CpuHistoryPoint[]>([]);
  const [networkDiscovery, setNetworkDiscovery] = useState<NetworkDiscovery | null>(null);
  const [networkUsage, setNetworkUsage] = useState<NetworkUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (options: { forceDiscovery?: boolean } = {}) => {
    try {
      const response = await fetch(getSnapshotUrl(Boolean(options.forceDiscovery)), {
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Monitoring snapshot failed with HTTP ${response.status}`);
      }

      const snapshot = (await response.json()) as MonitoringSnapshot;
      setServers(snapshot.servers ?? []);
      setNetworkDevices(snapshot.networkDevices ?? []);
      setAlerts(snapshot.alerts ?? []);
      setIncidents(snapshot.incidents ?? []);
      setCpuHistory(snapshot.cpuHistory ?? []);
      setNetworkDiscovery(snapshot.networkDiscovery ?? null);
      setNetworkUsage(snapshot.networkUsage ?? null);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Monitoring snapshot failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(interval);
  }, []);

  const value = useMemo<MonitoringState>(() => ({
    servers,
    networkDevices,
    alerts,
    incidents,
    cpuHistory,
    networkDiscovery,
    networkUsage,
    loading,
    error,
    refresh,
    addServer: (server) => setServers(prev => [...prev, server]),
    updateServer: (id, updates) => setServers(prev => prev.map(server => server.id === id ? { ...server, ...updates } : server)),
    deleteServer: (id) => setServers(prev => prev.filter(server => server.id !== id)),
    addNetworkDevice: (device) => setNetworkDevices(prev => [...prev, device]),
    deleteNetworkDevice: (id) => setNetworkDevices(prev => prev.filter(device => device.id !== id)),
    addAlert: (alert) => setAlerts(prev => [alert, ...prev]),
    acknowledgeAlert: (id) => setAlerts(prev => prev.map(alert => alert.id === id ? { ...alert, acknowledged: true } : alert)),
    addIncident: (incident) => setIncidents(prev => [incident, ...prev]),
    updateIncident: (id, updates) => setIncidents(prev => prev.map(incident => incident.id === id ? { ...incident, ...updates } : incident)),
  }), [alerts, cpuHistory, error, incidents, loading, networkDevices, networkDiscovery, networkUsage, servers]);

  return (
    <MonitoringContext.Provider value={value}>
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (context === undefined) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
}
