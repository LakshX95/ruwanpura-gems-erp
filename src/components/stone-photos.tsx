"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Star, Trash2, Upload, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { GemSwatch } from "@/components/gem";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/cn";
import { downscaleImage } from "@/lib/downscale";

export type Photo = {
  id: string;
  url: string;
  thumbUrl: string | null;
  isMain: boolean;
};

const src = (key: string) => `/api/media/file/${key}`;

/**
 * Photographs are how the trade actually identifies a stone — the number is
 * for the system, the picture is for the person. Capture is a phone camera
 * button first and a file picker second, because that is the real workflow
 * standing at the sorting table.
 */
export function StonePhotos({
  stoneId,
  photos: initial,
  colour,
  variety,
  canEdit,
}: {
  stoneId: string;
  photos: Photo[];
  colour: string | null;
  variety: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const main = photos.find((p) => p.isMain) ?? photos[0];

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const body = new FormData();
    // Shrink first: phone originals exceed the request-body limit on every
    // serverless host, and the server resizes them anyway.
    for (const f of Array.from(files)) {
      body.append("files", await downscaleImage(f));
    }
    try {
      const r = await fetch(`/api/stones/${stoneId}/media`, { method: "POST", body });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Upload failed");
      toast(
        `${data.added.length} photo${data.added.length === 1 ? "" : "s"} added`,
      );
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function act(id: string, method: "PATCH" | "DELETE") {
    setBusy(true);
    try {
      const r = await fetch(`/api/media/${id}`, { method });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
      if (method === "DELETE") {
        setPhotos((p) => p.filter((x) => x.id !== id));
        setLightbox(null);
        toast("Photo removed");
      } else {
        setPhotos((p) => p.map((x) => ({ ...x, isMain: x.id === id })));
        toast("Main photo updated");
      }
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Photographs"
        action={
          canEdit ? (
            <div className="flex items-center gap-1 print:hidden">
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                hidden
                onChange={(e) => upload(e.target.files)}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => upload(e.target.files)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-medium text-fg-2 hover:border-fg-5 disabled:opacity-50 sm:hidden"
              >
                <Camera size={13} /> Camera
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-medium text-fg-2 hover:border-fg-5 disabled:opacity-50"
              >
                <Upload size={13} />
                {busy ? "Uploading…" : "Add photos"}
              </button>
            </div>
          ) : null
        }
      />

      <div className="p-3">
        {photos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <GemSwatch colour={colour} variety={variety} size={72} />
            <p className="text-center text-xs text-fg-4">
              No photographs yet.
              {canEdit && " The colour swatch stands in until one is added."}
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setLightbox(main)}
              className="block w-full overflow-hidden rounded-md border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src(main.url)}
                alt="Stone photograph"
                className="aspect-square w-full bg-surface-2 object-cover"
              />
            </button>

            {photos.length > 1 && (
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightbox(p)}
                    className={cn(
                      "overflow-hidden rounded border",
                      p.isMain ? "border-accent ring-1 ring-accent" : "border-line",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src(p.thumbUrl ?? p.url)}
                      alt=""
                      className="aspect-square w-full bg-surface-2 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 print:hidden"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="anim-pop max-h-full max-w-3xl overflow-hidden rounded-lg bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src(lightbox.url)}
              alt="Stone photograph"
              className="max-h-[75vh] w-auto object-contain"
            />
            <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
              <span className="text-xs text-fg-4">
                {lightbox.isMain ? "Main photograph" : "Photograph"}
              </span>
              <div className="flex items-center gap-1">
                {canEdit && !lightbox.isMain && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(lightbox.id, "PATCH")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-medium text-fg-2 hover:border-fg-5 disabled:opacity-50"
                  >
                    <Star size={13} /> Make main
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(lightbox.id, "DELETE")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="rounded-md p-1.5 text-fg-4 hover:bg-surface-3"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
