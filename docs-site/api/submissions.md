# Submissions API

## Create Submission

`POST /intake/:intakeId/submissions`

Creates a new submission for the specified intake.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| actor | Actor | Yes | The actor creating the submission |
| initialFields | object | No | Initial field values |
| idempotencyKey | string | No | Idempotency key for duplicate detection |

## Get Submission

`GET /intake/:intakeId/submissions/:submissionId`

## Update Fields

`PATCH /intake/:intakeId/submissions/:submissionId`

## Submit

`POST /intake/:intakeId/submissions/:submissionId/submit`
