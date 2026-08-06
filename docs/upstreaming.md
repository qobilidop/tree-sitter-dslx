# Upstreaming discussion packet

## Proposal

Adopt `tree-sitter-dslx` under either the XLS or XLSynth GitHub organization as
the maintained, editor-independent syntax layer for DSLX. Decide ownership
before publishing registry packages or promising a long-term compatibility
policy.

The project is deliberately useful without being coupled to an editor or
compiler process:

- Incremental, error-tolerant concrete syntax trees on every edit.
- C and WebAssembly integration foundations.
- Query-tested DSLX highlighting, code-navigation tags, and local-variable
  tracking.
- A static browser demonstration with no `dslx_ls` service cost.
- A reproducible compatibility claim tied to one XLS revision.

## Complementarity

The grammar does not replace the official frontend. `dslx_ls` remains
authoritative for types, diagnostics, navigation, rename, and other semantic
features. `dslx-vscode` remains the VS Code product and can continue using its
existing language configuration and TextMate highlighting. Tree-sitter adds a
portable structural layer that can serve editors, code browsers, refactoring
experiments, documentation tools, and future integrations.

## Evidence to review

- The [live playground](https://qobilidop.github.io/tree-sitter-dslx/), including
  one-click error recovery and source/tree selection synchronization.
- `docs/validation-report.md`, with pinned corpus, official frontend,
  sanitizer, incremental, fuzz, Wasm, C-consumer, and performance results.
- `docs/syntax-coverage.md`, mapping language constructs to rules and tests.
- The small exact-tree corpus and the explicit public fields in
  `src/node-types.json`.
- The one-command canonical environment: `./dev.sh npm run verify`.

## Suggested demo flow

1. Open the parametric example and select nodes in the tree.
2. Make a token-boundary edit and show the changed-range and parse-time metrics.
3. Use an example-specific **Break…** action and show localized recovery plus
   continuing highlighting, then repair the same construct.
4. Switch to the proc/channel example to demonstrate DSLX-specific coverage.
5. Open the validation report and reproduce one normal check through `dev.sh`.

## Integration choices after adoption

If XLS owns the repository, a Bazel/C++ integration may be the first additional
binding. If XLSynth owns it, a Rust binding may be the first consumer-facing
addition. Neither is required to assess the grammar, and both should reuse the
same generated C parser rather than create a second implementation.

## Decisions requested

- Which organization is the best long-term home?
- Who reviews DSLX baseline updates and public tree-shape changes?
- Should support track selected XLS releases, periodic commits, or another
  compatibility cadence?
- Which first downstream consumer justifies the next binding or specialized
  query?
- At what point should packages be published, and under whose release process?

The proposal does not assume acceptance or ask for GitHub/Linguist onboarding,
package publication, or changes to `dslx-vscode`. The standalone tag query does
not imply that onboarding has occurred.
