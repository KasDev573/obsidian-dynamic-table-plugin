import { Plugin, TFile } from "obsidian";
import * as fs from "fs";
import * as path from "path";

/** In-memory cache: note path -> { key:boolean } to avoid flicker on re-render */
const memCache = new Map<string, Record<string, boolean>>();

/** Per-file write queue to serialize read-modify-write cycles */
const writeQueue = new Map<string, Promise<void>>();

/** Chain a write for a given path so concurrent writers don't interleave */
function queueWrite(filePath: string, fn: () => Promise<void>) {
  const prev = writeQueue.get(filePath) ?? Promise.resolve();
  const next = prev.then(fn).catch((e) => {
    console.error("[CalloutCheckboxSync] write failed:", e);
  });
  writeQueue.set(filePath, next);
  return next;
}

async function ensureStatesDir(getVaultBasePath: () => string | null): Promise<string | null> {
  const base = getVaultBasePath();
  if (!base) return null; // mobile/web: skip external fs
  const dir = path.join(base, "_checkbox-states");
  if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

async function getStateFilePath(getVaultBasePath: () => string | null, file: TFile) {
  const dir = await ensureStatesDir(getVaultBasePath);
  return dir ? path.join(dir, `${file.basename}.json`) : null;
}

async function readJson(p: string): Promise<Record<string, any>> {
  if (!fs.existsSync(p)) return {};
  try {
    const raw = await fs.promises.readFile(p, "utf8");
    const json = JSON.parse(raw);
    return (json && typeof json === "object") ? json : {};
  } catch (e) {
    console.warn("[CalloutCheckboxSync] JSON parse failed, will rewrite from scratch:", p, e);
    return {};
  }
}

async function saveBool(
  getVaultBasePath: () => string | null,
  file: TFile,
  key: string,
  val: boolean
) {
  const p = await getStateFilePath(getVaultBasePath, file);
  if (!p) return;

  // ✅ Update in-memory cache immediately (no flicker on next re-render)
  {
    const noteKey = file.path;
    const cached = memCache.get(noteKey) ?? {};
    cached[key] = val;
    memCache.set(noteKey, cached);
  }

  await queueWrite(p, async () => {
    const data = await readJson(p);
    // Only store a simple boolean for callouts (tables use their own schema in other notes)
    data[key] = val;
    await fs.promises.writeFile(p, JSON.stringify(data, null, 2), "utf8");
  });
}

async function loadStates(getVaultBasePath: () => string | null, file: TFile) {
  const p = await getStateFilePath(getVaultBasePath, file);
  if (!p) return {} as Record<string, boolean>;
  const data = await readJson(p);

  // If someone hand-edited to the Dynamic Tables object format in this note,
  // coerce booleans if possible, otherwise leave as-is.
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "boolean") out[k] = v;
    else if (v && typeof v === "object" && typeof (v as any).checked === "boolean") {
      out[k] = (v as any).checked;
    }
  }
  return out;
}

/**
 * Finds <input type="checkbox" id="..."> inside callouts and
 * persists them to _checkbox-states/<note>.json without interfering
 * with - [ ] tasks or Dynamic Tables.
 */
export function registerCalloutCheckboxSync(
  plugin: Plugin,
  getVaultBasePath: () => string | null
) {
  plugin.registerMarkdownPostProcessor(async (el, ctx) => {
    const af = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(af instanceof TFile)) return;

    // Only raw HTML inputs in callouts; skip markdown task checkboxes
    const inputs = Array.from(
      el.querySelectorAll<HTMLInputElement>(
        '.callout input[type="checkbox"]:not(.task-list-item-checkbox)'
      )
    ).filter((i) => i.id && i.id.trim().length > 0);

    if (inputs.length === 0) return;

    const noteKey = af.path;

    // ① Instant hydration from memory (zero-frame; prevents "all false" flash)
    const cached = memCache.get(noteKey);
    if (cached) {
      for (const input of inputs) {
        const key = `id:${input.id.trim()}`;
        if (cached[key] !== undefined) input.checked = !!cached[key];
      }
    }

    // ② Load from disk and hydrate; also keep cache in sync with disk
    const saved = await loadStates(getVaultBasePath, af);
    memCache.set(noteKey, { ...(memCache.get(noteKey) ?? {}), ...saved });

    const seen = new Set<string>();

    for (const input of inputs) {
      if ((input as any)._calloutBound) continue; // avoid double-binding on re-render
      (input as any)._calloutBound = true;

      const id = input.id.trim();
      const key = `id:${id}`;

      // Hydrate from saved state if present (disk beats DOM default)
      if (Object.prototype.hasOwnProperty.call(saved, key)) {
        input.checked = !!saved[key];
      } else {
        // Merge-in a default (whatever the DOM currently is; you want default false → red X)
        // Per-id merge write (serialized), never a full snapshot overwrite.
        saveBool(getVaultBasePath, af, key, input.checked).catch(console.error);
      }

      if (seen.has(key)) {
        console.warn("[CalloutCheckboxSync] duplicate checkbox id in note:", key);
      } else {
        seen.add(key);
      }

      input.addEventListener(
        "change",
        () => saveBool(getVaultBasePath, af, key, input.checked).catch(console.error),
        { passive: true }
      );
    }
  });
}
