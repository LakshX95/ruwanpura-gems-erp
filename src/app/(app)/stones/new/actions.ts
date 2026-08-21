"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { parseMoneyToMinor } from "@/lib/format";
import { nextStoneNo } from "@/lib/queries/stones";
import { friendlyDbError } from "@/lib/prisma-errors";

export type NewStoneState = { error?: string; fieldErrors?: Record<string, string> };

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optionalDecimal = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : Number(v)))
  .optional()
  .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), {
    message: "Must be a positive number",
  });

const Schema = z.object({
  stoneNo: z.string().trim().min(1, "Stone number is required"),
  kind: z.enum(["STONE", "LOT", "PARCEL"]),
  weightCt: z.coerce.number().positive("Weight must be greater than zero"),
  pieceCount: z.coerce.number().int().min(1).default(1),
  varietyId: optionalId,
  shapeId: optionalId,
  colourId: optionalId,
  treatmentId: optionalId,
  locationId: optionalId,
  clarity: optionalText,
  origin: optionalText,
  certLab: optionalText,
  certNo: optionalText,
  lengthMm: optionalDecimal,
  widthMm: optionalDecimal,
  depthMm: optionalDecimal,
  note: optionalText,
  askingPrice: optionalText,
  purchaseCost: optionalText,
});

export async function createStone(
  _prev: NewStoneState,
  formData: FormData,
): Promise<NewStoneState> {
  const user = await requireUser();
  if (!can(user, "stone:create")) return { error: "You cannot add stones." };

  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please correct the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;

  let askingPriceMinor: bigint | undefined;
  let purchaseCostMinor: bigint | undefined;
  try {
    if (d.askingPrice) askingPriceMinor = parseMoneyToMinor(d.askingPrice);
    if (d.purchaseCost) purchaseCostMinor = parseMoneyToMinor(d.purchaseCost);
  } catch {
    return {
      error: "Amounts must be plain numbers, e.g. 125000 or 125000.50",
      fieldErrors: { askingPrice: "Check this amount", purchaseCost: "Check this amount" },
    };
  }

  const existing = await db.stone.findUnique({ where: { stoneNo: d.stoneNo } });
  if (existing) {
    return {
      error: `Stone number ${d.stoneNo} is already used.`,
      fieldErrors: { stoneNo: "Already used" },
    };
  }

  // The stone, its opening cost and its first custody record are one unit of
  // work: a stone that exists without a receipt record is a gap in the audit
  // trail, which is the whole point of the system.
  try {
    await db.$transaction(async (tx) => {
      const stone = await tx.stone.create({
        data: {
          stoneNo: d.stoneNo,
          kind: d.kind,
          weightCt: d.weightCt,
          pieceCount: d.kind === "PARCEL" ? d.pieceCount : 1,
          varietyId: d.varietyId,
          shapeId: d.shapeId,
          colourId: d.colourId,
          treatmentId: d.treatmentId,
          locationId: d.locationId,
          clarity: d.clarity,
          origin: d.origin,
          certLab: d.certLab,
          certNo: d.certNo,
          lengthMm: d.lengthMm,
          widthMm: d.widthMm,
          depthMm: d.depthMm,
          note: d.note,
          askingPriceMinor,
          createdById: user.id,
        },
      });

      if (purchaseCostMinor != null) {
        await tx.costEntry.create({
          data: {
            stoneId: stone.id,
            kind: "PURCHASE",
            amountMinor: purchaseCostMinor,
            baseMinor: purchaseCostMinor,
            currency: "LKR",
            incurredOn: new Date(),
            note: "Entered on stone creation",
          },
        });
      }

      await tx.custodyEvent.create({
        data: {
          stoneId: stone.id,
          reason: "RECEIPT",
          weightCt: d.weightCt,
          toLocationId: d.locationId,
          createdById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          tableName: "stone",
          rowId: stone.id,
          action: "create",
          actorId: user.id,
          changes: { stoneNo: stone.stoneNo, weightCt: String(d.weightCt) },
        },
      });
    });
  } catch (e) {
    return { error: friendlyDbError(e, "Could not save the stone.") };
  }

  revalidatePath("/stones");
  revalidatePath("/");

  // "Save and add another" keeps the fields that stay the same across a sorting
  // session — variety, treatment and tray — so entering forty stones from one
  // parcel does not mean re-picking them forty times.
  if (formData.get("_again")) {
    const keep = new URLSearchParams();
    if (d.varietyId) keep.set("varietyId", d.varietyId);
    if (d.treatmentId) keep.set("treatmentId", d.treatmentId);
    if (d.locationId) keep.set("locationId", d.locationId);
    if (d.shapeId) keep.set("shapeId", d.shapeId);
    if (d.origin) keep.set("origin", d.origin);
    keep.set("saved", d.stoneNo);
    redirect(`/stones/new?${keep.toString()}`);
  }

  redirect("/stones");
}

/** Suggests the next number in the sequence for the chosen variety. */
export async function suggestStoneNo(varietyName: string | null) {
  await requireUser();
  return nextStoneNo(varietyName);
}
