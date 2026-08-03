#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_bazel_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_bazel_script_dir
dslx_bazel_repo_dir="$(cd "${dslx_bazel_script_dir}/.." && pwd)"
readonly dslx_bazel_repo_dir
dslx_bazel_version="$(<"${dslx_bazel_repo_dir}/test/upstream/BAZEL_VERSION")"
readonly dslx_bazel_version

case "$(uname -m)" in
  x86_64)
    dslx_bazel_arch=x86_64
    dslx_bazel_sha256="$(<"${dslx_bazel_repo_dir}/test/upstream/BAZEL_LINUX_AMD64_SHA256")"
    ;;
  aarch64 | arm64)
    dslx_bazel_arch=arm64
    dslx_bazel_sha256="$(<"${dslx_bazel_repo_dir}/test/upstream/BAZEL_LINUX_ARM64_SHA256")"
    ;;
  *)
    printf 'Unsupported Bazel architecture: %s\n' "$(uname -m)" >&2
    exit 1
    ;;
esac
readonly dslx_bazel_arch dslx_bazel_sha256

dslx_bazel_cache="${dslx_bazel_repo_dir}/.cache/tools"
readonly dslx_bazel_cache
dslx_bazel_binary="${dslx_bazel_cache}/bazel-${dslx_bazel_version}-linux-${dslx_bazel_arch}"
readonly dslx_bazel_binary

mkdir -p "${dslx_bazel_cache}"
exec 9>"${dslx_bazel_cache}/.bazel-download.lock"
flock 9

if [[ ! -f "${dslx_bazel_binary}" ]]; then
  dslx_bazel_download="$(mktemp "${dslx_bazel_binary}.download.XXXXXX")"
  readonly dslx_bazel_download
  trap 'rm -f "${dslx_bazel_download}"' EXIT
  curl --fail --location --show-error --silent \
    "https://github.com/bazelbuild/bazel/releases/download/${dslx_bazel_version}/bazel-${dslx_bazel_version}-linux-${dslx_bazel_arch}" \
    --output "${dslx_bazel_download}"
  printf '%s  %s\n' "${dslx_bazel_sha256}" "${dslx_bazel_download}" \
    | sha256sum --check --strict >/dev/null
  chmod +x "${dslx_bazel_download}"
  mv "${dslx_bazel_download}" "${dslx_bazel_binary}"
  trap - EXIT
fi

printf '%s  %s\n' "${dslx_bazel_sha256}" "${dslx_bazel_binary}" \
  | sha256sum --check --strict >/dev/null
printf '%s\n' "${dslx_bazel_binary}"
