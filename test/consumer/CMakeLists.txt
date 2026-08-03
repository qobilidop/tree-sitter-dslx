#[[ SPDX-License-Identifier: Apache-2.0 ]]

cmake_minimum_required(VERSION 3.16)
project(tree-sitter-dslx-consumer LANGUAGES C)

find_package(PkgConfig REQUIRED)
pkg_check_modules(TREE_SITTER REQUIRED IMPORTED_TARGET tree-sitter)
pkg_check_modules(TREE_SITTER_DSLX REQUIRED IMPORTED_TARGET tree-sitter-dslx)

add_executable(dslx-consumer main.c)
target_compile_features(dslx-consumer PRIVATE c_std_11)
target_link_libraries(dslx-consumer
                      PRIVATE
                      PkgConfig::TREE_SITTER
                      PkgConfig::TREE_SITTER_DSLX)
