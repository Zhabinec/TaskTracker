import "fake-indexeddb/auto";
import { beforeAll, expect, it, vi } from "vitest";
import { DraftController } from "../src/features/local/draft-controller";
import { createProject, createTasks, readDraft, saveDraft } from "../src/features/local/store";
import { blankDraftData } from "../src/features/local/draft-contracts";

beforeAll(() => {
  vi.stubGlobal("window", Object.assign(new EventTarget(), { indexedDB })); vi.stubGlobal("BroadcastChannel", undefined);
});
it("serializes rapid inputs and flushes the latest value", async () => {
  const id = crypto.randomUUID();
  const draft = new DraftController(id, "rapid", { projectId: "p", kind: "composer", data: blankDraftData() });
  await draft.flush();
  for (let index = 0; index < 40; index++) draft.patch({ single: `Input ${index}` });
  await draft.flush();
  expect((await readDraft(draft.snapshot().id))?.data.single).toBe("Input 39");
  expect(draft.snapshot()).toMatchObject({ dirty: false, saving: false, error: "" });
});
it("keeps failed input in memory and retries without resetting it", async () => {
  const id = crypto.randomUUID();
  const draft = new DraftController(id, "quota", { projectId: "p", kind: "composer", data: blankDraftData() });
  await draft.flush();
  const write = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => { throw new DOMException("Storage full", "QuotaExceededError"); });
  draft.patch({ single: "Never discard this text" });
  await expect(draft.flush()).rejects.toThrow("Storage full");
  expect(draft.snapshot()).toMatchObject({ dirty: true, content: { data: { single: "Never discard this text" } } });
  write.mockRestore();
  await draft.flush();
  expect((await readDraft(draft.snapshot().id))?.data.single).toBe("Never discard this text");
  expect(draft.snapshot().error).toBe("");
});
it("rotates consumed draft identities so stale writers cannot match a new version 1", async () => {
  const project = await createProject("Draft generations");
  const initial = { projectId: project.id, kind: "composer" as const, data: blankDraftData() };
  const draft = new DraftController(crypto.randomUUID(), "generation", initial);
  await draft.flush(); draft.patch({ single: "First generation" });
  const receipt = (await draft.flush())!;
  await createTasks(project.id, ["First generation"], "", "Todo", receipt);
  draft.accept(initial);
  draft.patch({ single: "Second generation" }); await draft.flush();
  expect(draft.snapshot().id).not.toBe(receipt.id);
  await expect(saveDraft(receipt.id, { ...initial, data: { ...blankDraftData(), single: "Stale writer" } }, receipt.version)).rejects.toThrow("another tab");
  expect((await readDraft(draft.snapshot().id))?.data.single).toBe("Second generation");
});
