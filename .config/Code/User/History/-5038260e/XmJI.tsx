"use client";

import { useState } from "react";
import { toast } from "sonner";

import Modal from "./Modal";
import type { Task } from "@/types/models";

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
    useState(task.priority);

  const [dueDate, setDueDate] =
    useState(
      task.dueDate
        ? task.dueDate.substring(0, 10)
        : ""
    );

  async function saveTask() {
    const response = await fetch(
      "/api/tasks/edit",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          title,
          description,
          priority,
          dueDate,
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      toast.success("Task updated!");

      onClose();

      window.location.reload();
    } else {
      toast.error(data.message);
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
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
        />

        <textarea
          className="w-full border rounded-lg p-3"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
        />

        <select
          value={priority}
          onChange={(e) =>
            setPriority(
              e.target.value as
                | "LOW"
                | "MEDIUM"
                | "HIGH"
            )
          }
          className="w-full border rounded-lg p-3"
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
        />

        <div className="flex justify-end gap-3">

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border"
          >
            Cancel
          </button>

          <button
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