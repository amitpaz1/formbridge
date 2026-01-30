import { z } from 'zod';

export const schema = z.object({
  companyName: z.string().min(1).describe('Legal company name'),
  taxId: z.string().regex(/^\d{2}-\d{7}$/).describe('Tax identification number (XX-XXXXXXX)'),
  contactEmail: z.string().email().describe('Primary contact email'),
  contactPhone: z.string().optional().describe('Contact phone number'),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(2).max(2),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
    country: z.string().default('US'),
  }).describe('Business address'),
  bankName: z.string().optional().describe('Bank name for payments'),
  bankAccountType: z.enum(['checking', 'savings']).optional(),
  insuranceCertificate: z.string().optional().describe('Insurance certificate document'),
});

export type VendorOnboarding = z.infer<typeof schema>;
