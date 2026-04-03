/** Roles that may create/edit horses and logs (editor or higher). */
const EDITOR_PLUS = new Set(["owner", "manager", "editor"]);

const OWNER_MANAGER = new Set(["owner", "manager"]);

export function isEditorPlusRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return EDITOR_PLUS.has(role.trim().toLowerCase());
}

/** Barn owners and managers may manage access keys. */
export function isOwnerOrManagerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return OWNER_MANAGER.has(role.trim().toLowerCase());
}
