"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

type Kind = "error" | "success";
type Toast = { id: number; message: string; kind: Kind };

// Fire-and-forget from anywhere in the client; <Toaster /> in the root layout renders them.
export function toast(message: string, kind: Kind = "error") {
  window.dispatchEvent(new CustomEvent("app-toast", { detail: { message, kind } }));
}

let nextId = 0;

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id));

  useEffect(() => {
    const onToast = (e: Event) => {
      const t: Toast = { id: ++nextId, ...(e as CustomEvent<Omit<Toast, "id">>).detail };
      setToasts((ts) => [...ts.slice(-2), t]); // keep at most 3 on screen
      setTimeout(() => dismiss(t.id), t.kind === "error" ? 6000 : 3000);
    };
    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, []);

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
          <Icon name={t.kind === "error" ? "alert" : "check"} />
          <span>{t.message}</span>
          <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
