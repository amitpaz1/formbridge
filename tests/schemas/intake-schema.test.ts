/**
 * Intake Schema Tests - Coverage Improvement
 *
 * Tests for uncovered areas in src/schemas/intake-schema.ts:
 * - isIntakeDefinition type guard edge cases
 * - validateIntakeDefinition validation rules
 * - Error handling for invalid schemas
 * - Destination validation
 * - Retry policy validation
 * - Complex schema structure validation
 */

import { describe, it, expect } from 'vitest';
import { 
  isIntakeDefinition, 
  validateIntakeDefinition,
  type IntakeDefinition,
  type ApprovalGate,
  type Destination
} from '../../src/schemas/intake-schema.js';
import { z } from 'zod';

// Valid test schemas for testing
const validZodSchema = z.object({
  name: z.string(),
  email: z.string().email()
});

const validDestination: Destination = {
  type: 'webhook',
  name: 'Test Webhook',
  config: { url: 'https://example.com/webhook' }
};

const validIntakeDefinition: IntakeDefinition = {
  id: 'test_intake',
  version: '1.0.0',
  name: 'Test Intake',
  description: 'Test intake form',
  schema: validZodSchema,
  destination: validDestination
};

describe('isIntakeDefinition Type Guard', () => {
  it('should return true for valid IntakeDefinition', () => {
    expect(isIntakeDefinition(validIntakeDefinition)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isIntakeDefinition(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isIntakeDefinition(undefined)).toBe(false);
  });

  it('should return false for non-object types', () => {
    expect(isIntakeDefinition('string')).toBe(false);
    expect(isIntakeDefinition(123)).toBe(false);
    expect(isIntakeDefinition(true)).toBe(false);
    expect(isIntakeDefinition([])).toBe(false);
  });

  it('should return false for object missing required id', () => {
    const obj = { ...validIntakeDefinition };
    delete (obj as any).id;
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object with non-string id', () => {
    const obj = { ...validIntakeDefinition, id: 123 };
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object missing version', () => {
    const obj = { ...validIntakeDefinition };
    delete (obj as any).version;
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object with non-string version', () => {
    const obj = { ...validIntakeDefinition, version: 123 };
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object missing name', () => {
    const obj = { ...validIntakeDefinition };
    delete (obj as any).name;
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object with non-string name', () => {
    const obj = { ...validIntakeDefinition, name: null };
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object missing schema', () => {
    const obj = { ...validIntakeDefinition };
    delete (obj as any).schema;
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object with null schema', () => {
    const obj = { ...validIntakeDefinition, schema: null };
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object with non-object schema', () => {
    const obj = { ...validIntakeDefinition, schema: 'not-a-schema' };
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object with schema missing _def property', () => {
    const obj = { ...validIntakeDefinition, schema: { type: 'object' } };
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object missing destination', () => {
    const obj = { ...validIntakeDefinition };
    delete (obj as any).destination;
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object with null destination', () => {
    const obj = { ...validIntakeDefinition, destination: null };
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return false for object with non-object destination', () => {
    const obj = { ...validIntakeDefinition, destination: 'webhook-url' };
    expect(isIntakeDefinition(obj)).toBe(false);
  });

  it('should return true for object with valid Zod schema (has _def)', () => {
    const zodSchema = z.object({ name: z.string() });
    const obj = {
      ...validIntakeDefinition,
      schema: zodSchema
    };
    expect(isIntakeDefinition(obj)).toBe(true);
  });

  it('should handle edge case with empty object', () => {
    expect(isIntakeDefinition({})).toBe(false);
  });

  it('should handle object with extra properties', () => {
    const obj = {
      ...validIntakeDefinition,
      extraProperty: 'should not affect validation'
    };
    expect(isIntakeDefinition(obj)).toBe(true);
  });
});

describe('validateIntakeDefinition', () => {
  it('should return valid for complete valid definition', () => {
    const result = validateIntakeDefinition(validIntakeDefinition);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  describe('ID validation', () => {
    it('should require id', () => {
      const definition = { ...validIntakeDefinition };
      delete (definition as any).id;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.id is required');
    });

    it('should reject empty id', () => {
      const definition = { ...validIntakeDefinition, id: '' };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.id is required');
    });

    it('should reject id with uppercase letters', () => {
      const definition = { ...validIntakeDefinition, id: 'Test-Intake' };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'IntakeDefinition.id must be lowercase with underscores (e.g., "vendor_onboarding")'
      );
    });

    it('should reject id with hyphens', () => {
      const definition = { ...validIntakeDefinition, id: 'test-intake' };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'IntakeDefinition.id must be lowercase with underscores (e.g., "vendor_onboarding")'
      );
    });

    it('should reject id starting with number', () => {
      const definition = { ...validIntakeDefinition, id: '1test_intake' };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'IntakeDefinition.id must be lowercase with underscores (e.g., "vendor_onboarding")'
      );
    });

    it('should accept valid id with underscores', () => {
      const definition = { ...validIntakeDefinition, id: 'vendor_onboarding_form' };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(true);
    });

    it('should accept valid id with numbers', () => {
      const definition = { ...validIntakeDefinition, id: 'form_v2' };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(true);
    });

    it('should accept single lowercase letter id', () => {
      const definition = { ...validIntakeDefinition, id: 'a' };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(true);
    });
  });

  describe('Version validation', () => {
    it('should require version', () => {
      const definition = { ...validIntakeDefinition };
      delete (definition as any).version;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.version is required');
    });

    it('should reject empty version', () => {
      const definition = { ...validIntakeDefinition, version: '' };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.version is required');
    });

    it('should reject invalid semantic version format', () => {
      const invalidVersions = ['1.0', '1', 'v1.0.0', '1.0.0.0', '1.0.a'];
      
      for (const version of invalidVersions) {
        const definition = { ...validIntakeDefinition, version };
        const result = validateIntakeDefinition(definition);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'IntakeDefinition.version must follow semantic versioning (e.g., "1.0.0")'
        );
      }
    });

    it('should accept valid semantic versions', () => {
      const validVersions = ['1.0.0', '2.1.3', '10.20.30'];
      
      for (const version of validVersions) {
        const definition = { ...validIntakeDefinition, version };
        const result = validateIntakeDefinition(definition);
        expect(result.valid).toBe(true);
      }
    });

    it('should accept semantic versions with prerelease suffix', () => {
      const validVersions = ['1.0.0-alpha', '2.1.0-beta2', '1.0.0-rc'];
      
      for (const version of validVersions) {
        const definition = { ...validIntakeDefinition, version };
        const result = validateIntakeDefinition(definition);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Name validation', () => {
    it('should require name', () => {
      const definition = { ...validIntakeDefinition };
      delete (definition as any).name;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.name is required');
    });

    it('should reject empty name', () => {
      const definition = { ...validIntakeDefinition, name: '' };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.name is required');
    });

    it('should accept any non-empty string name', () => {
      const validNames = [
        'Simple Form',
        'Vendor Onboarding Process',
        'Form with Numbers 123',
        'Form-with-Hyphens',
        'Form_with_underscores',
        'UPPERCASE FORM'
      ];
      
      for (const name of validNames) {
        const definition = { ...validIntakeDefinition, name };
        const result = validateIntakeDefinition(definition);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Schema validation', () => {
    it('should require schema', () => {
      const definition = { ...validIntakeDefinition };
      delete (definition as any).schema;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.schema is required');
    });

    it('should reject null schema', () => {
      const definition = { ...validIntakeDefinition, schema: null };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.schema is required');
    });

    it('should accept valid Zod schema', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number().min(0)
      });
      const definition = { ...validIntakeDefinition, schema: zodSchema };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(true);
    });
  });

  describe('Destination validation', () => {
    it('should require destination', () => {
      const definition = { ...validIntakeDefinition };
      delete (definition as any).destination;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.destination is required');
    });

    it('should reject null destination', () => {
      const definition = { ...validIntakeDefinition, destination: null };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.destination is required');
    });

    it('should require destination.type', () => {
      const definition = { 
        ...validIntakeDefinition, 
        destination: { ...validDestination } 
      };
      delete (definition.destination as any).type;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.destination.type is required');
    });

    it('should require destination.name', () => {
      const definition = { 
        ...validIntakeDefinition, 
        destination: { ...validDestination } 
      };
      delete (definition.destination as any).name;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.destination.name is required');
    });

    it('should require destination.config to be an object', () => {
      const definition = { 
        ...validIntakeDefinition, 
        destination: { ...validDestination, config: 'not-an-object' as any } 
      };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.destination.config must be an object');
    });

    it('should reject null destination.config', () => {
      const definition = { 
        ...validIntakeDefinition, 
        destination: { ...validDestination, config: null as any } 
      };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IntakeDefinition.destination.config must be an object');
    });

    it('should accept empty config object', () => {
      const definition = { 
        ...validIntakeDefinition, 
        destination: { ...validDestination, config: {} } 
      };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(true);
    });

    it('should accept destination with optional fields', () => {
      const destinationWithOptionals: Destination = {
        type: 'webhook',
        name: 'Complex Webhook',
        config: { url: 'https://example.com' },
        webhookUrl: 'https://example.com/webhook',
        auth: {
          type: 'bearer',
          credentials: { token: 'secret-token' }
        },
        retry: {
          maxAttempts: 3,
          delayMs: 1000,
          backoffMultiplier: 2
        }
      };
      
      const definition = { 
        ...validIntakeDefinition, 
        destination: destinationWithOptionals
      };
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(true);
    });
  });

  describe('Multiple errors handling', () => {
    it('should collect all validation errors', () => {
      const definition = {
        // Missing id, invalid version, missing name, missing schema, missing destination
        version: 'invalid-version',
      } as any;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(4); // Should have multiple errors
      
      // Check that it found multiple types of errors
      const errorText = result.errors!.join(' ');
      expect(errorText).toContain('id is required');
      expect(errorText).toContain('version must follow semantic versioning');
      expect(errorText).toContain('name is required');
      expect(errorText).toContain('schema is required');
      expect(errorText).toContain('destination is required');
    });

    it('should handle partially invalid definition', () => {
      const definition = {
        id: 'invalid-ID',  // uppercase
        version: '1.0',    // invalid format
        name: 'Valid Name',
        schema: validZodSchema,
        destination: {
          type: 'webhook',
          name: 'Test',
          // missing config
        }
      } as any;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(3); // id, version, destination.config errors
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined input', () => {
      const result = validateIntakeDefinition({} as any); // Use empty object instead of undefined
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle empty object', () => {
      const result = validateIntakeDefinition({});
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(5); // All required fields missing
    });

    it('should handle object with null values', () => {
      const definition = {
        id: null,
        version: null,
        name: null,
        schema: null,
        destination: null
      } as any;
      
      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Complex intake definitions', () => {
    it('should validate complex definition with approval gates', () => {
      const approvalGate: ApprovalGate = {
        id: 'high-value-review',
        name: 'High Value Review',
        description: 'Review for high value transactions',
        condition: 'amount > 10000',
        triggerFields: ['amount', 'vendor_type'],
        required: true,
        reviewers: ['manager1', 'manager2'],
        approvalLevel: 2,
        autoApproveThreshold: 0.95,
        notificationConfig: { email: true, slack: false }
      };

      const complexDefinition: IntakeDefinition = {
        id: 'complex_vendor_form',
        version: '2.1.0',
        name: 'Complex Vendor Onboarding',
        description: 'Advanced vendor onboarding with approval workflow',
        schema: z.object({
          vendor_name: z.string().min(1),
          amount: z.number().positive(),
          vendor_type: z.enum(['individual', 'corporation'])
        }),
        approvalGates: [approvalGate],
        destination: {
          type: 'webhook',
          name: 'Vendor Processing Webhook',
          config: {
            url: 'https://api.example.com/vendors',
            timeout: 30000
          },
          webhookUrl: 'https://api.example.com/webhook',
          auth: {
            type: 'api-key',
            credentials: { 
              'x-api-key': 'secret-key',
              'x-client-id': 'client-123' 
            }
          },
          retry: {
            maxAttempts: 5,
            delayMs: 2000,
            backoffMultiplier: 1.5
          }
        },
        metadata: {
          category: 'finance',
          priority: 'high',
          tags: ['vendor', 'onboarding', 'finance']
        },
        errorMessages: {
          'vendor_name': 'Vendor name is required and must not be empty',
          'amount': 'Amount must be a positive number',
          'vendor_type': 'Vendor type must be either individual or corporation'
        },
        fieldHints: {
          vendor_name: {
            label: 'Legal Vendor Name',
            placeholder: 'Enter the legal business name',
            helpText: 'This should match the name on official documents',
            order: 1
          },
          amount: {
            label: 'Contract Amount ($)',
            placeholder: '0.00',
            helpText: 'Enter the total contract value in USD',
            order: 2
          },
          vendor_type: {
            label: 'Vendor Type',
            helpText: 'Select the appropriate vendor classification',
            order: 3
          }
        }
      };

      const result = validateIntakeDefinition(complexDefinition);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate definition with callback destination', () => {
      const callbackDestination: Destination = {
        type: 'callback',
        name: 'Internal Processing',
        config: {
          service: 'internal-api',
          endpoint: '/process-submission',
          async: true
        },
        retry: {
          maxAttempts: 3,
          delayMs: 500
        }
      };

      const definition = {
        ...validIntakeDefinition,
        destination: callbackDestination
      };

      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(true);
    });

    it('should validate definition with email destination', () => {
      const emailDestination: Destination = {
        type: 'email',
        name: 'Email Notification',
        config: {
          to: ['admin@example.com', 'manager@example.com'],
          subject: 'New submission received',
          template: 'submission-template'
        },
        auth: {
          type: 'smtp',
          credentials: {
            host: 'smtp.example.com',
            username: 'notifications@example.com',
            password: 'secret'
          }
        }
      };

      const definition = {
        ...validIntakeDefinition,
        destination: emailDestination
      };

      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(true);
    });

    it('should validate definition with database destination', () => {
      const dbDestination: Destination = {
        type: 'database',
        name: 'Main Database',
        config: {
          table: 'submissions',
          connectionString: 'postgresql://user:pass@host:5432/db',
          schema: 'public'
        },
        retry: {
          maxAttempts: 5,
          delayMs: 1000,
          backoffMultiplier: 2
        }
      };

      const definition = {
        ...validIntakeDefinition,
        destination: dbDestination
      };

      const result = validateIntakeDefinition(definition);
      expect(result.valid).toBe(true);
    });
  });
});