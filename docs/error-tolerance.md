# Error tolerance and incremental parsing

This document explains what “error-tolerant” means for `tree-sitter-dslx`, which
parts come from Tree-sitter itself, and which grammar and testing choices make
recovery useful for DSLX editing.

## Overview

`tree-sitter-dslx` does not implement a separate recovery algorithm. Tree-sitter
supplies recovery and attempts to produce a concrete syntax tree for every edit.
The grammar makes that tree useful without relaxing valid DSLX: required syntax
stays required, declarations and body members have clear boundaries, expression
precedence is explicit, and only narrow ambiguities are retained.

In the editing cases covered by the tests, incomplete constructs become local
`MISSING` or `ERROR` regions while later declarations and their highlights
remain available. Focused recovery tests pin selected tree shapes. The broader
suites compare incremental reparses with fresh parses where equality is
required, run queries safely on malformed trees, and verify that repaired edits
return to clean trees. These are observed outcomes, not proof that any one
grammar choice guarantees a particular recovery shape.

The pinned upstream parser serves a different role. It is a binding-aware
recursive-descent parser; the high-level `ParseModule`/`ParseAndTypecheck` path
used by `dslx_ls` returns an error status instead of exposing a recovered module.
Tree-sitter supplies editor-oriented structure during invalid edits, while XLS
remains authoritative for parsing policy, names, types, and diagnostics.

Error tolerance does not make every token sequence valid. The grammar has no
wildcard declaration, expression, or statement rule that silently accepts
arbitrary text.

## Behavioral goals and boundaries

During an ordinary edit, the parser should:

- return a tree instead of stopping at the first syntax error;
- keep the damaged region near the edit when the surrounding syntax permits it;
- continue recognizing later declarations, statements, and useful child nodes;
- let structural queries such as highlighting run on the partial tree;
- reparse incrementally, reusing unaffected parts of the previous tree; and
- return to the intended clean tree when the edit is repaired.

It does **not** promise that malformed DSLX has a unique tree, that recovery
nodes are compiler diagnostics, or that a tree without syntax errors denotes a
well-typed program.

### Responsibility boundaries

Responsibility is split across four layers:

| Layer                               | Responsibility                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tree-sitter runtime                 | Incremental generalized LR (GLR) parsing, subtree reuse, and costed recovery paths that can insert a missing token, skip input, or return to an earlier valid parse state |
| `grammar.js`                        | DSLX productions, precedence, ambiguity declarations, and structural boundaries that guide the runtime toward a useful recovery                                           |
| Queries and consumers               | Continue operating on recognized nodes while treating recovered regions as uncertain                                                                                      |
| Official XLS frontend and `dslx_ls` | Authoritative parsing policy, name resolution, type checking, and user-facing semantic diagnostics                                                                        |

## Design choices at a glance

These are design rationales. The tests later in this document validate the
resulting behavior, but they do not isolate the causal contribution of each
choice.

| Choice                                                    | Recovery rationale                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Keep required syntax required                             | Tree-sitter can represent an absent required symbol with a visible, zero-width `MISSING` node instead of silently accepting the incomplete form        |
| Build files and bodies from repeated, delimited siblings  | Keywords, separators, and closing delimiters give the recovery search plausible states at which to finish one construct and recognize the next         |
| Encode expression precedence and postfix forms explicitly | A damaged operator, call, index, or slice remains in a more specific syntactic context                                                                 |
| Declare only narrow ambiguities                           | Tree-sitter can retain type/value/parametric or purely syntactic alternatives without a symbol table, reducing false syntax errors from an early guess |
| Use named nodes and fields                                | Consumers can find intact siblings without depending on the exact contents of a recovered region                                                       |
| Keep lexical state simple                                 | Incremental reuse has no external-scanner state to restore                                                                                             |

The next sections show the resulting recovery trees and expand each design
choice. Readers primarily interested in XLS can jump directly to the
[side-by-side comparison](#side-by-side-behavior).

## What recovery looks like

Tree-sitter represents the two common recovery outcomes differently.

### A required token is absent: `MISSING`

Consider an expression whose right-hand side has not been typed yet:

```dslx
fn broken(x: u32) -> u32 {
  x +
}

fn intact() -> u32 { u32:42 }
```

The exact recovery test contains this subtree:

```scheme
(binary_expression
  (path_expression
    (identifier))
  (path_expression
    (MISSING identifier)))
```

The required right operand in `binary_expression` gives Tree-sitter somewhere
to record the omission. The existing `}` can still close the block, so the next
function is parsed as an ordinary `function_definition`. A `MISSING` node has
zero source width: it records a token the parser inferred but did not consume.

The same idea applies to an unfinished parametric list. Here the closing `>` is
missing between `u32` and `(`:

```dslx
fn broken<N: u32(x: u32) -> u32 { x }
const AFTER = u32:1;
```

Here the result includes `(MISSING ">")`, after which `(` begins the parameter
list and `const AFTER` remains a separate top-level declaration.

### Input cannot be incorporated: `ERROR`

An `ERROR` contains source-backed material that Tree-sitter could not fit into
the chosen parse. During [recovery][tree-sitter-recovery], Tree-sitter may skip
the current lookahead, or return to an earlier valid parser state and wrap
subtrees removed from the parse stack. In this example from
[`test/corpus/recovery.txt`](../test/corpus/recovery.txt), the first channel type
is missing its closing `>`:

```dslx
proc Broken {
  input: chan<u32 in;
  output: chan<u32> out;
}
```

For this token sequence, Tree-sitter produces an `ERROR` region instead of
inserting only one missing symbol. It still closes the surrounding
`proc_definition` and keeps recognizable nodes inside the recovered region, but
the exact damaged subtree is less structured than the `MISSING` examples.

This distinction matters to consumers:

- `MISSING` means the parser inserted an expected, zero-width symbol.
- `ERROR` marks source-backed material excluded from the chosen parse
  through one of those recovery paths.
- `rootNode.hasError` reports that either kind occurs below the root.
- Nodes outside the recovered region can still be useful, but recovered
  subtrees should not be treated as semantically trustworthy.

## Grammar choices that guide recovery

There is no explicit `ERROR` production in
[`grammar.js`](../grammar.js). Tree-sitter generates recovery behavior for the
whole grammar. The following choices shape the alternatives available to that
runtime behavior.

### 1. Keep valid syntax strict

Required DSLX syntax remains required in `seq(...)` productions. Function
parameters have delimiters, bindings require `=`, statements that need a
semicolon require one, binary expressions require both operands, and delimited
types require their closing token.

This gives Tree-sitter the opportunity to report a precise omission such as a
missing `>` or identifier. Making those pieces optional merely to accept
incomplete input would erase the difference between valid syntax and a recovered
editing state. It could also change the shape of valid trees and allow a mistake
to absorb unrelated following syntax.

The grammar does use `optional(...)`, but primarily where DSLX actually permits
omission: visibility, return types, trailing commas, optional type annotations,
and final block results are examples. Syntax-layer forms that are meaningful to
an editor but later rejected semantically are also intentionally left to the
official frontend. This is a syntax/semantics boundary, not a catch-all error
rule.

### 2. Give the parser frequent structural boundaries

Large containers are sequences of small, recognizable siblings:

- `source_file` repeats `_module_member`;
- blocks repeat `_statement` and may end in one result expression;
- proc, trait, and impl bodies repeat their respective member rules;
- match bodies repeat arms; and
- parameters, arguments, fields, and other collections use explicit separators
  and closing delimiters.

Keywords such as `fn`, `proc`, `const`, `struct`, and `enum`, plus punctuation
such as `;`, `,`, `)`, and `}`, can act as strong landmarks. They are not
manually declared “synchronization tokens”; Tree-sitter has no such list in this
grammar. Rather, the ordinary grammar gives the recovery search plausible prior
states in which one construct can finish and the next sibling can begin.

This is why the recovery tests assert not only the presence of an error but the
survival of following structure. The goal is a small uncertain island in an
otherwise navigable tree, when the source provides a reasonable boundary.

### 3. Model precedence and postfix structure explicitly

`PREC` defines every DSLX expression tier, and binary expressions use explicit
left associativity. Calls, field access, tuple indices, indexing, and slices
have their own postfix rules.

This is primarily a correctness decision, but it also supplies more specific
recovery contexts. For `x + }`, the observed tree records the omission as the
right operand of a `binary_expression`. Distinct postfix nodes similarly give a
damaged slice or call a local syntactic context. The tests verify these resulting
trees; they do not separately measure precedence's contribution to recovery.

### 4. Preserve real DSLX ambiguities instead of guessing semantically

Some conflicts arise because the official DSLX parser can consult name bindings
to decide whether identifier and `<...>` forms denote types, values, or
parametric references. Others are ordinary syntactic overlaps, such as tuple
types, expressions, and patterns. A Tree-sitter grammar has no symbol table, so
the `conflicts` list retains both kinds of competing interpretation:

- **Name-dependent alternatives:** `type_path` versus `path_expression`, and
  call expressions versus parametric function references.
- **Purely syntactic overlaps:** tuple type, tuple expression, and tuple pattern
  forms.

Tree-sitter can carry these alternatives until later tokens distinguish them.
Narrow `prec.dynamic(...)` choices then prefer the intended tree in the few
remaining contexts. For the name-dependent subset, this avoids false syntax
errors caused by committing early to a decision that requires semantic
knowledge.

The private `_close_angle` token gives `>` explicit lexical precedence when a
parametric or channel rule expects a closing delimiter. This helps separate a
generic close from DSLX comparison and shift operators in the surrounding
expression grammar.

These ambiguity declarations are intentionally narrow. Broad conflicts can
increase parser size and work per edit, and can make both normal parsing and
recovery less predictable.

### 5. Expose stable named nodes and fields

Meaningful constructs have named nodes and fields such as `name`, `type`,
`body`, `value`, and `parameters`. Module members, statements, expressions, and
type annotations are declared as supertypes in the generated node schema.

These choices do not change Tree-sitter's recovery algorithm, but they determine
whether a recovered tree remains useful. A consumer can still find an intact
following function by node type and field instead of depending on byte ranges
or on the exact contents of a preceding `ERROR` node.

### 6. Keep lexical state simple

The grammar currently needs no external scanner. Identifiers, literals,
operators, whitespace, and line comments are represented with ordinary
Tree-sitter tokens, and `word: $.identifier` gives keywords and identifiers a
consistent lexical boundary.

Avoiding an external scanner removes an additional serialized state machine
from incremental reparsing. This is not a rule that an external scanner is bad;
one should be added if DSLX gains a lexical construct that requires it. Its
state, malformed-input behavior, and incremental restoration would then need
focused tests.

Whitespace and line comments are `extras`, so inserting them between tokens
does not disturb the surrounding syntax tree. Metamorphic tests vary source
details that should not affect the surrounding tree, including comment prefixes,
suffixes, and line endings across the pinned corpus.

## Comparison with the upstream DSLX parser

This comparison is grounded in XLS commit
[`69f84975c32f3471c113a2115f8d0e344ca4d73b`][xls-revision], the same revision
recorded in
[`test/upstream/XLS_REVISION`](../test/upstream/XLS_REVISION). It describes that
pinned implementation, not an unqualified claim about future XLS versions.

### Side-by-side behavior

| Concern                         | Pinned upstream parser / `dslx_ls`                                                                              | `tree-sitter-dslx`                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Parser style                    | Handwritten recursive descent over a DSLX scanner                                                               | Generated incremental LR/GLR parser                                               |
| Primary result                  | Semantic AST whose names and contextual forms are partly validated during parsing                               | Concrete syntax tree that preserves source structure and punctuation              |
| Ambiguity                       | Binding lookup, targeted lookahead, restrictions, and transactional rollback                                    | Narrow GLR conflicts, static/dynamic precedence, and later-token disambiguation   |
| Syntax failure                  | Failed `ParseModule` returns a status; its `StatusOr` exposes no partial `Module`                               | Return a tree containing `ERROR` and/or `MISSING` nodes                           |
| Following valid declaration     | Not available through the failed `ParseModule` result                                                           | Often remains a normal sibling node when recovery finds a boundary                |
| Edit handling                   | Fresh parse-and-typecheck of the current full buffer on each update                                             | Edit the old tree and incrementally reparse, reusing unaffected subtrees          |
| Features while syntax is broken | The failure status remains available for a best-effort diagnostic; AST/type-based features are gated on success | Syntax queries can continue over intact and recognized recovered structure        |
| Authority                       | Official diagnostics, contextual language policy, bindings, and types                                           | Editor-oriented syntax structure; not an official acceptance or diagnostic oracle |

### The upstream parse path

At the pinned revision, the official frontend works as follows:

1. [`Scanner`][upstream-scanner] lazily produces DSLX tokens. Scanning can itself
   return an error status, for example for a malformed literal.
2. [`Parser`][upstream-parser-header] is a handwritten recursive-descent parser
   that builds the official DSLX AST while maintaining lexical `Bindings`: the
   names known in the current scope.
3. Helpers such as [`PopTokenOrError`][upstream-token-parser] compare the next
   token with the required kind. On a mismatch they return a positional
   `ParseError` with an “expected … got …” message.
4. `XLS_ASSIGN_OR_RETURN` and `XLS_RETURN_IF_ERROR` propagate that status through
   the active production. [`Parser::ParseModule`][upstream-parse-module] has no
   catch-and-synchronize loop: the first unhandled scan, syntax, binding, or
   parser-policy error ends the parse, and its success-or-error `StatusOr` result
   does not return a partial `Module`.
5. [`ParseAndTypecheck`][upstream-parse-and-typecheck] invokes `ParseModule` and
   proceeds to type checking only if parsing produced a complete module.

This design is appropriate for the authoritative frontend. It can produce a
specific diagnostic at the point where a production's expectation failed, and
its AST never needs placeholder nodes whose meaning later compiler passes would
have to accommodate.

The language server uses the same path. On every textual update,
[`LanguageServerAdapter::Update`][upstream-lsp-update] creates fresh import data
and calls `ParseAndTypecheck` on the current full buffer. The
[adapter header][upstream-lsp-header] notes that this currently happens on every
keystroke.

The adapter stores either a complete `TypecheckedModule` or the failure status.
`GenerateParseDiagnostics` makes a best-effort attempt to convert that one
status into a positional diagnostic; if the status is not in a recognized
positional form, it emits none.

Document symbols, definition lookup, formatting, import links, inlay hints,
rename, and document highlights all check that the stored parse-and-typecheck
result is successful; otherwise they return an empty result or no edit. Those
guards and the best-effort conversion are visible in the
[adapter implementation][upstream-lsp-features].

Two facts should not be conflated. `dslx_ls` does run the upstream parser on
incomplete buffers, but its high-level `ParseModule`/`ParseAndTypecheck` path
does not expose the failed parse as a recovered `Module`. A low-level caller
holding a `Parser` could inspect its
[public `module()` accessor][upstream-parser-header] after failure, but `dslx_ls`
does not use that as a recovered result, and the parser has not continued
through later declarations.

### Upstream backtracking is not error recovery

The official parser is not purely predictive. Its
[`Transaction`][upstream-parser-transaction] saves a token-stream checkpoint and
child bindings so a known ambiguous production can be attempted and rolled
back. Examples include:

- parenthesized expression versus tuple cast;
- `<` as comparison versus parametric function invocation/reference; and
- imported qualified value versus parametric struct construction.

The parser also uses expression restrictions to disallow a struct literal where
the following `{` should begin an `if` body. While parsing parametrics, a scanner
guard tokenizes `>>` as two closing angle brackets rather than a right shift.

These mechanisms retry specific valid interpretations. They do not skip ahead
after arbitrary malformed input, synthesize missing AST nodes, or preserve the
rest of a module after all alternatives fail. Once no valid interpretation
succeeds, the parser selects a failure status and ordinary status propagation
returns it to the caller.

Tree-sitter cannot reproduce those binding lookups and targeted transactions.
For name-dependent forms it uses narrow `conflicts`, static and dynamic
precedence, contextual rule shape, and `_close_angle` to retain or prefer
syntactic interpretations without upstream `Bindings`. The grammar also has
purely syntactic conflicts, such as tuple type versus tuple expression/pattern
and expression versus lambda forms; those are not claimed to correspond to a
binding lookup in the official parser.

### How upstream handles the same incomplete expression

For the earlier `x + }` example, the upstream code path consumes `+` in
[`ParseBinopChain`][upstream-binop-chain], recursively requests the right
operand, and reaches [`ParseTermLhs`][upstream-term-lhs], which sees `}` where it
expects the start of an expression and returns a `ParseError` at that token.
Status propagation ends `ParseModule`, so the API supplies no partial module
containing `intact`.

As the recovery tree shows, Tree-sitter instead chooses a zero-width missing
right operand, uses `}` to close the block, and recognizes `intact` as the next
`function_definition`. This does not mean Tree-sitter reports a better
diagnostic—the recovery node has no tailored message. Its result is optimized
for a different need: retaining structure throughout an edit.

The missing-parametric-delimiter example follows the same contrast. Upstream's
[`ParseParametricBindings`][upstream-parametric-bindings] uses the common
comma-sequence parser, which ultimately requires `>` and returns the
expected-token status when it encounters `(`. Tree-sitter can insert
`(MISSING ">")` and keep parsing the parameter list and following declaration.

### Where the language boundary differs

The official parser performs more than context-free syntax recognition. Direct
examples in the pinned implementation include:

- resolving an identifier through `Bindings` in
  [`ParseParametricArg`][upstream-parametric-argument] to decide whether a
  parametric argument is a type or a value;
- rejecting duplicate top-level names, function parameters in
  [`ParseParamsInternal`][upstream-parameters], and parametric bindings during
  parsing;
- enforcing feature gates for traits, `use`, generic types, and channel
  attributes in parser productions; and
- validating the position and argument policy of special macros and attributes
  in parser handlers.

`tree-sitter-dslx` intentionally represents those inputs structurally when their
token and delimiter syntax is valid. Otherwise an editor tree would report
syntactic damage for code whose actual problem is an unresolved name, duplicate
binding, disabled feature, or macro policy violation.

This is visible in the official differential suite:

- all 607 files classified as syntax-valid parse in Tree-sitter with no
  `ERROR` or `MISSING` nodes;
- pinned `dslx_fmt --mode=parse` accepts 586 of them;
- the remaining 21 are individually classified as binding, contextual,
  macro-policy, or internal-stub exclusions rather than called grammar errors;
- six separate syntax-negative fixtures must still produce Tree-sitter recovery
  nodes; and
- all 568 outputs produced by the pinned formatter parse cleanly in Tree-sitter.

The differential test therefore uses intentionally one-way expectations:

1. If the pinned official frontend accepts a standalone module, Tree-sitter
   should parse it without recovery nodes.
2. If the official frontend rejects a file, the reason must be classified before
   deciding whether Tree-sitter should also report syntax recovery.
3. For malformed syntax, the comparable outcome is “upstream returns a parse
   status and Tree-sitter marks recovery,” not equality between their result
   objects or diagnostics.

The classifications are reviewable in
[`test/upstream/official-exclusions.tsv`](../test/upstream/official-exclusions.tsv)
and [`test/upstream/exclusions.tsv`](../test/upstream/exclusions.tsv). The
differential driver is
[`scripts/test-official-frontend.mjs`](../scripts/test-official-frontend.mjs).

## Error tolerance is also a consumer property

A parser that returns a partial tree is only useful if downstream operations can
handle it. The highlight query therefore matches recognized DSLX nodes rather
than requiring a completely error-free root. It can still capture the intact
function, builtin type, and integer following the broken expression in the
first example.

Recommended consumer behavior is:

1. Parse every edit and keep the previous tree for incremental reuse.
2. Check `hasError` when an operation requires a complete syntactic region.
3. Traverse `ERROR` and `MISSING` nodes when displaying recovery state, but do
   not expose their exact shape as a stable API.
4. Continue using intact siblings for highlighting and other local structural
   features.
5. Use `dslx_ls` or another official XLS frontend for authoritative diagnostics,
   name resolution, and types.

Features can therefore degrade independently. Highlighting can remain active
across intact portions of the file, while a refactoring that touches a damaged
subtree can wait for that subtree to become valid.

## Validation evidence

Error tolerance is tested as a product behavior rather than inferred from the
fact that the grammar was generated successfully.

- **Focused recovery and highlighting.**
  [`test/corpus/recovery.txt`](../test/corpus/recovery.txt) pins exact trees for
  three damaged constructs and requires later structure to survive.
  [`test/highlight/recovery.x`](../test/highlight/recovery.x) and four playground
  mutations check that recovery nodes stay on the edited line, highlights remain
  available, and representative edits can be repaired.

- **Incremental parsing and repair.** Fifteen curated edits require each
  incremental tree to equal a fresh parse. Another 1,821 insertion, replacement,
  and deletion edits across 607 valid files require the original source and
  clean tree to be restored.

- **Robustness and fuzzing.** Wasm, ASan, and UBSan exercise malformed input and
  incremental reuse. Deterministic and native fuzzing check bounded mutations,
  query safety, and repair. A recorded four-worker campaign completed
  263,953,696 edits and 8.3325 aggregate CPU-hours without a worker failure.

- **Pinned upstream compatibility.** All 607 files classified as syntax-valid
  parse without `ERROR` or `MISSING`; all six syntax-negative exclusions must
  contain recovery nodes.

The exact commands and evidence are recorded in
[`docs/validation-report.md`](validation-report.md).

## Limits and tradeoffs

Recovery is heuristic. A few consequences are important:

- A severely malformed region may be larger than the edit. Local recovery is a
  design goal and a tested behavior for representative cases, not a universal
  bound for every token sequence.
- Tree-sitter does not guarantee one canonical `ERROR` tree for arbitrary bad
  input. Incremental reuse and a fresh parse can choose different, equally valid
  recovery paths. Exact equality is required for the curated edit cases and for
  error-free fuzz intermediates, but not for every malformed fuzz mutant.
- Required string and character delimiters are part of atomic lexical tokens.
  An unterminated literal may therefore recover differently from a missing
  grammar-level delimiter such as `)` or `>`.
- A clean Tree-sitter parse only means the input matches the syntax grammar.
  Duplicate or unresolved names, type errors, feature gates, macro policy, and
  many contextual restrictions remain `dslx_ls` concerns.
- Compatibility and recovery claims are bounded to the pinned XLS and
  Tree-sitter revisions in the validation report.

For those reasons, consumers should depend on stable node types and fields for
valid constructs, not on the exact S-expression produced inside an arbitrary
malformed region.

## Maintaining the property

When adding or changing syntax, a good recovery review asks:

1. Does the valid form have explicit delimiters, separators, precedence, and a
   clear containing rule?
2. If one token is deleted, is the damaged construct localized and is its next
   sibling still recognizable?
3. Does completing the token restore the intended exact tree?
4. Can the highlight query run on both the damaged and repaired trees?
5. Does valid upstream source still parse without recovery nodes?
6. Does the change require a new conflict, and if so, can that conflict be made
   narrower?
7. Do incremental, fuzz, generated-artifact, and performance checks still pass?

The most valuable recovery fixture is usually a realistic intermediate editing
state with meaningful code after it. Such a test catches cascading damage that
a simple “the root has an error” assertion would miss.

[xls-revision]: https://github.com/google/xls/tree/69f84975c32f3471c113a2115f8d0e344ca4d73b
[upstream-scanner]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/scanner.h#L85-L130
[upstream-parser-header]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/parser.h#L113-L174
[upstream-token-parser]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/token_parser.cc#L65-L95
[upstream-parse-module]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/parser.cc#L449-L690
[upstream-parse-and-typecheck]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/parse_and_typecheck.cc#L48-L86
[upstream-lsp-update]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/lsp/language_server_adapter.cc#L169-L242
[upstream-lsp-header]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/lsp/language_server_adapter.h#L57-L79
[upstream-lsp-features]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/lsp/language_server_adapter.cc#L69-L508
[upstream-parser-transaction]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/parser.h#L187-L237
[upstream-binop-chain]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/parser.cc#L2092-L2119
[upstream-term-lhs]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/parser.cc#L2612-L2785
[upstream-parametric-bindings]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/parser.cc#L4759-L4815
[upstream-parametric-argument]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/parser.cc#L4818-L4905
[upstream-parameters]: https://github.com/google/xls/blob/69f84975c32f3471c113a2115f8d0e344ca4d73b/xls/dslx/frontend/parser.cc#L4426-L4458
[tree-sitter-recovery]: https://github.com/tree-sitter/tree-sitter/blob/v0.26.11/lib/src/parser.c#L1256-L1390
