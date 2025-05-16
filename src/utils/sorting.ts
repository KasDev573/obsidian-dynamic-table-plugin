/**
 * sorting.ts
 *
 * Provides sorting utility functions for Dynamic Tables plugin.
 * It exports a function to generate a comparison function (SortFunction)
 * based on the sort field and column definitions. Supports sorting
 * by numbers, booleans, dates, times, and strings, with support for ascending
 * and descending order.
 */

import { EtDataColumn } from 'src/utils/types';

// Type for a sorting comparison function, accepting two values and returning a number
export type SortFunction = (a: any, b: any) => number;

/**
 * Returns a sorting comparison function for the specified sort field based on the
 * column configuration. Supports ascending and descending sorting by
 * number, boolean, date/time, and string.
 *
 * @param sortField - The field name to sort by. Prefix '-' indicates descending order.
 * @param columns - Array of column definitions to find column metadata.
 * @returns A comparator function (a, b) => number or null if column not found.
 */
export function getSortingFunction(
  sortField: string,
  columns: EtDataColumn[],
): SortFunction | null {
  // Determine if sorting descending by checking for '-' prefix
  const desc = sortField.startsWith('-');
  if (desc) {
    sortField = sortField.slice(1);
  }

  // Find the matching column by alias (field name)
  const column = columns.find((c) => c.alias === sortField);

  if (!column) {
    return null;
  }

  // Return appropriate comparator function based on column type and order
  switch (column.type) {
    case 'number':
    case 'bool':
      if (desc) {
        return (a, b) => (b ?? 0) - (a ?? 0);
      }
      return (a, b) => (a ?? 0) - (b ?? 0);

    case 'date':
    case 'datetime':
    case 'time':
      if (desc) {
        return (a, b) => {
          if (!a && !b) return 0;
          if (!a) return -1;
          if (!b) return 1;
          return b.diff(a);
        };
      }
      return (a, b) => {
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return a.diff(b);
      };

    default:
      if (desc) {
        return (a, b) => (b ?? '').localeCompare(a ?? '');
      }
      return (a, b) => (a ?? '').localeCompare(b ?? '');
  }
}
