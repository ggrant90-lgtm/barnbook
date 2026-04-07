"use client";

import { useState } from "react";

interface BarnMember {
  id: string;
  name: string;
  role: string;
}

interface SavedPerformer {
  id: string;
  name: string;
  specialty: string | null;
  use_count: number;
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
  savedPerformers = [],
}: {
  barnMembers: BarnMember[];
  currentUserId: string;
  savedPerformers?: SavedPerformer[];
}) {
  const [mode, setMode] = useState<"member" | "saved" | "other">("member");
  const [selectedId, setSelectedId] = useState(currentUserId);
  const [otherName, setOtherName] = useState("");

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__other__") {
      setMode("other");
      setSelectedId("");
    } else if (val.startsWith("__saved__:")) {
      const name = val.replace("__saved__:", "");
      setMode("saved");
      setSelectedId("");
      setOtherName(name);
    } else {
      setMode("member");
      setSelectedId(val);
      setOtherName("");
    }
  };

  return (
    <div className="space-y-2">
      <label className="mb-1.5 block text-sm text-barn-dark/75">
        Performed by
      </label>

      <select
        className={inputClass}
        value={
          mode === "other"
            ? "__other__"
            : mode === "saved"
              ? `__saved__:${otherName}`
              : selectedId
        }
        onChange={handleSelectChange}
      >
        <optgroup label="Barn Members">
          {barnMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {roleLabels[m.role] ?? m.role}
            </option>
          ))}
        </optgroup>

        {savedPerformers.length > 0 && (
          <optgroup label="Saved Contacts">
            {savedPerformers.map((sp) => (
              <option key={sp.id} value={`__saved__:${sp.name}`}>
                {sp.name}{sp.specialty ? ` — ${sp.specialty}` : ""}
              </option>
            ))}
          </optgroup>
        )}

        <option value="__other__">Other (new)...</option>
      </select>

      {mode === "other" && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Name — e.g., Dr. Mike Hanson, DVM"
            className={inputClass}
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
          />
          <input
            type="text"
            name="performer_specialty"
            placeholder="Specialty (optional) — e.g., Vet, Farrier"
            className={`${inputClass} text-sm`}
          />
        </div>
      )}

      {/* Hidden inputs for the form submission */}
      {mode === "member" ? (
        <input type="hidden" name="performed_by_user_id" value={selectedId} />
      ) : (
        <>
          <input type="hidden" name="performed_by_name" value={otherName} />
          {mode === "other" && (
            <input type="hidden" name="save_performer" value="true" />
          )}
        </>
      )}
    </div>
  );
}
