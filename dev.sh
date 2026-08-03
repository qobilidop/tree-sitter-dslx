#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_script_dir="$(dirname "${BASH_SOURCE[0]}")"
readonly dslx_script_dir
dslx_repo_dir="$(cd "${dslx_script_dir}" && pwd)"
readonly dslx_repo_dir
readonly dslx_dev_image="tree-sitter-dslx-dev:local"

if (( $# == 0 )); then
  printf 'Usage: ./dev.sh <script-or-command> [args...]\n' >&2
  exit 64
fi

if ! command -v docker >/dev/null 2>&1; then
  printf 'dev.sh requires Docker on PATH.\n' >&2
  exit 69
fi

if ! docker info >/dev/null 2>&1; then
  printf 'dev.sh could not connect to the Docker daemon.\n' >&2
  exit 69
fi

mkdir -p "${dslx_repo_dir}/.cache"

docker build --quiet \
  --build-arg "DEV_GID=$(id -g)" \
  --build-arg "DEV_UID=$(id -u)" \
  --file "${dslx_repo_dir}/.devcontainer/Dockerfile" \
  --tag "${dslx_dev_image}" \
  "${dslx_repo_dir}" >/dev/null

dslx_docker_args=(
  run
  --init
  --rm
  --mount "type=bind,source=${dslx_repo_dir},target=/workspace/tree-sitter-dslx"
  --mount "type=bind,source=${dslx_repo_dir}/.cache,target=/home/developer/.cache"
  --env GIT_CONFIG_COUNT=1
  --env GIT_CONFIG_KEY_0=safe.directory
  --env GIT_CONFIG_VALUE_0=/workspace/tree-sitter-dslx
  --env NPM_CONFIG_CACHE=/home/developer/.cache/npm
  --workdir /workspace/tree-sitter-dslx
)

if [[ -t 0 && -t 1 ]]; then
  dslx_docker_args+=(--interactive --tty)
fi

exec docker "${dslx_docker_args[@]}" "${dslx_dev_image}" "$@"
