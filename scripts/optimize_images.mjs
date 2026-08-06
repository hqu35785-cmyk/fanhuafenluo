import sharp from "sharp";
import fs from "fs";
import path from "path";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(webp|jpe?g|png)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const previews = walk("assets/previews");
console.log("found", previews.length);
let before = 0;
let after = 0;
let ok = 0;
let skipped = 0;
const errors = [];

for (const p of previews) {
  try {
    const input = fs.readFileSync(p);
    const s0 = input.length;
    before += s0;
    const meta = await sharp(input).metadata();
    if ((meta.width || 9999) <= 640 && s0 < 45000) {
      after += s0;
      skipped++;
      continue;
    }
    const buf = await sharp(input)
      .rotate()
      .resize({ width: 640, height: 960, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 74, effort: 4, smartSubsample: true })
      .toBuffer();
    const tmp = `${p}.tmp.webp`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, p);
    after += buf.length;
    ok++;
  } catch (e) {
    errors.push(`${path.basename(p)}: ${e.message}`);
    try {
      after += fs.statSync(p).size;
    } catch {
      /* ignore */
    }
  }
}

const avIn = "assets/authors/fanhuafenluo-avatar.jpg";
const avOut = "assets/authors/fanhuafenluo-avatar.webp";
let avInfo = {};
if (fs.existsSync(avIn)) {
  const avInput = fs.readFileSync(avIn);
  const avBuf = await sharp(avInput)
    .rotate()
    .resize({ width: 128, height: 128, fit: "cover" })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
  fs.writeFileSync(avOut, avBuf);
  avInfo = {
    beforeKB: +(avInput.length / 1024).toFixed(1),
    afterKB: +(avBuf.length / 1024).toFixed(1),
  };
}

console.log(
  JSON.stringify(
    {
      found: previews.length,
      ok,
      skipped,
      beforeMB: +(before / 1e6).toFixed(2),
      afterMB: +(after / 1e6).toFixed(2),
      ratio: before ? +(after / before).toFixed(3) : null,
      avInfo,
      errorCount: errors.length,
      errors: errors.slice(0, 8),
    },
    null,
    2
  )
);

for (const p of previews.slice(0, 5)) {
  try {
    const m = await sharp(fs.readFileSync(p)).metadata();
    console.log(path.basename(p), `${m.width}x${m.height}`, `${(fs.statSync(p).size / 1024).toFixed(1)}KB`);
  } catch (e) {
    console.log("sample fail", path.basename(p), e.message);
  }
}
