// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  assertTreeMatchesFresh,
  assertAscii,
  createDslxParser,
  createHighlightsQuery,
  parseRequired,
  replaceIncrementally,
  repoRoot,
} from "./lib/dslx-wasm.mjs";

const initialSeed =
  Number.parseInt(process.env.FUZZ_SEED ?? "1597463007", 10) >>> 0;
const requestedIterations = Number.parseInt(
  process.env.FUZZ_ITERATIONS ?? "500",
  10,
);
const durationSeconds = Number.parseFloat(
  process.env.FUZZ_DURATION_SECONDS ?? "0",
);
const editsPerTrace = Number.parseInt(
  process.env.FUZZ_EDITS_PER_TRACE ?? "1",
  10,
);

if (!Number.isSafeInteger(requestedIterations) || requestedIterations < 1) {
  throw new Error("FUZZ_ITERATIONS must be a positive integer");
}
if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
  throw new Error("FUZZ_DURATION_SECONDS must be a non-negative number");
}
if (!Number.isSafeInteger(editsPerTrace) || editsPerTrace < 1) {
  throw new Error("FUZZ_EDITS_PER_TRACE must be a positive integer");
}

let randomState = initialSeed;
function random() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return randomState >>> 0;
}

const seeds = [
  `fn f<N: u32>(x: uN[N]) -> uN[N] { if x == uN[N]:0 { x } else { x + uN[N]:1 } }`,
  `proc P { c: chan<u32> out; config(c: chan<u32> out) { (c,) } init { u32:0 } next(x: u32) { send(join(), c, x); x } }`,
  `struct S<N: u32> { x: uN[N] } fn g<N: u32>(s: S<N>) { match s.x { uN[N]:0 => (), _ => (), } }`,
];
const insertions = [
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "<",
  ">",
  ":",
  "::",
  ",",
  ";",
  "..",
  "..=",
  "+:",
  "fn ",
  "let ",
  "u32:",
  "// fuzz\n",
  "'",
  '"',
  "!",
];

const parser = await createDslxParser();
const query = await createHighlightsQuery();
let source = "";
let tree = null;
let iterations = 0;
let changedRanges = 0;
let highlightedMutants = 0;
let errorFreeMutants = 0;
let traces = 0;
let previousSource = source;
let lastEdit = null;
const started = performance.now();
const cpuStarted = process.cpuUsage();
const deadline =
  durationSeconds > 0 ? started + durationSeconds * 1000 : Infinity;

try {
  while (
    durationSeconds > 0
      ? performance.now() < deadline
      : iterations < requestedIterations
  ) {
    source = seeds[random() % seeds.length];
    assertAscii(source, "fuzz seed");
    tree = parseRequired(parser, source);
    const originalSource = source;
    const originalTree = tree.rootNode.toString();
    const undoStack = [];
    traces += 1;

    for (
      let editIndex = 0;
      editIndex < editsPerTrace &&
      (durationSeconds > 0 || iterations < requestedIterations);
      editIndex += 1
    ) {
      const operation = random() % 3;
      const startIndex = random() % (source.length + 1);
      const available = source.length - startIndex;
      const deleteCount =
        operation === 0 || available === 0
          ? 0
          : Math.min(1 + (random() % 4), available);
      const insertText =
        operation === 1 ? "" : insertions[random() % insertions.length];

      previousSource = source;
      lastEdit = { startIndex, deleteCount, insertText };
      undoStack.push({
        startIndex,
        deleteCount: insertText.length,
        insertText: source.slice(startIndex, startIndex + deleteCount),
      });
      const result = replaceIncrementally(parser, tree, source, lastEdit, {
        compareFresh: false,
      });
      source = result.source;
      tree = result.tree;
      changedRanges += result.changedRanges.length;
      iterations += 1;

      if (!tree.rootNode.hasError) {
        assertTreeMatchesFresh(parser, tree, source);
        errorFreeMutants += 1;
      }
      if (iterations % 25 === 0) {
        query.captures(tree.rootNode);
        highlightedMutants += 1;
      }
    }

    while (undoStack.length > 0) {
      const undo = undoStack.pop();
      const result = replaceIncrementally(parser, tree, source, undo, {
        compareFresh: undoStack.length === 0,
      });
      source = result.source;
      tree = result.tree;
      changedRanges += result.changedRanges.length;
    }
    if (
      source !== originalSource ||
      tree.rootNode.toString() !== originalTree
    ) {
      throw new Error("Undoing the fuzz edits did not restore the seed tree");
    }
    tree.delete();
    tree = null;
  }
} catch (error) {
  fs.mkdirSync(path.join(repoRoot, "build"), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, "build/fuzz-reproducer.x"),
    error.updatedSource ?? source,
  );
  console.error(
    JSON.stringify({
      seed: initialSeed,
      iteration: iterations,
      random_state: randomState,
      previous_source: previousSource,
      edit: lastEdit,
      incremental: error.incrementalSExpression,
      fresh: error.freshSExpression,
    }),
  );
  throw error;
} finally {
  tree?.delete();
  query.delete();
  parser.delete();
}

const elapsedSeconds = (performance.now() - started) / 1000;
const cpuUsage = process.cpuUsage(cpuStarted);
const cpuSeconds = (cpuUsage.user + cpuUsage.system) / 1_000_000;
console.log(
  JSON.stringify({
    seed: initialSeed,
    iterations,
    traces,
    edits_per_trace: editsPerTrace,
    elapsed_seconds: Number(elapsedSeconds.toFixed(3)),
    cpu_seconds: Number(cpuSeconds.toFixed(3)),
    changed_ranges: changedRanges,
    highlighted_mutants: highlightedMutants,
    error_free_mutants_compared_fresh: errorFreeMutants,
    result: "pass",
  }),
);
