# Walkthrough: Agent-Human Handoff

This walkthrough shows how an AI agent can hand off a partially-filled form to a human.

## Step 1: Agent Fills Initial Fields

The agent collects what it can from conversation context.

## Step 2: Generate Handoff URL

```typescript
const resumeUrl = await manager.generateHandoffUrl(submissionId, agentActor);
// Returns: https://your-app.com/resume?token=rtok_...
```

## Step 3: Human Opens Resume Link

The human opens the link, sees pre-filled fields, and completes the rest.

## Step 4: Events Track Both Actors

The event stream records both the agent and human contributions with full attribution.
