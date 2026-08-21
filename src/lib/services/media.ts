import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { deleteObject, putObject } from "@/lib/storage";
import type { SessionUser } from "@/lib/session";

/**
 * Stone photography.
 *
 * Phones produce 8–12 MB originals. Storing those as-is would put roughly a
 * gigabyte per thousand stones into backups for no benefit — nobody views a
 * gem at 4000 px in a stock list. Every upload is therefore resized to a
 * sensible working size plus a thumbnail, and EXIF is stripped (it carries GPS
 * coordinates, which on a gem business's photographs is a genuine security
 * problem).
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const FULL_MAX_PX = 1600;
const THUMB_MAX_PX = 320;

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function isAcceptedImage(type: string): boolean {
  return ACCEPTED.has(type.toLowerCase());
}

export async function addStoneMedia(
  stoneId: string,
  file: File,
  user: SessionUser,
) {
  if (!isAcceptedImage(file.type)) {
    throw new Error("Only JPEG, PNG, WebP or HEIC images can be uploaded.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That image is larger than 15 MB.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  let full: Buffer;
  let thumb: Buffer;
  try {
    // rotate() applies the EXIF orientation and then the metadata is dropped,
    // so a photo taken sideways still appears upright.
    const base = sharp(input).rotate();
    full = await base
      .clone()
      .resize({ width: FULL_MAX_PX, height: FULL_MAX_PX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    thumb = await base
      .clone()
      .resize({ width: THUMB_MAX_PX, height: THUMB_MAX_PX, fit: "cover", position: "centre" })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error("That file could not be read as an image.");
  }

  const id = randomUUID();
  const dir = `stones/${stoneId}`;
  const fullKey = `${dir}/${id}.jpg`;
  const thumbKey = `${dir}/${id}-thumb.jpg`;

  await putObject(fullKey, full);
  await putObject(thumbKey, thumb);

  const existing = await db.media.count({ where: { stoneId } });

  const media = await db.media.create({
    data: {
      stoneId,
      url: fullKey,
      thumbUrl: thumbKey,
      isMain: existing === 0, // the first photo becomes the main one
    },
  });

  await db.auditLog.create({
    data: {
      tableName: "media",
      rowId: media.id,
      action: "create",
      actorId: user.id,
      changes: { stoneId, bytes: full.length },
    },
  });

  return media;
}

export async function setMainMedia(mediaId: string, user: SessionUser) {
  const media = await db.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error("That photo no longer exists.");

  await db.$transaction([
    db.media.updateMany({
      where: { stoneId: media.stoneId },
      data: { isMain: false },
    }),
    db.media.update({ where: { id: mediaId }, data: { isMain: true } }),
    db.auditLog.create({
      data: {
        tableName: "media",
        rowId: mediaId,
        action: "update",
        actorId: user.id,
        changes: { isMain: true },
      },
    }),
  ]);
}

export async function deleteStoneMedia(mediaId: string, user: SessionUser) {
  const media = await db.media.findUnique({ where: { id: mediaId } });
  if (!media) return;

  await deleteObject(media.url);
  if (media.thumbUrl) await deleteObject(media.thumbUrl);
  await db.media.delete({ where: { id: mediaId } });

  // If the main photo was removed, promote whatever is left so the list view
  // does not silently fall back to a blank swatch.
  if (media.isMain) {
    const next = await db.media.findFirst({
      where: { stoneId: media.stoneId },
      orderBy: { createdAt: "asc" },
    });
    if (next) await db.media.update({ where: { id: next.id }, data: { isMain: true } });
  }

  await db.auditLog.create({
    data: {
      tableName: "media",
      rowId: mediaId,
      action: "delete",
      actorId: user.id,
      changes: { stoneId: media.stoneId },
    },
  });
}
