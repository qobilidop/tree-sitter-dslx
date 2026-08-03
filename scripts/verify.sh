#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_verify_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_verify_script_dir
dslx_verify_repo_dir="$(cd "${dslx_verify_script_dir}/.." && pwd)"
readonly dslx_verify_repo_dir

cd "${dslx_verify_repo_dir}"

npm run generate
npm test
npm run build
npm run test:wasm
npm run test:upstream
npm run test:metamorphic
npm run test:incremental
npm run fuzz
npm run fuzz:corpus
npm run test:c-consumer
npm run test:playground

shellcheck dev.sh scripts/*.sh

cmake -S . -B build/cmake -G Ninja -DBUILD_SHARED_LIBS=ON
cmake --build build/cmake

git diff --exit-code -- src
