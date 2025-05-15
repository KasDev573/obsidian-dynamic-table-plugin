import { App, normalizePath, TFile } from 'obsidian';

export class CheckboxStateManager {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  private async getStorageFilePath(file: TFile): Promise<string> {
    const baseName = file.path.replace(/\//g, '__').replace(/\.md$/, '');
    return `.obsidian/plugins/dynamic-table-plugin/data/states/${baseName}.json`;
  }

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

  public async saveState(file: TFile, checkboxId: string, checked: boolean): Promise<void> {
    const path = await this.getStorageFilePath(file);
    const data = await this.loadStates(file);
    data[checkboxId] = checked;
    await this.app.vault.adapter.write(path, JSON.stringify(data));
  }
}
