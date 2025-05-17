/**
 * mount.tsx
 *
 * Responsible for extracting the YAML configuration and associated HTML table from
 * the markdown post-processor element, validating the configuration, and mounting
 * the React component to render the dynamic table UI.
 *
 * Key functions include:
 * - getMountContext: retrieves and validates YAML config + table, returns context tuple
 * - mountDynamicTables: mounts the DynamicTables React component into the DOM
 * - Utility functions for navigating DOM to find YAML code block and table element
 * - Parsing raw table data for use by the React component
 * - NEW: Applies optional table styling classes from YAML like 'striped' and 'hoverable'
 */

import { App, MarkdownPostProcessorContext, parseYaml } from 'obsidian';
import {
  ET_CONFIGURATION_CODE_ATTRIBUTE,
  ET_CONFIGURATION_CODE_EL_ATTRIBUTE,
  ET_RENDER_TABLE_ATTRIBUTE,
  ET_YAML_SIGNAL,
} from 'src/utils/sharedConstants';
import { EtConfiguration, RawTableData } from 'src/utils/types';
import { DynamicTables } from 'src/DynamicTables';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { validateConfiguration } from 'src/utils/validation';

export type MountContext = [
  HTMLElement,
  EtConfiguration,
  HTMLTableElement,
  RawTableData,
  number,
];

export async function getMountContext(
  element: HTMLElement,
  ctx: MarkdownPostProcessorContext,
): Promise<MountContext | null | string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      let yamlCodeEl = element.find('code.language-yaml');
      let tableEl = element.find('table') as HTMLTableElement;

      if (!yamlCodeEl && !tableEl) return resolve(null);

      if (yamlCodeEl && !tableEl) tableEl = lookDownForTheTable(element) ?? tableEl;
      if (tableEl && !yamlCodeEl) yamlCodeEl = lookUpForTheYamlCode(element) ?? yamlCodeEl;

      if (!tableEl || !yamlCodeEl) return resolve(null);

      const configurationString = extractYamlCodeFromTheCodeBlock(yamlCodeEl, ctx);
      if (!configurationString) return resolve(null);

      let configuration: EtConfiguration;
      try {
        configuration = parseYaml(configurationString);
      } catch (e) {
        return resolve('Cannot parse the yaml configuration');
      }

      const validOrValidationMessage = validateConfiguration(configuration);
      if (validOrValidationMessage !== true) return resolve(validOrValidationMessage);

      const tableData = extractRawTableData(tableEl);
      yamlCodeEl.setAttribute(ET_CONFIGURATION_CODE_EL_ATTRIBUTE, '1');

      const indexOfTheDynamicTable = Array.from(
        document.querySelectorAll(`[${ET_CONFIGURATION_CODE_EL_ATTRIBUTE}]`),
      ).indexOf(yamlCodeEl);

      element.setAttribute(ET_CONFIGURATION_CODE_ATTRIBUTE, '1');

      return resolve([
        yamlCodeEl,
        configuration,
        tableEl,
        tableData,
        indexOfTheDynamicTable,
      ]);
    }, 0);
  });
}

export function mountDynamicTables(
  app: App,
  yamlCodeEl: HTMLElement,
  configuration: EtConfiguration,
  tableEl: HTMLTableElement,
  tableData: RawTableData,
  indexOfTheDynamicTable: number,
) {
  Array.from(
    document.querySelectorAll(`div[${ET_RENDER_TABLE_ATTRIBUTE}="${indexOfTheDynamicTable}"]`),
  ).forEach((e) => e.remove());

  const rootElement = document.createElement('div');
  rootElement.setAttribute(
    ET_RENDER_TABLE_ATTRIBUTE,
    indexOfTheDynamicTable.toString(),
  );

  tableEl.after(rootElement);
  tableEl.classList.add('dynamic-table-hidden');

  if (configuration['hide-configuration']) {
    yamlCodeEl.parentElement?.remove();
  }

  const showSort = configuration.controls?.showSort ?? true;
  const showSearch = configuration.controls?.showSearch ?? true;
  const showFilter = configuration.controls?.showFilter ?? true;

  createRoot(rootElement).render(
    <DynamicTables
      app={app}
      configuration={configuration}
      tableData={tableData}
      indexOfTheDynamicTable={indexOfTheDynamicTable}
      showSort={showSort}
      showSearch={showSearch}
      showFilter={showFilter}
    />,
  );
}

function extractYamlCodeFromTheCodeBlock(
  yamlCodeEl: HTMLElement,
  ctx: MarkdownPostProcessorContext,
): string | null {
  try {
    const sectionInfo = ctx.getSectionInfo(yamlCodeEl);
    const pageLines = sectionInfo?.text.split('\n');

    if (!pageLines?.[sectionInfo!.lineStart].startsWith(ET_YAML_SIGNAL)) {
      return null;
    }

    const yamlCode = pageLines
      ?.slice(sectionInfo!.lineStart + 1, sectionInfo?.lineEnd)
      ?.join('\n');

    return yamlCode ?? null;
  } catch (e) {
    console.error('Cannot get the yaml configuration');
    console.error(e);
    return null;
  }
}

function lookDownForTheTable(element: HTMLElement): HTMLTableElement | null {
  function recurseFindTable(element: Element): Element | null {
    if (element.tagName?.toUpperCase() === 'TABLE') return element;
    for (const child of Array.from(element.children)) {
      const foundTable = recurseFindTable(child);
      if (foundTable) return foundTable;
    }
    return null;
  }

  let nextSibling = element.nextSibling;
  while (nextSibling) {
    const foundTable = recurseFindTable(nextSibling as Element);
    if (foundTable) return foundTable as HTMLTableElement;
    nextSibling = nextSibling.nextSibling;
  }

  return null;
}

function lookUpForTheYamlCode(element: HTMLElement): HTMLElement | null {
  function recurseFindYamlCode(element: Element): Element | null {
    if (element.tagName?.toUpperCase() === 'CODE') return element;
    for (const child of Array.from(element.children)) {
      const foundTable = recurseFindYamlCode(child);
      if (foundTable) return foundTable;
    }
    return null;
  }

  let previousSibling = element.previousSibling;
  while (previousSibling) {
    const foundYamlCode = recurseFindYamlCode(previousSibling as Element);
    if (foundYamlCode) return foundYamlCode as HTMLTableElement;
    previousSibling = previousSibling.nextSibling;
  }

  return null;
}

function extractRawTableData(element: HTMLTableElement): RawTableData {
  const columns = (element.findAll('thead > tr > th') ?? []).map(
    (cell) => cell.innerHTML,
  );

  const rows = (element.findAll('tbody > tr') ?? []).map(
    (row: HTMLTableRowElement) => {
      return row
        .findAll('td')
        .map((cell: HTMLTableCellElement) => cell.innerHTML);
    },
  );

  let rowDirections: (string | null)[] = Array.from(columns, () => null);

  if (rows.length > 0) {
    rowDirections = element
      .find('tbody > tr')
      ?.findAll('td')
      .map((cell: HTMLTableCellElement) => cell.getAttr('align') ?? null);
  }

  return { columns, rows, rowDirections };
}
