// SPDX-License-Identifier: Apache-2.0

#include <stdio.h>

#include <tree_sitter/api.h>
#include <tree_sitter/tree-sitter-dslx.h>

int main(void) {
  static const char source[] = "fn add(x: u32, y: u32) -> u32 { x + y }";
  TSParser *parser = ts_parser_new();
  if (parser == NULL || !ts_parser_set_language(parser, tree_sitter_dslx())) {
    ts_parser_delete(parser);
    return 1;
  }

  TSTree *tree =
      ts_parser_parse_string(parser, NULL, source, sizeof(source) - 1);
  const TSNode root = ts_tree_root_node(tree);
  const int passed = !ts_node_has_error(root);
  printf("C consumer smoke: root=%s error=%s\n", ts_node_type(root),
         passed ? "false" : "true");

  ts_tree_delete(tree);
  ts_parser_delete(parser);
  return passed ? 0 : 1;
}
