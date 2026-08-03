#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
revision=$(tr -d '[:space:]' < "${repo_root}/test/upstream/XLS_REVISION")
expected_sha256=$(tr -d '[:space:]' < "${repo_root}/test/upstream/XLS_ARCHIVE_SHA256")
cache_root="${repo_root}/.cache/upstream"
archive="${cache_root}/xls-${revision}.tar.gz"
corpus_dir="${cache_root}/xls-${revision}"
marker="${corpus_dir}/.tree-sitter-dslx-revision"
url="https://github.com/google/xls/archive/${revision}.tar.gz"

mkdir -p "${cache_root}"
exec 9>"${cache_root}/.xls-source.lock"
flock 9

archive_is_valid() {
  [[ -f "${archive}" ]] &&
    [[ "$(sha256sum "${archive}" | awk '{print $1}')" == "${expected_sha256}" ]]
}

if ! archive_is_valid; then
  download="$(mktemp "${archive}.download.XXXXXX")"
  trap 'rm -f "${download}"' EXIT
  curl --fail --location --retry 3 --output "${download}" "${url}"
  if [[ "$(sha256sum "${download}" | awk '{print $1}')" != "${expected_sha256}" ]]; then
    echo "XLS archive checksum mismatch for ${revision}" >&2
    exit 1
  fi
  mv "${download}" "${archive}"
  trap - EXIT
fi

if ! archive_is_valid; then
  echo "XLS archive checksum mismatch for ${revision}" >&2
  exit 1
fi

if [[ -f "${marker}" ]] && [[ "$(<"${marker}")" == "${revision}" ]]; then
  printf '%s\n' "${corpus_dir}"
  exit 0
fi

case "${corpus_dir}" in
  "${cache_root}"/xls-*) ;;
  *)
    echo "Refusing to replace unexpected corpus path: ${corpus_dir}" >&2
    exit 1
    ;;
esac

rm -rf -- "${corpus_dir}"
mkdir -p "${corpus_dir}"
tar \
  --extract \
  --gzip \
  --file "${archive}" \
  --directory "${corpus_dir}" \
  --strip-components=1 \
  "xls-${revision}/xls/dslx" \
  "xls-${revision}/xls/examples" \
  "xls-${revision}/xls/modules"
printf '%s\n' "${revision}" > "${marker}"
printf '%s\n' "${corpus_dir}"
