"use client";

import { useState, useSyncExternalStore } from "react";
import { draftFailureCount, flushDrafts, subscribeDraftSafety } from "./draft-controller";

export function DraftSafety() {
  const failures = useSyncExternalStore(subscribeDraftSafety, draftFailureCount, () => 0);
  const [error, setError] = useState("");
  if (!failures) return null;
  return <aside className="draft-safety glass" role="alert">Draft not saved. Keep this tab open.
    <button type="button" className="secondary" onClick={() => { setError(""); void flushDrafts().catch(() => setError("Storage still unavailable. Return to the draft to keep a copy or discard it.")); }}>Retry</button>
    {error && <span>{error}</span>}
  </aside>;
}
