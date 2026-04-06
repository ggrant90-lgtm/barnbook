"use client";

import { useState } from "react";

interface BarnMember {
  id: string;
  name: string;
  role: string;
}

const inputClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  trainer: "Trainer",
  staff: "Staff",
  viewer: "Viewer",
};

export function PerformedBySelect({
  barnMembers,
  currentUserId,
}: {
  barnMembers: BarnMember[];
  currentUserId: string;
}) {
  const [mode, setMode] = useState<"member" | "other">("member");
  const [selectedId, setSelectedId] = useState(currentUserId);
  const [otherName, setOtherName] = useState("");

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__other__") {
      setMode("other");
      setSelectedId("");
    } else {
      setMode("member");
      setSelectedId(val);
    }
  };

  return (
    <div className="space-y-2">
      <label className="mb-1.5 block text-sm text-barn-dark/75">
        Performed by
      </label>

      <select
        className={inputClass}
        value={mode === "other" ? "__other__" : selectedId}
        onChange={handleSelectChange}
      >
        {barnMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} — {roleLabels[m.role] ?? m.role}
          </option>
        ))}
        <option value="__other__">Other...</option>
      </select>

      {mode === "other" && (
        <input
          type="text"
          placeholder="e.g., Dr. Mike Hanson, DVM"
          className={inputClass}
          value={otherName}
          onChange={(e) => setOtherName(e.target.value)}
        />
      )}

      {/* Hidden inputs for the form submission */}
      {mode === "member" ? (
        <input type="hidden" name="performed_by_user_id" value={selectedId} />
      ) : (
        <input type="hidden" name="performed_by_name" value={otherName} />
      )}
    </div>
  );
}
