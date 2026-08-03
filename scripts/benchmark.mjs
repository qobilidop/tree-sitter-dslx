// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  assertAscii,
  createDslxParser,
  parseRequired,
  pointAt,
  repoRoot,
} from "./lib/dslx-wasm.mjs";

const revision = fs
  .readFileSync(path.join(repoRoot, "test/upstream/XLS_REVISION"), "utf8")
  .trim();
const corpusRoot = path.join(repoRoot, ".cache/upstream", `xls-${revision}`);
const fixtures = [
  ["small", "xls/dslx/tests/lambda.x"],
  ["medium", "xls/examples/bitonic_sort.x"],
  ["large", "xls/dslx/stdlib/apfloat.x"],
];
const parser = await createDslxParser();
const results = [];

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

for (const [size, relativePath] of fixtures) {
  const source = fs.readFileSync(path.join(corpusRoot, relativePath), "utf8");
  assertAscii(source, relativePath);
  const initialTimes = [];
  const incrementalTimes = [];

  for (let iteration = 0; iteration < 7; iteration += 1) {
    let started = performance.now();
    const tree = parseRequired(parser, source);
    initialTimes.push(performance.now() - started);
    if (tree.rootNode.hasError) throw new Error(`Benchmark fixture has errors: ${relativePath}`);

    const startIndex = Math.floor(source.length / 2);
    const updatedSource = `${source.slice(0, startIndex)} ${source.slice(startIndex)}`;
    tree.edit({
      startIndex,
      oldEndIndex: startIndex,
      newEndIndex: startIndex + 1,
      startPosition: pointAt(source, startIndex),
      oldEndPosition: pointAt(source, startIndex),
      newEndPosition: pointAt(updatedSource, startIndex + 1),
    });
    started = performance.now();
    const incrementalTree = parseRequired(parser, updatedSource, tree);
    incrementalTimes.push(performance.now() - started);
    incrementalTree.delete();
    tree.delete();
  }

  const initialMs = median(initialTimes);
  const incrementalMs = median(incrementalTimes);
  if (initialMs > 1000 || incrementalMs > 250) {
    throw new Error(`Performance guard exceeded for ${relativePath}`);
  }
  results.push({
    size,
    path: relativePath,
    bytes: Buffer.byteLength(source),
    initial_ms_median: Number(initialMs.toFixed(3)),
    incremental_ms_median: Number(incrementalMs.toFixed(3)),
  });
}

parser.delete();
console.log(JSON.stringify({ revision, iterations: 7, results }, null, 2));
