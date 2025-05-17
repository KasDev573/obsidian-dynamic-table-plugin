/**
 * types.ts
 *
 * Defines TypeScript types used throughout the Dynamic Tables plugin.
 * These types describe the structure of table data, configuration options,
 * formatting functions, and internal state representations.
 *
 * This file centralizes type definitions for better type safety,
 * code clarity, and maintainability.
 */

// Represents the raw data extracted from an HTML table:
// - columns: an array of column headers (strings)
// - rows: a 2D array of strings for each row's cell content
// - rowDirections: an array indicating text alignment (e.g., 'left', 'center', 'right') or null for each column
export type RawTableData = {
  columns: string[];
  rows: string[][];
  rowDirections: (string | null)[];
};

// Type of a function that formats a cell value for display,
// taking the raw cell, the whole row, and a context object as inputs
export type CellValueFormatter = (cell: any, row: any, ctx: any) => any;

// Allowed types for columns in the table configuration
export type EtConfigurationColumnType =
  | 'string'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'time'
  | 'enum';

// Pagination settings used in the configuration
export type EtConfigurationPagination = {
  'page-size': number;
  'page-sizes'?: number[];
};

// Configuration options for the dynamic table, derived from YAML or user input.
// Includes column configs, formatting options, filters, sorting, pagination,
// UI control toggles, and styling preferences.
export type EtConfiguration = {
  columns?: Record<string, EtConfigurationColumn>;
  editable?: boolean;
  'date-format'?: string;
  'datetime-format'?: string;
  'yes-format'?: string;
  'no-format'?: string;
  filter?: string;
  filters?: Record<string, string>;
  sort?: string;
  pagination?: EtConfigurationPagination;
  'hide-controls'?: boolean;
  'hide-configuration'?: boolean;
  style?: string;
  'fix-header'?: boolean;

  // UI control toggles to show/hide sort, search, filter controls
  controls?: {
    showSort?: boolean;
    showSearch?: boolean;
    showFilter?: boolean;
  };

  // UI styling enhancements such as zebra striping and hover effects
  styleEnhancements?: {
    zebraStriping?: boolean;
    rowHoverHighlight?: boolean;
  };
};

// Configuration for a single column in the table
export type EtConfigurationColumn = {
  alias?: string;            // Alternative display name for the column
  type?: EtConfigurationColumnType;
  editable?: boolean;        // Whether cells in this column are editable
  'date-format'?: string;
  'number-format'?: string;
  formatter?: string;        // A formatter expression/function as a string
  enum?: Record<string, string>; // Mapping for enum display values
  'yes-format'?: string;
  'no-format'?: string;
  hidden?: boolean;          // Whether this column is hidden
  nowrap?: boolean;          // Whether content should not wrap
  searchable?: boolean;      // Whether this column is searchable
};

// Pagination state to track current page, size, and allowed page size options
export type Pagination = {
  pageSize: number;
  pageNumber: number;
  pageSizes: number[];
};

// Internal representation of a data column with enriched metadata
// Extends EtConfigurationColumn but adds required properties and methods for runtime use
export type EtDataColumn = Omit<
  EtConfigurationColumn,
  | 'date-format'
  | 'bool'
  | 'yes-format'
  | 'no-format'
  | 'number-format'
  | 'formatter'
> & {
  name: string;                      // Column header name
  index: number;                    // Column position index
  dateFormat: string;               // Date format string if applicable
  numberFormat: Record<string, any>;// Number format options
  yesFormat: string;                // String to display for boolean true
  noFormat: string;                 // String to display for boolean false
  formatter: CellValueFormatter;   // Formatter function for this column
  el: HTMLTableCellElement;         // Reference to the corresponding HTML <td> element
};

// Internal representation of a data cell, linking its raw and formatted content,
// the column metadata, and its corresponding HTML element
export type EtDataCell = {
  el: HTMLTableCellElement;
  column: EtDataColumn;
  rawValue: string;    // Raw content string from the table
  value: any;          // Parsed/processed value for logic and display
  formattedValue: any; // Final formatted output for display
};

// Internal representation of a data row,
// including ordered cells and convenient access to cell values by column alias or name
export type EtDataRow = {
  index: number;                // Row index within the table
  el: HTMLTableElement;         // Reference to the HTML <tr> element
  cells: Record<string, EtDataCell>; // Map of cells keyed by column name
  orderedCells: EtDataCell[];   // Array of cells in column order
} & Record<string, any>;        // Allow additional arbitrary properties for convenience

// Metadata for checkbox state persistence
export type CheckboxMeta = {
  checked: boolean;
  rowIndex: number;
  column: string;
};
