import { schema } from './schema.js';
import jsonSchema from './schema.json.js';
import type { TemplateExport } from '../types.js';

export const bugReport: TemplateExport = {
  schema,
  jsonSchema,
  metadata: {
    id: 'bug-report',
    name: 'Bug Report',
    description: 'Report software bugs and issues',
    category: 'engineering',
    version: '1.0.0',
  },
};
