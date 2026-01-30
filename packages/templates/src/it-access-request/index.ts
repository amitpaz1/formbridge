import { schema } from './schema.js';
import jsonSchema from './schema.json.js';
import type { TemplateExport } from '../types.js';

export const itAccessRequest: TemplateExport = {
  schema,
  jsonSchema,
  metadata: {
    id: 'it-access-request',
    name: 'IT Access Request',
    description: 'Request access to IT systems and resources',
    category: 'it',
    version: '1.0.0',
  },
};
