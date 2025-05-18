/**
 * DynamicTables Component
 *
 * This component renders a fully interactive dynamic table within Obsidian.
 * It handles data rendering, inline cell editing, pagination, filtering,
 * sorting, and search functionality. It also manages checkbox states
 * externally by saving/loading to JSON files in the vault.
 *
 * Props:
 * - app: Obsidian App instance, used for vault access and UI integration.
 * - configuration: Table configuration and metadata from YAML frontmatter.
 * - tableData: Raw table data extracted from markdown.
 * - indexOfTheDynamicTable: Index of the table instance on the page.
 * - showSort, showSearch, showFilter: Flags to conditionally show UI controls.
 */

import { EtConfiguration, RawTableData, EtDataCell, EtDataRow } from 'src/utils/types';
import { useDynamicTablesState } from 'src/DynamicTables/useDynamicTablesState';
import { PaginationView } from 'src/DynamicTables/components/PaginationView';
import { ControlsView } from 'src/DynamicTables/components/Controls';
import { App, MarkdownView, FileSystemAdapter, MarkdownRenderer, Notice } from 'obsidian';
import { TableManager } from 'src/TableManager';
import { makeEditor } from 'src/DynamicTables/editors';
import * as css from 'css';
import fs from 'fs';
import path from 'path';
import { getSortingFunction } from 'src/utils/sorting';
import React, { useEffect, useMemo, useRef } from 'react';
import { Component } from 'obsidian';

class WrapperComponent extends Component {}

type CheckboxMeta = {
  checked: boolean;
  rowIndex: number;
  column: string;
};

type DynamicTablesProps = {
  app: App;
  configuration: EtConfiguration;
  tableData: RawTableData;
  indexOfTheDynamicTable: number;
  showSort: boolean;
  showSearch: boolean;
  showFilter: boolean;
};

const getVaultBasePath = (app: App): string | null => {
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath();
  }
  return null;
};

const getStateFilePath = (app: App, fileName: string): string | null => {
  const base = getVaultBasePath(app);
  return base ? path.join(base, '_checkbox-states', `${fileName}.json`) : null;
};

const loadCheckboxStates = (app: App, fileName: string): Record<string, CheckboxMeta> => {
  try {
    const filePath = getStateFilePath(app, fileName);
    if (filePath && fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load checkbox states', e);
  }
  return {};
};

const saveCheckboxStates = (app: App, fileName: string, states: Record<string, CheckboxMeta>) => {
  try {
    const base = getVaultBasePath(app);
    if (!base) return;

    const dirPath = path.join(base, '_checkbox-states');
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);

    const filePath = path.join(dirPath, `${fileName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(states, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save checkbox states', e);
  }
};

export const DynamicTables: React.FC<DynamicTablesProps> = ({
  app,
  configuration,
  tableData,
  indexOfTheDynamicTable,
  showSort,
  showSearch,
  showFilter,
}) => {
  const wrapperComponentInstance = useRef(new WrapperComponent());

  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  const {
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
  } = useDynamicTablesState(app, configuration, indexOfTheDynamicTable, tableData);

  const zebraStriping = configuration.styleEnhancements?.zebraStriping;
  const rowHoverHighlight = configuration.styleEnhancements?.rowHoverHighlight;
  const horizontalTextAlignment = configuration.styleEnhancements?.horizontalTextAlignment ?? 'left';
  const rawVAlign = configuration.styleEnhancements?.verticalTextAlignment ?? 'top';
  const verticalTextAlignment = rawVAlign === 'center' ? 'middle' : rawVAlign;
  const stickyHeader = configuration.controls?.stickyHeader ?? false;

useEffect(() => {
  const file = app.workspace.getActiveFile();
  if (!file) return;

  const fetchLatestUpdates = async () => {
    const isSortingByLastUpdated =
      configuration.sort === 'Last Updated' || configuration.sort === '-Last Updated';

    const hasLastUpdatedColumn = indexedColumns.some(
      (col) => (col.alias ?? col.name) === 'Last Updated'
    );

    const hasAnyMangaLinks = rows.some((row) => {
      const linkRaw = row.cells?.['Link']?.rawValue;
      return typeof linkRaw === 'string' && /mangadex\.org\/title\/[a-z0-9-]{36}/i.test(linkRaw);
    });

    // Skip if any requirement is not met
    if (!isSortingByLastUpdated || !hasLastUpdatedColumn || !hasAnyMangaLinks) {
      console.info('Skipping MangaDex fetch: sort not Last Updated, column missing, or no valid links.');
      return;
    }

    new Notice('Fetching manga update info...');

    const updated = await Promise.all(rows.map(async (row) => {
      const linkRaw = typeof row.cells?.['Link']?.rawValue === 'string' ? row.cells['Link'].rawValue : '';
      const match = linkRaw.match(/mangadex\.org\/title\/([a-z0-9-]{36})/i);
      const mangaId = match?.[1];

      if (!mangaId) return row;

      try {
        const proxyUrl = `http://localhost:3000/proxy/${mangaId}`;
        const res = await fetch(proxyUrl);
        const json = await res.json();

        const updatedAt = json.data?.[0]?.attributes?.updatedAt ?? null;
        const formattedDate = updatedAt ? new Date(updatedAt).toLocaleString() : '';
        const parsedDate = updatedAt ? new Date(updatedAt) : null;

        const updatedOrderedCells = row.orderedCells.map((c: EtDataCell) => {
          if ((c.column.alias ?? c.column.name) === 'Last Updated') {
            return {
              ...c,
              rawValue: updatedAt ?? '',
              value: parsedDate,
              formattedValue: formattedDate,
            };
          }
          return c;
        });

        const lastUpdatedCell = updatedOrderedCells.find(
          (c) => (c.column.alias ?? c.column.name) === 'Last Updated'
        );

        return {
          ...row,
          'Last Updated': formattedDate,
          orderedCells: updatedOrderedCells,
          cells: {
            ...row.cells,
            ...(lastUpdatedCell ? { 'Last Updated': lastUpdatedCell } : {}),
          },
        };
      } catch (err) {
        console.error(`Error fetching latest chapter for ${mangaId}:`, err);
        return row;
      }
    }));

    // Sorting
    if (isSortingByLastUpdated) {
      const desc = configuration.sort?.startsWith('-');
      updated.sort((a, b) => {
        const dateA = a.cells?.['Last Updated']?.value as Date;
        const dateB = b.cells?.['Last Updated']?.value as Date;
        if (!dateA || !dateB) return 0;
        return desc ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
      });
    } else if (configuration.sort) {
      const sortValue = configuration.sort as string;
      const sortField = sortValue.startsWith('-') ? sortValue.slice(1) : sortValue;

      const sortFn = getSortingFunction(configuration.sort, indexedColumns);
      if (sortFn) {
        updated.sort((a, b) =>
          sortFn(
            (a.cells as Record<string, EtDataCell | undefined>)?.[sortField]?.value,
            (b.cells as Record<string, EtDataCell | undefined>)?.[sortField]?.value
          )
        );
      }
    }

    setAugmentedRows(updated);
  };

  fetchLatestUpdates();

  const onFileChange = () => {
    const newFile = app.workspace.getActiveFile();
    if (newFile?.path === file.path) {
      fetchLatestUpdates();
    }
  };

  app.workspace.on('file-open', onFileChange);
  return () => {
    app.workspace.off('file-open', onFileChange);
  };
}, [app, rows, setAugmentedRows, configuration.sort, indexedColumns]);





  useEffect(() => {
    if (!tbodyRef.current) return;
    tbodyRef.current.textContent = '';

    const fileName = app.workspace.getActiveFile()?.basename ?? 'default';
    const checkboxStates = loadCheckboxStates(app, fileName);

    (augmentedRows ?? rows).forEach((row: EtDataRow) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-dt-row', row.index.toString());

      if (zebraStriping) {
        tr.classList.add('dt-zebra');
      }
      if (rowHoverHighlight) {
        tr.classList.add('dt-hover-highlight');
      }

      const currentContent = app.workspace.getActiveViewOfType(MarkdownView)?.data ?? '';
      const tableManager = new TableManager();

      row.orderedCells
        .filter((c: EtDataCell): boolean => !c.column.hidden)
        .forEach((cell: EtDataCell, idx2: number) => {
          const td = document.createElement('td');
          td.style.textAlign = horizontalTextAlignment;
          td.style.verticalAlign = verticalTextAlignment;
          td.setAttribute('data-dt-cell', idx2.toString());
          td.setAttribute('data-dt-row-cell', `${row.index}-${idx2}`);

          if (tableData.rowDirections[idx2] !== null) {
            td.setAttribute('align', tableData.rowDirections[idx2] as string);
          }
          if (cell.column.nowrap) {
            td.className = 'dynamic-table-nowrap';
          }

          // Override "Last Updated" column rendering with injected value
          if ((cell.column.alias ?? cell.column.name) === 'Last Updated' && augmentedRows) {
            // Use the augmented value instead of original
            const luCell = row.cells?.['Last Updated'];
            td.textContent = luCell?.formattedValue || 'Fetching...';
          } else if (typeof cell.formattedValue === 'string') {
            MarkdownRenderer.renderMarkdown(
              cell.formattedValue,
              td,
              app.workspace.getActiveFile()?.path ?? '',
              wrapperComponentInstance.current
            );
          } else if (cell.formattedValue instanceof HTMLElement) {
            td.appendChild(cell.formattedValue);
          }

          const checkboxes = td.querySelectorAll<HTMLInputElement>('input[type="checkbox"][id]');
          checkboxes.forEach((checkbox) => {
            const id = checkbox.id;
            const saved = checkboxStates[id];
            if (saved) checkbox.checked = saved.checked;

            checkbox.addEventListener('change', () => {
              checkboxStates[id] = {
                checked: checkbox.checked,
                rowIndex: row.index,
                column: cell.column.alias || cell.column.name,
              };
              saveCheckboxStates(app, fileName, checkboxStates);
            });
          });

          const onValueChange = (newVal: string) => {
            const modifiedRowValues = row.orderedCells.map((c: EtDataCell, i: number) =>
              i === idx2 ? newVal : c.rawValue
            );

            const modifiedContent = tableManager.modifyLine(currentContent, row.index, modifiedRowValues, indexOfTheDynamicTable);
            //@ts-ignore
            app.workspace.getActiveFileView().setViewData(modifiedContent, true);
            //@ts-ignore
            app.workspace.activeEditor?.previewMode?.rerender?.();
          };

          if (cell.column.editable) {
            makeEditor(td, cell, configuration, onValueChange);
            td.classList.add('editor-cursor-pointer');
          }

          tr.appendChild(td);
        });

      tbodyRef.current!.appendChild(tr);
    });
  }, [
    indexOfTheDynamicTable,
    app,
    app.workspace,
    configuration,
    rows,
    augmentedRows,
    tableData.rowDirections,
    zebraStriping,
    rowHoverHighlight,
    horizontalTextAlignment,
    verticalTextAlignment,
  ]);

  const style = useMemo(() => {
    let styleText = ``;

    if (zebraStriping) {
      styleText += `
        .dynamic-table tr.dt-zebra-even {
          background-color: var(--background-modifier-hover);
        }
      `;
    }

    if (rowHoverHighlight) {
      styleText += `
        .dynamic-table tr.dt-hover-highlight:hover {
          background-color: var(--background-secondary-alt);
        }
      `;
    }

    if (configuration.style) {
      try {
        const customCss = css.parse(configuration.style);
        customCss?.stylesheet?.rules.forEach((r) => {
          if ('selectors' in r) r.selectors = r.selectors?.map((s) => `& ${s}`);
        });

        styleText += `
          .dynamic-table {
            ${css.stringify(customCss)}
          }
        `;
      } catch (e) {
        console.warn('Failed to parse user custom style in configuration.style');
      }
    }

    return styleText.length > 0 ? styleText : undefined;
  }, [configuration.style, zebraStriping, rowHoverHighlight]);

  return (
    <div className="dynamic-table">
      {style && <style>{style}</style>}

      {!configuration['hide-controls'] && (
        <ControlsView
          configuration={configuration}
          columns={indexedColumns}
          filtering={filtering}
          setFiltering={setFiltering}
          sorting={sorting}
          setSorting={setSorting}
          searching={searching}
          setSearching={setSearching}
          showSort={showSort}
          showSearch={showSearch}
          showFilter={showFilter}
        />
      )}

      <div className={`table-container ${stickyHeader ? 'dynamic-table-scroll-container' : ''}`}>
        <table>
          <thead className={stickyHeader ? 'dynamic-table-sticky-header' : ''}>
            <tr>
              {indexedColumns.filter((c) => !c.hidden).map((c, idx) => (
                <th
                  key={idx}
                  style={{ textAlign: horizontalTextAlignment, verticalAlign: verticalTextAlignment }}
                  className={`${c.nowrap ? 'dynamic-table-nowrap' : ''} ${configuration['fix-header'] ? 'dynamic-table-fix-header' : ''}`}
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={tbodyRef}></tbody>
        </table>
      </div>

      {pagination && (
        <PaginationView
          value={pagination}
          onChange={onChangePagination}
          totalNumberOfItems={totalNumberOfUnpaginatedRows}
          pageSizeOptions={pagination.pageSizes}
        />
      )}
    </div>
  );
};
