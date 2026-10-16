"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import { RoleBadge, RoleSelect } from "@/components/Role";
import { PersonRowSkeleton } from "@/components/Skeleton";
import { api, errorMessage } from "@/lib/client";
import type { Doc, Share, User } from "@/lib/docs";

export default function SharePanel({
  doc,
  shareCount,
  onShareCount,
  onClose,
}: {
  doc: Doc;
  shareCount: number; // last known number of shares, so the skeleton reserves exactly the right space
  onShareCount: (n: number) => void;
  onClose: () => void;
}) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Share["role"]>("editor");
  const [busy, setBusy] = useState(false);
  const isOwner = doc.role === "owner";
  const base = `/api/documents/${doc.id}/shares`;

  useEffect(() => {
    api<Share[]>(base).then(
      (list) => {
        setShares(list);
        onShareCount(list.length);
      },
      (e) => toast.error(errorMessage(e)),
    );
    api<{ users: User[] }>("/api/session").then((s) => setUsers(s.users), () => {});
  }, [base, onShareCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function mutate(method: "POST" | "DELETE", body: unknown, success: string) {
    setBusy(true);
    try {
      const list = await api<Share[]>(base, { method, body });
      setShares(list);
      onShareCount(list.length);
      if (method === "POST") setEmail("");
      toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="panel" aria-label="Sharing">
        <div className="panel-head">
          <h2>{isOwner ? "Share" : "People with access"}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close sharing panel">
            <X size={18} />
          </button>
        </div>
        <p className="muted panel-sub">{doc.title}</p>

        {isOwner && (
          <form
            className="share-form"
            onSubmit={(e) => {
              e.preventDefault();
              mutate("POST", { email, role }, `Shared with ${email.trim()}`);
            }}
          >
            <input
              type="email"
              required
              placeholder="Add people by email, e.g. bob@ajaia.test"
              list="seeded-users"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email to share with"
            />
            <datalist id="seeded-users">
              {users.filter((u) => u.id !== doc.ownerId).map((u) => (
                <option key={u.id} value={u.email}>{u.name}</option>
              ))}
            </datalist>
            <RoleSelect value={role} onChange={setRole} label="Access level" />
            <button className="primary" disabled={busy}>Share</button>
          </form>
        )}

        <h3>People with access</h3>
        <ul className="people">
          <li>
            <Avatar name={doc.ownerName} small />
            <span className="person"><strong>{doc.ownerName}</strong></span>
            <RoleBadge role="owner" />
          </li>
          {shares === null && Array.from({ length: shareCount }, (_, i) => <PersonRowSkeleton key={i} />)}
          {shares?.map((s) => (
            <li key={s.userId}>
              <Avatar name={s.name} small />
              <span className="person">
                <strong>{s.name}</strong>
                <span className="muted">{s.email}</span>
              </span>
              {isOwner ? (
                <span className="row">
                  <RoleSelect
                    value={s.role}
                    disabled={busy}
                    label={`Access for ${s.name}`}
                    onChange={(r) => mutate("POST", { email: s.email, role: r }, `${s.name} can now ${r === "editor" ? "edit" : "view"}`)}
                  />
                  <button
                    className="icon-btn"
                    disabled={busy}
                    title="Remove access"
                    aria-label={`Remove ${s.name}`}
                    onClick={() => mutate("DELETE", { userId: s.userId }, `Removed ${s.name}`)}
                  >
                    <X size={16} />
                  </button>
                </span>
              ) : (
                <RoleBadge role={s.role} />
              )}
            </li>
          ))}
        </ul>
        {isOwner && (shares?.length ?? shareCount) === 0 && <p className="muted small">Not shared with anyone yet.</p>}
        {!isOwner && <p className="muted small">Only the owner can change who has access.</p>}
      </aside>
    </>
  );
}
