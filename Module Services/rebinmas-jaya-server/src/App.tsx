import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MonitoringProvider } from './store/MonitoringContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import NetworkDevices from './pages/Network';
import Incidents from './pages/Incidents';
import Alerts from './pages/Alerts';

const PROXY_BASENAMES = ['/server-monitor'];

function getProxyBasename() {
  if (typeof window === 'undefined') return '';

  return PROXY_BASENAMES.find((prefix) => {
    return window.location.pathname === prefix || window.location.pathname.startsWith(`${prefix}/`);
  }) || '';
}

export default function App() {
  return (
    <MonitoringProvider>
      <BrowserRouter basename={getProxyBasename()}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="servers" element={<Servers />} />
            <Route path="network" element={<NetworkDevices />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="alerts" element={<Alerts />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MonitoringProvider>
  );
}
