/**
 * WizardForm — Multi-step wizard form component.
 *
 * Renders a step-by-step form with navigation, progress indicator,
 * and per-step validation.
 */

import React from "react";
import type { StepDefinition, StepFieldSchema } from "../core/step-validator.js";
import { useWizardNavigation } from "../hooks/useWizardNavigation.js";
import { StepIndicator } from "./StepIndicator.js";

export interface WizardFormProps {
  steps: StepDefinition[];
  formValues: Record<string, unknown>;
  fieldSchemas: Record<string, StepFieldSchema>;
  onStepChange?: (stepId: string) => void;
  onStepComplete?: (stepId: string) => void;
  onComplete?: () => void;
  renderStep: (step: StepDefinition, errors: Array<{ field: string; message: string }>) => React.ReactNode;
  className?: string;
}

export function WizardForm({
  steps,
  formValues,
  fieldSchemas,
  onStepChange,
  onStepComplete,
  onComplete,
  renderStep,
  className,
}: WizardFormProps): React.ReactElement {
  const [state, actions] = useWizardNavigation(steps, formValues, fieldSchemas);
  const [errors, setErrors] = React.useState<Array<{ field: string; message: string }>>([]);

  const handleNext = () => {
    const result = actions.next();
    if (result) {
      // Validation failed
      setErrors(result.errors.map((e) => ({ field: e.field, message: e.message })));
    } else {
      setErrors([]);
      if (state.currentStep) {
        onStepComplete?.(state.currentStep.id);
      }
      if (state.isLast) {
        onComplete?.();
      } else {
        const nextStep = state.visibleSteps[state.currentIndex + 1];
        if (nextStep) onStepChange?.(nextStep.id);
      }
    }
  };

  const handlePrevious = () => {
    setErrors([]);
    actions.previous();
    const prevStep = state.visibleSteps[state.currentIndex - 1];
    if (prevStep) onStepChange?.(prevStep.id);
  };

  return React.createElement(
    "div",
    { className: `formbridge-wizard ${className ?? ""}`.trim() },
    React.createElement(StepIndicator, {
      steps: state.visibleSteps,
      currentStepId: state.currentStep?.id,
      completedSteps: state.completedSteps,
    }),
    React.createElement(
      "div",
      { className: "formbridge-wizard__content" },
      state.currentStep
        ? renderStep(state.currentStep, errors)
        : null
    ),
    React.createElement(
      "div",
      { className: "formbridge-wizard__nav" },
      !state.isFirst &&
        React.createElement(
          "button",
          {
            type: "button",
            className: "formbridge-wizard__btn formbridge-wizard__btn--prev",
            onClick: handlePrevious,
          },
          "Previous"
        ),
      React.createElement(
        "button",
        {
          type: "button",
          className: "formbridge-wizard__btn formbridge-wizard__btn--next",
          onClick: handleNext,
        },
        state.isLast ? "Submit" : "Next"
      )
    )
  );
}
