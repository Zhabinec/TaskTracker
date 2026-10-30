"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { openDraft } from "./draft-controller";
import type { DraftController, DraftSnapshot } from "./draft-controller";
import type { DraftContent } from "./draft-contracts";
import styles from "./local.module.css";

const noopSubscribe = () => () => {};
export function useDraft(slot: string, initial: DraftContent, forcedId?: string) {
  const seed = useRef(initial);
  const [controller, setController] = useState<DraftController>();
  const fallback = useRef<DraftSnapshot>({ id: "", content: initial, ready: false, dirty: false, saving: false, version: 0, error: "" });
  useEffect(() => {
    const value = openDraft(slot, seed.current, forcedId);
    // Subscribe before publishing the controller so cached drafts can be resumed too.
    Promise.resolve().then(() => setController(value));
  }, [slot, forcedId]);
  const snapshot = useSyncExternalStore(controller?.subscribe ?? noopSubscribe, controller?.snapshot ?? (() => fallback.current), () => fallback.current);
  return { controller, ...snapshot };
}
export function DraftFeedback({ draft }: { draft: ReturnType<typeof useDraft> }) {
  const [actionError, setActionError] = useState("");
  return <>
    {draft.error || actionError ? <div className="form-error" role="alert">{draft.error || actionError}
      <button className={styles.textAction} type="button" disabled={draft.saving} onClick={() => { setActionError(""); void draft.controller?.keepCopy().catch(cause => setActionError(cause instanceof Error ? cause.message : "Could not keep a copy.")); }}>Keep my copy</button>
    </div> : draft.version > 0 || draft.saving ? <span className={styles.draftStatus} role="status">{draft.dirty || draft.saving ? "Saving draft…" : "Draft saved"}</span> : null}
  </>;
}
