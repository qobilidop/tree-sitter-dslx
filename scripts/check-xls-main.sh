#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_canary_repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
readonly dslx_canary_repo_root
dslx_canary_cache_root="${dslx_canary_repo_root}/.cache/canary"
readonly dslx_canary_cache_root
dslx_canary_output_dir="${dslx_canary_repo_root}/build/xls-main-canary"
readonly dslx_canary_output_dir

mkdir -p "${dslx_canary_cache_root}"

dslx_canary_revision=$(git ls-remote --exit-code https://github.com/google/xls.git refs/heads/main | awk 'NR == 1 { print $1 }')
readonly dslx_canary_revision
if [[ ! "${dslx_canary_revision}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Could not resolve a valid XLS main revision" >&2
  exit 1
fi

dslx_canary_archive="${dslx_canary_cache_root}/xls-${dslx_canary_revision}.tar.gz"
readonly dslx_canary_archive
dslx_canary_archive_hash_file="${dslx_canary_archive}.sha256"
readonly dslx_canary_archive_hash_file
dslx_canary_corpus="${dslx_canary_cache_root}/xls-${dslx_canary_revision}"
readonly dslx_canary_corpus
dslx_canary_marker="${dslx_canary_corpus}/.tree-sitter-dslx-canary"
readonly dslx_canary_marker
dslx_canary_url="https://github.com/google/xls/archive/${dslx_canary_revision}.tar.gz"
readonly dslx_canary_url

dslx_canary_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    shasum -a 256 "$1" | awk '{ print $1 }'
  fi
}

if [[ ! -f "${dslx_canary_archive}" ]]; then
  dslx_canary_download=$(mktemp "${dslx_canary_archive}.download.XXXXXX")
  trap 'rm -f -- "${dslx_canary_download}"' EXIT
  curl --fail --location --retry 3 --output "${dslx_canary_download}" "${dslx_canary_url}"
  mv "${dslx_canary_download}" "${dslx_canary_archive}"
  trap - EXIT
fi

dslx_canary_archive_hash=$(dslx_canary_sha256 "${dslx_canary_archive}")
readonly dslx_canary_archive_hash
if [[ -f "${dslx_canary_archive_hash_file}" ]]; then
  dslx_canary_recorded_hash=$(tr -d '[:space:]' < "${dslx_canary_archive_hash_file}")
  readonly dslx_canary_recorded_hash
  if [[ "${dslx_canary_archive_hash}" != "${dslx_canary_recorded_hash}" ]]; then
    echo "Cached XLS canary archive checksum changed: ${dslx_canary_archive}" >&2
    exit 1
  fi
else
  printf '%s\n' "${dslx_canary_archive_hash}" > "${dslx_canary_archive_hash_file}"
fi

if [[ -d "${dslx_canary_corpus}" ]]; then
  if [[ ! -f "${dslx_canary_marker}" ]] ||
    [[ "$(<"${dslx_canary_marker}")" != "${dslx_canary_revision} ${dslx_canary_archive_hash}" ]]; then
    echo "Refusing to replace an invalid XLS canary cache: ${dslx_canary_corpus}" >&2
    exit 1
  fi
else
  dslx_canary_extract=$(mktemp -d "${dslx_canary_cache_root}/extract-${dslx_canary_revision}.XXXXXX")
  trap 'rm -rf -- "${dslx_canary_extract}"' EXIT
  tar \
    --extract \
    --gzip \
    --file "${dslx_canary_archive}" \
    --directory "${dslx_canary_extract}" \
    --strip-components=1 \
    "xls-${dslx_canary_revision}/xls/dslx" \
    "xls-${dslx_canary_revision}/xls/examples" \
    "xls-${dslx_canary_revision}/xls/modules"
  printf '%s %s\n' "${dslx_canary_revision}" "${dslx_canary_archive_hash}" > \
    "${dslx_canary_extract}/.tree-sitter-dslx-canary"
  mv "${dslx_canary_extract}" "${dslx_canary_corpus}"
  trap - EXIT
fi

node "${dslx_canary_repo_root}/scripts/report-xls-corpus.mjs" \
  --root "${dslx_canary_corpus}" \
  --revision "${dslx_canary_revision}" \
  --archive-sha256 "${dslx_canary_archive_hash}" \
  --exclusions "${dslx_canary_repo_root}/test/upstream/exclusions.tsv" \
  --output-dir "${dslx_canary_output_dir}"
