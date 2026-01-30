import type { z } from 'zod';

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
}

export interface TemplateExport {
  schema: z.ZodType;
  jsonSchema: Record<string, unknown>;
  metadata: TemplateMetadata;
}
