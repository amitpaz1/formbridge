/**
 * StepIndicator — Visual progress indicator for multi-step wizard forms.
 */

import React from "react";
import type { StepDefinition } from "../core/step-validator.js";

export interface StepIndicatorProps {
  steps: StepDefinition[];
  currentStepId?: string;
  completedSteps: Set<string>;
  onGoToStep?: (stepId: string) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStepId,
  completedSteps,
  onGoToStep,
  className,
}: StepIndicatorProps): React.ReactElement {
  return React.createElement(
    "div",
    {
      className: `formbridge-steps ${className ?? ""}`.trim(),
      role: "navigation",
      "aria-label": "Form steps",
    },
    // Visible "Step N of M" text
    React.createElement(
      "span",
      {
        className: "formbridge-steps__counter",
      },
      currentStepId
        ? `Step ${steps.findIndex((s) => s.id === currentStepId) + 1} of ${steps.length}`
        : null
    ),
    steps.map((step, index) => {
      const isCurrent = step.id === currentStepId;
      const isCompleted = completedSteps.has(step.id);
      const status = isCurrent ? "current" : isCompleted ? "completed" : "pending";

      // Completed steps render as clickable buttons
      if (isCompleted && !isCurrent && onGoToStep) {
        return React.createElement(
          "button",
          {
            key: step.id,
            type: "button",
            className: `formbridge-steps__item formbridge-steps__item--${status} formbridge-steps__item--clickable`,
            "aria-label": `Go to step ${index + 1}: ${step.title} (completed)`,
            onClick: () => onGoToStep(step.id),
          },
          React.createElement(
            "span",
            { className: "formbridge-steps__number" },
            "\u2713"
          ),
          React.createElement(
            "span",
            { className: "formbridge-steps__title" },
            step.title
          )
        );
      }

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
