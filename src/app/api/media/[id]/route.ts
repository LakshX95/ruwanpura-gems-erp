import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { deleteStoneMedia, setMainMedia } from "@/lib/services/media";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(user, "stone:edit")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await setMainMedia(id, user);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(user, "stone:edit")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }
  const { id } = await params;
  await deleteStoneMedia(id, user);
  return NextResponse.json({ ok: true });
}
