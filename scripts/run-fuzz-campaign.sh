#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_campaign_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_campaign_script_dir
dslx_campaign_repo_dir="$(cd "${dslx_campaign_script_dir}/.." && pwd)"
readonly dslx_campaign_repo_dir
dslx_campaign_workers="${FUZZ_CAMPAIGN_WORKERS:-4}"
readonly dslx_campaign_workers
dslx_campaign_seconds="${FUZZ_CAMPAIGN_SECONDS:-7500}"
readonly dslx_campaign_seconds
dslx_campaign_edits="${FUZZ_CAMPAIGN_EDITS_PER_TRACE:-8}"
readonly dslx_campaign_edits
dslx_campaign_minimum_cpu="${FUZZ_CAMPAIGN_MIN_CPU_SECONDS:-28800}"
readonly dslx_campaign_minimum_cpu
dslx_campaign_dir="${dslx_campaign_repo_dir}/build/fuzz-campaign"
readonly dslx_campaign_dir

for dslx_value in \
  "${dslx_campaign_workers}" \
  "${dslx_campaign_seconds}" \
  "${dslx_campaign_edits}"; do
  if [[ ! "${dslx_value}" =~ ^[1-9][0-9]*$ ]]; then
    printf 'Fuzz campaign counts must be positive integers: %s\n' "${dslx_value}" >&2
    exit 64
  fi
done

cd "${dslx_campaign_repo_dir}"
dslx_campaign_commit="$(git rev-parse HEAD)"
readonly dslx_campaign_commit
npm run build:wasm

case "${dslx_campaign_dir}" in
  "${dslx_campaign_repo_dir}/build/fuzz-campaign") ;;
  *)
    printf 'Refusing to replace unexpected campaign path: %s\n' \
      "${dslx_campaign_dir}" >&2
    exit 1
    ;;
esac
rm -rf -- "${dslx_campaign_dir}"
mkdir -p "${dslx_campaign_dir}"

dslx_campaign_pids=()
cleanup_campaign() {
  for dslx_pid in "${dslx_campaign_pids[@]}"; do
    kill "${dslx_pid}" 2>/dev/null || true
  done
}
trap cleanup_campaign INT TERM

printf \
  'Fuzz campaign started: workers=%s duration=%ss edits_per_trace=%s minimum_cpu=%ss\n' \
  "${dslx_campaign_workers}" \
  "${dslx_campaign_seconds}" \
  "${dslx_campaign_edits}" \
  "${dslx_campaign_minimum_cpu}" >&2

for ((dslx_worker = 0; dslx_worker < dslx_campaign_workers; dslx_worker += 1)); do
  dslx_seed=$((1597463007 + dslx_worker * 2654435761))
  FUZZ_SEED="${dslx_seed}" \
  FUZZ_DURATION_SECONDS="${dslx_campaign_seconds}" \
  FUZZ_EDITS_PER_TRACE="${dslx_campaign_edits}" \
    node scripts/fuzz.mjs \
      >"${dslx_campaign_dir}/worker-${dslx_worker}.json" \
      2>"${dslx_campaign_dir}/worker-${dslx_worker}.stderr" &
  dslx_campaign_pids+=("$!")
done

dslx_campaign_failed=0
for dslx_pid in "${dslx_campaign_pids[@]}"; do
  if ! wait "${dslx_pid}"; then
    dslx_campaign_failed=1
  fi
done
trap - INT TERM

if (( dslx_campaign_failed != 0 )); then
  for dslx_log in "${dslx_campaign_dir}"/*.stderr; do
    [[ -s "${dslx_log}" ]] && { printf '==> %s <==\n' "${dslx_log}"; cat "${dslx_log}"; }
  done
  exit 1
fi

FUZZ_CAMPAIGN_REPOSITORY_COMMIT="${dslx_campaign_commit}" \
  node scripts/summarize-fuzz-campaign.mjs \
  "${dslx_campaign_dir}" "${dslx_campaign_minimum_cpu}" \
  | tee "${dslx_campaign_repo_dir}/build/fuzz-campaign-summary.json"
