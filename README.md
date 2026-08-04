# fanhuafenluo

Static GitHub Pages character-card gallery.

## Local verification

Requirements: Node.js 22 or newer and Python 3.

```bash
npm install
npx playwright install chromium firefox webkit
python3 -m http.server 4173
```

In another terminal:

```bash
TEST_URL=http://127.0.0.1:4173/index.html npm run test:twice
```

`test:twice` runs the complete Chromium, Firefox, and WebKit verification twice in sequence. Any failed round exits immediately. After making a fix, restart from round 1; completion requires two consecutive clean rounds.

Commit the generated `package-lock.json` so CI can use `npm ci` reproducibly.
