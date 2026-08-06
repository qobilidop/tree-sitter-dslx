// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  countRecoveryNodes,
  createDslxParser,
  createDslxQuery,
  parseRequired,
  repoRoot,
} from "./lib/dslx-wasm.mjs";

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

const parser = await createDslxParser();

const tagsSource = fs.readFileSync(
  path.join(repoRoot, "test/tags/core.x"),
  "utf8",
);
const tagsTree = parseRequired(parser, tagsSource);
assert.equal(
  countRecoveryNodes(tagsTree.rootNode),
  0,
  "tags fixture must parse",
);

const tagsQuery = await createDslxQuery("queries/tags.scm");
const observedTags = [];
for (const match of tagsQuery.matches(tagsTree.rootNode)) {
  const names = match.captures.filter(({ name }) => name === "name");
  const semantic = match.captures.filter(({ name }) => name !== "name");
  assert.equal(names.length, 1, "each tag match must capture exactly one name");
  assert.equal(
    semantic.length,
    1,
    "each tag match must capture one role and kind",
  );
  observedTags.push(`${semantic[0].name}:${names[0].node.text}`);
}

for (const expectedTag of [
  "definition.class:Point",
  "definition.function:checked!",
  "definition.function:helper",
  "definition.interface:Scale",
  "definition.method:value",
  "reference.call:helper",
  "reference.class:Word",
  "reference.implementation:Point",
]) {
  assert.ok(observedTags.includes(expectedTag), `missing tag ${expectedTag}`);
}

const localsSource = fs.readFileSync(
  path.join(repoRoot, "test/query/locals.x"),
  "utf8",
);
const localsTree = parseRequired(parser, localsSource);
assert.equal(
  countRecoveryNodes(localsTree.rootNode),
  0,
  "locals fixture must parse",
);

const localsQuery = await createDslxQuery("queries/locals.scm");
const observedLocals = Object.groupBy(
  localsQuery.captures(localsTree.rootNode),
  ({ name }) => name,
);

assert.deepEqual(
  sorted(observedLocals["local.scope"].map(({ node }) => node.type)),
  sorted([
    "function_definition",
    "block",
    "lambda_expression",
    "block",
    "match_arm",
    "for_expression",
    "block",
  ]),
);
assert.deepEqual(
  sorted(observedLocals["local.definition"].map(({ node }) => node.text)),
  sorted([
    "N",
    "input",
    "left",
    "middle",
    "right",
    "LOCAL",
    "mapped",
    "item",
    "doubled",
    "selected",
    "bound",
    "folded",
    "element",
    "accumulator",
  ]),
);
assert.deepEqual(
  sorted(observedLocals["local.reference"].map(({ node }) => node.text)),
  sorted([
    "input",
    "N",
    "input",
    "left",
    "item",
    "item",
    "doubled",
    "helper",
    "mapped",
    "right",
    "middle",
    "LOCAL",
    "input",
    "bound",
    "range",
    "accumulator",
    "element",
    "selected",
    "folded",
  ]),
);

localsQuery.delete();
localsTree.delete();
tagsQuery.delete();
tagsTree.delete();
parser.delete();

console.log(
  `Query contracts passed: ${observedTags.length} tags and ` +
    `${Object.values(observedLocals).flat().length} local captures.`,
);
