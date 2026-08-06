; SPDX-License-Identifier: Apache-2.0

(type_alias
  name: (identifier) @name) @definition.class

(struct_definition
  name: (identifier) @name) @definition.class

(enum_definition
  name: (identifier) @name) @definition.class

[
  (proc_definition
    name: (identifier) @name)
  (proc_alias
    name: (identifier) @name)
] @definition.class

(trait_definition
  name: (identifier) @name) @definition.interface

(source_file
  (function_definition
    name: [
      (identifier) @name
      (macro_identifier) @name
    ]) @definition.function)

(impl_member
  (function_definition
    name: (identifier) @name) @definition.method)

(trait_member
  (function_definition
    name: (identifier) @name) @definition.method)

(call_expression
  function: (path_expression
    (identifier) @name .)) @reference.call

(function_reference
  function: (path_expression
    (identifier) @name .)) @reference.call

(spawn_expression
  callee: (path_expression
    (identifier) @name .)) @reference.call

(macro_invocation
  macro: (macro_identifier) @name) @reference.call

(type_alias
  type: (type_path
    (identifier) @name .) @reference.class)

(struct_member
  type: (type_path
    (identifier) @name .) @reference.class)

(proc_member
  type: (type_path
    (identifier) @name .) @reference.class)

(parameter
  type: (type_path
    (identifier) @name .) @reference.class)

(lambda_parameter
  type: (type_path
    (identifier) @name .) @reference.class)

(struct_expression
  type: (type_path
    (identifier) @name .) @reference.class)

(proc_alias
  target: (path_expression
    (identifier) @name .)) @reference.class

(impl_block
  type: (type_path
    (identifier) @name .)) @reference.implementation
