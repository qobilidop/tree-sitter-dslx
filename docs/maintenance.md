# Maintenance notes

This project follows an exact XLS revision because DSLX remains experimental.
Compatibility updates should be deliberate, reviewable events.

## Updating DSLX compatibility

1. Choose an XLS commit that is expected to remain available permanently.
2. Update `test/upstream/XLS_REVISION` and the SHA-256 of that commit's GitHub
   source archive in `test/upstream/XLS_ARCHIVE_SHA256`.
3. Run `./dev.sh npm run test:upstream`. Inspect every added, removed, and newly
   failing candidate. Keep `exclusions.tsv` path-specific and reject stale rows.
4. Review the corresponding language reference, frontend grammar, parser tests,
   and changelog. Update `docs/syntax-coverage.md` and focused tree tests before
   changing broad grammar rules.
5. Run `./dev.sh npm run test:official`. The ordinary official parser performs
   some binding and macro checks, and the formatter has its own failure modes;
   classify only demonstrated cases in `official-exclusions.tsv`.
6. Run `test:incremental:full`, `test:sanitizers`, `benchmark`, and a recorded
   fuzz campaign. Update `docs/validation-report.md` with the new evidence.
7. Regenerate `src/` with the locked Tree-sitter CLI and review public node and
   field changes as an integration concern, not generated noise.

Do not test an unpinned XLS `main` as the compatibility claim. A future canary
may use `main` only as non-blocking drift detection.

## Toolchain pins

The Ubuntu image digest, snapshot date, Node, Rust, Tree-sitter CLI, runtime,
Bazel, `web-tree-sitter`, and downloaded archives are exact. Update a pin in a
small change that records:

- Why the update is needed, including relevant security fixes.
- Checksums for every supported architecture.
- Regenerated artifact changes.
- Normal and extended validation results.

The everyday container should remain small enough for grammar work. Full XLS
builds belong to `build-dslx-frontend.sh` and extended CI, with their outputs in
the ignored `.cache` directory.

## Generated artifacts and releases

`src/parser.c`, `src/grammar.json`, and `src/node-types.json` are committed.
Normal CI regenerates them and requires a clean diff.

No registry package or release automation is part of the MVP. The only
publication workflow deploys the static playground to GitHub Pages. Package
names, compatibility guarantees, additional bindings, and release ownership
should be agreed with the upstream organization first.

## Triage priorities

Prioritize issues in this order:

1. Valid source at the pinned revision produces recovery nodes.
2. Crash, hang, sanitizer finding, or failure to restore an incremental tree.
3. Recovery consumes unrelated later declarations.
4. Public node/field regression or query breakage.
5. Performance regression on a pinned benchmark fixture.
6. Convenience integrations that have an identified consumer.

When an issue is caused by semantic validation rather than syntax, direct the
consumer to `dslx_ls` or the official XLS frontend and keep the boundary clear.
