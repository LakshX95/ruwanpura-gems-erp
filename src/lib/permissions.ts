import type { Role } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";

/**
 * Field-level permissions, not just page-level.
 *
 * The owner of a gem business will ask for this specifically: data-entry staff
 * must be able to record stones without ever seeing what those stones cost or
 * what margin they carry. Building it in from the start is far cheaper than
 * retro-fitting it once cost figures are scattered through the UI.
 */
export type Permission =
  | "stone:view"
  | "stone:create"
  | "stone:edit"
  | "cost:view" // purchase cost, landed cost, cost breakdown
  | "margin:view" // asking price vs cost, profitability
  | "purchase:view"
  | "purchase:create"
  | "sale:view"
  | "sale:create"
  | "memo:view"
  | "memo:create"
  | "custody:move"
  | "reports:view"
  | "settings:manage";

const MATRIX: Record<Role, Permission[]> = {
  OWNER: [
    "stone:view", "stone:create", "stone:edit",
    "cost:view", "margin:view",
    "purchase:view", "purchase:create",
    "sale:view", "sale:create",
    "memo:view", "memo:create",
    "custody:move", "reports:view", "settings:manage",
  ],
  MANAGER: [
    "stone:view", "stone:create", "stone:edit",
    "cost:view",
    "purchase:view", "purchase:create",
    "sale:view", "sale:create",
    "memo:view", "memo:create",
    "custody:move", "reports:view",
  ],
  CLERK: ["stone:view", "stone:create", "custody:move", "memo:view"],
};

export function can(
  user: Pick<SessionUser, "role"> | null,
  permission: Permission,
): boolean {
  if (!user) return false;
  return MATRIX[user.role].includes(permission);
}

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CLERK: "Data Entry",
};
