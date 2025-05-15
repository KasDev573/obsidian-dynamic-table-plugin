import { EtDataColumn, CellValueFormatter } from 'src/utils/types';

export function makeFormatterForColumn(
  column: EtDataColumn,
  formatter?: string,
): CellValueFormatter {
  if (formatter) {
    try {
      const fn = new Function('$cell', '$row', '$ctx', `return ${formatter}`);
      return (cell, row, ctx) => {
        try {
          return fn(cell, row, ctx);
        } catch {
          return cell;
        }
      };
    } catch {
      // fallback to raw value if formatting fails
      return (cell) => cell;
    }
  }

  switch (column.type) {
    case 'number':
      return (val) => {
        try {
          return val.toLocaleString(undefined, column.numberFormat);
        } catch {
          return val;
        }
      };
    case 'bool':
      return (val) => {
        try {
          return val ? column.yesFormat : column.noFormat;
        } catch {
          return val;
        }
      };
    case 'date':
    case 'datetime':
    case 'time':
      return (val) => {
        try {
          return val.format(column.dateFormat);
        } catch {
          return val;
        }
      };
    case 'enum':
      return (val) => {
        try {
          return (column.enum ?? {})[val] ?? val;
        } catch {
          return val;
        }
      };
    default:
      return (val) => val;
  }
}

export function parseNumberFormat(
  format: string,
  defaultFormat: Record<string, any>,
): Record<string, any> {
  try {
    const fn = new Function(`return ({${format}})`);
    return fn();
  } catch {
    return defaultFormat;
  }
}
