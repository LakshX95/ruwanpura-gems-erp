import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env automatically, and it moved the connection URL
// out of schema.prisma into this file. Node 22's built-in loader avoids adding
// a dotenv dependency just for the CLI.
try {
  loadEnvFile(".env");
} catch {
  // .env is absent in CI and in production, where real env vars are set.
}

// Read through process.env rather than Prisma's env() helper, which throws on a
// missing variable. `prisma generate` needs no database at all, and it runs in
// postinstall — so on a host that installs before environment variables are
// configured, env() would fail the build with an error about the wrong thing.
// Commands that genuinely need a connection still fail, with a clearer message.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(url ? { datasource: { url } } : {}),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
