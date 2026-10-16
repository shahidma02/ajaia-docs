"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import type { Doc, Share, User } from "@/lib/docs";

export default function SharePanel({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Share["role"]>("editor");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = doc.role === "owner";
  const base = `/api/documents/${doc.id}/shares`;

  useEffect(() => {
    api<Share[]>(base).then(setShares, (e) => setError(errorMessage(e)));
    api<{ users: User[] }>("/api/session").then((s) => setUsers(s.users), () => {});
  }, [base]);

  async function mutate(method: "POST" | "DELETE", body: unknown) {
    setBusy(true);
    setError("");
    try {
      setShares(await api<Share[]>(base, { method, body }));
      if (method === "POST") setEmail("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="panel" aria-label="Sharing">
      <div className="panel-head">
        <h2>Share “{doc.title}”</h2>
        <button className="ghost" onClick={onClose} aria-label="Close sharing panel">✕</button>
      </div>

      {isOwner && (
        <form
          className="share-form"
          onSubmit={(e) => {
            e.preventDefault();
            mutate("POST", { email, role });
          }}
        >
          <input
            type="email"
            required
            placeholder="Email, e.g. bob@ajaia.test"
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
          <select value={role} onChange={(e) => setRole(e.target.value as Share["role"])} aria-label="Access level">
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button className="primary" disabled={busy}>Share</button>
        </form>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <h3>People with access</h3>
      <ul className="people">
        <li>
          <span><strong>{doc.ownerName}</strong></span>
          <span className="badge owner">Owner</span>
        </li>
        {shares === null && <li className="muted">Loading…</li>}
        {shares?.map((s) => (
          <li key={s.userId}>
            <span><strong>{s.name}</strong> <span className="muted">{s.email}</span></span>
            {isOwner ? (
              <span className="row">
                <select
                  value={s.role}
                  disabled={busy}
                  aria-label={`Access for ${s.name}`}
                  onChange={(e) => mutate("POST", { email: s.email, role: e.target.value })}
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button className="ghost" disabled={busy} onClick={() => mutate("DELETE", { userId: s.userId })}>
                  Remove
                </button>
              </span>
            ) : (
              <span className="badge">{s.role === "editor" ? "Can edit" : "Can view"}</span>
            )}
          </li>
        ))}
      </ul>
      {!isOwner && <p className="muted">Only the owner can change sharing.</p>}
    </aside>
  );
}
