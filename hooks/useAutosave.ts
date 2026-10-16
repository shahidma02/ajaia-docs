"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/client";
import type { Doc } from "@/lib/docs";

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";
type Patch = { title?: string; content?: string };

const SAVE_DELAY_MS = 800; // save once typing pauses…
const MAX_WAIT_MS = 5000; // …but at least this often during non-stop typing

// Debounced autosave for one document. Edits accumulate in `pending` and are sent one request at a
// time with the version the client last saw; a 409 means someone else saved first (no silent overwrite).
export function useAutosave(docId: string) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState("");

  const version = useRef(0);
  const pending = useRef<Patch>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const conflicted = useRef(false);
  const dirtySince = useRef(0);

  const setVersion = useCallback((v: number) => {
    version.current = v;
  }, []);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      const patch = pending.current;
      if (conflicted.current || Object.keys(patch).length === 0) return;
      pending.current = {};
      setError("");
      setStatus("saving");
      // Retry transient failures (network / 5xx) with backoff; 4xx won't fix itself, so surface it.
      for (let attempt = 0; ; attempt++) {
        try {
          const saved = await api<Doc>(`/api/documents/${docId}`, {
            method: "PATCH",
            body: { ...patch, version: version.current },
            keepalive: true, // let the last save finish if the user navigates away
          });
          version.current = saved.version;
          setStatus(Object.keys(pending.current).length ? "dirty" : "saved");
          return;
        } catch (e) {
          const code = e instanceof ApiError ? e.status : 0;
          if (code === 409) {
            conflicted.current = true;
            setStatus("conflict");
            return;
          }
          if ((code === 0 || code >= 500) && attempt < 3) {
            setStatus("error");
            await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
            continue;
          }
          pending.current = { ...patch, ...pending.current }; // keep edits; next change retries
          setError(errorMessage(e));
          toast.error(`Couldn't save: ${errorMessage(e)}`);
          setStatus("error");
          return;
        }
      }
    });
  }, [docId]);

  const queue = useCallback(
    (patch: Patch) => {
      if (conflicted.current) return;
      if (Object.keys(pending.current).length === 0) dirtySince.current = Date.now();
      Object.assign(pending.current, patch);
      setStatus("dirty");
      clearTimeout(timer.current);
      const overdue = Date.now() - dirtySince.current >= MAX_WAIT_MS;
      timer.current = setTimeout(flush, overdue ? 0 : SAVE_DELAY_MS);
    },
    [flush],
  );

  // Save on leave, and warn if the tab is closed with unsaved edits.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      flush();
    };
  }, [flush]);

  return { status, error, queue, setVersion };
}
