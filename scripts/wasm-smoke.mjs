// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";

import {
  countRecoveryNodes,
  createDslxParser,
  createHighlightsQuery,
  loadDslxLanguage,
  parseRequired,
} from "./lib/dslx-wasm.mjs";

const language = await loadDslxLanguage();
assert.equal(language.name, "dslx");

const parser = await createDslxParser();
const query = await createHighlightsQuery();
const validSource = `
#[test]
fn add<N: u32>(x: uN[N], y: uN[N]) -> uN[N] {
  x + y
}
`;
const validTree = parseRequired(parser, validSource);
assert.equal(validTree.rootNode.hasError, false);
assert.ok(query.captures(validTree.rootNode).length >= 10);

const invalidSource = `${validSource}\nfn incomplete(x: u32) { x + }\n`;
const invalidTree = parseRequired(parser, invalidSource);
assert.equal(invalidTree.rootNode.hasError, true);
assert.ok(countRecoveryNodes(invalidTree.rootNode) >= 1);
assert.ok(query.captures(invalidTree.rootNode).length >= 10);

console.log(
  `Wasm smoke passed: abi=${language.abiVersion} captures=${query.captures(validTree.rootNode).length} recovery_nodes=${countRecoveryNodes(invalidTree.rootNode)}`,
);

invalidTree.delete();
validTree.delete();
query.delete();
parser.delete();
