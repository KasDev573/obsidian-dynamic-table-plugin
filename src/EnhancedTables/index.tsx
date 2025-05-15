import React, { useEffect, useMemo, useRef } from 'react';
import { EtConfiguration, RawTableData } from 'src/utils/types';
import { useEnhancedTablesState } from 'src/EnhancedTables/useEnhancedTablesState';
import { PaginationView } from 'src/EnhancedTables/components/PaginationView';
import { ControlsView } from 'src/EnhancedTables/components/Controls';
import { App, MarkdownView } from 'obsidian';
import { TableManager } from 'src/TableManager';
import { makeEditor } from 'src/EnhancedTables/editors';

import * as css from 'css';

type EnhancedTablesProps = {
  app: App;
  configuration: EtConfiguration;
  tableData: RawTableData;
  indexOfTheEnhancedTable: number;
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

    // Removed sorting
    // Removed setSorting

    searching,
    setSearching,
  } = useEnhancedTablesState(
    app,
    configuration,
    indexOfTheEnhancedTable,
    tableData,
  );

  useEffect(() => {
    if (!tbodyRef.current) return;

    tbodyRef.current.textContent = '';

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-dt-row', row.index.toString());

      const currentContent =
        app.workspace.getActiveViewOfType(MarkdownView)?.data ?? '';
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

            app.workspace
              //@ts-ignore
              .getActiveFileView()
              .setViewData(modifiedContent, true);

            //@ts-ignore
            app.workspace.activeEditor.previewMode.rerender();
          };

          if (cell.column.editable) {
            makeEditor(td, cell, configuration, onValueChange);
            td.classList.add('editor-cursor-pointer');
          }

          tr.appendChild(td);
        });

      tbodyRef.current!.appendChild(tr);
    });
  }, [indexOfTheEnhancedTable, app.workspace, configuration, rows]);

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
