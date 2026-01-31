/**
 * SubmissionDetailPage — Detailed view of a single submission.
 */

import { createElement, useState } from "react";
import type { SubmissionDetail } from "../api/client.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { EventTimeline } from "../components/EventTimeline.js";

export interface SubmissionDetailPageProps {
  submission: SubmissionDetail | null;
  loading: boolean;
  error?: string;
  onApprove?: (comment?: string) => void;
  onReject?: (reason: string) => void;
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
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [dialogText, setDialogText] = useState('');

  if (loading) {
    return createElement("div", { className: "fb-page fb-page--loading" }, "Loading submission...");
  }

  if (error) {
    return createElement("div", { className: "fb-page fb-page--error" }, `Error: ${error}`);
  }

  if (!submission) {
    return createElement("div", { className: "fb-page" }, "Submission not found.");
  }

  const closeDialog = () => { setDialog(null); setDialogText(''); };

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
            { onClick: () => setDialog('approve'), className: "fb-btn fb-btn--approve" },
            "Approve"
          ),
        onReject &&
          createElement(
            "button",
            { onClick: () => setDialog('reject'), className: "fb-btn fb-btn--reject" },
            "Reject"
          )
      ),
    // Confirmation dialog
    dialog &&
      createElement(
        "div",
        {
          className: "fb-dialog-overlay",
          onClick: (e: { target: unknown; currentTarget: unknown }) => { if (e.target === e.currentTarget) closeDialog(); },
        },
        createElement(
          "div",
          { className: "fb-dialog", role: "dialog", "aria-modal": "true" },
          createElement("h3", { className: "fb-dialog__title" },
            dialog === 'approve' ? 'Confirm Approval' : 'Reject Submission'
          ),
          dialog === 'approve' &&
            createElement("p", null, "Are you sure you want to approve this submission?"),
          createElement("textarea", {
            className: "fb-dialog__textarea",
            value: dialogText,
            onChange: (e: { target: { value: string } }) => setDialogText(e.target.value),
            placeholder: dialog === 'reject'
              ? 'Please provide a reason for rejection (required)...'
              : 'Optional comment...',
            rows: dialog === 'reject' ? 4 : 2,
            "aria-label": dialog === 'reject' ? 'Rejection reason' : 'Approval comment',
          }),
          createElement(
            "div",
            { className: "fb-dialog__actions" },
            createElement("button", {
              onClick: closeDialog,
              className: "fb-btn fb-btn--cancel",
            }, "Cancel"),
            createElement("button", {
              onClick: () => {
                if (dialog === 'approve') {
                  onApprove?.(dialogText || undefined);
                } else if (dialogText.trim()) {
                  onReject?.(dialogText.trim());
                }
                closeDialog();
              },
              className: `fb-btn fb-btn--${dialog}`,
              disabled: dialog === 'reject' && !dialogText.trim(),
            }, dialog === 'approve' ? 'Approve' : 'Reject')
          )
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
