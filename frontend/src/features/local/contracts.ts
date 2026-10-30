export type TaskStatus = "Todo" | "InProgress" | "Done";
export type LocalProfile = { key: "device"; id: string; name: string; createdAt: string };
export type Project = { id: string; name: string; color: string; taskCount: number; doneCount: number; createdAt: string; updatedAt: string; state?: "active" | "archived"; version?: number };
export type Task = { id: string; projectId: string; title: string; status: TaskStatus; dueDate: string | null; createdAt: string; completedAt: string | null; description?: string; version: number };
export type TaskPage = { items: Task[]; more: boolean };

export function validName(value: string, maximum: number): string {
  const name = value.trim();
  if (!name || name.length > maximum) throw new Error(`Use 1 to ${maximum} characters.`);
  return name;
}

export function validDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid due date.");
  }
  return value;
}

export const taskStatuses: readonly TaskStatus[] = ["Todo", "InProgress", "Done"];
export const statusLabels: Record<TaskStatus, string> = { Todo: "To do", InProgress: "In progress", Done: "Done" };
export function validStatus(value: string): TaskStatus {
  if (!taskStatuses.includes(value as TaskStatus)) throw new Error("Choose a valid status.");
  return value as TaskStatus;
}

export function validDescription(value: string): string {
  if (value.length > 5000) throw new Error("Description must be 5,000 characters or fewer.");
  return value.trim();
}
export type DueFilter = "all" | "today" | "overdue" | "upcoming" | "undated";
export function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
