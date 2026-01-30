# Webhooks API

## List Deliveries

`GET /submissions/:id/deliveries`

Returns webhook delivery records for a submission.

## Get Delivery

`GET /webhooks/deliveries/:deliveryId`

## Retry Delivery

`POST /webhooks/deliveries/:deliveryId/retry`

## Signature Verification

FormBridge signs webhook payloads with HMAC-SHA256.

Headers:
- `X-FormBridge-Signature: sha256={hex}`
- `X-FormBridge-Timestamp: {ISO 8601}`
