/**
 * values.ts
 *
 * Contains utility functions for extracting and parsing raw cell values
 * from the table, converting them into appropriate JavaScript types
 * based on the column configuration.
 *
 * Supports parsing for number, boolean, and date/time types using moment.js,
 * as well as default string handling.
 */

import { moment } from 'obsidian';
import { EtDataColumn } from 'src/utils/types';

/**
 * Parses and extracts the typed value from a raw string value according
 * to the column's configured type and formatting.
 *
 * @param rawValue The raw string content from the table cell
 * @param column The column configuration describing the data type and formatting
 * @param dateFormat The expected date format string for parsing dates
 * @param yesFormat The string representation to interpret as boolean true
 * @returns The parsed value, which can be a number, boolean, moment date, or string
 */
export function extractValue(
  rawValue: string,
  column: EtDataColumn,
  dateFormat: string,
  yesFormat: string,
): any {
  switch (column.type) {
    case 'number':
      try {
        return Number(rawValue);
      } catch (e) {
        return null;
      }
    case 'bool':
      try {
        return rawValue === yesFormat;
      } catch (e) {
        return null;
      }
    case 'date':
    case 'datetime':
    case 'time':
      try {
        const parsedDate = moment(rawValue, dateFormat);

        if (!parsedDate.isValid()) {
          return null;
        }

        return parsedDate;
      } catch (e) {
        return null;
      }
    default:
      return rawValue;
  }
}
