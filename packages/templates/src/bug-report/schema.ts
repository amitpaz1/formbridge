import { z } from 'zod';

export const schema = z.object({
  title: z.string().min(5).max(200).describe('Short summary of the bug'),
  description: z.string().min(20).describe('Detailed description of the bug'),
  stepsToReproduce: z.array(z.string()).min(1).describe('Steps to reproduce the bug'),
  expectedBehavior: z.string().min(5).describe('What should happen'),
  actualBehavior: z.string().min(5).describe('What actually happens'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).describe('Bug severity'),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional().describe('Priority level'),
  environment: z.object({
    os: z.string().describe('Operating system'),
    browser: z.string().optional().describe('Browser and version'),
    appVersion: z.string().optional().describe('Application version'),
  }).describe('Environment details'),
  reporterEmail: z.string().email().describe('Reporter email'),
  assignee: z.string().optional().describe('Assigned developer'),
  screenshot: z.string().optional().describe('Screenshot of the bug'),
  logs: z.string().optional().describe('Relevant log output'),
});

export type BugReport = z.infer<typeof schema>;
