"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createSale, type SaleLineInput } from "@/lib/services/sales";
import { parseMoneyToMinor } from "@/lib/format";
import { friendlyDbError } from "@/lib/prisma-errors";

export type SaleState = { error?: string };

const Schema = z.object({
  customerId: z.string().uuid("Choose a customer"),
  soldOn: z.string().min(1, "Enter the date of sale"),
  currency: z.enum(["LKR", "USD", "EUR", "THB", "HKD"]),
  fxRate: z.coerce.number().positive("Exchange rate must be greater than zero"),
  brokerName: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export async function createSaleAction(
  _prev: SaleState,
  formData: FormData,
): Promise<SaleState> {
  const user = await requireUser();
  if (!can(user, "sale:create")) return { error: "You cannot record sales." };

  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const stoneIds = formData.getAll("stoneIds").map(String).filter(Boolean);
  if (stoneIds.length === 0) return { error: "Add at least one stone to the sale." };

  const lines: SaleLineInput[] = [];
  for (const stoneId of stoneIds) {
    const perRaw = String(formData.get(`perCarat_${stoneId}`) ?? "").trim();
    const totalRaw = String(formData.get(`total_${stoneId}`) ?? "").trim();
    if (!perRaw && !totalRaw) {
      return { error: "Every stone needs a price — per carat or total." };
    }
    try {
      lines.push({
        stoneId,
        perCaratMinor: perRaw ? parseMoneyToMinor(perRaw) : null,
        totalMinor: totalRaw ? parseMoneyToMinor(totalRaw) : null,
      });
    } catch {
      return { error: "Prices must be plain numbers, e.g. 250000 or 250000.50" };
    }
  }

  let sale;
  try {
    sale = await createSale(
      {
        customerId: parsed.data.customerId,
        soldOn: new Date(parsed.data.soldOn),
        currency: parsed.data.currency,
        fxRate: parsed.data.fxRate,
        brokerName: parsed.data.brokerName || null,
        note: parsed.data.note || null,
        lines,
      },
      user,
    );
  } catch (e) {
    return { error: friendlyDbError(e, "Could not record the sale.") };
  }

  for (const path of ["/sales", "/stones", "/custody", "/reports", "/"]) {
    revalidatePath(path);
  }
  redirect(`/sales/${sale.id}?flash=${encodeURIComponent(`Sale ${sale.saleNo} recorded`)}`);
}
