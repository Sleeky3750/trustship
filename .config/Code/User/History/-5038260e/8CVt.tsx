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
  onTaskUpdated,
}: {
  open: boolean;
  task: Task;
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(
    task.description ?? ""
  );
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
        ? task.dueDate.toISOString().slice(0, 10)
        : ""
    );
  }, [task]);

  async function saveTask() {
    if (!title.trim()) {
      toast.error("Task title is required.");
      return;
    }

    if (saving) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/tasks/edit", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          title: title.trim(),
          description,
          priority,
          dueDate: dueDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to update task."
        );
      }

      const updatedTask: Task = {
        ...task,
        title: title.trim(),
        description: description || null,
        priority,
        dueDate: dueDate
          ? new Date(`${dueDate}T00:00:00`)
          : null,
        updatedAt: new Date(),
      };

      onTaskUpdated(updatedTask);

      toast.success("Task updated successfully!");

      onClose();
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
      title="Edit Task"
      onClose={onClose}
    >
      <div className="space-y-4">
        <input
          className="w-full border rounded-lg p-3"
          placeholder="Task title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          disabled={saving}
        />

        <textarea
          className="w-full border rounded-lg p-3"
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
          disabled={saving}
        />

        <select
          value={priority}
          onChange={(e) =>
            setPriority(
              e.target.value as TaskPriority
            )
          }
          className="w-full border rounded-lg p-3"
          disabled={saving}
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
          onChange={(e) =>
            setDueDate(e.target.value)
          }
          className="w-full border rounded-lg p-3"
          disabled={saving}
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg border"
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={saveTask}
            className="bg-black text-white px-5 py-2 rounded-lg disabled:opacity-50"
            disabled={saving}
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