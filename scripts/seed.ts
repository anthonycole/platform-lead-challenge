// Seed the dev database by POSTing fixture payloads to the webhook handlers.
//
// Run against a fresh database for the cleanest demo:
//   rm prisma/dev.db && npm run db:migrate
//   npm run dev            # in another terminal
//   npm run db:seed
//
// Re-running without clearing will hit dedupe on every event — itself a valid
// demo of idempotency.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { manifest } from "./fixtures/manifest";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const FIXTURES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

async function main() {
  console.log(`Seeding ${manifest.length} events to ${BASE_URL}\n`);

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    const label = `[${i + 1}/${manifest.length}] ${entry.source} ${entry.file}`;
    console.log(label);
    console.log(`  → ${entry.note}`);

    const payload = JSON.parse(
      await readFile(resolve(FIXTURES_DIR, entry.file), "utf8"),
    );

    const res = await fetch(`${BASE_URL}/api/webhooks/${entry.source}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const bodyText = await res.text();
    console.log(`  ← ${res.status} ${bodyText}\n`);

    if (!res.ok) {
      console.error(`Aborting: ${label} failed with status ${res.status}`);
      process.exit(1);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("seed.ts failed:", err);
  process.exit(1);
});
