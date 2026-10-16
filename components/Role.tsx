import type { Role, Share } from "@/lib/docs";

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", editor: "Can edit", viewer: "Can view" };

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge ${role}`}>{ROLE_LABEL[role]}</span>;
}

export function RoleSelect({
  value,
  onChange,
  label,
  disabled,
}: {
  value: Share["role"];
  onChange: (role: Share["role"]) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as Share["role"])}
    >
      <option value="editor">{ROLE_LABEL.editor}</option>
      <option value="viewer">{ROLE_LABEL.viewer}</option>
    </select>
  );
}
