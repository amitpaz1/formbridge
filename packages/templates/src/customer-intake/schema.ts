import { z } from 'zod';

export const schema = z.object({
  customerName: z.string().min(1).describe('Full name or company name'),
  email: z.string().email().describe('Primary contact email'),
  phone: z.string().optional().describe('Phone number'),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).describe('Company size'),
  industry: z.string().min(1).describe('Industry sector'),
  useCase: z.string().min(10).describe('Describe your use case'),
  budget: z.enum(['<$1k', '$1k-$10k', '$10k-$50k', '$50k-$100k', '$100k+']).optional().describe('Budget range'),
  timeline: z.enum(['immediate', '1-3 months', '3-6 months', '6+ months']).optional().describe('Implementation timeline'),
  referralSource: z.string().optional().describe('How did you hear about us?'),
});

export type CustomerIntake = z.infer<typeof schema>;
