# Demo Scenarios

Real-world intake scenarios showcasing FormBridge's mixed-mode agent-human handoff.

Each scenario includes:
- **JSON Schema** defining the form structure
- **Agent pre-fill data** — what a typical AI agent would fill automatically
- **Human-required fields** — what needs a human (files, signatures, subjective input)
- **Scenario narrative** — the story behind the handoff

## Scenarios

| # | Scenario | Complexity | Key Features |
|---|----------|-----------|--------------|
| 1 | [Insurance Claim](#1-insurance-claim) | High | File uploads, conditional fields, multi-step, approval gates |
| 2 | [Startup Incorporation](#2-startup-incorporation) | High | Legal docs, multi-party, nested objects, regulatory validation |
| 3 | [Clinical Trial Enrollment](#3-clinical-trial-enrollment) | Very High | Consent flows, medical data, conditional branching, strict validation |
| 4 | [Commercial Lease Application](#4-commercial-lease-application) | High | Financial docs, guarantor info, conditional sections |
| 5 | [Immigration Visa Application](#5-immigration-visa-application) | Very High | Multi-step wizard, dependent uploads, complex conditionals |

## How to Use

These JSON Schema files can be loaded directly into FormBridge:

```typescript
import scenario from './01-insurance-claim.json';

const app = createFormBridgeApp({
  intakes: [{
    id: scenario.id,
    version: scenario.version,
    name: scenario.name,
    schema: scenario.schema,
    destination: { type: 'webhook', name: 'Demo', config: { url: '...' } },
  }],
});
```
