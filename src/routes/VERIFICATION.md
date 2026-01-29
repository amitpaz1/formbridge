# Submission Routes Verification Guide

## Endpoint: POST /submissions/:id/handoff

This endpoint generates a resume URL for agent-to-human handoff.

### Testing

#### Unit Tests
Run the unit tests to verify the route handler logic:
```bash
npm run test:run src/routes/__tests__/submissions.test.ts
```

Expected: All tests pass ✓

#### Manual API Testing

1. **Start the test server:**
   ```bash
   npm install
   npx tsx src/test-server.ts
   ```

2. **Create a test submission first:**
   ```bash
   # Note: You'll need to create a submission via the MCP tools or
   # use the mock submission created by the test server
   ```

3. **Test the handoff endpoint:**
   ```bash
   curl -X POST http://localhost:3000/submissions/sub_test/handoff \
     -H "Content-Type: application/json" \
     -d '{
       "actor": {
         "kind": "agent",
         "id": "agent_test",
         "name": "Test Agent"
       }
     }'
   ```

   **Expected Response (200 OK):**
   ```json
   {
     "resumeUrl": "http://localhost:3000/resume?token=rtok_...",
     "submissionId": "sub_test",
     "resumeToken": "rtok_..."
   }
   ```

4. **Test error cases:**

   **Missing submission (404):**
   ```bash
   curl -X POST http://localhost:3000/submissions/sub_nonexistent/handoff \
     -H "Content-Type: application/json"
   ```
   Expected: `{"error": "Submission not found: sub_nonexistent"}`

   **Missing submission ID (400):**
   ```bash
   curl -X POST http://localhost:3000/submissions//handoff \
     -H "Content-Type: application/json"
   ```
   Expected: `{"error": "Missing submission ID"}`

### Implementation Details

- **Route Handler:** `src/routes/submissions.ts`
- **Tests:** `src/routes/__tests__/submissions.test.ts`
- **Test Server:** `src/test-server.ts`

### Integration with Express

To integrate this route into an Express application:

```typescript
import express from "express";
import { SubmissionManager } from "./core/submission-manager";
import { createSubmissionRoutes } from "./routes/submissions";

const app = express();
app.use(express.json());

const manager = new SubmissionManager(store, eventEmitter, baseUrl);
const routes = createSubmissionRoutes(manager);

app.post("/submissions/:id/handoff", routes.generateHandoff);

app.listen(3000);
```

### Events Emitted

When a handoff URL is generated, the following event is emitted:
- **Type:** `handoff.link_issued`
- **Payload:** `{ url: string, resumeToken: string }`
- **Actor:** The actor who requested the handoff URL
