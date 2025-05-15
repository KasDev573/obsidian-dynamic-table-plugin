// Signal that tells the plugin to look for a YAML config block
export const ET_YAML_SIGNAL = '```yaml dynamic-table';

// Attributes used to mark up HTML elements for plugin logic
export const ET_RENDER_TABLE_ATTRIBUTE = 'data-dt-table';
export const ET_CONFIGURATION_CODE_ATTRIBUTE = 'data-dt-configuration';
export const ET_CONFIGURATION_CODE_EL_ATTRIBUTE = 'data-dt-configuration-code';

// Default formatting values for table cells and fields
export const DEFAULT_COLUMNS_TYPE = 'string';
export const DEFAULT_NUMBER_FORMAT = {};
export const DEFAULT_DATE_FORMAT = 'DD-MM-YYYY';
export const DEFAULT_DATE_TIME_FORMAT = 'DD-MM-YYYY HH:mm';
export const DEFAULT_TIME_FORMAT = 'HH:mm';
export const DEFAULT_BOOL_YES_INPUT = '1';
export const DEFAULT_BOOL_NO_INPUT = '0';
export const DEFAULT_BOOL_YES_FORMAT = '✔️';
export const DEFAULT_BOOL_NO_FORMAT = '✖️';

// Pagination
export const DEFAULT_PAGE_SIZE = 25;
export const DEFAULT_PAGES_SIZE_OPTIONS = [25, 50, 100];
