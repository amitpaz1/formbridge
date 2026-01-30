/**
 * EventTimeline — Displays a chronological list of events for a submission.
 */

import { createElement } from "react";
import type { EventRecord } from "../api/client.js";

export interface EventTimelineProps {
  events: EventRecord[];
  className?: string;
}

export function EventTimeline({ events, className }: EventTimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  return createElement(
    "div",
    {
      className: `fb-timeline ${className ?? ""}`.trim(),
      role: "list",
      "aria-label": "Event timeline",
    },
    sorted.map((event) =>
      createElement(
        "div",
        {
          key: event.eventId,
          className: "fb-timeline__item",
          role: "listitem",
        },
        createElement(
          "div",
          { className: "fb-timeline__marker" },
          createElement("span", {
            className: "fb-timeline__dot",
            style: {
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: getEventColor(event.type),
            },
          })
        ),
        createElement(
          "div",
          { className: "fb-timeline__content" },
          createElement(
            "div",
            { className: "fb-timeline__type" },
            event.type
          ),
          createElement(
            "div",
            { className: "fb-timeline__meta" },
            `${formatDate(event.ts)} · ${event.actor.type}${event.actor.id ? ` (${event.actor.id})` : ""}`
          ),
          event.version != null &&
            createElement(
              "span",
              { className: "fb-timeline__version" },
              `v${event.version}`
            )
        )
      )
    )
  );
}

function getEventColor(type: string): string {
  if (type.includes("created") || type.includes("started")) return "#3b82f6";
  if (type.includes("completed") || type.includes("approved") || type.includes("succeeded"))
    return "#10b981";
  if (type.includes("rejected") || type.includes("failed")) return "#ef4444";
  if (type.includes("updated")) return "#f59e0b";
  return "#6b7280";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}
