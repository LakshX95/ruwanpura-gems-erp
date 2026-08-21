import { loadEnvFile } from "node:process";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer reads .env automatically, and it moved the connection URL
// out of schema.prisma into this file. Node 22's built-in loader avoids adding
// a dotenv dependency just for the CLI.
try {
  loadEnvFile(".env");
} catch {
  // .env is absent in CI and in production, where real env vars are set.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
