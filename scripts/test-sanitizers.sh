#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_sanitizer_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_sanitizer_script_dir
dslx_sanitizer_repo_dir="$(cd "${dslx_sanitizer_script_dir}/.." && pwd)"
readonly dslx_sanitizer_repo_dir

cd "${dslx_sanitizer_repo_dir}"

dslx_runtime_dir="$(./scripts/fetch-tree-sitter-runtime.sh)"
readonly dslx_runtime_dir
./scripts/fetch-xls-corpus.sh >/dev/null
dslx_revision="$(<test/upstream/XLS_REVISION)"
readonly dslx_revision
dslx_corpus_dir="${dslx_sanitizer_repo_dir}/.cache/upstream/xls-${dslx_revision}"
readonly dslx_corpus_dir
dslx_binary="${dslx_sanitizer_repo_dir}/build/sanitizer/dslx-sanitizer"
readonly dslx_binary

mkdir -p "$(dirname "${dslx_binary}")"
clang -std=c11 -O1 -g -fno-omit-frame-pointer \
  -fsanitize=address,undefined \
  -D_POSIX_C_SOURCE=200112L -D_DEFAULT_SOURCE -D_BSD_SOURCE -D_DARWIN_C_SOURCE \
  -I"${dslx_runtime_dir}/lib/include" \
  -I"${dslx_runtime_dir}/lib/src" \
  -I"${dslx_sanitizer_repo_dir}/src" \
  -I"${dslx_sanitizer_repo_dir}/bindings/c" \
  "${dslx_runtime_dir}/lib/src/lib.c" \
  "${dslx_sanitizer_repo_dir}/src/parser.c" \
  "${dslx_sanitizer_repo_dir}/test/runtime/sanitizer_harness.c" \
  -o "${dslx_binary}"

declare -A dslx_exclusions=()
while IFS=$'\t' read -r dslx_path _; do
  [[ -z "${dslx_path}" || "${dslx_path}" == \#* ]] && continue
  dslx_exclusions["${dslx_path}"]=1
done <test/upstream/exclusions.tsv

dslx_files=()
while IFS= read -r -d '' dslx_file; do
  dslx_relative="${dslx_file#"${dslx_corpus_dir}/"}"
  [[ -n "${dslx_exclusions["${dslx_relative}"]+present}" ]] && continue
  dslx_files+=("${dslx_file}")
done < <(
  find "${dslx_corpus_dir}/xls/dslx" \
       "${dslx_corpus_dir}/xls/examples" \
       "${dslx_corpus_dir}/xls/modules" \
       -type f \( -name '*.x' -o -name '*.dslx' \) -print0 | sort -z
)

ASAN_OPTIONS=detect_leaks=1:halt_on_error=1 \
UBSAN_OPTIONS=halt_on_error=1:print_stacktrace=1 \
  "${dslx_binary}" "${dslx_files[@]}"
