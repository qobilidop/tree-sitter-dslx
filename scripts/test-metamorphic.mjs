// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

import {
  createDslxParser,
  parseRequired,
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
const exclusions = new Set(exclusionLines.map((line) => line.split("\t", 1)[0]));

function discover(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return discover(candidate);
    return entry.isFile() && (entry.name.endsWith(".x") || entry.name.endsWith(".dslx"))
      ? [candidate]
      : [];
  });
}

const files = ["xls/dslx", "xls/examples", "xls/modules"]
  .flatMap((directory) => discover(path.join(corpusRoot, directory)))
  .sort()
  .filter((file) => !exclusions.has(path.relative(corpusRoot, file)));
const parser = await createDslxParser();
let variants = 0;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const transforms = [
    `// metamorphic-prefix\n${source}`,
    `${source}\n// metamorphic-suffix\n`,
    source.replaceAll("\n", "\r\n"),
  ];
  for (const transformed of transforms) {
    const tree = parseRequired(parser, transformed);
    if (tree.rootNode.hasError) {
      tree.delete();
      throw new Error(`Metamorphic parse failed: ${path.relative(corpusRoot, file)}`);
    }
    tree.delete();
    variants += 1;
  }
}

parser.delete();
console.log(`Metamorphic validation passed: files=${files.length} variants=${variants}`);
