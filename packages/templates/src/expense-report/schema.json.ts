export default {
  type: 'object',
  properties: {
    employeeName: { type: 'string', minLength: 1, description: 'Employee full name' },
    employeeEmail: { type: 'string', format: 'email', description: 'Employee email' },
    department: { type: 'string', minLength: 1, description: 'Department' },
    expenseDate: { type: 'string', description: 'Date of expense (ISO date)' },
    category: { type: 'string', enum: ['travel', 'meals', 'supplies', 'software', 'equipment', 'other'], description: 'Expense category' },
    amount: { type: 'number', exclusiveMinimum: 0, description: 'Amount in USD' },
    currency: { type: 'string', default: 'USD', description: 'Currency code' },
    description: { type: 'string', minLength: 5, description: 'Description of expense' },
    vendor: { type: 'string', minLength: 1, description: 'Vendor or merchant name' },
    receipt: { type: 'string', description: 'Receipt image or PDF' },
    projectCode: { type: 'string', description: 'Project code to charge' },
    notes: { type: 'string', description: 'Additional notes' },
  },
  required: ['employeeName', 'employeeEmail', 'department', 'expenseDate', 'category', 'amount', 'description', 'vendor'],
} as const;
