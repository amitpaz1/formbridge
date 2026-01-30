# API Reference

FormBridge exposes a RESTful HTTP API built on Hono.

## Base URL

All endpoints are relative to your deployment URL.

## Authentication

Authentication is optional and configurable. See the Auth guide for details.

## Content Type

All requests and responses use `application/json`.

## Common Response Format

Success:
```json
{ "ok": true, "submissionId": "sub_...", "state": "draft" }
```

Error:
```json
{ "ok": false, "error": { "type": "not_found", "message": "..." } }
```
