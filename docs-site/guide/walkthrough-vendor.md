# Walkthrough: Vendor Onboarding

This walkthrough demonstrates a complete vendor onboarding flow.

## Define the Intake

```typescript
const vendorIntake = {
  id: 'vendor-onboarding',
  version: '1.0.0',
  name: 'Vendor Onboarding',
  schema: {
    type: 'object',
    properties: {
      companyName: { type: 'string' },
      taxId: { type: 'string', pattern: '^\\d{2}-\\d{7}$' },
      contactEmail: { type: 'string', format: 'email' },
      w9Document: { type: 'string', format: 'binary' },
    },
    required: ['companyName', 'taxId', 'contactEmail'],
  },
  approvalGates: [{ name: 'finance-review', reviewers: ['finance-team'] }],
  destination: { kind: 'webhook', url: 'https://api.example.com/vendors' },
};
```

## Agent Creates Submission

The AI agent collects initial data and creates a submission.

## Human Completes Sensitive Fields

The agent hands off to a human for tax ID verification.

## Review and Approval

A finance reviewer approves the submission, and it is delivered to the webhook.
