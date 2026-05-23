'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, createContext, useContext, ReactNode } from 'react';

// ============================================================
// TYPES
// ============================================================
export type UserRole = 'kerani' | 'hr' | 'payroll' | 'manager' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  division?: string;
  gang?: string;
  avatar?: string;
}

export interface AppState {
  sidebarCollapsed: boolean;
  activePeriod: string;
  activeDivision: string;
  user: User | null;
}

export interface AppContextValue extends AppState {
  setSidebarCollapsed: (v: boolean) => void;
  setActivePeriod: (v: string) => void;
  setActiveDivision: (v: string) => void;
  setUser: (u: User | null) => void;
}

// ============================================================
// CONTEXT
// ============================================================
export const AppContext = createContext<AppContextValue>({
  sidebarCollapsed: false,
  activePeriod: 'Mei 2026',
  activeDivision: 'DME - Divisi Kebun',
  user: null,
  setSidebarCollapsed: () => {},
  setActivePeriod: () => {},
  setActiveDivision: () => {},
  setUser: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePeriod, setActivePeriod] = useState('Mei 2026');
  const [activeDivision, setActiveDivision] = useState('DME - Divisi Kebun');
  const [user, setUser] = useState<User | null>({
    id: 'u1',
    name: 'Admin User',
    email: 'admin@rebinmas.com',
    role: 'admin',
    division: 'DME',
  });

  return (
    <AppContext.Provider value={{
      sidebarCollapsed,
      activePeriod,
      activeDivision,
      user,
      setSidebarCollapsed,
      setActivePeriod,
      setActiveDivision,
      setUser,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}

// ============================================================
// REACT QUERY CLIENT
// ============================================================
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,       // 30 seconds
        gcTime: 5 * 60 * 1000,      // 5 minutes (formerly cacheTime)
        retry: 3,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new client if we don't already have one
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// ============================================================
// PROVIDERS
// ============================================================
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {children}
      </AppProvider>
    </QueryClientProvider>
  );
}
