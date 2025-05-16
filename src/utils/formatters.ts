/**
 * formatters.ts
 *
 * Contains utility functions to generate cell value formatters for table columns,
 * as well as parsing formatting options for numbers.
 *
 * Responsibilities include:
 * - Creating dynamic formatting functions based on column type or custom formatter string
 * - Parsing number format strings into formatting option objects for JavaScript Intl API
 */

import { EtDataColumn, CellValueFormatter } from 'src/utils/types';

/**
 * Creates a formatter function for a given column based on its type or
 * a custom formatter string expression.
 *
 * @param column The column metadata including type and formatting options
 * @param formatter Optional string expression for custom formatting
 * @returns A function that formats a cell value according to the column's rules
 */
export function makeFormatterForColumn(
  column: EtDataColumn,
  formatter?: string,
): CellValueFormatter {
  if (formatter) {
    try {
      // Create a new function from the formatter string
      const fn = new Function('$cell', '$row', '$ctx', `return ${formatter}`);
      return (cell, row, ctx) => {
        try {
          return fn(cell, row, ctx);
        } catch {
          return cell; // fallback to raw value on error
        }
      };
    } catch {
      // fallback to raw value if creating function fails
      return (cell) => cell;
    }
  }

  // Default formatters by column type
  switch (column.type) {
    case 'number':
      return (val) => {
        try {
          return val.toLocaleString(undefined, column.numberFormat);
        } catch {
          return val;
        }
      };
    case 'bool':
      return (val) => {
        try {
          return val ? column.yesFormat : column.noFormat;
        } catch {
          return val;
        }
      };
    case 'date':
    case 'datetime':
    case 'time':
      return (val) => {
        try {
          return val.format(column.dateFormat);
        } catch {
          return val;
        }
      };
    case 'enum':
      return (val) => {
        try {
          return (column.enum ?? {})[val] ?? val;
        } catch {
          return val;
        }
      };
    default:
      return (val) => val;
  }
}

/**
 * Parses a number format string into an object that can be passed
 * as options to JavaScript's toLocaleString or Intl.NumberFormat.
 *
 * @param format The format string (e.g. "style: 'currency', currency: 'USD'")
 * @param defaultFormat The fallback format object if parsing fails
 * @returns Parsed format object or the defaultFormat on failure
 */
export function parseNumberFormat(
  format: string,
  defaultFormat: Record<string, any>,
): Record<string, any> {
  try {
    const fn = new Function(`return ({${format}})`);
    return fn();
  } catch {
    return defaultFormat;
  }
}
