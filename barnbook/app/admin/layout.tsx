import { isUserAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await isUserAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-parchment">
      <header className="sticky top-0 z-40 border-b border-barn-dark/10 bg-barn-dark">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg font-semibold text-white">
              BarnBook Admin
            </span>
            <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
              Admin
            </span>
          </div>
          <a
            href="/dashboard"
            className="text-sm text-white/60 hover:text-white"
          >
            ← Back to app
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
