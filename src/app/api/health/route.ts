import { NextResponse } from "next/server";

/**
 * Deployment diagnostics.
 *
 * A misconfigured environment otherwise surfaces as an opaque 500, which tells
 * you nothing and costs a deploy cycle per guess. This reports which settings
 * are present and whether the database and storage actually answer.
 *
 * It deliberately reports presence, never values, so it is safe to leave
 * reachable — and it must never throw, or it defeats its own purpose.
 */
export const dynamic = "force-dynamic";

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const env = {
    DATABASE_URL: present("DATABASE_URL"),
    SESSION_SECRET: present("SESSION_SECRET"),
    MEDIA_DRIVER: process.env.MEDIA_DRIVER ?? "(unset — defaults to local)",
    S3_BUCKET: present("S3_BUCKET"),
    S3_ENDPOINT: present("S3_ENDPOINT"),
    S3_ACCESS_KEY_ID: present("S3_ACCESS_KEY_ID"),
    S3_SECRET_ACCESS_KEY: present("S3_SECRET_ACCESS_KEY"),
  };

  const problems: string[] = [];
  if (!env.DATABASE_URL) problems.push("DATABASE_URL is not set");
  if (!env.SESSION_SECRET) problems.push("SESSION_SECRET is not set");
  else if ((process.env.SESSION_SECRET ?? "").length < 32) {
    problems.push("SESSION_SECRET is shorter than 32 characters");
  }
  if (env.MEDIA_DRIVER === "s3" && !(env.S3_BUCKET && env.S3_ACCESS_KEY_ID)) {
    problems.push("MEDIA_DRIVER is s3 but the S3 settings are incomplete");
  }
  if (env.MEDIA_DRIVER !== "s3" && process.env.VERCEL) {
    problems.push(
      "MEDIA_DRIVER must be s3 on a serverless host — there is no persistent disk",
    );
  }

  let database = "not attempted";
  if (env.DATABASE_URL) {
    try {
      const { db } = await import("@/lib/db");
      const rows = await db.$queryRaw<{ n: number }[]>`SELECT 1 AS n`;
      const stones = await db.stone.count();
      database = rows[0]?.n === 1 ? `connected — ${stones} stones` : "unexpected reply";
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
      database = `failed — ${msg}`;
      problems.push("database unreachable");
    }
  }

  return NextResponse.json(
    {
      ok: problems.length === 0,
      app: "Ruwanpura Gems ERP demo",
      runtime: process.version,
      region: process.env.VERCEL_REGION ?? "local",
      env,
      database,
      problems,
    },
    { status: problems.length === 0 ? 200 : 503 },
  );
}
