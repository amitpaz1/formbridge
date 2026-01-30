/**
 * StepIndicator — Visual progress indicator for multi-step wizard forms.
 */

import React from "react";
import type { StepDefinition } from "../../../../src/core/step-validator.js";

export interface StepIndicatorProps {
  steps: StepDefinition[];
  currentStepId?: string;
  completedSteps: Set<string>;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStepId,
  completedSteps,
  className,
}: StepIndicatorProps): React.ReactElement {
  return React.createElement(
    "div",
    {
      className: `formbridge-steps ${className ?? ""}`.trim(),
      role: "navigation",
      "aria-label": "Form steps",
    },
    steps.map((step, index) => {
      const isCurrent = step.id === currentStepId;
      const isCompleted = completedSteps.has(step.id);
      const status = isCurrent ? "current" : isCompleted ? "completed" : "pending";

      return React.createElement(
        "div",
        {
          key: step.id,
          className: `formbridge-steps__item formbridge-steps__item--${status}`,
          "aria-current": isCurrent ? "step" : undefined,
        },
        React.createElement(
          "span",
          { className: "formbridge-steps__number" },
          isCompleted ? "\u2713" : String(index + 1)
        ),
        React.createElement(
          "span",
          { className: "formbridge-steps__title" },
          step.title
        )
      );
    })
  );
}
