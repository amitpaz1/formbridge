/**
 * RoleGate — Conditionally renders children based on user role.
 *
 * - Admin sees everything
 * - Reviewer sees read-only views (approve/reject actions hidden)
 * - Viewer sees read-only views
 */

import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useAuth, type UserRole } from './sso.js';

export interface RoleGateProps {
  /** Minimum role required to see children */
  minimumRole: UserRole;
  /** Content to show when user has sufficient role */
  children: ReactNode;
  /** Optional fallback when user lacks the role (defaults to null) */
  fallback?: ReactNode;
}

/**
 * Render children only if the current user has at least `minimumRole`.
 *
 * @example
 * ```tsx
 * <RoleGate minimumRole="admin">
 *   <DeleteButton />
 * </RoleGate>
 * ```
 */
export function RoleGate({ minimumRole, children, fallback = null }: RoleGateProps) {
  const { hasRole } = useAuth();

  if (hasRole(minimumRole)) {
    return createElement('div', null, children);
  }

  return fallback ? createElement('div', null, fallback) : null;
}

/**
 * Hook to check if the current view should be read-only.
 * Returns true for viewers and reviewers on write operations.
 */
export function useReadOnly(): boolean {
  const { user } = useAuth();
  return user?.role !== 'admin';
}
