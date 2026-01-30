/**
 * SubmissionDetailPage — Detailed view of a single submission.
 */

import { createElement } from "react";
import type { SubmissionDetail } from "../api/client.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { EventTimeline } from "../components/EventTimeline.js";

export interface SubmissionDetailPageProps {
  submission: SubmissionDetail | null;
  loading: boolean;
  error?: string;
  onApprove?: () => void;
  onReject?: () => void;
  onBack: () => void;
}

export function SubmissionDetailPage({
  submission,
  loading,
  error,
  onApprove,
  onReject,
  onBack,
}: SubmissionDetailPageProps) {
  if (loading) {
    return createElement("div", { className: "fb-page fb-page--loading" }, "Loading submission...");
  }

  if (error) {
    return createElement("div", { className: "fb-page fb-page--error" }, `Error: ${error}`);
  }

  if (!submission) {
    return createElement("div", { className: "fb-page" }, "Submission not found.");
  }

  return createElement(
    "div",
    { className: "fb-page fb-submission-detail" },
    createElement(
      "div",
      { className: "fb-submission-detail__header" },
      createElement(
        "button",
        { onClick: onBack, className: "fb-btn fb-btn--back" },
        "Back"
      ),
      createElement("h1", { className: "fb-page__title" }, `Submission ${submission.id}`),
      createElement(StatusBadge, { status: submission.state })
    ),
    // Metadata
    createElement(
      "div",
      { className: "fb-submission-detail__meta" },
      createElement("p", null, `Intake: ${submission.intakeId}`),
      createElement("p", null, `Created: ${new Date(submission.createdAt).toLocaleString()}`),
      createElement("p", null, `Updated: ${new Date(submission.updatedAt).toLocaleString()}`)
    ),
    // Fields
    createElement(
      "div",
      { className: "fb-submission-detail__fields" },
      createElement("h2", null, "Fields"),
      createElement(
        "dl",
        { className: "fb-field-list" },
        Object.entries(submission.fields).flatMap(([key, value]) => [
          createElement("dt", { key: `${key}-dt` }, key),
          createElement("dd", { key: `${key}-dd` }, String(value ?? "")),
        ])
      )
    ),
    // Actions
    (onApprove || onReject) &&
      createElement(
        "div",
        { className: "fb-submission-detail__actions" },
        onApprove &&
          createElement(
            "button",
            { onClick: onApprove, className: "fb-btn fb-btn--approve" },
            "Approve"
          ),
        onReject &&
          createElement(
            "button",
            { onClick: onReject, className: "fb-btn fb-btn--reject" },
            "Reject"
          )
      ),
    // Event timeline
    createElement(
      "div",
      { className: "fb-submission-detail__timeline" },
      createElement("h2", null, "Event Timeline"),
      createElement(EventTimeline, { events: submission.events })
    ),
    // Deliveries
    submission.deliveries.length > 0 &&
      createElement(
        "div",
        { className: "fb-submission-detail__deliveries" },
        createElement("h2", null, "Webhook Deliveries"),
        createElement(
          "ul",
          null,
          submission.deliveries.map((d) =>
            createElement(
              "li",
              { key: d.deliveryId },
              `${d.destinationUrl} — ${d.status} (${d.attempts} attempts)`
            )
          )
        )
      )
  );
}
