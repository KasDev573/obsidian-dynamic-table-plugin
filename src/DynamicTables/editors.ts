/**
 * Editable Cell Editor Factory
 *
 * This module provides the makeEditor function which creates
 * interactive editing UI for table cells based on their data type.
 * Supported types include string, number, date/time, enum, and bool.
 *
 * The editor UI replaces the cell content on click, allowing inline editing.
 * Editing includes input validation, cancel and confirm buttons.
 * Date/time editors use native HTML input types with formatting support.
 * Enum editors use select dropdowns populated from column enums.
 * Bool editors use checkboxes with configurable yes/no text values.
 *
 * All editors call onChange callback when edits are confirmed or canceled.
 */

import { EtConfiguration, EtDataCell } from 'src/utils/types';
import { moment } from 'obsidian';
import {
  DEFAULT_BOOL_YES_INPUT,
  DEFAULT_BOOL_NO_INPUT,
  DEFAULT_TIME_FORMAT,
} from 'src/utils/sharedConstants';

// Mapping for HTML input types for date/time editors
const DATEPICKER_TYPES = {
  date: 'date',
  datetime: 'datetime-local',
  time: 'time',
};

// Corresponding moment.js date formats for parsing inputs
const DOM_DATE_FORMATS = {
  date: 'YYYY-MM-DD',
  datetime: 'YYYY-MM-DDTHH:mm',
  time: 'HH:mm',
};

/**
 * Helper function to create a button element with attached click handler.
 * Stops event propagation and default behavior on click.
 *
 * @param parent - Parent DOM element to append the button to.
 * @param text - Button display text.
 * @param onClick - Click event handler callback.
 * @param className - Optional CSS class name(s) for styling.
 * @returns The created HTMLButtonElement.
 */
function makeButton(
  parent: Element,
  text: string,
  onClick: () => void,
  className?: string,
): HTMLButtonElement {
  const button = parent.createEl('button', {
    text,
    cls: `editor-button ${className ?? ''}`,
  });

  button.addEventListener('click', (evt) => {
    evt.stopPropagation();
    evt.preventDefault();
    onClick();
  });

  return button;
}

/**
 * Helper function to create a container div with editor-specific styling.
 * Used to group editor UI elements.
 *
 * @returns A new HTMLDivElement with class 'editor-container'.
 */
function makeContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'editor-container';
  return container;
}

/**
 * Main function to instantiate an inline editor inside a table cell element
 * based on the data type of the column.
 * Supports string, number, date/time, enum, and bool editors.
 *
 * @param td - The target table cell HTMLElement to convert into an editor.
 * @param cell - The cell data, including column definition and current value.
 * @param configuration - Table-level configuration including formats.
 * @param onChange - Callback to invoke with new value when editing completes.
 */
export function makeEditor(
  td: HTMLElement,
  cell: EtDataCell,
  configuration: EtConfiguration,
  onChange: (val: string) => void,
) {
  // Determine the data type, treating enums without definitions as strings
  let type = cell.column.type;
  if (type === 'enum' && !cell.column.enum) {
    type = 'string';
  }

  switch (type) {
    // String and Number editors use a contenteditable div with validation and buttons
    case 'string':
    case 'number': {
      let editor: HTMLElement;
      const currentValue = td.innerHTML;

      // Click handler to switch cell to editing mode
      const onClickHandler = () => {
        td.removeEventListener('click', onClickHandler);
        td.textContent = '';

        // Create contenteditable div for input
        editor = document.createElement('div');
        editor.innerHTML = cell.rawValue;
        editor.setAttribute('contenteditable', 'true');

        // Create buttons container for Cancel and Done
        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('editor-mt-1em');

        // Cancel button resets to original value
        makeButton(
          buttonsContainer,
          'Cancel',
          () => {
            onChange(currentValue);
          },
          'editor-mr-5',
        );

        // Done button validates and commits changes
        makeButton(buttonsContainer, 'Done', () => {
          if (cell.column.type === 'number') {
            // Remove non-numeric characters
            editor.innerHTML = editor.innerHTML.replace(/[^0-9]/g, '');
          }
          onChange(editor.innerHTML);
        });

        // Append editor and buttons to the cell
        td.appendChild(editor);
        td.appendChild(buttonsContainer);
      };

      td.addEventListener('click', onClickHandler);

      // Support Esc key to commit edit early
      td.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
          onChange(editor.innerHTML);
        }
      });

      // Prevent invalid characters for number type input
      td.addEventListener('keydown', (e) => {
        if (cell.column.type === 'number') {
          if (!e.key.match(/[0-9.]/)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      });

      break;
    }

    // Date, Datetime, Time editors use native HTML input types with format support
    case 'date':
    case 'datetime':
    case 'time': {
      const currentValue = td.innerHTML;
      // Determine output format based on column type and table config
      const outputFormat = (() => {
        if (cell.column.type === 'time') {
          return DEFAULT_TIME_FORMAT;
        } else if (cell.column.type === 'datetime') {
          return configuration['datetime-format'];
        }
        return configuration['date-format'];
      })();

      // Determine input element type and moment format for parsing
      const datePickerType =
        DATEPICKER_TYPES[cell.column.type as keyof typeof DATEPICKER_TYPES];
      const domDateFormat =
        DOM_DATE_FORMATS[cell.column.type as keyof typeof DATEPICKER_TYPES];

      const onClickHandler = () => {
        td.removeEventListener('click', onClickHandler);
        td.textContent = '';

        // Buttons container for Cancel button
        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('editor-mt-1em');

        // Date picker container
        const datePickerContainer = makeContainer();

        // Create native date/time input with current value pre-filled
        const datePicker = document.createElement('input');
        datePicker.type = datePickerType;
        datePicker.value = cell.value
          ? cell.value.format('YYYY-MM-DD')
          : undefined;

        // On change, parse input and format according to output format
        datePicker.addEventListener('change', (e) => {
          // @ts-ignore
          const selectedDate = moment(e.target.value, domDateFormat);
          onChange(moment(selectedDate).format(outputFormat));
        });
        datePickerContainer.appendChild(datePicker);

        // Cancel button resets to original value
        makeButton(
          buttonsContainer,
          'Cancel',
          () => {
            onChange(currentValue);
          },
          'editor-mr-5',
        );

        // Append datepicker and buttons to cell
        td.appendChild(datePickerContainer);
        td.appendChild(buttonsContainer);
      };

      td.addEventListener('click', onClickHandler);

      break;
    }

    // Enum editor creates a dropdown select element with options from column enum map
    case 'enum': {
      const currentValue = td.innerHTML;

      const onClickHandler = () => {
        td.removeEventListener('click', onClickHandler);
        td.textContent = '';

        // Container div for select element
        const selectContainer = makeContainer();
        const select = document.createElement('select');

        select.addEventListener('change', (e) => {
          // @ts-ignore
          const value = e.target.options[e.target.selectedIndex].value;
          onChange(value);
        });

        selectContainer.appendChild(select);

        // Populate select options from enum map
        for (const [enumValue, enumRepresentation] of Object.entries(
          cell.column.enum as Record<string, string>,
        )) {
          const option = document.createElement('option');
          option.value = enumValue;
          option.innerHTML = enumRepresentation;

          if (enumValue === cell.value) {
            option.selected = true;
          }

          select.appendChild(option);
        }

        // Buttons container for Cancel button
        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('editor-mt-1em');

        // Cancel button resets to original value
        makeButton(
          buttonsContainer,
          'Cancel',
          () => {
            onChange(currentValue);
          },
          'editor-mr-5',
        );

        // Append select and buttons to cell
        td.appendChild(selectContainer);
        td.appendChild(buttonsContainer);
      };

      td.addEventListener('click', onClickHandler);

      break;
    }

    // Bool editor uses a checkbox with configurable true/false text formats
    case 'bool': {
      const currentValue = td.innerHTML;

      const onClickHandler = () => {
        td.removeEventListener('click', onClickHandler);
        td.textContent = '';

        // Checkbox input container
        const checkboxContainer = makeContainer();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = cell.value;

        // On checkbox change, update cell value with yes/no format strings
        checkbox.addEventListener('change', () => {
          // @ts-ignore
          const value = checkbox.checked
            ? configuration['yes-format'] ?? (DEFAULT_BOOL_YES_INPUT as string)
            : configuration['no-format'] ?? (DEFAULT_BOOL_NO_INPUT as string);

          onChange(value);
        });

        checkboxContainer.appendChild(checkbox);

        // Buttons container for Cancel button
        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('editor-mt-1em');

        // Cancel button resets to original value
        makeButton(
          buttonsContainer,
          'Cancel',
          () => {
            onChange(currentValue);
          },
          'editor-mr-5',
        );

        // Append checkbox and buttons to cell
        td.appendChild(checkboxContainer);
        td.appendChild(buttonsContainer);
      };

      td.addEventListener('click', onClickHandler);

      break;
    }
  }
}
