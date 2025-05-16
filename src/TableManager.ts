/**
 * tablemanager.ts
 *
 * Provides utilities to parse, manipulate, and serialize markdown tables within
 * a markdown document string. Supports reading and modifying table content,
 * including headers, rows, insertion, and deletion of lines.
 */

const SUB_HEADER_LINE_REGEX = /^\|\s*-[-\s|]*?-\s*\|$/gm;
const LINE_REGEX = /^\|.*?\|$/gm;

export type LineValues = string[];

type BlockOfText = {
  type: 'text' | 'table';
  lines: string[];
};

/**
 * Parses a markdown document into blocks of text and tables.
 * Allows isolated manipulation of markdown tables in the document.
 */
class TableDocument {
  blocks: BlockOfText[];

  /**
   * Constructs a TableDocument instance by parsing file content into blocks.
   * @param fileContent The full markdown document content as string
   */
  constructor(fileContent: string) {
    this.blocks = TableDocument.documentToBlocks(fileContent);
  }

  /**
   * Serializes the document back into a markdown string.
   * @returns Markdown string representing the full document
   */
  public toString() {
    return this.blocks.flatMap((b) => b.lines).join('\n');
  }

  /**
   * Retrieves the table block at the specified index.
   * @param index The zero-based index of the table in the document
   * @returns The table block or undefined if none exists at that index
   */
  public getTable(index: number) {
    return this.blocks.filter((b) => b.type === 'table')[index];
  }

  /**
   * Checks if the document contains any markdown tables.
   * @returns True if one or more tables are found, else false
   */
  public hasTables() {
    return this.blocks.some((b) => b.type === 'table');
  }

  /**
   * Static helper method that splits the document content into blocks of text and tables.
   * @param fileContent The full markdown document content as string
   * @returns Array of BlockOfText objects representing text and table blocks
   */
  private static documentToBlocks(fileContent: string): BlockOfText[] {
    const lines = fileContent.split('\n');

    const blocksOfText: BlockOfText[] = [];
    let currentBlockOfText: BlockOfText | null = null;

    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
      const line = lines[lineNo];

      // Detect start of a markdown table
      if (
        line.match(LINE_REGEX) &&
        lines[lineNo + 1]?.match(SUB_HEADER_LINE_REGEX)
      ) {
        if (currentBlockOfText) {
          blocksOfText.push(currentBlockOfText);
        }
        currentBlockOfText = { lines: [line], type: 'table' };
        continue;
      }

      // If inside a table block, add lines that are table lines or close block
      if (currentBlockOfText?.type === 'table') {
        if (line.match(LINE_REGEX)) {
          currentBlockOfText.lines.push(line);
          continue;
        }
        blocksOfText.push(currentBlockOfText);
        currentBlockOfText = { lines: [line], type: 'text' };
        continue;
      }

      // Otherwise add line to current text block
      if (!currentBlockOfText) {
        currentBlockOfText = { lines: [], type: 'text' };
      }
      currentBlockOfText.lines.push(line);
    }

    // Push last block
    if (currentBlockOfText) {
      blocksOfText.push(currentBlockOfText);
    }

    return blocksOfText;
  }
}

/**
 * TableManager class exposes methods for reading and modifying markdown tables
 * within a document string, including insert, modify, remove lines, and reading content.
 */
export class TableManager {
  /**
   * Inserts a new line with the given values into a specified table at the given line number.
   * @param fileContent Full markdown content string
   * @param lineNo Zero-based line number to insert after (-1 means append last)
   * @param values Array of cell values for the new row
   * @param tableIndex Index of the table in the document (default 0)
   * @returns Updated markdown string with the line inserted
   */
  public insertLine(
    fileContent: string,
    lineNo: number,
    values: LineValues,
    tableIndex: number = 0,
  ): string {
    const tableDocument = new TableDocument(fileContent);

    if (!tableDocument.hasTables()) {
      return fileContent;
    }

    const tableBlock = tableDocument.getTable(tableIndex);
    if (!tableBlock) {
      return fileContent;
    }

    let targetLineNo = lineNo + 2; // Account for header and separator lines
    if (lineNo === -1) {
      targetLineNo = tableBlock.lines.length; // Insert at end if lineNo -1
    }

    tableBlock.lines.splice(targetLineNo, 0, this.valuesToLine(values));

    return tableDocument.toString();
  }

  /**
   * Modifies an existing line in a specified table with new values.
   * @param fileContent Full markdown content string
   * @param lineNo Zero-based line number to modify (-1 means last line)
   * @param values Array of new cell values for the row
   * @param tableIndex Index of the table in the document (default 0)
   * @returns Updated markdown string with the modified line
   */
  public modifyLine(
    fileContent: string,
    lineNo: number,
    values: LineValues,
    tableIndex: number = 0,
  ): string {
    const tableDocument = new TableDocument(fileContent);

    if (!tableDocument.hasTables()) {
      return fileContent;
    }

    const tableBlock = tableDocument.getTable(tableIndex);
    if (!tableBlock) {
      return fileContent;
    }

    let targetLineNo = lineNo + 2;
    if (lineNo === -1) {
      targetLineNo = tableBlock.lines.length;
    }

    if (!tableBlock.lines.hasOwnProperty(targetLineNo)) {
      return fileContent;
    }

    tableBlock.lines[targetLineNo] = this.valuesToLine(values);

    return tableDocument.toString();
  }

  /**
   * Modifies the header line of a specified table.
   * @param fileContent Full markdown content string
   * @param values Array of new cell values for the header
   * @param tableIndex Index of the table in the document (default 0)
   * @returns Updated markdown string with modified header
   */
  public modifyHeader(
    fileContent: string,
    values: LineValues,
    tableIndex: number = 0,
  ): string {
    return this.modifyLine(fileContent, -2, values, tableIndex);
  }

  /**
   * Removes a line from a specified table.
   * @param fileContent Full markdown content string
   * @param lineNo Zero-based line number to remove (-1 means last line)
   * @param tableIndex Index of the table in the document (default 0)
   * @returns Updated markdown string with the line removed
   */
  public removeLine(
    fileContent: string,
    lineNo: number,
    tableIndex: number = 0,
  ): string {
    const tableDocument = new TableDocument(fileContent);

    if (!tableDocument.hasTables()) {
      return fileContent;
    }

    const tableBlock = tableDocument.getTable(tableIndex);
    if (!tableBlock) {
      return fileContent;
    }

    let targetLineNo = lineNo + 2;
    if (lineNo === -1) {
      targetLineNo = tableBlock.lines.length;
    }

    tableBlock.lines.splice(targetLineNo, 1);

    return tableDocument.toString();
  }

  /**
   * Reads the values of a line in a specified table.
   * @param fileContent Full markdown content string
   * @param lineNo Zero-based line number to read (-1 means last line)
   * @param tableIndex Index of the table in the document (default 0)
   * @returns Array of string values for the row, or null if invalid
   */
  public readLine(
    fileContent: string,
    lineNo: number,
    tableIndex: number = 0,
  ): LineValues | null {
    const tableDocument = new TableDocument(fileContent);

    if (!tableDocument.hasTables()) {
      return null;
    }

    const tableBlock = tableDocument.getTable(tableIndex);
    if (!tableBlock) {
      return null;
    }

    let targetLineNo = lineNo + 2;
    if (lineNo === -1) {
      targetLineNo = tableBlock.lines.length;
    }

    const line = tableBlock.lines.at(targetLineNo);

    if (line) {
      return this.lineToValues(line);
    }

    return null;
  }

  /**
   * Reads all lines of a specified table.
   * @param fileContent Full markdown content string
   * @param tableIndex Index of the table in the document (default 0)
   * @returns Array of rows, each row an array of cell strings, or null if no table found
   */
  public readTableLines(
    fileContent: string,
    tableIndex: number = 0,
  ): LineValues[] | null {
    const tableDocument = new TableDocument(fileContent);

    if (!tableDocument.hasTables()) {
      return null;
    }

    const tableBlock = tableDocument.getTable(tableIndex);
    if (!tableBlock) {
      return null;
    }

    return tableBlock.lines.map((l) => this.lineToValues(l));
  }

  /**
   * Converts an array of string cell values into a markdown table line.
   * @param values Array of strings representing cell values
   * @returns String formatted as a markdown table row
   */
  private valuesToLine(values: LineValues): string {
    return `|${values.map((v) => v.trim()).join('|')}|`;
  }

  /**
   * Parses a markdown table line into an array of cell values.
   * @param line Markdown table row string
   * @returns Array of cell strings
   */
  private lineToValues(line: string): LineValues {
    return line.replace(/^\|/, '').replace(/\|$/, '').split('|');
  }
}
