/**
 * useDynamicTablesState Hook
 *
 * This hook powers the dynamic table rendering logic for the Obsidian plugin. It manages:
 * - Table row rendering
 * - Formatting and interpreting column values
 * - Sorting and pagination
 * - Search and filter logic (with debounce for performance)
 * - External checkbox state persistence (loaded/saved from local file)
 * - Optional style flags from YAML for striped and hover-enabled rows
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
import { useDebounce } from 'src/utils/useDebounce';
import { CheckboxMeta } from 'src/utils/types';


// Type definition for saved checkbox state metadata
// Used to persist checkbox values independently of markdown
// Includes 'checked' value, row index, and column name

// Load persisted checkbox states from file
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

function addCustomFilterHelpersToRow(row: Record<string, any>): Record<string, any> {
  return new Proxy(row, {
    get(target, prop) {
      const value = target[prop as string];

      if (typeof value === 'string') {
        return {
          includes: (substr: string) => value.includes(substr),
          including: (substr: string) => value.toLowerCase().includes(substr.toLowerCase()),
        };
      }

      return value;
    },
  });
}

// Cache filter expressions as compiled functions for reuse
function createFilterFunctionCache(expressions: string[]) {
  const cache: Record<string, (row: Record<string, any>) => boolean> = {};
  for (const expr of expressions) {
    try {
      cache[expr] = (row: Record<string, any>) => {
        const proxiedRow = addCustomFilterHelpersToRow(row);
        return Function('$row', `return (${expr})`)(proxiedRow);
      };
    } catch {
      cache[expr] = () => false;
    }
  }
  return cache;
}

export function useDynamicTablesState(
  app: App,
  configuration: EtConfiguration,
  indexOfTheDynamicTable: number,
  tableData: RawTableData,
) {
  const [sorting, setSorting] = useState<string | null>(configuration.sort ?? null);
  const [filtering, setFiltering] = useState<string[]>([]);
  const [searching, setSearching] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searching, 200);

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

  const [totalNumberOfUnpaginatedRows, setTotalNumberOfUnpaginatedRows] =
    useState<number>(tableData.rows.length);

  const [augmentedRows, setAugmentedRows] = useState<EtDataRow[] | null>(null);

  const onChangePagination = useCallback((p: PaginationOptions) => {
    setPagination((pagination) => ({ ...pagination, ...p }) as Pagination);
  }, []);

  // Memoized columns config
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

      const column: EtDataColumn = {
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
        formatter: () => '',
      };

      column.formatter = makeFormatterForColumn(column, formatter);
      return column;
    });
  }, [tableData.columns, configuration.columns, configuration.editable]);

  // Memoized processing of rows
  const rows = useMemo<EtDataRow[]>(() => {
    const dateFormat = configuration['date-format'] ?? DEFAULT_DATE_FORMAT;
    const datetimeFormat = configuration['datetime-format'] ?? DEFAULT_DATE_TIME_FORMAT;
    const yesFormat = configuration['yes-format'] ?? DEFAULT_BOOL_YES_INPUT;

    const currentContent = app.workspace.getActiveViewOfType(MarkdownView)?.data ?? '';
    const tableManager = new TableManager();
    const rawTableLines = tableManager.readTableLines(currentContent, indexOfTheDynamicTable);

    const fileName = app.workspace.getActiveFile()?.basename ?? 'default';
    const adapter = app.vault.adapter;
    let filePath = '';
    if (adapter instanceof FileSystemAdapter) {
      filePath = path.join(adapter.getBasePath(), '_checkbox-states', `${fileName}.json`);
    }

    const checkboxStates = loadCheckboxStates(app, fileName);
    let updated = false;

    let result: EtDataRow[] = tableData.rows.map((cells, rowIdx) => {
      const orderedCells: EtDataCell[] = cells.map((cellContent, cellIdx) => {
        const column = indexedColumns[cellIdx];
        const format =
          column.type === 'datetime' ? datetimeFormat :
          column.type === 'time' ? DEFAULT_TIME_FORMAT :
          dateFormat;

        const value = extractValue(cellContent, column, format, yesFormat);
        const raw = rawTableLines?.[rowIdx + 2]?.[cellIdx] ?? '';
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

      const allCells = Object.fromEntries(
        orderedCells.map((c) => [c.column.alias ?? c.column.name, c.value])
      );

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

      const enrichedCells = orderedCells.map((c) => ({
        ...c,
        value: allCells[c.column.alias ?? c.column.name],
        formattedValue: c.formattedValue,
      }));

      const searchIndex = enrichedCells
        .filter((c) => c.column.searchable)
        .map((c) => c.value?.toString().toLowerCase() ?? '')
        .join(' ');

      return {
        index: rowIdx,
        orderedCells: enrichedCells,
        el: document.createElement('table'),
        cells: Object.fromEntries(enrichedCells.map((c) => [c.column.name, c])),
        searchIndex,
        ...allCells,
      };
    });

    if (updated && filePath) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(checkboxStates, null, 2));
      } catch (e) {
        console.error('Failed to write updated checkbox state file', e);
      }
    }

    const filterFns = createFilterFunctionCache(filtering);
    const lcSearch = debouncedSearch?.toLowerCase() ?? '';

    if (filtering.length > 0 || lcSearch) {
      result = result.filter(($row) => {
        const matchesFilter = filtering.every((expr) => {
          const fn = filterFns[expr];
          return fn ? fn($row) : false;
        });

        const matchesSearch = !lcSearch || $row.searchIndex.includes(lcSearch);

        return matchesFilter && matchesSearch;
      });
    }

    if (sorting) {
      const sortFn = getSortingFunction(sorting, indexedColumns);
      if (sortFn) {
        const sortField = sorting.startsWith('-') ? sorting.slice(1) : sorting;
        result.sort((a, b) => sortFn(a[sortField], b[sortField]));
      }
    }

    setTotalNumberOfUnpaginatedRows(result.length);

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
    filtering,
    debouncedSearch,
    sorting,
    pagination,
    indexedColumns,
  ]);

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
    setAugmentedRows,
    augmentedRows,
  };
}
