import { createAdminClient } from "@/lib/supabase-admin";
import type { PaywallInterest } from "@/lib/types";

export default async function InterestPage() {
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-red-700">
        Set SUPABASE_SERVICE_ROLE_KEY to enable admin features.
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: interestsRaw } = await (adminClient as any)
    .from("paywall_interest")
    .select("*")
    .order("created_at", { ascending: false });
  const interests = (interestsRaw ?? []) as PaywallInterest[];

  // Fetch user names
  const userIds = [
    ...new Set(
      (interests ?? [])
        .map((i) => i.user_id)
        .filter(Boolean) as string[],
    ),
  ];
  let userNames: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    userNames = (profiles ?? []).reduce(
      (acc, p) => {
        if (p.full_name) acc[p.id] = p.full_name;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  // Fetch barn names
  const barnIds = [
    ...new Set(
      (interests ?? [])
        .map((i) => i.barn_id)
        .filter(Boolean) as string[],
    ),
  ];
  let barnNames: Record<string, string> = {};
  if (barnIds.length > 0) {
    const { data: barns } = await adminClient
      .from("barns")
      .select("id, name")
      .in("id", barnIds);
    barnNames = (barns ?? []).reduce(
      (acc, b) => {
        acc[b.id] = b.name;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-barn-dark">
          Upgrade Interest
        </h1>
        <p className="mt-1 text-sm text-barn-dark/60">
          Users who clicked upgrade and expressed interest in paid plans.
        </p>
      </div>

      <div className="rounded-xl border border-barn-dark/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-barn-dark/10 text-left">
                <th className="px-6 py-3 font-medium text-barn-dark/60">
                  Email
                </th>
                <th className="px-6 py-3 font-medium text-barn-dark/60">
                  User
                </th>
                <th className="px-6 py-3 font-medium text-barn-dark/60">
                  Barn
                </th>
                <th className="px-6 py-3 font-medium text-barn-dark/60">
                  Plan
                </th>
                <th className="px-6 py-3 font-medium text-barn-dark/60">
                  Message
                </th>
                <th className="px-6 py-3 font-medium text-barn-dark/60">
                  Date
                </th>
                <th className="px-6 py-3 font-medium text-barn-dark/60">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {(interests ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-barn-dark/40"
                  >
                    No upgrade interest yet.
                  </td>
                </tr>
              ) : (
                (interests ?? []).map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-barn-dark/5 hover:bg-parchment/30"
                  >
                    <td className="px-6 py-3 font-medium text-barn-dark">
                      {i.email}
                    </td>
                    <td className="px-6 py-3 text-barn-dark/60">
                      {i.user_id
                        ? userNames[i.user_id] ?? "—"
                        : "—"}
                    </td>
                    <td className="px-6 py-3 text-barn-dark/60">
                      {i.barn_id
                        ? barnNames[i.barn_id] ?? "—"
                        : "—"}
                    </td>
                    <td className="px-6 py-3 text-barn-dark/60">
                      {i.plan_requested.replace(/_/g, " ")}
                    </td>
                    <td className="max-w-xs truncate px-6 py-3 text-barn-dark/60">
                      {i.message ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-barn-dark/50">
                      {new Date(i.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      {i.contacted_at ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          Contacted
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
