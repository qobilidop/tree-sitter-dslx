// SPDX-License-Identifier: Apache-2.0

#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "tree_sitter/api.h"
#include "tree-sitter-dslx.h"

static char *read_file(const char *path, uint32_t *length) {
  FILE *file = fopen(path, "rb");
  if (file == NULL) {
    fprintf(stderr, "Could not open %s\n", path);
    return NULL;
  }
  if (fseek(file, 0, SEEK_END) != 0) {
    fclose(file);
    return NULL;
  }
  const long size = ftell(file);
  if (size < 0 || (unsigned long)size > UINT32_MAX) {
    fclose(file);
    return NULL;
  }
  rewind(file);
  char *source = malloc((size_t)size + 1);
  if (source == NULL) {
    fclose(file);
    return NULL;
  }
  if (fread(source, 1, (size_t)size, file) != (size_t)size) {
    free(source);
    fclose(file);
    return NULL;
  }
  fclose(file);
  source[size] = '\0';
  *length = (uint32_t)size;
  return source;
}

static bool check_file(TSParser *parser, const char *path) {
  static const char prefix[] = "// sanitizer edit\n";
  uint32_t source_length = 0;
  char *source = read_file(path, &source_length);
  if (source == NULL) {
    fprintf(stderr, "Could not read %s\n", path);
    return false;
  }

  TSTree *tree = ts_parser_parse_string(parser, NULL, source, source_length);
  if (tree == NULL || ts_node_has_error(ts_tree_root_node(tree))) {
    fprintf(stderr, "Initial parse failed: %s\n", path);
    free(source);
    ts_tree_delete(tree);
    return false;
  }

  const uint32_t prefix_length = (uint32_t)(sizeof(prefix) - 1);
  const uint32_t edited_length = source_length + prefix_length;
  char *edited_source = malloc((size_t)edited_length + 1);
  if (edited_source == NULL) {
    free(source);
    ts_tree_delete(tree);
    return false;
  }
  memcpy(edited_source, prefix, prefix_length);
  memcpy(edited_source + prefix_length, source, source_length + 1);

  const TSInputEdit edit = {
      .start_byte = 0,
      .old_end_byte = 0,
      .new_end_byte = prefix_length,
      .start_point = {0, 0},
      .old_end_point = {0, 0},
      .new_end_point = {1, 0},
  };
  ts_tree_edit(tree, &edit);
  TSTree *incremental =
      ts_parser_parse_string(parser, tree, edited_source, edited_length);
  TSTree *fresh =
      ts_parser_parse_string(parser, NULL, edited_source, edited_length);
  char *incremental_sexp =
      incremental == NULL ? NULL : ts_node_string(ts_tree_root_node(incremental));
  char *fresh_sexp =
      fresh == NULL ? NULL : ts_node_string(ts_tree_root_node(fresh));

  const bool passed =
      incremental != NULL && fresh != NULL && incremental_sexp != NULL &&
      fresh_sexp != NULL &&
      !ts_node_has_error(ts_tree_root_node(incremental)) &&
      strcmp(incremental_sexp, fresh_sexp) == 0;
  if (!passed) fprintf(stderr, "Incremental parse failed: %s\n", path);

  free(incremental_sexp);
  free(fresh_sexp);
  free(edited_source);
  free(source);
  ts_tree_delete(fresh);
  ts_tree_delete(incremental);
  ts_tree_delete(tree);
  return passed;
}

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "Usage: sanitizer-harness FILE...\n");
    return 64;
  }

  TSParser *parser = ts_parser_new();
  if (parser == NULL || !ts_parser_set_language(parser, tree_sitter_dslx())) {
    fprintf(stderr, "Could not initialize the DSLX parser\n");
    ts_parser_delete(parser);
    return 1;
  }

  for (int index = 1; index < argc; ++index) {
    if (!check_file(parser, argv[index])) {
      ts_parser_delete(parser);
      return 1;
    }
  }

  printf("Sanitizer validation passed: files=%d\n", argc - 1);
  ts_parser_delete(parser);
  return 0;
}
