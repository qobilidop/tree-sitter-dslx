#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_playground_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_playground_script_dir
dslx_playground_repo_dir="$(cd "${dslx_playground_script_dir}/.." && pwd)"
readonly dslx_playground_repo_dir
dslx_playground_dist="${dslx_playground_repo_dir}/dist"
readonly dslx_playground_dist

cd "${dslx_playground_repo_dir}"
npm run build:wasm

case "${dslx_playground_dist}" in
  "${dslx_playground_repo_dir}/dist") ;;
  *)
    printf 'Refusing to replace unexpected playground path: %s\n' \
      "${dslx_playground_dist}" >&2
    exit 1
    ;;
esac
rm -rf -- "${dslx_playground_dist}"
mkdir -p "${dslx_playground_dist}"

cp playground/.nojekyll \
   playground/app.js \
   playground/examples.json \
   playground/favicon.svg \
   playground/index.html \
   playground/styles.css \
   queries/highlights.scm \
   build/tree-sitter-dslx.wasm \
   node_modules/web-tree-sitter/web-tree-sitter.js \
   node_modules/web-tree-sitter/web-tree-sitter.wasm \
   "${dslx_playground_dist}/"

printf 'Playground built: %s\n' "${dslx_playground_dist}"
