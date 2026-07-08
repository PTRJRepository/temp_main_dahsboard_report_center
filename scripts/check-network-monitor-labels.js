'use strict';

const assert = require('node:assert/strict');

function asArray(value) {
  return Array.isArray(value) ? value : (value ? [value] : []);
}

function normalizeHostIpAddress(value) {
  const raw = String(value || '').trim();
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(raw) ? raw : null;
}

function normalizeHostMacAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const hex = raw.replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{1,2}/g).join(':');
}

function getHostLabelKey(input) {
  const macAddress = normalizeHostMacAddress(input && input.macAddress);
  const ipAddress = normalizeHostIpAddress(input && input.ipAddress);
  if (macAddress) return `mac:${macAddress}`;
  if (ipAddress) return `ip:${ipAddress}`;
  return null;
}

function getHostLabelForItem(hostLabelStore, item) {
  const labels = (hostLabelStore && hostLabelStore.labels) || {};
  const keys = [
    getHostLabelKey({ macAddress: item && item.macAddress }),
    getHostLabelKey({ ipAddress: item && (item.ipAddress || item.remoteAddress) }),
  ].filter(Boolean);
  return keys.map(key => labels[key]).find(label => label && typeof label === 'object') || null;
}

function getDisplayNameFallback(item) {
  return (item && (item.displayName || item.hostname || item.name || item.ipAddress || item.remoteAddress || item.macAddress || item.id)) || 'Unknown device';
}

function applyHostLabels(items, hostLabelStore) {
  return asArray(items).map(item => {
    if (!item || typeof item !== 'object') return item;
    const label = getHostLabelForItem(hostLabelStore, item);
    const manualAlias = label ? String(label.displayName || label.alias || '').trim() || null : null;
    return {
      ...item,
      displayName: manualAlias || getDisplayNameFallback(item),
      manualAlias,
    };
  });
}

function portServiceName(port) {
  return ({ 22: 'SSH', 53: 'DNS', 80: 'HTTP', 443: 'HTTPS', 445: 'SMB' })[Number(port)] || `TCP ${port}`;
}

function summarizeTcpConnections(networkUsage, devices = []) {
  const activeConnections = asArray(networkUsage && networkUsage.activeConnections);
  const deviceConnections = asArray(networkUsage && networkUsage.deviceConnections);
  const summary = (networkUsage && networkUsage.summary) || {};
  const devicesByIp = new Map(asArray(devices).filter(item => item && item.ipAddress).map(item => [item.ipAddress, item]));
  const deviceConnectionsByIp = new Map(deviceConnections.filter(item => item && item.ipAddress).map(item => [item.ipAddress, item]));
  const groups = new Map();
  const byState = {};
  const remotePortCounts = new Map();

  const getGroup = ipAddress => {
    const device = devicesByIp.get(ipAddress) || deviceConnectionsByIp.get(ipAddress) || {};
    const group = groups.get(ipAddress) || {
      remoteAddress: ipAddress,
      displayName: getDisplayNameFallback({ ...device, ipAddress }),
      manualAlias: device.manualAlias || null,
      connectionCount: 0,
      establishedTcp: 0,
      localLanTcp: 0,
      states: {},
      ports: new Map(),
    };
    groups.set(ipAddress, group);
    return group;
  };

  for (const connection of activeConnections) {
    const remoteAddress = connection && (connection.remoteAddress || connection.ipAddress);
    if (!remoteAddress) continue;
    const state = connection.state || 'Unknown';
    const remotePort = Number(connection.remotePort || 0);
    const service = connection.service || portServiceName(remotePort);
    const portKey = `${remotePort}/${service}`;
    const group = getGroup(remoteAddress);

    group.connectionCount += 1;
    if (String(state).toLowerCase() === 'established') group.establishedTcp += 1;
    if (connection.isLocalLan) group.localLanTcp += 1;
    group.states[state] = (group.states[state] || 0) + 1;
    byState[state] = (byState[state] || 0) + 1;
    group.ports.set(portKey, {
      port: remotePort,
      service,
      count: ((group.ports.get(portKey) || {}).count || 0) + 1,
    });
    remotePortCounts.set(portKey, {
      port: remotePort,
      service,
      count: ((remotePortCounts.get(portKey) || {}).count || 0) + 1,
    });
  }

  for (const deviceConnection of deviceConnections) {
    if (!deviceConnection || !deviceConnection.ipAddress || groups.has(deviceConnection.ipAddress)) continue;
    const group = getGroup(deviceConnection.ipAddress);
    group.connectionCount = Number(deviceConnection.activeTcp || 0);
    group.establishedTcp = Number(deviceConnection.establishedTcp || 0);
    group.states = { ...(deviceConnection.states || {}) };
    for (const portText of asArray(deviceConnection.ports)) {
      const [portValue, service = portServiceName(Number(portValue || 0))] = String(portText).split('/');
      const port = Number(portValue || 0);
      group.ports.set(`${port}/${service}`, { port, service, count: 1 });
    }
  }

  const topRemoteGroups = [...groups.values()]
    .map(group => ({ ...group, ports: [...group.ports.values()].sort((a, b) => b.count - a.count).slice(0, 8) }))
    .sort((a, b) => b.connectionCount - a.connectionCount)
    .slice(0, 10);

  const narratives = topRemoteGroups.slice(0, 5).map(group => {
    const port = group.ports[0];
    const countLabel = `${group.connectionCount} active TCP connection${group.connectionCount === 1 ? '' : 's'}`;
    const portLabel = port && port.port ? ` to port ${port.port} (${port.service})` : '';
    const lanLabel = group.localLanTcp > 0 ? ' on local LAN' : '';
    return `${group.displayName} has ${countLabel}${portLabel}${lanLabel}.`;
  });

  return {
    total: summary.activeTcp ?? activeConnections.length,
    established: summary.establishedTcp ?? activeConnections.filter(item => String(item && item.state).toLowerCase() === 'established').length,
    localLan: summary.localLanTcp ?? activeConnections.filter(item => item && item.isLocalLan).length,
    listening: summary.listeningTcp ?? activeConnections.filter(item => String(item && item.state).toLowerCase() === 'listen').length,
    topRemoteGroups,
    topRemotePorts: [...remotePortCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    byState,
    narratives,
  };
}

function detectDownDevices(devices, nowIso = new Date().toISOString()) {
  const nowMs = Date.parse(nowIso);
  const suddenWindowMs = 24 * 60 * 60 * 1000;
  const downDevices = asArray(devices)
    .filter(device => device && (device.status === 'offline' || device.inventoryStale === true) && device.lastSeen)
    .map(device => {
      const offline = device.status === 'offline';
      const stale = device.inventoryStale === true;
      return {
        id: device.id || device.ipAddress || device.macAddress || device.name,
        ipAddress: device.ipAddress || null,
        macAddress: device.macAddress || null,
        displayName: getDisplayNameFallback(device),
        manualAlias: device.manualAlias || null,
        lastSeen: device.lastSeen,
        lastCheck: device.lastCheck || null,
        status: device.status || null,
        inventoryStale: stale,
        downReason: offline && stale
          ? 'Possibly down: offline and stale from previous discovery cache'
          : offline
            ? 'Possibly offline in latest discovery data'
            : 'Possibly down: stale inventory entry from previous discovery cache',
      };
    })
    .sort((a, b) => (Date.parse(b.lastSeen) || 0) - (Date.parse(a.lastSeen) || 0));

  const suddenlyDown = downDevices.filter(device => {
    const lastSeenMs = Date.parse(device.lastSeen);
    return Number.isFinite(nowMs) && Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= suddenWindowMs;
  });

  return { downDevices, suddenlyDown };
}

function checkLabelMerge() {
  const devices = [
    {
      ipAddress: '10.0.0.2',
      macAddress: '00:0C:29:15:0D:EC',
      hostname: 'PLANTWAREP3',
      name: 'PLANTWAREP3',
      evidence: ['ARP cache'],
      sources: ['arp-neighbor'],
    },
    {
      ipAddress: '10.0.0.9',
      macAddress: 'A8:29:48:CC:30:C0',
      hostname: null,
      name: '10.0.0.9',
      evidence: ['Open ports: 80/HTTP'],
      sources: ['tcp-port-probe'],
    },
  ];
  const original = structuredClone(devices);
  const labels = {
    'ip:10.0.0.2': { displayName: 'Server Plantware P3' },
    'mac:A8:29:48:CC:30:C0': { displayName: 'Switch Gudang' },
  };

  const labeled = applyHostLabels(devices, { labels });
  assert.equal(labeled[0].displayName, 'Server Plantware P3');
  assert.equal(labeled[0].manualAlias, 'Server Plantware P3');
  assert.equal(labeled[1].displayName, 'Switch Gudang');
  assert.equal(labeled[1].manualAlias, 'Switch Gudang');
  ['hostname', 'name', 'evidence', 'sources'].forEach(field => {
    assert.deepStrictEqual(labeled[0][field], original[0][field], `raw ${field} changed for host label merge`);
    assert.deepStrictEqual(labeled[1][field], original[1][field], `raw ${field} changed for host label merge`);
  });
}

function checkTcpSummary() {
  const devices = [
    { ipAddress: '10.0.0.2', displayName: 'Server Plantware P3' },
    { ipAddress: '10.0.0.9', displayName: 'Switch Gudang' },
  ];
  const usage = {
    summary: { activeTcp: 3, establishedTcp: 2, localLanTcp: 2, listeningTcp: 1 },
    activeConnections: [
      { remoteAddress: '10.0.0.2', remotePort: 443, state: 'Established', isLocalLan: true, service: 'HTTPS' },
      { remoteAddress: '10.0.0.2', remotePort: 443, state: 'Established', isLocalLan: true, service: 'HTTPS' },
      { remoteAddress: '10.0.0.9', remotePort: 80, state: 'Listen', isLocalLan: false, service: 'HTTP' },
    ],
  };

  const summary = summarizeTcpConnections(usage, devices);
  assert.equal(summary.total, 3);
  assert.equal(summary.established, 2);
  assert.equal(summary.localLan, 2);
  assert.equal(summary.listening, 1);
  assert.equal(summary.topRemoteGroups.length, 2);
  assert.equal(summary.topRemoteGroups[0].remoteAddress, '10.0.0.2');
  assert.equal(summary.topRemoteGroups[0].connectionCount, 2);
  assert.deepStrictEqual(summary.topRemoteGroups[0].ports[0], { port: 443, service: 'HTTPS', count: 2 });
  assert.match(summary.narratives[0], /Server Plantware P3 has 2 active TCP connections to port 443/);
}

function checkDownDetection() {
  const now = '2026-07-07T10:00:00.000Z';
  const devices = [
    { id: 'online', ipAddress: '10.0.0.2', displayName: 'Online Host', status: 'healthy', lastSeen: now },
    { id: 'offline', ipAddress: '10.0.0.9', macAddress: 'A8:29:48:CC:30:C0', displayName: 'Offline Switch', status: 'offline', lastSeen: '2026-07-07T09:00:00.000Z' },
    { id: 'stale', ipAddress: '10.0.0.12', macAddress: 'C4:AD:34:32:17:41', displayName: 'Stale Router', status: 'healthy', inventoryStale: true, lastSeen: '2026-07-06T09:00:00.000Z' },
  ];

  const result = detectDownDevices(devices, now);
  assert.equal(result.downDevices.length, 2);
  assert.deepStrictEqual(result.downDevices.map(device => device.id).sort(), ['offline', 'stale']);
  assert.equal(result.suddenlyDown.length, 1);
  assert.equal(result.suddenlyDown[0].id, 'offline');
  result.downDevices.forEach(device => {
    assert.ok(device.ipAddress);
    assert.ok(device.displayName);
    assert.ok(device.lastSeen);
    assert.ok(device.downReason);
    assert.notEqual(device.id, 'online');
  });
}

checkLabelMerge();
checkTcpSummary();
checkDownDetection();

console.log('Network Monitor enrichment checks passed: label merge, TCP summary, down detection');
