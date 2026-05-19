// Wipe the dev SQLite DB, re-apply migrations, and reseed via the webhook
// handlers.
//
// Requires the Next.js dev server to be running (npm run dev) so the seed step
// can POST to /api/webhooks/*. BASE_URL env var overrides the default
// http://localhost:3000.
//
//   npm run db:reset

import { unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = resolve(ROOT, "prisma", "dev.db");
const JOURNAL_PATH = resolve(ROOT, "prisma", "dev.db-journal");

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: ROOT });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
    child.on("error", rejectPromise);
  });
}

async function tryUnlink(path: string) {
  try {
    await unlink(path);
    console.log(`  removed ${path}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

async function main() {
  console.log("1/3 Wiping dev.db");
  await tryUnlink(DB_PATH);
  await tryUnlink(JOURNAL_PATH);

  console.log("\n2/3 Applying migrations");
  await run("npx", ["prisma", "migrate", "deploy"]);

  console.log("\n3/3 Reseeding via webhook handlers");
  await run("npx", ["tsx", "scripts/seed.ts"]);

  console.log("\nReset complete.");
}

main().catch((err) => {
  console.error("reset-db.ts failed:", err);
  process.exit(1);
});
