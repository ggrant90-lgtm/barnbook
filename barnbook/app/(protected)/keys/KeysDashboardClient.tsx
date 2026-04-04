"use client";

import { approveKeyRequestAction, denyKeyRequestAction } from "@/app/(protected)/actions/keys";
import { KeyCard } from "@/components/KeyCard";
import { MemberCard, type MemberInfo } from "@/components/MemberCard";
import { Button, linkButtonClass } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Select } from "@/components/ui/Select";
import { getJoinUrl } from "@/lib/site-url";
import type { AccessKey, KeyRequest } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function RequestCard({ r, requesterLabel }: { r: KeyRequest; requesterLabel: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const approve = async () => {
    setPending(true);
    await approveKeyRequestAction(r.id);
    setPending(false);
    router.refresh();
  };

  const deny = async () => {
    setPending(true);
    await denyKeyRequestAction(r.id);
    setPending(false);
    router.refresh();
  };

  return (
    <li className="list-none rounded-2xl border border-barn-dark/10 bg-white p-4 shadow-sm">
      <p className="font-medium text-barn-dark">{requesterLabel}</p>
      <p className="text-sm text-barn-dark/65">{r.email ?? "—"}</p>
      <p className="mt-2 text-sm text-barn-dark/80">
        Wants: <span className="font-medium capitalize">{r.desired_role}</span>
      </p>
      {r.message ? (
        <p className="mt-2 rounded-lg bg-barn-dark/5 px-3 py-2 text-sm text-barn-dark/80">{r.message}</p>
      ) : null}
      <time className="mt-2 block text-xs text-barn-dark/45" dateTime={r.created_at}>
        {new Date(r.created_at).toLocaleString()}
      </time>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void approve()} disabled={pending}>
          Approve
        </Button>
        <Button type="button" variant="secondary" onClick={() => void deny()} disabled={pending}>
          Deny
        </Button>
      </div>
    </li>
  );
}

export function KeysDashboardClient({
  barnName,
  barnKeys,
  stallByHorse,
  horseOptions,
  pendingRequests,
  requesterNames,
  prefillHorseId,
  members,
}: {
  barnName: string;
  barnKeys: AccessKey[];
  stallByHorse: { horseId: string; horseName: string; keys: AccessKey[] }[];
  horseOptions: { id: string; name: string }[];
  pendingRequests: KeyRequest[];
  requesterNames: Record<string, string>;
  prefillHorseId?: string | null;
  members: MemberInfo[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pickerOpen, setPickerOpen] = useState(Boolean(prefillHorseId));
  const [sel, setSel] = useState(prefillHorseId ?? horseOptions[0]?.id ?? "");
  const joinUrl = getJoinUrl();

  const activeMembers = members.filter((m) => m.status !== "disabled");
  const disabledMembers = members.filter((m) => m.status === "disabled");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-barn-dark">Keys & Members</h1>
          <p className="mt-1 text-sm text-barn-dark/65">{barnName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/keys/generate" className={linkButtonClass("primary")}>
            Generate Barn Key
          </Link>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSel(prefillHorseId ?? horseOptions[0]?.id ?? "");
              setPickerOpen(true);
            }}
          >
            Generate Stall Key
          </Button>
        </div>
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose a horse"
        description="Stall keys grant access to a single horse."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!sel}
              onClick={() => {
                setPickerOpen(false);
                router.push(`/keys/generate?type=stall&horse=${sel}`);
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        {horseOptions.length === 0 ? (
          <p className="text-sm text-barn-dark/70">Add a horse first.</p>
        ) : (
          <Select
            label="Horse"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            className="w-full"
          >
            {horseOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        )}
      </Modal>

      {/* ─── Members ─── */}
      <section className="mt-10">
        <h2 className="font-serif text-xl text-barn-dark">Members</h2>
        <p className="mt-1 text-sm text-barn-dark/60">
          People with barn access. Change roles, disable, or remove members.
        </p>
        {activeMembers.length === 0 ? (
          <p className="mt-4 text-barn-dark/70">No active members.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {activeMembers.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </ul>
        )}

        {disabledMembers.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-barn-dark/50">
              Disabled
            </h3>
            <ul className="mt-3 space-y-3">
              {disabledMembers.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* ─── Barn Keys ─── */}
      <section className="mt-12">
        <h2 className="font-serif text-xl text-barn-dark">Barn keys</h2>
        <p className="mt-1 text-sm text-barn-dark/60">Full barn access (no specific horse).</p>
        {barnKeys.length === 0 ? (
          <p className="mt-4 text-barn-dark/70">No barn keys yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {barnKeys.map((k) => (
              <KeyCard key={k.id} accessKey={k} onCopied={() => show("Key code copied.", "success")} />
            ))}
          </ul>
        )}
      </section>

      {/* ─── Stall Keys ─── */}
      <section className="mt-12">
        <h2 className="font-serif text-xl text-barn-dark">Stall keys</h2>
        <p className="mt-1 text-sm text-barn-dark/60">Access to one horse, grouped below.</p>
        {stallByHorse.length === 0 ? (
          <p className="mt-4 text-barn-dark/70">No stall keys yet.</p>
        ) : (
          <div className="mt-6 space-y-8">
            {stallByHorse.map((group) => (
              <div key={group.horseId}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-barn-dark/50">
                  <Link href={`/horses/${group.horseId}`} className="hover:text-brass-gold">
                    {group.horseName}
                  </Link>
                </h3>
                <ul className="mt-3 space-y-3">
                  {group.keys.map((k) => (
                    <KeyCard key={k.id} accessKey={k} onCopied={() => show("Key code copied.", "success")} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Pending Requests ─── */}
      <section className="mt-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-serif text-xl text-barn-dark">Pending key requests</h2>
          <Link href="/keys/requests" className="text-sm font-medium text-brass-gold hover:underline">
            Open full list
          </Link>
        </div>
        {pendingRequests.length === 0 ? (
          <p className="mt-4 text-barn-dark/70">No pending requests.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendingRequests.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                requesterLabel={requesterNames[r.requester_id] ?? "Member"}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-center text-xs text-barn-dark/45">
        Share keys for others to redeem at {joinUrl}
      </p>
    </div>
  );
}
