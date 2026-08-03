// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

import {
  assertAscii,
  createDslxParser,
  parseRequired,
  replaceIncrementally,
  repoRoot,
} from "./lib/dslx-wasm.mjs";

const revision = fs
  .readFileSync(path.join(repoRoot, "test/upstream/XLS_REVISION"), "utf8")
  .trim();
const upstreamRoot = path.join(repoRoot, ".cache/upstream", `xls-${revision}`);

const cases = [
  {
    name: "lambda",
    path: "xls/dslx/tests/lambda.x",
    edit(source, step) {
      const targets = ["fn ", "|i|", "->", "const_assert!", "\n"];
      const target = targets[step % targets.length];
      const index = source.indexOf(target);
      if (step === 0)
        return {
          startIndex: 0,
          deleteCount: 0,
          insertText: "// incremental\n",
        };
      if (step === 1)
        return { startIndex: index + 1, deleteCount: 1, insertText: "item" };
      if (step === 2)
        return { startIndex: index, deleteCount: 2, insertText: "" };
      if (step === 3)
        return { startIndex: index, deleteCount: 0, insertText: "(" };
      return { startIndex: index, deleteCount: 1, insertText: "\r\n" };
    },
  },
  {
    name: "bitonic-sort",
    path: "xls/examples/bitonic_sort.x",
    edit(source, step) {
      if (step === 0) {
        const index = source.indexOf("LOG_N");
        return { startIndex: index, deleteCount: 5, insertText: "LEVELS" };
      }
      if (step === 1) {
        const index = source.indexOf("<N: u32");
        return { startIndex: index, deleteCount: 1, insertText: "" };
      }
      if (step === 2) {
        const index = source.indexOf("u32:0..LOG_N");
        return { startIndex: index + 5, deleteCount: 2, insertText: "..=" };
      }
      if (step === 3) {
        const index = source.indexOf("swap(array");
        return { startIndex: index, deleteCount: 0, insertText: "/*" };
      }
      return {
        startIndex: source.length,
        deleteCount: 0,
        insertText: "\nfn appended() { () }\n",
      };
    },
  },
  {
    name: "apfloat",
    path: "xls/dslx/stdlib/apfloat.x",
    edit(source, step) {
      const middle = Math.floor(source.length / 2);
      if (step === 0)
        return { startIndex: middle, deleteCount: 0, insertText: " " };
      if (step === 1)
        return { startIndex: middle, deleteCount: 1, insertText: "\n" };
      if (step === 2)
        return {
          startIndex: source.indexOf("struct"),
          deleteCount: 6,
          insertText: "struc",
        };
      if (step === 3)
        return {
          startIndex: source.lastIndexOf("}"),
          deleteCount: 1,
          insertText: "",
        };
      return {
        startIndex: 0,
        deleteCount: 0,
        insertText: "#![allow(nonstandard_member_naming)]\n",
      };
    },
  },
];

const parser = await createDslxParser();
let editCount = 0;
let changedRangeCount = 0;

for (const testCase of cases) {
  const file = path.join(upstreamRoot, testCase.path);
  let source = fs.readFileSync(file, "utf8");
  assertAscii(source, testCase.name);
  let tree = parseRequired(parser, source);
  if (tree.rootNode.hasError) {
    throw new Error(`Incremental seed has a parse error: ${testCase.path}`);
  }

  for (let step = 0; step < 5; step += 1) {
    const result = replaceIncrementally(
      parser,
      tree,
      source,
      testCase.edit(source, step),
    );
    source = result.source;
    tree = result.tree;
    editCount += 1;
    changedRangeCount += result.changedRanges.length;
  }
  tree.delete();
}

parser.delete();
console.log(
  `Incremental equivalence passed: files=${cases.length} edits=${editCount} changed_ranges=${changedRangeCount}`,
);
