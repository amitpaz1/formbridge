/**
 * Condition Evaluator Tests
 *
 * Tests the isomorphic condition evaluator for:
 * - All operators (eq, neq, in, notIn, gt, gte, lt, lte, exists, notExists, matches)
 * - Composite conditions (AND, OR)
 * - Nested field paths
 * - Condition effects (visible, required, validation)
 * - Circular dependency detection
 * - Edge cases
 */

import { describe, it, expect } from "vitest";
import {
  evaluateFieldCondition,
  evaluateCompositeCondition,
  evaluateCondition,
  evaluateConditions,
  detectCircularConditions,
  getFieldValue,
  type FieldCondition,
  type CompositeCondition,
} from "../src/core/condition-evaluator";

describe("Condition Evaluator", () => {
  describe("getFieldValue", () => {
    it("should get top-level values", () => {
      expect(getFieldValue({ name: "Alice" }, "name")).toBe("Alice");
    });

    it("should get nested values with dot notation", () => {
      const fields = { address: { city: "NYC", zip: "10001" } };
      expect(getFieldValue(fields, "address.city")).toBe("NYC");
    });

    it("should return undefined for missing paths", () => {
      expect(getFieldValue({}, "missing")).toBeUndefined();
      expect(getFieldValue({ a: {} }, "a.b.c")).toBeUndefined();
    });

    it("should handle null intermediate values", () => {
      expect(getFieldValue({ a: null }, "a.b")).toBeUndefined();
    });
  });

  describe("Operator: eq", () => {
    it("should match equal values", () => {
      const cond: FieldCondition = { when: "status", operator: "eq", value: "active", effect: "visible" };
      expect(evaluateFieldCondition(cond, { status: "active" })).toBe(true);
      expect(evaluateFieldCondition(cond, { status: "inactive" })).toBe(false);
    });

    it("should handle numeric equality", () => {
      const cond: FieldCondition = { when: "count", operator: "eq", value: 5, effect: "visible" };
      expect(evaluateFieldCondition(cond, { count: 5 })).toBe(true);
      expect(evaluateFieldCondition(cond, { count: 6 })).toBe(false);
    });

    it("should handle boolean equality", () => {
      const cond: FieldCondition = { when: "enabled", operator: "eq", value: true, effect: "visible" };
      expect(evaluateFieldCondition(cond, { enabled: true })).toBe(true);
      expect(evaluateFieldCondition(cond, { enabled: false })).toBe(false);
    });
  });

  describe("Operator: neq", () => {
    it("should match non-equal values", () => {
      const cond: FieldCondition = { when: "status", operator: "neq", value: "draft", effect: "visible" };
      expect(evaluateFieldCondition(cond, { status: "active" })).toBe(true);
      expect(evaluateFieldCondition(cond, { status: "draft" })).toBe(false);
    });
  });

  describe("Operator: in", () => {
    it("should match values in array", () => {
      const cond: FieldCondition = { when: "role", operator: "in", value: ["admin", "editor"], effect: "visible" };
      expect(evaluateFieldCondition(cond, { role: "admin" })).toBe(true);
      expect(evaluateFieldCondition(cond, { role: "viewer" })).toBe(false);
    });

    it("should return false for non-array value", () => {
      const cond: FieldCondition = { when: "role", operator: "in", value: "admin", effect: "visible" };
      expect(evaluateFieldCondition(cond, { role: "admin" })).toBe(false);
    });
  });

  describe("Operator: notIn", () => {
    it("should match values not in array", () => {
      const cond: FieldCondition = { when: "role", operator: "notIn", value: ["banned", "suspended"], effect: "visible" };
      expect(evaluateFieldCondition(cond, { role: "active" })).toBe(true);
      expect(evaluateFieldCondition(cond, { role: "banned" })).toBe(false);
    });
  });

  describe("Operator: gt", () => {
    it("should compare numbers", () => {
      const cond: FieldCondition = { when: "amount", operator: "gt", value: 100, effect: "visible" };
      expect(evaluateFieldCondition(cond, { amount: 150 })).toBe(true);
      expect(evaluateFieldCondition(cond, { amount: 100 })).toBe(false);
      expect(evaluateFieldCondition(cond, { amount: 50 })).toBe(false);
    });

    it("should return false for non-numeric values", () => {
      const cond: FieldCondition = { when: "amount", operator: "gt", value: 100, effect: "visible" };
      expect(evaluateFieldCondition(cond, { amount: "150" })).toBe(false);
    });
  });

  describe("Operator: gte", () => {
    it("should compare with greater-than-or-equal", () => {
      const cond: FieldCondition = { when: "age", operator: "gte", value: 18, effect: "visible" };
      expect(evaluateFieldCondition(cond, { age: 18 })).toBe(true);
      expect(evaluateFieldCondition(cond, { age: 21 })).toBe(true);
      expect(evaluateFieldCondition(cond, { age: 17 })).toBe(false);
    });
  });

  describe("Operator: lt", () => {
    it("should compare with less-than", () => {
      const cond: FieldCondition = { when: "price", operator: "lt", value: 50, effect: "visible" };
      expect(evaluateFieldCondition(cond, { price: 30 })).toBe(true);
      expect(evaluateFieldCondition(cond, { price: 50 })).toBe(false);
    });
  });

  describe("Operator: lte", () => {
    it("should compare with less-than-or-equal", () => {
      const cond: FieldCondition = { when: "price", operator: "lte", value: 50, effect: "visible" };
      expect(evaluateFieldCondition(cond, { price: 50 })).toBe(true);
      expect(evaluateFieldCondition(cond, { price: 51 })).toBe(false);
    });
  });

  describe("Operator: exists", () => {
    it("should check field existence", () => {
      const cond: FieldCondition = { when: "email", operator: "exists", effect: "visible" };
      expect(evaluateFieldCondition(cond, { email: "test@test.com" })).toBe(true);
      expect(evaluateFieldCondition(cond, {})).toBe(false);
      expect(evaluateFieldCondition(cond, { email: null })).toBe(false);
    });
  });

  describe("Operator: notExists", () => {
    it("should check field non-existence", () => {
      const cond: FieldCondition = { when: "deletedAt", operator: "notExists", effect: "visible" };
      expect(evaluateFieldCondition(cond, {})).toBe(true);
      expect(evaluateFieldCondition(cond, { deletedAt: null })).toBe(true);
      expect(evaluateFieldCondition(cond, { deletedAt: "2024-01-01" })).toBe(false);
    });
  });

  describe("Operator: matches", () => {
    it("should match regex patterns", () => {
      const cond: FieldCondition = { when: "email", operator: "matches", value: "^[^@]+@[^@]+$", effect: "visible" };
      expect(evaluateFieldCondition(cond, { email: "test@test.com" })).toBe(true);
      expect(evaluateFieldCondition(cond, { email: "invalid" })).toBe(false);
    });

    it("should return false for non-string values", () => {
      const cond: FieldCondition = { when: "email", operator: "matches", value: ".*", effect: "visible" };
      expect(evaluateFieldCondition(cond, { email: 123 })).toBe(false);
    });

    it("should handle invalid regex gracefully", () => {
      const cond: FieldCondition = { when: "val", operator: "matches", value: "[invalid", effect: "visible" };
      expect(evaluateFieldCondition(cond, { val: "test" })).toBe(false);
    });
  });

  describe("Composite Conditions", () => {
    it("should evaluate AND logic", () => {
      const cond: CompositeCondition = {
        logic: "and",
        conditions: [
          { when: "age", operator: "gte", value: 18, effect: "visible" },
          { when: "country", operator: "eq", value: "US", effect: "visible" },
        ],
        effect: "visible",
      };

      expect(evaluateCompositeCondition(cond, { age: 21, country: "US" })).toBe(true);
      expect(evaluateCompositeCondition(cond, { age: 17, country: "US" })).toBe(false);
      expect(evaluateCompositeCondition(cond, { age: 21, country: "UK" })).toBe(false);
    });

    it("should evaluate OR logic", () => {
      const cond: CompositeCondition = {
        logic: "or",
        conditions: [
          { when: "role", operator: "eq", value: "admin", effect: "visible" },
          { when: "role", operator: "eq", value: "editor", effect: "visible" },
        ],
        effect: "visible",
      };

      expect(evaluateCompositeCondition(cond, { role: "admin" })).toBe(true);
      expect(evaluateCompositeCondition(cond, { role: "editor" })).toBe(true);
      expect(evaluateCompositeCondition(cond, { role: "viewer" })).toBe(false);
    });

    it("should evaluate nested composite conditions", () => {
      const cond: CompositeCondition = {
        logic: "and",
        conditions: [
          { when: "type", operator: "eq", value: "business", effect: "visible" },
          {
            logic: "or",
            conditions: [
              { when: "size", operator: "gt", value: 100, effect: "visible" },
              { when: "revenue", operator: "gt", value: 1000000, effect: "visible" },
            ],
            effect: "visible",
          },
        ],
        effect: "visible",
      };

      expect(evaluateCondition(cond, { type: "business", size: 200, revenue: 500000 })).toBe(true);
      expect(evaluateCondition(cond, { type: "business", size: 50, revenue: 2000000 })).toBe(true);
      expect(evaluateCondition(cond, { type: "personal", size: 200, revenue: 2000000 })).toBe(false);
      expect(evaluateCondition(cond, { type: "business", size: 50, revenue: 500000 })).toBe(false);
    });
  });

  describe("evaluateConditions (full field evaluation)", () => {
    it("should return defaults when no conditions", () => {
      const result = evaluateConditions(undefined, {}, true);
      expect(result.visible).toBe(true);
      expect(result.required).toBe(true);
      expect(result.validationEnabled).toBe(true);
    });

    it("should hide field when visibility condition fails", () => {
      const conditions: FieldCondition[] = [
        { when: "type", operator: "eq", value: "business", effect: "visible" },
      ];

      const result = evaluateConditions(conditions, { type: "personal" }, true);
      expect(result.visible).toBe(false);
      expect(result.required).toBe(false); // hidden = not required
      expect(result.validationEnabled).toBe(false); // hidden = no validation
    });

    it("should make field required when required condition passes", () => {
      const conditions: FieldCondition[] = [
        { when: "amount", operator: "gt", value: 1000, effect: "required" },
      ];

      const result1 = evaluateConditions(conditions, { amount: 1500 }, false);
      expect(result1.required).toBe(true);

      const result2 = evaluateConditions(conditions, { amount: 500 }, false);
      expect(result2.required).toBe(false);
    });

    it("should control validation separately", () => {
      const conditions: FieldCondition[] = [
        { when: "skipValidation", operator: "eq", value: true, effect: "validation" },
      ];

      const result1 = evaluateConditions(conditions, { skipValidation: true }, true);
      expect(result1.validationEnabled).toBe(true);

      const result2 = evaluateConditions(conditions, { skipValidation: false }, true);
      expect(result2.validationEnabled).toBe(false);
    });
  });

  describe("Circular Dependency Detection", () => {
    it("should detect direct circular dependency", () => {
      const fieldConditions = {
        fieldA: [{ when: "fieldB", operator: "eq" as const, value: true, effect: "visible" as const }],
        fieldB: [{ when: "fieldA", operator: "eq" as const, value: true, effect: "visible" as const }],
      };

      const cycles = detectCircularConditions(fieldConditions);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it("should detect transitive circular dependency", () => {
      const fieldConditions = {
        fieldA: [{ when: "fieldB", operator: "exists" as const, effect: "visible" as const }],
        fieldB: [{ when: "fieldC", operator: "exists" as const, effect: "visible" as const }],
        fieldC: [{ when: "fieldA", operator: "exists" as const, effect: "visible" as const }],
      };

      const cycles = detectCircularConditions(fieldConditions);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it("should return empty for no circular dependencies", () => {
      const fieldConditions = {
        fieldA: [{ when: "fieldB", operator: "eq" as const, value: true, effect: "visible" as const }],
        fieldC: [{ when: "fieldB", operator: "eq" as const, value: true, effect: "visible" as const }],
      };

      const cycles = detectCircularConditions(fieldConditions);
      expect(cycles).toEqual([]);
    });

    it("should detect cycles in composite conditions", () => {
      const fieldConditions = {
        fieldA: [{
          logic: "and" as const,
          conditions: [
            { when: "fieldB", operator: "exists" as const, effect: "visible" as const },
          ],
          effect: "visible" as const,
        }],
        fieldB: [{ when: "fieldA", operator: "exists" as const, effect: "visible" as const }],
      };

      const cycles = detectCircularConditions(fieldConditions);
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty conditions array", () => {
      const result = evaluateConditions([], {});
      expect(result.visible).toBe(true);
    });

    it("should handle undefined field values", () => {
      const cond: FieldCondition = { when: "missing", operator: "eq", value: "test", effect: "visible" };
      expect(evaluateFieldCondition(cond, {})).toBe(false);
    });

    it("should handle unknown operator gracefully", () => {
      const cond = { when: "field", operator: "unknown" as any, value: "test", effect: "visible" as const };
      expect(evaluateFieldCondition(cond, { field: "test" })).toBe(false);
    });
  });
});
