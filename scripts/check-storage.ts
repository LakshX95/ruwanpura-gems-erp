/**
 * Verifies photo storage is actually wired up, before deploying.
 *
 *   npx tsx scripts/check-storage.ts
 *
 * Does a real put / get / delete round trip against whichever driver the
 * environment selects, so a wrong endpoint or a mistyped key fails here rather
 * than the first time somebody photographs a stone.
 */
import { loadEnvFile } from "node:process";

// Env must be loaded before the storage module reads it at import time.
try {
  loadEnvFile(".env");
} catch {
  // Fine — real environment variables are already set.
}

import {
  deleteObject, getObject, putObject, storageDriver,
} from "../src/lib/storage";

const RESET = "\x1b[0m";
const ok = (m: string) => console.log(`\x1b[32m  ✓\x1b[0m ${m}`);
const bad = (m: string) => console.log(`\x1b[31m  ✗\x1b[0m ${m}`);
const info = (m: string) => console.log(`\x1b[2m  ·${RESET} ${m}`);

function checkConfig(): boolean {
  console.log(`\nDriver: \x1b[1m${storageDriver}\x1b[0m`);

  if (storageDriver !== "s3") {
    info(`MEDIA_DIR = ${process.env.MEDIA_DIR ?? ".data/media"}`);
    info("Serverless hosts have no persistent disk — set MEDIA_DRIVER=s3 there.");
    return true;
  }

  let good = true;
  for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT"]) {
    if (process.env[key]) ok(`${key} is set`);
    else {
      bad(`${key} is missing`);
      good = false;
    }
  }

  const endpoint = process.env.S3_ENDPOINT ?? "";
  const bucket = process.env.S3_BUCKET ?? "";

  // The bucket page shows "<account>.r2.cloudflarestorage.com/<bucket>", and
  // pasting the whole string is the single most common mistake here.
  if (bucket && endpoint.includes(`/${bucket}`)) {
    bad(`S3_ENDPOINT must not include the bucket name — remove "/${bucket}"`);
    good = false;
  }
  if (endpoint && !/^https?:\/\//.test(endpoint)) {
    bad("S3_ENDPOINT must start with https://");
    good = false;
  }

  const account = endpoint.match(/https:\/\/([0-9a-f]+)\.r2\.cloudflarestorage\.com/i)?.[1];
  if (account && account.length !== 32) {
    bad(
      `Account ID in S3_ENDPOINT is ${account.length} characters; Cloudflare's are 32. ` +
        (account.length < 32
          ? `It is ${32 - account.length} character(s) short. The full ID is in your ` +
            "Cloudflare dashboard URL — dash.cloudflare.com/<account-id>/r2/... — " +
            "or behind the copy button on the bucket's S3 API field."
          : "There is something extra in it — check for a stray character."),
    );
    good = false;
  } else if (account) {
    ok("Endpoint account ID looks well formed");
  }

  return good;
}

async function roundTrip() {
  const key = `_healthcheck/${Date.now()}.jpg`;
  const payload = Buffer.from("ruwanpura-storage-check");

  await putObject(key, payload);
  ok("upload succeeded");

  const back = await getObject(key);
  if (!back.equals(payload)) throw new Error("downloaded bytes did not match");
  ok("download succeeded and matched");

  await deleteObject(key);
  ok("delete succeeded");
}

async function main() {
  if (!checkConfig()) {
    console.log("\n\x1b[31mConfiguration is incomplete — fix the above first.\x1b[0m\n");
    process.exit(1);
  }
  console.log("\nRound trip:");
  try {
    await roundTrip();
    console.log("\n\x1b[32mStorage is working.\x1b[0m\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    bad(msg);
    if (/no such host|ENOTFOUND|getaddrinfo/i.test(msg)) {
      info("DNS failed — check the account ID in S3_ENDPOINT.");
    } else if (/SignatureDoesNotMatch|InvalidAccessKeyId|401|403/i.test(msg)) {
      info("Rejected — check the access key, secret, and that the token covers this bucket.");
    } else if (/NoSuchBucket|404/i.test(msg)) {
      info("Bucket not found — check S3_BUCKET matches the name in Cloudflare.");
    } else if (/EPROTO|handshake|ECONNREFUSED|ETIMEDOUT|certificate/i.test(msg)) {
      info(
        "Could not establish a connection — the account ID in S3_ENDPOINT is " +
          "probably wrong, so you are reaching a host that is not your bucket.",
      );
    }
    console.log();
    process.exit(1);
  }
}

main();
