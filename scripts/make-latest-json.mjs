// Assembles the updater manifest (latest.json) that the Tauri updater plugin
// polls on GitHub Releases. Run this AFTER `npm run tauri build` has produced
// a signed .msi (TAURI_SIGNING_PRIVATE_KEY[_PATH] must have been set for that
// build, or there will be no .sig file to read here).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = "SDPL-Oh/aion2_zzuri";

const tauriConf = JSON.parse(
  readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8")
);
const version = tauriConf.version;

const msiDir = path.join(root, "src-tauri/target/release/bundle/msi");
const allMsiFiles = readdirSync(msiDir).filter((f) => f.endsWith(".msi"));
// Old builds from earlier version bumps pile up in this folder (Tauri never
// cleans it), so "the one file in here" isn't a safe assumption past the
// first release — match on the current version instead.
const msiFiles = allMsiFiles.filter((f) => f.includes(version));
if (msiFiles.length !== 1) {
  throw new Error(
    `Expected exactly one .msi containing "${version}" in ${msiDir}, found: ` +
      `${msiFiles.join(", ") || "none"} (other builds present: ${allMsiFiles.join(", ") || "none"}). ` +
      `Run "npm run tauri build" first (with TAURI_SIGNING_PRIVATE_KEY set), or delete the stale .msi/.sig ` +
      `for a version you no longer want to publish.`
  );
}
const msiName = msiFiles[0];
const sigPath = path.join(msiDir, `${msiName}.sig`);
let signature;
try {
  signature = readFileSync(sigPath, "utf8").trim();
} catch {
  throw new Error(
    `No .sig next to ${msiName}. The build wasn't signed — set TAURI_SIGNING_PRIVATE_KEY ` +
      `(or _PATH) to src-tauri/updater.key before "npm run tauri build".`
  );
}

const latest = {
  version,
  notes: `zzuring v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${REPO}/releases/download/v${version}/${encodeURIComponent(msiName)}`,
    },
  },
};

const outPath = path.join(msiDir, "latest.json");
writeFileSync(outPath, JSON.stringify(latest, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`\nCreate a GitHub Release tagged v${version} and attach BOTH files from ${msiDir}:`);
console.log(`  - ${msiName}`);
console.log(`  - latest.json`);
