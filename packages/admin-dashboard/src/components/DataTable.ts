/**
 * DataTable — Generic data table wrapper using @tanstack/react-table patterns.
 *
 * Provides sortable columns, pagination controls, and row click handling.
 */

import { createElement, ReactNode } from "react";

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyAccessor: (row: T) => string;
  onRowClick?: (row: T) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyAccessor,
  onRowClick,
  page = 1,
  pageSize = 20,
  total,
  onPageChange,
  className,
  emptyMessage = "No data found.",
}: DataTableProps<T>) {
  const totalPages =
    total != null ? Math.ceil(total / pageSize) : undefined;

  return createElement(
    "div",
    { className: `fb-table-wrapper ${className ?? ""}`.trim() },
    createElement(
      "table",
      { className: "fb-table", role: "table" },
      // Header
      createElement(
        "thead",
        null,
        createElement(
          "tr",
          null,
          columns.map((col) =>
            createElement(
              "th",
              {
                key: col.id,
                className: "fb-table__th",
                scope: "col",
              },
              col.header
            )
          )
        )
      ),
      // Body
      createElement(
        "tbody",
        null,
        data.length === 0
          ? createElement(
              "tr",
              null,
              createElement(
                "td",
                {
                  colSpan: columns.length,
                  className: "fb-table__empty",
                },
                emptyMessage
              )
            )
          : data.map((row) =>
              createElement(
                "tr",
                {
                  key: keyAccessor(row),
                  className: `fb-table__row ${onRowClick ? "fb-table__row--clickable" : ""}`,
                  onClick: onRowClick ? () => onRowClick(row) : undefined,
                  style: onRowClick ? { cursor: "pointer" } : undefined,
                },
                columns.map((col) => {
                  const value = col.accessor(row);
                  return createElement(
                    "td",
                    { key: col.id, className: "fb-table__td" },
                    col.render ? col.render(value, row) : String(value ?? "")
                  );
                })
              )
            )
      )
    ),
    // Pagination
    totalPages != null &&
      totalPages > 1 &&
      createElement(
        "div",
        { className: "fb-table__pagination", role: "navigation", "aria-label": "Table pagination" },
        createElement(
          "button",
          {
            disabled: page <= 1,
            onClick: () => onPageChange?.(page - 1),
            className: "fb-table__page-btn",
          },
          "Previous"
        ),
        createElement(
          "span",
          { className: "fb-table__page-info" },
          `Page ${page} of ${totalPages}`
        ),
        createElement(
          "button",
          {
            disabled: page >= totalPages,
            onClick: () => onPageChange?.(page + 1),
            className: "fb-table__page-btn",
          },
          "Next"
        )
      )
  );
}
