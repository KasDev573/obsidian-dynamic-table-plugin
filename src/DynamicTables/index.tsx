import React, { useEffect, useMemo, useRef } from 'react';
import { EtConfiguration, RawTableData } from 'src/utils/types';
import { useDynamicTablesState } from 'src/DynamicTables/useDynamicTablesState';
import { PaginationView } from 'src/DynamicTables/components/PaginationView';
import { ControlsView } from 'src/DynamicTables/components/Controls';
import { App, MarkdownView, FileSystemAdapter } from 'obsidian';
import { TableManager } from 'src/TableManager';
import { makeEditor } from 'src/DynamicTables/editors';
import * as css from 'css';
import fs from 'fs';
import path from 'path';

type CheckboxMeta = {
  checked: boolean;
  rowIndex: number;
  column: string;
};

type EnhancedTablesProps = {
  app: App;
  configuration: EtConfiguration;
  tableData: RawTableData;
  indexOfTheEnhancedTable: number;
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

export const EnhancedTables: React.FC<EnhancedTablesProps> = ({
  app,
  configuration,
  tableData,
  indexOfTheEnhancedTable,
}) => {
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
  } = useDynamicTablesState(app, configuration, indexOfTheEnhancedTable, tableData);

  useEffect(() => {
    if (!tbodyRef.current) return;

    tbodyRef.current.textContent = '';

    const fileName = app.workspace.getActiveFile()?.basename ?? 'default';
    const checkboxStates = loadCheckboxStates(app, fileName);

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-dt-row', row.index.toString());

      const currentContent = app.workspace.getActiveViewOfType(MarkdownView)?.data ?? '';
      const tableManager = new TableManager();

      row.orderedCells
        .filter((c) => !c.column.hidden)
        .forEach((cell, idx2) => {
          const td = document.createElement('td');
          td.setAttribute('data-dt-cell', idx2.toString());
          td.setAttribute('data-dt-row-cell', `${row.index}-${idx2}`);

          if (tableData.rowDirections[idx2] !== null) {
            td.setAttribute('align', tableData.rowDirections[idx2] as string);
          }

          if (cell.column.nowrap) {
            td.className = 'dynamic-table-nowrap';
          }

          try {
            td.appendChild(cell.formattedValue);
          } catch (e) {
            td.innerHTML = cell.formattedValue;
          }

          const checkboxes = td.querySelectorAll<HTMLInputElement>('input[type="checkbox"][id]');
          checkboxes.forEach((checkbox) => {
            const id = checkbox.id;
            const saved = checkboxStates[id];
            if (saved) {
              checkbox.checked = saved.checked;
            }

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
            const modifiedRowValues = row.orderedCells.map((c, i) =>
              i === idx2 ? newVal : c.rawValue,
            );
            const modifiedContent = tableManager.modifyLine(
              currentContent,
              row.index,
              modifiedRowValues,
              indexOfTheEnhancedTable,
            );

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
    indexOfTheEnhancedTable,
    app,
    app.workspace,
    configuration,
    rows,
    tableData.rowDirections,
  ]);

  const style = useMemo<string | undefined>(() => {
    if (!configuration.style) return undefined;

    try {
      const customCss = css.parse(configuration.style);
      customCss?.stylesheet?.rules.forEach((r) => {
        if ('selectors' in r) r.selectors = r.selectors?.map((s) => `& ${s}`);
      });

      return `
        .dynamic-table {
          ${css.stringify(customCss)}
        }
      `;
    } catch (e) {
      return undefined;
    }
  }, [configuration.style]);

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
        />
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              {indexedColumns
                .filter((c) => !c.hidden)
                .map((c, idx) => (
                  <th
                    key={idx}
                    className={`${c.nowrap ? 'dynamic-table-nowrap' : ''} ${configuration['fix-header'] ? 'dynamic-table-fix-header' : ''}`}
                    dangerouslySetInnerHTML={{ __html: c.name }}
                  />
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
