#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_fetch_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_fetch_script_dir
dslx_fetch_repo_dir="$(cd "${dslx_fetch_script_dir}/.." && pwd)"
readonly dslx_fetch_repo_dir

dslx_runtime_version="$(<"${dslx_fetch_repo_dir}/test/runtime/TREE_SITTER_RUNTIME_VERSION")"
readonly dslx_runtime_version
dslx_runtime_sha256="$(<"${dslx_fetch_repo_dir}/test/runtime/TREE_SITTER_RUNTIME_SHA256")"
readonly dslx_runtime_sha256
dslx_cache_dir="${dslx_fetch_repo_dir}/.cache/upstream"
readonly dslx_cache_dir
dslx_archive="${dslx_cache_dir}/tree-sitter-${dslx_runtime_version}.tar.gz"
readonly dslx_archive
dslx_runtime_dir="${dslx_cache_dir}/tree-sitter-${dslx_runtime_version}"
readonly dslx_runtime_dir

mkdir -p "${dslx_cache_dir}"
exec 9>"${dslx_cache_dir}/.tree-sitter-runtime.lock"
flock 9

if [[ ! -f "${dslx_archive}" ]]; then
  dslx_download="$(mktemp "${dslx_archive}.download.XXXXXX")"
  readonly dslx_download
  trap 'rm -f "${dslx_download}"' EXIT
  curl --fail --location --show-error --silent \
    "https://github.com/tree-sitter/tree-sitter/archive/refs/tags/v${dslx_runtime_version}.tar.gz" \
    --output "${dslx_download}"
  printf '%s  %s\n' "${dslx_runtime_sha256}" "${dslx_download}" \
    | sha256sum --check --strict >/dev/null
  mv "${dslx_download}" "${dslx_archive}"
  trap - EXIT
fi

printf '%s  %s\n' "${dslx_runtime_sha256}" "${dslx_archive}" \
  | sha256sum --check --strict >/dev/null

if [[ ! -f "${dslx_runtime_dir}/.tree-sitter-dslx-runtime-version" ]]; then
  if [[ -e "${dslx_runtime_dir}" ]]; then
    printf 'Unrecognized runtime cache directory: %s\n' "${dslx_runtime_dir}" >&2
    exit 1
  fi
  dslx_extract_dir="$(mktemp -d "${dslx_cache_dir}/tree-sitter-extract.XXXXXX")"
  readonly dslx_extract_dir
  trap 'rm -rf "${dslx_extract_dir}"' EXIT
  tar --extract --gzip --file "${dslx_archive}" \
    --directory "${dslx_extract_dir}" --strip-components=1
  printf '%s\n' "${dslx_runtime_version}" \
    >"${dslx_extract_dir}/.tree-sitter-dslx-runtime-version"
  mv "${dslx_extract_dir}" "${dslx_runtime_dir}"
  trap - EXIT
fi

printf '%s\n' "${dslx_runtime_dir}"
