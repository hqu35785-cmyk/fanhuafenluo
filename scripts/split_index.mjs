/**
 * Mechanically extract inline <style> and <script> from index.html into:
 *   src/styles/main.css
 *   src/app.js
 * Rewrite index.html to link them. Preserves cascade and script order.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "index.html");
const html = fs.readFileSync(indexPath, "utf8");

const styleOpen = html.indexOf("<style>");
const styleClose = html.indexOf("</style>");
if (styleOpen < 0 || styleClose < 0) {
  console.error("style block not found");
  process.exit(1);
}
const css = html.slice(styleOpen + "<style>".length, styleClose);
// drop leading newline if present for cleanliness but keep exact CSS body
const cssBody = css.replace(/^\r?\n/, "").replace(/\r?\n$/, "") + "\n";

const scriptOpen = html.lastIndexOf("<script>");
const scriptClose = html.lastIndexOf("</script>");
if (scriptOpen < 0 || scriptClose < 0 || scriptOpen < styleClose) {
  console.error("script block not found");
  process.exit(1);
}
const js = html.slice(scriptOpen + "<script>".length, scriptClose);
const jsBody = js.replace(/^\r?\n/, "").replace(/\r?\n$/, "") + "\n";

const stylesDir = path.join(root, "src", "styles");
const appDir = path.join(root, "src");
fs.mkdirSync(stylesDir, { recursive: true });
fs.mkdirSync(appDir, { recursive: true });

const cssPath = path.join(stylesDir, "main.css");
const jsPath = path.join(appDir, "app.js");
fs.writeFileSync(cssPath, cssBody);
fs.writeFileSync(jsPath, jsBody);

const before = html.slice(0, styleOpen);
const middle = html.slice(styleClose + "</style>".length, scriptOpen);
const after = html.slice(scriptClose + "</script>".length);

const next =
  before +
  '<link rel="stylesheet" href="src/styles/main.css">' +
  middle +
  '<script src="src/app.js"></script>' +
  after;

fs.writeFileSync(indexPath, next);

console.log(
  JSON.stringify(
    {
      cssBytes: Buffer.byteLength(cssBody),
      jsBytes: Buffer.byteLength(jsBody),
      indexBytes: Buffer.byteLength(next),
      cssPath: "src/styles/main.css",
      jsPath: "src/app.js",
    },
    null,
    2
  )
);
