/**
 * Layout — Dashboard shell with sidebar navigation and main content area.
 */

import { createElement, type ReactNode } from "react";
import { NAV_ITEMS } from "./nav-items.js";
export type { NavItem } from "./nav-items.js";
export { NAV_ITEMS } from "./nav-items.js";

export interface LayoutProps {
  currentPath: string;
  children: ReactNode;
  onNavigate: (path: string) => void;
}

export function Layout({ currentPath, children, onNavigate }: LayoutProps) {
  return createElement(
    "div",
    { className: "fb-layout" },
    // Sidebar
    createElement(
      "nav",
      {
        className: "fb-layout__sidebar",
        role: "navigation",
        "aria-label": "Dashboard navigation",
      },
      createElement(
        "div",
        { className: "fb-layout__brand" },
        "FormBridge"
      ),
      createElement(
        "ul",
        { className: "fb-layout__nav" },
        NAV_ITEMS.map((item) =>
          createElement(
            "li",
            { key: item.id },
            createElement(
              "a",
              {
                href: item.path,
                className: `fb-layout__link ${
                  currentPath === item.path ? "fb-layout__link--active" : ""
                }`,
                "aria-current":
                  currentPath === item.path ? "page" : undefined,
                onClick: (e: Event) => {
                  e.preventDefault();
                  onNavigate(item.path);
                },
              },
              item.label
            )
          )
        )
      )
    ),
    // Main content
    createElement(
      "main",
      { className: "fb-layout__main" },
      children
    )
  );
}
