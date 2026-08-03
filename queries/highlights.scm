; SPDX-License-Identifier: Apache-2.0

(line_comment) @comment

(attribute_body name: (identifier) @attribute)
(attribute_argument name: (identifier) @property)

(function_definition name: (identifier) @function)
(function_definition name: (macro_identifier) @function)
(proc_definition name: (identifier) @type)
(proc_alias name: (identifier) @type)
(trait_definition name: (identifier) @type)

(call_expression
  function: (path_expression (identifier) @function))
(function_reference
  function: (path_expression (identifier) @function))
(spawn_expression
  callee: (path_expression (identifier) @function))
(macro_identifier) @function

(type_alias name: (identifier) @type)
(struct_definition name: (identifier) @type)
(enum_definition name: (identifier) @type)
(type_path (identifier) @type)
(builtin_type) @type.builtin
(generic_type) @type.builtin

((identifier) @constant
  (#match? @constant "^[A-Z][A-Z0-9_]*$"))

(parameter name: (identifier) @variable.parameter)
(lambda_parameter name: (identifier) @variable.parameter)
(parametric_binding name: (identifier) @variable.parameter)

(constant_definition name: (identifier) @constant)
(enum_member name: (identifier) @constant)
(struct_member name: (identifier) @property)
(proc_member name: (identifier) @property)
(struct_field_initializer name: (identifier) @property)
(field_expression field: (identifier) @property)

(integer_literal) @number
(boolean_literal) @boolean
(character_literal) @string.special
(string_literal) @string
(backtick_string_literal) @string.special
(visibility_modifier) @keyword

[
  "as"
  "chan"
  "config"
  "const"
  "else"
  "enum"
  "fn"
  "for"
  "if"
  "impl"
  "import"
  "in"
  "init"
  "let"
  "match"
  "next"
  "out"
  "proc"
  "self"
  "Self"
  "spawn"
  "struct"
  "trait"
  "type"
  "unroll_for!"
  "use"
] @keyword

(const_assert_statement "const_assert!" @function)

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ":"
  ","
  "."
  ";"
  "::"
] @punctuation.delimiter

[
  "!"
  "!="
  "%"
  "&"
  "&&"
  "*"
  "+"
  "+:"
  "++"
  "-"
  "->"
  "/"
  "<"
  "<<"
  "<="
  "="
  "=="
  "=>"
  ">"
  ">="
  ">>"
  "^"
  "|"
  "||"
  ".."
  "..="
] @operator
