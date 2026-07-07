import React, { useMemo, useState } from 'react';
import {
  Camera,
  Cable,
  HardDrive,
  HelpCircle,
  Monitor,
  MoreVertical,
  Network,
  Printer,
  Radio,
  RefreshCw,
  Router,
  Search,
  Server as ServerIcon,
  Shield,
  Wifi,
} from 'lucide-react';
import { useMonitoring } from '../store/MonitoringContext';
import { cn, formatDate } from '../lib/utils';
import { AssetStatus, DeviceType, NetworkDevice } from '../types';

const StatusBadge = ({ status }: { status: AssetStatus }) => {
  const styles = {
    healthy: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    offline: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize', styles[status])}>
      {status}
    </span>
  );
};

const DeviceIcon = ({ type, className }: { type: DeviceType, className?: string }) => {
  switch (type) {
    case 'Router': return <Router className={className} />;
    case 'Switch': return <ServerIcon className={className} />;
    case 'Access Point': return <Wifi className={className} />;
    case 'Firewall': return <Shield className={className} />;
    case 'Interface':
    case 'Gateway Interface': return <Cable className={className} />;
    case 'Printer': return <Printer className={className} />;
    case 'Camera': return <Camera className={className} />;
    case 'NAS': return <HardDrive className={className} />;
    case 'Windows Host': return <Monitor className={className} />;
    case 'Linux Host': return <ServerIcon className={className} />;
    case 'Media Device': return <Radio className={className} />;
    default: return <HelpCircle className={className} />;
  }
};

const ChipList = ({ items, tone = 'gray' }: { items?: string[]; tone?: 'gray' | 'cyan' | 'purple' }) => {
  const values = (items ?? []).filter(Boolean).slice(0, 8);
  if (values.length === 0) return <span className="text-gray-600">-</span>;

  const styles = {
    gray: 'border-gray-700 bg-gray-800 text-gray-300',
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    purple: 'border-purple-500/20 bg-purple-500/10 text-purple-300',
  };

  return (
    <div className="flex max-w-[260px] flex-wrap gap-1">
      {values.map((item) => (
        <span key={item} className={cn('rounded border px-1.5 py-0.5 text-[11px]', styles[tone])}>
          {item}
        </span>
      ))}
    </div>
  );
};

function getSearchText(device: NetworkDevice) {
  return [
    device.name,
    device.hostname,
    device.ipAddress,
    device.macAddress,
    device.vendor,
    device.type,
    device.httpTitle,
    device.httpServer,
    ...(device.sources ?? []),
    ...(device.evidence ?? []),
    ...(device.openPorts ?? []).map(port => `${port.port} ${port.service}`),
  ].filter(Boolean).join(' ').toLowerCase();
}

export default function NetworkDevices() {
  const { networkDevices, networkDiscovery, networkUsage, loading, error, refresh } = useMonitoring();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDevices = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return networkDevices;
    return networkDevices.filter(device => getSearchText(device).includes(query));
  }, [networkDevices, searchTerm]);

  const openPortCount = networkDevices.reduce((total, device) => total + (device.openPorts?.length ?? 0), 0);
  const healthyCount = networkDevices.filter(device => device.status === 'healthy').length;
  const sourceCount = new Set(networkDevices.flatMap(device => device.sources ?? [])).size;
  const usageSummary = networkUsage?.summary;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center">
            <Network className="h-6 w-6 mr-2 text-indigo-400" />
            Network Discovery
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Agentless LAN inventory from the gateway: ARP, ICMP, DNS, NetBIOS, multicast discovery, and port fingerprinting.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search IP, hostname, vendor, port..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-900 border border-gray-800 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => void refresh({ forceDiscovery: true })}
            className="flex items-center justify-center gap-2 px-3 py-1.5 border border-gray-700 bg-gray-800 text-gray-200 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Scan ulang
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
          <div className="text-xs text-gray-500">Reachable devices</div>
          <div className="mt-1 text-xl font-semibold text-white">{healthyCount} / {networkDevices.length}</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
          <div className="text-xs text-gray-500">Open TCP fingerprints</div>
          <div className="mt-1 text-xl font-semibold text-white">{openPortCount}</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
          <div className="text-xs text-gray-500">Discovery sources</div>
          <div className="mt-1 text-xl font-semibold text-white">{sourceCount}</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
          <div className="text-xs text-gray-500">Gateway traffic</div>
          <div className="mt-1 text-xl font-semibold text-white">{usageSummary?.totalRxLabel ?? '0 B/s'} RX</div>
          <div className="mt-1 text-[11px] text-gray-500">
            TX {usageSummary?.totalTxLabel ?? '0 B/s'} / TCP {usageSummary?.activeTcp ?? 0}
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-sm text-blue-200">
          Loading LAN discovery snapshot...
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="border-b border-gray-800 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Methods</span>
            <ChipList items={networkDiscovery?.methods} tone="purple" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 bg-gray-900/80 uppercase border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Device</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">IP Address</th>
                <th className="px-4 py-3 font-medium">MAC / Vendor</th>
                <th className="px-4 py-3 font-medium">Open Ports</th>
                <th className="px-4 py-3 font-medium">Active Connections</th>
                <th className="px-4 py-3 font-medium">Sources</th>
                <th className="px-4 py-3 font-medium">Evidence</th>
                <th className="px-4 py-3 font-medium">Last Check</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredDevices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-800/50 transition-colors group align-top">
                  <td className="px-4 py-3">
                    <StatusBadge status={device.status} />
                  </td>
                  <td className="px-4 py-3 min-w-56">
                    <div className="font-medium text-gray-200">{device.hostname || device.name || device.ipAddress}</div>
                    <div className="mt-1 text-xs text-gray-500">{device.httpTitle || device.httpServer || device.branch || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center text-gray-300 whitespace-nowrap">
                      <DeviceIcon type={device.type} className="h-4 w-4 mr-2 text-gray-400" />
                      {device.type}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                    <div>{device.ipAddress}</div>
                    <div className="text-gray-600">{device.cidr || device.netmask || device.addressFamily || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs min-w-44">
                    <div>{device.macAddress || '-'}</div>
                    <div className="text-gray-600">{device.vendor || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ChipList items={(device.openPorts ?? []).map(port => `${port.port}/${port.service}`)} tone="cyan" />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 min-w-44">
                    <div className="font-medium text-gray-200">{device.activeTcpConnections ?? 0} TCP</div>
                    <div className="text-gray-600">{device.establishedTcpConnections ?? 0} established</div>
                    <div className="mt-1">
                      <ChipList items={device.connectionPorts} tone="cyan" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ChipList items={device.sources} tone="purple" />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 min-w-72 max-w-md">
                    {(device.evidence ?? []).slice(0, 4).map((item) => (
                      <div key={item} className="mb-1 last:mb-0">{item}</div>
                    ))}
                    {(!device.evidence || device.evidence.length === 0) && <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(device.lastCheck)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1 text-gray-500 hover:text-gray-300 transition-colors rounded">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    No LAN devices found in the current gateway snapshot.
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
