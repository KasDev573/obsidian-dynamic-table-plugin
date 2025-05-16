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

type CheckboxMeta = {
  checked: boolean;
  rowIndex: number;
  column: string;
};

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

export function useDynamicTablesState(
  app: App,
  configuration: EtConfiguration,
  indexOfTheEnhancedTable: number,
  tableData: RawTableData,
) {
  const [sorting, setSorting] = useState<string | null>(configuration.sort ?? null);
  const [filtering, setFiltering] = useState<string[]>([]);
  const [searching, setSearching] = useState<string | null>(null);

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

  const onChangePagination = useCallback((p: PaginationOptions) => {
    setPagination((pagination) => ({ ...pagination, ...p }) as Pagination);
  }, []);

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

  const rows = useMemo<EtDataRow[]>(() => {
    const dateFormat = configuration['date-format'] ?? DEFAULT_DATE_FORMAT;
    const datetimeFormat = configuration['datetime-format'] ?? DEFAULT_DATE_TIME_FORMAT;
    const yesFormat = configuration['yes-format'] ?? DEFAULT_BOOL_YES_INPUT;

    const currentContent = app.workspace.getActiveViewOfType(MarkdownView)?.data ?? '';
    const tableManager = new TableManager();
    const rawTableLines = tableManager.readTableLines(currentContent, indexOfTheEnhancedTable);

    const fileName = app.workspace.getActiveFile()?.basename ?? 'default';
    const checkboxStates = loadCheckboxStates(app, fileName);

    let result: EtDataRow[] = tableData.rows.map((cells, rowIdx) => {
      const orderedCells: EtDataCell[] = cells.map((cellContent, cellIdx) => {
        const column = indexedColumns[cellIdx];
        const format =
          column.type === 'datetime' ? datetimeFormat :
          column.type === 'time' ? DEFAULT_TIME_FORMAT :
          dateFormat;

        const value = extractValue(cellContent, column, format, yesFormat);

        // Preserve the original HTML checkbox input element (not boolean)
        const raw = rawTableLines?.[rowIdx + 2]?.[cellIdx] ?? '';

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
        orderedCells.map((c) => [c.column.alias, c.value])
      );

      // Add #<column> tags dynamically to the Tags column based on checkbox state
      let tags = typeof allCells['Tags'] === 'string' ? allCells['Tags'] : '';

      Object.values(checkboxStates).forEach((meta) => {
        if (meta.rowIndex === rowIdx && meta.checked) {
          const tag = `#${meta.column.toLowerCase()}`;
          if (!tags.includes(tag)) {
            tags += ` ${tag}`;
          }
        }
      });

      allCells['Tags'] = tags.trim();

      const enrichedCells = orderedCells.map((c) => ({
        ...c,
        value: c.column.alias === 'Tags' ? allCells['Tags'] : c.value,
        formattedValue: c.formattedValue, // Do NOT overwrite checkbox with true/false
      }));

      return {
        index: rowIdx,
        orderedCells: enrichedCells,
        ...allCells,
      } as EtDataRow;
    });

    // Sorting
    if (sorting) {
      const sortFn = getSortingFunction(sorting, indexedColumns);
      if (sortFn) {
        const sortField = sorting.startsWith('-') ? sorting.slice(1) : sorting;
        result.sort((a, b) => sortFn(a[sortField], b[sortField]));
      }
    }

    // Filtering / Searching
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

    setTotalNumberOfUnpaginatedRows(result.length);

    if (pagination) {
      result = result.slice(
        pagination.pageSize * (pagination.pageNumber - 1),
        pagination.pageSize * pagination.pageNumber,
      );
    }

    return result;
  }, [
    indexOfTheEnhancedTable,
    app,
    configuration,
    tableData,
    sorting,
    filtering,
    searching,
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
  };
}
