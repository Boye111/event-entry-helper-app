import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  const ddl = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await sql.unsafe(ddl);
  console.log("Schema applied.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
