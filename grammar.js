// SPDX-License-Identifier: Apache-2.0

const PREC = {
  range: 1,
  logical_or: 2,
  logical_and: 3,
  comparison: 4,
  bitwise_or: 5,
  bitwise_xor: 6,
  bitwise_and: 7,
  shift: 8,
  additive: 9,
  multiplicative: 10,
  cast: 11,
  unary: 12,
  call: 13,
  postfix: 14,
};

module.exports = grammar({
  name: "dslx",

  extras: ($) => [/\s/, $.line_comment],

  word: ($) => $.identifier,

  supertypes: ($) => [
    $._module_member,
    $._statement,
    $.expression,
    $.type_annotation,
  ],

  // DSLX resolves several identifier and `<...>` forms with name bindings in
  // its official parser. Tree-sitter has no symbol table, so these conflicts
  // deliberately retain both syntactic interpretations until later tokens
  // distinguish a type, value, pattern, or parametric function reference.
  conflicts: ($) => [
    [$.type_path, $.path_expression],
    [$.tuple_type, $.tuple_expression],
    [$.type_path, $.path_expression, $.pattern],
    [$.path_expression, $.pattern],
    [$.expression, $.lambda_expression],
    [$.tuple_type, $.tuple_pattern],
    [$.type_annotation, $.array_type],
    [$.path_expression],
    [$.expression, $.call_expression, $.function_reference],
    [$.call_expression, $.function_reference],
  ],

  rules: {
    source_file: ($) => repeat($._module_member),

    _module_member: ($) =>
      choice(
        $.module_attribute,
        $.function_definition,
        $.proc_definition,
        $.proc_alias,
        $.import_statement,
        $.use_statement,
        $.type_alias,
        $.struct_definition,
        $.enum_definition,
        $.constant_definition,
        $.impl_block,
        $.trait_definition,
        $.const_assert_statement,
      ),

    module_attribute: ($) => seq("#", "!", $.attribute_body),

    attribute: ($) => seq("#", $.attribute_body),

    attribute_body: ($) =>
      seq(
        "[",
        field("name", $.identifier),
        optional(field("arguments", $.attribute_arguments)),
        "]",
      ),

    attribute_arguments: ($) =>
      seq("(", optional(commaSep1($.attribute_argument)), optional(","), ")"),

    attribute_argument: ($) =>
      choice(
        seq(
          field("name", $.identifier),
          "=",
          field("value", $.attribute_value),
        ),
        $.attribute_value,
      ),

    attribute_value: ($) =>
      choice(
        $.string_literal,
        $.backtick_string_literal,
        $.integer_literal,
        $.boolean_literal,
        $.identifier,
      ),

    visibility_modifier: (_) => "pub",

    function_definition: ($) =>
      seq(
        repeat(field("attribute", $.attribute)),
        optional(field("visibility", $.visibility_modifier)),
        "fn",
        field("name", choice($.identifier, $.macro_identifier)),
        optional(field("parametrics", $.parametric_bindings)),
        field("parameters", $.parameter_list),
        optional(seq("->", field("return_type", $.type_annotation))),
        choice(field("body", $.block), ";"),
      ),

    parameter_list: ($) =>
      seq("(", optional(commaSep1($.parameter)), optional(","), ")"),

    parameter: ($) =>
      choice(
        seq(
          field("name", "self"),
          optional(seq(":", field("type", $.type_annotation))),
        ),
        seq(field("name", $.identifier), ":", field("type", $.type_annotation)),
      ),

    parametric_bindings: ($) =>
      seq("<", commaSep1($.parametric_binding), optional(","), $._close_angle),

    parametric_binding: ($) =>
      seq(
        field("name", $.identifier),
        ":",
        field("type", $.type_annotation),
        optional(
          seq(
            "=",
            field(
              "default",
              choice($.braced_parametric_argument, $.parametric_argument),
            ),
          ),
        ),
      ),

    braced_parametric_argument: ($) =>
      prec(1, seq("{", field("value", $.expression), "}")),

    import_statement: ($) =>
      seq(
        "import",
        field("path", $.import_path),
        optional(seq("as", field("alias", $.identifier))),
        ";",
      ),

    import_path: ($) => seq($.identifier, repeat(seq(".", $.identifier))),

    use_statement: ($) => seq("use", field("tree", $.use_tree), ";"),

    use_tree: ($) =>
      prec.right(
        seq(
          field("path", choice($.identifier, "self")),
          optional(
            seq(
              "::",
              choice(
                field("child", $.use_tree),
                seq("{", optional(commaSep1($.use_tree)), optional(","), "}"),
              ),
            ),
          ),
          optional(seq("as", field("alias", $.identifier))),
        ),
      ),

    type_alias: ($) =>
      seq(
        repeat(field("attribute", $.attribute)),
        optional(field("visibility", $.visibility_modifier)),
        "type",
        field("name", $.identifier),
        "=",
        field("type", $.type_annotation),
        ";",
      ),

    struct_definition: ($) =>
      seq(
        repeat(field("attribute", $.attribute)),
        optional(field("visibility", $.visibility_modifier)),
        "struct",
        field("name", $.identifier),
        optional(field("parametrics", $.parametric_bindings)),
        field("body", $.struct_body),
      ),

    struct_body: ($) =>
      seq("{", optional(commaSep1($.struct_member)), optional(","), "}"),

    struct_member: ($) =>
      seq(
        repeat(field("attribute", $.attribute)),
        field("name", $.identifier),
        ":",
        field("type", $.type_annotation),
      ),

    enum_definition: ($) =>
      seq(
        repeat(field("attribute", $.attribute)),
        optional(field("visibility", $.visibility_modifier)),
        "enum",
        field("name", $.identifier),
        optional(seq(":", field("underlying_type", $.type_annotation))),
        "{",
        optional(commaSep1($.enum_member)),
        optional(","),
        "}",
      ),

    enum_member: ($) =>
      seq(field("name", $.identifier), "=", field("value", $.expression)),

    constant_definition: ($) =>
      seq(
        optional(field("visibility", $.visibility_modifier)),
        "const",
        field("name", $.identifier),
        optional(seq(":", field("type", $.type_annotation))),
        "=",
        field("value", $.expression),
        ";",
      ),

    trait_definition: ($) =>
      seq(
        optional(field("visibility", $.visibility_modifier)),
        "trait",
        field("name", $.identifier),
        "{",
        repeat($.trait_member),
        "}",
      ),

    trait_member: ($) => choice($.function_definition, $.type_alias),

    impl_block: ($) =>
      seq(
        optional(field("visibility", $.visibility_modifier)),
        "impl",
        field("type", $.type_annotation),
        "{",
        repeat($.impl_member),
        "}",
      ),

    impl_member: ($) =>
      choice($.function_definition, $.constant_definition, $.type_alias),

    proc_alias: ($) =>
      seq(
        repeat(field("attribute", $.attribute)),
        optional(field("visibility", $.visibility_modifier)),
        "proc",
        field("name", $.identifier),
        "=",
        field("target", $.path_expression),
        optional(field("parametrics", $.parametric_arguments)),
        ";",
      ),

    proc_definition: ($) =>
      seq(
        repeat(field("attribute", $.attribute)),
        optional(field("visibility", $.visibility_modifier)),
        "proc",
        field("name", $.identifier),
        optional(field("parametrics", $.parametric_bindings)),
        "{",
        repeat($.proc_item),
        "}",
      ),

    proc_item: ($) =>
      choice(
        $.proc_member,
        $.proc_config,
        $.proc_init,
        $.proc_next,
        $.type_alias,
        $.constant_definition,
        $.const_assert_statement,
      ),

    proc_member: ($) =>
      seq(
        repeat(field("attribute", $.attribute)),
        field("name", $.identifier),
        ":",
        field("type", $.type_annotation),
        optional(choice(";", ",")),
      ),

    proc_config: ($) =>
      seq(
        "config",
        field("parameters", $.parameter_list),
        optional(seq("->", field("return_type", $.type_annotation))),
        field("body", $.block),
      ),

    proc_init: ($) =>
      seq(
        "init",
        optional(field("parameters", $.parameter_list)),
        optional(seq("->", field("return_type", $.type_annotation))),
        field("body", $.block),
      ),

    proc_next: ($) =>
      seq(
        "next",
        field("parameters", $.parameter_list),
        optional(seq("->", field("return_type", $.type_annotation))),
        field("body", $.block),
      ),

    type_annotation: ($) =>
      choice(
        $.builtin_type,
        $.generic_type,
        $.type_path,
        $.tuple_type,
        $.channel_type,
        $.array_type,
      ),

    generic_type: (_) => "type",

    builtin_type: (_) =>
      token(
        choice(
          "bits",
          "bool",
          "token",
          "uN",
          "sN",
          "xN",
          /u(?:[1-9]|[1-5][0-9]|6[0-4])/,
          /s(?:[1-9]|[1-5][0-9]|6[0-4])/,
        ),
      ),

    type_path: ($) =>
      prec.right(
        seq(
          choice($.identifier, "Self"),
          repeat(seq("::", $.identifier)),
          optional(field("arguments", $.parametric_arguments)),
        ),
      ),

    tuple_type: ($) =>
      seq("(", optional(commaSep1($.type_annotation)), optional(","), ")"),

    channel_type: ($) =>
      seq(
        "chan",
        "<",
        field("payload", $.type_annotation),
        $._close_angle,
        repeat(field("dimension", $.array_dimension)),
        field("direction", choice("in", "out")),
      ),

    array_type: ($) =>
      prec.right(
        seq(
          field(
            "element",
            choice(
              $.builtin_type,
              $.generic_type,
              $.type_path,
              $.tuple_type,
              $.channel_type,
            ),
          ),
          repeat1(field("dimension", $.array_dimension)),
        ),
      ),

    array_dimension: ($) => seq("[", field("size", $.expression), "]"),

    parametric_arguments: ($) =>
      seq("<", commaSep1($.parametric_argument), optional(","), $._close_angle),

    parametric_argument: ($) =>
      choice(
        $.builtin_type,
        $.generic_type,
        $.tuple_type,
        $.channel_type,
        $.array_type,
        $.expression,
      ),

    block: ($) =>
      seq(
        "{",
        repeat($._statement),
        optional(field("result", $.expression)),
        "}",
      ),

    _statement: ($) =>
      choice(
        $.let_statement,
        $.local_constant_statement,
        $.type_alias,
        $.const_assert_statement,
        $.expression_statement,
      ),

    let_statement: ($) =>
      seq(
        "let",
        field("pattern", $.pattern),
        optional(seq(":", field("type", $.type_annotation))),
        "=",
        field("value", $.expression),
        ";",
      ),

    local_constant_statement: ($) =>
      seq(
        "const",
        field("pattern", $.pattern),
        optional(seq(":", field("type", $.type_annotation))),
        "=",
        field("value", $.expression),
        ";",
      ),

    const_assert_statement: ($) =>
      seq("const_assert!", "(", field("condition", $.expression), ")", ";"),

    expression_statement: ($) => seq($.expression, ";"),

    expression: ($) =>
      choice(
        $.integer_literal,
        $.character_literal,
        $.string_literal,
        $.boolean_literal,
        $.path_expression,
        $.parenthesized_expression,
        $.tuple_expression,
        $.array_expression,
        $.struct_expression,
        $.typed_expression,
        $.block,
        $.if_expression,
        $.match_expression,
        $.for_expression,
        $.lambda_expression,
        $.channel_expression,
        $.spawn_expression,
        $.macro_invocation,
        $.unary_expression,
        $.binary_expression,
        $.cast_expression,
        $.call_expression,
        $.function_reference,
        $.field_expression,
        $.tuple_index_expression,
        $.index_expression,
        $.slice_expression,
        $.width_slice_expression,
        $.labeled_expression,
      ),

    path_expression: ($) =>
      choice(
        seq(
          choice($.identifier, "self", "in", "out", "Self"),
          repeat(seq("::", $.identifier)),
        ),
        seq(
          choice($.identifier, "Self"),
          repeat(seq("::", $.identifier)),
          field("arguments", $.parametric_arguments),
          repeat1(seq("::", $.identifier)),
        ),
        seq($.builtin_type, repeat1(seq("::", $.identifier))),
      ),

    parenthesized_expression: ($) => seq("(", $.expression, ")"),

    tuple_expression: ($) =>
      seq(
        "(",
        optional(
          choice(
            ",",
            seq(
              $.expression,
              ",",
              optional(commaSep1($.expression)),
              optional(","),
            ),
          ),
        ),
        ")",
      ),

    array_expression: ($) =>
      seq(
        "[",
        optional(commaSep1($.expression)),
        optional(seq(optional(","), "...")),
        optional(","),
        "]",
      ),

    struct_expression: ($) =>
      prec.dynamic(
        1,
        seq(
          field("type", $.type_path),
          "{",
          optional(commaSep1($.struct_field_initializer)),
          optional(","),
          "}",
        ),
      ),

    struct_field_initializer: ($) =>
      choice(
        seq(field("name", $.identifier), ":", field("value", $.expression)),
        field("shorthand", $.identifier),
        seq("..", field("splat", $.expression)),
      ),

    typed_expression: ($) =>
      prec.dynamic(
        1,
        seq(
          field("type", $.type_annotation),
          ":",
          field(
            "value",
            choice(
              $.integer_literal,
              $.character_literal,
              $.boolean_literal,
              $.array_expression,
              $.tuple_expression,
              $.path_expression,
              $.unary_expression,
              $.typed_expression,
            ),
          ),
        ),
      ),

    if_expression: ($) =>
      prec.right(
        seq(
          optional("const"),
          "if",
          field("condition", $.expression),
          field("consequence", $.block),
          optional(
            seq("else", field("alternative", choice($.block, $.if_expression))),
          ),
        ),
      ),

    match_expression: ($) =>
      seq(
        optional("const"),
        "match",
        field("value", $.expression),
        "{",
        repeat(seq($.match_arm, optional(","))),
        "}",
      ),

    match_arm: ($) =>
      seq(
        field("pattern", $.pattern),
        repeat(seq("|", field("alternative_pattern", $.pattern))),
        "=>",
        field("value", $.expression),
      ),

    pattern: ($) =>
      choice(
        $.identifier,
        $.rest_pattern,
        $.tuple_pattern,
        $.path_expression,
        $.literal_pattern,
        $.range_pattern,
      ),

    rest_pattern: (_) => "..",

    tuple_pattern: ($) =>
      seq("(", optional(commaSep1($.pattern)), optional(","), ")"),

    literal_pattern: ($) =>
      choice(
        $.integer_literal,
        $.character_literal,
        $.boolean_literal,
        $.typed_expression,
      ),

    range_pattern: ($) =>
      seq(
        field("start", $.literal_pattern),
        field("operator", choice("..", "..=")),
        field("end", $.literal_pattern),
      ),

    for_expression: ($) =>
      seq(
        optional("const"),
        choice("for", "unroll_for!"),
        field("pattern", $.pattern),
        optional(seq(":", field("type", $.type_annotation))),
        "in",
        field("iterable", $.expression),
        field("body", $.block),
        "(",
        field("initial_value", $.expression),
        ")",
      ),

    lambda_expression: ($) =>
      seq(
        choice(
          "||",
          seq("|", optional(commaSep1($.lambda_parameter)), optional(","), "|"),
        ),
        optional(seq("->", field("return_type", $.type_annotation))),
        field("body", choice($.block, $.expression)),
      ),

    lambda_parameter: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq(":", field("type", $.type_annotation))),
      ),

    channel_expression: ($) =>
      seq(
        optional(field("attribute", $.attribute)),
        "chan",
        "<",
        field("payload", $.type_annotation),
        optional(seq(",", field("depth", $.parametric_argument))),
        $._close_angle,
        repeat(field("dimension", $.array_dimension)),
        "(",
        field("name", $.expression),
        ")",
      ),

    spawn_expression: ($) =>
      prec.right(
        seq(
          "spawn",
          field("callee", $.path_expression),
          optional(field("parametrics", $.parametric_arguments)),
          field("arguments", $.argument_list),
          optional(field("next_arguments", $.argument_list)),
        ),
      ),

    macro_invocation: ($) =>
      prec(
        PREC.call,
        seq(
          field("macro", $.macro_identifier),
          optional(field("parametrics", $.parametric_arguments)),
          field("arguments", $.argument_list),
        ),
      ),

    argument_list: ($) =>
      seq("(", optional(commaSep1($.expression)), optional(","), ")"),

    unary_expression: ($) =>
      prec(PREC.unary, seq(field("operator", choice("!", "-")), $.expression)),

    binary_expression: ($) => {
      const table = [
        [choice("..", "..="), PREC.range],
        ["||", PREC.logical_or],
        ["&&", PREC.logical_and],
        [choice("==", "!=", ">", ">=", "<", "<="), PREC.comparison],
        ["|", PREC.bitwise_or],
        ["^", PREC.bitwise_xor],
        ["&", PREC.bitwise_and],
        [choice("<<", ">>"), PREC.shift],
        [choice("+", "-", "++"), PREC.additive],
        [choice("*", "/", "%"), PREC.multiplicative],
      ];

      return choice(
        ...table.map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(
              field("left", $.expression),
              field("operator", operator),
              field("right", $.expression),
            ),
          ),
        ),
      );
    },

    cast_expression: ($) =>
      prec.left(
        PREC.cast,
        seq(
          field("value", $.expression),
          "as",
          field("type", $.type_annotation),
        ),
      ),

    call_expression: ($) =>
      choice(
        prec.dynamic(
          1,
          seq(
            field("function", $.path_expression),
            field("parametrics", $.parametric_arguments),
            field("arguments", $.argument_list),
          ),
        ),
        prec.left(
          PREC.call,
          seq(
            field("function", $.builtin_type),
            field("arguments", $.argument_list),
          ),
        ),
        prec.left(
          PREC.call,
          seq(
            field("function", $.expression),
            field("arguments", $.argument_list),
          ),
        ),
      ),

    function_reference: ($) =>
      prec.dynamic(
        1,
        seq(
          field("function", $.path_expression),
          field("parametrics", $.parametric_arguments),
        ),
      ),

    field_expression: ($) =>
      prec.left(
        PREC.postfix,
        seq(field("value", $.expression), ".", field("field", $.identifier)),
      ),

    tuple_index_expression: ($) =>
      prec.left(
        PREC.postfix,
        seq(
          field("value", $.expression),
          ".",
          field("index", $.integer_literal),
        ),
      ),

    index_expression: ($) =>
      prec.left(
        PREC.postfix,
        seq(
          field("value", $.expression),
          "[",
          field("index", $.expression),
          "]",
        ),
      ),

    slice_expression: ($) =>
      prec.left(
        PREC.postfix,
        seq(
          field("value", $.expression),
          "[",
          optional(field("start", $.expression)),
          ":",
          optional(field("limit", $.expression)),
          "]",
        ),
      ),

    width_slice_expression: ($) =>
      prec.left(
        PREC.postfix,
        seq(
          field("value", $.expression),
          "[",
          field("start", $.expression),
          "+:",
          field("width", $.type_annotation),
          "]",
        ),
      ),

    labeled_expression: ($) =>
      seq("'", field("label", $.identifier), ":", field("value", $.expression)),

    boolean_literal: (_) => choice("true", "false"),

    integer_literal: (_) =>
      token(choice(/0[xX][0-9a-fA-F_]+/, /0[bB][01_]+/, /0|[1-9][0-9]*/)),

    character_literal: (_) =>
      token(
        seq(
          "'",
          choice(/[^'\\\n\r]/, /\\(?:[nrt\\0'\"]|x[0-9a-fA-F]{2})/),
          "'",
        ),
      ),

    string_literal: (_) =>
      token(
        seq(
          '"',
          repeat(
            choice(
              /[^"\\]/,
              /\\(?:[nrt\\0'\"]|x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,6}\})/,
            ),
          ),
          '"',
        ),
      ),

    backtick_string_literal: (_) =>
      token(
        seq(
          "`",
          repeat(
            choice(
              /[^`\\]/,
              /\\(?:[nrt\\0'\"]|x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,6}\})/,
            ),
          ),
          "`",
        ),
      ),

    macro_identifier: (_) => /[A-Za-z_][A-Za-z0-9_']*!/,

    identifier: (_) => /[A-Za-z_][A-Za-z0-9_']*/,

    _close_angle: (_) => token(prec(1, ">")),

    line_comment: (_) => token(seq("//", /[^\n\r]*/)),
  },
});

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
