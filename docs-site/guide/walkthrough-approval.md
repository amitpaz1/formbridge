# Walkthrough: Approval Workflow

This walkthrough demonstrates the approval gate feature.

## Configure Approval Gates

Add approval gates to your intake definition to require human review.

## Submit for Review

When a submission with approval gates is submitted, it transitions to `needs_review`.

## Review Actions

Reviewers can:
- **Approve** — moves to `approved` then `submitted`
- **Reject** — moves to `rejected` (terminal)
- **Request Changes** — moves back to `draft` with field-level comments
