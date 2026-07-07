(function () {
  var latestSnapshot = null;
  var selectedDeviceId = null;
  var trafficHistory = [];
  var latencyHistory = [];

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function text(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function statusLabel(status) {
    if (status === 'healthy') return 'Healthy';
    if (status === 'warning') return 'Warning';
    if (status === 'critical') return 'Critical';
    if (status === 'offline') return 'Offline';
    return status || 'Unknown';
  }

  function statusClass(status) {
    if (status === 'healthy') return 'ok';
    if (status === 'warning') return 'warn';
    if (status === 'critical' || status === 'offline') return 'down';
    return 'info';
  }

  function severityClass(severity) {
    if (severity === 'Critical' || severity === 'Emergency' || severity === 'Major') return 'down';
    if (severity === 'Warning') return 'warn';
    return 'info';
  }

  function formatTime(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }

  function formatDurationMs(value) {
    if (value === null || value === undefined) return '-';
    var number = Number(value);
    if (!Number.isFinite(number)) return '-';
    if (number < 1000) return Math.round(number) + ' ms';
    var seconds = Math.round(number / 1000);
    if (seconds < 60) return seconds + ' detik';
    return Math.round(seconds / 60) + ' menit';
  }

  function numberLabel(value) {
    var number = Number(value || 0);
    if (number >= 1024 * 1024) return Math.round((number / 1024 / 1024) * 10) / 10 + ' MB/s';
    if (number >= 1024) return Math.round((number / 1024) * 10) / 10 + ' KB/s';
    return Math.round(number) + ' B/s';
  }

  function setKpiValue(index, value, foot) {
    var card = document.querySelectorAll('.kpi')[index];
    if (!card) return;
    var valueEl = card.querySelector('.kpi-val');
    var footEl = card.querySelector('.kpi-foot');
    if (valueEl) valueEl.innerHTML = value;
    if (footEl && foot !== undefined) footEl.textContent = foot;
  }

  function renderBadges(values, className) {
    var list = (values || []).filter(Boolean).slice(0, 8);
    if (!list.length) return '<span class="muted">-</span>';
    return '<div class="chip-list">' + list.map(function (value) {
      return '<span class="badge ' + (className || '') + '">' + escapeHtml(value) + '</span>';
    }).join('') + '</div>';
  }

  function renderPorts(device) {
    var ports = (device.openPorts || []).slice(0, 10);
    if (!ports.length) return '<span class="muted">No open TCP probe</span>';
    return '<div class="chip-list">' + ports.map(function (item) {
      return '<span class="badge cyan">' + escapeHtml(item.port) + '/' + escapeHtml(item.service || 'TCP') + '</span>';
    }).join('') + '</div>';
  }

  function renderConnections(device) {
    var count = Number(device.activeTcpConnections || 0);
    var established = Number(device.establishedTcpConnections || 0);
    var ports = (device.connectionPorts || []).slice(0, 8);
    if (!count) return '<span class="muted">No active TCP</span>';
    return '<div><span class="status ok">' + count + ' TCP</span><br><span class="muted">' + established + ' established</span>' +
      (ports.length ? '<div class="chip-list" style="margin-top:4px">' + ports.map(function (item) {
        return '<span class="badge cyan">' + escapeHtml(item) + '</span>';
      }).join('') + '</div>' : '') + '</div>';
  }

  function chartPath(values, width, height, maxValue) {
    if (!values.length) return '';
    if (values.length === 1) values = [0].concat(values);
    return values.map(function (value, index) {
      var x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      var y = height - ((Number(value || 0) / maxValue) * (height - 18)) - 9;
      return (index === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
  }

  function renderLineChart(selector, seriesA, seriesB, options) {
    var svg = document.querySelector(selector);
    if (!svg) return;
    var width = 420;
    var height = 150;
    var maxValue = Math.max(1, Math.max.apply(null, seriesA.concat(seriesB).map(function (value) { return Number(value || 0); })));
    var grid = [30, 60, 90, 120].map(function (y) {
      return '<line x1="0" y1="' + y + '" x2="' + width + '" y2="' + y + '" class="chart-grid-line" />';
    }).join('');
    var pathA = chartPath(seriesA, width, height, maxValue);
    var pathB = chartPath(seriesB, width, height, maxValue);
    svg.innerHTML = grid +
      '<path class="chart-area" d="' + pathA + ' L ' + width + ' ' + height + ' L 0 ' + height + ' Z"></path>' +
      '<path class="chart-line rx" d="' + pathA + '"></path>' +
      '<path class="chart-line tx" d="' + pathB + '"></path>' +
      '<text x="8" y="18" class="chart-axis">' + escapeHtml(options.maxLabel(maxValue)) + '</text>';
  }

  function groupCount(items, getter) {
    return items.reduce(function (acc, item) {
      var key = getter(item) || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function isIpv4(value) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(String(value || ''));
  }

  function isPrivateIpv4(value) {
    var parts = String(value || '').split('.').map(Number);
    if (parts.length !== 4 || parts.some(function (part) { return !Number.isFinite(part); })) return false;
    return parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      parts[0] === 169;
  }

  function deviceKey(device) {
    return device && (device.id || device.ipAddress || device.macAddress || device.name) || '';
  }

  function deviceName(device) {
    if (!device) return 'Unknown device';
    return device.hostname || device.name || device.ipAddress || device.macAddress || 'Unknown device';
  }

  function hasResolvedName(device) {
    var name = device && (device.hostname || device.name);
    return Boolean(name && name !== device.ipAddress && !isIpv4(name));
  }

  function subnetKey(ip) {
    if (!isIpv4(ip)) return ip ? 'Non IPv4' : 'Unknown subnet';
    var parts = String(ip).split('.');
    return parts[0] + '.' + parts[1] + '.' + parts[2] + '.0/24';
  }

  function topEntries(mapOrObject, limit) {
    return Object.entries(mapOrObject || {})
      .sort(function (a, b) { return Number(b[1] || 0) - Number(a[1] || 0); })
      .slice(0, limit || 8);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pct(value, max) {
    if (!max) return 0;
    return clamp(Math.round((Number(value || 0) / max) * 100), 3, 100);
  }

  function serviceLabel(value) {
    var label = String(value || '').trim();
    if (!label) return 'Unknown service';
    label = label.replace(/^_services\._dns-sd\._udp\.local$/i, 'mDNS service');
    label = label.replace(/^_([^._]+).*$/i, '$1');
    if (/^TCP\s+\d+$/i.test(label)) return label.toUpperCase();
    return label.length > 26 ? label.slice(0, 23) + '...' : label;
  }

  function getDeviceLatency(device) {
    if (!device) return null;
    var value = device.latencyMs;
    return value === null || value === undefined ? null : Number(value);
  }

  function deviceRiskScore(device) {
    var latency = getDeviceLatency(device);
    var score = 0;
    score += Number(device.activeTcpConnections || 0) * 4;
    score += (device.openPorts || []).length * 6;
    if (latency !== null && latency > 180) score += 12;
    else if (latency !== null && latency > 90) score += 6;
    if (device.status === 'critical' || device.status === 'offline') score += 14;
    else if (device.status === 'warning') score += 7;
    if (!hasResolvedName(device)) score += 2;
    if (device.inventoryStale) score += 2;
    return score;
  }

  function renderHorizontalBars(selector, items, emptyLabel) {
    var target = document.querySelector(selector);
    if (!target) return;
    if (!items.length) {
      target.innerHTML = '<div class="empty-mini">' + escapeHtml(emptyLabel || 'No data visible from gateway.') + '</div>';
      return;
    }
    var max = Math.max.apply(null, items.map(function (item) { return Number(item.value || 0); }));
    target.innerHTML = items.map(function (item) {
      var attrs = item.deviceId ? ' data-row-focus="' + escapeHtml(item.label) + '" data-device-id="' + escapeHtml(item.deviceId) + '"' : '';
      return '<button class="hbar-row' + (item.deviceId ? ' clickable' : '') + '"' + attrs + '>' +
        '<span><b>' + escapeHtml(item.label) + '</b><small>' + escapeHtml(item.sub || '') + '</small></span>' +
        '<i><em style="width:' + pct(item.value, max) + '%"></em></i>' +
        '<strong>' + escapeHtml(item.valueLabel || item.value) + '</strong>' +
        '</button>';
    }).join('');
  }

  function renderRankList(selector, items, emptyLabel) {
    var target = document.querySelector(selector);
    if (!target) return;
    if (!items.length) {
      target.innerHTML = '<div class="empty-mini">' + escapeHtml(emptyLabel || 'No ranked clients.') + '</div>';
      return;
    }
    target.innerHTML = items.map(function (item, index) {
      var attrs = item.deviceId ? ' data-row-focus="' + escapeHtml(item.label) + '" data-device-id="' + escapeHtml(item.deviceId) + '"' : '';
      return '<button class="rank-row"' + attrs + '><span>' + (index + 1) + '</span><b>' + escapeHtml(item.label) + '</b><small>' + escapeHtml(item.sub || '') + '</small><strong>' + escapeHtml(item.valueLabel || item.value) + '</strong></button>';
    }).join('');
  }

  function renderMiniDonut(selector, entries, centerLabel) {
    var target = document.querySelector(selector);
    if (!target) return;
    var total = entries.reduce(function (sum, item) { return sum + Number(item.value || 0); }, 0);
    var colors = ['var(--cyan)', 'var(--amber)', 'var(--green)', 'var(--purple)', 'var(--red)', '#75b9ff'];
    var cursor = 0;
    var gradient = entries.map(function (item, index) {
      var degrees = total ? Math.round((Number(item.value || 0) / total) * 360) : 0;
      var start = cursor;
      cursor += degrees;
      return colors[index % colors.length] + ' ' + start + 'deg ' + cursor + 'deg';
    }).join(',');
    target.style.background = total ? 'conic-gradient(' + gradient + ')' : '#102b42';
    target.innerHTML = '<b>' + escapeHtml(centerLabel || total) + '</b><span>total</span>';
  }

  function renderStackList(selector, entries) {
    var target = document.querySelector(selector);
    if (!target) return;
    target.innerHTML = entries.map(function (entry) {
      return '<div class="stack-row"><span>' + escapeHtml(entry.label) + '</span><b>' + escapeHtml(entry.value) + '</b></div>';
    }).join('');
  }

  function relatedConnectionsForDevice(device, snapshot) {
    if (!device || !snapshot) return [];
    var ip = device.ipAddress;
    return (snapshot.networkUsage && snapshot.networkUsage.activeConnections || []).filter(function (item) {
      return item.remoteAddress === ip || item.localAddress === ip;
    });
  }

  function connectionScope(connection, deviceIps) {
    if (connection.isLocalLan || deviceIps.has(connection.remoteAddress)) return 'LAN client';
    if (isPrivateIpv4(connection.remoteAddress)) return 'Private/virtual';
    return 'Public internet';
  }

  function renderClientSummaryCharts(snapshot) {
    var devices = snapshot.networkDevices || [];
    var deviceIps = new Set(devices.map(function (device) { return device.ipAddress; }).filter(Boolean));
    var connections = snapshot.networkUsage && snapshot.networkUsage.activeConnections || [];
    var totalOpenPorts = devices.reduce(function (sum, device) { return sum + (device.openPorts || []).length; }, 0);
    var namedCount = devices.filter(hasResolvedName).length;
    var latencyValues = devices.map(getDeviceLatency).filter(function (value) { return value !== null && Number.isFinite(value); });
    var avgLatency = latencyValues.length ? Math.round(latencyValues.reduce(function (sum, value) { return sum + value; }, 0) / latencyValues.length) : null;

    text('[data-client-summary-total]', devices.length + ' clients');
    text('[data-client-connections-total]', connections.length + ' TCP');
    text('[data-client-openports-total]', totalOpenPorts + ' ports');
    text('[data-client-latency-total]', avgLatency === null ? '-' : avgLatency + ' ms avg');

    renderHorizontalBars('[data-top-client-connections]', devices.slice()
      .filter(function (device) { return Number(device.activeTcpConnections || 0) > 0; })
      .sort(function (a, b) { return Number(b.activeTcpConnections || 0) - Number(a.activeTcpConnections || 0); })
      .slice(0, 10)
      .map(function (device) {
        return {
          label: deviceName(device),
          sub: device.ipAddress + ' - ' + (device.type || 'Unknown'),
          value: Number(device.activeTcpConnections || 0),
          valueLabel: (device.activeTcpConnections || 0) + ' TCP',
          deviceId: deviceKey(device)
        };
      }), 'Belum ada sesi TCP client yang terlihat gateway.');

    renderHorizontalBars('[data-top-client-latency]', devices.slice()
      .filter(function (device) { return getDeviceLatency(device) !== null; })
      .sort(function (a, b) { return Number(getDeviceLatency(b) || 0) - Number(getDeviceLatency(a) || 0); })
      .slice(0, 10)
      .map(function (device) {
        return {
          label: deviceName(device),
          sub: device.ipAddress + ' - ' + statusLabel(device.latencyStatus || device.status),
          value: Number(getDeviceLatency(device) || 0),
          valueLabel: getDeviceLatency(device) + ' ms',
          deviceId: deviceKey(device)
        };
      }), 'Belum ada sample latency.');

    renderHorizontalBars('[data-top-client-openports]', devices.slice()
      .filter(function (device) { return (device.openPorts || []).length > 0; })
      .sort(function (a, b) { return (b.openPorts || []).length - (a.openPorts || []).length; })
      .slice(0, 10)
      .map(function (device) {
        return {
          label: deviceName(device),
          sub: device.ipAddress + ' - ' + (device.openPorts || []).map(function (port) { return port.port; }).slice(0, 5).join(', '),
          value: (device.openPorts || []).length,
          valueLabel: (device.openPorts || []).length + ' ports',
          deviceId: deviceKey(device)
        };
      }), 'Port probe belum menemukan port terbuka.');

    var riskItems = devices.slice()
      .map(function (device) { return { device: device, score: deviceRiskScore(device) }; })
      .filter(function (item) { return item.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 8);
    text('[data-client-risk-total]', riskItems.length ? riskItems[0].score + ' top' : '-');
    renderRankList('[data-client-risk-list]', riskItems.map(function (item) {
      return {
        label: deviceName(item.device),
        sub: item.device.ipAddress + ' - TCP ' + (item.device.activeTcpConnections || 0) + ' - ports ' + (item.device.openPorts || []).length,
        value: item.score,
        valueLabel: item.score,
        deviceId: deviceKey(item.device)
      };
    }), 'Tidak ada skor risiko dari data saat ini.');

    var unknownCount = devices.length - namedCount;
    var coveragePct = devices.length ? Math.round((namedCount / devices.length) * 100) : 0;
    text('[data-hostname-coverage-total]', coveragePct + '% named');
    renderMiniDonut('[data-hostname-coverage]', [
      { label: 'Named', value: namedCount },
      { label: 'Unknown', value: unknownCount }
    ], coveragePct + '%');
    renderStackList('[data-hostname-coverage-list]', [
      { label: 'Named clients', value: namedCount },
      { label: 'Unknown clients', value: unknownCount }
    ]);

    var subnetCounts = groupCount(devices, function (device) { return subnetKey(device.ipAddress); });
    text('[data-subnet-total]', Object.keys(subnetCounts).length + ' subnets');
    renderHorizontalBars('[data-subnet-distribution]', topEntries(subnetCounts, 10).map(function (entry) {
      return { label: entry[0], sub: 'Discovered clients', value: entry[1], valueLabel: entry[1] };
    }), 'Subnet belum terdeteksi.');

    var serviceCounts = {};
    devices.forEach(function (device) {
      (device.openPorts || []).forEach(function (port) {
        var key = serviceLabel(port.service || ('TCP ' + port.port));
        serviceCounts[key] = (serviceCounts[key] || 0) + 1;
      });
      (device.serviceTypes || []).forEach(function (service) {
        var key = serviceLabel(service);
        serviceCounts[key] = (serviceCounts[key] || 0) + 1;
      });
    });
    text('[data-service-total]', Object.keys(serviceCounts).length + ' services');
    renderHorizontalBars('[data-service-distribution]', topEntries(serviceCounts, 10).map(function (entry) {
      return { label: entry[0], sub: 'Service fingerprint', value: entry[1], valueLabel: entry[1] };
    }), 'Service fingerprint belum tersedia.');

    var scopeCounts = {};
    connections.forEach(function (connection) {
      var scope = connectionScope(connection, deviceIps);
      scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;
    });
    var scopeEntries = topEntries(scopeCounts, 5).map(function (entry) { return { label: entry[0], value: entry[1] }; });
    text('[data-destination-total]', connections.length + ' TCP');
    renderMiniDonut('[data-destination-scope]', scopeEntries, connections.length);
    renderStackList('[data-destination-scope-list]', scopeEntries);
  }

  function renderStatusAndTypeCharts(devices) {
    var statuses = groupCount(devices, function (device) { return device.status; });
    var total = devices.length || 1;
    text('[data-status-total]', String(devices.length));
    text('[data-type-total]', String(devices.length));
    var statusStack = document.querySelector('[data-status-stack]');
    if (statusStack) {
      statusStack.innerHTML = ['healthy', 'warning', 'offline', 'critical'].map(function (status) {
        var count = statuses[status] || 0;
        return '<div class="stack-row"><span>' + statusLabel(status) + '</span><b>' + count + '</b></div>';
      }).join('');
    }
    var donut = document.querySelector('[data-status-donut]');
    if (donut) {
      var healthy = Math.round(((statuses.healthy || 0) / total) * 360);
      var warning = Math.round(((statuses.warning || 0) / total) * 360);
      donut.style.background = 'conic-gradient(var(--green) 0deg ' + healthy + 'deg, var(--amber) ' + healthy + 'deg ' + (healthy + warning) + 'deg, var(--red) ' + (healthy + warning) + 'deg 360deg)';
      donut.innerHTML = '<b>' + Math.round(((statuses.healthy || 0) / total) * 100) + '%</b><span>healthy</span>';
    }

    var typeBars = document.querySelector('[data-type-bars]');
    if (typeBars) {
      var types = Object.entries(groupCount(devices, function (device) { return device.type; })).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
      typeBars.innerHTML = types.map(function (entry) {
        var pct = Math.round((entry[1] / total) * 100);
        return '<div class="bar-row"><span>' + escapeHtml(entry[0]) + '</span><b>' + entry[1] + '</b><i><em style="width:' + pct + '%"></em></i></div>';
      }).join('');
    }
  }

  function renderCharts(snapshot) {
    var summary = snapshot.networkUsage && snapshot.networkUsage.summary || {};
    trafficHistory.push({
      time: Date.now(),
      rx: Number(summary.totalRxBps || 0),
      tx: Number(summary.totalTxBps || 0),
      activeTcp: Number(summary.activeTcp || 0),
      localLanTcp: Number(summary.localLanTcp || 0)
    });
    trafficHistory = trafficHistory.slice(-30);

    text('[data-chart-throughput]', (summary.totalRxLabel || '0 B/s') + ' RX / ' + (summary.totalTxLabel || '0 B/s') + ' TX');
    text('[data-chart-connections]', (summary.activeTcp || 0) + ' TCP / ' + (summary.localLanTcp || 0) + ' LAN');

    renderLineChart('[data-traffic-chart]', trafficHistory.map(function (item) { return item.rx; }), trafficHistory.map(function (item) { return item.tx; }), {
      maxLabel: numberLabel
    });
    renderLineChart('[data-connection-chart]', trafficHistory.map(function (item) { return item.activeTcp; }), trafficHistory.map(function (item) { return item.localLanTcp; }), {
      maxLabel: function (value) { return Math.round(value) + ' conn'; }
    });
    renderLineChart('[data-total-traffic-chart]', trafficHistory.map(function (item) { return item.rx + item.tx; }), trafficHistory.map(function (item) { return item.localLanTcp * 1024; }), {
      maxLabel: numberLabel
    });
    text('[data-total-traffic-label]', numberLabel(Number(summary.totalRxBps || 0) + Number(summary.totalTxBps || 0)));

    renderInterfaceGrid(snapshot.networkUsage || {});
    renderStatusAndTypeCharts(snapshot.networkDevices || []);
  }

  function renderLatency(snapshot) {
    var latency = snapshot.networkLatency || {};
    var summary = latency.summary || {};
    latencyHistory.push({
      avg: Number(summary.avgMs || 0),
      jitter: Number(summary.jitterMs || 0),
      max: Number(summary.maxMs || 0)
    });
    latencyHistory = latencyHistory.slice(-30);
    text('[data-latency-label]', summary.avgMs === null || summary.avgMs === undefined ? '-' : summary.avgMs + ' ms avg');
    text('[data-jitter-label]', summary.jitterMs === null || summary.jitterMs === undefined ? '-' : summary.jitterMs + ' ms jitter');
    renderLineChart('[data-latency-chart]', latencyHistory.map(function (item) { return item.avg; }), latencyHistory.map(function (item) { return item.max; }), {
      maxLabel: function (value) { return Math.round(value) + ' ms'; }
    });
    renderLineChart('[data-jitter-chart]', latencyHistory.map(function (item) { return item.jitter; }), latencyHistory.map(function (item) { return 0; }), {
      maxLabel: function (value) { return Math.round(value) + ' ms'; }
    });
    var target = document.querySelector('[data-latency-list]');
    if (target) {
      target.innerHTML = (latency.samples || []).slice().sort(function (a, b) { return Number(b.rttMs || 0) - Number(a.rttMs || 0); }).slice(0, 16).map(function (item) {
        return '<div class="latency-row"><span class="status ' + statusClass(item.status === 'offline' ? 'offline' : item.status) + '">' + escapeHtml(item.status || '-') + '</span><b>' + escapeHtml(item.name || item.ipAddress) + '</b><span class="mono">' + escapeHtml(item.ipAddress) + '</span><strong>' + (item.rttMs === null || item.rttMs === undefined ? '-' : item.rttMs + ' ms') + '</strong></div>';
      }).join('');
    }
  }

  function renderConnectionsTable(snapshot) {
    var tbody = document.querySelector('[data-connection-rows]');
    if (!tbody) return;
    var rows = (snapshot.networkUsage && snapshot.networkUsage.activeConnections || []).slice(0, 120);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">No active TCP connections visible from gateway.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (item) {
      var scope = item.isLocalLan ? 'LAN' : 'Public';
      return '<tr><td><span class="badge ' + (item.isLocalLan ? 'cyan' : 'purple') + '">' + scope + '</span></td><td class="mono">' + escapeHtml(item.localAddress) + ':' + escapeHtml(item.localPort) + '</td><td class="mono">' + escapeHtml(item.remoteAddress) + ':' + escapeHtml(item.remotePort) + '</td><td>' + escapeHtml(item.service || '-') + '</td><td>' + escapeHtml(item.state || '-') + '</td><td class="mono">' + escapeHtml(item.owningProcess || '-') + '</td></tr>';
    }).join('');
  }

  function renderTopologyMapInto(target, snapshot, options) {
    if (!target) return;
    options = options || {};
    var allDevices = snapshot.networkDevices || [];
    var devices = allDevices.slice().sort(function (a, b) {
      return Number(b.activeTcpConnections || 0) - Number(a.activeTcpConnections || 0) ||
        Number(hasResolvedName(b)) - Number(hasResolvedName(a)) ||
        String(a.ipAddress || '').localeCompare(String(b.ipAddress || ''));
    }).slice(0, 160);
    var gateway = snapshot.servers && snapshot.servers[0] || {};
    var connections = snapshot.networkUsage && snapshot.networkUsage.activeConnections || [];
    var deviceIps = new Set(allDevices.map(function (device) { return device.ipAddress; }).filter(Boolean));
    var activeIpCounts = {};
    connections.forEach(function (connection) {
      if (deviceIps.has(connection.remoteAddress)) activeIpCounts[connection.remoteAddress] = (activeIpCounts[connection.remoteAddress] || 0) + 1;
      if (deviceIps.has(connection.localAddress)) activeIpCounts[connection.localAddress] = (activeIpCounts[connection.localAddress] || 0) + 1;
    });

    var positions = {};
    var centerX = 50;
    var centerY = 50;
    var groups = {
      active: devices.filter(function (device) { return Number(device.activeTcpConnections || activeIpCounts[device.ipAddress] || 0) > 0; }),
      named: devices.filter(function (device) { return !Number(device.activeTcpConnections || activeIpCounts[device.ipAddress] || 0) && hasResolvedName(device); }),
      unknown: devices.filter(function (device) { return !Number(device.activeTcpConnections || activeIpCounts[device.ipAddress] || 0) && !hasResolvedName(device); })
    };
    var ordered = groups.active.concat(groups.named, groups.unknown);
    var groupOffsets = { active: -0.35, named: 0.1, unknown: 0.35 };
    var groupStarts = { active: 0, named: groups.active.length, unknown: groups.active.length + groups.named.length };
    var groupSizes = { active: Math.max(groups.active.length, 1), named: Math.max(groups.named.length, 1), unknown: Math.max(groups.unknown.length, 1) };

    var nodes = ordered.map(function (device, index) {
      var bucket = Number(device.activeTcpConnections || activeIpCounts[device.ipAddress] || 0) > 0 ? 'active' : (hasResolvedName(device) ? 'named' : 'unknown');
      var localIndex = index - groupStarts[bucket];
      var localTotal = groupSizes[bucket];
      var baseRing = bucket === 'active' ? 22 : (bucket === 'named' ? 34 : 44);
      var ring = baseRing + ((localIndex % 3) - 1) * 2.8;
      var angle = ((localIndex / localTotal) * Math.PI * 2) + groupOffsets[bucket];
      var x = clamp(centerX + Math.cos(angle) * ring, 4, 96);
      var y = clamp(centerY + Math.sin(angle) * ring, 6, 94);
      positions[device.ipAddress] = { x: x, y: y, angle: angle, ring: ring, bucket: bucket };
      var activeCount = Number(device.activeTcpConnections || activeIpCounts[device.ipAddress] || 0);
      var cls = [
        bucket,
        activeCount > 0 ? 'hot' : 'idle',
        device.status === 'offline' || device.status === 'critical' ? 'down' : '',
        device.status === 'warning' ? 'warn' : '',
        selectedDeviceId === deviceKey(device) ? 'selected' : ''
      ].filter(Boolean).join(' ');
      var title = deviceName(device) + ' - ' + (device.ipAddress || '-') + ' - TCP ' + activeCount;
      return '<button class="topo-node client ' + cls + '" style="left:' + x + '%;top:' + y + '%" data-row-focus="' + escapeHtml(deviceName(device)) + '" data-device-id="' + escapeHtml(deviceKey(device)) + '" title="' + escapeHtml(title) + '">' +
        '<span>' + escapeHtml(deviceName(device).slice(0, 2).toUpperCase()) + '</span><small>' + escapeHtml(activeCount || '') + '</small></button>';
    }).join('');

    var externalCounts = {};
    connections.forEach(function (connection) {
      if (!connection.remoteAddress || deviceIps.has(connection.remoteAddress)) return;
      var key = connection.remoteAddress + ':' + (connection.remotePort || 0);
      var existing = externalCounts[key] || {
        address: connection.remoteAddress,
        port: connection.remotePort,
        service: connection.service,
        count: 0,
        scope: connectionScope(connection, deviceIps)
      };
      existing.count += 1;
      externalCounts[key] = existing;
    });
    var externalNodes = Object.values(externalCounts)
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 18)
      .map(function (item, index, list) {
        var angle = -Math.PI / 2 + (index / Math.max(list.length, 1)) * Math.PI * 2;
        var x = clamp(centerX + Math.cos(angle) * 49, 3, 97);
        var y = clamp(centerY + Math.sin(angle) * 49, 4, 96);
        var id = 'dest-' + item.address + '-' + item.port;
        positions[id] = { x: x, y: y };
        return '<button class="topo-node destination" style="left:' + x + '%;top:' + y + '%" title="' + escapeHtml(item.scope + ' - ' + item.address + ':' + item.port) + '">' +
          '<span>EX</span><small>' + escapeHtml(item.count) + '</small></button>';
      }).join('');

    var deviceEdges = ordered.map(function (device) {
      var pos = positions[device.ipAddress];
      if (!pos) return '';
      var activeCount = Number(device.activeTcpConnections || activeIpCounts[device.ipAddress] || 0);
      var cls = activeCount > 0 ? 'active' : (hasResolvedName(device) ? 'named' : 'faint');
      return '<line class="topo-link ' + cls + '" x1="50" y1="50" x2="' + pos.x.toFixed(2) + '" y2="' + pos.y.toFixed(2) + '"></line>';
    }).join('');
    var destinationEdges = Object.values(externalCounts).sort(function (a, b) { return b.count - a.count; }).slice(0, 18).map(function (item) {
      var pos = positions['dest-' + item.address + '-' + item.port];
      if (!pos) return '';
      return '<line class="topo-link external" x1="50" y1="50" x2="' + pos.x.toFixed(2) + '" y2="' + pos.y.toFixed(2) + '"></line>';
    }).join('');
    var subnetLabels = topEntries(groupCount(devices, function (device) { return subnetKey(device.ipAddress); }), 6).map(function (entry, index, list) {
      var angle = -Math.PI / 2 + (index / Math.max(list.length, 1)) * Math.PI * 2;
      var x = clamp(centerX + Math.cos(angle) * 36, 10, 90);
      var y = clamp(centerY + Math.sin(angle) * 36, 10, 90);
      return '<div class="subnet-label" style="left:' + x + '%;top:' + y + '%"><b>' + escapeHtml(entry[0]) + '</b><span>' + entry[1] + ' clients</span></div>';
    }).join('');

    target.innerHTML =
      '<svg class="topo-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' + deviceEdges + destinationEdges + '</svg>' +
      '<div class="topo-ring ring-active"><span>active</span></div><div class="topo-ring ring-named"><span>named</span></div><div class="topo-ring ring-unknown"><span>unknown</span></div>' +
      subnetLabels +
      '<div class="topo-center"><b>Gateway</b><span>' + escapeHtml(gateway.ipAddress || snapshot.host && snapshot.host.hostname || '-') + '</span></div>' +
      nodes + externalNodes;

    text('[data-map-node-count]', (devices.length + Object.keys(externalCounts).slice(0, 18).length) + ' nodes');
    text('[data-map-edge-count]', (devices.length + Math.min(Object.keys(externalCounts).length, 18)) + ' links');

    return { devices: devices, externalCounts: externalCounts };
  }

  function renderTopology(snapshot) {
    var mainMap = document.querySelector('[data-topology-map]');
    var overviewMap = document.querySelector('[data-overview-topology-map]');
    var result = renderTopologyMapInto(mainMap, snapshot) || renderTopologyMapInto(overviewMap, snapshot);
    if (mainMap && overviewMap) {
      result = renderTopologyMapInto(overviewMap, snapshot) || result;
    }
    if (!result) return;
    var devices = result.devices || [];
    var externalCounts = result.externalCounts || {};

    var hot = document.querySelector('[data-topology-hot-list]');
    if (hot) {
      hot.innerHTML = devices.slice().sort(function (a, b) { return Number(b.activeTcpConnections || 0) - Number(a.activeTcpConnections || 0); }).slice(0, 10).map(function (device) {
        return '<button class="detail-row map-list-btn" data-row-focus="' + escapeHtml(deviceName(device)) + '" data-device-id="' + escapeHtml(deviceKey(device)) + '"><span>' + escapeHtml(deviceName(device)) + '</span><b>' + escapeHtml(device.activeTcpConnections || 0) + ' TCP</b></button>';
      }).join('') || '<span class="muted">No active client connections.</span>';
    }
    var overviewHot = document.querySelector('[data-overview-topology-hot-list]');
    if (overviewHot) {
      overviewHot.innerHTML = devices.slice().sort(function (a, b) { return Number(b.activeTcpConnections || 0) - Number(a.activeTcpConnections || 0); }).slice(0, 8).map(function (device) {
        return '<button class="detail-row map-list-btn" data-row-focus="' + escapeHtml(deviceName(device)) + '" data-device-id="' + escapeHtml(deviceKey(device)) + '"><span>' + escapeHtml(deviceName(device)) + '</span><b>' + escapeHtml(device.activeTcpConnections || 0) + ' TCP</b></button>';
      }).join('') || '<span class="muted">No active client connections.</span>';
    }

    var destinations = document.querySelector('[data-topology-destination-list]');
    if (destinations) {
      destinations.innerHTML = Object.values(externalCounts)
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 10)
        .map(function (item) {
          return '<div class="detail-row"><span>' + escapeHtml(item.scope) + '<br><span class="mono">' + escapeHtml(item.address) + ':' + escapeHtml(item.port) + '</span></span><b>' + escapeHtml(item.count) + ' TCP</b></div>';
        }).join('') || '<span class="muted">Tidak ada koneksi public/private non-client yang terlihat.</span>';
    }
    var overviewDestinations = document.querySelector('[data-overview-topology-destination-list]');
    if (overviewDestinations) {
      overviewDestinations.innerHTML = Object.values(externalCounts)
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 8)
        .map(function (item) {
          return '<div class="detail-row"><span>' + escapeHtml(item.scope) + '<br><span class="mono">' + escapeHtml(item.address) + ':' + escapeHtml(item.port) + '</span></span><b>' + escapeHtml(item.count) + ' TCP</b></div>';
        }).join('') || '<span class="muted">Tidak ada koneksi public/private non-client yang terlihat.</span>';
    }
  }

  function renderInterfaceGrid(usage) {
    var target = document.querySelector('[data-interface-grid]');
    if (!target) return;
    var items = (usage.interfaces || []).slice(0, 4);
    if (!items.length) {
      target.innerHTML = '<div class="metric"><span>Interface usage</span><b>-</b></div>';
      return;
    }
    target.innerHTML = items.map(function (item) {
      var errors = Number(item.receiveErrors || 0) + Number(item.transmitErrors || 0);
      return '<div class="metric"><span>' + escapeHtml(item.name) + '</span><b>' + escapeHtml(item.rxLabel || '0 B/s') + ' RX</b><small>TX ' + escapeHtml(item.txLabel || '0 B/s') + ' - ' + escapeHtml(item.status || '-') + ' - errors ' + errors + '</small></div>';
    }).join('');
  }

  function renderLiveEvents(snapshot) {
    var tbody = document.querySelector('#live-events tbody');
    if (!tbody) return;

    var alerts = snapshot.alerts || [];
    if (alerts.length === 0) {
      tbody.innerHTML = '<tr><td><span class="status ok">Healthy</span></td><td><b>No active alerts</b><br><span class="muted">Gateway runtime reports normal thresholds</span></td><td><b>' + escapeHtml(snapshot.host && snapshot.host.hostname || '-') + '</b></td><td><span class="mono muted">Runtime snapshot</span></td><td><span class="badge cyan">OS metrics</span></td><td class="muted">' + formatTime(snapshot.generatedAt) + '</td></tr>';
      return;
    }

    tbody.innerHTML = alerts.map(function (alert) {
      return '<tr data-row-focus="' + escapeHtml(alert.source) + '"><td><span class="status ' + severityClass(alert.severity) + '">' + escapeHtml(alert.severity) + '</span></td><td><b>' + escapeHtml(alert.message) + '</b><br><span class="muted">Runtime threshold alert</span></td><td><b>' + escapeHtml(alert.source) + '</b></td><td><span class="mono muted">' + escapeHtml(snapshot.host && snapshot.host.platform || 'gateway') + '</span></td><td><span class="badge cyan">OS metrics</span></td><td class="muted">' + formatTime(alert.timestamp) + '</td></tr>';
    }).join('');
  }

  function renderDeviceRows(devices) {
    var tbody = document.querySelector('[data-network-devices]') || document.querySelector('[data-network-interfaces]');
    if (!tbody) return;

    if (!devices.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="muted">No LAN devices reported by gateway runtime.</td></tr>';
      return;
    }

    tbody.innerHTML = devices.map(function (device) {
      var title = device.hostname || device.name || device.ipAddress || device.macAddress || 'Unknown device';
      var subtitle = device.inventoryStale ? 'Previous cache - not seen in latest scan' : (device.httpTitle || device.httpServer || device.addressFamily || device.branch || '-');
      var macVendor = [
        device.macAddress ? '<span class="mono">' + escapeHtml(device.macAddress) + '</span>' : '<span class="muted">MAC unknown</span>',
        device.vendor ? '<span class="muted">' + escapeHtml(device.vendor) + '</span>' : ''
      ].filter(Boolean).join('<br>');
      var evidence = (device.evidence || []).slice(0, 4).map(escapeHtml).join('<br>');

      return '<tr data-row-focus="' + escapeHtml(title) + '" data-device-id="' + escapeHtml(device.id || device.ipAddress || title) + '">' +
        '<td><b>' + escapeHtml(title) + '</b><br><span class="muted">' + escapeHtml(subtitle) + '</span></td>' +
        '<td><span class="status ' + statusClass(device.status) + '">' + statusLabel(device.status) + '</span>' + (device.inventoryStale ? '<br><span class="muted">stale</span>' : '') + '</td>' +
        '<td>' + escapeHtml(device.type || 'Unknown') + '</td>' +
        '<td><b class="mono">' + escapeHtml(device.ipAddress || '-') + '</b><br><span class="muted">' + escapeHtml(device.cidr || device.netmask || '') + '</span></td>' +
        '<td>' + macVendor + '</td>' +
        '<td>' + renderPorts(device) + '</td>' +
        '<td>' + renderConnections(device) + '</td>' +
        '<td>' + renderBadges(device.sources, 'purple') + '</td>' +
        '<td class="evidence-cell">' + (evidence || '<span class="muted">-</span>') + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderResourceList(server) {
    var target = document.querySelector('[data-resource-list]');
    if (!target || !server) return;

    target.innerHTML = [
      ['CPU usage', server.cpuUsage + '%', server.cpuUsage >= 80 ? 'warn' : 'ok'],
      ['RAM usage', server.ramUsage + '%', server.ramUsage >= 85 ? 'warn' : 'ok'],
      ['Disk usage', server.diskUsage + '%', server.diskUsage >= 90 ? 'warn' : 'ok'],
      ['Uptime', server.uptime || '-', '']
    ].map(function (item) {
      return '<div class="event"><i class="event-line ' + item[2] + '"></i><div><div class="event-title">' + escapeHtml(item[0]) + '</div><div class="event-desc">' + escapeHtml(server.name) + '</div></div><div class="event-time">' + escapeHtml(item[1]) + '</div></div>';
    }).join('');
  }

  function detailRows(items) {
    return items.map(function (item) {
      return '<div class="detail-row"><span>' + escapeHtml(item[0]) + '</span><b>' + escapeHtml(item[1] || '-') + '</b></div>';
    }).join('');
  }

  function listBadges(items, className) {
    var values = (items || []).filter(Boolean);
    if (!values.length) return '<span class="muted">-</span>';
    return '<div class="chip-list">' + values.map(function (item) {
      return '<span class="badge ' + (className || '') + '">' + escapeHtml(item) + '</span>';
    }).join('') + '</div>';
  }

  function renderClientDetail(device) {
    if (!device) return;
    var name = device.hostname || device.name || device.ipAddress || 'Unknown device';
    var relatedConnections = relatedConnectionsForDevice(device, latestSnapshot);
    var latency = getDeviceLatency(device);
    text('[data-detail-name]', name);
    text('[data-detail-ip]', device.ipAddress || '-');
    text('[data-detail-subtitle]', device.inventoryStale ? 'Previous cache' : 'Live inventory');
    text('[data-detail-initial]', name.slice(0, 2).toUpperCase());
    text('[data-detail-status]', statusLabel(device.status));
    text('[data-detail-active-tcp]', String(device.activeTcpConnections || 0));
    text('[data-detail-type]', device.type || 'Unknown');

    var identity = document.querySelector('[data-detail-identity]');
    if (identity) {
      identity.innerHTML = detailRows([
        ['Hostname', device.hostname || device.name || '-'],
        ['IP address', device.ipAddress || '-'],
        ['MAC', device.macAddress || '-'],
        ['Vendor', device.vendor || '-'],
        ['CIDR / netmask', device.cidr || device.netmask || '-'],
        ['Last seen', device.lastSeen || device.lastCheck || '-']
      ]);
    }

    var ports = document.querySelector('[data-detail-ports]');
    if (ports) {
      ports.innerHTML = detailRows([
        ['Active TCP', String(device.activeTcpConnections || 0)],
        ['Established', String(device.establishedTcpConnections || 0)],
        ['Latency', latency === null ? '-' : latency + ' ms'],
        ['Reachable ping', device.reachableByPing === null || device.reachableByPing === undefined ? '-' : (device.reachableByPing ? 'Yes' : 'No')]
      ]) + '<div class="detail-block"><span>Open ports</span>' + listBadges((device.openPorts || []).map(function (port) { return port.port + '/' + (port.service || 'TCP'); }), 'cyan') + '</div>' +
        '<div class="detail-block"><span>Connection ports</span>' + listBadges(device.connectionPorts, 'cyan') + '</div>' +
        '<div class="detail-block"><span>Visible TCP sessions</span>' + (relatedConnections.length ? relatedConnections.slice(0, 10).map(function (connection) {
          return '<p><b class="mono">' + escapeHtml(connection.localAddress) + ':' + escapeHtml(connection.localPort) + '</b> -> <b class="mono">' + escapeHtml(connection.remoteAddress) + ':' + escapeHtml(connection.remotePort) + '</b> ' + escapeHtml(connection.state || '-') + ' / ' + escapeHtml(connection.service || '-') + '</p>';
        }).join('') : '<span class="muted">Tidak ada sesi TCP gateway yang terkait client ini.</span>') + '</div>';
    }

    var evidence = document.querySelector('[data-detail-evidence]');
    if (evidence) {
      evidence.innerHTML = '<div class="detail-block"><span>Sources</span>' + listBadges(device.sources, 'purple') + '</div>' +
        '<div class="detail-block"><span>Evidence</span>' + (device.evidence || []).slice(0, 8).map(function (item) {
          return '<p>' + escapeHtml(item) + '</p>';
        }).join('') + '</div>';
    }

    var mapSelected = document.querySelector('[data-map-selected]');
    if (mapSelected) {
      mapSelected.innerHTML = '<div class="client-identity compact"><div class="client-mark">' + escapeHtml(name.slice(0, 2).toUpperCase()) + '</div><div><h3>' + escapeHtml(name) + '</h3><div class="muted mono">' + escapeHtml(device.ipAddress || '-') + '</div></div></div>' +
        detailRows([
          ['Status', statusLabel(device.status)],
          ['Type', device.type || 'Unknown'],
          ['Active TCP', String(device.activeTcpConnections || 0)],
          ['Open ports', String((device.openPorts || []).length)],
          ['Latency', latency === null ? '-' : latency + ' ms'],
          ['Subnet', subnetKey(device.ipAddress)]
        ]);
    }
  }

  function renderSelectedDetail() {
    var devices = latestSnapshot && latestSnapshot.networkDevices || [];
    var selected = devices.find(function (device) {
      return (device.id || device.ipAddress) === selectedDeviceId;
    }) || devices.find(function (device) { return device.activeTcpConnections > 0; }) || devices[0];
    if (selected) {
      selectedDeviceId = selected.id || selected.ipAddress;
      renderClientDetail(selected);
    }
  }

  function renderUsageList(usage) {
    var target = document.querySelector('[data-resource-list]');
    if (!target || !usage) return false;
    var items = (usage.interfaces || []).slice(0, 6);
    if (!items.length) return false;
    target.innerHTML = items.map(function (item) {
      var errors = Number(item.receiveErrors || 0) + Number(item.transmitErrors || 0);
      return '<div class="event"><i class="event-line ' + (errors ? 'warn' : 'ok') + '"></i><div><div class="event-title">' + escapeHtml(item.name) + '</div><div class="event-desc">' + escapeHtml(item.status || '-') + ' - ' + escapeHtml(item.linkSpeed || '-') + ' - errors ' + errors + '</div></div><div class="event-time">RX ' + escapeHtml(item.rxLabel || '0 B/s') + '<br>TX ' + escapeHtml(item.txLabel || '0 B/s') + '</div></div>';
    }).join('');
    return true;
  }

  function renderDiscoverySummary(discovery, snapshot) {
    discovery = discovery || {};
    var methods = discovery.methods || [];
    var counts = discovery.methodCounts || {};
    var cacheState = discovery.refreshing ? 'refreshing background' : (discovery.stale ? 'stale cache' : 'static cache');
    var cacheAge = formatDurationMs(discovery.cacheAgeMs);
    var refreshInterval = formatDurationMs(discovery.refreshIntervalMs);
    var target = document.querySelector('[data-discovery-method-list]');
    if (target) {
      target.innerHTML = methods.map(function (method) {
        var count = counts[method] || 0;
        return '<span class="badge">' + escapeHtml(method) + (count ? ' (' + count + ')' : '') + '</span>';
      }).join('') || '<span class="muted">Waiting for discovery metadata</span>';
    }

    text('[data-discovery-duration]', (discovery.durationMs || 0) + ' ms');
    text('[data-discovery-targets]', String(discovery.targetCount || 0));
    text('[data-discovery-subnets]', String(discovery.subnetCount || 0));
    text('[data-discovery-limit]', String(discovery.targetLimit || 0));
    text('[data-cache-status]', cacheState);
    text('[data-cache-age]', cacheAge);
    text('[data-refresh-interval]', refreshInterval);
    text('[data-snapshot-source]', 'Source: static discovery cache - ' + cacheState + ' - age ' + cacheAge + ' - interval ' + refreshInterval + ' - snapshot ' + formatTime(snapshot.generatedAt));
  }

  function renderMonitoringSnapshot(snapshot) {
    latestSnapshot = snapshot;
    var servers = snapshot.servers || [];
    var devices = snapshot.networkDevices || [];
    var alerts = snapshot.alerts || [];
    var incidents = snapshot.incidents || [];
    var discovery = snapshot.networkDiscovery || {};
    var usage = snapshot.networkUsage || {};
    var usageSummary = usage.summary || {};
    var server = servers[0] || {};
    var healthyDevices = devices.filter(function (device) { return device.status === 'healthy'; }).length;
    var warningDevices = devices.filter(function (device) { return device.status === 'warning'; }).length;
    var offlineDevices = devices.filter(function (device) { return device.status === 'offline'; }).length;
    var openPortCount = devices.reduce(function (total, device) { return total + ((device.openPorts || []).length); }, 0);

    text('.site-switch b', (snapshot.host && snapshot.host.hostname || 'Gateway Host') + ' - Live');
    text('.sidebar-bottom small', discovery.refreshing ? 'COLLECTOR - REFRESHING CACHE' : 'COLLECTOR - STATIC DISCOVERY CACHE');
    text('.user-mini b', snapshot.host && snapshot.host.hostname || 'Gateway');
    text('[data-last-updated]', 'Updated ' + formatTime(snapshot.generatedAt));
    text('.nav-count', String(alerts.length));

    setKpiValue(0, healthyDevices + ' / ' + devices.length, devices.length + ' discovered LAN devices');
    setKpiValue(1, String((discovery.methods || []).length), (discovery.refreshing ? 'refreshing in background' : 'agentless discovery methods'));
    setKpiValue(2, escapeHtml(server.ipAddress || '-'), 'Primary gateway interface');
    setKpiValue(3, (usageSummary.totalRxLabel || '0 B/s') + ' <span style="font-size:13px;color:#85a0b7">RX</span>', 'TX ' + (usageSummary.totalTxLabel || '0 B/s') + ' - TCP ' + (usageSummary.activeTcp || 0));
    setKpiValue(4, String(incidents.length), alerts.length + ' active alerts');

    renderLiveEvents(snapshot);
    renderDeviceRows(devices);
    renderCharts(snapshot);
    renderLatency(snapshot);
    renderConnectionsTable(snapshot);
    renderTopology(snapshot);
    renderClientSummaryCharts(snapshot);
    if (!renderUsageList(usage)) renderResourceList(server);
    renderDiscoverySummary(discovery, snapshot);
    renderSelectedDetail();
  }

  function loadMonitoringSnapshot(forceDiscovery) {
    var url = forceDiscovery ? '/api/monitoring/snapshot?forceDiscovery=1' : '/api/monitoring/snapshot';
    fetch(url, {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(renderMonitoringSnapshot)
      .catch(function (error) {
        var target = document.querySelector('#live-events .panel-title');
        if (target) target.innerHTML = 'Live network events <span class="panel-sub">Snapshot unavailable: ' + escapeHtml(error.message) + '</span>';
      });
  }

  document.querySelectorAll('[data-nav]').forEach(function (el) {
    el.addEventListener('click', function () {
      document.querySelectorAll('[data-nav]').forEach(function (item) { item.classList.remove('active'); });
      el.classList.add('active');
    });
  });

  document.querySelectorAll('.filter-chip').forEach(function (el) {
    el.addEventListener('click', function () { el.classList.toggle('active'); });
  });

  var search = document.querySelector('.global-search input');
  if (search) {
    search.addEventListener('input', function () {
      var rows = Array.prototype.slice.call(document.querySelectorAll('[data-network-devices] tr'));
      var query = search.value.trim().toLowerCase();
      rows.forEach(function (row) {
        row.style.display = !query || row.textContent.toLowerCase().includes(query) ? '' : 'none';
      });
    });
  }

  document.addEventListener('click', function (event) {
    var row = event.target.closest('[data-row-focus]');
    var topoNode = event.target.closest('.topo-node');
    var clickable = row || topoNode;
    if (!clickable) return;
    selectedDeviceId = clickable.getAttribute('data-device-id') || selectedDeviceId;
    var drawer = document.querySelector('[data-drawer-title]');
    if (drawer && row) drawer.textContent = row.getAttribute('data-row-focus');
    document.querySelectorAll('tbody tr').forEach(function (tr) { tr.style.background = ''; });
    if (row) row.style.background = 'rgba(55,212,233,.10)';
    renderSelectedDetail();
  });

  document.querySelectorAll('[data-tab]').forEach(function (button) {
    button.addEventListener('click', function () {
      var tab = button.getAttribute('data-tab');
      document.querySelectorAll('[data-tab]').forEach(function (item) { item.classList.toggle('active', item === button); });
      document.querySelectorAll('[data-tab-panel]').forEach(function (panel) {
        panel.classList.toggle('active', panel.getAttribute('data-tab-panel') === tab);
      });
      if (tab === 'inventory') {
        document.querySelector('#interfaces')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  document.querySelectorAll('[data-refresh], [data-refresh-secondary], [data-refresh-tertiary]').forEach(function (button) {
    button.addEventListener('click', function () { loadMonitoringSnapshot(true); });
  });

  loadMonitoringSnapshot(false);
  window.setInterval(function () { loadMonitoringSnapshot(false); }, 10000);
})();
