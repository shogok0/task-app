import { ensureSqliteSchema } from "../src/lib/sqlite-init";

ensureSqliteSchema();
console.log("SQLite schema initialized.");
