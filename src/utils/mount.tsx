/**
 * mount.tsx
 *
 * Responsible for extracting the YAML configuration and associated HTML table from
 * the markdown post-processor element, validating the configuration, and mounting
 * the React component to render the enhanced dynamic table UI.
 *
 * Key functions include:
 * - getMountContext: retrieves and validates YAML config + table, returns context tuple
 * - mountEnhancedTables: mounts the EnhancedTables React component into the DOM
 * - Utility functions for navigating DOM to find YAML code block and table element
 * - Parsing raw table data for use by the React component
 */

import { App, MarkdownPostProcessorContext, parseYaml } from 'obsidian';
import {
  ET_CONFIGURATION_CODE_ATTRIBUTE,
  ET_CONFIGURATION_CODE_EL_ATTRIBUTE,
  ET_RENDER_TABLE_ATTRIBUTE,
  ET_YAML_SIGNAL,
} from 'src/utils/sharedConstants';
import { EtConfiguration, RawTableData } from 'src/utils/types';
import { EnhancedTables } from 'src/DynamicTables';
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

/**
 * Retrieves the YAML configuration and corresponding table element from the markdown
 * post-processor element. Validates YAML and parses table data for mounting.
 *
 * @param element The HTML element containing the table and YAML code block
 * @param ctx The markdown post processor context (for section info)
 * @returns MountContext tuple or null or a validation error string
 */
export async function getMountContext(
  element: HTMLElement,
  ctx: MarkdownPostProcessorContext,
): Promise<MountContext | null | string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      let yamlCodeEl = element.find('code.language-yaml');
      let tableEl = element.find('table') as HTMLTableElement;

      if (!yamlCodeEl && !tableEl) {
        return resolve(null);
      }

      if (yamlCodeEl && !tableEl) {
        const tableElement = lookDownForTheTable(element);
        if (tableElement) tableEl = tableElement;
      }

      if (tableEl && !yamlCodeEl) {
        const yamlCodeElement = lookUpForTheYamlCode(element);
        if (yamlCodeElement) yamlCodeEl = yamlCodeElement;
      }

      if (!tableEl || !yamlCodeEl) {
        return resolve(null);
      }

      const configurationString = extractYamlCodeFromTheCodeBlock(yamlCodeEl, ctx);

      if (!configurationString) {
        return resolve(null);
      }

      let configuration: EtConfiguration;
      try {
        configuration = parseYaml(configurationString);
      } catch (e) {
        return resolve('Cannot parse the yaml configuration');
      }

      const validOrValidationMessage = validateConfiguration(configuration);
      if (validOrValidationMessage !== true) {
        return resolve(validOrValidationMessage);
      }

      const tableData = extractRawTableData(tableEl);
      yamlCodeEl.setAttribute(ET_CONFIGURATION_CODE_EL_ATTRIBUTE, '1');

      const indexOfTheEnhancedTable = Array.from(
        document.querySelectorAll(`[${ET_CONFIGURATION_CODE_EL_ATTRIBUTE}]`),
      ).indexOf(yamlCodeEl);
      element.setAttribute(ET_CONFIGURATION_CODE_ATTRIBUTE, '1');

      return resolve([
        yamlCodeEl,
        configuration,
        tableEl,
        tableData,
        indexOfTheEnhancedTable,
      ]);
    }, 0);
  });
}

/**
 * Mounts the React EnhancedTables component into the DOM, replacing the original
 * HTML table with the enhanced dynamic table. Optionally hides the YAML configuration.
 *
 * @param app Obsidian App instance
 * @param yamlCodeEl The YAML code block HTMLElement
 * @param configuration Parsed YAML configuration object
 * @param tableEl The HTML table element to replace
 * @param tableData Parsed raw table data from the HTML table
 * @param indexOfTheEnhancedTable Index of the enhanced table instance
 */
export function mountEnhancedTables(
  app: App,
  yamlCodeEl: HTMLElement,
  configuration: EtConfiguration,
  tableEl: HTMLTableElement,
  tableData: RawTableData,
  indexOfTheEnhancedTable: number,
) {
  // Remove any previously mounted React root for this table index
  Array.from(
    document.querySelectorAll(
      `div[${ET_RENDER_TABLE_ATTRIBUTE}="${indexOfTheEnhancedTable}"]`,
    ),
  ).forEach((e) => e.remove());

  const rootElement = document.createElement('div');
  rootElement.setAttribute(
    ET_RENDER_TABLE_ATTRIBUTE,
    indexOfTheEnhancedTable.toString(),
  );
  tableEl.after(rootElement);
  tableEl.className = 'dynamic-table-hidden'; // Hide original table from view

  // Remove YAML configuration block from view if hide-configuration is true
  if (configuration['hide-configuration']) {
    yamlCodeEl.parentElement?.remove();
  }

  // Extract control visibility flags from configuration.controls with defaults
  const showSort = configuration.controls?.showSort ?? true;
  const showSearch = configuration.controls?.showSearch ?? true;
  const showFilter = configuration.controls?.showFilter ?? true;

  // Mount React EnhancedTables component
  createRoot(rootElement).render(
    <EnhancedTables
      app={app}
      configuration={configuration}
      tableData={tableData}
      indexOfTheEnhancedTable={indexOfTheEnhancedTable}
      showSort={showSort}
      showSearch={showSearch}
      showFilter={showFilter}
    />,
  );
}

/**
 * Extracts the YAML configuration string from the fenced code block element.
 * Uses the MarkdownPostProcessorContext to get text and section info.
 *
 * @param yamlCodeEl The YAML code HTMLElement
 * @param ctx The markdown post processor context
 * @returns The extracted YAML string or null if not found
 */
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

/**
 * Recursively searches downward in the DOM siblings for a <table> element.
 *
 * @param element Starting HTMLElement to search from
 * @returns The found HTMLTableElement or null if none found
 */
function lookDownForTheTable(element: HTMLElement): HTMLTableElement | null {
  function recurseFindTable(element: Element): Element | null {
    if (element.tagName?.toUpperCase() === 'TABLE') {
      return element;
    }

    for (const child of Array.from(element.children)) {
      const foundTable = recurseFindTable(child);
      if (foundTable) {
        return foundTable;
      }
    }

    return null;
  }

  let nextSibling = element.nextSibling;
  while (nextSibling) {
    const foundTable = recurseFindTable(nextSibling as Element);
    if (foundTable) {
      return foundTable as HTMLTableElement;
    }
    nextSibling = nextSibling.nextSibling;
  }

  return null;
}

/**
 * Recursively searches upward in the DOM siblings for a <code> element containing YAML.
 *
 * @param element Starting HTMLElement to search from
 * @returns The found code HTMLElement or null if none found
 */
function lookUpForTheYamlCode(element: HTMLElement): HTMLElement | null {
  function recurseFindYamlCode(element: Element): Element | null {
    if (element.tagName?.toUpperCase() === 'CODE') {
      return element;
    }

    for (const child of Array.from(element.children)) {
      const foundTable = recurseFindYamlCode(child);
      if (foundTable) {
        return foundTable;
      }
    }

    return null;
  }

  let previousSibling = element.previousSibling;
  while (previousSibling) {
    const foundYamlCode = recurseFindYamlCode(previousSibling as Element);
    if (foundYamlCode) {
      return foundYamlCode as HTMLTableElement;
    }
    previousSibling = previousSibling.nextSibling;
  }

  return null;
}

/**
 * Parses raw table data (columns, rows, row alignment) from a given HTML table element.
 *
 * @param element HTMLTableElement to parse
 * @returns RawTableData with columns, rows, and alignment info
 */
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
