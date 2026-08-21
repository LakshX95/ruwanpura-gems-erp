import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

/** Backs the command palette's stone lookup. */
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ stones: [] }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ stones: [] });

  const stones = await db.stone.findMany({
    where: {
      OR: [
        { stoneNo: { contains: q, mode: "insensitive" } },
        { certNo: { contains: q, mode: "insensitive" } },
        { variety: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    orderBy: { stoneNo: "asc" },
    take: 8,
    select: {
      id: true, stoneNo: true, weightCt: true, status: true,
      variety: { select: { name: true } },
      colour: { select: { name: true } },
    },
  });

  return NextResponse.json({
    stones: stones.map((s) => ({
      id: s.id,
      stoneNo: s.stoneNo,
      weightCt: Number(s.weightCt.toString()),
      status: s.status,
      variety: s.variety?.name ?? null,
      colour: s.colour?.name ?? null,
    })),
  });
}
