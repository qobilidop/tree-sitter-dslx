cmake_minimum_required(VERSION 3.16)

project(tree-sitter-dslx
        VERSION "0.1.0"
        DESCRIPTION "DSLX grammar for Tree-sitter"
        HOMEPAGE_URL "https://github.com/qobilidop/tree-sitter-dslx"
        LANGUAGES C)

option(BUILD_SHARED_LIBS "Build shared libraries" ON)

set(TREE_SITTER_ABI_VERSION 15 CACHE STRING "Tree-sitter ABI version")

add_library(tree-sitter-dslx src/parser.c)
target_include_directories(tree-sitter-dslx PRIVATE src)
set_target_properties(tree-sitter-dslx
                      PROPERTIES
                      C_STANDARD 11
                      POSITION_INDEPENDENT_CODE ON
                      SOVERSION "${TREE_SITTER_ABI_VERSION}.${PROJECT_VERSION_MAJOR}"
                      DEFINE_SYMBOL ""
                      WINDOWS_EXPORT_ALL_SYMBOLS ON)

include(CTest)
if(BUILD_TESTING)
  add_executable(tree-sitter-dslx-smoke test/portable/main.c)
  target_compile_features(tree-sitter-dslx-smoke PRIVATE c_std_11)
  target_include_directories(tree-sitter-dslx-smoke PRIVATE bindings/c)
  target_link_libraries(tree-sitter-dslx-smoke PRIVATE tree-sitter-dslx)
  add_test(NAME tree-sitter-dslx-smoke COMMAND tree-sitter-dslx-smoke)
endif()

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
