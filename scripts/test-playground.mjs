// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Language, Parser, Query } from "web-tree-sitter";

import { repoRoot } from "./lib/dslx-wasm.mjs";

function collectRecoveryNodes(root) {
  const recoveries = [];
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node.isError || node.isMissing) recoveries.push(node);
    for (let index = 0; index < node.childCount; index += 1) {
      const child = node.child(index);
      if (child !== null) pending.push(child);
    }
  }
  return recoveries;
}

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
assert.doesNotMatch(html, /dslx_ls|dslx_language_server/);
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
const mutationLabels = new Set();
for (const example of examples) {
  const tree = parser.parse(example.source);
  assert.ok(tree !== null, `Parser cancelled for ${example.id}`);
  assert.equal(tree.rootNode.hasError, false, `Invalid example: ${example.id}`);
  assert.ok(
    query.captures(tree.rootNode).length > 0,
    `No highlights captured for ${example.id}`,
  );
  tree.delete();

  const mutation = example.mutation;
  for (const field of ["introduceLabel", "repairLabel", "before", "after"]) {
    assert.equal(
      typeof mutation[field],
      "string",
      `Missing mutation ${field}: ${example.id}`,
    );
    assert.ok(
      mutation[field].length > 0,
      `Empty mutation ${field}: ${example.id}`,
    );
  }
  assert.equal(
    example.source.split(mutation.before).length - 1,
    1,
    `Mutation target must be unique: ${example.id}`,
  );
  assert.equal(
    example.source.includes(mutation.after),
    false,
    `Broken mutation already present: ${example.id}`,
  );
  assert.equal(
    mutationLabels.has(mutation.introduceLabel),
    false,
    `Duplicate mutation label: ${mutation.introduceLabel}`,
  );
  mutationLabels.add(mutation.introduceLabel);

  const brokenSource = example.source.replace(mutation.before, mutation.after);
  const brokenTree = parser.parse(brokenSource);
  assert.ok(brokenTree !== null, `Parser cancelled for broken ${example.id}`);
  assert.equal(
    brokenTree.rootNode.hasError,
    true,
    `Mutation did not create a recovery tree: ${example.id}`,
  );
  const recoveries = collectRecoveryNodes(brokenTree.rootNode);
  assert.ok(recoveries.length > 0, `No recovery nodes for ${example.id}`);
  assert.ok(
    recoveries.every((node) => node.startPosition.row === node.endPosition.row),
    `Mutation recovery escaped its source line: ${example.id}`,
  );
  assert.doesNotThrow(
    () => query.captures(brokenTree.rootNode),
    `Highlight query failed for broken ${example.id}`,
  );
  brokenTree.delete();
  assert.equal(
    brokenSource.replace(mutation.after, mutation.before),
    example.source,
    `Mutation did not repair exactly: ${example.id}`,
  );
}
query.delete();
parser.delete();

console.log(
  `Playground smoke passed: assets=${required.length} examples=${examples.length} recovery_actions=${mutationLabels.size}`,
);
