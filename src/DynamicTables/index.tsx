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
import { CheckboxStateManager } from '../CheckboxStateManager';


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

  const hasFetchedOnceRef = useRef(false);

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

//   console.log('[Debug] useDynamicTablesState output:');
//   console.log('rows:', rows);
//   console.log('augmentedRows:', augmentedRows);
//   console.log('filtering:', filtering);
//   console.log('sorting:', sorting);
//   console.log('searching:', searching);



  const zebraStriping = configuration.styleEnhancements?.zebraStriping;
  const rowHoverHighlight = configuration.styleEnhancements?.rowHoverHighlight;
  const horizontalTextAlignment = configuration.styleEnhancements?.horizontalTextAlignment ?? 'left';
  const rawVAlign = configuration.styleEnhancements?.verticalTextAlignment ?? 'top';
  const verticalTextAlignment = rawVAlign === 'center' ? 'middle' : rawVAlign;
  const stickyHeader = configuration.controls?.stickyHeader ?? false;

useEffect(() => {
  // ✅ STOP if we already fetched
  if (hasFetchedOnceRef.current) return;

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

    if (!isSortingByLastUpdated || !hasLastUpdatedColumn || !hasAnyMangaLinks) {
      console.info('Skipping MangaDex fetch: sort not Last Updated, column missing, or no valid links.');
      return;
    }

    hasFetchedOnceRef.current = true; // ✅ Only mark as fetched if the fetch is valid

    new Notice('Fetching manga update info...');

    function parseChapterNumber(chapterStr: string) {
      const num = parseFloat(chapterStr);
      return isNaN(num) ? 0 : num;
    }

    const updatedWithNulls = await Promise.all(
      rows.map(async (row) => {
        const linkRaw = typeof row.cells?.['Link']?.rawValue === 'string' ? row.cells['Link'].rawValue : '';
        const match = linkRaw.match(/mangadex\.org\/title\/([a-z0-9-]{36})/i);
        const mangaId = match?.[1];

        if (!mangaId) {
          console.log(`Row ${row.index}: No valid manga ID found in link.`);
          return row;
        }

        try {
          const proxyUrl = `http://localhost:3000/proxy/${mangaId}?limit=5`;
          const res = await fetch(proxyUrl);
          const json = await res.json();

          const chapters = json.data ?? [];
//           console.log(`Row ${row.index}: Fetched ${chapters.length} chapters for manga ID ${mangaId}`);

          let filteredChapters = chapters.filter(
            (chap: any) => chap.attributes.translatedLanguage === 'en'
          );

          if (filteredChapters.length === 0) {
            console.warn(`Row ${row.index}: No English chapters found, falling back to all chapters.`);
            filteredChapters = chapters;
          }

          if (filteredChapters.length === 0) {
            console.warn(`Row ${row.index}: No chapters found, returning original row.`);
            return row;
          }

          const maxChapterNum = Math.max(
            ...filteredChapters.map((chap: any) => parseChapterNumber(chap.attributes.chapter))
          );

          const candidates = filteredChapters.filter(
            (chap: any) => parseChapterNumber(chap.attributes.chapter) === maxChapterNum
          );

          const selectedChapter = candidates.reduce((earliest: any | null, chap: any) => {
            if (!earliest) return chap;
            const earliestDate = new Date(earliest.attributes.publishAt);
            const chapDate = new Date(chap.attributes.publishAt);
            return chapDate < earliestDate ? chap : earliest;
          }, null);

          const publishAt = selectedChapter?.attributes?.publishAt ?? null;
          const formattedDate = publishAt ? new Date(publishAt).toLocaleString() : '';
          const parsedDate = publishAt ? new Date(publishAt) : null;

          // Compare "Last Read" vs Latest Chapter Number
          const lastReadRaw = row.cells?.['Last Read']?.rawValue?.toString().trim();
          const latestChapterNum = parseChapterNumber(selectedChapter?.attributes?.chapter ?? '');

          let newIndicator = '';
          if (lastReadRaw && !isNaN(Number(lastReadRaw))) {
            const lastRead = parseFloat(lastReadRaw);
            if (latestChapterNum > lastRead) {
              newIndicator = '✅';
//               console.log(`Row ${row.index}: ✅ New chapter available (last read: ${lastRead}, latest: ${latestChapterNum})`);
            } else {
//               console.log(`Row ${row.index}: No new chapter (last read: ${lastRead}, latest: ${latestChapterNum})`);
            }
          } else {
//             console.log(`Row ${row.index}: Invalid or missing Last Read value.`);
          }

          const newCell: EtDataCell = {
            column: indexedColumns.find((c) => (c.alias ?? c.name) === 'New')!,
            rawValue: newIndicator,
            value: newIndicator,
            formattedValue: newIndicator,
            el: null as unknown as HTMLTableCellElement, // <-- temp placeholder; will be set later by renderer
          };

          const updatedOrderedCells = row.orderedCells.map((c: EtDataCell) => {
            const columnName = c.column.alias ?? c.column.name;
            if (columnName === 'Last Updated') {
              return {
                ...c,
                rawValue: publishAt ?? '',
                value: parsedDate,
                formattedValue: formattedDate,
              };
            }
            if (columnName === 'New') {
              return newCell;
            }
            return c;
          });

          return {
            ...row,
            orderedCells: updatedOrderedCells,
            cells: {
              ...row.cells,
              'Last Updated': updatedOrderedCells.find(c => (c.column.alias ?? c.column.name) === 'Last Updated')!,
              'New': newCell,
            },
          };
        } catch (err) {
          console.error(`Error fetching latest chapter for mangaId ${mangaId} in row ${row.index}:`, err);
          return row;
        }
      })
    );

    const updated = updatedWithNulls.filter((r): r is EtDataRow => r !== null);

//     if (isSortingByLastUpdated) {
//       const desc = configuration.sort?.startsWith('-');
//       updated.sort((a, b) => {
//         const dateA = a.cells?.['Last Updated']?.value as Date;
//         const dateB = b.cells?.['Last Updated']?.value as Date;
//         if (!dateA || !dateB) return 0;
//         return desc ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
//       });
//     }

//     console.log('Setting augmented rows with updated data');
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

    rows.forEach((row: EtDataRow) => {
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
          let didUpdate = false;

          checkboxes.forEach((checkbox: HTMLInputElement) => {
            const id = checkbox.id;

            // Restore saved state if available
            const saved = checkboxStates[id];
            if (saved) {
              checkbox.checked = saved.checked;
            }

            // Register change listener
            checkbox.addEventListener('change', () => {
              checkboxStates[id] = {
                checked: checkbox.checked,
                rowIndex: row.index,
                column: cell.column.alias || cell.column.name,
              };
              saveCheckboxStates(app, fileName, checkboxStates);
            });

            // Batch initialize state if not already tracked
            if (!checkboxStates[id]) {
              checkboxStates[id] = {
                checked: checkbox.checked,
                rowIndex: row.index,
                column: cell.column.alias || cell.column.name,
              };
              didUpdate = true;
            }
          });

          if (didUpdate) {
            saveCheckboxStates(app, fileName, checkboxStates);
          }



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
