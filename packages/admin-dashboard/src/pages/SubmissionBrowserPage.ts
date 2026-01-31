/**
 * SubmissionBrowserPage — Browse submissions with filtering and pagination.
 */

import { createElement } from "react";
import type { SubmissionSummary } from "../api/client.js";
import { DataTable, type ColumnDef } from "../components/DataTable.js";
import { StatusBadge } from "../components/StatusBadge.js";

export interface SubmissionBrowserPageProps {
  submissions: SubmissionSummary[];
  loading: boolean;
  error?: string;
  total: number;
  page: number;
  pageSize: number;
  stateFilter: string;
  onPageChange: (page: number) => void;
  onStateFilterChange: (state: string) => void;
  onSelectSubmission: (submissionId: string) => void;
}

const columns: ColumnDef<SubmissionSummary>[] = [
  { id: "id", header: "ID", accessor: (r) => r.id },
  { id: "intakeId", header: "Intake", accessor: (r) => r.intakeId },
  {
    id: "state",
    header: "State",
    accessor: (r) => r.state,
    render: (value) => createElement(StatusBadge, { status: String(value) }),
  },
  { id: "createdAt", header: "Created", accessor: (r) => new Date(r.createdAt).toLocaleString() },
  { id: "updatedAt", header: "Updated", accessor: (r) => new Date(r.updatedAt).toLocaleString() },
];

const STATE_OPTIONS = ["all", "draft", "submitted", "approved", "rejected"];

export function SubmissionBrowserPage({
  submissions,
  loading,
  error,
  total,
  page,
  pageSize,
  stateFilter,
  onPageChange,
  onStateFilterChange,
  onSelectSubmission,
}: SubmissionBrowserPageProps) {
  if (error) {
    return createElement("div", { className: "fb-page fb-page--error" }, `Error: ${error}`);
  }

  return createElement(
    "div",
    { className: "fb-page" },
    createElement("h1", { className: "fb-page__title" }, "Submissions"),
    // Filter bar
    createElement(
      "div",
      { className: "fb-filter-bar" },
      createElement("label", { htmlFor: "state-filter" }, "State: "),
      createElement(
        "select",
        {
          id: "state-filter",
          value: stateFilter,
          onChange: (e: Event) =>
            onStateFilterChange((e.target as HTMLSelectElement).value),
        },
        STATE_OPTIONS.map((opt) =>
          createElement("option", { key: opt, value: opt }, opt)
        )
      )
    ),
    // Table
    loading
      ? createElement("div", { className: "fb-page--loading" }, "Loading submissions...")
      : createElement(DataTable<SubmissionSummary>, {
          data: submissions,
          columns,
          keyAccessor: (r: SubmissionSummary) => r.id,
          onRowClick: (r: SubmissionSummary) => onSelectSubmission(r.id),
          page,
          pageSize,
          total,
          onPageChange,
          emptyMessage: "No submissions found.",
        })
  );
}
