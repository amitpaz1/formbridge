import { vendorOnboarding } from './vendor-onboarding/index.js';
import { itAccessRequest } from './it-access-request/index.js';
import { customerIntake } from './customer-intake/index.js';
import { expenseReport } from './expense-report/index.js';
import { bugReport } from './bug-report/index.js';
import type { TemplateExport } from './types.js';

export const allTemplates: Record<string, TemplateExport> = {
  'vendor-onboarding': vendorOnboarding,
  'it-access-request': itAccessRequest,
  'customer-intake': customerIntake,
  'expense-report': expenseReport,
  'bug-report': bugReport,
};
