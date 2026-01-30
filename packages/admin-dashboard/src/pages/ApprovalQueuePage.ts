/**
 * ApprovalQueuePage — Lists submissions pending approval.
 */

import { createElement } from "react";
import type { ApprovalRecord } from "../api/client.js";
import { DataTable, type ColumnDef } from "../components/DataTable.js";
import { StatusBadge } from "../components/StatusBadge.js";

export interface ApprovalQueuePageProps {
  approvals: ApprovalRecord[];
  loading: boolean;
  error?: string;
  onSelectSubmission: (intakeId: string, submissionId: string) => void;
}

const columns: ColumnDef<ApprovalRecord>[] = [
  { id: "submissionId", header: "Submission ID", accessor: (r) => r.submissionId },
  { id: "intakeId", header: "Intake", accessor: (r) => r.intakeId },
  {
    id: "state",
    header: "State",
    accessor: (r) => r.state,
    render: (value) => createElement(StatusBadge, { status: String(value) }),
  },
  { id: "createdAt", header: "Created", accessor: (r) => new Date(r.createdAt).toLocaleString() },
];

export function ApprovalQueuePage({
  approvals,
  loading,
  error,
  onSelectSubmission,
}: ApprovalQueuePageProps) {
  if (loading) {
    return createElement("div", { className: "fb-page fb-page--loading" }, "Loading approvals...");
  }

  if (error) {
    return createElement("div", { className: "fb-page fb-page--error" }, `Error: ${error}`);
  }

  return createElement(
    "div",
    { className: "fb-page" },
    createElement("h1", { className: "fb-page__title" }, "Approval Queue"),
    createElement(
      "p",
      { className: "fb-page__subtitle" },
      `${approvals.length} submission(s) pending review`
    ),
    createElement(DataTable, {
      data: approvals,
      columns,
      keyAccessor: (r: ApprovalRecord) => r.submissionId,
      onRowClick: (r: ApprovalRecord) => onSelectSubmission(r.intakeId, r.submissionId),
      emptyMessage: "No submissions pending approval.",
    })
  );
}
