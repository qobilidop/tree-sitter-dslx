#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_frontend_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_frontend_script_dir
dslx_frontend_repo_dir="$(cd "${dslx_frontend_script_dir}/.." && pwd)"
readonly dslx_frontend_repo_dir
dslx_frontend_bazel="$(./scripts/fetch-bazel.sh)"
readonly dslx_frontend_bazel
dslx_frontend_source="$(./scripts/fetch-xls-source.sh)"
readonly dslx_frontend_source
dslx_frontend_output_root="${dslx_frontend_repo_dir}/.cache/bazel"
readonly dslx_frontend_output_root
dslx_frontend_binary="${dslx_frontend_source}/bazel-bin/xls/dslx/dslx_fmt"
readonly dslx_frontend_binary

if [[ -x "${dslx_frontend_binary}" ]]; then
  printf '%s\n' "${dslx_frontend_binary}"
  exit 0
fi

cd "${dslx_frontend_source}"
"${dslx_frontend_bazel}" \
  --output_user_root="${dslx_frontend_output_root}" \
  build --compilation_mode=opt //xls/dslx:dslx_fmt >&2

if [[ ! -x "${dslx_frontend_binary}" ]]; then
  printf 'Bazel did not produce dslx_fmt at %s\n' "${dslx_frontend_binary}" >&2
  exit 1
fi
printf '%s\n' "${dslx_frontend_binary}"
