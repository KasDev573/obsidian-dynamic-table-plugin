/**
 * Main plugin entry for the Dynamic Tables Obsidian plugin.
 *
 * Responsibilities:
 * - Initialize the plugin and register markdown post-processors to detect
 *   and render dynamic tables with YAML configurations.
 * - Handle file system events (rename/delete) to maintain synchronization
 *   of external JSON files storing checkbox states linked to markdown files.
 * - Provide a settings tab UI with example YAML configuration and plugin info.
 */

import {
  Plugin,
  PluginSettingTab,
  App,
  Setting,
  TFile,
  ButtonComponent,
} from 'obsidian';

import {
  getMountContext,
  MountContext,
  mountDynamicTables,
} from 'src/utils/mount';

import { TableManager } from 'src/TableManager';
import * as fs from 'fs';
import * as path from 'path';

function isError(possibleMountContext: any): possibleMountContext is string {
  return typeof possibleMountContext === 'string';
}

export default class DynamicTablePlugin extends Plugin {
  public tableManager = new TableManager();

  async onload() {
    this.addSettingTab(new DynamicTablesSettingTab(this.app, this));

    this.registerMarkdownPostProcessor(async (el, ctx) => {
      try {
        const possibleMountContext = await getMountContext(el, ctx);

        if (!possibleMountContext) {
          return; // Allow Obsidian to render normally
        }

        if (isError(possibleMountContext)) {
          const errorsContainer = el.createDiv({ cls: 'dynamic-tables-errors' });
          errorsContainer.createDiv({ text: `⚠️ Validation errors:`, cls: 'dynamic-tables-error' });
          errorsContainer.createDiv({ text: `- ${possibleMountContext}`, cls: 'dynamic-tables-error' });
          return;
        }

        const [
          yamlCodeEl,
          configuration,
          tableEl,
          tableData,
          indexOfTheDynamicTable,
        ] = possibleMountContext as MountContext;

        setTimeout(() => {
          mountDynamicTables(
            this.app,
            yamlCodeEl,
            configuration,
            tableEl,
            tableData,
            indexOfTheDynamicTable,
          );
        }, 300);
      } catch (error) {
        console.error('[DynamicTables] Error in postprocessor:', error);
      }
    }, 1);

    this.registerEvent(this.app.vault.on('rename', this.onFileRename.bind(this)));
    this.registerEvent(this.app.vault.on('delete', this.onFileDelete.bind(this)));
  }

  onunload() {
    console.log("Dynamic Tables plugin unloaded.");
  }

  async onFileRename(file: TFile, oldPath: string) {
    try {
      const basePath = this.getVaultBasePath();
      if (!basePath || file.extension !== 'md') return;

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

  async onFileDelete(file: TFile) {
    try {
      const basePath = this.getVaultBasePath();
      if (!basePath || file.extension !== 'md') return;

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

  getVaultBasePath(): string | null {
    const adapter = this.app.vault.adapter;
    // Only return base path if getBasePath function exists (desktop)
    if ('getBasePath' in adapter && typeof (adapter as any).getBasePath === 'function') {
      return (adapter as any).getBasePath();
    }
    return null;
  }
}

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

    // GitHub repo button
    new Setting(containerEl)
      .setName("View Plugin Source Code")
      .setDesc("Visit the GitHub repository for documentation, issues, and updates.")
      .addButton((btn: ButtonComponent) =>
        btn.setButtonText("Open GitHub Repo")
          .setCta()
          .onClick(() => window.open("https://github.com/KasDev573/obsidian-dynamic-table-plugin", "_blank"))
      );

    // YAML block with copy button
    containerEl.createEl("h3", { text: "Example YAML Configuration" });
    const yamlContainer = containerEl.createDiv();
    const yamlText = `\`\`\`yaml dynamic-table
columns:
  Column A:
    alias: Column A
    type: string
    searchable: true
  Column B:
    alias: Column B
    type: string
    searchable: true
  Column C:
    alias: Column C
    type: string
    searchable: true

filters:
  Example Header 1:
    Column A: "$row['Column A']?.includes('true')"
    Column B: "$row['Column B']?.including('false')"

controls:
  showSort: true
  showSearch: true
  showFilter: true
  stickyHeader: true

styleEnhancements:
  zebraStriping: true
  rowHoverHighlight: true
  horizontalTextAlignment: left
  verticalTextAlignment: top

hide-configuration: true
\`\`\``;

    const copyYamlBtn = yamlContainer.createEl("button", { text: "Copy YAML" });
    copyYamlBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(yamlText);
        copyYamlBtn.textContent = "Copied!";
        setTimeout(() => (copyYamlBtn.textContent = "Copy YAML"), 1500);
      } catch (err) {
        console.error("[DynamicTables] Clipboard copy failed:", err);
        copyYamlBtn.textContent = "Failed to copy";
      }
    };

    const yamlBlock = yamlContainer.createEl("pre", {
      cls: "dynamic-tables-code-block"
    });
    yamlBlock.textContent = yamlText;

    // Markdown Table code block with copy button
    containerEl.createEl("h3", { text: "Example Markdown Table" });
    const markdownTableContainer = containerEl.createDiv();
    const markdownTableText = `| Column A                            | Column B                            | Column C |
| ----------------------------------- | ----------------------------------- | -------- |
| <input type="checkbox" id="68aad5"> | <input type="checkbox" id="2b6727"> | Text1    |
| <input type="checkbox" id="f797ca"> | <input type="checkbox" id="143b85"> | Text2    |
| <input type="checkbox" id="c545ad"> | <input type="checkbox" id="e04729"> | Text3    |
| <input type="checkbox" id="a8b8d4"> | <input type="checkbox" id="c9ec42"> | Text4    |`;

    const copyMarkdownBtn = markdownTableContainer.createEl("button", { text: "Copy Table" });
    copyMarkdownBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(markdownTableText);
        copyMarkdownBtn.textContent = "Copied!";
        setTimeout(() => (copyMarkdownBtn.textContent = "Copy Table"), 1500);
      } catch (err) {
        console.error("[DynamicTables] Clipboard copy failed:", err);
        copyMarkdownBtn.textContent = "Failed to copy";
      }
    };

    const markdownTableBlock = markdownTableContainer.createEl("pre", {
      cls: "dynamic-tables-code-block"
    });
    markdownTableBlock.textContent = markdownTableText;
  }
}
