'use client'

import { useState } from 'react'
import {
  BarChart3, FileText, Download, Wallet, Package, AlertTriangle, Clock,
  ChevronDown, RefreshCw, Maximize2, TrendingUp, TrendingDown, Minus,
  CheckCircle2, XCircle, AlertCircle, ArrowRight, Database, Link2
} from 'lucide-react'
import { ProtectedRoute } from '@/lib/rbac/ProtectedRoute'

// ============================================================
// MOCK DATA
// ============================================================
const KPI_CARDS = [
  { id: 'kpi1', label: 'Total Reports', value: '151', icon: FileText, accent: '#167A3A', trend: 'up' as const, trendValue: '+12%', subtitle: 'Aktif bulan ini' },
  { id: 'kpi2', label: 'Total Export', value: '1,248', icon: Download, accent: '#2563EB', trend: 'up' as const, trendValue: '+8%', subtitle: 'Sepanjang waktu' },
  { id: 'kpi3', label: 'Payroll This Mo', value: 'Rp 2.4B', icon: Wallet, accent: '#D9A514', trend: 'up' as const, trendValue: '+3%', subtitle: 'Mei 2026' },
  { id: 'kpi4', label: 'Inventory Value', value: 'Rp 8.7B', icon: Package, accent: '#EA8A13', trend: 'down' as const, trendValue: '-2%', subtitle: 'Perubahan stok' },
];

const ANOMALY_ALERTS = [
  { id: 'a1', type: 'critical', message: 'Integration failure — 3 systems disconnected', timestamp: '20 Mei 2026 08:30', module: 'Integrasi & Audit', link: '/modules/integrasi' },
  { id: 'a2', type: 'warning', message: 'Payroll data mismatch — 2 employee records inconsistent', timestamp: '20 Mei 2026 07:15', module: 'Payroll', link: '/modules/payroll' },
  { id: 'a3', type: 'warning', message: 'Inventory sync delayed — 2h overdue', timestamp: '19 Mei 2026 18:00', module: 'Inventory', link: '/modules/inventory' },
];

const DELAYED_REPORTS = [
  { id: 'd1', name: 'Absensi Harian', module: 'Absensi', daysOverdue: 3, link: '/modules/absensi' },
  { id: 'd2', name: 'Produktivitas Panen', module: 'Produktivitas', daysOverdue: 1, link: '/modules/produktivitas' },
];

const QUICK_EXPORT = [
  { id: 'qe1', label: 'Payroll Bulanan', icon: Wallet, color: '#167A3A', modules: 'Payroll, Daftar Upah, Premi' },
  { id: 'qe2', label: 'Absensi Harian', icon: FileText, color: '#2563EB', modules: 'Absensi, Lembur' },
  { id: 'qe3', label: 'Inventory Mingguan', icon: Package, color: '#EA8A13', modules: 'Inventory, Stok, Mutasi' },
  { id: 'qe4', label: 'Produktivitas', icon: BarChart3, color: '#D9A514', modules: 'Produktivitas, Panen, TBS' },
];

const MODULE_SUMMARY = [
  { module: 'Absensi', reports: 18, lastUpdate: '20 Mei 2026 07:45', status: 'normal' },
  { module: 'Payroll', reports: 24, lastUpdate: '20 Mei 2026 08:30', status: 'normal' },
  { module: 'Daftar Upah', reports: 15, lastUpdate: '19 Mei 2026 16:20', status: 'normal' },
  { module: 'Inventory', reports: 22, lastUpdate: '20 Mei 2026 08:20', status: 'warning' },
  { module: 'Premi & Lembur', reports: 12, lastUpdate: '19 Mei 2026 15:10', status: 'normal' },
  { module: 'Produktivitas', reports: 16, lastUpdate: '19 Mei 2026 17:30', status: 'warning' },
  { module: 'Karyawan', reports: 20, lastUpdate: '19 Mei 2026 17:00', status: 'normal' },
  { module: 'Estate/Divisi', reports: 10, lastUpdate: '18 Mei 2026 16:00', status: 'normal' },
  { module: 'Integrasi & Audit', reports: 14, lastUpdate: '20 Mei 2026 08:45', status: 'critical' },
];

const PERIODS = ['Mei 2026', 'April 2026', 'Maret 2026', 'Februari 2026'];
const DIVISIONS = ['Semua Divisi', 'DME - Divisi Kebun', 'DMB - Divisi Batu', 'DMS - Divisi Sengkela'];

// ============================================================
// TREND ICON COMPONENT
// ============================================================
function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

// ============================================================
// KPI CARD COMPONENT
// ============================================================
function KPICard({ kpi, onClick }: { kpi: typeof KPI_CARDS[0]; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const Icon = kpi.icon;

  return (
    <div
      className="relative bg-white rounded-xl border border-slate-200 p-5 cursor-pointer transition-all duration-200"
      style={{ boxShadow: hovered ? '0 8px 25px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.06)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: kpi.accent + '15' }}>
          <Icon className="w-6 h-6" style={{ color: kpi.accent }} />
        </div>
        <div className="flex items-center gap-1">
          <TrendIcon trend={kpi.trend} />
          <span className={`text-sm font-medium ${kpi.trend === 'up' ? 'text-green-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-slate-500'}`}>
            {kpi.trendValue}
          </span>
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1">{kpi.value}</p>
      <p className="text-sm font-medium text-slate-700 mb-0.5">{kpi.label}</p>
      <p className="text-xs text-slate-400">{kpi.subtitle}</p>
    </div>
  );
}

// ============================================================
// ALERT ITEM COMPONENT
// ============================================================
function AlertItem({ alert, onClick }: { alert: typeof ANOMALY_ALERTS[0]; onClick: () => void }) {
  const isCritical = alert.type === 'critical';
  const bgColor = isCritical ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
  const iconColor = isCritical ? 'text-red-500' : 'text-yellow-600';
  const IconComponent = isCritical ? XCircle : AlertCircle;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${bgColor}`}>
      <span className={iconColor}><IconComponent className="w-5 h-5 flex-shrink-0 mt-0.5" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{alert.message}</p>
        <p className="text-xs text-slate-400 mt-0.5">{alert.module} · {alert.timestamp}</p>
      </div>
      <button onClick={onClick} className="flex-shrink-0 p-1 rounded hover:bg-white/50 transition-colors" aria-label={`View ${alert.module}`}>
        <ArrowRight className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

// ============================================================
// DELAYED ITEM COMPONENT
// ============================================================
function DelayedItem({ item }: { item: typeof DELAYED_REPORTS[0] }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
      <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{item.name}</p>
        <p className="text-xs text-slate-400">{item.module}</p>
      </div>
      <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">
        {item.daysOverdue}h overdue
      </span>
    </div>
  );
}

// ============================================================
// QUICK EXPORT BUTTON COMPONENT
// ============================================================
function QuickExportButton({ qe }: { qe: typeof QUICK_EXPORT[0] }) {
  const [hovered, setHovered] = useState(false);
  const Icon = qe.icon;

  return (
    <div
      className="relative rounded-xl border-2 p-4 cursor-pointer transition-all duration-200 flex flex-col items-center gap-2"
      style={{ 
        borderColor: hovered ? qe.color : qe.color + '40',
        backgroundColor: hovered ? qe.color + '10' : 'white',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: qe.color + '20' }}>
        <Icon className="w-6 h-6" style={{ color: qe.color }} />
      </div>
      <p className="text-sm font-semibold text-slate-800 text-center">{qe.label}</p>
      <p className="text-xs text-slate-400 text-center">{qe.modules}</p>
    </div>
  );
}

// ============================================================
// STATUS ICON COMPONENT
// ============================================================
function StatusIcon({ status }: { status: string }) {
  if (status === 'normal') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ExecutiveDashboard() {
  return (
    <ProtectedRoute
      allowedRoles={['SuperAdmin', 'admin', 'manager']}
      redirectOnUnauthenticated={true}
    >
      <ExecutiveDashboardInner />
    </ProtectedRoute>
  )
}

function ExecutiveDashboardInner() {
  const [period, setPeriod] = useState(PERIODS[0])
  const [division, setDivision] = useState(DIVISIONS[0]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);

  const handleRefresh = () => setLastRefresh(new Date());

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F6F8FB' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Executive Dashboard</h1>
            <p className="text-sm text-slate-500">KPI overview — Last refresh: {lastRefresh.toLocaleTimeString('id-ID')}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Selector */}
            <div className="relative">
              <button
                onClick={() => { setShowPeriodDropdown(!showPeriodDropdown); setShowDivisionDropdown(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50 transition-colors"
              >
                <span className="text-slate-600">{period}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {showPeriodDropdown && (
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                  {PERIODS.map(p => (
                    <button
                      key={p}
                      onClick={() => { setPeriod(p); setShowPeriodDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${period === p ? 'text-green-700 font-medium' : 'text-slate-700'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Division Selector */}
            <div className="relative">
              <button
                onClick={() => { setShowDivisionDropdown(!showDivisionDropdown); setShowPeriodDropdown(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50 transition-colors"
              >
                <span className="text-slate-600">{division}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {showDivisionDropdown && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                  {DIVISIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => { setDivision(d); setShowDivisionDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${division === d ? 'text-green-700 font-medium' : 'text-slate-700'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                autoRefresh ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
              aria-label="Refresh data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
              aria-label="Fullscreen"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_CARDS.map(kpi => (
            <KPICard
              key={kpi.id}
              kpi={kpi}
              onClick={() => window.location.href = `/modules/${kpi.label.toLowerCase().replace(' ', '-')}`}
            />
          ))}
        </div>

        {/* Alerts + Delayed Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Anomaly Alerts */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-base font-semibold text-slate-900">Anomaly Alerts</h2>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{ANOMALY_ALERTS.length}</span>
            </div>
            <div className="space-y-2">
              {ANOMALY_ALERTS.map(alert => (
                <AlertItem key={alert.id} alert={alert} onClick={() => window.location.href = alert.link} />
              ))}
            </div>
          </div>

          {/* Delayed Reports */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-yellow-500" />
              <h2 className="text-base font-semibold text-slate-900">Delayed Reports</h2>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{DELAYED_REPORTS.length}</span>
            </div>
            <div className="space-y-2">
              {DELAYED_REPORTS.map(item => <DelayedItem key={item.id} item={item} />)}
            </div>
          </div>
        </div>

        {/* Quick Export Paket */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Download className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Quick Export Paket</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_EXPORT.map(qe => <QuickExportButton key={qe.id} qe={qe} />)}
          </div>
        </div>

        {/* Cross-Module Summary Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Cross-Module Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full" role="grid">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Module</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reports</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Update</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MODULE_SUMMARY.map(row => (
                  <tr key={row.module} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="text-sm font-medium text-slate-800">{row.module}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-sm text-slate-600">{row.reports}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-sm text-slate-500">{row.lastUpdate}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <StatusIcon status={row.status} />
                        <span className={`text-xs font-medium ${
                          row.status === 'normal' ? 'text-green-600' : row.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {row.status === 'normal' ? 'Normal' : row.status === 'warning' ? 'Warning' : 'Critical'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90"
                        style={{ backgroundColor: '#167A3A' }}
                        onClick={() => window.location.href = `/modules/${row.module.toLowerCase().replace(/[& ]/g, '-').replace('---', '-')}`}
                      >
                        Export All
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Status Footer */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-green-500" />
                <span className="text-slate-600">Database: <span className="text-green-700 font-medium">Online</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-green-500" />
                <span className="text-slate-600">Integrasi: <span className="text-green-700 font-medium">Terhubung</span></span>
              </div>
            </div>
            <p className="text-slate-400 text-xs">Report Center v2.0 · Auto-refresh setiap 5 menit</p>
          </div>
        </div>
      </main>
    </div>
  );
}
