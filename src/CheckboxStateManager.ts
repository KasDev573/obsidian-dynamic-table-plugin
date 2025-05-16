/**
 * checkboxstatemanager.ts
 *
 * Manages the persistent storage and retrieval of checkbox states for
 * markdown files in Obsidian. Saves states in JSON files under the plugin's
 * data directory, mapping checkbox IDs to their checked status.
 */

import { App, TFile } from 'obsidian';

export class CheckboxStateManager {
  private app: App;

  /**
   * Creates an instance of CheckboxStateManager.
   * @param app The Obsidian application instance for accessing vault and filesystem
   */
  constructor(app: App) {
    this.app = app;
  }

  /**
   * Generates the file path for storing checkbox states of a given markdown file.
   * The path is based on the file's normalized path with slashes replaced by '__',
   * saved under the plugin's data/states directory.
   *
   * @param file The Obsidian markdown file to get the state path for
   * @returns The relative path to the JSON state file for the given markdown file
   */
  private async getStorageFilePath(file: TFile): Promise<string> {
    const baseName = file.path.replace(/\//g, '__').replace(/\.md$/, '');
    return `.obsidian/plugins/dynamic-table-plugin/data/states/${baseName}.json`;
  }

  /**
   * Loads the checkbox states for a given markdown file.
   *
   * @param file The markdown file whose checkbox states should be loaded
   * @returns A promise resolving to an object mapping checkbox IDs to their checked boolean values
   */
  public async loadStates(file: TFile): Promise<Record<string, boolean>> {
    const path = await this.getStorageFilePath(file);
    try {
      const fileExists = await this.app.vault.adapter.exists(path);
      if (!fileExists) return {};
      const raw = await this.app.vault.adapter.read(path);
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /**
   * Saves the checked state of a checkbox identified by checkboxId for the given markdown file.
   * Loads existing states, updates or adds the checkbox state, then writes back to the file.
   *
   * @param file The markdown file associated with the checkbox state
   * @param checkboxId The unique ID of the checkbox input element
   * @param checked The boolean checked state to save
   */
  public async saveState(file: TFile, checkboxId: string, checked: boolean): Promise<void> {
    const path = await this.getStorageFilePath(file);
    const data = await this.loadStates(file);
    data[checkboxId] = checked;
    await this.app.vault.adapter.write(path, JSON.stringify(data));
  }
}
