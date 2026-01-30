/**
 * IntakeListPage — Lists all registered intakes.
 */

import { createElement } from "react";
import type { IntakeSummary } from "../api/client.js";
import { DataTable, type ColumnDef } from "../components/DataTable.js";

export interface IntakeListPageProps {
  intakes: IntakeSummary[];
  loading: boolean;
  error?: string;
  onSelectIntake: (intakeId: string) => void;
}

const columns: ColumnDef<IntakeSummary>[] = [
  { id: "intakeId", header: "Intake ID", accessor: (r) => r.intakeId },
  { id: "name", header: "Name", accessor: (r) => r.name },
  { id: "version", header: "Version", accessor: (r) => r.version },
  { id: "submissions", header: "Submissions", accessor: (r) => r.submissionCount },
  { id: "pending", header: "Pending Approvals", accessor: (r) => r.pendingApprovals },
];

export function IntakeListPage({
  intakes,
  loading,
  error,
  onSelectIntake,
}: IntakeListPageProps) {
  if (loading) {
    return createElement("div", { className: "fb-page fb-page--loading" }, "Loading intakes...");
  }

  if (error) {
    return createElement("div", { className: "fb-page fb-page--error" }, `Error: ${error}`);
  }

  return createElement(
    "div",
    { className: "fb-page" },
    createElement("h1", { className: "fb-page__title" }, "Intakes"),
    createElement(DataTable, {
      data: intakes,
      columns,
      keyAccessor: (r: IntakeSummary) => r.intakeId,
      onRowClick: (r: IntakeSummary) => onSelectIntake(r.intakeId),
      emptyMessage: "No intakes registered.",
    })
  );
}
