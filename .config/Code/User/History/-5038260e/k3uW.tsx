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
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="w-full border rounded-lg p-3"
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
        />

        <select
          value={priority}
          onChange={(e) =>
            setPriority(
              e.target.value as TaskPriority
            )
          }
          className="w-full border rounded-lg p-3"
        >
          <option value="LOW">🟢 Low</option>
          <option value="MEDIUM">🟡 Medium</option>
          <option value="HIGH">🔴 High</option>
        </select>

        <input
          type="date"
          value={dueDate}
          onChange={(e) =>
            setDueDate(e.target.value)
          }
          className="w-full border rounded-lg p-3"
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg border"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={saveTask}
            className="bg-black text-white px-5 py-2 rounded-lg"
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}