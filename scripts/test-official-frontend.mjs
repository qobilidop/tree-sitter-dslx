// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createDslxParser, parseRequired, repoRoot } from "./lib/dslx-wasm.mjs";

const formatter = process.env.DSLX_FMT;
if (formatter === undefined || formatter === "") {
  throw new Error("DSLX_FMT must name the pinned dslx_fmt binary");
}

const revision = fs
  .readFileSync(path.join(repoRoot, "test/upstream/XLS_REVISION"), "utf8")
  .trim();
const corpusRoot = path.join(repoRoot, ".cache/upstream", `xls-${revision}`);
const exclusionLines = fs
  .readFileSync(path.join(repoRoot, "test/upstream/exclusions.tsv"), "utf8")
  .split("\n")
  .filter((line) => line !== "" && !line.startsWith("#"));
const exclusions = new Set(
  exclusionLines.map((line) => line.split("\t", 1)[0]),
);
const officialExclusionLines = fs
  .readFileSync(
    path.join(repoRoot, "test/upstream/official-exclusions.tsv"),
    "utf8",
  )
  .split("\n")
  .filter((line) => line !== "" && !line.startsWith("#"));
const officialExclusions = new Map();
for (const line of officialExclusionLines) {
  const [phase, relativePath, reason] = line.split("\t", 3);
  if (!new Set(["parse", "format"]).has(phase) || !relativePath || !reason) {
    throw new Error(`Malformed official exclusion: ${line}`);
  }
  const key = `${phase}\t${relativePath}`;
  if (officialExclusions.has(key)) {
    throw new Error(`Duplicate official exclusion: ${key}`);
  }
  officialExclusions.set(key, reason);
}

function discover(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return discover(candidate);
    return entry.isFile() &&
      (entry.name.endsWith(".x") || entry.name.endsWith(".dslx"))
      ? [candidate]
      : [];
  });
}

function runFormatter(args) {
  const result = spawnSync(formatter, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    output: result.stdout,
    failure: result.status === 0 ? null : result.stderr.trim(),
  };
}

const files = ["xls/dslx", "xls/examples", "xls/modules"]
  .flatMap((directory) => discover(path.join(corpusRoot, directory)))
  .sort()
  .filter((file) => !exclusions.has(path.relative(corpusRoot, file)));
const parser = await createDslxParser();
let formattedBytes = 0;
const parseFailures = [];
const formatFailures = [];
const observedExclusions = new Set();
const parseExclusionCount = [...officialExclusions.keys()].filter((key) =>
  key.startsWith("parse\t"),
).length;
const formatExclusionCount = officialExclusions.size - parseExclusionCount;
let officialParses = 0;
let officialFormats = 0;

for (const file of files) {
  const relativePath = path.relative(corpusRoot, file);
  const parsed = runFormatter(["--mode=parse", file]);
  if (parsed.failure !== null) {
    const key = `parse\t${relativePath}`;
    if (officialExclusions.has(key)) observedExclusions.add(key);
    else parseFailures.push(relativePath);
    continue;
  }
  officialParses += 1;
  const formattedResult = runFormatter([file]);
  if (formattedResult.failure !== null) {
    const key = `format\t${relativePath}`;
    if (officialExclusions.has(key)) observedExclusions.add(key);
    else formatFailures.push(relativePath);
    continue;
  }
  officialFormats += 1;
  const formatted = formattedResult.output;
  const tree = parseRequired(parser, formatted);
  if (tree.rootNode.hasError) {
    tree.delete();
    throw new Error(
      `Tree-sitter rejected official formatting: ${relativePath}`,
    );
  }
  tree.delete();
  formattedBytes += Buffer.byteLength(formatted);
}

parser.delete();
const staleExclusions = [...officialExclusions.keys()].filter(
  (key) => !observedExclusions.has(key),
);
if (
  parseFailures.length > 0 ||
  formatFailures.length > 0 ||
  staleExclusions.length > 0
) {
  console.error(
    JSON.stringify({ parseFailures, formatFailures, staleExclusions }, null, 2),
  );
  throw new Error(
    "Official frontend results did not match their narrow classification",
  );
}
console.log(
  `Official frontend validation passed: revision=${revision} candidates=${files.length} parsed=${officialParses} formatted=${officialFormats} parse_excluded=${parseExclusionCount} format_excluded=${formatExclusionCount} formatted_bytes=${formattedBytes}`,
);
