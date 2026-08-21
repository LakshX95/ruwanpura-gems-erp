import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";

/**
 * Object storage behind a three-method interface, with two drivers.
 *
 * `local` writes to a mounted volume — the right answer for the single-VPS
 * deployment in the plan, and what runs in development.
 *
 * `s3` targets any S3-compatible bucket, which in practice means Cloudflare R2
 * (zero egress fees, and stone photography is served on every list view).
 * Serverless hosts have no persistent filesystem, so this driver is required
 * on Vercel, Netlify and similar.
 *
 * Nothing above this file knows which one is in use.
 */

const DRIVER = (process.env.MEDIA_DRIVER ?? "local").toLowerCase();
const ROOT = path.resolve(process.env.MEDIA_DIR ?? ".data/media");

function localPath(key: string): string {
  const full = path.resolve(ROOT, key);
  // Refuse anything that escapes the media root — a crafted key must never be
  // able to read or overwrite files elsewhere on the box.
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

function assertSafeKey(key: string): string {
  if (key.includes("..") || key.startsWith("/")) {
    throw new Error("Invalid storage key");
  }
  return key;
}

let client: S3Client | null = null;
function s3(): { client: S3Client; bucket: string } {
  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "MEDIA_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
    );
  }
  client ??= new S3Client({
    // R2 ignores the region but the SDK insists on one.
    region: process.env.S3_REGION ?? "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return { client, bucket };
}

export async function putObject(key: string, data: Buffer): Promise<string> {
  assertSafeKey(key);
  if (DRIVER === "s3") {
    const { client, bucket } = s3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: "image/jpeg",
        CacheControl: "private, max-age=31536000, immutable",
      }),
    );
    return key;
  }
  const full = localPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return key;
}

export async function getObject(key: string): Promise<Buffer> {
  assertSafeKey(key);
  if (DRIVER === "s3") {
    const { client, bucket } = s3();
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!res.Body) throw new Error("Empty object");
    return Buffer.from(await res.Body.transformToByteArray());
  }
  return readFile(localPath(key));
}

export async function deleteObject(key: string): Promise<void> {
  try {
    assertSafeKey(key);
    if (DRIVER === "s3") {
      const { client, bucket } = s3();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return;
    }
    await unlink(localPath(key));
  } catch {
    // Already gone, or an unusable key. Deleting media stays idempotent.
  }
}

export const storageDriver = DRIVER;
