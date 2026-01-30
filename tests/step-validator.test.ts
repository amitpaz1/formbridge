/**
 * Step Validator Tests
 */

import { describe, it, expect } from "vitest";
import {
  validateStep,
  isStepVisible,
  getVisibleSteps,
  getNextStep,
  getPreviousStep,
  type StepDefinition,
  type StepFieldSchema,
} from "../src/core/step-validator";

const personalInfoStep: StepDefinition = {
  id: "personal-info",
  title: "Personal Information",
  fields: ["name", "email", "phone"],
};

const businessInfoStep: StepDefinition = {
  id: "business-info",
  title: "Business Information",
  fields: ["companyName", "taxId"],
  conditions: [
    { when: "accountType", operator: "eq", value: "business", effect: "visible" },
  ],
};

const reviewStep: StepDefinition = {
  id: "review",
  title: "Review & Submit",
  fields: [],
};

const allSteps: StepDefinition[] = [personalInfoStep, businessInfoStep, reviewStep];

const fieldSchemas: Record<string, StepFieldSchema> = {
  name: { required: true, type: "string" },
  email: { required: true, type: "string" },
  phone: { required: false, type: "string" },
  companyName: { required: true, type: "string" },
  taxId: { required: true, type: "string" },
};

describe("Step Validator", () => {
  describe("validateStep", () => {
    it("should validate step with all required fields present", () => {
      const fields = { name: "Alice", email: "alice@test.com", phone: "555-1234" };
      const result = validateStep(personalInfoStep, fields, fieldSchemas);
      expect(result.valid).toBe(true);
      expect(result.stepId).toBe("personal-info");
      expect(result.errors).toHaveLength(0);
    });

    it("should fail validation for missing required fields", () => {
      const fields = { name: "Alice" }; // missing email
      const result = validateStep(personalInfoStep, fields, fieldSchemas);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
    });

    it("should not require optional fields", () => {
      const fields = { name: "Alice", email: "alice@test.com" }; // phone is optional
      const result = validateStep(personalInfoStep, fields, fieldSchemas);
      expect(result.valid).toBe(true);
    });

    it("should skip hidden fields based on conditions", () => {
      const conditionalSchemas: Record<string, StepFieldSchema> = {
        name: { required: true },
        email: {
          required: true,
          conditions: [
            { when: "contactMethod", operator: "eq", value: "email", effect: "visible" },
          ],
        },
      };

      const step: StepDefinition = {
        id: "contact",
        title: "Contact",
        fields: ["name", "email"],
      };

      // Email hidden because contactMethod is not "email"
      const fields = { name: "Alice", contactMethod: "phone" };
      const result = validateStep(step, fields, conditionalSchemas);
      expect(result.valid).toBe(true); // email not required because it's hidden
    });

    it("should treat empty string as missing for required fields", () => {
      const fields = { name: "", email: "alice@test.com" };
      const result = validateStep(personalInfoStep, fields, fieldSchemas);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("name");
      expect(result.errors[0].type).toBe("missing");
    });
  });

  describe("isStepVisible", () => {
    it("should return true for steps with no conditions", () => {
      expect(isStepVisible(personalInfoStep, {})).toBe(true);
    });

    it("should evaluate step visibility conditions", () => {
      expect(isStepVisible(businessInfoStep, { accountType: "business" })).toBe(true);
      expect(isStepVisible(businessInfoStep, { accountType: "personal" })).toBe(false);
    });
  });

  describe("getVisibleSteps", () => {
    it("should filter out hidden steps", () => {
      const visible = getVisibleSteps(allSteps, { accountType: "personal" });
      expect(visible.length).toBe(2);
      expect(visible.map((s) => s.id)).toEqual(["personal-info", "review"]);
    });

    it("should include all steps when conditions are met", () => {
      const visible = getVisibleSteps(allSteps, { accountType: "business" });
      expect(visible.length).toBe(3);
    });
  });

  describe("getNextStep", () => {
    it("should return the next visible step", () => {
      const next = getNextStep(allSteps, "personal-info", { accountType: "business" });
      expect(next?.id).toBe("business-info");
    });

    it("should skip hidden steps", () => {
      const next = getNextStep(allSteps, "personal-info", { accountType: "personal" });
      expect(next?.id).toBe("review");
    });

    it("should return null for last step", () => {
      const next = getNextStep(allSteps, "review", {});
      expect(next).toBeNull();
    });
  });

  describe("getPreviousStep", () => {
    it("should return the previous visible step", () => {
      const prev = getPreviousStep(allSteps, "business-info", { accountType: "business" });
      expect(prev?.id).toBe("personal-info");
    });

    it("should skip hidden steps when going back", () => {
      const prev = getPreviousStep(allSteps, "review", { accountType: "personal" });
      expect(prev?.id).toBe("personal-info");
    });

    it("should return null for first step", () => {
      const prev = getPreviousStep(allSteps, "personal-info", {});
      expect(prev).toBeNull();
    });
  });
});
