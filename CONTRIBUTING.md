# Contributing to tree-sitter-dslx

Thank you for improving the DSLX syntax layer. Changes should preserve a useful
incremental tree as well as accepting complete programs.

## Canonical environment

Install Docker, then run all project commands through the root helper:

```sh
./dev.sh npm ci
./dev.sh npm run verify
```

The helper has no task aliases. `./dev.sh <command> [args...]` builds the pinned
development image when needed and executes the command directly inside it.

## Grammar changes

1. Add or update a focused test in `test/corpus/`. Assert the intended named
   nodes and fields, not only a successful parse.
2. Change `grammar.js`. Keep conflicts narrow and explain binding-dependent or
   otherwise non-obvious ambiguity next to the declaration.
3. Run `./dev.sh npm run generate` and review changes in `src/grammar.json`,
   `src/node-types.json`, and `src/parser.c`.
4. Update the affected files in `queries/` and their highlight, tag, or local
   query fixtures when a public node changes editor-facing behavior.
5. Run `./dev.sh npm run lint:schema`; every public named node and field with a
   named target must remain represented in exact corpus CSTs.
6. Update `docs/syntax-coverage.md` when support, test locations, or a known
   limitation changes.
7. Run `./dev.sh npm run verify` before proposing the change.

Treat named node types and fields as a public schema. A tree-shape change can be
correct, but it should be intentional, focused, and called out for downstream
consumers.

## Recovery and incremental behavior

Include editing states that a person can realistically create: partial tokens,
missing delimiters, damaged parametrics, unfinished proc members, and edits
around comments. Recovery should remain local enough that later declarations
are still recognizable.

For a discovered incremental regression, keep the smallest reproducible input
and deterministic edit trace. The required suites compare curated incremental
trees with fresh trees. Mutation fuzzing additionally restores each bounded
edit trace to its valid seed and requires the original tree exactly; error-free
intermediate mutants are compared with fresh parses.

## Updating the XLS baseline

Baseline updates are compatibility changes, not routine dependency bumps. Follow
the complete sequence in `docs/maintenance.md`: update the revision and archive
checksum together, classify every corpus change, run both normal and extended
validation, update the coverage ledger and report, and review generated tree
changes separately from source-language drift.

Never broaden an exclusion silently. Every excluded path needs a precise reason,
and validation rejects stale exclusions.

## Scope

Before the upstream ownership decision, avoid adding package publication,
additional language bindings, GitHub language onboarding, or editor integration
without an agreed consumer. Query improvements must include executable fixtures
and should not obscure grammar correctness or maintenance responsibility.

All contributions are licensed under Apache-2.0.
