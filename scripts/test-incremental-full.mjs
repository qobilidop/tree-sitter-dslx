// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

import {
  createDslxParser,
  parseRequired,
  replaceIncrementally,
  repoRoot,
} from "./lib/dslx-wasm.mjs";

const revision = fs
  .readFileSync(path.join(repoRoot, "test/upstream/XLS_REVISION"), "utf8")
  .trim();
const corpusRoot = path.join(repoRoot, ".cache/upstream", `xls-${revision}`);
const exclusionLines = fs
  .readFileSync(path.join(repoRoot, "test/upstream/exclusions.tsv"), "utf8")
  .split("\n")
  .filter((line) => line !== "" && !line.startsWith("#"));
const exclusions = new Set(
  exclusionLines.map((line) => line.split("\t", 1)[0]),
);

function discover(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return discover(candidate);
    return entry.isFile() &&
      (entry.name.endsWith(".x") || entry.name.endsWith(".dslx"))
      ? [candidate]
      : [];
  });
}

const files = ["xls/dslx", "xls/examples", "xls/modules"]
  .flatMap((directory) => discover(path.join(corpusRoot, directory)))
  .sort()
  .filter((file) => !exclusions.has(path.relative(corpusRoot, file)));
const parser = await createDslxParser();
let edits = 0;
let changedRanges = 0;

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  let source = original;
  let tree = parseRequired(parser, source);
  const prefix = "// full incremental\n";
  const replacedPrefix = "// extended incremental\n";
  const editTrace = [
    { startIndex: 0, deleteCount: 0, insertText: prefix },
    { startIndex: 3, deleteCount: 4, insertText: "extended" },
    { startIndex: 0, deleteCount: replacedPrefix.length, insertText: "" },
  ];

  for (const edit of editTrace) {
    const result = replaceIncrementally(parser, tree, source, edit);
    source = result.source;
    tree = result.tree;
    edits += 1;
    changedRanges += result.changedRanges.length;
  }
  if (source !== original || tree.rootNode.hasError) {
    throw new Error(
      `Full edit trace did not restore ${path.relative(corpusRoot, file)}`,
    );
  }
  tree.delete();
}

parser.delete();
console.log(
  `Full incremental validation passed: revision=${revision} files=${files.length} edits=${edits} changed_ranges=${changedRanges}`,
);
