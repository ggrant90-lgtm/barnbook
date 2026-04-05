"use client";

import {
  BREED_DATA_SUBTYPES,
  BREED_DATA_SUBTYPE_LABELS,
  BREEDING_METHODS,
  ULTRASOUND_RESULTS,
  type BreedDataSubtype,
} from "@/lib/horse-form-constants";
import { useState } from "react";

const inputClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

export function BreedDataForm() {
  const [subtype, setSubtype] = useState<BreedDataSubtype>("custom");

  return (
    <>
      <div>
        <label htmlFor="breed_subtype" className="mb-1.5 block text-sm text-barn-dark/75">
          Subtype
        </label>
        <select
          id="breed_subtype"
          name="breed_subtype"
          value={subtype}
          onChange={(e) => setSubtype(e.target.value as BreedDataSubtype)}
          className={inputClass}
        >
          {BREED_DATA_SUBTYPES.map((s) => (
            <option key={s} value={s}>
              {BREED_DATA_SUBTYPE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Entry — sticky note style */}
      {subtype === "custom" && (
        <div className="rounded-xl border-2 border-dashed border-brass-gold/30 bg-[#faf6ee] p-4">
          <p className="mb-2 text-xs font-medium text-barn-dark/50">Free-form entry — write anything</p>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            className={inputClass + " bg-[#faf6ee]"}
            placeholder="Jot down anything that doesn't fit a structured form..."
          />
        </div>
      )}

      {/* Heat Detected */}
      {subtype === "heat_detected" && (
        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">Notes</label>
          <textarea id="notes" name="notes" rows={3} className={inputClass} />
        </div>
      )}

      {/* Bred / AI */}
      {subtype === "bred_ai" && (
        <>
          <div>
            <label htmlFor="stallion_name" className="mb-1.5 block text-sm text-barn-dark/75">Stallion name</label>
            <input id="stallion_name" name="stallion_name" type="text" className={inputClass} />
          </div>
          <div>
            <label htmlFor="breeding_method" className="mb-1.5 block text-sm text-barn-dark/75">Breeding method</label>
            <select id="breeding_method" name="breeding_method" className={inputClass}>
              <option value="">—</option>
              {BREEDING_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">Notes</label>
            <textarea id="notes" name="notes" rows={3} className={inputClass} />
          </div>
        </>
      )}

      {/* Flush / Embryo Recovery */}
      {subtype === "flush_embryo" && (
        <>
          <div>
            <label htmlFor="vet" className="mb-1.5 block text-sm text-barn-dark/75">Vet</label>
            <input id="vet" name="vet" type="text" className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="embryos_recovered" className="mb-1.5 block text-sm text-barn-dark/75">Embryos recovered</label>
              <input id="embryos_recovered" name="embryos_recovered" type="number" min={0} className={inputClass} />
            </div>
            <div>
              <label htmlFor="embryos_viable" className="mb-1.5 block text-sm text-barn-dark/75">Embryos viable</label>
              <input id="embryos_viable" name="embryos_viable" type="number" min={0} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="storage_location" className="mb-1.5 block text-sm text-barn-dark/75">Storage location</label>
            <input id="storage_location" name="storage_location" type="text" className={inputClass} />
          </div>
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">Notes</label>
            <textarea id="notes" name="notes" rows={3} className={inputClass} />
          </div>
        </>
      )}

      {/* Embryo Transfer */}
      {subtype === "embryo_transfer" && (
        <>
          <div>
            <label htmlFor="vet" className="mb-1.5 block text-sm text-barn-dark/75">Vet</label>
            <input id="vet" name="vet" type="text" className={inputClass} />
          </div>
          <div>
            <label htmlFor="recipient_mare" className="mb-1.5 block text-sm text-barn-dark/75">Recipient mare</label>
            <input id="recipient_mare" name="recipient_mare" type="text" className={inputClass} />
          </div>
          <div>
            <label htmlFor="embryo_source" className="mb-1.5 block text-sm text-barn-dark/75">Embryo source notes</label>
            <input id="embryo_source" name="embryo_source" type="text" className={inputClass} />
          </div>
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">Notes</label>
            <textarea id="notes" name="notes" rows={3} className={inputClass} />
          </div>
        </>
      )}

      {/* Ultrasound / Pregnancy Check */}
      {subtype === "ultrasound" && (
        <>
          <div>
            <label htmlFor="vet" className="mb-1.5 block text-sm text-barn-dark/75">Vet</label>
            <input id="vet" name="vet" type="text" className={inputClass} />
          </div>
          <div>
            <label htmlFor="days_bred" className="mb-1.5 block text-sm text-barn-dark/75">Days bred</label>
            <input id="days_bred" name="days_bred" type="number" min={0} className={inputClass} />
          </div>
          <div>
            <label htmlFor="result" className="mb-1.5 block text-sm text-barn-dark/75">Result</label>
            <select id="result" name="result" className={inputClass}>
              <option value="">—</option>
              {ULTRASOUND_RESULTS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">Notes</label>
            <textarea id="notes" name="notes" rows={3} className={inputClass} />
          </div>
        </>
      )}

      {/* Foaling */}
      {subtype === "foaling" && (
        <>
          <div>
            <label htmlFor="foal_sex" className="mb-1.5 block text-sm text-barn-dark/75">Foal sex</label>
            <select id="foal_sex" name="foal_sex" className={inputClass}>
              <option value="">Unknown</option>
              <option value="M">Male (Colt)</option>
              <option value="F">Female (Filly)</option>
            </select>
          </div>
          <div>
            <label htmlFor="foal_color" className="mb-1.5 block text-sm text-barn-dark/75">Color and markings</label>
            <input id="foal_color" name="foal_color" type="text" className={inputClass} />
          </div>
          <div className="flex items-center gap-3">
            <input id="alive" name="alive" type="checkbox" value="true" defaultChecked className="h-5 w-5 accent-[#c9a84c]" />
            <label htmlFor="alive" className="text-sm text-barn-dark/75">Foal alive</label>
          </div>
          <div>
            <label htmlFor="vet" className="mb-1.5 block text-sm text-barn-dark/75">Vet</label>
            <input id="vet" name="vet" type="text" className={inputClass} />
          </div>
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm text-barn-dark/75">Notes</label>
            <textarea id="notes" name="notes" rows={3} className={inputClass} />
          </div>
        </>
      )}
    </>
  );
}
