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
readonly dslx_consumer_path="/usr/bin:/bin"

for dslx_linkage in shared static; do
  if [[ "${dslx_linkage}" == shared ]]; then
    dslx_build_shared=ON
  else
    dslx_build_shared=OFF
  fi

  dslx_prefix="${dslx_consumer_repo_dir}/build/consumer/${dslx_linkage}/prefix"
  dslx_runtime_build="${dslx_consumer_repo_dir}/build/consumer/${dslx_linkage}/runtime"
  dslx_grammar_build="${dslx_consumer_repo_dir}/build/consumer/${dslx_linkage}/grammar"
  dslx_app_build="${dslx_consumer_repo_dir}/build/consumer/${dslx_linkage}/app"

  cmake -S "${dslx_runtime_dir}" -B "${dslx_runtime_build}" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="${dslx_prefix}" \
    -DBUILD_SHARED_LIBS="${dslx_build_shared}" \
    -DAMALGAMATED=ON
  cmake --build "${dslx_runtime_build}"
  cmake --install "${dslx_runtime_build}"

  env PATH="${dslx_consumer_path}" \
    cmake -S . -B "${dslx_grammar_build}" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="${dslx_prefix}" \
    -DBUILD_SHARED_LIBS="${dslx_build_shared}"
  env PATH="${dslx_consumer_path}" cmake --build "${dslx_grammar_build}"
  env PATH="${dslx_consumer_path}" cmake --install "${dslx_grammar_build}"

  PKG_CONFIG_PATH="${dslx_prefix}/lib/pkgconfig:${dslx_prefix}/share/pkgconfig" \
    cmake -S test/consumer -B "${dslx_app_build}" -G Ninja
  cmake --build "${dslx_app_build}"
  LD_LIBRARY_PATH="${dslx_prefix}/lib" "${dslx_app_build}/dslx-consumer"
done
