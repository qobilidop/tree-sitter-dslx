#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_source_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_source_script_dir
dslx_source_repo_dir="$(cd "${dslx_source_script_dir}/.." && pwd)"
readonly dslx_source_repo_dir
dslx_source_revision="$(<"${dslx_source_repo_dir}/test/upstream/XLS_REVISION")"
readonly dslx_source_revision
dslx_source_sha256="$(<"${dslx_source_repo_dir}/test/upstream/XLS_ARCHIVE_SHA256")"
readonly dslx_source_sha256
dslx_source_cache="${dslx_source_repo_dir}/.cache/upstream"
readonly dslx_source_cache
dslx_source_archive="${dslx_source_cache}/xls-${dslx_source_revision}.tar.gz"
readonly dslx_source_archive
dslx_source_dir="${dslx_source_cache}/xls-source-${dslx_source_revision}"
readonly dslx_source_dir

mkdir -p "${dslx_source_cache}"
exec 9>"${dslx_source_cache}/.xls-source.lock"
flock 9

if [[ ! -f "${dslx_source_archive}" ]]; then
  dslx_source_download="$(mktemp "${dslx_source_archive}.download.XXXXXX")"
  readonly dslx_source_download
  trap 'rm -f "${dslx_source_download}"' EXIT
  curl --fail --location --retry 3 --show-error --silent \
    "https://github.com/google/xls/archive/${dslx_source_revision}.tar.gz" \
    --output "${dslx_source_download}"
  printf '%s  %s\n' "${dslx_source_sha256}" "${dslx_source_download}" \
    | sha256sum --check --strict >/dev/null
  mv "${dslx_source_download}" "${dslx_source_archive}"
  trap - EXIT
fi

printf '%s  %s\n' "${dslx_source_sha256}" "${dslx_source_archive}" \
  | sha256sum --check --strict >/dev/null

if [[ ! -f "${dslx_source_dir}/.tree-sitter-dslx-source-revision" ]]; then
  if [[ -e "${dslx_source_dir}" ]]; then
    printf 'Unrecognized XLS source cache directory: %s\n' "${dslx_source_dir}" >&2
    exit 1
  fi
  dslx_source_extract="$(mktemp -d "${dslx_source_cache}/xls-source-extract.XXXXXX")"
  readonly dslx_source_extract
  trap 'rm -rf "${dslx_source_extract}"' EXIT
  tar --extract --gzip --file "${dslx_source_archive}" \
    --directory "${dslx_source_extract}" --strip-components=1
  printf '%s\n' "${dslx_source_revision}" \
    >"${dslx_source_extract}/.tree-sitter-dslx-source-revision"
  mv "${dslx_source_extract}" "${dslx_source_dir}"
  trap - EXIT
fi

printf '%s\n' "${dslx_source_dir}"
