#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
corpus_dir=$("${repo_root}/scripts/fetch-xls-corpus.sh")
exclusions_file="${repo_root}/test/upstream/exclusions.tsv"

declare -A exclusions=()
while IFS=$'\t' read -r path reason; do
  [[ -z "${path}" || "${path}" == \#* ]] && continue
  if [[ -z "${reason}" ]]; then
    echo "Corpus exclusion has no reason: ${path}" >&2
    exit 1
  fi
  exclusions["${path}"]="${reason}"
done < "${exclusions_file}"

mapfile -d '' candidates < <(
  find \
    "${corpus_dir}/xls/dslx" \
    "${corpus_dir}/xls/examples" \
    "${corpus_dir}/xls/modules" \
    -type f \( -name '*.x' -o -name '*.dslx' \) -print0 | sort -z
)

valid_files=()
valid_bytes=0
for file in "${candidates[@]}"; do
  relative=${file#"${corpus_dir}/"}
  if [[ -n "${exclusions[${relative}]+present}" ]]; then
    continue
  fi
  valid_files+=("${file}")
  bytes=$(wc -c < "${file}")
  valid_bytes=$((valid_bytes + bytes))
done

for relative in "${!exclusions[@]}"; do
  file="${corpus_dir}/${relative}"
  if [[ ! -f "${file}" ]]; then
    echo "Stale corpus exclusion does not name a candidate: ${relative}" >&2
    exit 1
  fi
  if tree-sitter parse --quiet "${file}" >/dev/null 2>&1; then
    echo "Stale corpus exclusion now parses without recovery nodes: ${relative}" >&2
    exit 1
  fi
done

parse_log=$(mktemp)
trap 'rm -f -- "${parse_log}"' EXIT
if ! tree-sitter parse --quiet "${valid_files[@]}" >"${parse_log}" 2>&1; then
  cat "${parse_log}" >&2
  exit 1
fi

revision=$(tr -d '[:space:]' < "${repo_root}/test/upstream/XLS_REVISION")
printf \
  'XLS corpus validation passed: revision=%s candidates=%d valid=%d excluded=%d bytes=%d\n' \
  "${revision}" \
  "${#candidates[@]}" \
  "${#valid_files[@]}" \
  "${#exclusions[@]}" \
  "${valid_bytes}"
