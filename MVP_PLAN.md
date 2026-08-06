# tree-sitter-dslx MVP development plan

Status: complete at XLS revision `69f84975c32f3471c113a2115f8d0e344ca4d73b`

This records the original MVP scope. The repository has since added substantive
tag/local queries, an XLS `main` drift canary, performance budgets, and a
cross-platform CMake matrix without changing the pinned compatibility claim.

This document defines the minimum viable product for an upstream-ready
Tree-sitter grammar for XLS DSLX. It is a development plan, not a release or
package-publication plan.

## 1. Objective

Build a production-quality, incremental, error-tolerant DSLX parser that is
credible for upstreaming to either the XLS or XLSynth GitHub organization.

The target is near `tree-sitter-rust` maturity in the areas that matter to
DSLX users:

- Broad and explicit language coverage.
- A useful, stable concrete syntax tree.
- Strong corpus, recovery, incremental, query, and fuzz testing.
- Responsive parsing and highlighting.
- Reproducible development and CI.
- Clear documentation and a compelling live demonstration.

This does not mean copying `tree-sitter-rust`, matching its line count, or
shipping all of its language bindings. DSLX is Rust-like, but the DSLX
reference, parser, parser tests, and real programs are authoritative.

## 2. Product position

`tree-sitter-dslx` is a syntax-layer component. It should be useful on every
keystroke, including while a file is incomplete or malformed.

| Project            | Primary responsibility                                                                                                              | Relationship to this project                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tree-sitter-dslx` | Incremental concrete syntax trees, error recovery, structural tooling, and highlighting                                             | This project                                                                                |
| `dslx_ls`          | Parsing and type checking with the official XLS frontend, diagnostics, navigation, rename, inlay hints, and other semantic features | Complementary; not replaced or invoked by the playground                                    |
| `dslx-vscode`      | VS Code integration for `dslx_ls`, language configuration, and TextMate-based highlighting                                          | Complementary; this grammar is editor-independent and could become an optional future input |

The README must explain these boundaries prominently. In particular, a clean
Tree-sitter parse does not imply that a program type-checks, and Tree-sitter
is not an alternative DSLX compiler frontend.

## 3. MVP scope

### 3.1 Required deliverables

- A Tree-sitter grammar covering the DSLX syntax accepted at a pinned XLS
  revision.
- Stable named nodes and fields suitable for downstream structural tools.
- Generated C parser sources and a small public C header.
- A WebAssembly parser consumed by the playground.
- Syntax-highlighting queries and query tests.
- Exact-tree corpus tests for every syntax family.
- Recovery tests for incomplete and malformed programs.
- Validation against a pinned corpus of real XLS DSLX programs.
- Differential and metamorphic checks using the official DSLX frontend where
  those checks make a valid syntactic claim.
- Incremental-parse equivalence tests and parser fuzzing.
- A checked-in syntax coverage ledger and reproducible validation report.
- An Ubuntu-based Dev Container, a convenient root-level `dev.sh`, and CI
  using the same environment definition.
- A polished static Wasm playground published through GitHub Pages.
- Upstream-ready README, contribution guidance, license metadata, and
  maintenance notes.

### 3.2 Explicit non-goals

- Publishing packages to npm, crates.io, PyPI, or another registry.
- Go, Python, Rust, Swift, or native Node runtime bindings.
- `tags.scm` or GitHub/Linguist/code-navigation onboarding.
- Replacing, embedding, or reimplementing `dslx_ls`.
- Replacing `dslx-vscode` or making VS Code integration an MVP dependency.
- Formatting, type checking, evaluation, simulation, code generation, or
  other semantic DSLX services.
- Supporting historical DSLX syntax not accepted by the pinned official
  frontend.
- Guaranteeing acceptance by either upstream organization.

These items can be reconsidered after the ownership and upstreaming discussion.

## 4. Compatibility baseline and sources of truth

DSLX is experimental and evolves with XLS, so an unqualified claim to support
"DSLX" is not precise enough. The repository will record an exact XLS commit
as its compatibility baseline.

When sources disagree, use this order:

1. The parser and parser tests at the pinned XLS commit.
2. The DSLX language reference at the corresponding revision.
3. DSLX files known to be valid at that revision.
4. `tree-sitter-rust` and other grammars as implementation references only.

The planned `test/upstream/XLS_REVISION` file will contain the commit. An
acquisition script will download an archive for that exact revision, verify
its checksum, and extract the selected corpus into an ignored cache directory.
CI must never test an unpinned `main` branch as the conformance baseline.

Both `.x`, the conventional XLS extension, and `.dslx` will be declared as file
types. The grammar scope will be `source.dslx`.

## 5. Grammar design

### 5.1 Start from DSLX, not from a Rust fork

Study `tree-sitter-rust` for useful techniques such as precedence handling,
field naming, ambiguity resolution, test organization, and error recovery.
Define DSLX-native rules and node names from the DSLX syntax inventory rather
than deleting Rust rules from a copied grammar.

This should produce a smaller, more legible grammar and make deviations from
Rust intentional. Important DSLX-specific areas include arbitrary-width bit
types and typed literals, parametrics, arrays and bit slices, proc and channel
syntax, spawn expressions, DSLX attributes and built-ins, `for` and
`unroll_for!`, and tick identifiers.

### 5.2 Tree shape is part of the product

- Give semantically meaningful constructs named nodes.
- Use fields consistently for names, types, parameters, bodies, operands, and
  other stable roles.
- Hide punctuation-only and grammar-factoring rules where doing so improves
  the public tree.
- Prefer DSLX terminology over inherited Rust terminology.
- Add representative tree snapshots before downstream users depend on node
  names accidentally.
- Treat intentional node-schema changes as reviewable compatibility changes,
  even before package publication.

### 5.3 Ambiguity and external scanning

- Encode operator precedence and associativity explicitly and test every
  precedence boundary.
- Keep conflict declarations narrow, documented, and covered by tests.
- Begin without an external scanner.
- Add an external scanner only when a demonstrated lexical requirement cannot
  be represented reliably in the grammar. Every scanner state and edge case
  must then receive focused tests and fuzz coverage.
- Prefer localized `ERROR` and `MISSING` nodes over recovery that consumes the
  rest of a declaration or file.

### 5.4 Generated artifacts

Commit the conventional generated artifacts, including `src/parser.c`,
`src/grammar.json`, and `src/node-types.json`. CI will regenerate them and fail
on any diff, so reviewers can trust that generated files match `grammar.js`.

## 6. Integration outputs and bindings

Only two integration outputs are essential to the MVP:

1. **C:** the generated parser, public `tree_sitter_dslx()` declaration, and
   straightforward static/shared CMake integration. C is the portable base
   consumed by Tree-sitter hosts and is suitable for eventual XLS integration.
2. **WebAssembly:** a reproducibly built grammar Wasm module, tested with
   `web-tree-sitter` and used by the playground.

Node.js and npm will be pinned development tools for `grammar.js`, the
Tree-sitter CLI, tests, and the web build. That does not make a native Node
binding part of the supported MVP API.

Additional bindings should be chosen after upstream ownership is clearer. A
Rust binding would be the natural first candidate for an XLSynth-owned project;
Bazel/C++ integration would be a natural first candidate for integration into
the XLS monorepo. Neither choice is needed to prove the grammar.

## 7. Correctness and confidence strategy

The project should make a precise, reproducible confidence claim rather than
claiming that testing proves universal correctness.

### 7.1 Syntax coverage ledger

Create `docs/syntax-coverage.md` before declaring feature completeness. It will
map every relevant section and construct in the DSLX reference and official
parser tests to:

- The implementing grammar rule.
- One or more positive corpus tests.
- Relevant negative or recovery tests.
- Highlight tests when applicable.
- Any limitation or intentionally unsupported historical syntax.

No row may remain in an unexplained "unknown" state at MVP completion.

### 7.2 Exact-tree corpus tests

Organize `test/corpus` by language family, for example:

- Modules, imports, visibility, attributes, and constants.
- Functions, parameters, parametrics, and calls.
- Types, structs, enums, aliases, arrays, tuples, and channels.
- Literals, casts, unary operators, and binary operators.
- Blocks, `let`, `if`, `match`, `for`, and patterns.
- Indexing, bit slicing, width slicing, concatenation, and struct update.
- Procs, configuration, initialization, next state, spawn, send, and receive.
- Tests, quickchecks, macros, and built-ins with special syntax.
- Comments, whitespace, identifiers, and lexical boundary cases.
- Intentional errors and incomplete edits.

Tests should assert useful tree shape, not merely the absence of parser errors.
Small, isolated examples make failures easier to review than giant golden
trees.

### 7.3 Real-world XLS corpus

At the pinned revision, discover DSLX files from the official standard library,
examples, modules, tests, and other maintained source directories. Classify
each candidate as:

- Known valid and required to parse without `ERROR` or `MISSING` nodes.
- Intentionally invalid test data, with the reason recorded.
- A fragment or generated fixture that is not a standalone module, with the
  reason recorded.

Do not use broad, unexplained path exclusions. The validation report must state
the revision, selection rules, exclusions, file count, total bytes, and result.

### 7.4 Differential and metamorphic validation

Use the lightest practical official frontend at the pinned XLS revision,
preferably the syntax parser exercised through `dslx_fmt` or a small parser
driver. Keep this tooling out of the browser demo and out of the interactive
edit loop.

The comparison is deliberately asymmetric:

- Any complete source accepted by the official parser must parse without
  unexpected `ERROR` or `MISSING` nodes in Tree-sitter.
- Rejection by a tool that also type-checks is not evidence that Tree-sitter
  should reject the source.
- Tree-sitter may intentionally recover a useful tree from syntactically
  invalid input; exact rejection equivalence is not a goal.

Metamorphic checks should parse both the original and official-formatted form
of valid files, exercise harmless whitespace/comment transformations, and
verify that all variants remain error-free.

The official frontend and corpus revision must be pinned and checksummed. If a
suitable parser binary is not present in a release archive, the extended
validation job may build the smallest required XLS target in a separate cached
stage; it must not inflate the everyday interactive container.

### 7.5 Incremental parsing

For deterministic edit traces across representative corpus files:

1. Parse the original file.
2. Apply insertions, deletions, replacements, and token-boundary edits using
   Tree-sitter's edit API.
3. Incrementally reparse after each edit.
4. Parse the resulting text from scratch.
5. Require the incremental and fresh trees to be structurally identical.

Include incomplete delimiters, partial identifiers and literals, edits around
comments, precedence boundaries, parametrics, and proc syntax. Run a bounded
version on every pull request and the full pinned corpus in extended CI.

### 7.6 Error recovery

Curated recovery tests must model real editing states, not just arbitrary bad
files. They should verify that:

- Errors remain near the edit.
- Later declarations are still recognized.
- The parser makes progress and never hangs.
- Closing a delimiter or completing a token restores the intended tree.
- Highlight queries continue to execute on error-containing trees.

### 7.7 Fuzzing and sanitizers

- Run a short deterministic parser fuzz smoke test in normal CI.
- Run longer scheduled and manually triggered fuzz jobs with recorded seeds.
- Fuzz any external scanner more aggressively if one is introduced.
- Exercise the C build under AddressSanitizer and UndefinedBehaviorSanitizer in
  extended CI where the toolchain supports it.
- Before the upstreaming proposal, complete and record at least eight aggregate
  CPU-hours without a crash, hang, sanitizer finding, or incremental/fresh-tree
  divergence. Minimize and commit every discovered reproducer.

Time spent is supporting evidence, not a proof; corpus breadth and coverage
traceability remain more important.

### 7.8 Highlight tests

`queries/highlights.scm` is the only required MVP query file. Tests must cover
definitions and uses of functions, types, fields, parameters, constants,
built-ins, keywords, operators, attributes, comments, numbers, strings, and
DSLX-specific constructs. Query execution must also be tested on malformed
trees.

Do not add empty query files or `tags.scm` for the appearance of completeness.

### 7.9 Performance evidence

Record initial and incremental parse timings over small, median, and large
official files. Establish a checked-in baseline on the canonical CI runner and
add a generous regression guard after measurements are stable. The goal is to
catch pathological ambiguity or recovery, not to advertise fragile benchmark
rankings.

The playground must remain visibly responsive on all bundled examples and show
parse duration and error count so performance and recovery are easy to inspect.

### 7.10 Validation report

Generate or reproducibly update `docs/validation-report.md` before upstreaming.
It should permit a statement in this form:

> At XLS revision `<commit>`, all `<N>` classified valid DSLX files totaling
> `<bytes>` parse without unexpected error or missing nodes. Every syntax item
> in the coverage ledger has focused tree tests; highlight and incremental
> suites pass; and the recorded fuzz campaign completed `<duration>` with no
> outstanding failures. Known limitations are listed below.

The report must include the exact commands needed to reproduce every number.

## 8. Reproducible development environment

The canonical environment consists of:

- `.devcontainer/Dockerfile`, built from the official Ubuntu 22.04 image to
  align with the current XLS reference build environment.
- `.devcontainer/devcontainer.json`, pointing at that Dockerfile.
- `dev.sh` at the repository root for editor-independent use.

Reproducibility requirements:

- Pin the Ubuntu tag and multi-platform image digest.
- Pin the Ubuntu archive snapshot used for APT packages.
- Pin Node.js, the Tree-sitter CLI, Wasm tooling, and other downloaded tools by
  exact version and checksum.
- Commit dependency lockfiles and install from them without opportunistic
  upgrades.
- Support native `amd64` and `arm64`; use the host platform by default.
- Update pins deliberately in reviewable maintenance changes, including
  security updates.

The interactive image should contain grammar, C, Wasm, test, fuzz, and
playground build prerequisites. It should not build the complete XLS monorepo.
Heavy official-frontend validation belongs in a separate cached CI stage when
no suitable pinned binary is available.

### 8.1 `dev.sh` behavior

Design `dev.sh` as a transparent container boundary. Its entire user interface
is:

```text
./dev.sh <script-or-command> [args...]
```

For example, `./dev.sh bash` opens a shell, `./dev.sh npm test` runs the test
command, and `./dev.sh ./scripts/validate.sh` runs a repository script. With no
command, it prints the usage line and exits unsuccessfully.

The script performs only the container management required to execute that
command:

- Locate the repository correctly regardless of the caller's directory.
- Perform a cached local build so the environment cannot silently drift behind
  the checked-in Dockerfile.
- Avoid a dependency on a remotely published development image.
- Execute the supplied command directly, without an implicit shell, aliases,
  task dispatch, or special command flags.
- Preserve argument boundaries, signals, exit status, and interactive TTY
  behavior.
- Bind-mount the repository and arrange writable container-owned caches.
- Run with host-compatible file ownership without requiring generated files to
  be repaired with `sudo`.
- Select the native host platform.
- Fail clearly when Docker or another required host capability is unavailable.
- Work noninteractively in CI.

It is not a task runner or a second build system. Project tasks remain ordinary
pinned package scripts or checked-in repository scripts.

## 9. Continuous integration

All required checks must be runnable through the development image. CI is an
independent caller of the same Dockerfile, not a separately maintained toolchain.

### 9.1 Pull-request checks

- Build the development image from pinned inputs.
- Install locked project dependencies.
- Lint and format-check handwritten sources and scripts.
- Regenerate the parser and require a clean diff.
- Compile and smoke-test the C parser.
- Run all exact-tree and highlight tests.
- Run the bounded upstream-corpus validation.
- Run the bounded incremental-edit suite.
- Run deterministic fuzz smoke tests.
- Build the Wasm parser and instantiate it in a runtime smoke test.
- Build the production playground and retain it as a CI artifact.
- Check documentation links and the syntax coverage ledger.

### 9.2 Extended checks

Scheduled or manually triggered jobs will run the full corpus, longer edit
traces, sanitizers, performance measurements, and recorded fuzz campaigns.
Failures are actionable; the pinned compatibility baseline must not move
automatically.

A non-blocking scheduled canary tests the newest XLS `main` revision to detect
language drift early; its report never replaces the pinned compatibility gate.

### 9.3 Supply-chain and publication policy

- Pin third-party GitHub Actions by full commit SHA.
- Grant each workflow only the permissions it needs.
- Do not add package-release workflows during the MVP.
- Pages deployment is the sole publication workflow.

## 10. Wasm playground and GitHub Pages

The playground is the primary upstreaming demonstration. It must be a static
site with no server-side component and no `dslx_ls` dependency.

### 10.1 User experience

- Load a meaningful DSLX example immediately.
- Offer curated examples spanning functions and parametrics, types and pattern
  matching, arrays and slices, and proc/channel syntax.
- Parse on each edit and syntax-highlight using the repository's query.
- Show the concrete syntax tree alongside the source.
- Keep source selection and tree selection synchronized where practical.
- Make `ERROR` and `MISSING` nodes visually obvious.
- Show parse duration, changed-range information when available, and error
  count.
- Include a one-click way to introduce or repair a representative syntax error
  so recovery is easy to demonstrate.
- Explain that the demo parses syntax only and link to `dslx_ls` for semantic
  tooling.
- Avoid a large application framework unless it materially improves the demo.

### 10.2 Deployment

- Build the same static output locally and in CI.
- Handle the GitHub project Pages base path correctly.
- On pull requests, validate the build and retain a preview artifact without
  publishing it.
- After required checks pass on the default branch, upload the static artifact
  and deploy it with the official GitHub Pages Actions flow.
- Expose the deployed URL prominently in the README.

Publishing the playground does not establish a stable package API and does not
change the package-publication non-goal.

## 11. Planned repository shape

The exact layout may evolve, but the MVP is expected to contain:

```text
.devcontainer/
  Dockerfile
  devcontainer.json
.github/workflows/
  ci.yml
  extended.yml
  pages.yml
bindings/c/
docs/
  syntax-coverage.md
  validation-report.md
playground/
queries/
  highlights.scm
scripts/
src/                       Generated parser artifacts
test/
  corpus/
  highlight/
  recovery/
  upstream/
dev.sh
grammar.js
package-lock.json
package.json
tree-sitter.json
```

Prefer fewer well-named scripts and workflows over scaffolding copied from a
multi-binding grammar.

## 12. Milestones

Milestones are ordered by dependency, not by calendar date.

### M0: Reproducible foundation

- Add pinned development container, root `dev.sh`, locked Node/Tree-sitter
  tooling, and CI bootstrap.
- Generate and compile a minimal DSLX grammar in C and Wasm.
- Add metadata, formatting, linting, and generated-file drift checks.

Exit condition: a fresh clone can run the same smoke test locally and in CI
with one documented container command.

### M1: Syntax inventory and public tree design

- Pin the XLS baseline.
- Inventory the DSLX reference, parser tests, and representative real files.
- Create the syntax coverage ledger.
- Define naming, fields, expression precedence, patterns, types, and declaration
  tree shapes with representative corpus tests.
- Record intentional differences from `tree-sitter-rust`.

Exit condition: every known syntax family has a planned rule and test location,
and the core public node schema has been reviewed before broad implementation.

### M2: Complete grammar

- Implement lexical rules, types, expressions, statements, declarations,
  attributes, tests, macros, and proc/channel syntax.
- Expand exact-tree tests with each rule.
- Keep conflicts documented and error recovery bounded.
- Regenerate and review node types continuously.

Exit condition: every coverage-ledger feature has positive tree tests and the
classified valid pinned XLS corpus parses without unexpected errors.

### M3: Editor-quality parsing

- Implement and test `highlights.scm`.
- Add realistic incomplete-edit and malformed-source recovery tests.
- Add incremental/fresh-tree equivalence harnesses and edit suites.
- Establish initial and incremental performance baselines.

Exit condition: representative live edits remain responsive, localized, and
structurally consistent; all highlight categories are tested.

### M4: Confidence campaign

- Finalize corpus classification and differential/metamorphic validation.
- Run bounded checks on every change and extended fuzz/sanitizer campaigns.
- Minimize and commit regressions.
- Produce the reproducible validation report with known limitations.

Exit condition: all confidence gates in Section 13 pass and the report supports
the intended public correctness statement.

### M5: Demonstration and upstreaming readiness

- Build the polished Wasm playground and publish it to GitHub Pages.
- Complete README positioning, architecture, quick start, compatibility,
  contribution, and maintenance documentation.
- Prepare the upstreaming packet and decide whether XLS or XLSynth is the best
  initial home.

Exit condition: a reviewer can understand the project, reproduce its evidence,
and evaluate the live parser without installing XLS or `dslx_ls`.

## 13. MVP completion gates

The MVP is complete only when all of the following are true:

- [x] Every in-scope DSLX reference/parser-test feature is resolved in the
      syntax coverage ledger.
- [x] Generated parser artifacts reproduce exactly from locked inputs.
- [x] All exact-tree, recovery, highlight, C, and Wasm tests pass.
- [x] Every classified valid file at the pinned XLS revision parses without
      unexpected `ERROR` or `MISSING` nodes.
- [x] Every corpus exclusion is narrow and justified.
- [x] Official-parser positive differential and formatting metamorphic checks
      pass.
- [x] Incremental parse trees equal fresh parse trees for the required edit
      suites.
- [x] The pre-upstream fuzz campaign records at least eight aggregate CPU-hours
      with no unresolved crash, hang, sanitizer failure, or tree divergence.
- [x] Performance checks show no known pathological file or recovery case.
- [x] The C interface can be consumed by an external smoke-test project.
- [x] The production Wasm artifact is the one exercised by the playground.
- [x] A clean machine can build and run required checks through `dev.sh`.
- [x] CI uses the same pinned environment and has least-privilege permissions.
- [x] The playground is live on GitHub Pages and linked from the README.
- [x] The README clearly explains complementarity with `dslx_ls` and
      `dslx-vscode`.
- [x] The validation report states evidence, baseline, exclusions, and known
      limitations precisely.
- [x] No package has been published and no GitHub language-onboarding work has
      been mixed into the MVP.

## 14. Upstreaming packet

The initial upstreaming discussion should include:

- The concise project purpose and complementarity statement.
- The live GitHub Pages playground.
- The pinned compatibility and validation report.
- The syntax coverage ledger and test/fuzz methodology.
- Parser and incremental performance measurements.
- The reproducible `dev.sh` quick start.
- The small binding/integration strategy and deferred publication policy.
- Known limitations and a maintenance plan for tracking DSLX changes.
- A proposal for repository ownership without assuming the answer in advance.

Package names, registries, release automation, and additional bindings will be
discussed only after the preferred upstream organization and maintainers agree
on ownership and compatibility policy.

## 15. Risks and mitigations

| Risk                                           | Mitigation                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| DSLX changes during development                | Pin the baseline, update it deliberately, and optionally run a non-blocking latest-XLS canary later |
| Rust similarity encourages an inaccurate port  | Use a DSLX coverage ledger and DSLX-native tree schema; treat Rust only as prior art                |
| Official tools conflate syntax and semantics   | Use a parser-only oracle where practical and keep all other differential claims asymmetric          |
| Real corpus silently omits hard files          | Discover systematically, classify every exclusion, and report counts and paths                      |
| Grammar ambiguity harms speed or recovery      | Keep conflicts narrow, test precedence boundaries, and maintain performance/recovery cases          |
| External scanner increases native complexity   | Start without one and require evidence, focused tests, fuzzing, and sanitizers before adding one    |
| Reproducible pins become stale or vulnerable   | Use intentional dependency-update changes and record both reproducibility and security rationale    |
| Demo becomes a separate product                | Keep it static, small, and built directly from the tested Wasm grammar and highlight query          |
| Scope expands into editor or GitHub onboarding | Preserve the explicit non-goals until after the upstreaming decision                                |

## 16. Post-MVP possibilities

- Package publishing and release automation.
- Rust, Node, Python, Go, Swift, or upstream-specific Bazel bindings.
- GitHub/Linguist onboarding (the standalone `tags.scm` contract is complete).
- Optional Tree-sitter integration in `dslx-vscode` or other editors.
- Additional standardized or editor-specific queries when a consumer requires
  them.
- Multi-version DSLX support if real users need it (the latest-main canary is
  complete).

## 17. Reference projects and documentation

- [DSLX language reference](https://google.github.io/xls/dslx_reference/)
- [XLS source repository](https://github.com/google/xls)
- [DSLX language server](https://google.github.io/xls/dslx_language_server/)
- [`dslx-vscode`](https://github.com/xlsynth/dslx-vscode)
- [`tree-sitter-rust`](https://github.com/tree-sitter/tree-sitter-rust)
- [Tree-sitter documentation](https://tree-sitter.github.io/tree-sitter/)
- [Dev Container specification](https://containers.dev/)
- [Ubuntu archive snapshot service](https://ubuntu.com/server/docs/how-to/software/snapshot-service/)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
