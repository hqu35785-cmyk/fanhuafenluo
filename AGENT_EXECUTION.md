# Agent execution — current Phase 1 baseline

Target repository: `hqu35785-cmyk/fanhuafenluo`

Required baseline:

```text
0aa90216d9279a3bd755fcdd01b1528212118272
```

This package is specifically corrected for the existing Phase 1 layout:

```text
index.html
src/app.js
src/styles/main.css
package.json
package-lock.json
```

Do not use the older `fanhuafenluo-current-audit.zip`. Use this V2 package only.

## 1. Create a branch and copy the package

```powershell
git switch -c refactor/performance-cleanup-v2
```

Copy the *contents* of this package into the repository root. Merge directories; do not delete existing scripts or assets.

Then confirm:

```powershell
git status --short
node --check scripts/snapshot_invariants.mjs
node --check scripts/apply_phase_a.mjs
node --check scripts/apply_phase_b.mjs
node --check scripts/verify_refactor.mjs
node --check scripts/test_server.mjs
node --check scripts/run_test_matrix_twice.mjs
```

## 2. Record the real pre-change catalog

```powershell
node scripts/snapshot_invariants.mjs record
node scripts/snapshot_invariants.mjs print
```

The V2 snapshot script reads the current catalog directly from the data prefix inside `src/app.js`. It records every author section and every work; do not accept a result that records only one guessed count.

## 3. Phase A

```powershell
node scripts/apply_phase_a.mjs
node scripts/verify_refactor.mjs
node scripts/snapshot_invariants.mjs check
node --check src/data/works.js
node --check src/app.js
npm install
```

Inspect:

```powershell
git diff --stat
git diff -- index.html src/app.js src/data/works.js src/styles/main.css package.json .gitignore
```

Expected:

- Existing CSS extraction is retained.
- Data prefix is moved from `src/app.js` to `src/data/works.js`.
- `index.html` receives the data script immediately before app.js.
- Base64 `authorAvatar` is extracted without recompression.
- `sensitiveSetting` uses its own field in all three runtime decisions.
- The pointer-follow glow is disabled on touch/coarse-pointer/reduced-motion environments.
- Character content, order, paths and sensitivity fields are unchanged.

Run the complete matrix:

```powershell
npx playwright install
npm run test:matrix:twice
```

`run_test_matrix_twice.mjs` owns its own local server, listens only on `127.0.0.1:4173`, performs two complete rounds, kills the server in `finally`, and confirms the port is closed.

Only after both rounds pass:

```powershell
git add .
git commit -m "Separate catalog data and fix independent setting privacy"
```

## 4. Phase B

```powershell
node scripts/apply_phase_b.mjs
node scripts/verify_refactor.mjs --phase-b
node scripts/snapshot_invariants.mjs check
node --check src/app.js
npm run test:matrix:twice
```

Review desktop and mobile screenshots. If both complete rounds pass:

```powershell
git add .
git commit -m "Remove JS gallery fitting and dead placeholders"
```

If Phase B causes a layout regression that cannot be fixed safely, restore only the Phase B working changes while keeping the Phase A commit. Do not reset or discard Phase A.

## 5. Final report

Report:

- Phase A and Phase B commit SHAs;
- before/after byte sizes;
- number of author sections and works preserved by the invariant snapshot;
- the three `sensitiveSetting` fixes;
- each browser result for both clean rounds;
- whether Phase B was retained;
- confirmation that `127.0.0.1:4173` is closed;
- final `git status --short`.
