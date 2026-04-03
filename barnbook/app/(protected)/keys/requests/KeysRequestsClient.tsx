"use client";

import { approveKeyRequestAction, denyKeyRequestAction } from "@/app/(protected)/actions/keys";
import { Button } from "@/components/ui/Button";
import type { KeyRequest } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function KeysRequestsClient({
  barnName,
  requests,
  requesterNames,
}: {
  barnName: string;
  requests: KeyRequest[];
  requesterNames: Record<string, string>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function approve(id: string) {
    setPendingId(id);
    await approveKeyRequestAction(id);
    setPendingId(null);
    router.refresh();
  }

  async function deny(id: string) {
    setPendingId(id);
    await denyKeyRequestAction(id);
    setPendingId(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/keys" className="text-sm text-barn-dark/70 hover:text-brass-gold">
        ← Keys
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-barn-dark">Key requests</h1>
      <p className="mt-1 text-sm text-barn-dark/65">{barnName}</p>

      {requests.length === 0 ? (
        <p className="mt-10 text-barn-dark/70">No pending requests.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {requests.map((r) => (
            <li key={r.id} className="rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
              <p className="font-medium text-barn-dark">{requesterNames[r.requester_id] ?? "Member"}</p>
              <p className="text-sm text-barn-dark/65">{r.email ?? "—"}</p>
              <p className="mt-2 text-sm text-barn-dark/80">
                Requested role: <span className="font-medium capitalize">{r.desired_role}</span>
              </p>
              {r.message ? (
                <p className="mt-3 rounded-lg bg-barn-dark/5 px-3 py-2 text-sm text-barn-dark/80">{r.message}</p>
              ) : null}
              <time className="mt-2 block text-xs text-barn-dark/45" dateTime={r.created_at}>
                {new Date(r.created_at).toLocaleString()}
              </time>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" disabled={pendingId === r.id} onClick={() => void approve(r.id)}>
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pendingId === r.id}
                  onClick={() => void deny(r.id)}
                >
                  Deny
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
