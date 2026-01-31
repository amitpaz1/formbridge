/**
 * useConditions — React hook wrapping the isomorphic condition evaluator.
 *
 * Evaluates field conditions against current form values and returns
 * per-field visibility, required, and validation states.
 */

import { useMemo } from "react";
import {
  evaluateConditions,
  type Condition,
  type ConditionResult,
} from "../core/condition-evaluator.js";

export interface FieldConditionMap {
  [fieldPath: string]: {
    conditions?: Condition[];
    schemaRequired?: boolean;
  };
}

export interface ConditionResults {
  [fieldPath: string]: ConditionResult;
}

/**
 * Evaluate conditions for all fields against the current form values.
 *
 * @param fieldConditions - Map of field paths to their conditions and schema requirements
 * @param formValues - Current form field values
 * @returns Map of field paths to their evaluated condition results
 */
export function useConditions(
  fieldConditions: FieldConditionMap,
  formValues: Record<string, unknown>
): ConditionResults {
  return useMemo(() => {
    const results: ConditionResults = {};
    for (const [fieldPath, config] of Object.entries(fieldConditions)) {
      results[fieldPath] = evaluateConditions(
        config.conditions,
        formValues,
        config.schemaRequired ?? false
      );
    }
    return results;
  }, [fieldConditions, formValues]);
}
