# Validation report

Report status: all MVP evidence gates are complete. The tested playground is
live through GitHub Pages and is tracked separately from parser correctness.

## Compatibility baseline

| Input                               | Pin                                                                |
| ----------------------------------- | ------------------------------------------------------------------ |
| XLS                                 | `69f84975c32f3471c113a2115f8d0e344ca4d73b`                         |
| XLS source archive SHA-256          | `47e34bf0d39406cf699c9dbaa45c424b70ab5299d06b8004423177561c6a846c` |
| Tree-sitter CLI/runtime             | `0.26.11`                                                          |
| Tree-sitter runtime archive SHA-256 | `1bab01ed21464f3272665b9c60e39ee79f68da1333e80b23f2c9356569d06971` |
| Web Tree-sitter                     | `0.26.11` from `package-lock.json`                                 |
| Generated parser ABI                | 15                                                                 |

The canonical environment is the digest-pinned Ubuntu 22.04 development image.
Local extended evidence uses its native arm64 container on an Apple M3 Max host
with 16 CPU cores and 64 GB of memory. The same image also passes the extended
suite natively on a GitHub-hosted Ubuntu x64 runner.

## Results

| Gate                                    | Result                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Exact-tree corpus                       | 28/28 cases pass across 11 language-family files; expected trees include field names                                                  |
| Highlight query                         | 45/45 assertions pass, including DSLX proc/channel constructs and four assertions after errors                                        |
| Tag and local queries                   | 20 tag matches plus 40 scope/definition/reference captures pass executable contracts                                                  |
| Public node and field schema            | All 91 public named nodes, 45 named-target fields, and 84 required node/field pairs appear in exact CSTs                              |
| Pinned XLS discovery                    | 613 candidates; 607 syntax-valid; 6 syntax-negative exclusions                                                                        |
| Pinned XLS syntax-valid corpus          | 3,224,789 bytes; every file has zero `ERROR` or `MISSING` nodes                                                                       |
| XLS main canary smoke                   | Revision `0499182fd618cbf3fe714dc26c26346faaff0471`: 607 applicable files, zero new recovery failures                                 |
| Whitespace/comment metamorphic variants | 1,821/1,821 pass across all 607 files                                                                                                 |
| Curated incremental equivalence         | 15 edits across small, medium, and large sources; incremental trees equal fresh trees                                                 |
| Full-corpus incremental equivalence     | 1,821 edits across 607 files; each three-edit trace restores the exact source and tree                                                |
| Official parser positive differential   | 586 accepted files; 21 narrowly classified contextual/semantic/internal exclusions                                                    |
| Official formatter metamorphic pass     | 568 formatted outputs and 2,493,972 formatted bytes parse cleanly; 18 pinned formatter comment-preservation refusals                  |
| Wasm runtime                            | ABI 15 loads; 34 highlight captures; malformed-source query smoke passes                                                              |
| Native runtime                          | All 607 files and a prepend/edit fresh-tree comparison pass under ASan and UBSan                                                      |
| External C consumer                     | Isolated CMake consumers discover installed runtime and grammar through pkg-config, link shared and static builds, and parse a module |
| Portable CMake target                   | Shared and static library smoke targets build and pass locally; CI defines Linux, macOS, and Windows coverage                         |
| Playground                              | 10 assets, four examples, and four reversible line-local recovery actions pass; HTTPS Pages serves the tested Wasm and static assets  |
| Recorded fuzz campaign                  | 4/4 workers pass; 8.3325 CPU-hours, 263,953,696 edits, 32,994,212 traces, and 4,065,700 error-free fresh comparisons                  |

### Corpus classification

`scripts/validate-xls-corpus.sh` discovers every `.x` and `.dslx` file beneath
`xls/dslx`, `xls/examples`, and `xls/modules` in the verified source archive.
The six rows in `test/upstream/exclusions.tsv` are standalone syntax-negative
fixtures. Validation requires each excluded path to exist and still produce a
recovery node, so exclusions cannot silently become stale.

The 607-file syntax set intentionally includes semantic-negative fixtures whose
tokens and structure are valid. Tree-sitter should parse duplicate bindings,
unresolved names, and macro argument policy violations structurally; those are
not grammar errors.

### Official frontend interpretation

The pinned `dslx_fmt --mode=parse` target is the lightest practical official
oracle, but its `ParseModule` path also performs binding, contextual cast, and
macro-format validation. `test/upstream/official-exclusions.tsv` therefore
records 21 path-specific parse exclusions instead of treating official
rejection as evidence that Tree-sitter should emit an error.

For every other file, the official parser succeeds. The formatter then emits
568 transformed modules, all accepted by Tree-sitter. Eighteen files trigger
the pinned formatter's own explicit refusal to proceed when a comment might be
deleted; these are separately classified and still pass the official parse
phase. Both exclusion sets are checked for stale entries.

### Incremental and fuzz semantics

Curated edit suites require incremental and fresh S-expressions to be identical,
including incomplete delimiters and damaged tokens. The full corpus additionally
applies insertion, replacement, and deletion traces to every valid file.

Tree-sitter does not promise one canonical `ERROR` tree for every severely
malformed input: incremental reuse can choose an equally valid recovery path
that differs from a fresh recovery parse. Mutation fuzzing follows Tree-sitter's
own stronger useful invariant for that domain:

- Every arbitrary mutant parses without a crash or hang; highlight queries
  execute periodically across arbitrary mutants and on focused recovery trees.
- Every error-free intermediate mutant equals a fresh parse exactly.
- Undoing each bounded mutation trace restores the valid source and its exact
  original tree.
- Tree-sitter's native corpus fuzzer independently checks sizes, changed ranges,
  undo behavior, and the expected corpus tree.

This distinction prevents a false correctness claim while retaining exact
equivalence where the tree is a stable consumer interface.

The machine-readable [campaign evidence](fuzz-campaign.json) records the four
seeds, per-worker results, parser Wasm hash, pinned revisions, and aggregate
counts. Its 29,996.869 process CPU-seconds exceed the 28,800-second gate. The
same commit also passed an independent GitHub-hosted campaign with 10,354,576
edits and 0.9944 aggregate CPU-hours in the linked extended run.

The local wrapper source was edited while its Bash process waited for workers,
so that process reported a shell parse error after all workers passed and the
summary was already written. The finalized wrapper passes `bash -n` and
ShellCheck; the untouched worker logs and CPU gate were then independently
revalidated with the finalized summarizer. This orchestration error did not
affect the parser processes or their recorded results.

## Performance

Seven iterations were measured through the production Wasm runtime on the
GitHub-hosted Ubuntu x64 runner in [extended run 30797512914][extended-run];
values are medians. Checked-in fixture-specific budgets allow machine variance
while catching size-relative regressions; they are evidence gates, not a
cross-machine ranking.

| Fixture                       |   Bytes | Initial parse | Initial budget | Incremental parse | Incremental budget |
| ----------------------------- | ------: | ------------: | -------------: | ----------------: | -----------------: |
| `xls/dslx/tests/lambda.x`     |   1,309 |      0.738 ms |          10 ms |          0.105 ms |               5 ms |
| `xls/examples/bitonic_sort.x` |  13,171 |      5.558 ms |          40 ms |          3.097 ms |              15 ms |
| `xls/dslx/stdlib/apfloat.x`   | 217,999 |     36.104 ms |         200 ms |          0.288 ms |              20 ms |

The benchmark report also gates generated complexity: 2,022 parser states
(maximum 2,250), 114 large states (maximum 140), a 2,018,838-byte generated C
parser (maximum 2,250,000), and a 281,776-byte Wasm module (maximum 350,000).
Extended CI retains `build/benchmark.json` for review.

The one-time arm64 build of pinned `dslx_fmt` took 828 seconds and is cached
outside the interactive image. This cost is why official differential checking
belongs to the extended suite rather than the browser demo or normal edit loop.

## Reproduction

```sh
./dev.sh npm ci
./dev.sh npm run verify
./dev.sh npm run test:incremental:full
./dev.sh npm run test:official
./dev.sh npm run test:sanitizers
./dev.sh npm run benchmark
./dev.sh npm run canary:xls-main
./dev.sh npm run fuzz:campaign
```

`npm run verify` regenerates `src/` and requires no diff, then runs exact-tree,
schema, recovery, highlight, tag/local query, native C, Wasm, upstream corpus,
metamorphic, curated incremental, deterministic fuzz, external-consumer, and
playground checks. The latest-XLS canary is scheduled separately and never
changes the pinned compatibility claim.

The campaign command defaults to four 7,500-second workers and requires at
least 28,800 aggregate process CPU-seconds. Each worker records its seed,
iterations, changed ranges, highlighted mutants, error-free fresh comparisons,
wall duration, and process CPU duration.

## Known limitations

- Compatibility is claimed only for the pinned XLS revision, not historical or
  future DSLX syntax.
- Tree-sitter provides syntax and recovery, not name resolution, macro policy,
  typing, evaluation, simulation, or compilation.
- Exact malformed `ERROR` tree shape is not a stable cross-strategy interface;
  focused recovery behavior and restoration are tested instead.
- Only C and WebAssembly integration outputs are supported in the MVP.
- No package is published, and GitHub language onboarding is intentionally
  deferred.

[extended-run]: https://github.com/qobilidop/tree-sitter-dslx/actions/runs/30797512914
