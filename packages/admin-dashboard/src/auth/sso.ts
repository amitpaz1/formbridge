/**
 * SSO Authentication Module for Admin Dashboard
 *
 * Supports OIDC-based SSO login and API key fallback.
 * Session is managed via httpOnly cookies set by the server.
 */

import { createElement, useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// =============================================================================
// § Types
// =============================================================================

export type UserRole = 'admin' | 'reviewer' | 'viewer';

export interface AuthUser {
  userId: string;
  email?: string;
  role: UserRole;
  tenantId?: string;
  authMethod: 'sso' | 'api-key';
}

export interface AuthState {
  /** Whether auth check is in progress */
  loading: boolean;
  /** Authenticated user, or null */
  user: AuthUser | null;
  /** Whether auth is enabled on the server */
  authEnabled: boolean;
  /** Login via OIDC SSO redirect */
  loginWithSSO: () => void;
  /** Login via API key */
  loginWithApiKey: (apiKey: string) => Promise<void>;
  /** Logout */
  logout: () => Promise<void>;
  /** Check if user has a specific role level */
  hasRole: (minimumRole: UserRole) => boolean;
}

// =============================================================================
// § Role Hierarchy
// =============================================================================

const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  reviewer: 1,
  admin: 2,
};

function roleAtLeast(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minimumRole];
}

// =============================================================================
// § Auth Context
// =============================================================================

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// =============================================================================
// § Auth Provider
// =============================================================================

export interface AuthProviderProps {
  children: ReactNode;
  /** Base URL of the FormBridge API */
  baseUrl?: string;
}

export function AuthProvider({ children, baseUrl = '' }: AuthProviderProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authEnabled, setAuthEnabled] = useState(true);

  // Check current session on mount
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/auth/session`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        setAuthEnabled(data.authEnabled !== false);
      } else if (res.status === 401) {
        setUser(null);
      }
    } catch {
      // Server unreachable — assume auth disabled for dev
      setAuthEnabled(false);
      setUser({ userId: 'dev', role: 'admin', authMethod: 'api-key' });
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => { checkSession(); }, [checkSession]);

  // Auto-refresh: intercept 401s globally
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401 && user) {
        // Try to refresh session
        const refreshRes = await originalFetch(`${baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (refreshRes.ok) {
          // Retry original request
          return originalFetch(...args);
        } else {
          // Session expired — logout
          setUser(null);
        }
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
  }, [baseUrl, user]);

  const loginWithSSO = useCallback(() => {
    // Redirect to OIDC authorization endpoint
    window.location.href = `${baseUrl}/auth/sso/login?redirect=${encodeURIComponent(window.location.href)}`;
  }, [baseUrl]);

  const loginWithApiKey = useCallback(async (apiKey: string) => {
    const res = await fetch(`${baseUrl}/auth/api-key-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: { message: 'Login failed' } }));
      throw new Error(body.error?.message || 'Login failed');
    }
    const data = await res.json();
    setUser(data.user);
  }, [baseUrl]);

  const logout = useCallback(async () => {
    await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setUser(null);
  }, [baseUrl]);

  const hasRole = useCallback(
    (minimumRole: UserRole) => user ? roleAtLeast(user.role, minimumRole) : false,
    [user]
  );

  const state: AuthState = { loading, user, authEnabled, loginWithSSO, loginWithApiKey, logout, hasRole };

  return createElement(AuthContext.Provider, { value: state }, children);
}
