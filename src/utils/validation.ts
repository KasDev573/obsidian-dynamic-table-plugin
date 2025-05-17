/**
 * validation.ts
 *
 * Defines JSON schema validation for Dynamic Tables plugin configuration.
 * Uses the Ajv library to compile and validate the YAML-derived configuration object
 * against a strict JSON schema to ensure correctness and prevent invalid configurations.
 *
 * This validation covers all configuration options including column definitions,
 * pagination, filters, UI control toggles, and formatting options.
 */

import Ajv from 'ajv';

import { EtConfiguration } from 'src/utils/types';

// JSON Schema defining the structure and allowed types/values
// for the plugin configuration object parsed from YAML.
export const VALIDATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    'date-format': {
      type: 'string',
    },
    'datetime-format': {
      type: 'string',
    },
    'yes-format': {
      type: 'string',
    },
    'no-format': {
      type: 'string',
    },
    filter: {
      type: 'string',
    },
    sort: {
      type: 'string',
    },
    'hide-controls': {
      type: 'boolean',
    },
    'hide-configuration': {
      type: 'boolean',
    },
    style: {
      type: 'string',
    },
    editable: {
      type: 'boolean',
    },
    filters: {
      type: 'object',
      additionalProperties: {
        anyOf: [
          { type: 'string' },
          {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        ],
      },
    },
    pagination: {
      type: 'object',
      properties: {
        'page-size': {
          type: 'number',
        },
        'page-sizes': {
          type: 'array',
          items: {
            type: 'number',
          },
        },
      },
      additionalProperties: false,
    },
    columns: {
      type: 'object',
      propertyNames: {
        pattern: '^.*$',
      },
      additionalProperties: {
        type: 'object',
        properties: {
          alias: {
            type: 'string',
          },
          hidden: {
            type: 'boolean',
          },
          nowrap: {
            type: 'boolean',
          },
          'number-format': {
            type: 'string',
          },
          'date-format': {
            type: 'string',
          },
          'yes-format': {
            type: 'string',
          },
          'no-format': {
            type: 'string',
          },
          formatter: {
            type: 'string',
          },
          editable: {
            type: 'boolean',
          },
          searchable: {
            type: 'boolean',
          },
        },
        patternProperties: {
          '^type$': {
            enum: [
              'string',
              'number',
              'date',
              'datetime',
              'time',
              'enum',
              'bool',
            ],
          },
          '^enum$': {
            type: 'object',
            propertyNames: {
              pattern: '^.*$',
            },
            additionalProperties: {
              type: 'string',
            },
          },
        },
        additionalProperties: false,
      },
    },
    controls: {
      type: 'object',
      properties: {
        showSort: { type: 'boolean' },
        showSearch: { type: 'boolean' },
        showFilter: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    styleEnhancements: {
      type: 'object',
      properties: {
        zebraStriping: { type: 'boolean' },
        rowHoverHighlight: { type: 'boolean' }
      },
      additionalProperties: false
    },
  },
  additionalProperties: false,
};

/**
 * Validates a Dynamic Tables plugin configuration object against
 * the JSON schema defined above.
 *
 * @param configuration The configuration object to validate
 * @returns true if valid, otherwise a string describing validation errors
 */
export function validateConfiguration(
  configuration: EtConfiguration,
): true | string {
  const ajv = new Ajv();
  const validate = ajv.compile(VALIDATION_JSON_SCHEMA);

  const valid = validate(configuration);

  if (!valid) {
    // Aggregate all validation error messages into a single string
    return validate
      .errors!.map((e) => `${e.instancePath} ${e.message}`)
      .join(' // ');
  }

  return true;
}
