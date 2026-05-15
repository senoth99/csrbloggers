/**
 * Auto-initializes local dev environment:
 * - Creates .env with defaults if missing or incomplete
 * - Runs `prisma db push` + seed if DB doesn't exist yet
 *
 * Runs automatically via `predev` before `npm run dev`.
 */

import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { randomBytes } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

// --- Ensure .env has DATABASE_URL and SESSION_SECRET ---

let envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

const missing = [];
if (!envContent.includes("DATABASE_URL=")) {
  missing.push(`DATABASE_URL="file:./panel.sqlite"`);
}
if (!envContent.includes("SESSION_SECRET=") || /SESSION_SECRET=[ \t]*(\r?\n|$)/.test(envContent)) {
  envContent = envContent.replace(/SESSION_SECRET=[ \t]*(\r?\n|$)/, "$1");
  missing.push(`SESSION_SECRET=${randomBytes(32).toString("hex")}`);
}
// Set a fixed dev password so the user always knows it
if (!envContent.includes("SEED_ADMIN_PASSWORD=")) {
  missing.push(`SEED_ADMIN_PASSWORD=admin`);
}

if (missing.length > 0) {
  appendFileSync(envPath, (envContent.endsWith("\n") || envContent === "" ? "" : "\n") + missing.join("\n") + "\n");
  console.log(`[dev-setup] Added to .env: ${missing.map((l) => l.split("=")[0]).join(", ")}`);
}

// --- Run prisma db push + seed if DB is missing ---

// Re-read to get DATABASE_URL value
const finalEnv = readFileSync(envPath, "utf8");
const dbUrlMatch = finalEnv.match(/DATABASE_URL="?([^"\n]+)"?/);
if (dbUrlMatch) {
  const dbUrl = dbUrlMatch[1];
  if (dbUrl.startsWith("file:")) {
    // Prisma resolves SQLite paths relative to schema dir (prisma/), not project root
    const relFile = dbUrl.replace("file:", "").replace(/^\.\//, "");
    const dbPath = join(root, "prisma", relFile);
    if (!existsSync(dbPath)) {
      console.log("[dev-setup] DB not found — running prisma db push...");
      execSync("npx prisma db push --skip-generate", { stdio: "inherit", cwd: root });
      console.log("[dev-setup] Seeding...");
      execSync("npm run db:seed", { stdio: "inherit", cwd: root });
      console.log("[dev-setup] Done. Login: senoth / admin\n");
    }
  }
}
