import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import type { User } from "@/lib/docs";

export default function SignInCard({
  users,
  busy,
  onPick,
}: {
  users: User[];
  busy: boolean;
  onPick: (userId: string) => void;
}) {
  return (
    <div className="card signin">
      <Logo heading />
      <p className="muted">Choose a demo account to continue. This is mock sign-in for review, so there are no passwords.</p>
      <div className="stack">
        {users.map((u) => (
          <button key={u.id} className="user-pick" disabled={busy} onClick={() => onPick(u.id)}>
            <Avatar name={u.name} />
            <span className="user-pick-text">
              <strong>{u.name}</strong>
              <span className="muted">{u.email}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
