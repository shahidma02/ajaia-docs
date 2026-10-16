const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export default function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={small ? "avatar sm" : "avatar"} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
