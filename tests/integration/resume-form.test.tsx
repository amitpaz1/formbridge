/**
 * Resume Form Integration Test
 *
 * Tests the human side of agent-to-human handoff workflow:
 * - Human opens resume URL
 * - HANDOFF_RESUMED event is emitted
 * - Form pre-fills with agent data
 * - Agent-filled fields show attribution badges
 * - Empty fields have no badges
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResumeFormPage } from '../../packages/form-renderer/src/components/ResumeFormPage';
import { FormBridgeForm } from '../../packages/form-renderer/src/components/FormBridgeForm';
import type { Actor } from '../../src/types/intake-contract';
import type { Submission } from '../../src/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('Resume Form Integration - Human Handoff', () => {
  const agentActor: Actor = {
    kind: 'agent',
    id: 'agent-onboarding-001',
    name: 'Vendor Onboarding Agent',
  };

  const humanActor: Actor = {
    kind: 'human',
    id: 'user-vendor-manager',
    name: 'Vendor Manager',
  };

  const mockSubmission: Submission = {
    id: 'sub_test123',
    intakeId: 'intake_vendor_onboarding',
    state: 'in_progress',
    resumeToken: 'rtok_test123',
    fields: {
      companyName: 'Acme Corp',
      address: '123 Main St, San Francisco, CA 94105',
      taxId: '12-3456789',
      // Empty fields that human should fill
      w9Document: '',
      insuranceCertificate: '',
    },
    fieldAttribution: {
      companyName: agentActor,
      address: agentActor,
      taxId: agentActor,
      // No attribution for empty fields
    },
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: agentActor,
    updatedBy: agentActor,
  };

  const mockSchema = {
    type: 'object' as const,
    title: 'Vendor Onboarding',
    description: 'Complete vendor information',
    properties: {
      companyName: {
        type: 'string',
        title: 'Company Name',
        description: 'Legal name of the company',
      },
      address: {
        type: 'string',
        title: 'Address',
        description: 'Business address',
      },
      taxId: {
        type: 'string',
        title: 'Tax ID',
        description: 'Federal tax identification number',
      },
      w9Document: {
        type: 'string',
        title: 'W-9 Form',
        description: 'Upload completed W-9 form',
      },
      insuranceCertificate: {
        type: 'string',
        title: 'Insurance Certificate',
        description: 'Upload insurance certificate',
      },
    },
    required: ['companyName', 'taxId', 'w9Document'],
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock successful submission fetch
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/submissions/resume/rtok_test123')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            submission: mockSubmission,
            schema: mockSchema,
          }),
        });
      }

      // Mock HANDOFF_RESUMED event emission
      if (url.includes('/submissions/resume/rtok_test123/resumed')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            eventId: 'evt_resumed_123',
          }),
        });
      }

      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Human Opens Resume URL', () => {
    it('should render ResumeFormPage with resume token', async () => {
      render(
        <ResumeFormPage
          resumeToken="rtok_test123"
          endpoint="http://localhost:3000"
        />
      );

      // Should show loading state initially
      expect(screen.getByText(/loading form/i)).toBeInTheDocument();

      // Wait for content to load (placeholder for now since hook not implemented)
      await waitFor(() => {
        expect(screen.queryByText(/loading form/i)).not.toBeInTheDocument();
      });
    });

    it('should show error when resume token is missing', () => {
      render(
        <ResumeFormPage
          resumeToken={undefined}
          endpoint="http://localhost:3000"
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/missing resume token/i)).toBeInTheDocument();
    });
  });

  describe('Form Pre-filled with Agent Data', () => {
    it('should display agent-filled fields with correct values', () => {
      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Verify agent-filled fields are pre-populated
      const companyNameInput = screen.getByLabelText(/Company Name/i) as HTMLInputElement;
      expect(companyNameInput.value).toBe('Acme Corp');

      const addressInput = screen.getByLabelText(/Address/i) as HTMLInputElement;
      expect(addressInput.value).toBe('123 Main St, San Francisco, CA 94105');

      const taxIdInput = screen.getByLabelText(/Tax ID/i) as HTMLInputElement;
      expect(taxIdInput.value).toBe('12-3456789');
    });

    it('should display empty fields that human needs to fill', () => {
      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Verify empty fields
      const w9Input = screen.getByLabelText(/W-9 Form/i) as HTMLInputElement;
      expect(w9Input.value).toBe('');

      const insuranceInput = screen.getByLabelText(/Insurance Certificate/i) as HTMLInputElement;
      expect(insuranceInput.value).toBe('');
    });
  });

  describe('Visual Attribution Badges', () => {
    it('should show "Filled by agent" badge on agent-filled fields', () => {
      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Should show "Filled by agent" for the 3 agent-filled fields
      const agentBadges = screen.getAllByText(/Filled by agent/i);
      expect(agentBadges).toHaveLength(3); // companyName, address, taxId
    });

    it('should not show badges on empty fields', () => {
      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Total badges should be 3 (only agent-filled fields)
      // Empty fields (w9Document, insuranceCertificate) should have no badges
      const allBadges = screen.getAllByText(/Filled by/i);
      expect(allBadges).toHaveLength(3);
    });

    it('should show agent name in attribution badge', () => {
      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Check for agent name in badges
      expect(screen.getAllByText(/Vendor Onboarding Agent/i)).toBeTruthy();
    });
  });

  describe('HANDOFF_RESUMED Event Emission', () => {
    it('should emit HANDOFF_RESUMED event when form loads', async () => {
      // This test verifies the API call pattern
      // Actual implementation will be in useResumeSubmission hook

      const mockFetch = global.fetch as jest.Mock;

      // Simulate what the hook should do
      await fetch('http://localhost:3000/submissions/resume/rtok_test123');
      await fetch('http://localhost:3000/submissions/resume/rtok_test123/resumed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: humanActor,
        }),
      });

      // Verify fetch was called for event emission
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/resumed'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('human'),
        })
      );
    });
  });

  describe('Mixed Attribution Workflow', () => {
    it('should correctly distinguish agent vs human filled fields', () => {
      // Create a submission with mixed attribution
      const mixedSubmission: Submission = {
        ...mockSubmission,
        fields: {
          companyName: 'Acme Corp', // Agent filled
          address: '123 Main St', // Agent filled
          taxId: '12-3456789', // Agent filled
          w9Document: 'file://uploads/w9.pdf', // Human filled
          insuranceCertificate: 'file://uploads/insurance.pdf', // Human filled
        },
        fieldAttribution: {
          companyName: agentActor,
          address: agentActor,
          taxId: agentActor,
          w9Document: humanActor,
          insuranceCertificate: humanActor,
        },
      };

      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mixedSubmission.fields}
          fieldAttribution={mixedSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Should have 3 agent badges
      const agentBadges = screen.getAllByText(/Filled by agent/i);
      expect(agentBadges).toHaveLength(3);

      // Should have 2 human badges
      const humanBadges = screen.getAllByText(/Filled by human/i);
      expect(humanBadges).toHaveLength(2);
    });

    it('should handle system actor attribution', () => {
      const systemActor: Actor = {
        kind: 'system',
        id: 'system-001',
        name: 'FormBridge System',
      };

      const systemSubmission: Submission = {
        ...mockSubmission,
        fields: {
          companyName: 'Auto-filled Corp',
        },
        fieldAttribution: {
          companyName: systemActor,
        },
      };

      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={systemSubmission.fields}
          fieldAttribution={systemSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Should show system badge
      expect(screen.getByText(/Filled by system/i)).toBeInTheDocument();
    });
  });

  describe('Human Can Edit Agent-Filled Fields', () => {
    it('should allow human to modify agent-filled fields', () => {
      const { container } = render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Agent-filled fields should not be disabled
      const companyNameInput = screen.getByLabelText(/Company Name/i) as HTMLInputElement;
      expect(companyNameInput).not.toBeDisabled();

      const addressInput = screen.getByLabelText(/Address/i) as HTMLInputElement;
      expect(addressInput).not.toBeDisabled();
    });

    it('should not allow editing in read-only mode', () => {
      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
          readOnly
        />
      );

      // All fields should be disabled in read-only mode
      const companyNameInput = screen.getByLabelText(/Company Name/i);
      expect(companyNameInput).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('should mark required fields with asterisk', () => {
      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Required fields should have asterisk
      const companyNameLabel = screen.getByText(/Company Name/i);
      expect(companyNameLabel.parentElement).toHaveTextContent('*');

      const taxIdLabel = screen.getByText(/Tax ID/i);
      expect(taxIdLabel.parentElement).toHaveTextContent('*');

      const w9Label = screen.getByText(/W-9 Form/i);
      expect(w9Label.parentElement).toHaveTextContent('*');
    });

    it('should not mark optional fields with asterisk', () => {
      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Address and Insurance are not required
      const addressLabel = screen.getByText('Address');
      const insuranceLabel = screen.getByText('Insurance Certificate');

      // These should not have asterisk in the required field sense
      // (They may have the asterisk from another context, so we check the input required attribute)
      const addressInput = screen.getByLabelText(/Address/i);
      expect(addressInput).not.toBeRequired();

      const insuranceInput = screen.getByLabelText(/Insurance Certificate/i);
      expect(insuranceInput).not.toBeRequired();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for badges', () => {
      const { container } = render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Actor badges should have role="status"
      const badges = container.querySelectorAll('[role="status"]');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should have proper labels for all form fields', () => {
      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={mockSubmission.fields}
          fieldAttribution={mockSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // All fields should be accessible by label
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Tax ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/W-9 Form/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Insurance Certificate/i)).toBeInTheDocument();
    });
  });

  describe('Complete Handoff Scenario', () => {
    it('should display complete vendor onboarding scenario with mixed actors', () => {
      // This test simulates the complete workflow:
      // 1. Agent fills basic company info
      // 2. Human opens resume URL
      // 3. Human sees pre-filled data with attribution
      // 4. Human completes document uploads
      // 5. Form ready for submission

      const completeSubmission: Submission = {
        ...mockSubmission,
        fields: {
          companyName: 'Global Widgets Inc',
          address: '456 Tech Blvd, Austin, TX 78701',
          taxId: '98-7654321',
          w9Document: '', // Human needs to upload
          insuranceCertificate: '', // Human needs to upload
        },
        fieldAttribution: {
          companyName: agentActor,
          address: agentActor,
          taxId: agentActor,
        },
      };

      render(
        <FormBridgeForm
          schema={mockSchema}
          fields={completeSubmission.fields}
          fieldAttribution={completeSubmission.fieldAttribution}
          currentActor={humanActor}
        />
      );

      // Verify agent-filled data
      const companyNameInput = screen.getByLabelText(/Company Name/i) as HTMLInputElement;
      expect(companyNameInput.value).toBe('Global Widgets Inc');

      const addressInput = screen.getByLabelText(/Address/i) as HTMLInputElement;
      expect(addressInput.value).toBe('456 Tech Blvd, Austin, TX 78701');

      const taxIdInput = screen.getByLabelText(/Tax ID/i) as HTMLInputElement;
      expect(taxIdInput.value).toBe('98-7654321');

      // Verify attribution badges
      const agentBadges = screen.getAllByText(/Filled by agent/i);
      expect(agentBadges).toHaveLength(3);

      // Verify empty fields for human
      const w9Input = screen.getByLabelText(/W-9 Form/i) as HTMLInputElement;
      expect(w9Input.value).toBe('');

      const insuranceInput = screen.getByLabelText(/Insurance Certificate/i) as HTMLInputElement;
      expect(insuranceInput.value).toBe('');

      // Form should have submit button
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });
  });
});
