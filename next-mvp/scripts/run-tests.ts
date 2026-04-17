import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "file:./test.db",
};

const initDb = spawnSync("pnpm", ["tsx", "scripts/init-db.ts"], {
  stdio: "inherit",
  shell: true,
  env,
});

if (initDb.status !== 0) {
  process.exit(initDb.status ?? 1);
}

const vitest = spawnSync("pnpm", ["vitest", "run"], {
  stdio: "inherit",
  shell: true,
  env,
});

process.exit(vitest.status ?? 1);
