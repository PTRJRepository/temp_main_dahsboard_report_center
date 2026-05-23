/**
 * lib/rbac/AuthContext.tsx
 * React context that holds the current UserSession.
 * Ships with five mock users (one per role) for development / demo.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AuthContextValue, Role, UserSession } from './types';

// ─── Mock User Catalogue ──────────────────────────────────────────────────────

const MOCK_USERS: Array<UserSession & { password: string }> = [
  {
    id: 'u-kerani-01',
    username: 'kerani',
    displayName: 'Kerani Operator',
    role: 'kerani',
    email: 'kerani@company.local',
    sessionCreatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    password: 'kerani123',
  },
  {
    id: 'u-hr-01',
    username: 'hr',
    displayName: 'HR Officer',
    role: 'hr',
    email: 'hr@company.local',
    sessionCreatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    password: 'hr123',
  },
  {
    id: 'u-payroll-01',
    username: 'payroll',
    displayName: 'Payroll Officer',
    role: 'payroll',
    email: 'payroll@company.local',
    sessionCreatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    password: 'payroll123',
  },
  {
    id: 'u-manager-01',
    username: 'manager',
    displayName: 'Department Manager',
    role: 'manager',
    email: 'manager@company.local',
    sessionCreatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    password: 'manager123',
  },
  {
    id: 'u-admin-01',
    username: 'admin',
    displayName: 'System Administrator',
    role: 'admin',
    email: 'admin@company.local',
    sessionCreatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    password: 'admin123',
  },
];

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

AuthContext.displayName = 'AuthContext';

// ─── Provider ────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
  /** Use an existing session instead of re-authenticating on mount. */
  initialSession?: UserSession | null;
}

export function AuthProvider({
  children,
  initialSession,
}: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<UserSession | null>(initialSession ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Restore session from localStorage on mount (development shortcut)
  useEffect(() => {
    if (initialSession !== undefined) return;
    try {
      const stored = localStorage.getItem('dbq_session');
      if (stored) {
        const parsed: UserSession = JSON.parse(stored);
        // Basic expiry check
        if (new Date(parsed.expiresAt) > new Date()) {
          setUser(parsed);
        } else {
          localStorage.removeItem('dbq_session');
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }, [initialSession]);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      setIsLoading(true);
      // Simulate network latency
      await new Promise<void>((resolve) => setTimeout(resolve, 400));

      const match = MOCK_USERS.find(
        (u) => u.username === username && u.password === password,
      );

      if (!match) {
        setIsLoading(false);
        throw new Error('Invalid username or password');
      }

      const { password: _omitted, ...session } = match;
      // Refresh timestamps on each login
      const refreshed: UserSession = {
        ...session,
        sessionCreatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      };

      localStorage.setItem('dbq_session', JSON.stringify(refreshed));
      setUser(refreshed);
      setIsLoading(false);
    },
    [],
  );

  const logout = useCallback((): void => {
    localStorage.removeItem('dbq_session');
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Consumer Hook ───────────────────────────────────────────────────────────

/**
 * Returns the current AuthContext value.
 * Throws if used outside <AuthProvider>.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return ctx;
}

/** Expose mock users for development / demo UI (e.g. role switcher). */
export const MOCK_USER_LIST: Omit<UserSession & { password: string }, 'password'>[] =
  MOCK_USERS.map(({ password: _omit, ...rest }) => rest);