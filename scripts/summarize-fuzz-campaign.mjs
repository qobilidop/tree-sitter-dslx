// SPDX-License-Identifier: Apache-2.0

import fs from "node:fs";
import path from "node:path";

const [logsDirectory, minimumCpuSecondsText = "28800"] = process.argv.slice(2);
if (logsDirectory === undefined) {
  throw new Error(
    "Usage: summarize-fuzz-campaign.mjs LOG_DIRECTORY [MIN_CPU_SECONDS]",
  );
}
const minimumCpuSeconds = Number.parseFloat(minimumCpuSecondsText);
if (!Number.isFinite(minimumCpuSeconds) || minimumCpuSeconds < 0) {
  throw new Error("MIN_CPU_SECONDS must be a non-negative number");
}

const logFiles = fs
  .readdirSync(logsDirectory)
  .filter((file) => /^worker-\d+\.json$/.test(file))
  .sort();
if (logFiles.length === 0)
  throw new Error("No fuzz campaign worker logs found");
const workers = logFiles.map((file) =>
  JSON.parse(fs.readFileSync(path.join(logsDirectory, file), "utf8")),
);
if (workers.some((worker) => worker.result !== "pass")) {
  throw new Error("At least one fuzz campaign worker did not pass");
}

const sum = (field) =>
  workers.reduce((total, worker) => total + worker[field], 0);
const summary = {
  completed_at: new Date().toISOString(),
  worker_count: workers.length,
  aggregate_cpu_seconds: Number(sum("cpu_seconds").toFixed(3)),
  aggregate_cpu_hours: Number((sum("cpu_seconds") / 3600).toFixed(4)),
  aggregate_iterations: sum("iterations"),
  aggregate_traces: sum("traces"),
  aggregate_changed_ranges: sum("changed_ranges"),
  aggregate_highlighted_mutants: sum("highlighted_mutants"),
  aggregate_error_free_mutants_compared_fresh: sum(
    "error_free_mutants_compared_fresh",
  ),
  seeds: workers.map((worker) => worker.seed),
  edits_per_trace: [
    ...new Set(workers.map((worker) => worker.edits_per_trace)),
  ],
  worker_elapsed_seconds: workers.map((worker) => worker.elapsed_seconds),
  result: "pass",
};

if (summary.aggregate_cpu_seconds < minimumCpuSeconds) {
  throw new Error(
    `Campaign recorded ${summary.aggregate_cpu_seconds}s CPU; ${minimumCpuSeconds}s required`,
  );
}
console.log(JSON.stringify(summary, null, 2));
