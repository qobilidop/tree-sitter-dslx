; SPDX-License-Identifier: Apache-2.0

(line_comment) @comment

(function_definition name: (identifier) @function)
(parameter name: (identifier) @variable.parameter)

(builtin_type) @type.builtin
(type_identifier) @type

(integer_literal) @number

[
  "fn"
  "pub"
] @keyword

[
  "("
  ")"
  "{"
  "}"
] @punctuation.bracket

[
  ":"
  ","
] @punctuation.delimiter

"->" @operator
