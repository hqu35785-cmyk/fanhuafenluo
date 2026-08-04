import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredCleanRounds = 2;
const browserScript = path.join(root, "scripts", "cross_browser_verify.mjs");

for (let round = 1; round <= requiredCleanRounds; round += 1) {
  console.log(`\n=== Full verification round ${round}/${requiredCleanRounds} ===`);

  const result = spawnSync(process.execPath, [browserScript], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(`Round ${round} could not start:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      `Round ${round} failed. Fix the problem, then restart verification from round 1.`,
    );
    process.exit(result.status ?? 1);
  }

  console.log(`Round ${round}/${requiredCleanRounds} passed.`);
}

console.log("\nTwo consecutive complete verification rounds passed with zero failures.");
