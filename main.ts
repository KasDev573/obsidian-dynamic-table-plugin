import { Plugin, PluginSettingTab, App, Setting, Notice } from 'obsidian';

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
    // Register the plugin's settings tab in Obsidian's UI
    this.addSettingTab(new DynamicTablesSettingTab(this.app, this));

    // Hook into Obsidian's markdown post-processor
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      const possibleMountContext = await getMountContext(el, ctx);

      if (!possibleMountContext) return;

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

      const [
        yamlCodeEl,
        configuration,
        tableEl,
        tableData,
        indexOfTheEnhancedTable,
      ] = possibleMountContext as MountContext;

      setTimeout(() => {
        mountEnhancedTables(
          this.app,
          yamlCodeEl,
          configuration,
          tableEl,
          tableData,
          indexOfTheEnhancedTable,
        );
      }, 300);
    }, 1); // Post-processor priority
  }

  onunload() {
    console.log("Dynamic Tables plugin unloaded.");
  }
}

// Settings Tab Class
class DynamicTablesSettingTab extends PluginSettingTab {
  plugin: DynamicTablePlugin;

  constructor(app: App, plugin: DynamicTablePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Dynamic Tables Plugin Settings" });

    new Setting(containerEl)
      .setName("Test Plugin")
      .setDesc("Click to verify that the Dynamic Tables plugin is active.")
      .addButton((btn) =>
        btn
          .setButtonText("Run Test")
          .setCta()
          .onClick(() => {
            new Notice("✅ Dynamic Tables plugin is working!");
            console.log("[DynamicTables] Test run successful.");
          })
      );
  }
}
