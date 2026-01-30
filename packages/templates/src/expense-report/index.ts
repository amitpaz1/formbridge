import { schema } from './schema.js';
import jsonSchema from './schema.json.js';
import type { TemplateExport } from '../types.js';

export const expenseReport: TemplateExport = {
  schema,
  jsonSchema,
  metadata: {
    id: 'expense-report',
    name: 'Expense Report',
    description: 'Submit expense reports for reimbursement',
    category: 'finance',
    version: '1.0.0',
  },
};
