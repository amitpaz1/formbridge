/**
 * DashboardPage — Overview analytics with key metrics and recent activity.
 */

import { createElement } from "react";
import type { AnalyticsSummary } from "../api/client.js";
import { StatusBadge } from "../components/StatusBadge.js";

export interface DashboardPageProps {
  summary: AnalyticsSummary | null;
  loading: boolean;
  error?: string;
}

export function DashboardPage({ summary, loading, error }: DashboardPageProps) {
  if (loading) {
    return createElement("div", { className: "fb-page fb-page--loading" }, "Loading dashboard...");
  }

  if (error) {
    return createElement("div", { className: "fb-page fb-page--error" }, `Error: ${error}`);
  }

  if (!summary) {
    return createElement("div", { className: "fb-page" }, "No data available.");
  }

  return createElement(
    "div",
    { className: "fb-page fb-dashboard" },
    createElement("h1", { className: "fb-page__title" }, "Dashboard"),
    // Metric cards
    createElement(
      "div",
      { className: "fb-dashboard__metrics" },
      metricCard("Total Intakes", String(summary.totalIntakes)),
      metricCard("Total Submissions", String(summary.totalSubmissions)),
      metricCard("Pending Approvals", String(summary.pendingApprovals))
    ),
    // Submissions by state
    createElement(
      "div",
      { className: "fb-dashboard__states" },
      createElement("h2", null, "Submissions by State"),
      createElement(
        "div",
        { className: "fb-dashboard__state-list" },
        Object.entries(summary.submissionsByState).map(([state, count]) =>
          createElement(
            "div",
            { key: state, className: "fb-dashboard__state-item" },
            createElement(StatusBadge, { status: state }),
            createElement("span", { className: "fb-dashboard__state-count" }, String(count))
          )
        )
      )
    ),
    // Recent activity
    createElement(
      "div",
      { className: "fb-dashboard__activity" },
      createElement("h2", null, "Recent Activity"),
      summary.recentActivity.length === 0
        ? createElement("p", null, "No recent activity.")
        : createElement(
            "ul",
            { className: "fb-dashboard__activity-list" },
            summary.recentActivity.slice(0, 10).map((event) =>
              createElement(
                "li",
                { key: event.eventId, className: "fb-dashboard__activity-item" },
                `${event.type} — ${event.submissionId} (${new Date(event.ts).toLocaleString()})`
              )
            )
          )
    )
  );
}

function metricCard(label: string, value: string) {
  return createElement(
    "div",
    { className: "fb-metric-card" },
    createElement("div", { className: "fb-metric-card__value" }, value),
    createElement("div", { className: "fb-metric-card__label" }, label)
  );
}
