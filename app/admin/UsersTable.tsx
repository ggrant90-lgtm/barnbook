"use client";

import { useState, useTransition } from "react";
import { toggleUserFeatureAction } from "@/app/(protected)/actions/admin";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  has_breeders_pro: boolean;
  has_business_pro: boolean;
  has_document_scanner: boolean;
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const [localState, setLocalState] = useState<Record<string, UserRow>>(
    Object.fromEntries(users.map((u) => [u.id, u])),
  );

  const rows = Object.values(localState)
    .filter((u) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));

  const toggle = (
    user: UserRow,
    feature:
      | "has_breeders_pro"
      | "has_business_pro"
      | "has_document_scanner",
  ) => {
    const nextVal = !user[feature];
    // Optimistic
    setLocalState((prev) => ({ ...prev, [user.id]: { ...user, [feature]: nextVal } }));
    startTransition(async () => {
      const res = await toggleUserFeatureAction(user.id, feature, nextVal);
      if (res.error) {
        // Rollback
        setLocalState((prev) => ({ ...prev, [user.id]: user }));
        alert(`Failed: ${res.error}`);
      }
    });
  };

  return (
    <div className="rounded-xl border border-barn-dark/10 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-barn-dark/10 px-6 py-4">
        <h2 className="font-serif text-lg font-semibold text-barn-dark">Users</h2>
        <input
          type="text"
          placeholder="Search..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-barn-dark/15 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-barn-dark/10 text-left">
              <th className="px-6 py-3 font-medium text-barn-dark/60">Name</th>
              <th className="px-6 py-3 font-medium text-barn-dark/60">Email</th>
              <th className="px-6 py-3 font-medium text-barn-dark/60 text-center">
                Breeders Pro
              </th>
              <th className="px-6 py-3 font-medium text-barn-dark/60 text-center">
                Business Pro
              </th>
              <th className="px-6 py-3 font-medium text-barn-dark/60 text-center">
                Scanner
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-barn-dark/5 hover:bg-parchment/30">
                <td className="px-6 py-3 font-medium text-barn-dark">
                  {u.full_name ?? "—"}
                </td>
                <td className="px-6 py-3 text-barn-dark/60">{u.email}</td>
                <td className="px-6 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggle(u, "has_breeders_pro")}
                    disabled={pending}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition ${
                      u.has_breeders_pro
                        ? "bg-brass-gold text-barn-dark"
                        : "bg-barn-dark/5 text-barn-dark/50"
                    }`}
                  >
                    {u.has_breeders_pro ? "Enabled" : "Disabled"}
                  </button>
                </td>
                <td className="px-6 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggle(u, "has_business_pro")}
                    disabled={pending}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition ${
                      u.has_business_pro
                        ? "bg-brass-gold text-barn-dark"
                        : "bg-barn-dark/5 text-barn-dark/50"
                    }`}
                  >
                    {u.has_business_pro ? "Enabled" : "Disabled"}
                  </button>
                </td>
                <td className="px-6 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggle(u, "has_document_scanner")}
                    disabled={pending}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition ${
                      u.has_document_scanner
                        ? "bg-brass-gold text-barn-dark"
                        : "bg-barn-dark/5 text-barn-dark/50"
                    }`}
                  >
                    {u.has_document_scanner ? "Enabled" : "Disabled"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
