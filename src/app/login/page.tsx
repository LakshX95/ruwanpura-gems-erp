"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button, Field, Input } from "@/components/ui/primitives";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-3 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <span
              aria-hidden
              className="inline-block h-10 w-10 rounded-full ring-1 ring-black/10"
              style={{
                background:
                  "radial-gradient(circle at 32% 28%, #ffffffcc 0%, #1f3f8f 42%, #101f4d 100%)",
              }}
            />
          </div>
          <h1 className="text-lg font-semibold text-fg">
            Ruwanpura Gems
          </h1>
          <p className="mt-1 text-sm text-fg-3">
            Gem stock, costing &amp; custody
          </p>
          <span className="mt-2 inline-block rounded-full border border-gold/25 bg-gold-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold">
            Demonstration system
          </span>
        </div>

        <form
          action={formAction}
          className="rounded-lg border border-line bg-surface p-5 shadow-sm"
        >
          <div className="space-y-3">
            <Field label="Email">
              <Input
                name="email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                placeholder="you@ruwanpura.lk"
              />
            </Field>
            <Field label="Password">
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
          </div>

          {state.error && (
            <p
              role="alert"
              className="mt-3 rounded border border-danger/30 bg-danger-soft px-2.5 py-2 text-xs text-danger"
            >
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="mt-4 w-full py-2">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-fg-4">
          Demo accounts — password <code className="text-fg-3">ruwanpura123</code>
          <br />
          owner@ruwanpura.lk · manager@ruwanpura.lk · clerk@ruwanpura.lk
        </p>
      </div>
    </main>
  );
}
