// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Language, Parser, Query } from "web-tree-sitter";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const languageWasm = path.join(repoRoot, "build/tree-sitter-dslx.wasm");
const highlightsQuery = path.join(repoRoot, "queries/highlights.scm");

let initialization;
let language;

export { repoRoot };

export async function loadDslxLanguage() {
  initialization ??= Parser.init();
  await initialization;
  language ??= await Language.load(languageWasm);
  return language;
}

export async function createDslxParser() {
  const dslxLanguage = await loadDslxLanguage();
  const parser = new Parser();
  parser.setLanguage(dslxLanguage);
  return parser;
}

export async function createHighlightsQuery() {
  return new Query(
    await loadDslxLanguage(),
    fs.readFileSync(highlightsQuery, "utf8"),
  );
}

export function parseRequired(parser, source, oldTree = null) {
  const tree = parser.parse(source, oldTree);
  if (tree === null) {
    throw new Error("Tree-sitter unexpectedly cancelled a parse");
  }
  return tree;
}

export function assertAscii(source, label) {
  if (Buffer.byteLength(source, "utf8") !== source.length) {
    throw new Error(`${label} must be ASCII for deterministic edit offsets`);
  }
}

export function pointAt(source, index) {
  const prefix = source.slice(0, index);
  const row = (prefix.match(/\n/g) ?? []).length;
  const lastNewline = prefix.lastIndexOf("\n");
  return { row, column: index - lastNewline - 1 };
}

export function assertTreeMatchesFresh(parser, tree, source) {
  const freshTree = parseRequired(parser, source);
  const incrementalSExpression = tree.rootNode.toString();
  const freshSExpression = freshTree.rootNode.toString();

  if (incrementalSExpression !== freshSExpression) {
    freshTree.delete();
    const error = new Error("Incremental and fresh syntax trees diverged");
    error.updatedSource = source;
    error.incrementalSExpression = incrementalSExpression;
    error.freshSExpression = freshSExpression;
    throw error;
  }

  freshTree.delete();
}

export function replaceIncrementally(
  parser,
  tree,
  source,
  edit,
  { compareFresh = true } = {},
) {
  const { startIndex, deleteCount, insertText } = edit;
  if (startIndex < 0 || startIndex + deleteCount > source.length) {
    throw new Error(`Edit is outside source bounds: ${JSON.stringify(edit)}`);
  }

  const oldEndIndex = startIndex + deleteCount;
  const newEndIndex = startIndex + insertText.length;
  const updatedSource =
    source.slice(0, startIndex) + insertText + source.slice(oldEndIndex);

  tree.edit({
    startIndex,
    oldEndIndex,
    newEndIndex,
    startPosition: pointAt(source, startIndex),
    oldEndPosition: pointAt(source, oldEndIndex),
    newEndPosition: pointAt(updatedSource, newEndIndex),
  });

  const incrementalTree = parseRequired(parser, updatedSource, tree);
  const changedRanges = tree.getChangedRanges(incrementalTree);
  try {
    if (compareFresh)
      assertTreeMatchesFresh(parser, incrementalTree, updatedSource);
  } catch (error) {
    incrementalTree.delete();
    throw error;
  }

  tree.delete();
  return { source: updatedSource, tree: incrementalTree, changedRanges };
}

export function countRecoveryNodes(rootNode) {
  let count = 0;
  const pending = [rootNode];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node.isError || node.isMissing) {
      count += 1;
    }
    for (let index = 0; index < node.namedChildCount; index += 1) {
      const child = node.namedChild(index);
      if (child !== null) {
        pending.push(child);
      }
    }
  }
  return count;
}
