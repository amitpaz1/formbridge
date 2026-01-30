/**
 * WebhookMonitorPage — Monitors webhook deliveries and retry status.
 */

import { createElement } from "react";
import type { DeliveryRecord } from "../api/client.js";
import { DataTable, type ColumnDef } from "../components/DataTable.js";
import { StatusBadge } from "../components/StatusBadge.js";

export interface WebhookMonitorPageProps {
  deliveries: DeliveryRecord[];
  loading: boolean;
  error?: string;
  onRetry: (deliveryId: string) => void;
}

export function WebhookMonitorPage({
  deliveries,
  loading,
  error,
  onRetry,
}: WebhookMonitorPageProps) {
  if (loading) {
    return createElement("div", { className: "fb-page fb-page--loading" }, "Loading deliveries...");
  }

  if (error) {
    return createElement("div", { className: "fb-page fb-page--error" }, `Error: ${error}`);
  }

  const columns: ColumnDef<DeliveryRecord>[] = [
    { id: "deliveryId", header: "ID", accessor: (r) => r.deliveryId },
    { id: "submissionId", header: "Submission", accessor: (r) => r.submissionId },
    { id: "url", header: "Destination", accessor: (r) => r.destinationUrl },
    {
      id: "status",
      header: "Status",
      accessor: (r) => r.status,
      render: (value) => createElement(StatusBadge, { status: String(value) }),
    },
    { id: "attempts", header: "Attempts", accessor: (r) => r.attempts },
    {
      id: "actions",
      header: "Actions",
      accessor: () => null,
      render: (_value, row) =>
        row.status === "failed"
          ? createElement(
              "button",
              {
                className: "fb-btn fb-btn--retry",
                onClick: (e: Event) => {
                  e.stopPropagation();
                  onRetry(row.deliveryId);
                },
              },
              "Retry"
            )
          : null,
    },
  ];

  return createElement(
    "div",
    { className: "fb-page" },
    createElement("h1", { className: "fb-page__title" }, "Webhook Monitor"),
    createElement(DataTable, {
      data: deliveries,
      columns,
      keyAccessor: (r: DeliveryRecord) => r.deliveryId,
      emptyMessage: "No deliveries found.",
    })
  );
}
