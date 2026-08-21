import { Prisma } from "@/generated/prisma/client";

/**
 * Turn a Prisma failure into something a gem dealer can act on.
 *
 * The raw messages are multi-line, mention table and constraint names, and end
 * up rendered as a 500. These are the three that actually happen in normal use.
 */
export function friendlyDbError(e: unknown, fallback: string): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2002": {
        const target = (e.meta?.target as string[] | undefined)?.join(", ");
        return target
          ? `That ${target.replace(/_/g, " ")} is already used.`
          : "That value is already used.";
      }
      case "P2003":
        // Almost always a record referenced by the form no longer exists —
        // typically after the database was reseeded while a session was open.
        return (
          "Something this record points at no longer exists. " +
          "Sign out and sign in again, then try once more."
        );
      case "P2025":
        return "That record no longer exists — it may have been changed elsewhere.";
    }
  }
  if (e instanceof Error && e.message && !e.message.includes("\n")) {
    return e.message;
  }
  return fallback;
}
