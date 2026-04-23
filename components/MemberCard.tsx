"use client";

import {
  disableMemberAction,
  reenableMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/(protected)/actions/members";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface MemberInfo {
  id: string;
  user_id: string;
  role: string;
  status: "active" | "disabled" | null;
  name: string;
  email: string | null;
  isOwner: boolean;
}

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer" },
  { value: "member", label: "Member" },
  { value: "editor", label: "Editor" },
  { value: "trainer", label: "Trainer" },
  { value: "manager", label: "Manager" },
];

export function MemberCard({ member }: { member: MemberInfo }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, setPending] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"disable" | "remove" | null>(null);
  const [roleValue, setRoleValue] = useState(member.role);

  const isActive = member.status !== "disabled";

  async function handleRoleChange(newRole: string) {
    setRoleValue(newRole);
    setPending(true);
    const r = await updateMemberRoleAction(member.id, newRole);
    setPending(false);
    if (r.error) {
      show(r.error, "error");
      setRoleValue(member.role); // revert
    } else {
      show(`Role updated to ${newRole}.`, "success");
      router.refresh();
    }
  }

  async function handleDisable() {
    setPending(true);
    const r = await disableMemberAction(member.id);
    setPending(false);
    setConfirmAction(null);
    if (r.error) {
      show(r.error, "error");
    } else {
      show("Member access disabled.", "success");
      router.refresh();
    }
  }

  async function handleReenable() {
    setPending(true);
    const r = await reenableMemberAction(member.id);
    setPending(false);
    if (r.error) {
      show(r.error, "error");
    } else {
      show("Member access restored.", "success");
      router.refresh();
    }
  }

  async function handleRemove() {
    setPending(true);
    const r = await removeMemberAction(member.id);
    setPending(false);
    setConfirmAction(null);
    if (r.error) {
      show(r.error, "error");
    } else {
      show("Member removed permanently.", "success");
      router.refresh();
    }
  }

  return (
    <>
      <li className="list-none">
        <Card padding="sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-barn-dark">{member.name}</p>
                {member.isOwner ? (
                  <Badge variant="active">Owner</Badge>
                ) : !isActive ? (
                  <Badge variant="inactive">Disabled</Badge>
                ) : null}
              </div>
              {member.email ? (
                <p className="mt-0.5 text-xs text-barn-dark/50">{member.email}</p>
              ) : null}
              <p className="mt-1 text-xs capitalize text-barn-dark/55">
                Role: {member.role}
              </p>
            </div>

            {!member.isOwner ? (
              <div className="flex flex-wrap items-center gap-2">
                {isActive ? (
                  <>
                    <Select
                      label=""
                      value={roleValue}
                      onChange={(e) => void handleRoleChange(e.target.value)}
                      disabled={pending}
                      className="min-w-[120px] text-xs"
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmAction("disable")}
                      disabled={pending}
                    >
                      Disable
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleReenable()}
                    disabled={pending}
                  >
                    Re-enable
                  </Button>
                )}
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setConfirmAction("remove")}
                  disabled={pending}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </li>

      {/* Disable confirmation */}
      <Modal
        open={confirmAction === "disable"}
        onClose={() => setConfirmAction(null)}
        title="Disable access?"
        description={`${member.name} will lose access to the barn and all its horses. You can re-enable them later.`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={() => void handleDisable()} disabled={pending}>
              {pending ? "Disabling..." : "Disable access"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-barn-dark/70">
          Their barn_members record will be deactivated (not deleted). The barn and all horses will
          disappear from their dashboard.
        </p>
      </Modal>

      {/* Remove confirmation */}
      <Modal
        open={confirmAction === "remove"}
        onClose={() => setConfirmAction(null)}
        title="Remove member permanently?"
        description={`${member.name} will be permanently removed from the barn. They'll need a new key to rejoin.`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={() => void handleRemove()} disabled={pending}>
              {pending ? "Removing..." : "Remove permanently"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-barn-dark/70">
          This action cannot be undone. Their membership and any stall key access will be deleted.
        </p>
      </Modal>
    </>
  );
}
