"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { extendMemo, issueMemo, settleMemo, type SettleLine } from "@/lib/services/memos";
import { parseMoneyToMinor } from "@/lib/format";
import { friendlyDbError } from "@/lib/prisma-errors";

export type MemoState = { error?: string };

const revalidateAll = () => {
  for (const p of ["/memos", "/stones", "/custody", "/sales", "/reports", "/"]) {
    revalidatePath(p);
  }
};

const IssueSchema = z.object({
  partyId: z.string().uuid("Choose who the goods are going to"),
  dueBack: z.string().min(1, "Set a date for the goods to come back"),
  note: z.string().trim().optional(),
});

export async function issueMemoAction(
  _prev: MemoState,
  formData: FormData,
): Promise<MemoState> {
  const user = await requireUser();
  if (!can(user, "memo:create")) return { error: "You cannot issue memos." };

  const parsed = IssueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const stoneIds = formData.getAll("stoneIds").map(String).filter(Boolean);

  let memo;
  try {
    memo = await issueMemo(
      {
        partyId: parsed.data.partyId,
        stoneIds,
        dueBack: new Date(parsed.data.dueBack),
        note: parsed.data.note || null,
      },
      user,
    );
  } catch (e) {
    return { error: friendlyDbError(e, "Could not create the memo.") };
  }

  revalidateAll();
  redirect(`/memos/${memo.id}?flash=${encodeURIComponent(`${memo.memoNo} issued`)}`);
}

export async function settleMemoAction(
  _prev: MemoState,
  formData: FormData,
): Promise<MemoState> {
  const user = await requireUser();
  if (!can(user, "memo:create")) return { error: "You cannot settle memos." };

  const memoId = String(formData.get("memoId") ?? "");
  const returnLocationId = String(formData.get("returnLocationId") ?? "") || null;
  const lineIds = formData.getAll("lineIds").map(String);

  const lines: SettleLine[] = [];
  for (const lineId of lineIds) {
    const outcome = String(formData.get(`outcome_${lineId}`) ?? "KEEP");
    const priceRaw = String(formData.get(`price_${lineId}`) ?? "").trim();
    let priceMinor: bigint | null = null;
    if (outcome === "SOLD") {
      if (!priceRaw) return { error: "Enter a price for every stone marked sold." };
      try {
        priceMinor = parseMoneyToMinor(priceRaw);
      } catch {
        return { error: "Prices must be plain numbers, e.g. 250000 or 250000.50" };
      }
    }
    lines.push({ lineId, outcome: outcome as SettleLine["outcome"], priceMinor });
  }

  try {
    await settleMemo(memoId, lines, returnLocationId, user);
  } catch (e) {
    return { error: friendlyDbError(e, "Could not settle the memo.") };
  }

  revalidateAll();
  revalidatePath(`/memos/${memoId}`);
  redirect(`/memos/${memoId}?flash=${encodeURIComponent("Memo updated")}`);
}

export async function extendMemoAction(
  _prev: MemoState,
  formData: FormData,
): Promise<MemoState> {
  const user = await requireUser();
  if (!can(user, "memo:create")) return { error: "You cannot extend memos." };

  const memoId = String(formData.get("memoId") ?? "");
  const dueBack = String(formData.get("newDueBack") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!dueBack) return { error: "Choose a new date." };

  try {
    await extendMemo(memoId, new Date(dueBack), reason, user);
  } catch (e) {
    return { error: friendlyDbError(e, "Could not extend the memo.") };
  }

  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/memos");
  redirect(`/memos/${memoId}?flash=${encodeURIComponent("Due date extended")}`);
}
