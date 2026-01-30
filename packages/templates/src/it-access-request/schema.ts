import { z } from 'zod';

export const schema = z.object({
  requestorName: z.string().min(1).describe('Full name of the person requesting access'),
  requestorEmail: z.string().email().describe('Email of the requestor'),
  department: z.string().min(1).describe('Department'),
  managerEmail: z.string().email().describe('Manager email for approval'),
  systems: z.array(z.string()).min(1).describe('Systems to request access to'),
  accessLevel: z.enum(['read-only', 'read-write', 'admin']).describe('Level of access needed'),
  justification: z.string().min(10).describe('Business justification for access'),
  startDate: z.string().describe('When access should start (ISO date)'),
  endDate: z.string().optional().describe('When access should expire (ISO date)'),
  isTemporary: z.boolean().default(false).describe('Whether this is temporary access'),
});

export type ITAccessRequest = z.infer<typeof schema>;
