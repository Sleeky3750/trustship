"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import Modal from "./Modal";

import type {
  Task,
  TaskPriority,
} from "@/types/models";

export default function EditTaskModal({
  open,
  task,
  onClose,
}: {
  open: boolean;
  task: Task;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] =
    useState(task.description ?? "");
  const [priority, setPriority] =
    useState<TaskPriority>(task.priority);

  const [dueDate, setDueDate] = useState(
    task.dueDate
      ? task.dueDate.toISOString().slice(0, 10)
      : ""
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority);

    setDueDate(
      task.dueDate
        ? task.dueDate
            .toISOString()
            .slice(0, 10)
        : ""
    );
  }, [task]);

  async function saveTask() {
    if (!title.trim()) {
      toast.error("Task title is required.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          title: title.trim(),
          description: description.trim(),
          priority,
          dueDate: dueDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to update task."
        );
      }

      toast.success("Task updated successfully!");
      onClose();
      window.location.reload();
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
  open={open}
  onClose={onClose}
  title="Edit Task"
>
      <div className="space-y-4">
        <h2 className="text-xl font-bold">
          Edit Task
        </h2>

        <input
          className="w-full rounded-lg border p-3"
          placeholder="Task title"
          value={title}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          disabled={saving}
        />

        <textarea
          className="w-full rounded-lg border p-3"
          placeholder="Description"
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          disabled={saving}
        />

        <select
          value={priority}
          onChange={(event) =>
            setPriority(
              event.target.value as TaskPriority
            )
          }
          disabled={saving}
          className="w-full rounded-lg border p-3"
        >
          <option value="LOW">
            🟢 Low
          </option>
          <option value="MEDIUM">
            🟡 Medium
          </option>
          <option value="HIGH">
            🔴 High
          </option>
        </select>

        <input
          type="date"
          value={dueDate}
          onChange={(event) =>
            setDueDate(event.target.value)
          }
          disabled={saving}
          className="w-full rounded-lg border p-3"
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border px-5 py-2"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={saveTask}
            disabled={saving}
            className="rounded-lg bg-black px-5 py-2 text-white disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}