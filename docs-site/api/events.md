# Events API

## Get Events

`GET /submissions/:id/events`

Returns the event stream for a submission.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Filter by event type |
| actorKind | string | Filter by actor kind (agent/human/system) |
| since | string | ISO 8601 timestamp |
| until | string | ISO 8601 timestamp |
| limit | number | Max events to return |
| offset | number | Skip N events |
| format | string | Response format: json (default) or jsonl |
