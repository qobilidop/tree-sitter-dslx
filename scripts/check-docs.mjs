// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

import { repoRoot } from "./lib/dslx-wasm.mjs";

function markdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(candidate);
    return entry.isFile() && entry.name.endsWith(".md") ? [candidate] : [];
  });
}

const files = [
  path.join(repoRoot, "README.md"),
  path.join(repoRoot, "CONTRIBUTING.md"),
  path.join(repoRoot, "MVP_PLAN.md"),
  ...markdownFiles(path.join(repoRoot, "docs")),
];
const missing = [];

for (const file of files) {
  const markdown = fs.readFileSync(file, "utf8");
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, "").split("#", 1)[0];
    if (
      target === "" ||
      /^[a-z][a-z0-9+.-]*:/i.test(target) ||
      target.startsWith("#")
    ) {
      continue;
    }
    const decoded = decodeURIComponent(target);
    const resolved = path.resolve(path.dirname(file), decoded);
    if (!fs.existsSync(resolved)) {
      missing.push(`${path.relative(repoRoot, file)} -> ${target}`);
    }
  }
}

const coverage = fs.readFileSync(
  path.join(repoRoot, "docs/syntax-coverage.md"),
  "utf8",
);
if (/\|\s*(?:unknown|todo|tbd)\s*\||\b(?:todo|tbd):/i.test(coverage)) {
  throw new Error("Syntax coverage ledger contains an unresolved marker");
}
if (missing.length > 0) {
  throw new Error(`Missing local documentation links:\n${missing.join("\n")}`);
}

console.log(`Documentation checks passed: files=${files.length}`);
