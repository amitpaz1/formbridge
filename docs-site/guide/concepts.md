# Core Concepts

## Intake Definition

An intake is a template for data collection. It defines:
- **Schema**: What fields to collect (JSON Schema or Zod)
- **Approval Gates**: Whether human review is required
- **Destination**: Where to deliver finalized submissions

## Submission Lifecycle

Submissions flow through these states:

```
draft → in_progress → submitted → finalized
                   ↘ needs_review → approved → submitted
                                  → rejected
```

## Mixed-Mode Collaboration

FormBridge tracks which actor (agent or human) filled each field. This enables:
- Agents fill structured data they can extract
- Humans complete fields requiring judgment
- Full attribution audit trail

## Resume Tokens

Every state-changing operation rotates the resume token. This ensures:
- Only the latest token holder can modify the submission
- Stale links cannot cause conflicts
- Handoff between agents and humans is secure

## Event Stream

Every action produces an immutable event with:
- Unique event ID and monotonic version
- Actor attribution (agent/human/system)
- State at time of event
- Structured payload with field-level diffs
