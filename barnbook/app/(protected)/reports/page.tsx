import { getActiveBarnContext } from "@/lib/barn-session";
import { getBarnMembers, getBarnHorses } from "@/app/(protected)/actions/reports";
import { createServerComponentClient } from "@/lib/supabase-server";
import { ReportsClient } from "@/components/reports/ReportsClient";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getActiveBarnContext(supabase, user.id);
  if (!ctx) redirect("/dashboard");

  const [members, horses] = await Promise.all([
    getBarnMembers(ctx.barn.id),
    getBarnHorses(ctx.barn.id),
  ]);

  // Fetch unique performer names from activity logs (custom/external performers)
  const { data: performerNames } = await supabase
    .from("activity_log")
    .select("performed_by_name")
    .not("performed_by_name", "is", null)
    .neq("performed_by_name", "")
    .in("horse_id",
      (horses ?? []).map((h) => h.id),
    );
  const uniqueNames = [...new Set(
    (performerNames ?? [])
      .map((r) => r.performed_by_name as string)
      .filter(Boolean),
  )].sort();

  // Filter out names that match existing barn members
  const memberNames = new Set(members.map((m) => m.name.toLowerCase()));
  const externalPerformers = uniqueNames.filter(
    (name) => !memberNames.has(name.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-barn-dark">Reports</h1>
      <p className="mt-2 mb-6 text-barn-dark/70">
        Generate operational reports from your log data.
      </p>

      <ReportsClient
        barnId={ctx.barn.id}
        barnMembers={members}
        barnHorses={horses}
        userRole={ctx.membership?.role ?? "owner"}
        externalPerformers={externalPerformers}
      />
    </div>
  );
}
