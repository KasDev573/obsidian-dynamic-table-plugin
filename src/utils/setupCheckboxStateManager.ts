import { App, TFile } from 'obsidian';
import { CheckboxStateManager } from 'src/CheckboxStateManager';

export function setupCheckboxStateManager(app: App) {
  const checkboxManager = new CheckboxStateManager(app);

  return {
    injectCheckboxState: async (file: TFile, checkboxes: Iterable<HTMLInputElement>) => {
      await checkboxManager.initializeCheckboxes(file, checkboxes);
      for (const checkbox of checkboxes) {
        checkbox.addEventListener('change', () => {
          checkboxManager.handleCheckboxChange(file, checkbox);
        });
      }
    },
  };
}
