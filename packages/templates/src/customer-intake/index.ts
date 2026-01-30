import { schema } from './schema.js';
import jsonSchema from './schema.json.js';
import type { TemplateExport } from '../types.js';

export const customerIntake: TemplateExport = {
  schema,
  jsonSchema,
  metadata: {
    id: 'customer-intake',
    name: 'Customer Intake',
    description: 'Collect new customer information',
    category: 'sales',
    version: '1.0.0',
  },
};
