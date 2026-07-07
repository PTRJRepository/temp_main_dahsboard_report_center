import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Server, Network, AlertTriangle, Activity, Settings, Bell, Search, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { useMonitoring } from '../store/MonitoringContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Servers', href: '/servers', icon: Server },
  { name: 'Network Devices', href: '/network', icon: Network },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
];

export default function Layout() {
  const { alerts } = useMonitoring();
  const unackedAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-800">
          <Activity className="h-6 w-6 text-blue-500 mr-3" />
          <span className="font-semibold text-lg tracking-tight text-white">Rebinmas Jaya</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-blue-900/40 text-blue-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                )
              }
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {item.name}
              {item.name === 'Alerts' && unackedAlerts > 0 && (
                <span className="ml-auto bg-red-500/20 text-red-400 py-0.5 px-2 rounded-full text-xs">
                  {unackedAlerts}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 rounded-md hover:bg-gray-800 hover:text-gray-100 cursor-pointer">
            <Settings className="mr-3 h-5 w-5" />
            Settings
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex-1 flex items-center">
            <div className="relative w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search resources, IPs, MACs..."
                className="block w-full pl-10 pr-3 py-1.5 border border-gray-700 rounded-md leading-5 bg-gray-950 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
              />
            </div>
          </div>
          <div className="ml-4 flex items-center space-x-4">
            <div className="flex items-center text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              <span className="text-gray-400">System Normal</span>
            </div>
            <button className="text-gray-400 hover:text-gray-100 transition-colors">
              <ShieldAlert className="h-5 w-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-medium border border-gray-700">
              AD
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-950 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
