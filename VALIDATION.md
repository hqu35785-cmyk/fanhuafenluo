# V2 validation report

## Why V2 was necessary

The first package was not fully compatible with the committed Phase 1 baseline
`0aa90216d9279a3bd755fcdd01b1528212118272`.

V2 corrects these concrete issues:

1. The invariant script now reads the catalog prefix from `src/app.js` before
   `src/data/works.js` exists.
2. Invariant and static verification now preserve every author section instead
   of assuming one `works` array.
3. Phase A now inserts `src/data/works.js` before the existing `src/app.js`
   script tag. It no longer expects the data tag to pre-exist.
4. Regression tests no longer hard-code 14 cards.
5. CI accepts a verified Phase A-only fallback if Phase B is unsafe.
6. The test runner owns and closes its localhost server.

## Static checks

Every `.mjs` file passed `node --check`.

## Phase 1-shaped fixture

A synthetic repository was built with:

- external `src/styles/main.css`;
- external `src/app.js`;
- multiple author sections in the app data prefix;
- `document.getElementById("authorAvatar")` in that prefix;
- an inline Base64 author avatar in `index.html`;
- the three incorrect `sensitiveSetting` decisions;
- `DISPLAY_SLOTS`, placeholders and gallery-fit runtime;
- gallery-fit and placeholder CSS.

Results:

- pre-change invariants recorded two authors and three works;
- Phase A completed;
- Phase A static verification passed;
- all catalog invariants passed;
- a second Phase A run produced identical hashes;
- Phase B completed;
- Phase B static verification passed;
- all catalog invariants passed;
- a second Phase B run produced identical hashes.

## Server lifecycle

The complete matrix runner was executed with stub test commands:

- Round 1 refactor suite passed;
- Round 1 legacy suite passed;
- Round 2 refactor suite passed;
- Round 2 legacy suite passed;
- the runner confirmed `127.0.0.1:4173` closed;
- a separate HTTP probe confirmed the port was closed.

Actual Chromium, Firefox and WebKit tests still must run inside the real repository
after dependencies and browsers are installed.
