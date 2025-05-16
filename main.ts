import { Plugin, PluginSettingTab, App, Setting, Notice, TFile, FileSystemAdapter } from 'obsidian';

// Utility to retrieve and validate the table-related context from a markdown block
import {
  getMountContext,
  MountContext,
  mountEnhancedTables,
} from 'src/utils/mount';

// Handles table-related logic (formatting, data tracking, etc.)
import { TableManager } from 'src/TableManager';

// Import Node.js 'fs' and 'path' for file system operations
import * as fs from 'fs';
import * as path from 'path';

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

    // Register vault event listener for file renames
    this.registerEvent(
      this.app.vault.on('rename', this.onFileRename.bind(this))
    );
  }

  onunload() {
    console.log("Dynamic Tables plugin unloaded.");
  }

  /**
   * Handler for vault file rename events
   * @param file - The file that was renamed (TFile)
   * @param oldPath - The old path of the file before rename
   */
  async onFileRename(file: TFile, oldPath: string) {
    try {
      const basePath = this.getVaultBasePath();
      if (!basePath) return;

      // Only process markdown files
      if (file.extension !== 'md') return;

      const statesDir = path.join(basePath, '_checkbox-states');
      if (!fs.existsSync(statesDir)) return;

      const oldFileName = path.basename(oldPath, '.md');
      const newFileName = file.basename;

      const oldStateFilePath = path.join(statesDir, `${oldFileName}.json`);
      const newStateFilePath = path.join(statesDir, `${newFileName}.json`);

      // If the old checkbox state file exists, rename it to new filename
      if (fs.existsSync(oldStateFilePath)) {
        await fs.promises.rename(oldStateFilePath, newStateFilePath);
        console.log(`[DynamicTables] Renamed checkbox state file: ${oldStateFilePath} -> ${newStateFilePath}`);
      }
    } catch (error) {
      console.error('[DynamicTables] Error renaming checkbox state file:', error);
    }
  }

  /**
   * Helper to get the vault base path (folder containing your notes)
   */
  getVaultBasePath(): string | null {
    const adapter = this.app.vault.adapter;
    // Use instanceof to check for FileSystemAdapter and safely call getBasePath()
    if (adapter instanceof FileSystemAdapter) {
      return adapter.getBasePath();
    }
    return null;
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
