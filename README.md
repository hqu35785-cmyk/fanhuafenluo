# fanhuafenluo current audit V2

This package replaces the earlier audit package.

It is corrected for the actual committed Phase 1 baseline at:

```text
0aa90216d9279a3bd755fcdd01b1528212118272
```

Corrections from V1:

- invariant snapshot reads the current data prefix from `src/app.js`;
- snapshot and verifier support multiple author sections;
- Phase A inserts the missing `works.js` tag into the current externalized HTML;
- regression tests no longer hard-code 14 cards;
- CI allows a safe Phase A-only fallback;
- test matrix owns and closes its server, including Windows force-cleanup fallback;
- existing Playwright dependency versions are preserved when possible.

Start with `AGENT_EXECUTION.md`.
