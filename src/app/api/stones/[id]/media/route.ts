import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { addStoneMedia } from "@/lib/services/media";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(user, "stone:create")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const { id } = await params;
  const stone = await db.stone.findUnique({ where: { id }, select: { id: true } });
  if (!stone) return NextResponse.json({ error: "Stone not found" }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files received" }, { status: 400 });
  }

  const added = [];
  for (const file of files) {
    try {
      const media = await addStoneMedia(id, file, user);
      added.push({ id: media.id, thumbUrl: media.thumbUrl, isMain: media.isMain });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Upload failed", added },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ added });
}
