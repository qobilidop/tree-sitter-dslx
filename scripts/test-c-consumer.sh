#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

dslx_consumer_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly dslx_consumer_script_dir
dslx_consumer_repo_dir="$(cd "${dslx_consumer_script_dir}/.." && pwd)"
readonly dslx_consumer_repo_dir

cd "${dslx_consumer_repo_dir}"

dslx_runtime_dir="$(./scripts/fetch-tree-sitter-runtime.sh)"
readonly dslx_runtime_dir
dslx_prefix="${dslx_consumer_repo_dir}/build/consumer/prefix"
readonly dslx_prefix
dslx_runtime_build="${dslx_consumer_repo_dir}/build/consumer/runtime"
readonly dslx_runtime_build
dslx_grammar_build="${dslx_consumer_repo_dir}/build/consumer/grammar"
readonly dslx_grammar_build
dslx_app_build="${dslx_consumer_repo_dir}/build/consumer/app"
readonly dslx_app_build

cmake -S "${dslx_runtime_dir}" -B "${dslx_runtime_build}" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="${dslx_prefix}" \
  -DBUILD_SHARED_LIBS=ON \
  -DAMALGAMATED=ON
cmake --build "${dslx_runtime_build}"
cmake --install "${dslx_runtime_build}"

cmake -S . -B "${dslx_grammar_build}" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="${dslx_prefix}" \
  -DBUILD_SHARED_LIBS=ON
cmake --build "${dslx_grammar_build}"
cmake --install "${dslx_grammar_build}"

PKG_CONFIG_PATH="${dslx_prefix}/lib/pkgconfig:${dslx_prefix}/share/pkgconfig" \
  cmake -S test/consumer -B "${dslx_app_build}" -G Ninja
cmake --build "${dslx_app_build}"
LD_LIBRARY_PATH="${dslx_prefix}/lib" "${dslx_app_build}/dslx-consumer"
