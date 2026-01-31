# FormBridge

Mixed-mode agent-human form submission infrastructure. FormBridge lets AI agents create structured intake forms, fill in what they know, and hand off to humans to complete the rest — with full field-level attribution tracking.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

## What is FormBridge?

FormBridge solves a common problem in agent workflows: an AI agent can gather most of the data for a form, but some fields require human input (signatures, file uploads, sensitive data). FormBridge provides the infrastructure for this handoff:

1. **Agent creates** a submission and fills fields it knows
2. **Agent generates** a resume URL and hands it to a human
3. **Human opens** the link and completes remaining fields
4. **Both parties** can track who filled what via field attribution
5. **Submission flows** through validation, optional approval gates, and delivery

## Packages

| Package | Description |
|---------|-------------|
| `@formbridge/mcp-server` | Core server — HTTP API, MCP tools, submission lifecycle, storage |
| `@formbridge/form-renderer` | React components and hooks for rendering forms in the handoff workflow |
| `@formbridge/create` | CLI scaffolding tool (`npx @formbridge/create`) |
| `@formbridge/schema-normalizer` | Converts Zod, JSON Schema, and OpenAPI specs into unified IntakeSchema IR |
| `@formbridge/templates` | Example intake templates (vendor onboarding, contact form, etc.) |
| `@formbridge/admin-dashboard` | React SPA for managing intakes, submissions, and approvals |

## Quick Start

### HTTP API

```typescript
import { createFormBridgeApp } from '@formbridge/mcp-server';

const app = createFormBridgeApp();

// Register an intake definition
app.post('/intake/contact-form', /* ... */);

// The API exposes these endpoints per intake:
// POST   /intake/:intakeId/submissions        — create submission
// GET    /intake/:intakeId/submissions/:id     — get submission
// PATCH  /intake/:intakeId/submissions/:id     — update fields
// POST   /intake/:intakeId/submissions/:id/submit — submit
```

**Submission lifecycle:**

```bash
# 1. Create a submission
curl -X POST http://localhost:3000/intake/contact-form/submissions \
  -H 'Content-Type: application/json' \
  -d '{
    "actor": { "kind": "agent", "id": "agent-1" },
    "idempotencyKey": "req_abc123",
    "initialFields": { "name": "John Doe", "email": "john@example.com" }
  }'
# Returns: { ok: true, submissionId, resumeToken, state: "draft" }

# 2. Update fields (with resume token rotation)
curl -X PATCH http://localhost:3000/intake/contact-form/submissions/:id \
  -H 'Content-Type: application/json' \
  -d '{
    "resumeToken": "rtok_...",
    "actor": { "kind": "human", "id": "user-1" },
    "fields": { "message": "Hello!" }
  }'

# 3. Submit
curl -X POST http://localhost:3000/intake/contact-form/submissions/:id/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "resumeToken": "rtok_...",
    "actor": { "kind": "human", "id": "user-1" },
    "idempotencyKey": "submit_abc123"
  }'
```

### MCP Server

```typescript
import { FormBridgeMCPServer } from '@formbridge/mcp-server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new FormBridgeMCPServer({
  name: 'contact-form-server',
  version: '1.0.0',
});

server.registerIntake({
  id: 'contact_form',
  version: '1.0.0',
  name: 'Contact Form',
  description: 'Submit contact inquiries',
  schema: z.object({
    name: z.string().describe('Full name'),
    email: z.string().email().describe('Email address'),
    message: z.string().describe('Your message'),
  }),
  destination: {
    type: 'webhook',
    name: 'Contact API',
    config: { url: 'https://api.example.com/contacts', method: 'POST' },
  },
});

const transport = new StdioServerTransport();
await server.getServer().connect(transport);
```

Each registered intake generates four MCP tools: `{id}__create`, `{id}__set`, `{id}__validate`, `{id}__submit`.

### React Form Renderer

```tsx
import { FormBridgeForm } from '@formbridge/form-renderer';

function App() {
  return (
    <FormBridgeForm
      schema={intakeSchema}
      endpoint="http://localhost:3000"
      actor={{ kind: 'human', id: 'user-1' }}
      onSuccess={(data, submissionId) => console.log('Submitted:', submissionId)}
    />
  );
}
```

For resuming agent-started forms:

```tsx
import { ResumeFormPage } from '@formbridge/form-renderer';

function ResumePage() {
  const token = new URLSearchParams(location.search).get('token');
  return <ResumeFormPage resumeToken={token} endpoint="http://localhost:3000" />;
}
```

### CLI Scaffolding

```bash
# Interactive mode
npx @formbridge/create

# Non-interactive
npx @formbridge/create --name my-intake --schema zod --interface http,mcp
```

## Key Features

- **Field Attribution** — Tracks which actor (agent, human, system) filled each field
- **Resume Tokens** — Rotated on every state change for secure handoff URLs
- **Idempotency** — Duplicate requests with the same idempotency key return the existing submission
- **Approval Gates** — Configurable review workflows that pause submission until approved
- **Event Stream** — Append-only audit trail with batch `fields.updated` events and structured diffs
- **File Uploads** — Signed URL negotiation protocol for secure file handling
- **Schema Normalization** — Accept Zod, JSON Schema, or OpenAPI input formats
- **Webhook Delivery** — Configurable destination with retry and backoff
- **Multi-Step Forms** — Progressive disclosure via create/set/validate/submit lifecycle
- **SSE & Stdio Transports** — Deploy as local MCP server or remote HTTP service

## Development

```bash
# Install dependencies
npm install

# Run tests
npm run test:run

# Run tests in watch mode
npm test

# Type checking
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

### Project Structure

```
src/                          # Core @formbridge/mcp-server package
  core/                       # Business logic (submission, approval, events)
  mcp/                        # MCP server and tool generation
  middleware/                  # Hono middleware (auth, error handling, rate limiting)
  storage/                    # Storage backends (memory, SQLite, S3)
  types/                      # TypeScript types and intake contract
packages/
  form-renderer/              # React form components and hooks
  create-formbridge/          # CLI scaffolding tool
  schema-normalizer/          # Schema conversion engine
  templates/                  # Example intake templates
  admin-dashboard/            # Admin UI for managing submissions
  demo/                       # Demo application
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

```bash
# Fork and clone the repo, then:
npm install
npm run test:run   # Make sure tests pass
npm run lint       # Make sure lint passes
```

## License

MIT - see [LICENSE](./LICENSE) for details.
