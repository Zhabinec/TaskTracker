import { describe, expect, it } from "vitest";
import { parseBackup } from "../src/features/local/backup";

const date = "2026-10-30T12:00:00.000Z";
function fixture() {
  return { format: "tasktracker-backup", version: 1, exportedAt: date,
    projects: [{ id: "p", name: "Project", color: "violet", createdAt: date, updatedAt: date, taskCount: 99, doneCount: 99 }],
    tasks: [{ id: "t", projectId: "p", title: "Task", status: "Done", dueDate: null, completedAt: date, createdAt: date, version: 6 }] };
}
describe("backup validation", () => {
  it("recomputes untrusted counters and normalizes restored versions", () => {
    const result = parseBackup(JSON.stringify(fixture()));
    expect(result.projects[0]).toMatchObject({ taskCount: 1, doneCount: 1 });
    expect(result.tasks[0].version).toBe(1);
  });
  it("rejects unsupported versions, duplicate ids and inconsistent completion", () => {
    const backup = fixture();
    expect(() => parseBackup(JSON.stringify({ ...backup, version: 2 }))).toThrow("Unsupported");
    expect(() => parseBackup(JSON.stringify({ ...backup, projects: [...backup.projects, ...backup.projects] }))).toThrow("Duplicate project");
    expect(() => parseBackup(JSON.stringify({ ...backup, tasks: [...backup.tasks, ...backup.tasks] }))).toThrow("Duplicate task");
    expect(() => parseBackup(JSON.stringify({ ...backup, tasks: [{ ...backup.tasks[0], completedAt: null }] }))).toThrow("inconsistent");
    expect(() => parseBackup(JSON.stringify({ ...backup, tasks: [{ ...backup.tasks[0], dueDate: "2026-02-30" }] }))).toThrow("due date");
    expect(() => parseBackup(JSON.stringify({ ...backup, tasks: [{ ...backup.tasks[0], status: "Unknown" }] }))).toThrow("valid status");
  });
  it("rejects malformed and oversized input", () => {
    expect(() => parseBackup("not json")).toThrow("valid TaskTracker");
    expect(() => parseBackup("null")).toThrow("structure");
    expect(() => parseBackup(" ".repeat(5 * 1024 * 1024 + 1))).toThrow("5 MB");
  });
});
