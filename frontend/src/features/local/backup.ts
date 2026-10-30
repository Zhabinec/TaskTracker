import { validDate, validName, validStatus } from "./contracts";
import type { Project, Task } from "./contracts";

export const backupLimit = 5 * 1024 * 1024;
export type WorkspaceBackup = { format: "tasktracker-backup"; version: 1; exportedAt: string; projects: Project[]; tasks: Task[] };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid backup structure.");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid backup field.");
  return value;
}
function timestamp(value: unknown): string {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error("Invalid backup timestamp.");
  return new Date(date).toISOString();
}
export function parseBackup(source: string): WorkspaceBackup {
  if (new TextEncoder().encode(source).byteLength > backupLimit) throw new Error("Backup exceeds 5 MB.");
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("Choose a valid TaskTracker JSON backup."); }
  const data = object(parsed);
  if (data.format !== "tasktracker-backup" || data.version !== 1) throw new Error("Unsupported backup format or version.");
  if (!Array.isArray(data.projects) || !Array.isArray(data.tasks) || data.projects.length > 1000 || data.tasks.length > 20000) throw new Error("Backup supports up to 1,000 projects and 20,000 tasks.");
  const ids = new Set<string>();
  const projects: Project[] = data.projects.map(value => {
    const item = object(value); const id = validName(text(item.id), 100);
    if (ids.has(id)) throw new Error("Duplicate project in backup."); ids.add(id);
    const color = text(item.color);
    if (!["violet", "coral", "blue"].includes(color)) throw new Error("Invalid project color.");
    return { id, name: validName(text(item.name), 100), color, createdAt: timestamp(item.createdAt), updatedAt: timestamp(item.updatedAt), taskCount: 0, doneCount: 0 };
  });
  const byId = new Map(projects.map(project => [project.id, project])); const taskIds = new Set<string>();
  const tasks: Task[] = data.tasks.map(value => {
    const item = object(value); const id = validName(text(item.id), 100); const projectId = text(item.projectId);
    if (taskIds.has(id)) throw new Error("Duplicate task in backup."); taskIds.add(id);
    const project = byId.get(projectId); if (!project) throw new Error("Task has no project in backup.");
    const status = validStatus(text(item.status)); const completedAt = item.completedAt === null ? null : timestamp(item.completedAt);
    if ((status === "Done") !== Boolean(completedAt)) throw new Error("Task completion data is inconsistent.");
    project.taskCount++; if (status === "Done") project.doneCount++;
    return { id, projectId, title: validName(text(item.title), 200), status, dueDate: item.dueDate === null ? null : validDate(text(item.dueDate)), createdAt: timestamp(item.createdAt), completedAt, version: 1 };
  });
  return { format: "tasktracker-backup", version: 1, exportedAt: timestamp(data.exportedAt), projects, tasks };
}
