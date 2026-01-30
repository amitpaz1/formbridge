export default {
  type: 'object',
  properties: {
    requestorName: { type: 'string', minLength: 1, description: 'Full name of the person requesting access' },
    requestorEmail: { type: 'string', format: 'email', description: 'Email of the requestor' },
    department: { type: 'string', minLength: 1, description: 'Department' },
    managerEmail: { type: 'string', format: 'email', description: 'Manager email for approval' },
    systems: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Systems to request access to' },
    accessLevel: { type: 'string', enum: ['read-only', 'read-write', 'admin'], description: 'Level of access needed' },
    justification: { type: 'string', minLength: 10, description: 'Business justification for access' },
    startDate: { type: 'string', description: 'When access should start (ISO date)' },
    endDate: { type: 'string', description: 'When access should expire (ISO date)' },
    isTemporary: { type: 'boolean', default: false, description: 'Whether this is temporary access' },
  },
  required: ['requestorName', 'requestorEmail', 'department', 'managerEmail', 'systems', 'accessLevel', 'justification', 'startDate'],
} as const;
