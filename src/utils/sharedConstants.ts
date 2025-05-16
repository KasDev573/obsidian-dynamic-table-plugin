/**
 * sharedConstants.ts
 *
 * Defines constant values and strings used across the Dynamic Tables plugin.
 * These constants include signals for YAML detection, custom HTML attributes
 * for marking elements related to dynamic tables, and default formatting values
 * for various data types and UI elements such as pagination and boolean displays.
 */

// Signal string that tells the plugin to look for a YAML config block
export const ET_YAML_SIGNAL = '```yaml dynamic-table';

// HTML data attributes used to identify plugin-related elements in the DOM
export const ET_RENDER_TABLE_ATTRIBUTE = 'data-dt-table';
export const ET_CONFIGURATION_CODE_ATTRIBUTE = 'data-dt-configuration';
export const ET_CONFIGURATION_CODE_EL_ATTRIBUTE = 'data-dt-configuration-code';

// Default types and formats for table columns and cells
export const DEFAULT_COLUMNS_TYPE = 'string';
export const DEFAULT_NUMBER_FORMAT = {};
export const DEFAULT_DATE_FORMAT = 'DD-MM-YYYY';
export const DEFAULT_DATE_TIME_FORMAT = 'DD-MM-YYYY HH:mm';
export const DEFAULT_TIME_FORMAT = 'HH:mm';

// Default inputs and formats for boolean cell values
export const DEFAULT_BOOL_YES_INPUT = '1';
export const DEFAULT_BOOL_NO_INPUT = '0';
export const DEFAULT_BOOL_YES_FORMAT = '✔️';
export const DEFAULT_BOOL_NO_FORMAT = '✖️';

// Pagination defaults for page size and page size options dropdown
export const DEFAULT_PAGE_SIZE = 25;
export const DEFAULT_PAGES_SIZE_OPTIONS = [25, 50, 100];
