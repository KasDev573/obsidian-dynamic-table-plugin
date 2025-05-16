/**
 * useDynamicTablesState Hook
 *
 * This hook manages the core state and logic for the dynamic tables plugin.
 * It processes table data and configuration, handling sorting, filtering,
 * searching, pagination, and checkbox state persistence to external JSON files.
 *
 * Responsibilities include:
 * - Parsing and indexing columns with proper formatting
 * - Building enriched rows from raw markdown data
 * - Managing checkbox state external storage and synchronization
 * - Applying sorting, filtering, and search functions on table rows
 * - Handling pagination and pagination state changes
 */

import {
  EtConfiguration,
  EtConfigurationColumn,
  EtDataCell,
  EtDataColumn,
  EtDataRow,
  Pagination,
  RawTableData,
} from 'src/utils/types';
import { useCallback, useMemo, useState } from 'react';

import {
  makeFormatterForColumn,
  parseNumberFormat,
} from 'src/utils/formatters';
import {
  DEFAULT_BOOL_NO_FORMAT,
  DEFAULT_BOOL_YES_FORMAT,
  DEFAULT_BOOL_YES_INPUT,
  DEFAULT_COLUMNS_TYPE,
  DEFAULT_DATE_FORMAT,
  DEFAULT_DATE_TIME_FORMAT,
  DEFAULT_NUMBER_FORMAT,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGES_SIZE_OPTIONS,
  DEFAULT_TIME_FORMAT,
} from 'src/utils/sharedConstants';
import { extractValue } from 'src/utils/values';
import { getSortingFunction } from 'src/utils/sorting';

import { PaginationOptions } from 'src/DynamicTables/components/PaginationView';
import { App, FileSystemAdapter, MarkdownView } from 'obsidian';
import { TableManager } from 'src/TableManager';
import fs from 'fs';
import path from 'path';

// Type definition for saved checkbox state metadata
type CheckboxMeta = {
  checked: boolean;
  rowIndex: number;
  column: string;
};

/**
 * Loads checkbox states from an external JSON file saved in the vault.
 * @param app Obsidian app instance for accessing vault
 * @param fileName Name of the active file to associate checkbox states
 * @returns Object mapping checkbox IDs to their saved state metadata
 */
function loadCheckboxStates(app: App, fileName: string): Record<string, CheckboxMeta> {
  try {
    const adapter = app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      const filePath = path.join(adapter.getBasePath(), '_checkbox-states', `${fileName}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.error('Failed to load checkbox states', e);
  }
  return {};
}

/**
 * Main hook that manages the table state and logic.
 * @param app Obsidian app instance
 * @param configuration Table configuration object
 * @param indexOfTheDynamicTable Index of the current table instance on the page
 * @param tableData Raw data extracted from the markdown table
 * @returns An object containing state and state setters for rendering and interaction
 */
export function useDynamicTablesState(
  app: App,
  configuration: EtConfiguration,
  indexOfTheDynamicTable: number,
  tableData: RawTableData,
) {
  // State for sorting, filtering, searching, and pagination
  const [sorting, setSorting] = useState<string | null>(configuration.sort ?? null);
  const [filtering, setFiltering] = useState<string[]>([]);
  const [searching, setSearching] = useState<string | null>(null);

  // Initialize pagination state based on config or defaults
  const [pagination, setPagination] = useState<Pagination | null>(() => {
    if (configuration.pagination) {
      const pageSize = configuration.pagination['page-size'] ?? DEFAULT_PAGE_SIZE;
      const pageSizes = configuration.pagination['page-sizes'] ?? DEFAULT_PAGES_SIZE_OPTIONS;
      if (!pageSizes.includes(pageSize)) {
        pageSizes.push(pageSize);
        pageSizes.sort();
      }
      return { pageNumber: 1, pageSize, pageSizes };
    }
    return null;
  });

  // Track total number of rows before pagination
  const [totalNumberOfUnpaginatedRows, setTotalNumberOfUnpaginatedRows] =
    useState<number>(tableData.rows.length);

  // Callback to update pagination state from UI
  const onChangePagination = useCallback((p: PaginationOptions) => {
    setPagination((pagination) => ({ ...pagination, ...p }) as Pagination);
  }, []);

  /**
   * Memoized array of column objects enriched with configuration and formatting.
   * Parses column types and assigns formatters.
   */
  const indexedColumns = useMemo<EtDataColumn[]>(() => {
    return tableData.columns.map((columnName, index) => {
      const columnConfiguration = (configuration.columns?.[columnName] ?? {}) as EtConfigurationColumn;
      const { formatter, ...rest } = columnConfiguration;
      const type = rest.type ?? DEFAULT_COLUMNS_TYPE;

      const dateFormat =
        type === 'datetime'
          ? columnConfiguration['date-format'] ?? DEFAULT_DATE_TIME_FORMAT
          : type === 'time'
          ? DEFAULT_TIME_FORMAT
          : columnConfiguration['date-format'] ?? DEFAULT_DATE_FORMAT;

      const base: EtDataColumn = {
        ...rest,
        alias: rest.alias || columnName,
        editable: 'editable' in columnConfiguration ? !!columnConfiguration.editable : !!configuration.editable,
        type,
        name: columnName,
        index,
        dateFormat,
        numberFormat: parseNumberFormat(columnConfiguration['number-format'] ?? '', DEFAULT_NUMBER_FORMAT),
        yesFormat: rest['yes-format'] ?? DEFAULT_BOOL_YES_FORMAT,
        noFormat: rest['no-format'] ?? DEFAULT_BOOL_NO_FORMAT,
        el: document.createElement('td'),
        formatter: null as any,
      };

      base.formatter = makeFormatterForColumn(base, formatter);
      return base;
    });
  }, [tableData.columns, configuration.columns, configuration.editable]);

  /**
   * Memoized array of enriched rows with cell values, checkbox state injection,
   * and formatted cell content. Also applies sorting, filtering, searching,
   * and pagination to the data.
   */
  const rows = useMemo<EtDataRow[]>(() => {
    const dateFormat = configuration['date-format'] ?? DEFAULT_DATE_FORMAT;
    const datetimeFormat = configuration['datetime-format'] ?? DEFAULT_DATE_TIME_FORMAT;
    const yesFormat = configuration['yes-format'] ?? DEFAULT_BOOL_YES_INPUT;

    const currentContent = app.workspace.getActiveViewOfType(MarkdownView)?.data ?? '';
    const tableManager = new TableManager();
    const rawTableLines = tableManager.readTableLines(currentContent, indexOfTheDynamicTable);

    const fileName = app.workspace.getActiveFile()?.basename ?? 'default';
    const adapter = app.vault.adapter as FileSystemAdapter;
    const filePath = path.join(adapter.getBasePath(), '_checkbox-states', `${fileName}.json`);
    const checkboxStates = loadCheckboxStates(app, fileName);
    let updated = false;

    // Map over raw rows to enrich cell data and sync checkbox states
    let result: EtDataRow[] = tableData.rows.map((cells, rowIdx) => {
      const orderedCells: EtDataCell[] = cells.map((cellContent, cellIdx) => {
        const column = indexedColumns[cellIdx];
        const format =
          column.type === 'datetime' ? datetimeFormat :
          column.type === 'time' ? DEFAULT_TIME_FORMAT :
          dateFormat;

        const value = extractValue(cellContent, column, format, yesFormat);

        const raw = rawTableLines?.[rowIdx + 2]?.[cellIdx] ?? '';

        // Detect checkboxes and update external state store
        const isCheckbox = raw.includes('type="checkbox"');
        if (isCheckbox) {
          const match = raw.match(/id="([^"]+)"/);
          const checkboxId = match?.[1];
          const isChecked = raw.includes('checked');

          if (checkboxId && !checkboxStates[checkboxId]) {
            checkboxStates[checkboxId] = {
              rowIndex: rowIdx,
              column: column.name,
              checked: isChecked,
            };
            updated = true;
          }
        }

        return {
          column,
          rawValue: raw,
          value,
          el: column.el,
          formattedValue: column.formatter(value, {}, {
            app,
            data: { rows: [], columns: indexedColumns },
          }),
        };
      });

      // Build an object keyed by column alias for quick lookups
      const allCells = Object.fromEntries(
        orderedCells.map((c) => [c.column.alias ?? c.column.name, c.value])
      );

      // Inject 'true' or 'false' strings into row data for checkbox columns based on saved state
      Object.values(checkboxStates).forEach((meta) => {
        if (meta.rowIndex === rowIdx) {
          const colName = meta.column;
          const currentValue = allCells[colName];

          const valueToInject = meta.checked ? 'true' : 'false';

          if (typeof currentValue === 'string') {
            if (!currentValue.includes(valueToInject)) {
              allCells[colName] = `${currentValue} ${valueToInject}`.trim();
            }
          } else {
            allCells[colName] = valueToInject;
          }
        }
      });

      // Enrich the cells with updated checkbox-injected values
      const enrichedCells = orderedCells.map((c) => ({
        ...c,
        value: allCells[c.column.alias ?? c.column.name],
        formattedValue: c.formattedValue,
      }));

      // Return the enriched row object
      return {
        index: rowIdx,
        orderedCells: enrichedCells,
        ...allCells,
      } as EtDataRow;
    });

    // Write back updated checkbox state file if new checkboxes detected
    if (updated && filePath) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(checkboxStates, null, 2));
      } catch (e) {
        console.error('Failed to write updated checkbox state file', e);
      }
    }

    // Apply sorting if specified in state
    if (sorting) {
      const sortFn = getSortingFunction(sorting, indexedColumns);
      if (sortFn) {
        const sortField = sorting.startsWith('-') ? sorting.slice(1) : sorting;
        result.sort((a, b) => sortFn(a[sortField], b[sortField]));
      }
    }

    // Apply filtering and searching to rows
    if (filtering.length > 0 || searching) {
      result = result.filter(($row) => {
        const matchesFilter = filtering.every((expr) => {
          try {
            return Function('$row', `return (${expr})`)($row);
          } catch {
            return false;
          }
        });

        let matchesSearch = true;
        if (searching) {
          const lcSearch = searching.toLocaleLowerCase();
          matchesSearch = $row.orderedCells
            .filter((c) => c.column.searchable)
            .some((c) => {
              if (Array.isArray(c.value)) {
                return c.value.some((v) => v.toLocaleLowerCase().includes(lcSearch));
              }
              return c.value?.toString().toLocaleLowerCase().includes(lcSearch);
            });
        }

        return matchesFilter && matchesSearch;
      });
    }

    // Update total count of rows before pagination
    setTotalNumberOfUnpaginatedRows(result.length);

    // Apply pagination slicing if pagination is enabled
    if (pagination) {
      result = result.slice(
        pagination.pageSize * (pagination.pageNumber - 1),
        pagination.pageSize * pagination.pageNumber,
      );
    }

    return result;
  }, [
    indexOfTheDynamicTable,
    app,
    configuration,
    tableData,
    sorting,
    filtering,
    searching,
    pagination,
    indexedColumns,
  ]);

  // Return state and setters for use by the component
  return {
    indexedColumns,
    rows,
    pagination,
    onChangePagination,
    totalNumberOfUnpaginatedRows,
    filtering,
    setFiltering,
    sorting,
    setSorting,
    searching,
    setSearching,
  };
}
