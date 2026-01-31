/**
 * ApprovalActions component - Displays action buttons for reviewing submissions
 * Provides approve, reject, and request changes actions for approval workflows
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Actor } from '../types';

/**
 * Field-level comment for request_changes action
 */
export interface FieldComment {
  fieldPath: string;
  comment: string;
  suggestedValue?: unknown;
}

/**
 * Props for ApprovalActions component
 */
export interface ApprovalActionsProps {
  /** Submission ID being reviewed */
  submissionId: string;
  /** Resume token for the submission */
  resumeToken: string;
  /** Current reviewer actor */
  reviewer: Actor;
  /** Callback when approve button is clicked */
  onApprove?: (data: { submissionId: string; resumeToken: string; actor: Actor; comment?: string }) => void | Promise<void>;
  /** Callback when reject button is clicked */
  onReject?: (data: { submissionId: string; resumeToken: string; actor: Actor; reason: string; comment?: string }) => void | Promise<void>;
  /** Callback when request changes button is clicked */
  onRequestChanges?: (data: { submissionId: string; resumeToken: string; actor: Actor; fieldComments: FieldComment[]; comment?: string }) => void | Promise<void>;
  /** Whether actions are currently loading/processing */
  loading?: boolean;
  /** Whether actions are disabled */
  disabled?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Layout variant */
  layout?: 'horizontal' | 'vertical';
  /** Size variant of the buttons */
  size?: 'small' | 'medium' | 'large';
}

/**
 * ApprovalActions - Component that displays action buttons for reviewing submissions
 *
 * This component provides a consistent UI for reviewers to approve, reject, or
 * request changes on submissions in approval workflows. Used in conjunction with
 * ReviewerView to provide the approval gate functionality.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ApprovalActions
 *   submissionId="sub_123"
 *   resumeToken="rtok_456"
 *   reviewer={{ kind: "human", id: "reviewer_1", name: "Jane Doe" }}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 *   onRequestChanges={handleRequestChanges}
 * />
 *
 * // With loading state
 * <ApprovalActions
 *   submissionId="sub_123"
 *   resumeToken="rtok_456"
 *   reviewer={{ kind: "human", id: "reviewer_1" }}
 *   onApprove={handleApprove}
 *   loading={isProcessing}
 * />
 *
 * // Vertical layout
 * <ApprovalActions
 *   submissionId="sub_123"
 *   resumeToken="rtok_456"
 *   reviewer={{ kind: "human", id: "reviewer_1" }}
 *   onApprove={handleApprove}
 *   layout="vertical"
 * />
 * ```
 */
export const ApprovalActions: React.FC<ApprovalActionsProps> = ({
  submissionId,
  resumeToken,
  reviewer,
  onApprove,
  onReject,
  onRequestChanges,
  loading = false,
  disabled = false,
  className = '',
  layout = 'horizontal',
  size = 'medium',
}) => {
  // Dialog state
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'request-changes' | null>(null);
  const [dialogText, setDialogText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when dialog opens
  useEffect(() => {
    if (dialog && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [dialog]);

  // Close dialog on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDialog(null);
      setDialogText('');
    }
  }, []);

  // Handle approve action — shows confirmation dialog
  const handleApprove = () => {
    setDialog('approve');
    setDialogText('');
  };

  const confirmApprove = async () => {
    setDialog(null);
    if (onApprove) {
      await onApprove({
        submissionId,
        resumeToken,
        actor: reviewer,
        comment: dialogText || undefined,
      });
    }
    setDialogText('');
  };

  // Handle reject action — shows dialog with reason textarea
  const handleReject = () => {
    setDialog('reject');
    setDialogText('');
  };

  const confirmReject = async () => {
    if (!dialogText.trim()) return;
    setDialog(null);
    if (onReject) {
      await onReject({
        submissionId,
        resumeToken,
        actor: reviewer,
        reason: dialogText.trim(),
      });
    }
    setDialogText('');
  };

  // Handle request changes action — shows dialog with feedback textarea
  const handleRequestChanges = () => {
    setDialog('request-changes');
    setDialogText('');
  };

  const confirmRequestChanges = async () => {
    if (!dialogText.trim()) return;
    setDialog(null);
    if (onRequestChanges) {
      await onRequestChanges({
        submissionId,
        resumeToken,
        actor: reviewer,
        fieldComments: [],
        comment: dialogText.trim(),
      });
    }
    setDialogText('');
  };

  const closeDialog = () => {
    setDialog(null);
    setDialogText('');
  };

  // Build CSS class list
  const cssClasses = [
    'formbridge-approval-actions',
    `formbridge-approval-actions--${layout}`,
    `formbridge-approval-actions--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const isDisabled = disabled || loading;

  return (
    <div
      className={cssClasses}
      data-submission-id={submissionId}
      data-reviewer-id={reviewer.id}
      role="group"
      aria-label="Approval actions"
    >
      {/* Approve Button */}
      <button
        type="button"
        onClick={handleApprove}
        disabled={isDisabled}
        className="formbridge-approval-actions__button formbridge-approval-actions__button--approve"
        data-action="approve"
        aria-label="Approve submission"
      >
        {loading ? 'Processing...' : 'Approve'}
      </button>

      {/* Reject Button */}
      <button
        type="button"
        onClick={handleReject}
        disabled={isDisabled}
        className="formbridge-approval-actions__button formbridge-approval-actions__button--reject"
        data-action="reject"
        aria-label="Reject submission"
      >
        {loading ? 'Processing...' : 'Reject'}
      </button>

      {/* Request Changes Button */}
      <button
        type="button"
        onClick={handleRequestChanges}
        disabled={isDisabled}
        className="formbridge-approval-actions__button formbridge-approval-actions__button--request-changes"
        data-action="request_changes"
        aria-label="Request changes to submission"
      >
        {loading ? 'Processing...' : 'Request Changes'}
      </button>

      {/* Confirmation/Input Dialog */}
      {dialog && (
        <div
          className="formbridge-dialog-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
          onKeyDown={handleKeyDown}
          role="presentation"
        >
          <div
            className="formbridge-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog === 'approve' ? 'Confirm approval' :
              dialog === 'reject' ? 'Provide rejection reason' :
              'Provide feedback for changes'
            }
          >
            <h3 className="formbridge-dialog__title">
              {dialog === 'approve' && 'Confirm Approval'}
              {dialog === 'reject' && 'Reject Submission'}
              {dialog === 'request-changes' && 'Request Changes'}
            </h3>

            {dialog === 'approve' && (
              <p className="formbridge-dialog__text">
                Are you sure you want to approve this submission?
              </p>
            )}

            {(dialog === 'reject' || dialog === 'request-changes') && (
              <textarea
                ref={textareaRef}
                className="formbridge-dialog__textarea"
                value={dialogText}
                onChange={(e) => setDialogText(e.target.value)}
                placeholder={
                  dialog === 'reject'
                    ? 'Please provide a reason for rejection (required)...'
                    : 'Please provide feedback for the changes needed (required)...'
                }
                rows={4}
                aria-label={dialog === 'reject' ? 'Rejection reason' : 'Change feedback'}
                required
              />
            )}

            {dialog === 'approve' && (
              <textarea
                ref={textareaRef}
                className="formbridge-dialog__textarea"
                value={dialogText}
                onChange={(e) => setDialogText(e.target.value)}
                placeholder="Optional comment..."
                rows={2}
                aria-label="Approval comment"
              />
            )}

            <div className="formbridge-dialog__actions">
              <button
                type="button"
                className="formbridge-dialog__btn formbridge-dialog__btn--cancel"
                onClick={closeDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`formbridge-dialog__btn formbridge-dialog__btn--confirm formbridge-dialog__btn--${dialog}`}
                onClick={
                  dialog === 'approve' ? confirmApprove :
                  dialog === 'reject' ? confirmReject :
                  confirmRequestChanges
                }
                disabled={
                  (dialog === 'reject' || dialog === 'request-changes') && !dialogText.trim()
                }
              >
                {dialog === 'approve' ? 'Approve' : dialog === 'reject' ? 'Reject' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ApprovalActions.displayName = 'ApprovalActions';
