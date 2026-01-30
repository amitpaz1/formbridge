/**
 * StatusBadge — Renders a colored badge based on submission state.
 */

import { createElement } from "react";

export type BadgeVariant =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "pending"
  | "succeeded"
  | "failed";

const BADGE_COLORS: Record<BadgeVariant, string> = {
  draft: "#6b7280",
  submitted: "#3b82f6",
  approved: "#10b981",
  rejected: "#ef4444",
  pending: "#f59e0b",
  succeeded: "#10b981",
  failed: "#ef4444",
};

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = status.toLowerCase() as BadgeVariant;
  const color = BADGE_COLORS[variant] ?? "#6b7280";

  return createElement(
    "span",
    {
      className: `fb-badge fb-badge--${variant} ${className ?? ""}`.trim(),
      style: {
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 600,
        color: "#fff",
        backgroundColor: color,
      },
    },
    status
  );
}
