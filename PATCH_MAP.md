# Exact modification map for baseline 0aa9021

## `src/app.js` → `src/data/works.js` + smaller `src/app.js`

Split at the exact marker:

```js
const gallery=document.getElementById("gallery");
```

Everything before the marker becomes `src/data/works.js`. The marker and everything after it remain in `src/app.js`.

The scripts are classic deferred scripts, loaded in this order:

```html
<script src="src/data/works.js?v=HASH" defer></script>
<script src="src/app.js?v=HASH" defer></script>
```

## Correct three setting-privacy decisions

Replace:

```js
const settingSensitive=Boolean(work.sensitive);
```

with:

```js
const settingSensitive=Boolean(work.sensitiveSetting);
```

Replace:

```js
function isSettingLocked(index){
  return isWorkLocked(index);
}
```

with:

```js
function isSettingLocked(index){
  return Boolean(works[index]?.sensitiveSetting) && !unlockedWorks.has(index);
}
```

Replace:

```js
card.classList.toggle("is-setting-unlocked",Boolean(work.sensitive) && !locked);
```

with:

```js
card.classList.toggle("is-setting-unlocked",Boolean(work.sensitiveSetting) && !locked);
```

## `index.html`

Replace the existing single app script tag with the ordered data and app script tags above.

Decode only the data URL inside:

```html
<img id="authorAvatar" ...>
```

Write its original bytes to:

```text
assets/authors/fanhuafenluo-avatar.<original extension>
```

Do not recompress it.

## Test process

Do not manually leave `node scripts/static_server.mjs` running. Use:

```powershell
npm run test:matrix:twice
```

The V2 runner starts and closes its own server and resets naturally to Round 1 whenever the command is rerun after a failure.
