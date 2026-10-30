import { discardDraft, readDraft, saveDraft } from "./store";
import { blankDraftData, hasDraftData } from "./draft-contracts";
import type { Draft, DraftContent, DraftReceipt } from "./draft-contracts";

export type DraftSnapshot = { id: string; content: DraftContent; ready: boolean; dirty: boolean; saving: boolean; version: number; error: string };
const controllers = new Map<string, DraftController>();
const globalListeners = new Set<() => void>();
const slots = new Map<string, string>();
let guarded = false;
function message(cause: unknown) { return cause instanceof Error ? cause.message : "Draft could not be saved. Keep this tab open."; }
function pointSlot(slot: string, id: string) {
  slots.set(slot, id);
  try { sessionStorage.setItem(`tasktracker:draft:${slot}`, id); } catch { /* Recovery remains available from Saved drafts. */ }
}
function slotId(slot: string): string {
  try { const stored = sessionStorage.getItem(`tasktracker:draft:${slot}`); if (stored) return stored; } catch { /* Use an in-memory slot when session storage is unavailable. */ }
  return slots.get(slot) ?? crypto.randomUUID();
}
export function subscribeDraftSafety(listener: () => void) { globalListeners.add(listener); return () => { globalListeners.delete(listener); }; }
export function draftFailureCount() { return [...controllers.values()].filter(controller => Boolean(controller.snapshot().error)).length; }
export function hasPendingDrafts() { return [...controllers.values()].some(controller => controller.snapshot().dirty || controller.snapshot().saving); }
export async function flushDrafts(): Promise<void> {
  await Promise.all([...controllers.values()].map(controller => controller.flush()));
}
export async function discardSavedDraft(draft: Draft): Promise<void> {
  const controller = controllers.get(draft.id);
  if (controller) {
    if (controller.snapshot().version !== draft.version || controller.snapshot().saving) throw new Error("Draft is being updated. Please retry.");
    const content = controller.snapshot().content;
    await controller.discard({ ...content, data: content.task ? { ...blankDraftData(), single: content.task.title, dueDate: content.task.dueDate ?? "", status: content.task.status } : blankDraftData() });
  } else await discardDraft(draft);
}
export function openDraft(slot: string, initial: DraftContent, forcedId?: string): DraftController {
  if (!guarded) {
    window.addEventListener("beforeunload", event => { if (hasPendingDrafts() || draftFailureCount()) { event.preventDefault(); event.returnValue = ""; } });
    guarded = true;
  }
  const id = forcedId ?? slotId(slot); pointSlot(slot, id);
  const existing = controllers.get(id);
  // A saved/cancelled editor must start from the current task on the next opening.
  const canReload = existing && !existing.snapshot().dirty && !existing.snapshot().saving;
  if (existing && !(canReload && (forcedId || (initial.kind === "editor" && !existing.snapshot().version)))) return existing;
  const controller = new DraftController(id, slot, initial); controllers.set(id, controller); return controller;
}

export class DraftController {
  private state: DraftSnapshot;
  private listeners = new Set<() => void>();
  private generation = 0;
  private writing?: Promise<void>;
  private loading: Promise<void>;
  constructor(id: string, private slot: string, initial: DraftContent) {
    this.state = { id, content: initial, ready: false, dirty: false, saving: false, version: 0, error: "" };
    this.loading = this.load();
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(values: Partial<DraftSnapshot>) {
    this.state = { ...this.state, ...values };
    this.listeners.forEach(listener => listener()); globalListeners.forEach(listener => listener());
  }
  private renewId() {
    const previous = this.state.id; const id = crypto.randomUUID();
    controllers.delete(previous); controllers.set(id, this); pointSlot(this.slot, id);
    this.publish({ id });
  }
  private async load() {
    try {
      const saved = await readDraft(this.state.id);
      if (saved && (saved.projectId !== this.state.content.projectId || saved.kind !== this.state.content.kind || saved.task?.id !== this.state.content.task?.id)) throw new Error("Draft does not belong to this form.");
      // Never reuse a consumed draft identity: its version could otherwise restart
      // at 1 and accept a stale writer from another tab (the ABA problem).
      if (!saved) this.renewId();
      this.publish({ content: saved ?? this.state.content, version: saved?.version ?? 0, ready: true, error: "" });
    } catch (cause) { this.publish({ error: message(cause) }); }
  }
  patch(data: Partial<DraftContent["data"]>) {
    if (!this.state.ready) return;
    this.generation++;
    this.publish({ content: { ...this.state.content, data: { ...this.state.content.data, ...data } }, dirty: true });
    void this.flush().catch(() => { /* Error stays visible and the in-memory draft is retained. */ });
  }
  failed(cause: unknown) { this.publish({ error: message(cause), dirty: true }); }
  async flush(): Promise<DraftReceipt | undefined> {
    await this.loading;
    if (!this.state.ready) throw new Error(this.state.error || "Draft storage unavailable.");
    if (this.writing) { await this.writing; return this.flush(); }
    if (this.state.dirty) {
      this.writing = this.write();
      try { await this.writing; } finally { this.writing = undefined; }
    }
    return this.state.version ? { id: this.state.id, version: this.state.version } : undefined;
  }
  private async write() {
    this.publish({ saving: true });
    try {
      while (this.state.dirty) {
        const generation = this.generation; const { id, content, version } = this.state;
        if (!hasDraftData(content)) {
          if (version) { await discardDraft({ id, version }); this.renewId(); }
          this.publish({ version: 0, dirty: generation !== this.generation, error: "" });
        } else {
          const saved = await saveDraft(id, content, version);
          this.publish({ version: saved.version, dirty: generation !== this.generation, error: "" });
        }
      }
    } catch (cause) { this.publish({ error: message(cause) }); throw cause; }
    finally { this.publish({ saving: false }); }
  }
  accept(content: DraftContent, receipt?: DraftReceipt) {
    if (!receipt?.remainder) this.renewId();
    this.publish({ content, dirty: false, version: receipt?.remainder ? receipt.version + 1 : 0, error: "" });
  }
  async discard(initial: DraftContent) {
    // Wait for any in-flight write, but allow explicitly discarding a failed local edit.
    await this.loading; await this.writing?.catch(() => {});
    if (this.state.version) await discardDraft({ id: this.state.id, version: this.state.version });
    this.accept(initial);
  }
  async keepCopy() {
    await this.loading; await this.writing?.catch(() => {});
    const previous = this.state.id; const id = crypto.randomUUID(); const generation = this.generation;
    this.publish({ saving: true });
    try {
      const saved = await saveDraft(id, this.state.content, 0);
      controllers.delete(previous); controllers.set(id, this); pointSlot(this.slot, id);
      this.publish({ id, ready: true, version: saved.version, dirty: generation !== this.generation, error: "" });
    } catch (cause) { this.publish({ error: message(cause) }); throw cause; }
    finally { this.publish({ saving: false }); }
    await this.flush();
  }
}
