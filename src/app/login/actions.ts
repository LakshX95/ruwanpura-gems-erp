"use server";

import { redirect } from "next/navigation";
import { verifyCredentials } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const user = await verifyCredentials(email, password);
  // One message for both cases, so the form cannot be used to discover which
  // email addresses have accounts.
  if (!user) return { error: "Those details do not match an active account." };

  await createSession(user);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
