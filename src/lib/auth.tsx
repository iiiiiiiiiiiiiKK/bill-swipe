import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiRequestError } from './api';
import type { MeProfile } from '@shared/types';

interface AuthState {
  user: MeProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<MeProfile>;
  register: (input: {
    email: string;
    password: string;
    username: string;
    displayName?: string;
    country?: string;
    region?: string;
  }) => Promise<MeProfile>;
  logout: () => Promise<void>;
  setUser: (user: MeProfile | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: MeProfile | null }>('/auth/session');
      if (mounted.current) setUser(res.user);
    } catch {
      if (mounted.current) setUser(null);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh().finally(() => {
      if (mounted.current) setLoading(false);
    });
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: MeProfile }>('/auth/login', { email, password });
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; username: string; displayName?: string; country?: string; region?: string }) => {
      const res = await api.post<{ user: MeProfile }>('/auth/register', input);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, login, register, logout, setUser }),
    [user, loading, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
