import { execSync } from "child_process";
import fs from "fs";
import crypto from "crypto";

let html = execSync("git show HEAD:index.html", { encoding: "buffer" }).toString("utf8");
if (html.charCodeAt(0) === 0xfeff) html = html.slice(1);

function normalizeHashInput(content) {
  return String(content).replace(/\r\n?/g, "\n").trim();
}
function hash12(file) {
  return crypto
    .createHash("sha256")
    .update(normalizeHashInput(fs.readFileSync(file, "utf8")), "utf8")
    .digest("hex")
    .slice(0, 12);
}
const appHash = hash12("src/app.js");
const cssHash = hash12("src/styles/main.css");
const worksHash = hash12("src/data/works.js");

html = html
  .replace(/src\/styles\/main\.css\?v=[a-f0-9]+/g, `src/styles/main.css?v=${cssHash}`)
  .replace(/src\/data\/works\.js\?v=[a-f0-9]+/g, `src/data/works.js?v=${worksHash}`)
  .replace(/src\/app\.js\?v=[a-f0-9]+/g, `src/app.js?v=${appHash}`)
  .replace(/assets\/authors\/fanhuafenluo-avatar\.jpg/g, "assets/authors/fanhuafenluo-avatar.webp")
  .replace(/type="image\/jpeg"/g, 'type="image/webp"');

fs.writeFileSync("index.html", html, "utf8");
console.log({ appHash, cssHash, worksHash, len: html.length });
console.log("ok archive", html.includes("作品档案"));
console.log("ok avatar", html.includes("fanhuafenluo-avatar.webp"));
console.log("ok unlock", html.includes("一键解锁"));
