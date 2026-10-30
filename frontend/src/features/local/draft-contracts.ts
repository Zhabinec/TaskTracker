import type { Project, Task, TaskStatus } from "./contracts";

export type DraftData = { single: string; multiple: string; mode: "single" | "multiple"; dueDate: string; status: TaskStatus; description?: string; destinationProjectId?: string };
export type DraftContent = { projectId: string; kind: "composer" | "editor" | "project" | "rename"; task?: Task; project?: Project; data: DraftData };
export type Draft = DraftContent & { id: string; version: number; updatedAt: string };
export type DraftReceipt = { id: string; version: number; remainder?: DraftContent };
export function blankDraftData(): DraftData { return { single: "", multiple: "", mode: "single", dueDate: "", status: "Todo", description: "", destinationProjectId: "" }; }
export function hasDraftData(content: DraftContent): boolean {
  return content.kind === "editor" || content.kind === "rename" || Boolean(content.data.single || content.data.multiple || content.data.dueDate || content.data.status !== "Todo");
}
