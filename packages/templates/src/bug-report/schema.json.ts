export default {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 5, maxLength: 200, description: 'Short summary of the bug' },
    description: { type: 'string', minLength: 20, description: 'Detailed description of the bug' },
    stepsToReproduce: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Steps to reproduce the bug' },
    expectedBehavior: { type: 'string', minLength: 5, description: 'What should happen' },
    actualBehavior: { type: 'string', minLength: 5, description: 'What actually happens' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], description: 'Bug severity' },
    priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], description: 'Priority level' },
    environment: {
      type: 'object',
      properties: {
        os: { type: 'string', description: 'Operating system' },
        browser: { type: 'string', description: 'Browser and version' },
        appVersion: { type: 'string', description: 'Application version' },
      },
      required: ['os'],
      description: 'Environment details',
    },
    reporterEmail: { type: 'string', format: 'email', description: 'Reporter email' },
    assignee: { type: 'string', description: 'Assigned developer' },
    screenshot: { type: 'string', description: 'Screenshot of the bug' },
    logs: { type: 'string', description: 'Relevant log output' },
  },
  required: ['title', 'description', 'stepsToReproduce', 'expectedBehavior', 'actualBehavior', 'severity', 'environment', 'reporterEmail'],
} as const;
