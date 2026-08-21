import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getObject } from "@/lib/storage";

/**
 * Serves stone photographs. Behind the session on purpose — a competitor with
 * a stone's photo URL should not be able to browse the client's inventory.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const user = await getSession();
  if (!user) return new NextResponse("Not signed in", { status: 401 });

  const { key } = await params;
  try {
    const data = await getObject(key.join("/"));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        // Immutable: a new photo always gets a new key.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
