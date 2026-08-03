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
const malformedTables = [];

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

  let tableSeparatorCount;
  for (const [index, line] of markdown.split("\n").entries()) {
    if (!/^\s*\|/.test(line)) {
      tableSeparatorCount = undefined;
      continue;
    }
    const separatorCount = [...line.matchAll(/(?<!\\)\|/g)].length;
    tableSeparatorCount ??= separatorCount;
    if (separatorCount !== tableSeparatorCount) {
      malformedTables.push(
        `${path.relative(repoRoot, file)}:${index + 1} has ${separatorCount - 1} columns; expected ${tableSeparatorCount - 1}`,
      );
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
if (malformedTables.length > 0) {
  throw new Error(`Malformed Markdown tables:\n${malformedTables.join("\n")}`);
}

console.log(`Documentation checks passed: files=${files.length}`);
