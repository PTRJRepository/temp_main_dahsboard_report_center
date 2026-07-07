/**
 * IFESS Control Server - Environment Configuration
 *
 * Add these variables to your .env file:
 *
 * # IFESS Control Server API Key
 * IFESS_API_KEY=ptrj-rebinmas-air-ruak-parit-gunung-darul
 *
 * # Public API key for Next.js frontend (optional - for dashboard access)
 * NEXT_PUBLIC_IFESS_API_KEY=ptrj-rebinmas-air-ruak-parit-gunung-darul
 */

export const ifessConfig = {
  // Default API key (matches .NET implementation)
  defaultApiKey: 'ptrj-rebinmas-air-ruak-parit-gunung-darul',

  // API endpoints
  apiBase: '/api/ifess',

  // Health check endpoint (public)
  healthEndpoint: '/api/ifess/health',

  // Refresh interval for dashboard (ms)
  refreshInterval: 30000,

  // Command types available
  commandTypes: [
    { value: 'StartModule', label: 'Start Module' },
    { value: 'StopModule', label: 'Stop Module' },
    { value: 'RestartModule', label: 'Restart Module' },
    { value: 'UpdateConfig', label: 'Update Config' },
    { value: 'ShutdownApp', label: 'Shutdown App' },
    { value: 'RestartApp', label: 'Restart App' },
  ],

  // Module runtime statuses
  moduleStatuses: [
    { value: 'Stopped', label: 'Stopped', color: 'gray' },
    { value: 'Running', label: 'Running', color: 'green' },
    { value: 'Error', label: 'Error', color: 'red' },
    { value: 'Unknown', label: 'Unknown', color: 'yellow' },
  ],

  // Client statuses
  clientStatuses: [
    { value: 'Online', label: 'Online', color: 'green' },
    { value: 'Offline', label: 'Offline', color: 'gray' },
    { value: 'Error', label: 'Error', color: 'red' },
  ],

  // Command statuses
  commandStatuses: [
    { value: 'Pending', label: 'Pending', color: 'yellow' },
    { value: 'Received', label: 'Received', color: 'blue' },
    { value: 'Executing', label: 'Executing', color: 'blue' },
    { value: 'Completed', label: 'Completed', color: 'green' },
    { value: 'Failed', label: 'Failed', color: 'red' },
    { value: 'Expired', label: 'Expired', color: 'gray' },
    { value: 'Cancelled', label: 'Cancelled', color: 'gray' },
  ],
};
