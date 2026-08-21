"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { issueJob, receiveJob, type ReceiveLine } from "@/lib/services/jobs";
import { parseMoneyToMinor } from "@/lib/format";
import { friendlyDbError } from "@/lib/prisma-errors";

export type JobState = { error?: string };

const IssueSchema = z.object({
  kind: z.enum(["CUTTING", "HEATING", "LAB"]),
  vendorId: z.string().uuid("Choose a vendor"),
  expectedBack: z.string().trim().optional(),
  chargeBasis: z.enum(["per_stone", "per_carat", "fixed"]),
  instructions: z.string().trim().optional(),
});

export async function issueJobAction(
  _prev: JobState,
  formData: FormData,
): Promise<JobState> {
  const user = await requireUser();
  if (!can(user, "custody:move")) return { error: "You cannot send stones out." };

  const parsed = IssueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const stoneIds = formData.getAll("stoneIds").map(String).filter(Boolean);

  let job;
  try {
    job = await issueJob(
      {
        kind: parsed.data.kind,
        vendorId: parsed.data.vendorId,
        stoneIds,
        expectedBack: parsed.data.expectedBack
          ? new Date(parsed.data.expectedBack)
          : null,
        chargeBasis: parsed.data.chargeBasis,
        instructions: parsed.data.instructions || null,
      },
      user,
    );
  } catch (e) {
    return { error: friendlyDbError(e, "Could not create the job.") };
  }

  revalidatePath("/jobs");
  revalidatePath("/custody");
  revalidatePath("/stones");
  revalidatePath("/");
  redirect(`/jobs/${job.id}`);
}

export async function receiveJobAction(
  _prev: JobState,
  formData: FormData,
): Promise<JobState> {
  const user = await requireUser();
  if (!can(user, "custody:move")) return { error: "You cannot receive stones." };

  const jobId = String(formData.get("jobId") ?? "");
  const returnLocationId = String(formData.get("returnLocationId") ?? "") || null;
  const lineIds = formData.getAll("lineIds").map(String);

  const lines: ReceiveLine[] = [];
  for (const lineId of lineIds) {
    const outcome = String(formData.get(`outcome_${lineId}`) ?? "RETURNED");
    const weightRaw = String(formData.get(`weightIn_${lineId}`) ?? "").trim();
    const chargeRaw = String(formData.get(`charge_${lineId}`) ?? "").trim();

    let chargeMinor: bigint | null = null;
    if (chargeRaw) {
      try {
        chargeMinor = parseMoneyToMinor(chargeRaw);
      } catch {
        return { error: `Charge must be a plain number, e.g. 4500 or 4500.00` };
      }
    }

    lines.push({
      lineId,
      weightInCt: weightRaw ? Number(weightRaw) : 0,
      outcome: outcome as ReceiveLine["outcome"],
      chargeMinor,
    });
  }

  try {
    await receiveJob(jobId, lines, returnLocationId, user);
  } catch (e) {
    return { error: friendlyDbError(e, "Could not receive the job.") };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/custody");
  revalidatePath("/stones");
  revalidatePath("/reports");
  revalidatePath("/");
  redirect(`/jobs/${jobId}`);
}
