/**
 * Main plugin entry for the Dynamic Tables Obsidian plugin.
 *
 * Responsibilities:
 * - Initialize the plugin and register markdown post-processors to detect
 *   and render enhanced tables with YAML configurations.
 * - Handle file system events (rename/delete) to maintain synchronization
 *   of external JSON files storing checkbox states linked to markdown files.
 * - Provide a settings tab UI to verify plugin activation.
 */

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

/**
 * Type guard to check if the mount context is an error string.
 * @param possibleMountContext Any value to check
 * @returns True if the value is a string representing an error, else false
 */
function isError(possibleMountContext: any): possibleMountContext is string {
  return typeof possibleMountContext === 'string';
}

export default class DynamicTablePlugin extends Plugin {
  public tableManager = new TableManager();

  /**
   * Called when the plugin is loaded. Sets up the settings tab,
   * registers markdown post-processing, and file system event listeners.
   */
  async onload() {
    this.addSettingTab(new DynamicTablesSettingTab(this.app, this));

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
    }, 1);

    // Listen for vault file rename and delete events to sync external checkbox state files
    this.registerEvent(this.app.vault.on('rename', this.onFileRename.bind(this)));
    this.registerEvent(this.app.vault.on('delete', this.onFileDelete.bind(this)));
  }

  /**
   * Called when the plugin is unloaded.
   */
  onunload() {
    console.log("Dynamic Tables plugin unloaded.");
  }

  /**
   * Event handler for vault file rename events.
   * Renames the corresponding external JSON checkbox state file if it exists.
   * @param file The renamed file
   * @param oldPath The old path of the file before rename
   */
  async onFileRename(file: TFile, oldPath: string) {
    try {
      const basePath = this.getVaultBasePath();
      if (!basePath) return;

      if (file.extension !== 'md') return;

      const statesDir = path.join(basePath, '_checkbox-states');
      if (!fs.existsSync(statesDir)) return;

      const oldFileName = path.basename(oldPath, '.md');
      const newFileName = file.basename;

      const oldStateFilePath = path.join(statesDir, `${oldFileName}.json`);
      const newStateFilePath = path.join(statesDir, `${newFileName}.json`);

      if (fs.existsSync(oldStateFilePath)) {
        await fs.promises.rename(oldStateFilePath, newStateFilePath);
        console.log(`[DynamicTables] Renamed checkbox state file: ${oldStateFilePath} -> ${newStateFilePath}`);
      }
    } catch (error) {
      console.error('[DynamicTables] Error renaming checkbox state file:', error);
    }
  }

  /**
   * Event handler for vault file delete events.
   * Deletes the corresponding external JSON checkbox state file if it exists.
   * @param file The deleted file
   */
  async onFileDelete(file: TFile) {
    try {
      const basePath = this.getVaultBasePath();
      if (!basePath) return;

      if (file.extension !== 'md') return;

      const statesDir = path.join(basePath, '_checkbox-states');
      if (!fs.existsSync(statesDir)) return;

      const stateFilePath = path.join(statesDir, `${file.basename}.json`);

      if (fs.existsSync(stateFilePath)) {
        await fs.promises.unlink(stateFilePath);
        console.log(`[DynamicTables] Deleted checkbox state file: ${stateFilePath}`);
      }
    } catch (error) {
      console.error('[DynamicTables] Error deleting checkbox state file:', error);
    }
  }

  /**
   * Gets the base path of the vault if using a FileSystemAdapter (local vault).
   * Returns null if the vault is not local.
   * @returns The base path string or null
   */
  getVaultBasePath(): string | null {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      return adapter.getBasePath();
    }
    return null;
  }
}

/**
 * Settings tab UI class for the Dynamic Tables plugin.
 * Provides a simple interface to verify plugin activation.
 */
class DynamicTablesSettingTab extends PluginSettingTab {
  plugin: DynamicTablePlugin;

  constructor(app: App, plugin: DynamicTablePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Renders the settings tab contents.
   */
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
