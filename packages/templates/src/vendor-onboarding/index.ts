import { schema } from './schema.js';
import jsonSchema from './schema.json.js';
import type { TemplateExport } from '../types.js';

export const vendorOnboarding: TemplateExport = {
  schema,
  jsonSchema,
  metadata: {
    id: 'vendor-onboarding',
    name: 'Vendor Onboarding',
    description: 'Collect vendor registration and compliance data',
    category: 'procurement',
    version: '1.0.0',
  },
};
