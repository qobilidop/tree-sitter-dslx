#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_verify_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_verify_script_dir
dslx_verify_repo_dir="$(cd "${dslx_verify_script_dir}/.." && pwd)"
readonly dslx_verify_repo_dir

cd "${dslx_verify_repo_dir}"

npm run format:check
npm run lint:js
npm run lint:docs
npm run generate
npm run lint:schema
npm test
npm run build
npm run test:wasm
npm run test:queries
npm run test:upstream
npm run test:metamorphic
npm run test:incremental
npm run fuzz
npm run fuzz:corpus
npm run test:c-consumer
npm run test:playground

shellcheck dev.sh scripts/*.sh

cmake -S . -B build/cmake -G Ninja -DBUILD_SHARED_LIBS=ON -DBUILD_TESTING=ON
cmake --build build/cmake
ctest --test-dir build/cmake --output-on-failure

git diff --exit-code -- src
