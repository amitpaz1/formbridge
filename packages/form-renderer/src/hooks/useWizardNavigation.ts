/**
 * useWizardNavigation — React hook for multi-step wizard form navigation.
 */

import { useState, useCallback, useMemo } from "react";
import {
  getVisibleSteps,
  getNextStep,
  getPreviousStep,
  validateStep,
  type StepDefinition,
  type StepFieldSchema,
  type StepValidationResult,
} from "../../../../src/core/step-validator.js";

export interface WizardNavigationState {
  /** Current step index (0-based) */
  currentIndex: number;
  /** Current step definition */
  currentStep: StepDefinition;
  /** All visible steps */
  visibleSteps: StepDefinition[];
  /** Completed step IDs */
  completedSteps: Set<string>;
  /** Total number of visible steps */
  totalSteps: number;
  /** Whether on the first step */
  isFirst: boolean;
  /** Whether on the last step */
  isLast: boolean;
  /** Progress percentage (0-100) */
  progress: number;
}

export interface WizardNavigationActions {
  /** Go to next step (validates current step first) */
  next: () => StepValidationResult | null;
  /** Go to previous step */
  previous: () => void;
  /** Go to a specific step by ID */
  goToStep: (stepId: string) => void;
  /** Validate the current step */
  validateCurrentStep: () => StepValidationResult;
  /** Mark a step as completed */
  markCompleted: (stepId: string) => void;
}

export function useWizardNavigation(
  steps: StepDefinition[],
  formValues: Record<string, unknown>,
  fieldSchemas: Record<string, StepFieldSchema>
): [WizardNavigationState, WizardNavigationActions] {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const visibleSteps = useMemo(
    () => getVisibleSteps(steps, formValues),
    [steps, formValues]
  );

  const currentStep = visibleSteps[currentIndex] ?? visibleSteps[0];

  const state: WizardNavigationState = {
    currentIndex,
    currentStep,
    visibleSteps,
    completedSteps,
    totalSteps: visibleSteps.length,
    isFirst: currentIndex === 0,
    isLast: currentIndex === visibleSteps.length - 1,
    progress:
      visibleSteps.length > 0
        ? Math.round(((currentIndex + 1) / visibleSteps.length) * 100)
        : 0,
  };

  const validateCurrentStep = useCallback((): StepValidationResult => {
    return validateStep(currentStep, formValues, fieldSchemas);
  }, [currentStep, formValues, fieldSchemas]);

  const next = useCallback((): StepValidationResult | null => {
    const result = validateCurrentStep();
    if (!result.valid) return result;

    setCompletedSteps((prev) => new Set(prev).add(currentStep.id));

    const nextStep = getNextStep(steps, currentStep.id, formValues);
    if (nextStep) {
      const nextIndex = visibleSteps.findIndex((s) => s.id === nextStep.id);
      if (nextIndex >= 0) setCurrentIndex(nextIndex);
    }
    return null;
  }, [validateCurrentStep, currentStep, steps, formValues, visibleSteps]);

  const previous = useCallback(() => {
    const prevStep = getPreviousStep(steps, currentStep.id, formValues);
    if (prevStep) {
      const prevIndex = visibleSteps.findIndex((s) => s.id === prevStep.id);
      if (prevIndex >= 0) setCurrentIndex(prevIndex);
    }
  }, [currentStep, steps, formValues, visibleSteps]);

  const goToStep = useCallback(
    (stepId: string) => {
      const index = visibleSteps.findIndex((s) => s.id === stepId);
      if (index >= 0) setCurrentIndex(index);
    },
    [visibleSteps]
  );

  const markCompleted = useCallback((stepId: string) => {
    setCompletedSteps((prev) => new Set(prev).add(stepId));
  }, []);

  const actions: WizardNavigationActions = {
    next,
    previous,
    goToStep,
    validateCurrentStep,
    markCompleted,
  };

  return [state, actions];
}
