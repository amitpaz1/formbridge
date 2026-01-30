export default {
  type: 'object',
  properties: {
    customerName: { type: 'string', minLength: 1, description: 'Full name or company name' },
    email: { type: 'string', format: 'email', description: 'Primary contact email' },
    phone: { type: 'string', description: 'Phone number' },
    companySize: { type: 'string', enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'], description: 'Company size' },
    industry: { type: 'string', minLength: 1, description: 'Industry sector' },
    useCase: { type: 'string', minLength: 10, description: 'Describe your use case' },
    budget: { type: 'string', enum: ['<$1k', '$1k-$10k', '$10k-$50k', '$50k-$100k', '$100k+'], description: 'Budget range' },
    timeline: { type: 'string', enum: ['immediate', '1-3 months', '3-6 months', '6+ months'], description: 'Implementation timeline' },
    referralSource: { type: 'string', description: 'How did you hear about us?' },
  },
  required: ['customerName', 'email', 'companySize', 'industry', 'useCase'],
} as const;
