/**
 * Breeders Pro — shared "where is this embryo right now?" helper.
 *
 * Used by the Embryo Detail page, Donor profile, and Stallion profile
 * so the same phrasing, styling cues, and link targets show up everywhere.
 *
 * Call site gives us:
 *   • the embryo row (for status + storage fields + loss/ship fields)
 *   • its linked pregnancy row if it has one (for the surrogate_horse_id)
 *   • its linked foaling row if the pregnancy foaled (for foal_horse_id)
 *   • a lookup of horse_id → name so we can render surrogate/foal names
 *
 * We return a typed `EmbryoLocation` that the UI can render in one of
 * two shapes: a table cell (short label, one-line) or a detail strip
 * (full label, may include a small second line of context).
 *
 * No schema assumptions beyond what's already in the embryo_asset_flow
 * and breeders_pro_event_first_flush migrations.
 */

export type EmbryoLocationKind =
  | "fresh" // in bank, not frozen — nothing physical yet
  | "frozen" // in storage tank
  | "transferred" // in a surrogate, pregnancy ongoing
  | "foaled" // pregnancy ended in a live foal
  | "lost_pre" // lost before transfer (degenerated, etc.)
  | "lost_post" // lost during pregnancy (early or late)
  | "shipped" // sold / shipped externally
  | "unknown"; // status we don't recognize

export type EmbryoLocation = {
  /** Internal discriminant for styling. */
  kind: EmbryoLocationKind;
  /**
   * Full-length label for the Embryo Detail strip and other roomy
   * placements. E.g. "In surrogate — Big Red" or "Tank 2 · Cane 4 · Pos 3 · Smith Cryo".
   */
  label: string;
  /**
   * Short label for table cells where horizontal space is tight
   * (especially on mobile). E.g. "→ Big Red" or "Tank 2".
   * Always ≤ ~20 characters for typical values.
   */
  short: string;
  /**
   * Optional hyperlink target. When set, the rendered element should
   * be a clickable `<Link>` rather than plain text. The link navigates
   * to whatever makes sense for this kind — surrogate profile for
   * transferred, foal profile for foaled, etc.
   */
  href?: string;
  /**
   * Whether the label should render in a muted color. True for
   * terminal states (lost, shipped) where the embryo is effectively
   * out of the active inventory.
   */
  muted: boolean;
  /**
   * Secondary line of context, only used by the detail strip (not
   * the table cell). E.g. "pregnancy day 47 · expected foaling 2026-06-15".
   */
  detail?: string;
};

export type EmbryoLocationInput = {
  /** Required: the embryo row. */
  embryo: {
    id: string;
    status: string;
    storage_facility?: string | null;
    storage_tank?: string | null;
    storage_cane?: string | null;
    storage_position?: string | null;
    loss_reason?: string | null;
    loss_date?: string | null;
    shipped_to?: string | null;
    ship_date?: string | null;
  };
  /**
   * Optional: the pregnancy row, if one exists for this embryo.
   * Should be the latest one if multiple exist (shouldn't, but just in case).
   */
  pregnancy?: {
    id: string;
    surrogate_horse_id: string | null;
    transfer_date: string | null;
    expected_foaling_date: string | null;
    status: string;
  } | null;
  /**
   * Optional: the foaling row, if the pregnancy foaled.
   */
  foaling?: {
    id: string;
    foal_horse_id: string | null;
    foaling_date: string | null;
  } | null;
  /**
   * Horse id → name lookup. Should include at minimum the surrogate
   * and foal ids referenced by pregnancy/foaling above.
   */
  horseNames: Record<string, string>;
};

/**
 * Compute the current-location display values for an embryo.
 *
 * Pure function — no I/O, no side effects, safe to call in both server
 * components and client components.
 */
export function computeEmbryoLocation(
  input: EmbryoLocationInput,
): EmbryoLocation {
  const { embryo, pregnancy, foaling, horseNames } = input;

  // --- Terminal states first: lost / shipped ---
  if (embryo.status === "lost") {
    // Two flavors of loss: pre-transfer (degenerated / etc.) and
    // post-transfer (early or late pregnancy loss). We distinguish
    // by whether a pregnancy row exists.
    if (pregnancy) {
      return {
        kind: "lost_post",
        label: prettyLossReason(embryo.loss_reason) || "Lost during pregnancy",
        short: "Lost",
        muted: true,
        detail: embryo.loss_date
          ? `Lost on ${embryo.loss_date}`
          : undefined,
      };
    }
    return {
      kind: "lost_pre",
      label: prettyLossReason(embryo.loss_reason) || "Lost before transfer",
      short: "Lost",
      muted: true,
      detail: embryo.loss_date
        ? `Lost on ${embryo.loss_date}`
        : undefined,
    };
  }

  if (embryo.status === "shipped_out") {
    const who = embryo.shipped_to?.trim() || null;
    return {
      kind: "shipped",
      label: who ? `Shipped to ${who}` : "Shipped out",
      short: who ? `→ ${truncate(who, 16)}` : "Shipped",
      muted: true,
      detail: embryo.ship_date ? `Shipped ${embryo.ship_date}` : undefined,
    };
  }

  // --- Became foal: show the foal, fall back to surrogate ---
  if (embryo.status === "became_foal") {
    const foalId = foaling?.foal_horse_id ?? null;
    const foalName = foalId ? horseNames[foalId] : null;
    if (foalId && foalName) {
      return {
        kind: "foaled",
        label: `Foaled — ${foalName}`,
        short: `→ ${truncate(foalName, 16)}`,
        href: `/breeders-pro/horses/${foalId}`,
        muted: false,
        detail: foaling?.foaling_date
          ? `Foaled ${foaling.foaling_date}`
          : undefined,
      };
    }
    // Foal record exists but no horse row — rare, but handle it.
    return {
      kind: "foaled",
      label: "Foaled (no foal record)",
      short: "Foaled",
      muted: false,
      detail: foaling?.foaling_date
        ? `Foaled ${foaling.foaling_date}`
        : undefined,
    };
  }

  // --- Transferred: show the surrogate + pregnancy day ---
  if (embryo.status === "transferred") {
    const surrogateId = pregnancy?.surrogate_horse_id ?? null;
    const surrogateName = surrogateId ? horseNames[surrogateId] : null;
    const pregnancyDay = daysSince(pregnancy?.transfer_date);
    const dayStr = pregnancyDay != null ? `day ${pregnancyDay}` : null;

    if (surrogateId && surrogateName) {
      return {
        kind: "transferred",
        label: `In surrogate — ${surrogateName}`,
        short: `→ ${truncate(surrogateName, 16)}`,
        href: `/breeders-pro/surrogates/${surrogateId}`,
        muted: false,
        detail:
          [
            dayStr,
            pregnancy?.expected_foaling_date
              ? `expected ${pregnancy.expected_foaling_date}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
      };
    }
    return {
      kind: "transferred",
      label: "Transferred",
      short: "Transferred",
      muted: false,
      detail: dayStr ?? undefined,
    };
  }

  // --- Frozen: show storage location ---
  if (embryo.status === "in_bank_frozen") {
    const parts = [
      embryo.storage_tank ? `Tank ${embryo.storage_tank}` : null,
      embryo.storage_cane ? `Cane ${embryo.storage_cane}` : null,
      embryo.storage_position ? `Pos ${embryo.storage_position}` : null,
    ].filter(Boolean) as string[];

    const facility = embryo.storage_facility?.trim() || null;
    const shortBits = parts.slice(0, 2).join(" · ") || "Frozen";

    if (parts.length === 0 && !facility) {
      return {
        kind: "frozen",
        label: "Frozen (location not recorded)",
        short: "Frozen",
        muted: false,
      };
    }

    const detail = [parts.join(" · "), facility].filter(Boolean).join(" — ");

    return {
      kind: "frozen",
      label: detail || "Frozen",
      short: shortBits,
      muted: false,
      detail: facility && parts.length > 0 ? facility : undefined,
    };
  }

  // --- Fresh: in the bank, nothing physical yet ---
  if (embryo.status === "in_bank_fresh") {
    return {
      kind: "fresh",
      label: "In bank — fresh",
      short: "In bank",
      muted: false,
    };
  }

  // --- Unknown status (future-proofing) ---
  return {
    kind: "unknown",
    label: embryo.status,
    short: embryo.status,
    muted: true,
  };
}

/** Turn a snake_case loss reason into a sentence. */
function prettyLossReason(reason?: string | null): string | null {
  if (!reason) return null;
  const map: Record<string, string> = {
    degenerated: "Degenerated",
    transfer_failure: "Transfer failure",
    early_pregnancy_loss: "Early pregnancy loss",
    late_pregnancy_loss: "Late pregnancy loss",
    other: "Lost",
  };
  return map[reason] ?? reason;
}

/** Days between an ISO date and today. Returns null if no date. */
function daysSince(isoDate?: string | null): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
