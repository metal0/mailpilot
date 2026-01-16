/**
 * Playwright global setup - runs before all tests
 * Seeds the test database with fixture data
 */

import { execSync } from "child_process";
import { resolve } from "path";

async function globalSetup(): Promise<void> {
  const projectRoot = resolve(__dirname, "../..");

  console.log("\n[Global Setup] Seeding test database...");

  try {
    execSync("pnpm seed:test --db data/test-mailpilot.db", {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    });

    console.log("[Global Setup] Test data seeded successfully\n");
  } catch (error) {
    console.error("[Global Setup] Failed to seed test data:", error);
    throw error;
  }
}

export default globalSetup;
