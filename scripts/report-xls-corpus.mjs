// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

import {
  countRecoveryNodes,
  createDslxParser,
  parseRequired,
} from "./lib/dslx-wasm.mjs";

function parseArguments(arguments_) {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument list near ${flag ?? "end of input"}`);
    }
    options[flag.slice(2)] = value;
  }
  for (const required of [
    "root",
    "revision",
    "archive-sha256",
    "exclusions",
    "output-dir",
  ]) {
    if (!(required in options)) throw new Error(`Missing --${required}`);
  }
  return options;
}

function collectDslxFiles(root) {
  const files = [];
  const pending = ["xls/dslx", "xls/examples", "xls/modules"];
  while (pending.length > 0) {
    const relative = pending.pop();
    const absolute = path.join(root, relative);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) pending.push(child);
      if (entry.isFile() && /\.(?:dslx|x)$/u.test(entry.name))
        files.push(child);
    }
  }
  return files.sort();
}

function readExclusions(exclusionsPath) {
  const exclusions = new Map();
  for (const line of fs.readFileSync(exclusionsPath, "utf8").split(/\r?\n/u)) {
    if (line.length === 0 || line.startsWith("#")) continue;
    const separator = line.indexOf("\t");
    if (separator === -1) throw new Error(`Exclusion has no reason: ${line}`);
    exclusions.set(line.slice(0, separator), line.slice(separator + 1));
  }
  return exclusions;
}

const options = parseArguments(process.argv.slice(2));
const candidates = collectDslxFiles(options.root);
const candidateSet = new Set(candidates);
const exclusions = readExclusions(options.exclusions);
const presentExclusions = [...exclusions.keys()].filter((file) =>
  candidateSet.has(file),
);
const missingExclusions = [...exclusions.keys()].filter(
  (file) => !candidateSet.has(file),
);
const parser = await createDslxParser();
const failures = [];
let totalBytes = 0;
let parsedBytes = 0;

for (const relative of candidates) {
  const source = fs.readFileSync(path.join(options.root, relative), "utf8");
  const bytes = Buffer.byteLength(source);
  totalBytes += bytes;
  if (exclusions.has(relative)) continue;
  parsedBytes += bytes;
  const tree = parseRequired(parser, source);
  const recoveryNodes = countRecoveryNodes(tree.rootNode);
  if (recoveryNodes > 0) {
    failures.push({ path: relative, bytes, recovery_nodes: recoveryNodes });
  }
  tree.delete();
}
parser.delete();

const report = {
  schema_version: 1,
  status: failures.length === 0 ? "compatible" : "drift-detected",
  generated_at: new Date().toISOString(),
  revision: options.revision,
  archive_sha256: options["archive-sha256"],
  candidates: candidates.length,
  parsed: candidates.length - presentExclusions.length,
  excluded: presentExclusions.length,
  total_bytes: totalBytes,
  parsed_bytes: parsedBytes,
  missing_pinned_exclusions: missingExclusions,
  failures,
};

fs.mkdirSync(options["output-dir"], { recursive: true });
fs.writeFileSync(
  path.join(options["output-dir"], "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

const failureRows =
  failures.length === 0
    ? "No new recovery-producing files were found."
    : [
        "| Path | Bytes | Recovery nodes |",
        "| --- | ---: | ---: |",
        ...failures.map(
          (failure) =>
            `| \`${failure.path}\` | ${failure.bytes} | ${failure.recovery_nodes} |`,
        ),
      ].join("\n");
const summary = `# XLS main compatibility canary

- Status: **${report.status}**
- Revision: \`${report.revision}\`
- Archive SHA-256: \`${report.archive_sha256}\`
- Candidates: ${report.candidates}
- Parsed: ${report.parsed}
- Known syntax-negative exclusions: ${report.excluded}
- Parsed bytes: ${report.parsed_bytes}

## Drift

${failureRows}
`;
fs.writeFileSync(path.join(options["output-dir"], "summary.md"), summary);

console.log(
  `XLS main canary: status=${report.status} revision=${report.revision} ` +
    `parsed=${report.parsed} failures=${report.failures.length}`,
);
