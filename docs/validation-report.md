# Validation report

Report status: local MVP evidence complete except for the fuzz campaign entry
marked **running** below. GitHub Pages deployment requires repository settings
and is tracked separately from parser correctness.

## Compatibility baseline

| Input                               | Pin                                                                |
| ----------------------------------- | ------------------------------------------------------------------ |
| XLS                                 | `69f84975c32f3471c113a2115f8d0e344ca4d73b`                         |
| XLS source archive SHA-256          | `47e34bf48540271f04d02d9f5533d91314e5f70ac99e5205bd47f2fb35a8466c` |
| Tree-sitter CLI/runtime             | `0.26.11`                                                          |
| Tree-sitter runtime archive SHA-256 | `1bab01ed21464f3272665b9c60e39ee79f68da1333e80b23f2c9356569d06971` |
| Web Tree-sitter                     | `0.26.11` from `package-lock.json`                                 |
| Generated parser ABI                | 15                                                                 |

The canonical environment is the digest-pinned Ubuntu 22.04 development image.
The measurements below were taken in its native arm64 container on an Apple M3
Max host with 16 CPU cores and 64 GB of memory.

## Results

| Gate                                    | Result                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Exact-tree corpus                       | 26/26 cases pass across 10 language-family files                                                                                    |
| Highlight query                         | 36/36 assertions pass, including four assertions after errors                                                                       |
| Public node schema                      | 95 named node types among 164 entries in `src/node-types.json`                                                                      |
| Pinned XLS discovery                    | 613 candidates; 607 syntax-valid; 6 syntax-negative exclusions                                                                      |
| Pinned XLS syntax-valid corpus          | 3,224,789 bytes; every file has zero `ERROR` or `MISSING` nodes                                                                     |
| Whitespace/comment metamorphic variants | 1,821/1,821 pass across all 607 files                                                                                               |
| Curated incremental equivalence         | 15 edits across small, medium, and large sources; incremental trees equal fresh trees                                               |
| Full-corpus incremental equivalence     | 1,821 edits across 607 files; each three-edit trace restores the exact source and tree                                              |
| Official parser positive differential   | 586 accepted files; 21 narrowly classified contextual/semantic/internal exclusions                                                  |
| Official formatter metamorphic pass     | 568 formatted outputs and 2,493,972 formatted bytes parse cleanly; 18 pinned formatter comment-preservation refusals                |
| Wasm runtime                            | ABI 15 loads; 34 highlight captures; malformed-source query smoke passes                                                            |
| Native runtime                          | All 607 files and a prepend/edit fresh-tree comparison pass under ASan and UBSan                                                    |
| External C consumer                     | Installed runtime and grammar are discovered by pkg-config, linked by an isolated CMake project, and parse a module                 |
| Playground                              | 10 production assets and four examples pass; a local Chrome headless load reaches `Ready`, highlights source, and renders tree rows |
| Recorded fuzz campaign                  | **Running:** eight workers × 3,900 seconds; final evidence will replace this row                                                    |

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

- Every arbitrary mutant parses and its highlight query executes without a
  crash or hang.
- Every error-free intermediate mutant equals a fresh parse exactly.
- Undoing each bounded mutation trace restores the valid source and its exact
  original tree.
- Tree-sitter's native corpus fuzzer independently checks sizes, changed ranges,
  undo behavior, and the expected corpus tree.

This distinction prevents a false correctness claim while retaining exact
equivalence where the tree is a stable consumer interface.

## Performance

Seven iterations were measured through the production Wasm runtime; values are
medians. Guards are intentionally generous (1,000 ms initial and 250 ms
incremental) and exist to catch pathological ambiguity, not advertise a
cross-machine ranking.

| Fixture                       |   Bytes | Initial parse | One-character incremental parse |
| ----------------------------- | ------: | ------------: | ------------------------------: |
| `xls/dslx/tests/lambda.x`     |   1,309 |      0.257 ms |                        0.041 ms |
| `xls/examples/bitonic_sort.x` |  13,171 |      2.832 ms |                        1.586 ms |
| `xls/dslx/stdlib/apfloat.x`   | 217,999 |     28.666 ms |                        0.211 ms |

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
./dev.sh npm run fuzz:campaign
```

`npm run verify` regenerates `src/` and requires no diff, then runs exact-tree,
recovery, highlight, native C, Wasm, upstream corpus, metamorphic, curated
incremental, deterministic fuzz, external-consumer, and playground checks.

The campaign command defaults to eight 3,900-second workers and requires at
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
- No package is published, and `tags.scm` plus GitHub language onboarding are
  intentionally deferred.
- The Pages workflow is locally built and browser-tested, but the repository
  owner must enable GitHub Actions as the Pages source before the first live
  deployment if it is not already configured.
