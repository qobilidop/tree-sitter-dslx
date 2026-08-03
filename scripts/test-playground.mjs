// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Language, Parser, Query } from "web-tree-sitter";

import { repoRoot } from "./lib/dslx-wasm.mjs";

const dist = path.join(repoRoot, "dist");
const required = [
  ".nojekyll",
  "app.js",
  "examples.json",
  "favicon.svg",
  "highlights.scm",
  "index.html",
  "styles.css",
  "tree-sitter-dslx.wasm",
  "web-tree-sitter.js",
  "web-tree-sitter.wasm",
];
for (const relativePath of required) {
  assert.ok(
    fs.existsSync(path.join(dist, relativePath)),
    `Missing ${relativePath}`,
  );
}

const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
assert.doesNotMatch(
  html,
  /(?:href|src)="\//,
  "Assets must use a Pages-safe relative path",
);
assert.match(html, /dslx_ls/);
assert.match(html, /Syntax only/);
assert.deepEqual(
  fs.readFileSync(path.join(dist, "highlights.scm")),
  fs.readFileSync(path.join(repoRoot, "queries/highlights.scm")),
);
assert.deepEqual(
  fs.readFileSync(path.join(dist, "tree-sitter-dslx.wasm")),
  fs.readFileSync(path.join(repoRoot, "build/tree-sitter-dslx.wasm")),
);

await Parser.init();
const language = await Language.load(path.join(dist, "tree-sitter-dslx.wasm"));
const parser = new Parser();
parser.setLanguage(language);
const query = new Query(
  language,
  fs.readFileSync(path.join(dist, "highlights.scm"), "utf8"),
);
const examples = JSON.parse(
  fs.readFileSync(path.join(dist, "examples.json"), "utf8"),
);
for (const example of examples) {
  const tree = parser.parse(example.source);
  assert.ok(tree !== null, `Parser cancelled for ${example.id}`);
  assert.equal(tree.rootNode.hasError, false, `Invalid example: ${example.id}`);
  assert.ok(
    query.captures(tree.rootNode).length > 0,
    `No highlights captured for ${example.id}`,
  );
  tree.delete();
}
query.delete();
parser.delete();

console.log(
  `Playground smoke passed: assets=${required.length} examples=${examples.length}`,
);
