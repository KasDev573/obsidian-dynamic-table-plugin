import { Plugin } from 'obsidian';

// Utility to retrieve and validate the table-related context from a markdown block
import {
  getMountContext,
  MountContext,
  mountEnhancedTables,
} from 'src/utils/mount';

// Handles table-related logic (formatting, data tracking, etc.)
import { TableManager } from 'src/TableManager';

// Helper function to identify if something went wrong while getting context
function isError(possibleMountContext: any): possibleMountContext is string {
  return typeof possibleMountContext === 'string';
}

export default class DynamicTablePlugin extends Plugin {
  // Instance of the table manager that manages table logic
  public tableManager = new TableManager();

  async onload() {
    // Hook into Obsidian's markdown post-processor
    // This runs after markdown is rendered in the preview pane
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      // Tries to get structured data about the table and its configuration
      const possibleMountContext = await getMountContext(el, ctx);

      // If nothing is returned, silently exit
      if (!possibleMountContext) {
        return;
      }

      // If an error string is returned, display it in the rendered markdown
      if (isError(possibleMountContext)) {
        const errorsContainer = el.createDiv({ cls: 'enhanced-tables-errors' });

        errorsContainer.createDiv({
          text: `⚠️ Validation errors:`,
          cls: 'dynamic-tables-error',
        });

        errorsContainer.createDiv({
          text: `- ${possibleMountContext}`,
          cls: 'dynamic-tables-error',
        });

        return;
      }

      // De-structure the successfully parsed table context
      const [
        yamlCodeEl,                 // The code block containing YAML config (if any)
        configuration,              // Parsed configuration object
        tableEl,                    // The actual <table> element in the preview
        tableData,                  // Parsed data from the markdown table
        indexOfTheEnhancedTable,    // Its position in the document
      ] = possibleMountContext as MountContext;

      // Slight delay to ensure the DOM is fully ready before enhancing the table
      setTimeout(() => {
        // Mount enhanced table functionality — adds interactivity, formatting, etc.
        mountEnhancedTables(
          this.app,
          yamlCodeEl,
          configuration,
          tableEl,
          tableData,
          indexOfTheEnhancedTable,
        );
      }, 300);
    }, 1); // Priority for post-processor
  }
}
