// public/assets, public/data and public/i18n are gitignored — they're plain
// copies of src/assets and src/data, not source. Without this, a fresh clone
// (any OS) serves 404s for icons and every i18n.t() call silently falls back
// to its English default, because Vite has nothing to serve at those paths.
// Runs automatically before `vite`/`vite build` via the npm "pre" hooks below.
import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const copies = [
  ["src/assets", "public/assets"],
  ["src/data", "public/data"],
  ["src/data/i18n", "public/i18n"],
];

for (const [from, to] of copies) {
  await cp(path.join(root, from), path.join(root, to), {
    recursive: true,
    force: true,
  });
  console.log(`[sync-public-assets] ${from} -> ${to}`);
}
