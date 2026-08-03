# tree-sitter-dslx

An incremental, error-tolerant [Tree-sitter] grammar for [XLS DSLX]. It
produces concrete syntax trees and syntax highlighting quickly enough for every
keystroke, including while a file is incomplete.

**[Open the live DSLX syntax playground][playground]** to edit representative
functions, types, arrays, and procs in a browser. The static demo runs the same
checked grammar Wasm and `highlights.scm` used by the test suite; it has no
server component.

This repository currently targets XLS commit
[`69f84975c32f3471c113a2115f8d0e344ca4d73b`][xls-baseline]. DSLX is
experimental, so the exact revision is part of every compatibility claim.

## Where it fits

This project is a syntax-layer component, not another DSLX compiler frontend.

| Project            | Responsibility                                                                                                | Relationship                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `tree-sitter-dslx` | Incremental concrete syntax trees, recovery, structural tooling, and highlighting                             | Useful during every edit, even for malformed input                                     |
| [`dslx_ls`]        | Official parsing and type checking, diagnostics, navigation, rename, inlay hints, and other semantic features | Complementary; a clean Tree-sitter parse does not imply that code type-checks          |
| [`dslx-vscode`]    | VS Code integration for `dslx_ls`, language configuration, and TextMate highlighting                          | Complementary; this grammar is editor-independent and is not required by the extension |

The playground intentionally does not invoke `dslx_ls`. Consumers that need
symbol resolution, types, evaluation, simulation, or code generation should
use the official XLS tools.

## Confidence at the pinned baseline

The current evidence supports this bounded claim:

> All 607 classified syntax-valid DSLX files in the pinned XLS corpus, totaling
> 3,224,789 bytes, parse without `ERROR` or `MISSING` nodes. The exact-tree,
> recovery, highlight, incremental, official-frontend, C, Wasm, sanitizer, and
> metamorphic suites pass. A recorded mutation campaign completed 8.3325
> aggregate CPU-hours without a worker failure. Narrow oracle exclusions and
> known limitations are recorded rather than hidden.

The [validation report](docs/validation-report.md) gives the commands, counts,
performance measurements, fuzz evidence, and interpretation of the 21
official-parser and 18 formatter-specific exclusions. The
[syntax coverage ledger](docs/syntax-coverage.md) maps DSLX language families
to grammar rules and focused tests.

## Quick start

Docker is the only host prerequisite for the canonical environment.

```sh
./dev.sh npm ci
./dev.sh npm run verify
```

`dev.sh` is deliberately a transparent container boundary:

```text
./dev.sh <script-or-command> [args...]
```

For example, `./dev.sh bash` opens a shell and
`./dev.sh npm run test:upstream` runs the pinned XLS corpus check. The image is
built from the checked-in Ubuntu 22.04 definition and all downloaded tools are
versioned and checksummed.

To run the playground locally:

```sh
./dev.sh npm run test:playground
python3 -m http.server 8000 --directory dist
```

Then open <http://localhost:8000>. The second command can be replaced by any
host-side static file server.

## Development checks

```sh
./dev.sh npm test                       # exact trees, recovery, highlights
./dev.sh npm run test:upstream          # all classified XLS source files
./dev.sh npm run test:incremental       # curated realistic edit traces
./dev.sh npm run test:incremental:full  # three edits across all 607 files
./dev.sh npm run fuzz                   # deterministic Wasm mutation smoke
./dev.sh npm run test:sanitizers        # native ASan and UBSan corpus pass
./dev.sh npm run test:official          # heavy pinned dslx_fmt differential
./dev.sh npm run benchmark              # small, medium, and large fixtures
```

The official-frontend command performs a one-time, cached build of the smallest
needed XLS target. It is intentionally an extended check rather than part of
the interactive development image.

When changing the grammar, update the small exact-tree corpus test first,
regenerate `src/`, and update the coverage ledger if the language surface or a
tree-shape decision changed. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full
workflow.

## Integration outputs

The MVP intentionally supports only the portable foundations:

- **C:** generated parser sources, `tree_sitter_dslx()`, a public header,
  CMake installation, and pkg-config metadata. `npm run test:c-consumer`
  installs the grammar and Tree-sitter runtime into isolated prefixes, then
  builds standalone shared- and static-link consumers.
- **WebAssembly:** a reproducible ABI 15 grammar module tested with
  `web-tree-sitter` and copied into the static playground.

Node.js is a pinned development tool; this repository does not expose a native
Node binding. Rust, Python, Go, Swift, Bazel/C++, and package-registry releases
are deferred until upstream ownership and consumer needs are clear.

## Repository guide

- `grammar.js` defines the DSLX-native grammar and its documented conflicts.
- `src/` contains generated, reviewable C parser artifacts.
- `queries/highlights.scm` is the sole required MVP query; there is no
  `tags.scm` yet.
- `test/corpus/` holds focused exact-tree and recovery tests.
- `test/upstream/` pins and classifies XLS and official-oracle inputs.
- `scripts/` contains reproducible validation and build entry points.
- `playground/` is framework-free static source; `dist/` is generated.
- `.github/workflows/pages.yml` builds and deploys only the playground.

The project does not publish packages and does not attempt GitHub language or
code-navigation onboarding in this phase.

## Upstreaming status

The MVP is ready for an ownership discussion with either the XLS or XLSynth
GitHub organization. The [upstreaming packet](docs/upstreaming.md) summarizes
the proposal without assuming which organization should own it.
[Maintenance notes](docs/maintenance.md) describe how the pinned DSLX baseline
and generated artifacts should evolve.

## License

Apache-2.0. See [LICENSE](LICENSE).

[Tree-sitter]: https://tree-sitter.github.io/tree-sitter/
[XLS DSLX]: https://google.github.io/xls/dslx_reference/
[playground]: https://qobilidop.github.io/tree-sitter-dslx/
[xls-baseline]: https://github.com/google/xls/commit/69f84975c32f3471c113a2115f8d0e344ca4d73b
[`dslx_ls`]: https://google.github.io/xls/dslx_language_server/
[`dslx-vscode`]: https://github.com/xlsynth/dslx-vscode
