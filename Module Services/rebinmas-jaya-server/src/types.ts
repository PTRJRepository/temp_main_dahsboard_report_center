export type AssetStatus = 'healthy' | 'warning' | 'critical' | 'offline';
export type Environment = 'Production' | 'Staging' | 'Development';
export type DeviceType = 'Router' | 'Switch' | 'Firewall' | 'Access Point' | 'Interface' | 'Gateway Interface' | 'Printer' | 'Camera' | 'NAS' | 'Windows Host' | 'Linux Host' | 'Media Device' | 'Unknown';
export type AlertSeverity = 'Informational' | 'Warning' | 'Major' | 'Critical' | 'Emergency';
export type IncidentStatus = 'Open' | 'Acknowledged' | 'Investigating' | 'Resolved' | 'Closed';

export interface Server {
  id: string;
  name: string;
  ipAddress: string;
  macAddress: string;
  os: string;
  environment: Environment;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  status: AssetStatus;
  lastCheck: string;
  branch: string;
  uptime?: string;
  totalMemoryGiB?: number;
  freeMemoryGiB?: number;
  totalDiskGiB?: number | null;
  freeDiskGiB?: number | null;
}

export interface NetworkDevice {
  id: string;
  name: string;
  type: DeviceType;
  ipAddress: string;
  status: AssetStatus;
  branch: string;
  uptime: string;
  lastCheck: string;
  macAddress?: string | null;
  addressFamily?: string;
  netmask?: string | null;
  cidr?: string | null;
  hostname?: string | null;
  vendor?: string | null;
  sources?: string[];
  evidence?: string[];
  openPorts?: Array<{ port: number; service: string }>;
  serviceTypes?: string[];
  httpTitle?: string | null;
  httpServer?: string | null;
  defaultGateway?: string | null;
  dnsServers?: string[];
  ssdpLocation?: string | null;
  tlsCertificate?: {
    subject?: string | null;
    issuer?: string | null;
    validTo?: string | null;
  } | null;
  activeTcpConnections?: number;
  establishedTcpConnections?: number;
  connectionPorts?: string[];
  connectionStates?: Record<string, number>;
  owningProcesses?: number[];
  inventoryStale?: boolean;
  lastSeen?: string | null;
  latencyMs?: number | null;
  latencyStatus?: string | null;
  reachableByPing?: boolean | null;
}

export interface NetworkUsage {
  collectedAt?: string;
  interfaces?: Array<{
    name: string;
    description?: string | null;
    status?: string;
    linkSpeed?: string | null;
    macAddress?: string | null;
    rxBytes?: number;
    txBytes?: number;
    rxBps?: number;
    txBps?: number;
    rxLabel?: string;
    txLabel?: string;
    receivedPackets?: number;
    sentPackets?: number;
    receiveErrors?: number;
    transmitErrors?: number;
    receiveDiscards?: number;
    transmitDiscards?: number;
  }>;
  activeConnections?: Array<{
    protocol: string;
    localAddress: string;
    localPort: number;
    remoteAddress: string;
    remotePort: number;
    state: string;
    owningProcess: number;
    service: string;
    isLocalLan: boolean;
  }>;
  deviceConnections?: Array<{
    ipAddress: string;
    activeTcp: number;
    establishedTcp: number;
    ports: string[];
    states: Record<string, number>;
    processes: number[];
  }>;
  summary?: {
    activeTcp?: number;
    establishedTcp?: number;
    localLanTcp?: number;
    listeningTcp?: number;
    udpEndpoints?: number;
    totalRxBps?: number;
    totalTxBps?: number;
    totalRxLabel?: string;
    totalTxLabel?: string;
  };
}

export interface NetworkDiscovery {
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  methods?: string[];
  methodCounts?: Record<string, number>;
  subnetCount?: number;
  targetCount?: number;
  targetLimit?: number;
  allowPublicRanges?: boolean;
  cached?: boolean;
  cacheSource?: string;
  cachePath?: string;
  cacheAgeMs?: number | null;
  refreshIntervalMs?: number;
  stale?: boolean;
  refreshing?: boolean;
  lastRefreshReason?: string | null;
  lastError?: string | null;
  deviceCount?: number;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  source: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface Incident {
  id: string;
  title: string;
  severity: AlertSeverity;
  status: IncidentStatus;
  relatedAsset: string;
  startedAt: string;
  resolvedAt?: string;
  assignedTo?: string;
}

export interface CpuHistoryPoint {
  time: string;
  value: number;
}
