// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

import { repoRoot } from "./lib/dslx-wasm.mjs";

const corpusDirectory = path.join(repoRoot, "test/corpus");
const nodeTypesPath = path.join(repoRoot, "src/node-types.json");

function expectedTrees(source) {
  const lines = source.split(/\r?\n/u);
  const trees = [];
  let inExpectedTree = false;

  for (const line of lines) {
    if (/^-{3,}$/u.test(line)) {
      inExpectedTree = true;
      continue;
    }
    if (inExpectedTree && /^={3,}$/u.test(line)) {
      inExpectedTree = false;
    }
    if (inExpectedTree) trees.push(line);
  }

  return trees.join("\n");
}

function observedNodeFields(source) {
  const fields = new Set();
  const stack = [];
  let expectsNodeType = false;
  const tokens = source.match(/\(|\)|"(?:\\.|[^"\\])*"|[^\s()]+/gu) ?? [];

  for (const token of tokens) {
    if (token === "(") {
      expectsNodeType = true;
    } else if (token === ")") {
      stack.pop();
    } else if (expectsNodeType) {
      stack.push(token);
      expectsNodeType = false;
    } else if (/^[a-z_]+:$/u.test(token) && stack.length > 0) {
      fields.add(`${stack.at(-1)}.${token.slice(0, -1)}`);
    }
  }

  return fields;
}

const corpusTrees = fs
  .readdirSync(corpusDirectory)
  .filter((file) => file.endsWith(".txt"))
  .sort()
  .map((file) =>
    expectedTrees(fs.readFileSync(path.join(corpusDirectory, file), "utf8")),
  )
  .join("\n");

const nodeTypes = JSON.parse(fs.readFileSync(nodeTypesPath, "utf8"));
const publicNamedNodes = nodeTypes
  .filter(
    ({ named, subtypes, type }) =>
      named && subtypes === undefined && !type.startsWith("_"),
  )
  .map(({ type }) => type)
  .sort();

const namedTargetFields = [
  ...new Set(
    nodeTypes.flatMap(({ fields = {} }) =>
      Object.entries(fields)
        .filter(([, field]) => field.types.some(({ named }) => named))
        .map(([name]) => name),
    ),
  ),
].sort();
const requiredNamedTargetFields = nodeTypes.flatMap(
  ({ fields = {}, named, subtypes, type }) =>
    named && subtypes === undefined && !type.startsWith("_")
      ? Object.entries(fields)
          .filter(
            ([, field]) =>
              field.required && field.types.some(({ named }) => named),
          )
          .map(([name]) => `${type}.${name}`)
      : [],
);
const observedFields = observedNodeFields(corpusTrees);

const missingNodes = publicNamedNodes.filter(
  (type) => !new RegExp(`\\(${type}(?=[\\s)])`, "u").test(corpusTrees),
);
const missingFields = namedTargetFields.filter(
  (field) => !new RegExp(`(?:^|\\s)${field}:\\s`, "mu").test(corpusTrees),
);
const missingRequiredFields = requiredNamedTargetFields.filter(
  (field) => !observedFields.has(field),
);

if (
  missingNodes.length > 0 ||
  missingFields.length > 0 ||
  missingRequiredFields.length > 0
) {
  if (missingNodes.length > 0) {
    console.error(`Missing public named nodes: ${missingNodes.join(", ")}`);
  }
  if (missingFields.length > 0) {
    console.error(`Missing named-target fields: ${missingFields.join(", ")}`);
  }
  if (missingRequiredFields.length > 0) {
    console.error(
      `Missing required node/field pairs: ${missingRequiredFields.join(", ")}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    `Schema coverage: ${publicNamedNodes.length} public named nodes and ` +
      `${namedTargetFields.length} named-target fields represented in exact CSTs; ` +
      `${requiredNamedTargetFields.length} required node/field pairs verified.`,
  );
}
