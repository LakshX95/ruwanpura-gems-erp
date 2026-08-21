import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/permissions";
import { logout } from "@/app/login/actions";
import { CommandPalette } from "@/components/command-palette";
import { FlashToasts, ToastProvider } from "@/components/toast";
import { Sidebar } from "./sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar
          userName={user.name}
          roleLabel={ROLE_LABEL[user.role]}
          signOut={logout}
        />
        <main className="min-w-0 flex-1 px-5 py-5">
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </main>
      </div>
      <CommandPalette />
      <Suspense fallback={null}>
        <FlashToasts />
      </Suspense>
    </ToastProvider>
  );
}
