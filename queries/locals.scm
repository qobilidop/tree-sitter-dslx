; SPDX-License-Identifier: Apache-2.0

[
  (function_definition)
  (proc_config)
  (proc_init)
  (proc_next)
  (lambda_expression)
  (match_arm)
  (for_expression)
  (block)
] @local.scope

(parameter
  name: (identifier) @local.definition)

(lambda_parameter
  name: (identifier) @local.definition)

(parametric_binding
  name: (identifier) @local.definition)

(pattern
  (identifier) @local.definition)

(path_expression
  (identifier) @local.reference)

(struct_field_initializer
  shorthand: (identifier) @local.reference)
