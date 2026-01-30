import { z } from 'zod';

export const schema = z.object({
  employeeName: z.string().min(1).describe('Employee full name'),
  employeeEmail: z.string().email().describe('Employee email'),
  department: z.string().min(1).describe('Department'),
  expenseDate: z.string().describe('Date of expense (ISO date)'),
  category: z.enum(['travel', 'meals', 'supplies', 'software', 'equipment', 'other']).describe('Expense category'),
  amount: z.number().positive().describe('Amount in USD'),
  currency: z.string().default('USD').describe('Currency code'),
  description: z.string().min(5).describe('Description of expense'),
  vendor: z.string().min(1).describe('Vendor or merchant name'),
  receipt: z.string().optional().describe('Receipt image or PDF'),
  projectCode: z.string().optional().describe('Project code to charge'),
  notes: z.string().optional().describe('Additional notes'),
});

export type ExpenseReport = z.infer<typeof schema>;
