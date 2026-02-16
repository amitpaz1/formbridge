/**
 * Navigation item definitions for the admin dashboard.
 *
 * Extracted to avoid React dependency for testing.
 */

export type MinRole = 'admin' | 'reviewer' | 'viewer';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  /** Minimum role required to see this nav item (default: 'viewer') */
  minRole?: MinRole;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: "grid" },
  { id: "intakes", label: "Intakes", path: "/intakes", icon: "inbox" },
  { id: "submissions", label: "Submissions", path: "/submissions", icon: "file-text" },
  { id: "approvals", label: "Approvals", path: "/approvals", icon: "check-circle" },
  { id: "webhooks", label: "Webhooks", path: "/webhooks", icon: "globe" },
  { id: "analytics", label: "Analytics", path: "/analytics", icon: "bar-chart" },
];
