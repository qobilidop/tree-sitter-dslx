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
const budgets = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "test/benchmark-budgets.json"), "utf8"),
);
const fixtures = [
  ["small", "xls/dslx/tests/lambda.x"],
  ["medium", "xls/examples/bitonic_sort.x"],
  ["large", "xls/dslx/stdlib/apfloat.x"],
];
const parser = await createDslxParser();
const results = [];
const violations = [];

const parserSource = fs.readFileSync(
  path.join(repoRoot, "src/parser.c"),
  "utf8",
);
function parserConstant(name) {
  const match = parserSource.match(
    new RegExp(`^#define ${name} (\\d+)$`, "mu"),
  );
  if (match === null)
    throw new Error(`Could not read ${name} from src/parser.c`);
  return Number(match[1]);
}

const artifacts = {
  state_count: parserConstant("STATE_COUNT"),
  large_state_count: parserConstant("LARGE_STATE_COUNT"),
  parser_c_bytes: fs.statSync(path.join(repoRoot, "src/parser.c")).size,
  wasm_bytes: fs.statSync(path.join(repoRoot, "build/tree-sitter-dslx.wasm"))
    .size,
};

for (const [metric, maximum] of Object.entries(budgets.parser_artifacts)) {
  const observedMetric = metric.replace(/_max$/u, "");
  if (artifacts[observedMetric] > maximum) {
    violations.push(
      `${observedMetric}=${artifacts[observedMetric]} exceeds ${maximum}`,
    );
  }
}

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
    if (tree.rootNode.hasError)
      throw new Error(`Benchmark fixture has errors: ${relativePath}`);

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
  const fixtureBudget = budgets.fixtures[size];
  if (initialMs > fixtureBudget.initial_ms_max) {
    violations.push(
      `${size} initial=${initialMs.toFixed(3)}ms exceeds ` +
        `${fixtureBudget.initial_ms_max}ms`,
    );
  }
  if (incrementalMs > fixtureBudget.incremental_ms_max) {
    violations.push(
      `${size} incremental=${incrementalMs.toFixed(3)}ms exceeds ` +
        `${fixtureBudget.incremental_ms_max}ms`,
    );
  }
  results.push({
    size,
    path: relativePath,
    bytes: Buffer.byteLength(source),
    initial_ms_median: Number(initialMs.toFixed(3)),
    incremental_ms_median: Number(incrementalMs.toFixed(3)),
    budget: fixtureBudget,
  });
}

parser.delete();
const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  revision,
  iterations: 7,
  artifacts,
  artifact_budgets: budgets.parser_artifacts,
  results,
  violations,
};
fs.mkdirSync(path.join(repoRoot, "build"), { recursive: true });
fs.writeFileSync(
  path.join(repoRoot, "build/benchmark.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));

if (violations.length > 0) {
  throw new Error(
    `Performance budgets exceeded:\n- ${violations.join("\n- ")}`,
  );
}
