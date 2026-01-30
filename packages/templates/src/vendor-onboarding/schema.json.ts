export default {
  type: 'object',
  properties: {
    companyName: { type: 'string', minLength: 1, description: 'Legal company name' },
    taxId: { type: 'string', pattern: '^\\d{2}-\\d{7}$', description: 'Tax identification number (XX-XXXXXXX)' },
    contactEmail: { type: 'string', format: 'email', description: 'Primary contact email' },
    contactPhone: { type: 'string', description: 'Contact phone number' },
    address: {
      type: 'object',
      properties: {
        street: { type: 'string', minLength: 1 },
        city: { type: 'string', minLength: 1 },
        state: { type: 'string', minLength: 2, maxLength: 2 },
        zip: { type: 'string', pattern: '^\\d{5}(-\\d{4})?$' },
        country: { type: 'string', default: 'US' },
      },
      required: ['street', 'city', 'state', 'zip'],
      description: 'Business address',
    },
    bankName: { type: 'string', description: 'Bank name for payments' },
    bankAccountType: { type: 'string', enum: ['checking', 'savings'] },
    insuranceCertificate: { type: 'string', description: 'Insurance certificate document' },
  },
  required: ['companyName', 'taxId', 'contactEmail', 'address'],
} as const;
