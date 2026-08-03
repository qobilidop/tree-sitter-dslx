cmake_minimum_required(VERSION 3.16)

project(tree-sitter-dslx
        VERSION "0.1.0"
        DESCRIPTION "DSLX grammar for Tree-sitter"
        HOMEPAGE_URL "https://github.com/qobilidop/tree-sitter-dslx"
        LANGUAGES C)

option(BUILD_SHARED_LIBS "Build shared libraries" ON)

set(TREE_SITTER_ABI_VERSION 15 CACHE STRING "Tree-sitter ABI version")

find_program(TREE_SITTER_CLI tree-sitter)

add_custom_command(OUTPUT "${CMAKE_CURRENT_SOURCE_DIR}/src/parser.c"
                   DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/src/grammar.json"
                   COMMAND "${TREE_SITTER_CLI}" generate src/grammar.json
                           --abi=${TREE_SITTER_ABI_VERSION}
                   WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
                   COMMENT "Generating parser.c")

add_library(tree-sitter-dslx src/parser.c)
target_include_directories(tree-sitter-dslx PRIVATE src)
set_target_properties(tree-sitter-dslx
                      PROPERTIES
                      C_STANDARD 11
                      POSITION_INDEPENDENT_CODE ON
                      SOVERSION "${TREE_SITTER_ABI_VERSION}.${PROJECT_VERSION_MAJOR}"
                      DEFINE_SYMBOL "")

include(GNUInstallDirs)

configure_file(bindings/c/tree-sitter-dslx.pc.in
               "${CMAKE_CURRENT_BINARY_DIR}/tree-sitter-dslx.pc" @ONLY)

install(FILES bindings/c/tree-sitter-dslx.h
        DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}/tree_sitter")
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/tree-sitter-dslx.pc"
        DESTINATION "${CMAKE_INSTALL_DATAROOTDIR}/pkgconfig")
install(TARGETS tree-sitter-dslx
        ARCHIVE DESTINATION "${CMAKE_INSTALL_LIBDIR}"
        LIBRARY DESTINATION "${CMAKE_INSTALL_LIBDIR}"
        RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}")

add_custom_target(ts-test "${TREE_SITTER_CLI}" test
                  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
                  COMMENT "Running Tree-sitter tests")
