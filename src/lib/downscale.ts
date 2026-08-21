/**
 * Shrink an image in the browser before uploading it.
 *
 * A phone camera produces 8–12 MB originals, and serverless hosts cap the
 * request body well below that (Vercel is 4.5 MB). Rather than fail on the
 * client's own photographs, the image is resized to a sensible working size
 * first. The server still resizes and strips EXIF — this only makes the upload
 * survivable, it does not replace the server-side pipeline.
 *
 * Anything that cannot be decoded is passed through untouched so the server
 * can produce the real error message.
 */
const MAX_EDGE = 2200;
const QUALITY = 0.9;
/** Below this, resizing costs more than it saves. */
const SKIP_UNDER_BYTES = 1_500_000;

export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < SKIP_UNDER_BYTES) return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    // imageOrientation honours EXIF rotation, so a sideways phone photo is
    // uploaded upright rather than being rotated after the metadata is gone.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
