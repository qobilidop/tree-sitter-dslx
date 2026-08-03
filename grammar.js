// SPDX-License-Identifier: Apache-2.0

module.exports = grammar({
  name: "dslx",

  extras: ($) => [/\s/, $.line_comment],

  word: ($) => $.identifier,

  rules: {
    source_file: ($) => repeat($._module_member),

    _module_member: ($) => choice($.function_definition),

    function_definition: ($) =>
      seq(
        optional("pub"),
        "fn",
        field("name", $.identifier),
        field("parameters", $.parameter_list),
        optional(seq("->", field("return_type", $._type))),
        field("body", $.block),
      ),

    parameter_list: ($) =>
      seq("(", optional(commaSep1($.parameter)), optional(","), ")"),

    parameter: ($) =>
      seq(field("name", $.identifier), ":", field("type", $._type)),

    _type: ($) => choice($.builtin_type, $.type_identifier),

    builtin_type: (_) =>
      token(choice("bool", "token", /[us](?:N|[1-9][0-9]*)/, /xN/)),

    type_identifier: (_) => /[A-Z][A-Za-z0-9_']*/,

    block: ($) => seq("{", optional($._expression), "}"),

    _expression: ($) => choice($.identifier, $.integer_literal),

    identifier: (_) => /[A-Za-z_][A-Za-z0-9_']*/,

    integer_literal: (_) => /[0-9][0-9_]*/,

    line_comment: (_) => token(seq("//", /[^\n\r]*/)),
  },
});

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
