/**
 * AnalyticsDashboardPage — Submission volume analytics and charts.
 */

import { createElement } from "react";
import type { AnalyticsSummary, VolumeDataPoint } from "../api/client.js";

export interface AnalyticsDashboardPageProps {
  summary: AnalyticsSummary | null;
  volumeData: VolumeDataPoint[];
  loading: boolean;
  error?: string;
}

export function AnalyticsDashboardPage({
  summary,
  volumeData,
  loading,
  error,
}: AnalyticsDashboardPageProps) {
  if (loading) {
    return createElement("div", { className: "fb-page fb-page--loading" }, "Loading analytics...");
  }

  if (error) {
    return createElement("div", { className: "fb-page fb-page--error" }, `Error: ${error}`);
  }

  return createElement(
    "div",
    { className: "fb-page fb-analytics" },
    createElement("h1", { className: "fb-page__title" }, "Analytics"),
    // Summary metrics
    summary &&
      createElement(
        "div",
        { className: "fb-analytics__summary" },
        createElement(
          "div",
          { className: "fb-analytics__metric" },
          createElement("span", { className: "fb-analytics__metric-value" }, String(summary.totalSubmissions)),
          createElement("span", { className: "fb-analytics__metric-label" }, "Total Submissions")
        ),
        createElement(
          "div",
          { className: "fb-analytics__metric" },
          createElement("span", { className: "fb-analytics__metric-value" }, String(summary.pendingApprovals)),
          createElement("span", { className: "fb-analytics__metric-label" }, "Pending Approvals")
        )
      ),
    // Volume chart (text-based for now — replace with Recharts)
    createElement(
      "div",
      { className: "fb-analytics__volume" },
      createElement("h2", null, "Submission Volume"),
      volumeData.length === 0
        ? createElement("p", null, "No volume data available.")
        : createElement(
            "div",
            { className: "fb-analytics__chart", role: "img", "aria-label": "Volume chart" },
            createElement(
              "table",
              { className: "fb-analytics__volume-table" },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  null,
                  createElement("th", null, "Date"),
                  createElement("th", null, "Count"),
                  createElement("th", null, "")
                )
              ),
              createElement(
                "tbody",
                null,
                volumeData.map((dp) => {
                  const maxCount = Math.max(...volumeData.map((d) => d.count), 1);
                  const pct = Math.round((dp.count / maxCount) * 100);
                  return createElement(
                    "tr",
                    { key: dp.date },
                    createElement("td", null, dp.date),
                    createElement("td", null, String(dp.count)),
                    createElement(
                      "td",
                      null,
                      createElement("div", {
                        className: "fb-analytics__bar",
                        style: {
                          width: `${pct}%`,
                          height: "16px",
                          backgroundColor: "#3b82f6",
                          borderRadius: "2px",
                        },
                      })
                    )
                  );
                })
              )
            )
          )
    )
  );
}
